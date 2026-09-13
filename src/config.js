// Public keys — safe to commit. Secret keys live in Supabase Edge Function env vars only.
export const SUPABASE_URL = 'https://pqurochuljpjtiuvamdq.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_W-GiC2jdZ-ZX2eYHTgAD0A_xrtZjXXs'

// 线上点单开关。POS / 出单流程还没跑通,先整站隐藏点餐入口,
// 只展示菜单并提示"即将上线"。接好 POS 后把这里改成 true 即可全部恢复:
// 购物车按钮、加入按钮、选配弹窗、结账流程、菜单上的直营价都跟着这一个变量走。
export const ORDERING_ENABLED = true

// 结账开关。ORDERING_ENABLED 打开后菜单、选配、购物车都可用，但只要这里是 false，
// 结账页的付款按钮就禁用并显示"即将上线"——用于在 Edge Function 部署好之前
// 先把完整点餐体验放出来预览，不会有任何请求打到 Stripe。
// create-checkout 部署完成后改成 true 即可正式收单。
export const CHECKOUT_ENABLED = false

// 外卖平台链接。目前只上线了 Uber Eats;饭团/DoorDash/Grubhub 开通后
// 在这里补上对应 URL,Hero 上的按钮会自动多出来。
export const PLATFORM_LINKS = {
  uberEats: 'https://www.ubereats.com/store-browse-uuid/26839533-9426-5661-9e5f-b6d50eb0a89c?diningMode=DELIVERY',
}
