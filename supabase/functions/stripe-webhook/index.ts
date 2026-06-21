import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const m = session.metadata!

    const { error } = await supabase.from('orders').insert({
      stripe_session_id: session.id,
      customer_name: m.customer_name,
      customer_phone: m.customer_phone,
      pickup_date: m.pickup_date,
      pickup_time: m.pickup_time,
      note: m.note,
      items: JSON.parse(m.items),
      subtotal: parseFloat(m.subtotal),
      tax: parseFloat(m.tax),
      total: parseFloat(m.total),
      status: 'paid',
    })

    if (error) console.error('DB insert error:', error)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
