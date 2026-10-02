// 微信群二维码。
//
// 图片本身是微信导出的整张群名片(深色底 + 群名 + 码 + 有效期),原样展示就行 ——
// 每 7 天换码时只要用同名文件覆盖 public/images/ 里的这张,代码一行都不用改。
//
// 换码步骤:
//   1. 微信群 → 群二维码 → 保存图片
//   2. 覆盖 public/images/Group chat_波士顿粉面王Noodle Fan.png
//   3. 把下面的 QR_EXPIRES 改成新码的失效日
export const QR_EXPIRES = '2026-10-09'   // 当前这张码的失效日(含当天)

export const QR_SRC = 'images/Group chat_波士顿粉面王Noodle Fan.png'

// 过期的码扫出来是报错页,不如不放 —— 到期后整块自动隐藏,
// 免得客人扫半天以为店有问题。
export function qrValid(now = new Date()) {
  return now <= new Date(`${QR_EXPIRES}T23:59:59-04:00`)
}
