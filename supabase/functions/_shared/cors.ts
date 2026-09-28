// CORS —— 只给自己的站点放行。
//
// 说清楚它能做什么、不能做什么:CORS 是浏览器的规矩,curl 和脚本根本不看。
// 所以这不是接口的防线(那是密码和签名的活),它挡的是这一种情况:
// 某个第三方网页在访客的浏览器里偷偷调我们的后台接口 —— 比如拿访客的网络
// 去暴力试管理员密码,日志里看到的会是一堆无辜访客的 IP。
//
// 没有 Origin 头的请求(curl、Stripe 的 webhook、我们自己的定时任务)照常放行,
// 因为它们本来就不受 CORS 约束,拦了也只是给自己添堵。
const ALLOWED = new Set([
  'https://noodlefanboston.com',
  'https://www.noodlefanboston.com',
  'https://lukchen.github.io',   // GitHub Pages 的原始域名,换域名前的老链接还有人用
  'http://localhost:5173',       // 本地开发
  'http://localhost:4173',       // vite preview
])

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  // 名单内才回 Allow-Origin;不在名单里就不回这个头,浏览器自己会把响应丢掉。
  if (origin && ALLOWED.has(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

// 密码比对要恒定时间 —— `a !== b` 在第一个不同的字符就返回,
// 逐位试出密码在理论上是可能的。这个函数无论对错都走完全程。
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  // 长度不同也要走完比较,否则长度本身会从响应时间里泄露出去
  let diff = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// 密码错了就慢一点回 —— 把在线爆破从「每秒几千次」压到「每秒几次」。
// 没做账号锁定:单人小店,锁死了你自己在出餐高峰进不去后台,
// 那个代价比爆破风险更实在(密码本身是 17 位随机的)。
export function authDelay(): Promise<void> {
  return new Promise(r => setTimeout(r, 1000))
}
