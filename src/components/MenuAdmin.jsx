import { useState, useEffect, useCallback } from 'react'
import menu, { categories } from '../data/menu'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import '../menuadmin.css'

const FN_URL = `${SUPABASE_URL}/functions/v1/menu-settings`
const DEFAULT_CAP = 15

// 后台「菜单」标签 —— 不改菜名和价格(那些在代码里的 menu.js,改动要走部署),
// 只管三件每天都会变的事:
//   上架     —— 关掉这道菜就从菜单上消失(季节菜、不做了的菜)
//   今日售罄 —— 菜还在菜单上但置灰。比「凭空消失」好:客人知道这家有,明天再来。
//               第二天自动恢复,不用记得回来关。
//   每班备料 —— 团餐每班这道菜备几份,默认 15。到店自取现做现卖,不受限。
export default function MenuAdmin({ password }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)   // 正在保存的 dishId
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '读取失败')
      setSettings(json.settings ?? {})
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const statusOf = (id) => settings[id] ?? { listed: true, soldOutToday: false, cap: DEFAULT_CAP }

  async function save(dishId, changes) {
    // 先改界面再发请求 —— 厨房里手上沾着面,点一下要立刻有反应。
    // 失败了再回滚并说清楚,不要让人对着一个没反应的开关连点五次。
    const before = statusOf(dishId)
    setSettings(s => ({ ...s, [dishId]: { ...before, ...changes } }))
    setSaving(dishId)
    setError('')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ password, dishId, ...changes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '保存失败')
    } catch (e) {
      setSettings(s => ({ ...s, [dishId]: before }))
      setError(`${e.message} —— 这一项没改成`)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="ma-empty">读取中…</p>

  const sections = categories
    .map(c => ({ ...c, dishes: menu.filter(d => d.category === c.id) }))
    .filter(c => c.dishes.length > 0)

  return (
    <div className="menu-admin">
      {error && <p className="ma-error">{error}</p>}

      <p className="ma-hint">
        菜名、价格、图片在代码里，改动要走部署。这里只管每天会变的三件事。
        「今日售罄」第二天早上自动恢复。
      </p>

      {sections.map(c => (
        <section key={c.id} className="ma-section">
          <h3 className="ma-section-head">{c.nameZh}</h3>
          {c.dishes.map(d => {
            const st = statusOf(d.id)
            const busy = saving === d.id
            return (
              <div key={d.id} className={`ma-row${st.listed ? '' : ' ma-row--off'}`}>
                <span className="ma-name">
                  {d.nameZh}
                  <span className="ma-price">${d.price.toFixed(2)}</span>
                </span>

                <label className="ma-check">
                  <input
                    type="checkbox"
                    checked={st.listed}
                    disabled={busy}
                    onChange={e => save(d.id, { listed: e.target.checked })}
                  />
                  上架
                </label>

                <label className="ma-check">
                  <input
                    type="checkbox"
                    checked={st.soldOutToday}
                    disabled={busy || !st.listed}
                    onChange={e => save(d.id, { soldOutToday: e.target.checked })}
                  />
                  今日售罄
                </label>

                <label className="ma-cap">
                  每班备
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={st.cap}
                    disabled={busy || !st.listed}
                    // 改完离开输入框才保存 —— 边打字边存的话,
                    // 想输 15 会在只打了「1」的瞬间先把备料数存成 1。
                    onChange={e => setSettings(s => ({ ...s, [d.id]: { ...st, cap: e.target.value } }))}
                    onBlur={e => {
                      const cap = parseInt(e.target.value, 10)
                      if (Number.isInteger(cap) && cap >= 0 && cap !== statusOf(d.id).cap) save(d.id, { cap })
                      else if (!Number.isInteger(cap)) setSettings(s => ({ ...s, [d.id]: { ...st, cap: DEFAULT_CAP } }))
                    }}
                  />
                  份
                </label>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
