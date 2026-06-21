import Stripe from 'npm:stripe@14'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const { items, customer, pickupDate, pickupTime, note, subtotal, tax, total } = await req.json()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      ...items.map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: item.nameZh, description: item.nameEn },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.qty,
      })),
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'MA Sales Tax (6.25%)' },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: 'https://lukchen.github.io/NoodleFan-Website/?success=true',
    cancel_url: 'https://lukchen.github.io/NoodleFan-Website/',
    metadata: {
      customer_name: customer.name,
      customer_phone: customer.phone,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      note: note ?? '',
      items: JSON.stringify(items),
      subtotal: String(subtotal),
      tax: String(tax),
      total: String(total),
    },
  })

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
