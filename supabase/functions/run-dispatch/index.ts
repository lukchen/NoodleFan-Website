// 定点配送的「发车 / 不发车」结算口 —— 密码保护,和 admin-orders 用同一个 ADMIN_PASSWORD。
//
// POST { password }                                  -> 列出所有待处理班次及成团进度
// POST { password, point, runDate }                  -> 查这一班的明细
// POST { password, point, runDate, action:'capture'} -> 成团发车:逐单扣款
// POST { password, point, runDate, action:'cancel' } -> 未成团:逐单取消授权(客人零扣费)
//
// 为什么要这个函数:下单时只做了授权,钱冻在客人卡上。不 capture 客人不会被扣钱,
// 而授权最多只能挂 7 天,过期自动失效 —— 发了车却忘了 capture 就是白送餐。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MIN_ORDERS = Number(Deno.env.get('MIN_ORDERS') ?? '5')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function stripePost(path: string, key: string, form?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(form ?? {}).toString(),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

// 扣款后才有 charge,这时才查得到手续费/净收入。授权阶段查不到。
async function readFeeNet(paymentIntentId: string, key: string) {
  const res = await fetch(
    `https://api.stripe.com/v1/payment_intents/${paymentIntentId}?expand[]=latest_charge.balance_transaction`,
    { headers: { Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) return null
  const pi = await res.json()
  const bt = pi?.latest_charge?.balance_transaction
  if (bt && typeof bt.fee === 'number') return { fee: bt.fee / 100, net: bt.net / 100 }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { password, point, runDate, action } = await req.json()
    if (password !== Deno.env.get('ADMIN_PASSWORD')) return json({ error: 'unauthorized' }, 401)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    // ── 1. 概览:还没结算的班次 ──────────────────────────────────────────
    if (!point || !runDate) {
      const { data, error } = await supabase
        .from('orders')
        .select('pickup_point, pickup_point_name, run_date, total')
        .eq('status', 'authorized')
        .not('run_date', 'is', null)
      if (error) throw new Error(error.message)

      const runs: Record<string, any> = {}
      for (const o of data ?? []) {
        const k = `${o.pickup_point}|${o.run_date}`
        runs[k] ??= {
          point: o.pickup_point,
          pointName: o.pickup_point_name,
          runDate: o.run_date,
          orders: 0,
          amount: 0,
        }
        runs[k].orders += 1
        runs[k].amount += Number(o.total ?? 0)
      }
      const list = Object.values(runs).map((r: any) => ({
        ...r,
        amount: Math.round(r.amount * 100) / 100,
        minOrders: MIN_ORDERS,
        ready: r.orders >= MIN_ORDERS,   // 够不够发车
      }))
      return json({ minOrders: MIN_ORDERS, runs: list })
    }

    // ── 2. 这一班的明细 ────────────────────────────────────────────────
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, pickup_code, customer_name, customer_phone, total, status, stripe_payment_intent')
      .eq('pickup_point', point)
      .eq('run_date', runDate)
      .eq('status', 'authorized')
    if (error) throw new Error(error.message)

    if (!action) {
      return json({
        point, runDate, minOrders: MIN_ORDERS,
        count: orders?.length ?? 0,
        ready: (orders?.length ?? 0) >= MIN_ORDERS,
        orders,
      })
    }
    if (action !== 'capture' && action !== 'cancel') return json({ error: 'bad action' }, 400)
    if (!orders || orders.length === 0) return json({ error: '这一班没有待结算的订单' }, 400)

    // ── 3. 逐单结算 ───────────────────────────────────────────────────
    // 一单一单来、各自记结果:一单失败(卡被冻结、授权过期)不能连累其他单。
    const results: any[] = []
    for (const o of orders) {
      if (!o.stripe_payment_intent) {
        results.push({ id: o.id, code: o.pickup_code, ok: false, error: '缺少 payment_intent' })
        continue
      }
      const { ok, data } = await stripePost(
        `payment_intents/${o.stripe_payment_intent}/${action}`,
        stripeKey,
      )
      if (!ok) {
        results.push({ id: o.id, code: o.pickup_code, ok: false, error: data?.error?.message })
        continue
      }

      const patch: Record<string, unknown> = action === 'capture'
        ? { status: 'paid', captured_at: new Date().toISOString() }
        : { status: 'cancelled_no_run', cancelled_at: new Date().toISOString() }

      if (action === 'capture') {
        const fn = await readFeeNet(o.stripe_payment_intent, stripeKey)
        if (fn) { patch.stripe_fee = fn.fee; patch.net_income = fn.net }
      }

      const { error: upErr } = await supabase.from('orders').update(patch).eq('id', o.id)
      results.push({
        id: o.id, code: o.pickup_code, ok: !upErr,
        error: upErr?.message,
        amount: o.total,
      })
    }

    // 客人的订单状态页和后台都在听这个频道
    try {
      await supabase.channel('orders').send({
        type: 'broadcast',
        event: 'status_changed',
        payload: { at: new Date().toISOString() },
      })
    } catch (_e) { /* 广播失败不影响钱已经处理完 */ }

    const okCount = results.filter(r => r.ok).length
    return json({
      action, point, runDate,
      total: results.length,
      succeeded: okCount,
      failed: results.length - okCount,
      results,
    })
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})
