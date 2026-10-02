// 所有打到 Supabase 的请求都在这里拦掉。
// 测试绝不碰生产库 —— 既是为了不往真订单表里写垃圾,也是为了不因为网络抖动就红。
export const SUPABASE = 'https://pqurochuljpjtiuvamdq.supabase.co'

export const paidOrder = {
  pickup_code: '6539',
  status: 'paid',
  pickup_date: '2026-09-29',
  pickup_time: '18:00',
  total: 32.1,
  note: '不要香菜',
  items: [
    { nameZh: '兰州牛肉拉面', nameEn: 'Lanzhou beef noodles', qty: 2, price: 15, optionsZh: ['宽面'], optionsEn: ['Wide'] },
  ],
}

export const cancelledOrder = { ...paidOrder, status: 'cancelled_no_run' }

// Edge Function 全部走 /functions/v1/<name>;realtime 是 websocket,page.route 拦不到,
// 连不上会自己重试,不影响断言。
export async function stubBackend(page, { order = paidOrder, checkoutUrl, lang = 'zh', dishSettings = {} } = {}) {
  // 语言钉死 —— 默认语言现在跟着浏览器语言走(Playwright 是 en-US),
  // 不钉的话下面所有中文选择器都会落空。
  if (lang) await page.addInitScript(l => localStorage.setItem('nf_lang', l), lang)

  // 测试要封闭:除了本机的构建产物,外网一律掉掉(Google 字体、统计脚本之类)。
  // 不掉的话单条用例会卡在外部请求上,几分钟才超时,而且断网就红。
  await page.route('**/*', route => {
    const url = route.request().url()
    if (url.startsWith('http://localhost') || url.startsWith(SUPABASE) || url.startsWith('data:')) {
      return route.continue()
    }
    return route.abort()
  })

  // 注意顺序:Playwright 是后注册的 route 优先,所以兜底必须先注册,
  // 否则它会把下面这些具体规则全盖掉(第一次写反了,表现是所有订单都「查不到」)。
  await page.route(`${SUPABASE}/**`, route => route.fulfill({ json: {} }))

  await page.route(`${SUPABASE}/functions/v1/run-stats*`, route =>
    route.fulfill({ json: { dishes: {}, orders: 0 } }))
  // 菜品当天状态(下架 / 今日售罄 / 每班备几份)。默认空 = 全部正常在卖。
  await page.route(`${SUPABASE}/functions/v1/menu-settings`, route =>
    route.fulfill({ json: { settings: dishSettings, defaultCap: 15 } }))
  await page.route(`${SUPABASE}/functions/v1/create-checkout`, route =>
    route.fulfill({ json: { url: checkoutUrl ?? 'http://localhost:4173/?stripe=stub' } }))
  await page.route(`${SUPABASE}/functions/v1/order-status`, route =>
    route.fulfill({ json: { order } }))
}

// 先选取餐方式才看得到菜单 —— 几乎每个流程都要先过这道门
export async function choosePickup(page, name = '到店自取') {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(name) }).first().click()
  await page.waitForTimeout(200)
}

// 加第一道菜。有选项的菜会先弹选配窗,没选项的直接进购物车 —— 两种都要走得通。
export async function addFirstDish(page) {
  await page.getByRole('button', { name: /^加入$|^Add$/ }).first().click()
  const confirm = page.getByRole('button', { name: /加入购物车|Add to cart/ })
  if (await confirm.count()) await confirm.first().click()
  await page.waitForFunction(() => !!localStorage.getItem('nf_cart'))
}

// 拉开购物车抽屉:桌面点右侧常驻面板的按钮,手机点底部吸底条。
export async function openCart(page) {
  const panel = page.locator('button.cart-panel-btn')
  if (await panel.isVisible().catch(() => false)) await panel.click()
  else await page.locator('button.mobile-cart-bar').click()
  await page.locator('.cart-drawer--open').waitFor()
}

// 「去结账」在页面上有三处:桌面右侧常驻面板、手机底部吸底条、购物车抽屉里的那个。
// 前两个只是把抽屉拉开,真正打开结账窗的是抽屉里的 .cart-checkout-btn。
// 所以不能图省事写 .first() —— 那会点到被抽屉盖住的那一个,表现为「点了没反应」。
export async function openCheckout(page) {
  const drawerBtn = page.locator('button.cart-checkout-btn')
  // 抽屉是 translateX(100%) 移出屏幕的,DOM 里一直在、CSS 上也算 visible,
  // 所以不能用 isVisible() 判断它开没开 —— 要看 .cart-drawer--open 这个类。
  // 另外:关掉结账窗后抽屉还开着,这时再去点外面那两个开关会被抽屉挡住,直接用抽屉里的。
  if (await page.locator('.cart-drawer--open').count() === 0) await openCart(page)
  await drawerBtn.click()
  await page.locator('.checkout-modal').waitFor()
}
