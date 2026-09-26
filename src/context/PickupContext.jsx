import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getPoint, upcomingRuns, findRun, MIN_ORDERS, DAILY_LIMIT } from '../pickup'

const PickupContext = createContext(null)

const STORAGE_KEY = 'nf-pickup-point'
const RUN_KEY = 'nf-pickup-run'

// 取餐方式的全局状态。客人选定后记住,下次进站不用再选。
//
// TODO(后端): ordersSoFar / soldByDish 现在恒为 0 —— 要显示真实的「已 3/5 单」和
// 「仅剩 4 份」,需要一个按取餐点+日期聚合当日订单的 Edge Function。接上之前
// 进度条显示 0/5,余量标签不显示(15 份都还在),都是真实值,不会误导客人。
export function PickupProvider({ children }) {
  const [pointId, setPointId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
  })
  // 客人订的是哪一天(YYYY-MM-DD)。定点配送每天都跑,日期和取餐点一样是这一单的前提:
  // 它决定截单时刻、当天备料份数和跟谁凑单。
  const [runKey, setRunKey] = useState(() => {
    try { return localStorage.getItem(RUN_KEY) || null } catch { return null }
  })
  // 每分钟走一次,让倒计时动起来
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      if (pointId) localStorage.setItem(STORAGE_KEY, pointId)
      else localStorage.removeItem(STORAGE_KEY)
    } catch { /* 隐私模式下写不进去,不影响使用 */ }
  }, [pointId])

  useEffect(() => {
    try {
      if (runKey) localStorage.setItem(RUN_KEY, runKey)
      else localStorage.removeItem(RUN_KEY)
    } catch { /* 隐私模式 */ }
  }, [runKey])

  // 客人点「更换」时置 true,菜单区会换回选择界面。放在 context 里是因为
  // 触发点(购物车面板、抽屉)和响应点(MenuSection)隔得很远。
  const [changing, setChanging] = useState(false)
  function startChange() {
    setChanging(true)
    requestAnimationFrame(() => {
      const el = document.getElementById('menu')
      if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' })
    })
  }

  const point = getPoint(pointId)
  // 开放的两天。隔天自然往后滑 —— 存在 localStorage 里的旧日期会被 findRun 兜回最近一班,
  // 客人昨天选的「明天」今天不会变成一个已经发过车的日期。
  const runs = useMemo(() => upcomingRuns(point, now), [point, now])
  const run = useMemo(() => (point?.kind === 'dropoff' ? findRun(point, runKey, now) : null), [point, runKey, now])

  function choose(id, key = null) {
    setPointId(id)
    setRunKey(key)
  }

  const value = {
    pointId, setPointId, choose,
    runs, runKey: run?.key ?? null, setRunKey,
    changing, startChange, endChange: () => setChanging(false),
    point, run, now,
    clearPoint: () => setPointId(null),
    ordersSoFar: 0,
    minOrders: MIN_ORDERS,
    dailyLimit: DAILY_LIMIT,
    soldByDish: {},
    remainingFor: () => DAILY_LIMIT,
  }

  return <PickupContext.Provider value={value}>{children}</PickupContext.Provider>
}

export function usePickup() {
  const ctx = useContext(PickupContext)
  if (!ctx) throw new Error('usePickup must be used within PickupProvider')
  return ctx
}
