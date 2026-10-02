// 订单数据分析 —— 后台「数据」标签的数据源。
// POST { password, days }  ->  聚合后的统计数字
//
// 为什么在服务端聚合,而不是把订单整表丢给前端自己算:
//   1. 订单行里有姓名、邮箱、电话。看趋势不需要这些,传过去就是白白把一整份
//      客户名单放进浏览器,F12 一开全在那儿。这里只返回数字。
//   2. 单量涨起来之后,整表传输会越来越慢,而聚合结果永远是几 KB。
//
// 算术全在 _shared/stats.ts 里(那边有口径说明,也有测试),这里只管鉴权和取数。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders, timingSafeEqual, authDelay } from '../_shared/cors.ts'
import { aggregate } from '../_shared/stats.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { password, days } = await req.json()

    if (!timingSafeEqual(String(password ?? ''), Deno.env.get('ADMIN_PASSWORD') ?? '')) {
      await authDelay()
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 0 或没给 = 全部。其余按天数回溯,上限十年 —— 防止一个离谱的数字
    // 变成一次没必要的全表扫描。
    const window = Number(days)
    const span = Number.isFinite(window) && window > 0 ? Math.min(window, 3650) : 0
    const since = span ? new Date(Date.now() - span * 86400_000).toISOString() : null

    // 'pending' 是没付成的结账草稿,不是订单。
    let q = supabase
      .from('orders')
      .select('created_at, status, total, subtotal, tax, stripe_fee, net_income, items, pickup_point_name, run_date')
      .neq('status', 'pending')
    if (since) q = q.gte('created_at', since)

    const { data: rows, error } = await q
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify(aggregate(rows ?? [])), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
