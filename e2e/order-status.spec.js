// 小票页 —— 客人付完款唯一还能回到的地方。
import { test, expect } from '@playwright/test'
import { stubBackend, paidOrder, cancelledOrder } from './fixtures.js'

test.describe('小票页', () => {
  test('已付款的单:取餐码、进度、菜品、可复制的链接都在', async ({ page }) => {
    await stubBackend(page)
    await page.goto('/?session_id=cs_test_123')

    await expect(page.getByText('6539')).toBeVisible()
    await expect(page.getByText('兰州牛肉拉面', { exact: false })).toBeVisible()
    await expect(page.getByText('不要香菜')).toBeVisible()

    // 链接框里必须是带 session_id 的完整地址 —— 这是他回来的唯一钥匙
    const link = page.locator('#os-link-input')
    await expect(link).toHaveValue(/session_id=cs_test_123$/)
    await expect(link).toHaveValue(/^https?:\/\//)
  })

  test('点复制按钮会给出「已复制」反馈', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', '剪贴板权限只在 chromium 下稳定')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await stubBackend(page)
    await page.goto('/?session_id=cs_test_123')

    const btn = page.getByRole('button', { name: '复制链接' })
    await btn.click()
    await expect(page.getByRole('button', { name: '已复制' })).toBeVisible()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('session_id=cs_test_123')
  })

  test('联系方式:微信群按钮(带二维码小图)+ 回复收据邮件的说明', async ({ page }) => {
    await stubBackend(page)
    await page.goto('/?session_id=cs_test_123')

    const wechat = page.getByRole('button', { name: /微信群里联系客服/ })
    await expect(wechat).toBeVisible()
    await expect(wechat.locator('img')).toBeVisible()
    await expect(page.getByText(/回复我们发给您的收据邮件/)).toBeVisible()

    await wechat.click()
    await expect(page.getByText('加入粉面王老吃家群')).toBeVisible()
  })

  test('未成团取消:标题、状态牌都要说清,且不再显示取餐码', async ({ page }) => {
    await stubBackend(page, { order: cancelledOrder })
    await page.goto('/?session_id=cs_test_123')

    await expect(page.getByText('订单已取消，未扣任何费用。')).toBeVisible()
    await expect(page.getByText('未成团 · 未扣款')).toBeVisible()
    await expect(page.getByText('您卡上的冻结已解除', { exact: false })).toBeVisible()

    // 取消的单还显示取餐码,等于请客人来取一顿不存在的餐
    await expect(page.getByText('6539')).toHaveCount(0)
    // 进度条也不该出现
    await expect(page.locator('.os-steps')).toHaveCount(0)
  })

  test('等待成团:不套用「已确认」的进度条', async ({ page }) => {
    await stubBackend(page, { order: { ...paidOrder, status: 'authorized' } })
    await page.goto('/?session_id=cs_test_123')

    await expect(page.getByText('订单已提交，等待成团。')).toBeVisible()
    await expect(page.locator('.os-banner--waiting')).toBeVisible()
    await expect(page.locator('.os-steps')).toHaveCount(0)
  })

  test('查不到订单时给出可操作的提示,不白屏', async ({ page }) => {
    // 前端会轮询 15 次、每次隔 2 秒等 webhook 落库,所以这条天生要跑半分钟以上
    test.setTimeout(90_000)
    // 走同一套 stub(它顺便把界面语言钉成中文),只是让接口一直查不到这一单
    await stubBackend(page, { order: null })
    await page.goto('/?session_id=cs_missing')
    await expect(page.getByText(/没找到这笔订单/)).toBeVisible({ timeout: 40_000 })
  })
})
