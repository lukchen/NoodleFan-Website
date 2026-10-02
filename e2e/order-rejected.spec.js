// 被拒单的客人打开小票页看到什么。
//
// 这一页是他唯一会主动回来看的地方,所以必须自己把话说清楚:
// 订单没了、钱退了。只改一行描述而状态还写着「备餐中」,是最容易让人恐慌的组合。
import { test, expect } from '@playwright/test'
import { stubBackend, paidOrder } from './fixtures.js'

const rejected = { ...paidOrder, status: 'rejected' }

test('被拒的单在小票页上显示成已取消,并说明已退款', async ({ page }) => {
  await stubBackend(page, { order: rejected })
  await page.goto('/?session_id=stub')
  await expect(page.locator('.os-banner--cancelled')).toBeVisible()
  await expect(page.locator('body')).toContainText('退款')
})

test('被拒的单不再显示取餐码和取餐时间 —— 别让人还跑一趟', async ({ page }) => {
  await stubBackend(page, { order: rejected })
  await page.goto('/?session_id=stub')
  await expect(page.locator('.os-code')).toHaveCount(0)
  await expect(page.locator('.os-pickup')).toHaveCount(0)
})
