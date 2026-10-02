// 拒单理由 —— 后台的按钮文案和发给客人的邮件说法必须是同一份。
//
// 为什么只给固定几条、而不是让店家自己打字:忙到要拒单的时候没人想斟酌措辞,
// 临时写出来的句子往往太生硬("做不了")。这几条都写成了「不是你的问题、
// 钱已经退了、欢迎再来」的调子 —— 一次拒单本来就容易丢掉一个客人,
// 措辞是唯一能挽回一点的地方。需要补充细节时后面还能加一句自定义说明。
//
// 纯数据 + 纯函数、不带 import:Vite(后台界面)和 Deno(发邮件)都要直接加载它。
export const REJECT_REASONS = [
  {
    code: 'sold_out',
    labelZh: '食材售罄 / 缺货',
    labelEn: 'Ingredients sold out',
    // 给客人的说法
    textZh: '很抱歉，这一单里有菜品的食材今天已经用完了，我们没办法把它做好给您。',
    textEn: 'Sorry — we ran out of ingredients for part of this order today and cannot make it.',
  },
  {
    code: 'too_busy',
    labelZh: '今日单量已满 / 做不过来',
    labelEn: 'Fully booked today',
    textZh: '很抱歉，今天的订单已经排满，这一单我们没办法按时做好。',
    textEn: 'Sorry — we are fully booked today and cannot get this order out on time.',
  },
  {
    code: 'closed',
    labelZh: '临时停业 / 设备故障',
    labelEn: 'Temporarily closed',
    textZh: '很抱歉，店里临时有状况（设备故障／临时停业），今天没法出餐。',
    textEn: 'Sorry — we had an unexpected closure today (equipment issue) and cannot prepare food.',
  },
]

export function rejectReason(code) {
  return REJECT_REASONS.find(r => r.code === code) ?? null
}

// 认不出的理由代码一律拒绝 —— 这段文字会原样进到发给客人的邮件里,
// 不能让调用方塞任意内容进去(那等于用我们的域名发任意邮件)。
export function isValidReason(code) {
  return REJECT_REASONS.some(r => r.code === code)
}
