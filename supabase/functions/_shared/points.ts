// 取餐点的权威定义 —— 服务端唯一可信的那一份。
//
// 为什么必须有这个文件:create-checkout 原来直接信前端传来的 pickupPoint 对象,
// 而那个对象里的 kind 决定了两件大事:
//   1. captureMode —— kind:'dropoff' 只授权不扣款,kind:'store' 立即扣款
//   2. 要不要做超卖拦截 —— 只有 dropoff 才查每道菜 15 份的上限
// 也就是说,直接打接口的人只要把 kind 写成 'store',就能绕开当天备料上限,
// 把一道菜订到 50 份;写成 'dropoff' 则能让到店自取的单永远不扣款。
// nameZh 同理:原样存进库、再拼进邮件 HTML,等于让调用方往邮件里塞任意内容。
//
// 现在只认 id,其余一概由服务端查表得出。
export type PickupPoint = {
  id: string
  kind: 'store' | 'dropoff'
  nameZh: string
  nameEn: string
}

const POINTS: Record<string, PickupPoint> = {
  store:   { id: 'store',   kind: 'store',   nameZh: '到店自取',       nameEn: 'Store Pickup' },
  allston: { id: 'allston', kind: 'dropoff', nameZh: 'Allston 取餐点', nameEn: 'Allston Pickup Spot' },
  malden:  { id: 'malden',  kind: 'dropoff', nameZh: 'Malden 取餐点',  nameEn: 'Malden Pickup Spot' },
}

// 认不出的 id 一律拒单 —— 宁可让这一单失败,也不要产生一张取餐点不明的订单:
// 那种单在后台既不属于自取也不属于任何班次,备餐时没人认领。
export function resolvePoint(id: unknown): PickupPoint {
  const point = typeof id === 'string' ? POINTS[id] : undefined
  if (!point) throw new Error('invalid pickup point')
  return point
}
