import { useState, useEffect, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import '../stats.css'

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-stats`

// 时间窗。默认 30 天 —— 7 天容易被一两个好日子带偏,90 天又看不出最近的变化。
const RANGES = [
  { days: 7,  label: '近 7 天' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' },
  { days: 0,  label: '全部' },
]

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const money = (n) => `$${Number(n ?? 0).toFixed(2)}`

// 日期串 YYYY-MM-DD 自己切,别交给 new Date() —— 它会按 UTC 解析,
// 美东时间会整体往前错一天。
function shortDate(key) {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}

// 横条。比例按这一组里的最大值,不是按总和 —— 看的是「谁比谁多」。
function Bars({ rows, labelOf, valueOf, noteOf, empty }) {
  if (!rows.length) return <p className="stats-empty">{empty}</p>
  const max = Math.max(...rows.map(valueOf), 1)
  return (
    <ul className="stats-bars">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="stats-bar-label">{labelOf(r)}</span>
          <span className="stats-bar-track">
            <span className="stats-bar-fill" style={{ width: `${(valueOf(r) / max) * 100}%` }} />
          </span>
          <span className="stats-bar-value">{noteOf(r)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Stats({ password }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (d) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ password, days: d }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '读取失败')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => { load(days) }, [load, days])

  if (error) return <p className="stats-error">读不到数据:{error}</p>
  if (!data) return <p className="stats-empty">{loading ? '读取中…' : ''}</p>

  const { summary: s, byDay, byWeekday, byPoint, dishes } = data
  const hasData = s.orders > 0

  return (
    <div className="stats">
      <div className="stats-ranges">
        {RANGES.map(r => (
          <button
            key={r.days}
            className={`stats-range${days === r.days ? ' stats-range--active' : ''}`}
            onClick={() => setDays(r.days)}>
            {r.label}
          </button>
        ))}
        {loading && <span className="stats-loading">读取中…</span>}
      </div>

      {!hasData && <p className="stats-empty">这段时间还没有成交订单。</p>}

      {hasData && (
        <>
          {/* 大盘。到手 = 营收 − 手续费 − 代收的税:税是替州里收的,
              不剔掉会让人把它当成利润。 */}
          <section className="stats-cards">
            <div className="stats-card">
              <span className="stats-card-label">成交单数</span>
              <strong className="stats-card-value">{s.orders}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-card-label">营收（含税）</span>
              <strong className="stats-card-value">{money(s.revenue)}</strong>
            </div>
            <div className="stats-card">
              <span className="stats-card-label">客单价</span>
              <strong className="stats-card-value">{money(s.avgTicket)}</strong>
            </div>
            <div className="stats-card stats-card--accent">
              <span className="stats-card-label">到手</span>
              <strong className="stats-card-value">{money(s.takeHome)}</strong>
              <span className="stats-card-note">
                已扣手续费 {money(s.fees)} 和代收税 {money(s.tax)}
              </span>
            </div>
          </section>

          {(s.authorizedCount > 0 || s.cancelledCount > 0) && (
            <p className="stats-pending">
              {s.authorizedCount > 0 && (
                <span>
                  在途:<strong>{s.authorizedCount}</strong> 单团餐已下单、钱还冻着没扣（{money(s.authorizedAmount)}），
                  截单结算后才会算进上面的营收。
                </span>
              )}
              {s.cancelledCount > 0 && (
                <span>
                  {' '}未成团取消:<strong>{s.cancelledCount}</strong> 单（{money(s.cancelledAmount)}）—— 这是因为没凑够 5 单而流失的生意。
                </span>
              )}
            </p>
          )}

          <section className="stats-section">
            <h3>每天的单量</h3>
            <Bars
              rows={byDay}
              labelOf={r => shortDate(r.date)}
              valueOf={r => r.orders}
              noteOf={r => `${r.orders} 单 · ${money(r.revenue)}`}
              empty="还没有数据"
            />
          </section>

          <section className="stats-section">
            <h3>哪道菜好卖</h3>
            <Bars
              rows={dishes}
              labelOf={r => r.name}
              valueOf={r => r.qty}
              noteOf={r => `${r.qty} 份 · ${money(r.revenue)}`}
              empty="还没有数据"
            />
          </section>

          <div className="stats-two">
            <section className="stats-section">
              <h3>哪个取餐点</h3>
              <Bars
                rows={byPoint}
                labelOf={r => r.name}
                valueOf={r => r.orders}
                noteOf={r => `${r.orders} 单 · ${money(r.revenue)}`}
                empty="还没有数据"
              />
            </section>

            <section className="stats-section">
              <h3>星期几下单多</h3>
              {/* 零的那天也留着 —— 「周日没人下单」本身就是信息,
                  按单量排序把它藏起来反而看不出来。 */}
              <Bars
                rows={byWeekday}
                labelOf={r => WEEKDAY[r.weekday]}
                valueOf={r => r.orders}
                noteOf={r => `${r.orders} 单 · ${money(r.revenue)}`}
                empty="还没有数据"
              />
            </section>
          </div>

          <p className="stats-note">
            口径：未付款的结账草稿不算订单；未成团取消的单不计营收；团餐在截单扣款前算「在途」。
            菜品按下单时的名字统计，所以改名或下架不会改写历史。
          </p>
        </>
      )}
    </div>
  )
}
