// 拒单理由。这几句会原样出现在客人收到的邮件里。
import { describe, it, expect } from 'vitest'
import { REJECT_REASONS, rejectReason, isValidReason } from '../supabase/functions/_shared/reject-reasons.js'
import { aggregate } from '../supabase/functions/_shared/stats.ts'

describe('拒单理由', () => {
  it('认不出的代码一律拒绝 —— 否则等于让调用方往我们域名发的邮件里塞任意文字', () => {
    expect(isValidReason('sold_out')).toBe(true)
    expect(isValidReason('whatever')).toBe(false)
    expect(isValidReason('')).toBe(false)
    expect(isValidReason(null)).toBe(false)
    expect(rejectReason('nope')).toBeNull()
  })

  it('每条都有中英文标签和给客人的说法', () => {
    for (const r of REJECT_REASONS) {
      for (const k of ['code', 'labelZh', 'labelEn', 'textZh', 'textEn']) {
        expect(r[k], `${r.code} 缺 ${k}`).toBeTruthy()
      }
    }
  })

  it('给客人的说法里带着道歉,不是一句冷冰冰的通知', () => {
    // 一次拒单本来就容易丢掉一个客人,措辞是唯一能挽回一点的地方
    for (const r of REJECT_REASONS) {
      expect(r.textZh, `${r.code} 没有道歉`).toMatch(/抱歉/)
      expect(r.textEn.toLowerCase()).toMatch(/sorry/)
    }
  })

  it('代码不重复 —— 重了的话库里存的理由会对应到错的文案', () => {
    const codes = REJECT_REASONS.map(r => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('拒单在统计里的口径', () => {
  const order = (o = {}) => ({
    created_at: '2026-10-02T22:00:00Z', status: 'completed',
    total: 10, subtotal: 9.35, tax: 0.65, stripe_fee: 0.59, items: [], ...o,
  })

  it('拒单不算营收 —— 钱已经退回去了', () => {
    const { summary } = aggregate([order({ total: 20 }), order({ status: 'rejected', total: 50 })])
    expect(summary.revenue).toBe(20)
    expect(summary.orders).toBe(1)
  })

  it('拒单跟未成团分开报 —— 一个是需求没凑够,一个是我们接不住', () => {
    const { summary } = aggregate([
      order({ status: 'rejected', total: 50 }),
      order({ status: 'cancelled_no_run', total: 30 }),
    ])
    expect(summary.rejectedCount).toBe(1)
    expect(summary.rejectedAmount).toBe(50)
    expect(summary.cancelledCount).toBe(1)
    expect(summary.cancelledAmount).toBe(30)
  })

  it('拒单里的菜不算销量 —— 那些餐没做出来', () => {
    const { dishes } = aggregate([
      order({ status: 'rejected', items: [{ nameZh: '热干面', qty: 4, price: 12.99 }] }),
    ])
    expect(dishes).toEqual([])
  })
})
