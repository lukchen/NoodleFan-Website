// 取餐方式 —— 到店自取 + 定点配送(Allston / Malden)。
//
// 定点配送的玩法:两个点交替跑 —— 周一/周三 Malden,周二/周四 Allston,
// 周五到周日暂不发车。每个点开放最近 OPEN_RUNS 个班次,取餐当天 12:00 截单,
// 满 MIN_ORDERS 单发车,每道菜当天限量 DAILY_LIMIT 份。
// 客人先选取餐点和日期再看菜单 —— 这两项决定了截单时间、剩余份数和是否成团。
//
// 为什么只开两班:再往后客人记不住自己订了哪天,备料也没法提前那么久定量。
//
// ⚠ 送达时间(pickupHour)仍为暂定值,确定后改这里即可,UI 会跟着变。

export const MIN_ORDERS = 5        // 起送单数
export const DAILY_LIMIT = 15      // 每道菜每天备料上限
export const CUTOFF_HOUR = 12      // 取餐当天 12:00 截单
export const OPEN_RUNS = 2         // 每个取餐点开放最近两个班次
export const LOOKAHEAD_DAYS = 21   // 往后最多找这么多天(周五~周日不发车,得跨周找)

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

// days 里的数字是星期几:0=周日 … 6=周六
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
    days: [2, 4],          // 周二、周四
    pickupHour: 18,        // 18:00 送达
  },
  {
    id: 'malden',
    kind: 'dropoff',
    nameZh: 'Malden 取餐点',
    nameEn: 'Malden Pickup Spot',
    areaZh: '300 Pleasant St, Malden, MA 02148(停车场)',
    areaEn: '300 Pleasant St, Malden, MA 02148 (parking lot)',
    days: [1, 3],          // 周一、周三
    pickupHour: 18,        // 18:00 送达
  },
]

export function getPoint(id) {
  return PICKUP_POINTS.find(p => p.id === id) ?? null
}

const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// 本地日期串 YYYY-MM-DD —— 用 toISOString 会按 UTC 折算,东部时间晚上会差一天。
export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeRun(d, point, offset) {
  const cutoff = new Date(d)
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0)
  const pickupAt = new Date(d)
  pickupAt.setHours(point.pickupHour, 0, 0, 0)
  return { key: dateKey(d), date: d, cutoff, pickupAt, offset }
}

// 可订的班次:从明天起,按这个点的班期往后找 OPEN_RUNS 班。
// 不放今天 —— 今天中午就截单了,下午来的客人点进去只会看到一个已经关掉的日期。
// 往后要找到 LOOKAHEAD_DAYS 天:周五到周日不发车,周四之后的下一班要跨到下周一。
export function upcomingRuns(point, now = new Date()) {
  if (!point || point.kind !== 'dropoff') return []
  const runs = []
  for (let i = 1; i <= LOOKAHEAD_DAYS && runs.length < OPEN_RUNS; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    if (!point.days.includes(d.getDay())) continue
    runs.push(makeRun(d, point, i))
  }
  return runs
}

// 默认班次 = 最近那一班。找不到指定日期时也回退到它。
export function nextRun(point, now = new Date()) {
  return upcomingRuns(point, now)[0] ?? null
}

export function findRun(point, key, now = new Date()) {
  const runs = upcomingRuns(point, now)
  return runs.find(r => r.key === key) ?? runs[0] ?? null
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

// 截单时刻,例:周二 9/16 12:00 PM
export function formatCutoffAt(run, lang) {
  return run ? stamp(run.cutoff, run.cutoff.getHours(), lang) : ''
}

// 星期 + 日期,例:「周一 9/28」。
// 不用「明天/后天」—— 客人常常隔天才回来看订单,那时候「明天」指的已经是另一天了;
// 星期加日期是绝对的,写在哪儿、什么时候看都不会错。
export function dayLabel(run, lang) {
  if (!run) return ''
  const days = lang === 'zh' ? DAY_ZH : DAY_EN
  return `${days[run.date.getDay()]} ${run.date.getMonth() + 1}/${run.date.getDate()}`
}

export const formatRunDate = dayLabel

// 「周一 9/28 6:00 PM」—— 吸顶条和购物车里的一行式写法
export function formatRun(run, lang) {
  if (!run) return ''
  const h = run.pickupAt.getHours()
  const hour12 = h > 12 ? h - 12 : h
  return `${dayLabel(run, lang)} ${hour12}:00 ${h >= 12 ? 'PM' : 'AM'}`
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
