// 菜品当天状态的读取与判定 —— 前端菜单、后台、下单拦截三处共用一套。
//
// 单独成文件是为了能被测试直接 import,而且更重要:这几条判定如果三处各写一份,
// 迟早对不上 —— 然后客人看着能点的菜被拒单,或者你以为下架了的菜还在卖。

export type DishSetting = {
  listed: boolean
  soldOutToday: boolean
  cap: number
}

export const DEFAULT_CAP = 15
const TZ = 'America/New_York'

// 「今天」按波士顿算 —— 服务器跑在 UTC,晚上 8 点标的售罄
// 用 UTC 的日期会立刻变成「昨天的」,刚标完就自己失效了。
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

// 库里的行 → 判定结果。没有行的菜走默认值:上架、没售罄、备 15 份。
// 默认必须是「可以卖」—— 新加一道菜忘了配状态,结果它卖不出去,是最糟的失败方向。
export function normalize(rows: any[], now: Date = new Date()): Record<number, DishSetting> {
  const day = today(now)
  const out: Record<number, DishSetting> = {}
  for (const r of rows ?? []) {
    out[Number(r.dish_id)] = {
      listed: r.listed !== false,
      // 日期对不上就是过期的售罄标记 —— 第二天自动恢复,不用人记得来关
      soldOutToday: !!r.sold_out_on && String(r.sold_out_on) === day,
      cap: Number.isFinite(Number(r.run_cap)) ? Number(r.run_cap) : DEFAULT_CAP,
    }
  }
  return out
}

export function settingFor(settings: Record<number, DishSetting>, dishId: number): DishSetting {
  return settings[dishId] ?? { listed: true, soldOutToday: false, cap: DEFAULT_CAP }
}

// 这道菜现在能不能下单。sold 是这一班已经卖掉的份数(到店自取传 0 并把 capped 设为 false)。
export function canOrder(
  settings: Record<number, DishSetting>,
  dishId: number,
  { capped = false, sold = 0, qty = 1 } = {},
): { ok: boolean; reason?: 'unlisted' | 'sold_out' | 'cap' } {
  const s = settingFor(settings, dishId)
  if (!s.listed) return { ok: false, reason: 'unlisted' }
  if (s.soldOutToday) return { ok: false, reason: 'sold_out' }
  if (capped && sold + qty > s.cap) return { ok: false, reason: 'cap' }
  return { ok: true }
}
