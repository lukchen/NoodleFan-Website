// 邮件是客人唯一能追到的那条路,而且带着我们的域名和品牌 ——
// 转义漏了就是一封从我们这儿发出的钓鱼邮件;汇总算错就是备料备错。
import { describe, it, expect } from 'vitest'
import {
  prettyWhen, tplConfirmed, tplCancelled, tplRunSummary, tplNewOrder, OPS_EMAIL,
} from '../supabase/functions/_shared/email.ts'

const order = (over = {}) => ({
  customer_name: '刘明',
  customer_email: 'a@b.com',
  pickup_code: '6101',
  pickup_point_name: 'Allston 取餐点',
  pickup_date: '2026-09-29',
  pickup_time: '18:00',
  run_date: '2026-09-29',
  subtotal: 30, tax: 2.1, total: 32.1,
  items: [{ nameZh: '兰州牛肉拉面', nameEn: 'Lanzhou beef noodles', qty: 2, price: 15, optionsZh: ['宽面'], optionsEn: ['wide'] }],
  capture_mode: 'manual',
  ...over,
})

describe('prettyWhen', () => {
  it('把日期渲染成「周几 月/日 时间」', () => {
    expect(prettyWhen('2026-09-29', '18:00')).toBe('周二 9/29 6:00 PM')
    expect(prettyWhen('2026-09-29', '09:05')).toBe('周二 9/29 9:05 AM')
    expect(prettyWhen('2026-09-29', '12:00')).toBe('周二 9/29 12:00 PM')
    expect(prettyWhen('2026-09-29', '00:30')).toBe('周二 9/29 12:30 AM')
  })

  it('服务器跑在 UTC 也不会把日期推前一天', () => {
    expect(prettyWhen('2026-01-01')).toBe('周四 1/1')
  })

  it('没有日期时返回空串,不渲染出 NaN', () => {
    expect(prettyWhen(null, '18:00')).toBe('')
  })
})

