// 订单聚合 —— 后台「数据」标签的全部算术都在这里。
//
// 单独成文件是为了能被测试直接 import:admin-stats/index.ts 顶层就 Deno.serve 了,
// 在测试里 import 不进来。这里算错不会报错,只会给出一个看起来很合理的错数字 ——
// 比如把未成团取消的单算进营收,或者把代收的税当成利润,然后照着它做决定。
//
// 口径(改之前先想清楚,数字对不上账大半是口径问题):
//   - pending      = 没付成的结账草稿,不是订单,取数时已经排除
//   - cancelled_no_run = 没凑够 5 单取消的,钱退了,不算营收(但单独报数,
//                        它衡量的是「有多少需求因为没成团而流失」)
//   - authorized   = 团餐已下单、钱还冻着没扣。算「在途」,不计入已实现营收,
//                    否则截单那天一批取消会让昨天的营收凭空缩水
//   - 已实现营收   = paid / preparing / ready / completed,用 total(含税)
const EARNED = new Set(['paid', 'preparing', 'ready', 'completed'])
const TZ = 'America/New_York'

// 订单时间按波士顿时区归日 —— 服务器跑在 UTC,晚上 8 点下的单
// 用 UTC 归日会算到第二天去,「周四生意好」就成了假的。
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' })
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function round(n: number) {
  return Math.round(n * 100) / 100
}


export function aggregate(orders: any[]) {
  const earned = orders.filter(o => EARNED.has(o.status))
  const authorized = orders.filter(o => o.status === 'authorized')
  const cancelled = orders.filter(o => o.status === 'cancelled_no_run')
  // 拒单跟未成团分开报:一个是「需求没凑够」,一个是「我们接不住」,
  // 要采取的行动完全相反 —— 一个是多拉人,一个是别超卖。
  const rejected = orders.filter(o => o.status === 'rejected')

  const revenue = earned.reduce((s, o) => s + Number(o.total ?? 0), 0)
  const fees = earned.reduce((s, o) => s + Number(o.stripe_fee ?? 0), 0)
  const tax = earned.reduce((s, o) => s + Number(o.tax ?? 0), 0)

  const summary = {
    orders: earned.length,
    revenue: round(revenue),
    avgTicket: earned.length ? round(revenue / earned.length) : 0,
    tax: round(tax),
    fees: round(fees),
    // 到手 = 营收 - 手续费 - 代收的税。税不是我们的钱,放一起看容易高估利润。
    takeHome: round(revenue - fees - tax),
    authorizedCount: authorized.length,
    authorizedAmount: round(authorized.reduce((s, o) => s + Number(o.total ?? 0), 0)),
    cancelledCount: cancelled.length,
    cancelledAmount: round(cancelled.reduce((s, o) => s + Number(o.total ?? 0), 0)),
    rejectedCount: rejected.length,
    rejectedAmount: round(rejected.reduce((s, o) => s + Number(o.total ?? 0), 0)),
  }

  // ── 按天 ──
  const byDayMap = new Map<string, { orders: number; revenue: number }>()
  for (const o of earned) {
    const key = dayFmt.format(new Date(o.created_at))
    const cur = byDayMap.get(key) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += Number(o.total ?? 0)
    byDayMap.set(key, cur)
  }
  const byDay = [...byDayMap.entries()]
    .map(([date, v]) => ({ date, orders: v.orders, revenue: round(v.revenue) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── 按星期 ──
  const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, orders: 0, revenue: 0 }))
  for (const o of earned) {
    const i = WEEKDAY_INDEX[weekdayFmt.format(new Date(o.created_at))] ?? 0
    byWeekday[i].orders += 1
    byWeekday[i].revenue += Number(o.total ?? 0)
  }
  for (const d of byWeekday) d.revenue = round(d.revenue)

  // ── 按取餐点 ──
  const byPointMap = new Map<string, { orders: number; revenue: number }>()
  for (const o of earned) {
    const key = o.pickup_point_name || '到店自取'
    const cur = byPointMap.get(key) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += Number(o.total ?? 0)
    byPointMap.set(key, cur)
  }
  const byPoint = [...byPointMap.entries()]
    .map(([name, v]) => ({ name, orders: v.orders, revenue: round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── 菜品排行 ──
  // items 是下单那一刻的快照,菜改名或下架之后旧单仍按当时的名字统计 ——
  // 这是对的:历史就该是历史的样子。
  const dishMap = new Map<string, { qty: number; revenue: number }>()
  for (const o of earned) {
    for (const it of (o.items ?? [])) {
      const name = it.nameZh || it.nameEn || '未知菜品'
      const cur = dishMap.get(name) ?? { qty: 0, revenue: 0 }
      const qty = Number(it.qty ?? 0)
      cur.qty += qty
      cur.revenue += Number(it.price ?? 0) * qty
      dishMap.set(name, cur)
    }
  }
  const dishes = [...dishMap.entries()]
    .map(([name, v]) => ({ name, qty: v.qty, revenue: round(v.revenue) }))
    .sort((a, b) => b.qty - a.qty)

  return { summary, byDay, byWeekday, byPoint, dishes }
}
