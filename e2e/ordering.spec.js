// 下单主流程 —— 选取餐方式 → 加菜 → 结账。这条路断了就等于关门。
//
// 时间全部固定在波士顿时间的某一刻:取餐时段、是否顺延到次日、班次日期都跟"现在"有关,
// 不固定的话这些用例会在每天的不同时刻红一次(半夜跑 CI 必然红)。
import { test, expect } from '@playwright/test'
import { stubBackend, choosePickup, addFirstDish, openCheckout } from './fixtures.js'

test.use({ timezoneId: 'America/New_York' })

const NOON = new Date('2026-09-29T16:00:00Z')   // 周二,波士顿 12:00
const LATE = new Date('2026-09-30T02:00:00Z')   // 周一晚,波士顿 22:00(已打烊)

test.beforeEach(async ({ page, context }) => {
  await context.clock.setFixedTime(NOON)
  await stubBackend(page)
})

test('先选取餐方式才看得到菜单 —— 截单时间和备料份数都由它决定', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('先选取餐点与日期', { exact: false })).toBeVisible()
  await expect(page.getByText('麻酱烧饼')).toHaveCount(0)
})

test('选完到店自取就能看到菜单,并把菜加进购物车', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await expect(page.getByText('麻酱烧饼').first()).toBeVisible()

  await addFirstDish(page)
  const cart = JSON.parse(await page.evaluate(() => localStorage.getItem('nf_cart')))
  expect(cart).toHaveLength(1)
  expect(cart[0].qty).toBe(1)
})

test('Allston 只给周六/周一的日期,且不含已截单的今天', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.pickup-option', { hasText: 'Allston' })
  const days = (await card.innerText()).match(/周[一二三四五六日]\s+\d+\/\d+/g) ?? []
  expect(days.length).toBeGreaterThan(0)
  for (const d of days) expect(d.slice(0, 2)).toMatch(/周(六|一)/)
  // 今天(9/29 周二)已过中午截单,不该还出现在可订列表里
  expect(days.join()).not.toContain('9/29')
})

test('结账表单:姓名邮箱必填,手机号可选且标着「可选」', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await expect(page.locator('.checkout-modal input[name="name"]')).toHaveAttribute('required', '')
  await expect(page.locator('.checkout-modal input[name="email"]')).toHaveAttribute('required', '')
  expect(await page.locator('.checkout-modal input[name="phone"]').getAttribute('required')).toBeNull()
  await expect(page.locator('.checkout-optional')).toBeVisible()
})

test('取餐时段 15 分钟一档、留 20 分钟备餐、最后一档 8:45 PM', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  const slots = await page.locator('.checkout-modal button.time-slot').allInnerTexts()
  expect(slots.length).toBeGreaterThan(0)
  for (const s of slots) expect(s.trim()).toMatch(/^\d{1,2}:(00|15|30|45) (AM|PM)$/)

  // 现在是 12:00,加 20 分钟备餐 → 第一档只能是 12:30(12:20 之后的第一个整刻)
  expect(slots[0].trim()).toBe('12:30 PM')
  // 最后一档必须贴着打烊(9 PM)前 15 分钟。曾经写死成 8:00 PM,
  // 配上 20 分钟备餐,晚上 7:40 之后下单就被顺延到第二天 ——
  // 店还开着一个多小时,客人却看到「今日出餐已结束」。
  expect(slots[slots.length - 1].trim()).toBe('8:45 PM')
})

test('打烊后下单自动变成次日预订,并明确告诉客人', async ({ page, context }) => {
  await context.clock.setFixedTime(LATE)
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await expect(page.getByText('本单为次日预订', { exact: false })).toBeVisible()
  // 次日整天的时段都放开,第一档回到 11:00 AM
  const slots = await page.locator('.checkout-modal button.time-slot').allInnerTexts()
  expect(slots[0].trim()).toBe('11:00 AM')
})

test('填过的姓名邮箱退出再进还在 —— 不能让客人白填一遍', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await page.locator('.checkout-modal input[name="name"]').fill('刘明')
  await page.locator('.checkout-modal input[name="email"]').fill('liu@example.com')
  await page.locator('.checkout-modal input[name="phone"]').fill('617-555-0100')

  await page.locator('.checkout-modal .modal-close, .checkout-modal button:has-text("✕")').first().click()
  await expect(page.locator('.checkout-modal')).toHaveCount(0)
  await openCheckout(page)

  await expect(page.locator('.checkout-modal input[name="name"]')).toHaveValue('刘明')
  await expect(page.locator('.checkout-modal input[name="email"]')).toHaveValue('liu@example.com')
  await expect(page.locator('.checkout-modal input[name="phone"]')).toHaveValue('617-555-0100')
})

test('购物车刷新后还在 —— 手机上切出去接个电话回来不该清空', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  const before = await page.evaluate(() => localStorage.getItem('nf_cart'))

  await page.reload()
  expect(await page.evaluate(() => localStorage.getItem('nf_cart'))).toBe(before)
  // 桌面是右侧面板,手机是底部吸底条 —— 至少有一个能把人带回购物车
  const openers = page.locator('button.cart-panel-btn:visible, button.mobile-cart-bar:visible')
  await expect(openers.first()).toBeVisible()
})

test('结账窗的关闭按钮在滚动时不会跟着滚走', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  const close = page.locator('.checkout-modal .modal-header button').first()
  const before = await close.boundingBox()
  await page.locator('.checkout-body').evaluate(el => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(200)
  const after = await close.boundingBox()
  expect(Math.abs(after.y - before.y)).toBeLessThan(2)
  // 头部上方不该露出正在滚动的内容
  expect(after.y).toBeGreaterThan(0)
})

test('晚上 7:46 还能订今天 —— 店开到 9 点,不该在这个点就说今日结束', async ({ page, context }) => {
  // 这是客人实际撞到的那一幕:7:46 PM 下单,页面却写「本单为次日预订」。
  // 跟文件顶上那两个常数一样用 UTC 写:测试跑在 UTC 时区,
  // 波士顿 19:46(EDT)= 次日 23:46Z
  await context.clock.setFixedTime(new Date('2026-10-03T23:46:00Z'))
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await expect(page.locator('.checkout-modal')).not.toContainText('次日预订')
  const slots = await page.locator('.checkout-modal button.time-slot').allInnerTexts()
  // 7:46 + 20 分钟备餐 = 8:06 → 第一档 8:15
  expect(slots[0].trim()).toBe('8:15 PM')
})
