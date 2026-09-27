// Merchant order management — password-protected via ADMIN_PASSWORD secret.
// POST { password }                       -> list all orders (newest first)
// POST { password, id, status }           -> update one order's status
//
// 状态改成 'ready' 时给到店自取的客人发一封「餐已做好」邮件。
// 团餐(run_date 不为空)不发 —— 那条线的通知点是截单后的成团/取消,备餐进度对客人没意义。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { sendEmail, tplReady } from '../_shared/email.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { password, id, status } = await req.json()

    if (password !== Deno.env.get('ADMIN_PASSWORD')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
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
