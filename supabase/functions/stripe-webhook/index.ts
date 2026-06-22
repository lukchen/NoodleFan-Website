import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

// Verify Stripe webhook signature manually (HMAC-SHA256) — avoids the Stripe SDK,
// which fails to make network connections in this Deno runtime.
async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')))
  const timestamp = parts['t']
  const expectedSig = parts['v1']
  if (!timestamp || !expectedSig) return false

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
  const computed = [...new Uint8Array(sigBuffer)].map(b => b.toString(16).padStart(2, '0')).join('')

  // constant-time-ish compare
  if (computed.length !== expectedSig.length) return false
  let mismatch = 0
  for (let i = 0; i < computed.length; i++) mismatch |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  return mismatch === 0
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function stripeGet(path: string, stripeKey: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  })
  const json = await res.json()
  if (!res.ok) {
    console.error(`Stripe GET ${path} failed:`, res.status, JSON.stringify(json))
    return null
  }
  return json
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// One attempt at reading the charge's balance_transaction (fee + net) for a PaymentIntent.
// Walks PaymentIntent → latest_charge → balance_transaction, fetching each level
// explicitly if `expand` didn't inline it. Raw fetch (no Stripe SDK).
async function readFeeNetOnce(
  paymentIntentId: string,
  stripeKey: string,
): Promise<{ fee: number; net: number } | null> {
  const pi = await stripeGet(
    `payment_intents/${paymentIntentId}?expand[]=latest_charge.balance_transaction`,
    stripeKey,
  )
  if (!pi) return null

  // latest_charge is an object when expand applied, else a charge id string.
  let charge = pi.latest_charge
  if (typeof charge === 'string') {
    charge = await stripeGet(`charges/${charge}?expand[]=balance_transaction`, stripeKey)
  }
  if (!charge || typeof charge !== 'object') return null

  // balance_transaction is an object once attached, a txn id string, or null if not yet.
  let bt = charge.balance_transaction
  if (typeof bt === 'string') {
    bt = await stripeGet(`balance_transactions/${bt}`, stripeKey)
  }
  if (bt && typeof bt.fee === 'number' && typeof bt.net === 'number') {
    // Stripe amounts are in cents; return dollars to match subtotal/tax/total.
    return { fee: bt.fee / 100, net: bt.net / 100 }
  }
  return null
}

// The charge's balance_transaction (where the fee lives) is NOT attached the instant
// checkout.session.completed fires — it appears a few seconds later. Retry a handful of
// times so we capture the fee without blocking order creation. Stays well under Stripe's
// webhook timeout. Returns nulls if it never shows (rare; order still saved).
async function lookupFeeNet(
  paymentIntentId: string,
  stripeKey: string,
): Promise<{ fee: number | null; net: number | null }> {
  const delays = [0, 1000, 1500, 2000, 2500] // ~7s worst case across 5 attempts
  for (const delay of delays) {
    if (delay) await sleep(delay)
    const result = await readFeeNetOnce(paymentIntentId, stripeKey)
    if (result) return result
  }
  console.warn('Fee/net still unavailable after retries for PI', paymentIntentId)
  return { fee: null, net: null }
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!sig || !secret) return new Response('Missing signature/secret', { status: 400 })

  const body = await req.text()

  const valid = await verifyStripeSignature(body, sig, secret)
  if (!valid) return new Response('Invalid signature', { status: 400 })

  const event = JSON.parse(body)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const m = session.metadata ?? {}
    const paymentIntentId: string | null = session.payment_intent ?? null

    // 1. Save the order right away — the kitchen must be alerted without waiting on
    //    Stripe's fee data, which isn't ready the instant this event fires. Fee/net
    //    are filled in below once available.
    const { error } = await supabase.from('orders').insert({
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntentId,
      customer_name: m.customer_name,
      customer_phone: m.customer_phone,
      pickup_date: m.pickup_date,
      pickup_time: m.pickup_time,
      note: m.note,
      items: JSON.parse(m.items ?? '[]'),
      subtotal: parseFloat(m.subtotal ?? '0'),
      tax: parseFloat(m.tax ?? '0'),
      total: parseFloat(m.total ?? '0'),
      status: 'paid',
    })

    if (error) {
      console.error('DB insert error:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    // 2. Broadcast a PII-free "new order" signal so the admin dashboard alerts instantly.
    //    The signal carries no customer data — the dashboard re-fetches via the
    //    password-protected admin-orders function.
    try {
      await supabase.channel('orders').send({
        type: 'broadcast',
        event: 'new_order',
        payload: { at: new Date().toISOString() },
      })
    } catch (e) {
      console.error('Broadcast error (non-fatal):', e)
    }

    // 3. Capture Stripe fee + net payout for financial reporting and write them back to
    //    the order. Retried (balance_transaction lags the event); non-fatal if it never
    //    settles — the order is already saved and fees can be backfilled later.
    if (paymentIntentId) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) {
        console.error('STRIPE_SECRET_KEY not set — cannot look up fee/net')
      } else {
        const { fee, net } = await lookupFeeNet(paymentIntentId, stripeKey)
        if (fee !== null) {
          const { error: feeErr } = await supabase
            .from('orders')
            .update({ stripe_fee: fee, net_income: net })
            .eq('stripe_session_id', session.id)
          if (feeErr) console.error('Fee update error:', feeErr)
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
