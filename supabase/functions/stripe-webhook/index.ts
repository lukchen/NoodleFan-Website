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

    const { error } = await supabase.from('orders').insert({
      stripe_session_id: session.id,
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
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
