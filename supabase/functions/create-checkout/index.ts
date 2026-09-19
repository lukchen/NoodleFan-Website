// Creates a Stripe Checkout Session for a cart.
//
// Flow: validate + price the cart SERVER-SIDE from the canonical menu (client-sent
// prices are never trusted), insert a draft order row (status 'pending') holding the
// full details, then create the Stripe session with only the order id in metadata —
// the 500-char metadata value limit no longer constrains order size. The webhook
// flips the draft to 'paid'. Abandoned drafts stay 'pending' and are filtered out
// everywhere.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import menu, { resolveSelections } from '../_shared/menu.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TAX_RATE = 0.07 // MA 6.25% + Boston local option 0.75%
const SITE_URL = 'https://noodlefanboston.com/'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    const { items, customer, pickupPoint, pickupRunDate, pickupDate, pickupTime, note } = await req.json()

    // 定点配送要凑满才发车 —— 所以下单只做「授权」(钱冻在客人卡上,没进我们账户),
    // 成团后由 run-dispatch 扣款,未成团直接取消授权:客人零扣费,我们零手续费。
    // 到店自取没有成团这回事,照旧立即扣款。
    const isDropoff = pickupPoint?.kind === 'dropoff'
    const captureMode = isDropoff ? 'manual' : 'automatic'
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      throw new Error('invalid items')
    }

    // Price each line from the canonical menu + selected options (all money in cents).
    const enriched = items.map((it: { id: number; qty: number; selections?: Record<string, unknown> }) => {
      const dish = menu.find((d: { id: number }) => d.id === it.id)
      if (!dish) throw new Error(`unknown dish: ${it.id}`)
      const qty = Math.floor(Number(it.qty))
      if (!(qty >= 1 && qty <= 20)) throw new Error('invalid qty')
      const { deltaCents, optionsZh, optionsEn } = resolveSelections(dish, it.selections)
      const unitCents = Math.round(dish.price * 100) + deltaCents
      return {
        id: dish.id, qty, unitCents,
        price: unitCents / 100,
        nameZh: dish.nameZh, nameEn: dish.nameEn,
        optionsZh, optionsEn,
      }
    })
    const subtotalCents = enriched.reduce((s, e) => s + e.unitCents * e.qty, 0)
    const taxCents = Math.round(subtotalCents * TAX_RATE)
    const totalCents = subtotalCents + taxCents

    // Draft order — full details live in the DB from the start.
    const { data: draft, error: draftErr } = await supabase
      .from('orders')
      .insert({
        customer_name: customer.name,
        customer_phone: customer.phone,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        // 取餐点跟单走:少了它,Allston 的团购单和到店自取单在后台长得一模一样。
        pickup_point: pickupPoint?.id ?? null,
        pickup_point_name: pickupPoint?.nameZh ?? null,
        // 哪一班车 —— 成团统计按「取餐点 + 发车日」分组
        run_date: isDropoff ? (pickupRunDate ?? pickupDate) : null,
        capture_mode: captureMode,
        note: note ?? '',
        items: enriched.map(({ unitCents: _drop, ...rest }) => rest),
        subtotal: subtotalCents / 100,
        tax: taxCents / 100,
        total: totalCents / 100,
        status: 'pending',
      })
      .select('id')
      .single()
    if (draftErr) throw new Error(draftErr.message)

    const params = new URLSearchParams()
    params.set('mode', 'payment')
    // Omit payment_method_types entirely: Checkout then auto-enables every method
    // turned on in the Stripe Dashboard (card, Apple Pay, Google Pay, Link, ...).
    // {CHECKOUT_SESSION_ID} is substituted by Stripe; the confirmation page uses it
    // to look up this order (pickup code + live status).
    params.set('success_url', `${SITE_URL}?success=true&session_id={CHECKOUT_SESSION_ID}`)
    params.set('cancel_url', SITE_URL)

    enriched.forEach((e, i) => {
      const desc = e.optionsEn.length ? `${e.nameEn} · ${e.optionsEn.join(', ')}` : e.nameEn
      params.set(`line_items[${i}][price_data][currency]`, 'usd')
      params.set(`line_items[${i}][price_data][product_data][name]`, e.nameZh)
      params.set(`line_items[${i}][price_data][product_data][description]`, desc)
      params.set(`line_items[${i}][price_data][unit_amount]`, String(e.unitCents))
      params.set(`line_items[${i}][quantity]`, String(e.qty))
    })

    const taxIdx = enriched.length
    params.set(`line_items[${taxIdx}][price_data][currency]`, 'usd')
    params.set(`line_items[${taxIdx}][price_data][product_data][name]`, 'MA Sales Tax (7%)')
    params.set(`line_items[${taxIdx}][price_data][unit_amount]`, String(taxCents))
    params.set(`line_items[${taxIdx}][quantity]`, '1')

    if (captureMode === 'manual') {
      params.set('payment_intent_data[capture_method]', 'manual')
      // 客人在 Stripe 页面上也要看到这不是立即扣款
      params.set('payment_intent_data[description]',
        `NoodleFan 定点配送 · ${pickupPoint?.nameZh ?? ''} · 满单发车后才扣款`)
    }
    params.set('metadata[order_id]', draft.id)
    params.set('metadata[capture_mode]', captureMode)

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

    // Link the session to the draft (the webhook also sets it, belt-and-suspenders).
    await supabase.from('orders').update({ stripe_session_id: data.id }).eq('id', draft.id)

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
