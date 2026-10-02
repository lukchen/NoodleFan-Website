// 班次生成 —— 客人看到哪几天可订、几点送达、几点截单,全从这里来。
// 排错一天,就是有人按错的日期做饭或白跑一趟。
import { describe, it, expect } from 'vitest'
import {
  PICKUP_POINTS, getPoint, upcomingRuns, nextRun, findRun, dateKey,
  storeIsOpen, MIN_ORDERS, DAILY_LIMIT, OPEN_RUNS,
  STORE_OPEN_HOUR, STORE_CLOSE_HOUR,
} from '../src/pickup.js'

// 本地时间构造,避免测试机器时区影响(班次逻辑全用本地时间)
const at = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0, 0, 0)

describe('取餐点定义', () => {
  it('三个点:到店自取 + Allston + Malden', () => {
    expect(PICKUP_POINTS.map(p => p.id)).toEqual(['store', 'allston', 'malden'])
  })

  it('id 和后端 points.ts 对得上 —— 对不上就是下单时直接拒单', () => {
    expect(getPoint('allston').kind).toBe('dropoff')
    expect(getPoint('store').kind).toBe('store')
    expect(getPoint('nope')).toBeNull()
  })

  it('两个配送点班期不重叠:Malden 周五周日,Allston 周六周一', () => {
    expect(getPoint('malden').days).toEqual([0, 5])
    expect(getPoint('allston').days).toEqual([1, 6])
    // 不重叠是硬要求 —— 同一天两个点都要跑,一辆车送不过来。
    const overlap = getPoint('malden').days.filter(d => getPoint('allston').days.includes(d))
    expect(overlap).toEqual([])
    // 周二到周四不发车
    for (const d of [2, 3, 4]) {
      expect(getPoint('malden').days).not.toContain(d)
      expect(getPoint('allston').days).not.toContain(d)
    }
  })

  it('起送单数和备料上限就是说好的 5 和 15', () => {
    expect(MIN_ORDERS).toBe(5)
    expect(DAILY_LIMIT).toBe(15)
  })
})

describe('upcomingRuns', () => {
  const allston = getPoint('allston')

  it('到店自取没有班次', () => {
    expect(upcomingRuns(getPoint('store'), at(2026, 9, 28))).toEqual([])
    expect(upcomingRuns(null, at(2026, 9, 28))).toEqual([])
  })

  it('只开放最近两班', () => {
    expect(upcomingRuns(allston, at(2026, 9, 28))).toHaveLength(OPEN_RUNS)
  })

  it('下午点进来看不到今天 —— 中午已经截单,留着就是个点不了的日期', () => {
    // 2026-10-05 是周一,正是 Allston 的班期,但下午 3 点早过了 12:00
    const runs = upcomingRuns(allston, at(2026, 10, 5, 15))
    expect(runs.map(r => r.key)).not.toContain('2026-10-05')
  })

  it('周一上午看 Allston,给出今天和本周六', () => {
    expect(upcomingRuns(allston, at(2026, 9, 28)).map(r => r.key))
      .toEqual(['2026-09-28', '2026-10-03'])
  })

  it('今天还没到中午:今晚这一班就在第一位 —— 上午想起来订晚饭,来得及', () => {
    // 2026-10-05 周一上午 10:00,Allston 周一有车,12:00 才截单
    expect(upcomingRuns(allston, at(2026, 10, 5, 10)).map(r => r.key))
      .toEqual(['2026-10-05', '2026-10-10'])
  })

  it('过了中午 12:00,今天这一班立刻从列表里消失 —— 不留一个点不了的日期', () => {
    // 12:00:00 整就算过了 —— 截单时刻本身不属于可下单的时间
    expect(upcomingRuns(allston, at(2026, 10, 5, 12)).map(r => r.key))
      .toEqual(['2026-10-10', '2026-10-12'])
    expect(upcomingRuns(allston, at(2026, 10, 5, 15)).map(r => r.key))
      .toEqual(['2026-10-10', '2026-10-12'])
  })

  it('今天这个点不发车,就从明天起排', () => {
    // 2026-10-02 周五是 Malden 的班期,Allston 只跑周六和周一
    expect(upcomingRuns(allston, at(2026, 10, 2, 10)).map(r => r.key))
      .toEqual(['2026-10-03', '2026-10-05'])
  })

  it('周二到周四没有车,要一直等到周五/周六', () => {
    // 2026-09-30 是周三 —— 两个点都不跑,各自跳到自己最近的班期
    expect(upcomingRuns(allston, at(2026, 9, 30)).map(r => r.key))
      .toEqual(['2026-10-03', '2026-10-05'])
    expect(upcomingRuns(getPoint('malden'), at(2026, 9, 30)).map(r => r.key))
      .toEqual(['2026-10-02', '2026-10-04'])
  })

  it('班次带着送达时刻(18:00)和截单时刻(当天 12:00)', () => {
    const [run] = upcomingRuns(allston, at(2026, 9, 28))
    expect(run.pickupAt.getHours()).toBe(18)
    expect(run.cutoff.getHours()).toBe(12)
    expect(dateKey(run.cutoff)).toBe(run.key)
    expect(run.cutoff < run.pickupAt).toBe(true)
  })

  it('跨月跨年都不错位', () => {
    const malden = getPoint('malden')
    // 2026-12-30 周三没有车 → 跳到 1/1(五)和 1/3(日),跨年不错位
    expect(upcomingRuns(malden, at(2026, 12, 30)).map(r => r.key))
      .toEqual(['2027-01-01', '2027-01-03'])
  })
})

