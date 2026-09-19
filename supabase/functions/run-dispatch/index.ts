// 定点配送的「发车 / 不发车」结算口 —— 密码保护,和 admin-orders 用同一个 ADMIN_PASSWORD。
//
// POST { password }                                  -> 列出所有待处理班次及成团进度
// POST { password, point, runDate }                  -> 查这一班的明细
// POST { password, point, runDate, action:'capture'} -> 成团发车:逐单扣款
// POST { password, point, runDate, action:'cancel' } -> 未成团:逐单取消授权(客人零扣费)
// POST { password, action:'auto' }                   -> 定时任务:结算所有已过截单时刻的班次
//
// 为什么要这个函数:下单时只做了授权,钱冻在客人卡上。不 capture 客人不会被扣钱,
// 而授权最多只能挂 7 天,过期自动失效 —— 发了车却忘了 capture 就是白送餐。
//
// 自动结算为什么挑「截单时刻」而不是「第 5 单」:第 5 单之后订单还在进来,提前扣款
// 等于把一班拆成两批;而且一旦扣了款再想取消就只能退款 —— 手续费拿不回来、客人要等
// 5–10 个工作日。截单时刻订单量已经定死,这时候判断最干净。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MIN_ORDERS  = Number(Deno.env.get('MIN_ORDERS') ?? '5')
const CUTOFF_HOUR = Number(Deno.env.get('CUTOFF_HOUR') ?? '15')   // 发车当天 15:00 截单
const TZ = 'America/New_York'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// run_date 是「哪天发车」,截单时刻是那天波士顿时间的 CUTOFF_HOUR。
// 服务器跑在 UTC,夏令时一年变两次,所以按当天的实际偏移换算,不写死 -5/-4。
function cutoffUtc(runDate: string): Date {
  const guess = new Date(`${runDate}T${String(CUTOFF_HOUR).padStart(2, '0')}:00:00Z`)
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(guess).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5'
  const m = tzName.match(/GMT([+-]\d+)(?::(\d+))?/)
  const offMin = m ? Number(m[1]) * 60 + (Number(m[2] ?? 0) * Math.sign(Number(m[1]))) : -300
  return new Date(guess.getTime() - offMin * 60000)
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

async function loadRunOrders(point: string, runDate: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, pickup_code, customer_name, customer_phone, total, status, stripe_payment_intent')
    .eq('pickup_point', point)
    .eq('run_date', runDate)
    .eq('status', 'authorized')
  if (error) throw new Error(error.message)
  return data ?? []
}

// 逐单结算:一单失败(卡被冻结、授权过期)不能连累其他单,所以各自记结果、不抛错。
async function settle(orders: any[], action: 'capture' | 'cancel', stripeKey: string) {
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
  return results
}

// 客人的订单状态页和后台都在听这个频道
async function broadcast() {
  try {
    await supabase.channel('orders').send({
      type: 'broadcast',
      event: 'status_changed',
      payload: { at: new Date().toISOString() },
    })
  } catch (_e) { /* 广播失败不影响钱已经处理完 */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { password, point, runDate, action } = await req.json()
    if (password !== Deno.env.get('ADMIN_PASSWORD')) return json({ error: 'unauthorized' }, 401)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set')

    // ── 0. 定时自动结算 ────────────────────────────────────────────────
    // 每 15 分钟跑一次:过了截单时刻的班次,满 MIN_ORDERS 就扣款,不满就解冻。
    // 幂等 —— 结算完状态就不再是 authorized,下一轮自然跳过。
    if (action === 'auto') {
      const { data, error } = await supabase
        .from('orders')
        .select('pickup_point, pickup_point_name, run_date')
        .eq('status', 'authorized')
        .not('run_date', 'is', null)
      if (error) throw new Error(error.message)

      const keys = new Map<string, { point: string; runDate: string; name: string }>()
      for (const o of data ?? []) {
        keys.set(`${o.pickup_point}|${o.run_date}`, {
          point: o.pickup_point, runDate: o.run_date, name: o.pickup_point_name,
        })
      }

      const now = Date.now()
      const done: any[] = []
      for (const r of keys.values()) {
        if (now < cutoffUtc(r.runDate).getTime()) continue   // 还没截单,等着
        const orders = await loadRunOrders(r.point, r.runDate)
        if (orders.length === 0) continue
        const act: 'capture' | 'cancel' = orders.length >= MIN_ORDERS ? 'capture' : 'cancel'
        const results = await settle(orders, act, stripeKey)
        const okCount = results.filter(x => x.ok).length
        done.push({
          point: r.point, pointName: r.name, runDate: r.runDate,
          action: act, total: results.length, succeeded: okCount,
          failed: results.length - okCount,
          results: results.filter(x => !x.ok),   // 只回失败的,成功的不用刷屏
        })
      }
      if (done.length > 0) await broadcast()
      return json({ ran: new Date().toISOString(), settled: done.length, runs: done })
    }

    // ── 1. 概览:还没结算的班次 ──────────────────────────────────────────
    if (!point || !runDate) {
      const { data, error } = await supabase
        .from('orders')
        .select('pickup_point, pickup_point_name, run_date, total, authorized_at')
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
          oldestAuthorizedAt: null as string | null,
        }
        runs[k].orders += 1
        runs[k].amount += Number(o.total ?? 0)
        // 授权最长只挂 7 天,过期自动失效 —— 最早那笔决定这一班还剩多少时间。
        if (o.authorized_at && (!runs[k].oldestAuthorizedAt || o.authorized_at < runs[k].oldestAuthorizedAt)) {
          runs[k].oldestAuthorizedAt = o.authorized_at
        }
      }
      const list = Object.values(runs).map((r: any) => ({
        ...r,
        amount: Math.round(r.amount * 100) / 100,
        minOrders: MIN_ORDERS,
        ready: r.orders >= MIN_ORDERS,          // 够不够发车
        cutoffAt: cutoffUtc(r.runDate).toISOString(),   // 到点自动结算
      }))
      return json({ minOrders: MIN_ORDERS, cutoffHour: CUTOFF_HOUR, runs: list })
    }

    // ── 2. 这一班的明细 ────────────────────────────────────────────────
    const orders = await loadRunOrders(point, runDate)

    if (!action) {
      return json({
        point, runDate, minOrders: MIN_ORDERS,
        count: orders.length,
        ready: orders.length >= MIN_ORDERS,
        cutoffAt: cutoffUtc(runDate).toISOString(),
        orders,
      })
    }
    if (action !== 'capture' && action !== 'cancel') return json({ error: 'bad action' }, 400)
    if (orders.length === 0) return json({ error: '这一班没有待结算的订单' }, 400)

    // ── 3. 手动结算(提前发车 / 提前取消)────────────────────────────────
    const results = await settle(orders, action, stripeKey)
    await broadcast()

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
