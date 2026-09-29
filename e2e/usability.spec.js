// 常规键盘和交互习惯 —— 这些没人会专门夸,但缺了就处处别扭:
// Esc 关不掉弹窗、点遮罩关不掉、回车提交不了表单、滚动穿透到背后的菜单。
import { test, expect } from '@playwright/test'
import { stubBackend, choosePickup, addFirstDish, openCart, openCheckout } from './fixtures.js'
import { CHECKOUT_ENABLED } from '../src/config.js'

// 结账开关关着时(等 Stripe 审核、或者后端还没部署),下单按钮是恒定禁用的 ——
// 下面三条验的是「填齐了才放行」,那时候没有意义,跳过而不是红。
// 单独有一条用例盯着「关着的时候必须禁用」,见文件末尾。
const needsCheckout = () => test.skip(!CHECKOUT_ENABLED, '结账开关当前是关的(src/config.js)')

test.use({ timezoneId: 'America/New_York' })

test.beforeEach(async ({ page, context }) => {
  await context.clock.setFixedTime(new Date('2026-09-29T16:00:00Z'))
  await stubBackend(page)
})

test('Esc 先关最上层:第一下关结账窗,抽屉还在;第二下才关抽屉', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await page.keyboard.press('Escape')
  await expect(page.locator('.checkout-modal')).toHaveCount(0)
  await expect(page.locator('.cart-drawer--open')).toHaveCount(1)

  await page.keyboard.press('Escape')
  await expect(page.locator('.cart-drawer--open')).toHaveCount(0)
})

test('Esc 能关掉选配弹窗', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await page.getByRole('button', { name: /^加入$/ }).first().click()
  const modal = page.locator('.options-modal')
  if (await modal.count() === 0) test.skip(true, '第一道菜没有选项')
  await page.keyboard.press('Escape')
  await expect(modal).toHaveCount(0)
})

test('Esc 能关掉微信群弹窗', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '微信群' }).click()
  await expect(page.locator('.wechat-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.wechat-modal')).toHaveCount(0)
})

test('Esc 能关掉购物车抽屉', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCart(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.cart-drawer--open')).toHaveCount(0)
})

test('点弹窗外面的遮罩也能关掉,但点弹窗里面不会误关', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await page.locator('.checkout-modal').click({ position: { x: 10, y: 60 } })
  await expect(page.locator('.checkout-modal')).toHaveCount(1)   // 点里面不关

  await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('.checkout-modal')).toHaveCount(0)
})

test('弹窗打开时背后的页面不跟着滚 —— 手机上最恼人的那个毛病', async ({ page }) => {
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  const before = await page.evaluate(() => window.scrollY)
  await openCheckout(page)

  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(before)
})

test('表单里按回车就提交,不用非去点按钮', async ({ page }) => {
  needsCheckout()
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await page.locator('.checkout-modal input[name="name"]').fill('刘明')
  await page.locator('.checkout-modal input[name="email"]').fill('liu@example.com')
  await page.locator('.checkout-modal button.time-slot').first().click()

  let called = false
  await page.route('**/functions/v1/create-checkout', route => {
    called = true
    return route.fulfill({ json: { url: 'http://localhost:4173/?stub=1' } })
  })
  await page.locator('.checkout-modal input[name="email"]').press('Enter')
  await expect.poll(() => called, { timeout: 5000 }).toBe(true)
})

test('必填项没填时下单按钮就是禁用的 —— 比等浏览器弹气泡更早一步', async ({ page }) => {
  needsCheckout()
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  const submit = page.locator('.checkout-modal button[type="submit"]')
  await expect(submit).toBeDisabled()

  await page.locator('.checkout-modal input[name="name"]').fill('刘明')
  await expect(submit).toBeDisabled()                 // 还差邮箱和取餐时间
  await page.locator('.checkout-modal input[name="email"]').fill('liu@example.com')
  await expect(submit).toBeDisabled()                 // 还差取餐时间
  await page.locator('.checkout-modal button.time-slot').first().click()
  await expect(submit).toBeEnabled()                  // 三样齐了才放行
})

test('邮箱格式不对也过不去 —— 邮件是订单状态唯一的送达渠道', async ({ page }) => {
  needsCheckout()
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  await page.locator('.checkout-modal input[name="name"]').fill('刘明')
  await page.locator('.checkout-modal input[name="email"]').fill('not-an-email')
  await page.locator('.checkout-modal button.time-slot').first().click()

  let called = false
  await page.route('**/functions/v1/create-checkout', route => { called = true; return route.fulfill({ json: { url: '/' } }) })
  await page.locator('.checkout-modal button[type="submit"]').click()
  await page.waitForTimeout(400)
  expect(called).toBe(false)
  // 浏览器自己的校验气泡拦住了,弹窗还在
  await expect(page.locator('.checkout-modal')).toHaveCount(1)
})

test('所有可点的东西都有可读的名字 —— 光一个图标读屏软件念不出来', async ({ page }) => {
  await page.goto('/')
  const nameless = await page.locator('button:visible').evaluateAll(bs =>
    bs.filter(b => !(b.innerText.trim() || b.getAttribute('aria-label') || b.title))
      .map(b => b.className))
  expect(nameless).toEqual([])
})

test('语言切换真的换语言,且刷新后记住 —— 英文客人不该每次刷新都被切回中文', async ({ browser }) => {
  // 必须自己开 context:外面 beforeEach 里的 stubBackend 会在每次导航时把 nf_lang
  // 重设成 zh,正好把这条用例要验的「刷新后还记得」给盖掉了。
  const ctx = await browser.newContext({ locale: 'zh-CN', timezoneId: 'America/New_York' })
  const page = await ctx.newPage()
  await stubBackend(page, { lang: null })
  await page.goto('/')
  await page.getByRole('button', { name: 'EN' }).click()
  await expect(page.getByText('How would you like to pick up?', { exact: false }).first()).toBeVisible()

  expect(await page.evaluate(() => localStorage.getItem('nf_lang'))).toBe('en')

  await page.reload()
  await expect(page.locator('body')).toContainText('How would you like to pick up?', { timeout: 15_000 })
  await ctx.close()
})

test('没选过语言时一律默认中文 —— 哪怕浏览器是英文', async ({ browser }) => {
  // 客群是波士顿的中国人,其中不少人的设备本身是英文系统。
  // 跟着浏览器语言走会把他们默认送进英文站,反而要多点一次。
  const ctx = await browser.newContext({ locale: 'en-US' })
  const p2 = await ctx.newPage()
  await stubBackend(p2, { lang: null })
  await p2.addInitScript(() => localStorage.removeItem('nf_lang'))
  await p2.goto('/')
  await expect(p2.getByText('选择取餐方式', { exact: false }).first()).toBeVisible()
  await ctx.close()
})

test('结账开关关着时,付款按钮禁用并写明「即将上线」', async ({ page }) => {
  test.skip(CHECKOUT_ENABLED, '结账开关是开的')
  await choosePickup(page, '到店自取')
  await addFirstDish(page)
  await openCheckout(page)

  // 关着的时候按钮必须是死的,并且话说清楚 —— 不能让客人点了没反应、以为是网站坏了
  await expect(page.locator('.checkout-modal button[type="submit"]')).toBeDisabled()
  await expect(page.getByText('即将上线', { exact: false }).first()).toBeVisible()
})
