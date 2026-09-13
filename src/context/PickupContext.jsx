import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getPoint, nextRun, MIN_ORDERS, DAILY_LIMIT } from '../pickup'

const PickupContext = createContext(null)

const STORAGE_KEY = 'nf-pickup-point'

// 取餐方式的全局状态。客人选定后记住,下次进站不用再选。
//
// TODO(后端): ordersSoFar / soldByDish 现在恒为 0 —— 要显示真实的「已 3/5 单」和
// 「仅剩 4 份」,需要一个按取餐点+日期聚合当日订单的 Edge Function。接上之前
// 进度条显示 0/5,余量标签不显示(15 份都还在),都是真实值,不会误导客人。
export function PickupProvider({ children }) {
  const [pointId, setPointId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
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

  const point = getPoint(pointId)
  const run = useMemo(() => nextRun(point, now), [point, now])

  const value = {
    pointId, setPointId,
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
