// 取餐点/日期的记忆有时效 —— 它是这一单的前提,不是客人的个人偏好。
//
// 补的是一个真实观察:上线当天进站,页面直接显示「Allston 周二 10/6」,
// 完全没问过。那是上一次选择被永久记住的结果 —— 客人中午想买个烧饼当午饭,
// 得先看懂顶上那条小字、再找到「更换」才能改回到店自取。
import { test, expect } from '@playwright/test'
import { stubBackend } from './fixtures.js'

const 选择页 = '先选取餐点与日期'

test('第一次进来必须先选取餐方式', async ({ page }) => {
  await stubBackend(page)
  await page.goto('/')
  await expect(page.getByText(选择页, { exact: false })).toBeVisible()
})

test('选完之后短时间内再进来,不用重选', async ({ page }) => {
  await stubBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: /到店自取/ }).first().click()
  await expect(page.locator('.menu-card').first()).toBeVisible()

  await page.reload()
  await expect(page.locator('body')).not.toContainText(选择页)
})

test('超过有效期再进来,重新问一遍,并且旧选择被清掉', async ({ page }) => {
  await stubBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: /到店自取/ }).first().click()
  await expect(page.locator('.menu-card').first()).toBeVisible()

  // 把「选择时刻」往回拨 31 分钟 —— 等同于客人隔了半小时再回来
  await page.evaluate(() => {
    localStorage.setItem('nf-pickup-saved-at', String(Date.now() - 31 * 60 * 1000))
  })
  await page.reload()

  await expect(page.getByText(选择页, { exact: false })).toBeVisible()
  // 过期的值要一起清掉,否则下次又会读到一份陈的
  expect(await page.evaluate(() => localStorage.getItem('nf-pickup-point'))).toBeNull()
})

test('有效期从「做出选择」算起,不是从「上次打开网站」算', async ({ page }) => {
  await stubBackend(page)
  await page.goto('/')
  await page.getByRole('button', { name: /到店自取/ }).first().click()
  await expect(page.locator('.menu-card').first()).toBeVisible()
  const at1 = await page.evaluate(() => localStorage.getItem('nf-pickup-saved-at'))

  // 只是刷新页面,不重新选 —— 时间戳不该被续期,
  // 否则一个每隔二十分钟刷一次的人永远不会被问第二次。
  await page.reload()
  await page.waitForTimeout(300)
  const at2 = await page.evaluate(() => localStorage.getItem('nf-pickup-saved-at'))
  expect(at2).toBe(at1)
})
