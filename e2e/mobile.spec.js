// 手机端 —— 客人基本都是在微信里点开链接,小屏上出问题的概率比桌面高得多:
// 横向溢出、按钮小到点不准、弹窗顶出屏幕、吸底条挡住最后一道菜。
import { test, expect } from '@playwright/test'
import { stubBackend, choosePickup, addFirstDish, openCheckout } from './fixtures.js'

test.use({ timezoneId: 'America/New_York' })
test.describe.configure({ mode: 'parallel' })

test.beforeEach(async ({ page, context }) => {
  await context.clock.setFixedTime(new Date('2026-09-29T16:00:00Z'))
  await stubBackend(page)
})

// 横向滚动是小屏上最常见也最丢人的毛病:文字被切一半,客人得左右拖。
// 找不到时把罪魁祸首一起报出来 —— 光说「溢出了」要再查半天。
async function expectNoHorizontalScroll(page) {
  const { scrollW, clientW, offender } = await page.evaluate(() => {
    const doc = document.documentElement
    let offender = null
    if (doc.scrollWidth > doc.clientWidth) {
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect()
        if (r.right > doc.clientWidth + 1 && r.width > 0) {
          offender = el.tagName + '.' + (el.className || '') + ' right=' + Math.round(r.right)
          break
        }
      }
    }
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, offender }
  })
  expect(offender, `横向溢出,罪魁: ${offender}`).toBeNull()
  expect(scrollW).toBeLessThanOrEqual(clientW + 1)
}

test('首页(选取餐方式)不横向溢出', async ({ page }) => {
  await page.goto('/')
  await expectNoHorizontalScroll(page)
})

test('菜单页不横向溢出', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await page.locator('.menu-section').first().waitFor()
  await expectNoHorizontalScroll(page)
})

test('小票页不横向溢出 —— 那条长链接最容易把页面撑宽', async ({ page }) => {
  await page.goto('/?session_id=cs_test_123')
  await page.locator('.os-card').waitFor()
  await expectNoHorizontalScroll(page)
})

test('结账窗在小屏上完整可用:头部固定、内容可滚、不超出屏幕', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  const modal = page.locator('.checkout-modal')
  const box = await modal.boundingBox()
  const vp = page.viewportSize()
  expect(box.width).toBeLessThanOrEqual(vp.width)
  expect(box.height).toBeLessThanOrEqual(vp.height + 1)
  expect(box.y).toBeGreaterThanOrEqual(-1)

  // 关闭按钮在滚动后仍停在原处
  const close = page.locator('.checkout-modal .modal-header button').first()
  const before = await close.boundingBox()
  await page.locator('.checkout-body').evaluate(el => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(200)
  const after = await close.boundingBox()
  expect(Math.abs(after.y - before.y)).toBeLessThan(2)
})

test('手机底部购物车条在加菜后出现,并且能走到结账', async ({ page }) => {
  await choosePickup(page, '到店自取')
  const bar = page.locator('button.mobile-cart-bar')
  await addFirstDish(page)
  await expect(bar).toBeVisible()

  await bar.click()
  await expect(page.locator('.cart-drawer--open')).toHaveCount(1)
  await page.locator('button.cart-checkout-btn').click()
  await expect(page.locator('.checkout-modal')).toBeVisible()
})

test('吸底购物车条不会挡住菜单最后一道菜', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await page.locator('button.mobile-cart-bar').waitFor()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)

  const overlap = await page.evaluate(() => {
    const bar = document.querySelector('.mobile-cart-bar')
    if (!bar) return 0
    const b = bar.getBoundingClientRect()
    const cards = [...document.querySelectorAll('.menu-card')]
    const last = cards[cards.length - 1]
    if (!last) return 0
    const r = last.getBoundingClientRect()
    return Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top))
  })
  expect(overlap).toBe(0)
})

// 手指的接触面比鼠标大,苹果的底线是 44pt。全站一刀切 44 会把导航栏撑变形,
// 所以分三档:主操作(加入/取餐时段)44,天天点的次级控件 40,低频的语言切换 36。
// 这个分档必须和 src/touch.css 里的规则对上 —— 那边放宽了,这边就该跟着红。
function minTapHeight(cls) {
  if (/btn-add|time-slot|btn-primary|checkout-submit|options-add/.test(cls)) return 44
  if (/lang-toggle/.test(cls)) return 36
  return 40
}

test('可点的东西都够大 —— 手指不是鼠标', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await page.locator('.menu-card').first().waitFor()

  const small = await page.locator('button:visible').evaluateAll(bs =>
    bs.map(b => {
      const r = b.getBoundingClientRect()
      return { c: b.className, w: +r.width.toFixed(1), h: +r.height.toFixed(1) }
    }).filter(x => x.h > 0))
  const tooSmall = small.filter(x => x.h < minTapHeight(x.c))
  expect(tooSmall).toEqual([])
})

test('微信群二维码在小屏上放得下、看得清', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '微信群' }).click()
  const img = page.locator('.wechat-img')
  await expect(img).toBeVisible()

  const box = await img.boundingBox()
  const vp = page.viewportSize()
  expect(box.width).toBeLessThanOrEqual(vp.width)
  expect(box.height).toBeLessThanOrEqual(vp.height)
  expect(box.width).toBeGreaterThan(vp.width * 0.5)   // 太小就扫不动
  await expectNoHorizontalScroll(page)
})

test('取餐时段在小屏上不会挤成一团', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  const slots = page.locator('.checkout-modal button.time-slot')
  await expect(slots.first()).toBeVisible()
  const boxes = await slots.evaluateAll(bs => bs.map(b => b.getBoundingClientRect()).map(r => ({ w: r.width, h: r.height })))
  for (const b of boxes) {
    expect(b.h).toBeGreaterThanOrEqual(44)   // 和 touch.css 里给 .time-slot 的一致
    expect(b.w).toBeGreaterThanOrEqual(56)
  }
})

test('小票页的复制按钮不会被长链接挤出屏幕', async ({ page }) => {
  await page.goto('/?session_id=cs_test_a_very_long_session_identifier_1234567890')
  await page.locator('.os-card').waitFor()

  const btn = page.locator('button.os-copy')
  const box = await btn.boundingBox()
  const vp = page.viewportSize()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1)
  expect(box.width).toBeGreaterThan(40)
})
