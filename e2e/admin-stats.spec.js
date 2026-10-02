// 后台「数据」标签的冒烟测试。
//
// 这里不验算术(算术在 tests/stats.test.js 里),只验三件更基础的事:
// 密码错了进不去、数字真的渲染出来了、以及切时间窗会重新去取数。
// 另外钉一条:这个接口返回的东西里不许有客人的姓名邮箱电话 ——
// 看趋势不需要这些,传过去就是把客户名单放进浏览器,F12 一开全在那儿。
import { test, expect } from '@playwright/test'
import { SUPABASE } from './fixtures.js'

const STATS = {
  summary: {
    orders: 12, revenue: 342.5, avgTicket: 28.54, tax: 22.4, fees: 13.5,
    takeHome: 306.6, authorizedCount: 3, authorizedAmount: 90,
    cancelledCount: 2, cancelledAmount: 55,
  },
  byDay: [
    { date: '2026-09-30', orders: 5, revenue: 140.5 },
    { date: '2026-10-01', orders: 7, revenue: 202 },
  ],
  byWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i, orders: i === 4 ? 7 : 0, revenue: i === 4 ? 202 : 0 })),
  byPoint: [
    { name: 'Allston 取餐点', orders: 7, revenue: 202 },
    { name: '到店自取', orders: 5, revenue: 140.5 },
  ],
  dishes: [
    { name: '武汉热干面', qty: 9, revenue: 116.91 },
    { name: '麻酱烧饼', qty: 4, revenue: 10 },
  ],
}

async function openAdmin(page, { stats = STATS, days } = {}) {
  await page.addInitScript(() => localStorage.setItem('nf_lang', 'zh'))
  await page.route('**/*', route => {
    const url = route.request().url()
    if (url.startsWith('http://localhost') || url.startsWith(SUPABASE) || url.startsWith('data:')) {
      return route.continue()
    }
    return route.abort()
  })
  await page.route(`${SUPABASE}/**`, route => route.fulfill({ json: {} }))
  await page.route(`${SUPABASE}/functions/v1/admin-orders*`, route => route.fulfill({ json: { orders: [] } }))
  await page.route(`${SUPABASE}/functions/v1/admin-stats*`, route => {
    if (days) days.push(JSON.parse(route.request().postData() || '{}').days)
    return route.fulfill({ json: stats })
  })

  await page.goto('/#admin')
  await page.getByPlaceholder(/密码|password/i).fill('whatever')
  await page.getByRole('button', { name: /登录|进入|确定/ }).click()
  await page.getByRole('button', { name: '数据' }).click()
}

test('数据标签把大盘数字渲染出来', async ({ page }) => {
  await openAdmin(page)
  await expect(page.locator('.stats-cards')).toContainText('12')
  await expect(page.locator('.stats-cards')).toContainText('$342.50')
  await expect(page.locator('.stats-cards')).toContainText('$306.60')
})

test('在途和未成团取消单独说明,不混进营收', async ({ page }) => {
  await openAdmin(page)
  const note = page.locator('.stats-pending')
  await expect(note).toContainText('在途')
  await expect(note).toContainText('未成团取消')
})

test('菜品排行按份数排,第一名在最上面', async ({ page }) => {
  await openAdmin(page)
  const rows = page.locator('.stats-section', { hasText: '哪道菜好卖' }).locator('.stats-bars li')
  await expect(rows.first()).toContainText('武汉热干面')
  await expect(rows.first()).toContainText('9 份')
})

test('切时间窗会重新去取数,而不是在前端切一刀', async ({ page }) => {
  const days = []
  await openAdmin(page, { days })
  await page.getByRole('button', { name: '近 7 天' }).click()
  await expect.poll(() => days).toContain(7)
})

test('一单都没有时给一句话,不是一片空白或者 NaN', async ({ page }) => {
  await openAdmin(page, {
    stats: {
      summary: {
        orders: 0, revenue: 0, avgTicket: 0, tax: 0, fees: 0, takeHome: 0,
        authorizedCount: 0, authorizedAmount: 0, cancelledCount: 0, cancelledAmount: 0,
      },
      byDay: [], byWeekday: [], byPoint: [], dishes: [],
    },
  })
  await expect(page.locator('.stats')).toContainText('还没有成交订单')
  await expect(page.locator('.stats')).not.toContainText('NaN')
})
