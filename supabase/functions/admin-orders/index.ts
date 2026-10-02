// Merchant order management — password-protected via ADMIN_PASSWORD secret.
// POST { password }                       -> list all orders (newest first)
// POST { password, id, status }           -> update one order's status
//
// 状态改成 'ready' 时给到店自取的客人发一封「餐已做好」邮件。
// 团餐(run_date 不为空)不发 —— 那条线的通知点是截单后的成团/取消,备餐进度对客人没意义。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { sendEmail, tplReady, tplRejected } from '../_shared/email.ts'
import { rejectReason, isValidReason } from '../_shared/reject-reasons.js'
import { corsHeaders, timingSafeEqual, authDelay } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { password, id, status, reject, rejectNote } = await req.json()

    // 恒定时间比对 + 失败后延时 1 秒,见 _shared/cors.ts 里的说明。
    if (!timingSafeEqual(String(password ?? ''), Deno.env.get('ADMIN_PASSWORD') ?? '')) {
      await authDelay()
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 拒单 ────────────────────────────────────────────────────────
    // 店家接不下这一单(缺货、忙不过来、临时停业):全额退款 + 告诉客人。
    //
    // 退款必须先于改状态:反过来的话,一旦退款失败,后台已经显示「已拒单」,
    // 这笔钱就再也没人记得退了 —— 客人付了钱、拿不到餐、也等不到退款。
    if (id && reject) {
      if (!isValidReason(String(reject))) {
        return json({ error: 'bad reason' }, 400)
      }
      const reason = rejectReason(String(reject))!

      const { data: o, error: readErr } = await supabase
        .from('orders')
        .select('id, status, total, customer_email, customer_name, pickup_code, pickup_point_name, pickup_date, pickup_time, run_date, stripe_payment_intent')
        .eq('id', id)
        .single()
      if (readErr || !o) return json({ error: '订单不存在' }, 404)
      if (o.status === 'rejected' || o.status === 'cancelled_no_run') {
        return json({ error: '这一单已经取消过了' }, 409)
      }

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeKey) return json({ error: '缺少 STRIPE_SECRET_KEY' }, 500)
      if (!o.stripe_payment_intent) return json({ error: '这一单没有 payment_intent,无法自动退款' }, 409)

      // 团餐在结算前只是冻结,没扣过钱 —— 那种要 cancel,不是 refund。
      // 对一个只授权没扣款的 PI 发 refund,Stripe 会直接报错。
      const authorizedOnly = o.status === 'authorized'
      const path = authorizedOnly
        ? `payment_intents/${o.stripe_payment_intent}/cancel`
        : 'refunds'
      const form = authorizedOnly ? {} : { payment_intent: String(o.stripe_payment_intent) }

      const res = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(form).toString(),
      })
      const payload = await res.json()
      if (!res.ok) {
        // 钱没动,状态也不动 —— 后台还显示原样,你能重试或者去 Stripe 手工处理
        return json({ error: `退款失败:${payload?.error?.message ?? '未知错误'}` }, 502)
      }

      const { error: upErr } = await supabase.from('orders').update({
        status: 'rejected',
        reject_reason: String(reject),
        rejected_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        refund_id: authorizedOnly ? null : (payload?.id ?? null),
      }).eq('id', id)
      if (upErr) {
        // 钱退了但状态没写进去 —— 这是最需要人看见的一种半成功,
        // 必须明说,不能静悄悄返回成功让人以为完事了。
        console.error('refund ok but DB update failed:', id, upErr)
        return json({ error: '钱已退,但订单状态没更新成功,请刷新后确认' }, 500)
      }

      // 通知客人。钱已经退了,发信失败不能把这个请求变成失败 ——
      // 否则店家会以为没拒成、再点一次,客人就收到两封(退款倒是不会退两次,
      // 上面那道「已经取消过了」会拦住)。
      try {
        const { subject, html } = tplRejected(o as any, reason, typeof rejectNote === 'string' ? rejectNote.slice(0, 300) : null)
        await sendEmail(o.customer_email, subject, html)
      } catch (e) {
        console.error('reject email failed (non-fatal):', id, e)
      }

      try {
        await supabase.channel('orders').send({
          type: 'broadcast', event: 'status_changed', payload: { at: new Date().toISOString() },
        })
      } catch (e) {
        console.error('status_changed broadcast error (non-fatal):', e)
      }

      return json({ ok: true, refunded: !authorizedOnly })
    }

    // Update path
    if (id && status) {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id)
      if (error) throw new Error(error.message)

      // 「餐好了」邮件 —— 只发到店自取、只在状态真的变成 ready 时发。
      // 整段包在 try/catch 里:状态已经写进库了,发信失败不能把这个请求变成失败,
      // 否则店员会以为没改成功、再点一次,客人就收到两封。
      if (status === 'ready') {
        try {
          const { data: row } = await supabase
            .from('orders')
            .select('customer_email, customer_name, pickup_code, pickup_point_name, pickup_date, pickup_time, run_date')
            .eq('id', id)
            .maybeSingle()
          if (row && !row.run_date) {
            const { subject, html } = tplReady(row)
            await sendEmail(row.customer_email, subject, html)
          }
        } catch (e) {
          console.error('ready email error (non-fatal):', e)
        }
      }

      // Tell any open customer status pages to re-fetch so they see the new status
      // live. PII-free signal — carries no order data, same channel as new_order.
      try {
        await supabase.channel('orders').send({
          type: 'broadcast',
          event: 'status_changed',
          payload: { at: new Date().toISOString() },
        })
      } catch (e) {
        console.error('status_changed broadcast error (non-fatal):', e)
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // List path — 'pending' rows are unpaid checkout drafts, not real orders.
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ orders: data }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
