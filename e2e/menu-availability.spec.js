// 下架和「今日售罄」在客人那一侧的表现。
//
// 两者的区别是刻意的,测试把它钉住:
//   下架     —— 菜单上直接没有这道菜(季节菜、不做了的)
//   今日售罄 —— 菜还在菜单上但置灰。客人因此知道这家有这道菜、明天可以再来;
//               凭空消失等于白白丢掉一次下次再来的理由。
import { test, expect } from '@playwright/test'
import { stubBackend, choosePickup } from './fixtures.js'

// 武汉热干面 = id 24
const 热干面 = '武汉热干面'

test('默认状态下菜都在卖', async ({ page }) => {
  await stubBackend(page)
  await choosePickup(page)
  await expect(page.locator('.menu-card', { hasText: 热干面 })).toBeVisible()
})

test('下架的菜从菜单上消失', async ({ page }) => {
  await stubBackend(page, { dishSettings: { 24: { listed: false, soldOutToday: false, cap: 15 } } })
  await choosePickup(page)
  await expect(page.locator('.menu-card', { hasText: 热干面 })).toHaveCount(0)
  // 别的菜不受影响 —— 一次下架不能把整节菜单带没
  await expect(page.locator('.menu-card').first()).toBeVisible()
})

test('今日售罄的菜还在菜单上,但点不了', async ({ page }) => {
  await stubBackend(page, { dishSettings: { 24: { listed: true, soldOutToday: true, cap: 15 } } })
  await choosePickup(page)
  const card = page.locator('.menu-card', { hasText: 热干面 })
  await expect(card).toBeVisible()          // 还在
  await expect(card).toContainText(/售罄|订满|Sold/i)
  // 加入按钮必须真的按不动,而不只是看着灰
  const add = card.getByRole('button')
  if (await add.count()) await expect(add.first()).toBeDisabled()
})

test('到店自取也认今日售罄 —— 厨房没货就是没货,跟团餐备料无关', async ({ page }) => {
  await stubBackend(page, { dishSettings: { 24: { listed: true, soldOutToday: true, cap: 15 } } })
  await choosePickup(page, '到店自取')
  await expect(page.locator('.menu-card', { hasText: 热干面 })).toContainText(/售罄|订满|Sold/i)
})

test('读不到状态时按「都能卖」处理,不要把菜单变成空的', async ({ page }) => {
  await stubBackend(page)
  // 让这个接口直接失败 —— 网络抖动、函数没部署都会这样
  await page.route('**/functions/v1/menu-settings', route => route.abort())
  await choosePickup(page)
  // 真正的防线在 create-checkout,那边下单时还会再查一次并拒单。
  // 这里宁可多显示一道菜,也不要因为一次抖动让整家店看起来关门了。
  await expect(page.locator('.menu-card').first()).toBeVisible()
})