describe('客人填的内容必须转义', () => {
  it('姓名里的 HTML 被转义,不会变成可点的链接', () => {
    const evil = '<a href="https://evil.example">点这里领券</a>'
    const { html } = tplConfirmed(order({ customer_name: evil }))
    expect(html).not.toContain('<a href="https://evil.example"')
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;')
  })

  it('取消信里的姓名和取餐点同样转义', () => {
    const { html } = tplCancelled(order({ customer_name: '<img src=x onerror=alert(1)>' }))
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('姓名为空也不渲染出 null / undefined', () => {
    const { html } = tplConfirmed(order({ customer_name: null }))
    expect(html).not.toMatch(/null|undefined/)
  })
})

describe('先授权的单必须把「还没扣钱」说死', () => {
  it('定点配送:出现预授权说明,不写成收据', () => {
    const { html, subject } = tplConfirmed(order({ capture_mode: 'manual' }))
    expect(html).toContain('尚未实际扣款')
    expect(subject).toContain('订单已确认')
  })

  it('到店自取:立即扣款,这封信就是收据', () => {
    const { html, subject } = tplConfirmed(order({ capture_mode: 'automatic' }))
    expect(html).toContain('本邮件即为您的收据')
    expect(html).not.toContain('尚未实际扣款')
    expect(subject).toContain('收据')
  })

  it('未成团的取消信必须写明未扣款,并劝退客人别白跑', () => {
    const { html } = tplCancelled(order())
    expect(html).toContain('您未被收取任何费用')
    expect(html).toContain('今天请勿前往取餐点')
  })
})

describe('发车汇总(发给自己的那封)', () => {
  const orders = [
    { id: 'a', pickup_code: '6101', customer_name: '刘明', total: 20,
      items: [{ nameZh: '兰州牛肉拉面', qty: 2, optionsZh: ['宽面'] }, { nameZh: '麻酱烧饼', qty: 1, optionsZh: [] }] },
    { id: 'b', pickup_code: '6102', customer_name: 'Wang', total: 10,
      items: [{ nameZh: '麻酱烧饼', qty: 2, optionsZh: [] }] },
    { id: 'c', pickup_code: '6103', customer_name: '张伟', total: 16,
      items: [{ nameZh: '兰州牛肉拉面', qty: 5, optionsZh: [] }] },
  ]
  const results = [
    { id: 'a', code: '6101', ok: true },
    { id: 'b', code: '6102', ok: true },
    { id: 'c', code: '6103', ok: false, error: 'card_declined' },
  ]
  const run = (action) => tplRunSummary({ pointName: 'Allston 取餐点', runDate: '2026-09-29', action, orders, results })

  it('金额只统计扣款成功的单', () => {
    expect(run('capture').subject).toContain('$30.00')   // 20 + 10,不含失败的 16
  })

  it('备料汇总按菜名合并数量,失败的单不计入 —— 钱没收到就不该备那份料', () => {
    const { html } = run('capture')
    expect(html).toContain('麻酱烧饼')
    // 1 + 2 = 3 份烧饼;失败那单的 5 份拉面不算
    expect(html).toMatch(/麻酱烧饼<\/td>[\s\S]*?>3</)
    expect(html).toMatch(/兰州牛肉拉面（宽面）<\/td>[\s\S]*?>2</)
  })

  it('失败单单独列出来,并说清要打电话', () => {
    const { html, subject } = run('capture')
    expect(subject).toContain('1 单失败')
    expect(html).toContain('6103')
    expect(html).toContain('card_declined')
  })

  it('取消的班次不出备料清单 —— 不发车就不用做饭', () => {
    const { html, subject } = run('cancel')
    expect(html).not.toContain('备料汇总')
    expect(subject).toContain('【不发车】')
    expect(html).toContain('今天不会有人来取餐')
  })

  it('全部成功时标题里不出现「失败」', () => {
    const ok = tplRunSummary({
      pointName: 'Allston 取餐点', runDate: '2026-09-29', action: 'capture',
      orders: orders.slice(0, 2), results: results.slice(0, 2),
    })
    expect(ok.subject).not.toContain('失败')
  })
})

describe('运营信箱', () => {
  it('默认不是 order@ —— 那个域只能发不能收,发过去会退回', () => {
    expect(OPS_EMAIL).not.toBe('order@noodlefanboston.com')
    expect(OPS_EMAIL).toContain('@')
  })
})

// 补的是一个真实的 bug:模板一直支持「小计 / 销售税 / 合计」三行,
// 但 stripe-webhook 取数据时 select 里漏了 subtotal 和 tax ——
// 于是 hasBreakdown 恒为 false,客人收到的收据上只有一行 $2.68,
// 一个 $2.50 的烧饼凭空变成 $2.68,看不出那 0.18 是税。
// 模板本身测不出来这种 bug,所以这里直接钉住取数的 select。
describe('发邮件前取的字段够不够', () => {
  const fs = require('node:fs')
  const sources = [
    'supabase/functions/stripe-webhook/index.ts',
    'supabase/functions/run-dispatch/index.ts',
  ]

  it.each(sources)('%s 取的订单字段里有 subtotal 和 tax', (file) => {
    const src = fs.readFileSync(file, 'utf8')
    const selects = [...src.matchAll(/\.select\('([^']*)'\)/g)].map(m => m[1])
    const orderSelects = selects.filter(s => s.includes('items'))
    expect(orderSelects.length).toBeGreaterThan(0)
    for (const sel of orderSelects) {
      expect(sel, `这个 select 缺税额明细:${sel}`).toContain('subtotal')
      expect(sel).toContain('tax')
    }
  })
})

describe('备料汇总邮件带客人的备注', () => {
  it('逐单清单里每一条都带备注 —— 忌口是按单的,照着信备料时必须看得见', () => {
    const { html } = tplRunSummary({
      pointName: 'Allston 取餐点',
      runDate: '2026-10-05',
      action: 'capture',
      orders: [
        { id: 'a', pickup_code: '1111', customer_name: '张三', total: 20,
          items: [{ nameZh: '热干面', qty: 1, optionsZh: [] }], note: '不要香菜' },
        { id: 'b', pickup_code: '2222', customer_name: '李四', total: 20,
          items: [{ nameZh: '热干面', qty: 1, optionsZh: [] }], note: null },
      ],
      results: [{ id: 'a', ok: true }, { id: 'b', ok: true }],
    })
    expect(html).toContain('不要香菜')
    // 没写备注的单不该多出一个空的备注框
    expect(html.match(/备注：/g) ?? []).toHaveLength(1)
  })

  it('备注照样转义 —— 它是客人自己打的字,原样塞进 HTML 就是一个注入口', () => {
    const { html } = tplRunSummary({
      pointName: 'Allston 取餐点', runDate: '2026-10-05', action: 'capture',
      orders: [{ id: 'a', pickup_code: '1111', customer_name: '张三', total: 20,
        items: [{ nameZh: '热干面', qty: 1, optionsZh: [] }], note: '<script>alert(1)</script>' }],
      results: [{ id: 'a', ok: true }],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('run-dispatch 取的字段里有 note —— 模板支持了但没查出来,等于白做', () => {
    const fs = require('node:fs')
    const src = fs.readFileSync('supabase/functions/run-dispatch/index.ts', 'utf8')
    const sel = [...src.matchAll(/\.select\('([^']*)'\)/g)].map(m => m[1]).find(x => x.includes('items'))
    expect(sel).toContain('note')
  })
})

// 新订单通知 —— 发给自己的那封。
// 后台只有开着才会响,这封邮件是唯一一条「不用盯着电脑也能知道来单了」的路。
describe('新订单通知', () => {
  const store = {
    pickup_code: '1234', customer_name: '张三', customer_phone: '617-555-0101',
    pickup_date: '2026-10-04', pickup_time: '18:30', run_date: null, total: 20.5,
    items: [{ nameZh: '武汉热干面', qty: 2, optionsZh: ['加辣'] }], note: null,
  }

  it('标题一眼看清:自取还是团餐、取餐码、多少钱 —— 锁屏上就得看懂', () => {
    const { subject } = tplNewOrder(store)
    expect(subject).toContain('自取')
    expect(subject).toContain('1234')
    expect(subject).toContain('$20.50')
  })

  it('团餐标成团餐,并写明钱还只是冻结 —— 别以为已经到账了', () => {
    const { subject, html } = tplNewOrder({ ...store, run_date: '2026-10-05', pickup_point_name: 'Allston 取餐点' })
    expect(subject).toContain('团餐')
    expect(html).toContain('冻结')
  })

  it('带菜品、选项和备注', () => {
    const { html } = tplNewOrder({ ...store, note: '不要香菜' })
    expect(html).toContain('武汉热干面')
    expect(html).toContain('加辣')
    expect(html).toContain('不要香菜')
  })

  it('客人打的字照样转义 —— 这封信也是 HTML', () => {
    const { html } = tplNewOrder({ ...store, note: '<img src=x onerror=alert(1)>' })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('stripe-webhook 取的字段里有 note 和 customer_phone —— 模板用得到就必须查出来', () => {
    const fs = require('node:fs')
    const src = fs.readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8')
    const sel = [...src.matchAll(/\.select\('([^']*)'\)/g)].map(m => m[1]).find(x => x.includes('items'))
    expect(sel).toContain('note')
    expect(sel).toContain('customer_phone')
  })
})
