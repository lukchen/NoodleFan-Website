// 导航栏 —— 购物车和语言切换是功能入口,任何宽度、任何语言下都必须在屏幕里。
//
// 这条测试是补一个真实事故:英文文案比中文长一倍,在 1181–1700px 这一段宽度里
// 标语把整行撑开,把购物车和语言切换顶出了屏幕外。中文下宽度刚好够,所以一直没人发现。
import { test, expect } from '@playwright/test'
import { stubBackend } from './fixtures.js'

// 覆盖笔记本常见宽度 + 标语开始显示的临界点(1180px)两侧
const WIDTHS = [1900, 1700, 1520, 1400, 1300, 1181, 1180, 1024, 900, 768]

for (const lang of ['zh', 'en']) {
  test(`导航栏在各种宽度下都不挤走功能入口(${lang})`, async ({ page }) => {
    await stubBackend(page, { lang })

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      const box = await page.evaluate(() => {
        const g = (s) => {
          const el = document.querySelector(s)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { left: r.left, right: r.right, width: r.width }
        }
        const doc = document.documentElement
        return {
          cart: g('.cart-btn'),
          lang: g('.lang-toggle'),
          wechat: g('.wechat-nav-btn'),
          overflow: doc.scrollWidth > doc.clientWidth,
        }
      })

      expect(box.cart, `${lang} @${width}px 找不到购物车`).not.toBeNull()
      expect(box.lang, `${lang} @${width}px 找不到语言切换`).not.toBeNull()

      for (const [name, el] of Object.entries({ 购物车: box.cart, 语言切换: box.lang, 微信群: box.wechat })) {
        if (!el) continue
        expect(el.right, `${lang} @${width}px: ${name}被顶出屏幕右侧`).toBeLessThanOrEqual(width + 1)
        expect(el.left, `${lang} @${width}px: ${name}跑到屏幕左侧外`).toBeGreaterThanOrEqual(-1)
        expect(el.width, `${lang} @${width}px: ${name}被压成零宽`).toBeGreaterThan(0)
      }
      expect(box.overflow, `${lang} @${width}px 整页横向溢出`).toBe(false)
    }
  })
}

test('标语按剩余空间截断,而不是把导航栏撑开', async ({ page }) => {
  await stubBackend(page, { lang: 'en' })

  await page.setViewportSize({ width: 1900, height: 900 })
  await page.goto('/')
  const wide = await page.locator('.navbar-tagline').evaluate(el => el.getBoundingClientRect().width)

  await page.setViewportSize({ width: 1300, height: 900 })
  await page.waitForTimeout(150)
  const narrow = await page.locator('.navbar-tagline').evaluate(el => el.getBoundingClientRect().width)

  // 窄屏下标语必须自己让位 —— 让不出来就是又回到把操作区顶出去的老路
expect(narrow).toBeLessThan(wide)
})

test('手机上店名不会被右边的按钮盖住', async ({ page }) => {
  await stubBackend(page)
  await page.setViewportSize({ width: 390, height: 844 })   // iPhone 13
  await page.goto('/')

  const box = await page.evaluate(() => {
    const name = [...document.querySelectorAll('.navbar-brand > span')]
      .find(x => !x.className.includes('tagline'))
    const links = document.querySelector('.navbar-links')
    return {
      nameRight: name.getBoundingClientRect().right,
      linksLeft: links.getBoundingClientRect().left,
      nameText: name.innerText,
      truncated: name.scrollWidth > name.clientWidth + 1,
    }
  })

  // 店名的右边界不能越过功能区的左边界 —— 越过了就是视觉上压在一起
  expect(box.nameRight, '店名盖住了右边的功能按钮').toBeLessThanOrEqual(box.linksLeft)
  // 390px 上应该放得下完整店名,不该靠截断来避让
  expect(box.truncated, '店名被截断了,说明空间还是不够').toBe(false)
  expect(box.nameText).toContain('粉面王')
})
