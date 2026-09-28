import { defineConfig } from 'vitest/config'

// 单元测试只跑纯逻辑(定价、取餐点查表、CORS/密码比对、邮件模板、班次与时段),
// 所以用 node 环境,不拉 jsdom —— 界面行为交给 e2e/ 里的 Playwright 真浏览器跑。
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    setupFiles: ['tests/setup.js'],
  },
})
