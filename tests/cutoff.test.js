// 截单时刻算错就是直接动钱:早了,那一小时进来的单全被当成未成团取消;
// 晚了,客人以为还能订,车已经走了。夏令时一年切两次,所以这里逐个季节验。
import { describe, it, expect } from 'vitest'
import { cutoffUtc } from '../supabase/functions/_shared/cutoff.ts'

// 波士顿本地时间(不依赖跑测试的机器在哪个时区)
const boston = (d) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(d)

describe('cutoffUtc —— 取餐当天波士顿时间 12:00 截单', () => {
  it('夏令时(EDT, UTC-4):9 月的班次', () => {
    expect(cutoffUtc('2026-09-29').toISOString()).toBe('2026-09-29T16:00:00.000Z')
    expect(boston(cutoffUtc('2026-09-29'))).toContain('12:00')
  })

  it('冬令时(EST, UTC-5):1 月的班次', () => {
    expect(cutoffUtc('2026-01-13').toISOString()).toBe('2026-01-13T17:00:00.000Z')
    expect(boston(cutoffUtc('2026-01-13'))).toContain('12:00')
  })

  it('夏令时切换当天也还是本地 12:00 —— 不是写死的 UTC 偏移', () => {
    // 2026 美国夏令时:3/8 开始,11/1 结束
    for (const day of ['2026-03-07', '2026-03-08', '2026-03-09', '2026-10-31', '2026-11-01', '2026-11-02']) {
      expect(boston(cutoffUtc(day)), day).toContain('12:00')
    }
  })

  it('全年每一天的截单都落在本地 12:00', () => {
    const d = new Date(Date.UTC(2026, 0, 1))
    let checked = 0
    while (d.getUTCFullYear() === 2026) {
      const key = d.toISOString().slice(0, 10)
      expect(boston(cutoffUtc(key)), key).toContain('12:00')
      d.setUTCDate(d.getUTCDate() + 1)
      checked++
    }
    expect(checked).toBe(365)
  })

  it('小时数可配 —— 改 CUTOFF_HOUR 时跟着走', () => {
    expect(boston(cutoffUtc('2026-09-29', 9))).toContain('09:00')
    expect(boston(cutoffUtc('2026-01-13', 20))).toContain('20:00')
  })
})
