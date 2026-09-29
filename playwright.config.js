import { defineConfig, devices } from '@playwright/test'

// 端到端测试打的是真实构建产物(vite build → vite preview),不是 dev server ——
// 线上是 GitHub Pages 上的静态文件,构建产物才是客人真正拿到的东西。
//
// 所有打到 Supabase 的请求都在各个 spec 里用 page.route 拦掉:
// 测试不许碰生产数据库,也不能因为网络抖动就红。
//
// 默认用 Playwright 自己下载的 chromium(本机跑 `npx playwright install chromium` 即可)。
// CI 或沙箱里已经有一份浏览器时,用 PLAYWRIGHT_CHROMIUM_PATH 指过去,省掉几百 MB 下载:
//   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
      testIgnore: /mobile\.spec\.js/,   // 小屏专属的断言在桌面视口下没有意义
    },
    // 手机视口单独跑一遍 —— 客人基本都在微信里点开,横向溢出和小屏错位只有这里看得见。
    // 强制用 chromium:iPhone 13 这个预设默认走 WebKit,而沙箱和多数 CI 只装了 chromium,
    // 不覆盖的话报的是一句莫名其妙的「browser has been closed」。视口和触摸照样是手机的。
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium', launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
