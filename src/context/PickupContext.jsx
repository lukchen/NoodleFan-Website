import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { getPoint, upcomingRuns, findRun, dateKey, MIN_ORDERS, DAILY_LIMIT } from '../pickup'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

const PickupContext = createContext(null)

const STORAGE_KEY = 'nf-pickup-point'
const RUN_KEY = 'nf-pickup-run'
const SAVED_AT_KEY = 'nf-pickup-saved-at'

// 选择只在这段时间内有效,过了就当没选过,重新问一遍。
//
// 为什么要有期限:取餐点和日期是这一单的前提,不是客人的个人偏好。
// 永久记住的话,他上周四选了 Allston 周二那班,今天中午想买个烧饼当午饭,
// 一进来页面已经替他定成「Allston 周二 6PM」—— 他得先看懂顶上那条小字、
// 再找到「更换」,才能改回到店自取。沉默地替客人做决定,比多问一次糟得多。
//
// 30 分钟是按「一次点餐」来定的:选点、翻菜单、加菜、填表、付款,中间被打断
// 接个电话也够。超过这个长度基本就是下一次来了。
const FRESH_MS = 30 * 60 * 1000

// 读上次的选择 —— 过期就连带清掉,免得下次又拿到一份陈的。
function loadSaved() {
  try {
    const at = Number(localStorage.getItem(SAVED_AT_KEY) || 0)
    if (!at || Date.now() - at > FRESH_MS) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(RUN_KEY)
      localStorage.removeItem(SAVED_AT_KEY)
      return { pointId: null, runKey: null }
    }
    return {
      pointId: localStorage.getItem(STORAGE_KEY) || null,
      runKey: localStorage.getItem(RUN_KEY) || null,
    }
  } catch {
    return { pointId: null, runKey: null }   // 隐私模式下读不到,当没选过
  }
}

// 取餐方式的全局状态。客人选定后在 FRESH_MS 内记住,同一次点餐不用反复选。
//
// 已售份数来自 run-stats(按取餐点 + 发车日聚合)。拿不到的时候一律当「还没卖」
// 处理 —— 备料上限的真正防线在 create-checkout 里,那边下单时会再查一次并拒单。
// 前端这份只负责别让客人白填一遍表。
export function PickupProvider({ children }) {
  // 只在组件第一次挂载时读一次,之后以内存里的状态为准 —— 别在渲染里反复读
  // localStorage,那是同步 IO。
  const saved = useMemo(loadSaved, [])

  const [pointId, setPointId] = useState(saved.pointId)
  // 客人订的是哪一天(YYYY-MM-DD)。定点配送每天都跑,日期和取餐点一样是这一单的前提:
  // 它决定截单时刻、当天备料份数和跟谁凑单。
  const [runKey, setRunKey] = useState(saved.runKey)
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

  // ── 这一班已经卖掉多少 ──────────────────────────────────────────────
  // 每道菜每班只备 DAILY_LIMIT 份。不查的话第 16 个人照样能下单付钱,
  // 到取餐那天才发现没货,只能退款道歉。
  const [sold, setSold] = useState({})

  const point = getPoint(pointId)
  // 开放的两天。隔天自然往后滑 —— 存在 localStorage 里的旧日期会被 findRun 兜回最近一班,
  // 客人昨天选的「明天」今天不会变成一个已经发过车的日期。
  const runs = useMemo(() => upcomingRuns(point, now), [point, now])
  const run = useMemo(() => (point?.kind === 'dropoff' ? findRun(point, runKey, now) : null), [point, runKey, now])

  function choose(id, key = null) {
    setPointId(id)
    setRunKey(key)
    // 有效期从「做出选择」那一刻算起,不是从「上次打开网站」算 ——
    // 否则一个每隔二十分钟刷一次页面的人,永远不会被问第二次。
    try { localStorage.setItem(SAVED_AT_KEY, String(Date.now())) } catch { /* 隐私模式 */ }
  }

  // 换取餐点/换日期立刻重查;之后每分钟刷一次,让「仅剩 N 份」跟得上别人下单。
  const runDate = run ? dateKey(run.date) : null
  useEffect(() => {
    if (point?.kind !== 'dropoff' || !runDate) { setSold({}); return }
    let alive = true
    async function load() {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/run-stats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ pointId: point.id, runDate }),
        })
        if (!res.ok) throw new Error('run-stats failed')
        const data = await res.json()
        if (alive) setSold(data.dishes ?? {})
      } catch {
        // 查不到就当还没卖 —— 宁可让客人下到单被服务端拦下,也不要把在售的菜
        // 误标成「已订满」把生意推走。
        if (alive) setSold({})
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [point?.kind, point?.id, runDate])

  // 这道菜这一班还能订几份。到店自取现做现卖,不限量。
  const remainingFor = useCallback((dishId) => {
    if (point?.kind !== 'dropoff') return DAILY_LIMIT
    return Math.max(0, DAILY_LIMIT - (sold[dishId] ?? 0))
  }, [point?.kind, sold])

  const value = {
    pointId, setPointId, choose,
    runs, runKey: run?.key ?? null, setRunKey,
    changing, startChange, endChange: () => setChanging(false),
    point, run, now,
    clearPoint: () => setPointId(null),
    minOrders: MIN_ORDERS,
    dailyLimit: DAILY_LIMIT,
    soldByDish: sold,
    remainingFor,
  }

  return <PickupContext.Provider value={value}>{children}</PickupContext.Provider>
}

export function usePickup() {
  const ctx = useContext(PickupContext)
  if (!ctx) throw new Error('usePickup must be used within PickupProvider')
  return ctx
}
