// 某一班车已经卖掉多少 —— 菜单上「仅剩 N 份 / 今日已订满」靠它。
//
// 为什么必须有:每道菜每天只备 DAILY_LIMIT 份。前端不知道已经卖了几份的话,
// 第 16 个人照样能下单付钱,到取餐那天才发现没货 —— 只能挨个退款道歉。
//
// 只返回聚合数字,不返回任何客人信息:这个接口是公开的(前端拿 anon key 调),
// 它读的是 service role,所以吐出来的必须是数不出人的东西。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { runTally } from '../_shared/tally.ts'

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
    const { pointId, runDate } = await req.json()
    // 到店自取现做现卖、不限量,也没有「班次」这回事,不该问到这里来。
    if (!pointId || !runDate) throw new Error('pointId and runDate required')

    const tally = await runTally(supabase, String(pointId), String(runDate))

    return new Response(JSON.stringify(tally), {
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        // 数字没必要实时到秒,但也不能太陈 —— 15 秒够挡住连点刷新,
        // 又不至于让客人看着「仅剩 1 份」却下单失败。
        'Cache-Control': 'public, max-age=15',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
