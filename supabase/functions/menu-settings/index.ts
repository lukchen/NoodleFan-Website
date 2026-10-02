// 菜品当天状态的读写。
//
// POST {}                                  -> 公开读。前端菜单要知道哪道菜下架了、
//                                             哪道今日售罄、每班备几份。
// POST { password, dishId, ...changes }    -> 后台写。改一道菜。
//
// 读不要密码:这些信息本来就印在菜单上,客人一眼就看得见,藏起来没有意义,
// 反而要让每个访客为了看菜单先做一次鉴权。写必须要密码 —— 它决定卖不卖。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { corsHeaders, timingSafeEqual, authDelay } from '../_shared/cors.ts'
import { normalize, today, DEFAULT_CAP } from '../_shared/dish-settings.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { password, dishId } = body

    // ── 写 ──────────────────────────────────────────────────────────
    if (dishId !== undefined) {
      if (!timingSafeEqual(String(password ?? ''), Deno.env.get('ADMIN_PASSWORD') ?? '')) {
        await authDelay()
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const id = Number(dishId)
      if (!Number.isInteger(id)) throw new Error('invalid dishId')

      const patch: Record<string, unknown> = { dish_id: id, updated_at: new Date().toISOString() }
      if (typeof body.listed === 'boolean') patch.listed = body.listed
      // 售罄存的是日期:标上就是「今天」,取消就是 null。第二天自动恢复。
      if (typeof body.soldOutToday === 'boolean') patch.sold_out_on = body.soldOutToday ? today() : null
      if (body.cap !== undefined) {
        const cap = Number(body.cap)
        if (!Number.isInteger(cap) || cap < 0 || cap > 999) throw new Error('invalid cap')
        patch.run_cap = cap
      }

      const { error } = await supabase.from('dish_settings').upsert(patch, { onConflict: 'dish_id' })
      if (error) throw new Error(error.message)

      // 开着菜单的客人立刻看到变化 —— 厨房刚标完售罄,还在付款页的人就该被拦住。
      try {
        await supabase.channel('orders').send({
          type: 'broadcast', event: 'menu_changed', payload: { at: new Date().toISOString() },
        })
      } catch (e) {
        console.error('menu_changed broadcast failed (non-fatal):', e)
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 读 ──────────────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('dish_settings')
      .select('dish_id, listed, sold_out_on, run_cap')
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ settings: normalize(data ?? []), defaultCap: DEFAULT_CAP }), {
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        // 短缓存:标了售罄要很快生效,但也不必每次开页面都打一次库。
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