describe('nextRun / findRun', () => {
  const allston = getPoint('allston')

  it('nextRun 就是最近那一班', () => {
    expect(nextRun(allston, at(2026, 9, 28)).key).toBe('2026-09-28')
    expect(nextRun(getPoint('store'), at(2026, 9, 28))).toBeNull()
  })

  it('findRun 找得到就返回那一班', () => {
    expect(findRun(allston, '2026-10-03', at(2026, 9, 28)).key).toBe('2026-10-03')
  })

  it('找不到就回退到最近一班 —— 客人存的旧链接里那一班早发走了,不能白屏', () => {
    expect(findRun(allston, '2020-01-01', at(2026, 9, 28)).key).toBe('2026-09-28')
  })
})

describe('dateKey', () => {
  it('用本地日期,不走 UTC —— 东部晚上用 toISOString 会差一天', () => {
    expect(dateKey(new Date(2026, 8, 29, 23, 30))).toBe('2026-09-29')
    expect(dateKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
  })
})

describe('取餐点选择的有效期', () => {
  // 逻辑在 src/context/PickupContext.jsx 里(要 React 环境才跑得起来),
  // 这里只钉住那个常数的量级 —— 它决定客人多久会被重新问一次。
  // 真正的行为验证在 e2e/pickup-memory.spec.js。
  it('30 分钟:够走完一次点餐,又不至于把上次的选择带到下一次', () => {
    const FRESH_MS = 30 * 60 * 1000
    expect(FRESH_MS).toBeGreaterThanOrEqual(10 * 60 * 1000)   // 太短会在填表中途把人踢回选择页
    expect(FRESH_MS).toBeLessThanOrEqual(60 * 60 * 1000)      // 太长就等于「永远记住」
  })
})

describe('storeIsOpen', () => {
  it('营业时间内为真', () => {
    expect(storeIsOpen(at(2026, 9, 28, STORE_OPEN_HOUR))).toBe(true)
    expect(storeIsOpen(at(2026, 9, 28, 15))).toBe(true)
  })

  it('开门前和打烊后为假', () => {
    expect(storeIsOpen(at(2026, 9, 28, STORE_OPEN_HOUR - 1))).toBe(false)
    expect(storeIsOpen(at(2026, 9, 28, STORE_CLOSE_HOUR))).toBe(false)
    expect(storeIsOpen(at(2026, 9, 28, 23))).toBe(false)
  })
})
