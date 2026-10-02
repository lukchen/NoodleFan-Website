// 后台「数据」标签的算术。
//
// 这类 bug 不会报错,只会给出一个看起来很合理的错数字 —— 然后你照着它
// 决定下架哪道菜、砍哪个班。所以口径这几条必须钉死:
//   未成团取消的不算营收、团餐扣款前不算营收、代收的税不算到手。
import { describe, it, expect } from 'vitest'
import { aggregate } from '../supabase/functions/_shared/stats.ts'

// 波士顿时间下午 6 点 = UTC 22:00(夏令时)
const bos = (dateStr, hourUtc = 22) => `${dateStr}T${String(hourUtc).padStart(2, '0')}:00:00Z`

const order = (o = {}) => ({
  created_at: bos('2026-10-01'),
  status: 'completed',
  total: 10,
  subtotal: 9.35,
  tax: 0.65,
  stripe_fee: 0.59,
  items: [],
  pickup_point_name: null,
  run_date: null,
  ...o,
})

describe('大盘口径', () => {
  it('未成团取消的单不算营收,但单独报出来 —— 那是流失掉的生意,不是零', () => {
    const { summary } = aggregate([
      order({ total: 20 }),
      order({ status: 'cancelled_no_run', total: 50 }),
    ])
    expect(summary.orders).toBe(1)
    expect(summary.revenue).toBe(20)
    expect(summary.cancelledCount).toBe(1)
    expect(summary.cancelledAmount).toBe(50)
  })

  it('团餐扣款前算「在途」,不计入营收 —— 否则截单取消一批,昨天的营收会凭空缩水', () => {
    const { summary } = aggregate([
      order({ total: 20 }),
      order({ status: 'authorized', total: 30 }),
    ])
    expect(summary.revenue).toBe(20)
    expect(summary.authorizedCount).toBe(1)
    expect(summary.authorizedAmount).toBe(30)
  })

  it('到手 = 营收 − 手续费 − 代收的税 —— 税是替州里收的,不是利润', () => {
    const { summary } = aggregate([
      order({ total: 100, tax: 7, stripe_fee: 3.2 }),
    ])
    expect(summary.revenue).toBe(100)
    expect(summary.takeHome).toBe(89.8)
  })

  it('客单价按成交单数算,不把取消的单摊进分母', () => {
    const { summary } = aggregate([
      order({ total: 30 }),
      order({ total: 10 }),
      order({ status: 'cancelled_no_run', total: 100 }),
    ])
    expect(summary.avgTicket).toBe(20)
  })

  it('一单都没有时不炸,也不出现 NaN', () => {
    const { summary } = aggregate([])
    expect(summary.orders).toBe(0)
    expect(summary.revenue).toBe(0)
    expect(summary.avgTicket).toBe(0)
    expect(Number.isNaN(summary.takeHome)).toBe(false)
  })

  it('备餐中的四个状态都算已成交 —— 钱已经到账了,别等到「已完成」才认', () => {
    const rows = ['paid', 'preparing', 'ready', 'completed'].map(status => order({ status, total: 10 }))
    expect(aggregate(rows).summary.orders).toBe(4)
  })
})

describe('按天 / 按星期', () => {
  it('按波士顿时区归日 —— 晚上 8 点的单不能算到第二天去', () => {
    // 2026-10-01 波士顿晚 20:00 = UTC 2026-10-02 00:00
    const { byDay } = aggregate([order({ created_at: '2026-10-02T00:00:00Z' })])
    expect(byDay[0].date).toBe('2026-10-01')
  })

  it('星期几也按波士顿时区 —— 同一单不能既算周四又算周五', () => {
    // 2026-10-01 是周四,波士顿晚 20:00
    const { byWeekday } = aggregate([order({ created_at: '2026-10-02T00:00:00Z' })])
    expect(byWeekday[4].orders).toBe(1)   // 4 = 周四
    expect(byWeekday[5].orders).toBe(0)
  })

  it('按天是从早到晚排的 —— 折线倒着画就没法看趋势', () => {
    const { byDay } = aggregate([
      order({ created_at: bos('2026-10-03') }),
      order({ created_at: bos('2026-10-01') }),
      order({ created_at: bos('2026-10-02') }),
    ])
    expect(byDay.map(d => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('没有单的星期也留着 —— 「周日零单」本身就是信息', () => {
    const { byWeekday } = aggregate([order()])
    expect(byWeekday).toHaveLength(7)
  })
})

describe('菜品排行', () => {
  it('同一道菜跨订单累加份数和金额', () => {
    const { dishes } = aggregate([
      order({ items: [{ nameZh: '热干面', qty: 2, price: 12.99 }] }),
      order({ items: [{ nameZh: '热干面', qty: 1, price: 12.99 }] }),
    ])
    expect(dishes[0]).toEqual({ name: '热干面', qty: 3, revenue: 38.97 })
  })

  it('按份数从多到少排', () => {
    const { dishes } = aggregate([
      order({ items: [
        { nameZh: '茶叶蛋', qty: 5, price: 2 },
        { nameZh: '热干面', qty: 1, price: 12.99 },
      ] }),
    ])
    expect(dishes.map(d => d.name)).toEqual(['茶叶蛋', '热干面'])
  })

  it('取消的单里的菜不算销量 —— 那些餐根本没做', () => {
    const { dishes } = aggregate([
      order({ status: 'cancelled_no_run', items: [{ nameZh: '热干面', qty: 9, price: 12.99 }] }),
    ])
    expect(dishes).toEqual([])
  })

  it('菜品用的是下单时的名字快照,所以下架的菜照样出现在历史里', () => {
    const { dishes } = aggregate([
      order({ items: [{ nameZh: '台北夜市卤肉饭', qty: 1, price: 15.99 }] }),
    ])
    expect(dishes[0].name).toBe('台北夜市卤肉饭')
  })
})

describe('按取餐点', () => {
  it('pickup_point_name 为空的算到店自取', () => {
    const { byPoint } = aggregate([order({ pickup_point_name: null, total: 10 })])
    expect(byPoint[0].name).toBe('到店自取')
  })

  it('按营收从高到低排', () => {
    const { byPoint } = aggregate([
      order({ pickup_point_name: 'Allston 取餐点', total: 10 }),
      order({ pickup_point_name: 'Malden 取餐点', total: 90 }),
    ])
    expect(byPoint.map(p => p.name)).toEqual(['Malden 取餐点', 'Allston 取餐点'])
  })
})
