// 菜品当天状态的判定。
//
// 这几条决定一道菜能不能卖出去,错在哪个方向都疼:
// 判松了 —— 卖出一份做不出来的餐,取餐那天只能退款道歉;
// 判严了 —— 一道其实有货的菜被标成售罄,白白少卖一天,而且没人会发现。
import { describe, it, expect } from 'vitest'
import { normalize, settingFor, canOrder, today, DEFAULT_CAP } from '../supabase/functions/_shared/dish-settings.ts'

// 2026-10-02 波士顿晚上 8 点 = UTC 2026-10-03 00:00
const 波士顿晚上 = new Date('2026-10-03T00:00:00Z')

describe('today 按波士顿算', () => {
  it('晚上 8 点标的售罄,算的是当天而不是第二天', () => {
    expect(today(波士顿晚上)).toBe('2026-10-02')
  })
})

describe('normalize', () => {
  it('没配过的菜走默认:上架、没售罄、备 15 份', () => {
    // 默认必须是「可以卖」—— 新加一道菜忘了配状态,结果它卖不出去,
    // 是最糟的失败方向:没有任何提示,只是悄悄少卖。
    const s = normalize([])
    expect(settingFor(s, 99)).toEqual({ listed: true, soldOutToday: false, cap: DEFAULT_CAP })
  })

  it('售罄标记带日期,过了那天自动失效', () => {
    const rows = [{ dish_id: 1, listed: true, sold_out_on: '2026-10-02', run_cap: 15 }]
    expect(normalize(rows, 波士顿晚上)[1].soldOutToday).toBe(true)
    // 第二天同一行,不用人回来关
    const 第二天 = new Date('2026-10-04T00:00:00Z')
    expect(normalize(rows, 第二天)[1].soldOutToday).toBe(false)
  })

  it('没有售罄日期就是没售罄', () => {
    const s = normalize([{ dish_id: 1, listed: true, sold_out_on: null, run_cap: 15 }], 波士顿晚上)
    expect(s[1].soldOutToday).toBe(false)
  })

  it('备料数读的是库里的值,不是写死的 15', () => {
    const s = normalize([{ dish_id: 1, listed: true, sold_out_on: null, run_cap: 3 }])
    expect(s[1].cap).toBe(3)
  })

  it('备料数是 0 也认 —— 0 不是「没设置」,是「这班一份都不备」', () => {
    const s = normalize([{ dish_id: 1, listed: true, sold_out_on: null, run_cap: 0 }])
    expect(s[1].cap).toBe(0)
    expect(canOrder(s, 1, { capped: true, sold: 0, qty: 1 }).ok).toBe(false)
  })
})

describe('canOrder', () => {
  const base = (over = {}) => normalize([{ dish_id: 1, listed: true, sold_out_on: null, run_cap: 15, ...over }], 波士顿晚上)

  it('下架的菜不能下单', () => {
    expect(canOrder(base({ listed: false }), 1)).toEqual({ ok: false, reason: 'unlisted' })
  })

  it('今日售罄的不能下单 —— 到店自取也一样,厨房没货就是没货', () => {
    const s = base({ sold_out_on: '2026-10-02' })
    expect(canOrder(s, 1, { capped: false }).ok).toBe(false)
    expect(canOrder(s, 1, { capped: false }).reason).toBe('sold_out')
  })

  it('到店自取不受备料上限约束 —— 现做现卖', () => {
    expect(canOrder(base(), 1, { capped: false, sold: 999, qty: 5 }).ok).toBe(true)
  })

  it('团餐卖到上限就拒单', () => {
    expect(canOrder(base({ run_cap: 5 }), 1, { capped: true, sold: 4, qty: 1 }).ok).toBe(true)
    expect(canOrder(base({ run_cap: 5 }), 1, { capped: true, sold: 4, qty: 2 }).ok).toBe(false)
    expect(canOrder(base({ run_cap: 5 }), 1, { capped: true, sold: 5, qty: 1 }).reason).toBe('cap')
  })

  it('一次点多份要整单算 —— 只剩 2 份时点 3 份必须拒,不能卖 2 份给他', () => {
    expect(canOrder(base({ run_cap: 15 }), 1, { capped: true, sold: 13, qty: 3 }).ok).toBe(false)
  })

  it('下架优先于售罄 —— 两个都标了,给出的理由是下架', () => {
    const s = base({ listed: false, sold_out_on: '2026-10-02' })
    expect(canOrder(s, 1).reason).toBe('unlisted')
  })
})
