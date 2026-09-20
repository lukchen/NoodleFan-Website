// 取餐方式 —— 到店自取 + 定点配送(Allston / Malden)。
//
// 定点配送的玩法:每个取餐点固定几天跑一趟,当天 15:00 截单,满 MIN_ORDERS 单发车,
// 每道菜当天限量 DAILY_LIMIT 份。客人先选取餐点再看菜单,因为取餐点决定了截单时间、
// 剩余份数和是否成团。
//
// ⚠ 班期(days)与送达时间(pickupHour)仍为暂定值,确定后改这里即可,UI 会跟着变。

export const MIN_ORDERS = 5        // 起送单数
export const DAILY_LIMIT = 15      // 每道菜每天备料上限
export const CUTOFF_HOUR = 15      // 15:00 截单

// 店铺营业时间 —— 显示文案和「现在是否营业」都从这两个数字来,避免两处各写一份走偏。
export const STORE_OPEN_HOUR = 11   // 11:00 AM
export const STORE_CLOSE_HOUR = 21  // 9:00 PM

function hourLabel(h) {
  const h12 = h > 12 ? h - 12 : h
  return `${h12}:00 ${h >= 12 ? 'PM' : 'AM'}`
}
export const STORE_HOURS_TEXT = `${hourLabel(STORE_OPEN_HOUR)} – ${hourLabel(STORE_CLOSE_HOUR)}`

// 打烊时间之外不拦单,而是当成预约单 —— 这个函数只用来提示客人,不用来禁用下单。
export function storeIsOpen(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60
  return h >= STORE_OPEN_HOUR && h < STORE_CLOSE_HOUR
}

// weekday: 0=周日 … 6=周六
export const PICKUP_POINTS = [
  {
    id: 'store',
    kind: 'store',
    nameZh: '到店自取',
    nameEn: 'Store Pickup',
    areaZh: '94 Shirley St, Boston, MA 02119',
    areaEn: '94 Shirley St, Boston, MA 02119',
    hoursZh: STORE_HOURS_TEXT,
    hoursEn: STORE_HOURS_TEXT,
    noteZh: '营业时间内随时下单 · 约 20 分钟出餐',
    noteEn: 'Order anytime during open hours · ready in ~20 min',
  },
  {
    id: 'allston',
    kind: 'dropoff',
    nameZh: 'Allston 取餐点',
    nameEn: 'Allston Pickup Spot',
    areaZh: '1 Brighton Ave, Boston, MA 02134(Super 88 超市门口)',
    areaEn: '1 Brighton Ave, Boston, MA 02134 (in front of Super 88)',
    days: [2, 5],          // 周二、周五
    pickupHour: 18,        // 18:00 送达
  },
  {
    id: 'malden',
    kind: 'dropoff',
    nameZh: 'Malden 取餐点',
    nameEn: 'Malden Pickup Spot',
    areaZh: '300 Pleasant St, Malden, MA 02148(停车场)',
    areaEn: '300 Pleasant St, Malden, MA 02148 (parking lot)',
    days: [3, 6],          // 周三、周六
    pickupHour: 18,
  },
]

export function getPoint(id) {
  return PICKUP_POINTS.find(p => p.id === id) ?? null
}

const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// 下一趟车:今天在班期内且还没到截单点就是今天,否则往后找最近的一天。
export function nextRun(point, now = new Date()) {
  if (!point || point.kind !== 'dropoff') return null
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    if (!point.days.includes(d.getDay())) continue
    const cutoff = new Date(d)
    cutoff.setHours(CUTOFF_HOUR, 0, 0, 0)
    if (i === 0 && now >= cutoff) continue
    const pickupAt = new Date(d)
    pickupAt.setHours(point.pickupHour, 0, 0, 0)
    return { date: d, cutoff, pickupAt, isToday: i === 0 }
  }
  return null
}

// 「周二 9/16 6:00 PM」/「Tue 9/16 6:00 PM」—— 把星期、日期、时间一次说清,
// 客人不用自己推算「周二」是哪天。
function stamp(date, hour, lang) {
  const days = lang === 'zh' ? DAY_ZH : DAY_EN
  const d = days[date.getDay()]
  const md = `${date.getMonth() + 1}/${date.getDate()}`
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${d} ${md} ${hour12}:00 ${ampm}`
}

// 取餐时刻,例:周二 9/16 6:00 PM
export function formatPickupAt(run, lang) {
  return run ? stamp(run.pickupAt, run.pickupAt.getHours(), lang) : ''
}

// 截单时刻,例:周二 9/16 3:00 PM
export function formatCutoffAt(run, lang) {
  return run ? stamp(run.cutoff, run.cutoff.getHours(), lang) : ''
}

export function formatRun(run, lang) {
  if (!run) return ''
  const days = lang === 'zh' ? DAY_ZH : DAY_EN
  const h = run.pickupAt.getHours()
  const hour12 = h > 12 ? h - 12 : h
  const ampm = h >= 12 ? 'PM' : 'AM'
  const time = `${hour12}:00 ${ampm}`
  if (run.isToday) return lang === 'zh' ? `今天 ${time}` : `Today ${time}`
  return lang === 'zh'
    ? `${days[run.date.getDay()]} ${time}`
    : `${days[run.date.getDay()]} ${time}`
}

// 距截单还剩多久 —— 返回 { hours, minutes, expired }
export function timeToCutoff(run, now = new Date()) {
  if (!run) return null
  const ms = run.cutoff - now
  if (ms <= 0) return { hours: 0, minutes: 0, expired: true }
  return {
    hours: Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    expired: false,
  }
}
