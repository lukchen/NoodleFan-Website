const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    const { items, customer, pickupDate, pickupTime, note, subtotal, tax, total } = await req.json()

    const params = new URLSearchParams()
    params.set('mode', 'payment')
    params.set('payment_method_types[0]', 'card')
    params.set('success_url', 'https://lukchen.github.io/NoodleFan-Website/?success=true')
    params.set('cancel_url', 'https://lukchen.github.io/NoodleFan-Website/')

    items.forEach((item: any, i: number) => {
      params.set(`line_items[${i}][price_data][currency]`, 'usd')
      params.set(`line_items[${i}][price_data][product_data][name]`, item.nameZh)
      params.set(`line_items[${i}][price_data][product_data][description]`, item.nameEn)
      params.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(item.price * 100)))
      params.set(`line_items[${i}][quantity]`, String(item.qty))
    })

    const taxIdx = items.length
    params.set(`line_items[${taxIdx}][price_data][currency]`, 'usd')
    params.set(`line_items[${taxIdx}][price_data][product_data][name]`, 'MA Sales Tax (6.25%)')
    params.set(`line_items[${taxIdx}][price_data][unit_amount]`, String(Math.round(tax * 100)))
    params.set(`line_items[${taxIdx}][quantity]`, '1')

    params.set('metadata[customer_name]', customer.name)
    params.set('metadata[customer_phone]', customer.phone)
    params.set('metadata[pickup_date]', pickupDate)
    params.set('metadata[pickup_time]', pickupTime)
    params.set('metadata[note]', note ?? '')
    params.set('metadata[items]', JSON.stringify(items))
    params.set('metadata[subtotal]', String(subtotal))
    params.set('metadata[tax]', String(tax))
    params.set('metadata[total]', String(total))

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? 'Stripe error')

    return new Response(JSON.stringify({ url: data.url }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
