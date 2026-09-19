import { useState, useEffect, useCallback } from 'react'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

const FN_URL = `${SUPABASE_URL}/functions/v1/run-dispatch`

// 授权在 Stripe 那边最多挂 7 天,过期自动失效 —— 发了车却没点「扣款」,那批餐就是白送。
const AUTH_DAYS = 7

function daysLeft(oldestAuthorizedAt) {
  if (!oldestAuthorizedAt) return null
  const expire = new Date(oldestAuthorizedAt).getTime() + AUTH_DAYS * 86400000
  return Math.floor((expire - Date.now()) / 86400000)
}

function fmtRunDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  const wk = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]
  return `${m}/${day} ${wk}`
}

// 发车结算台 —— 定点配送的钱只有走完这里才真正到账。
// 下单时只做了授权(钱冻在客人卡上),这个面板是唯一把它变成「扣款」或「解冻」的地方。
export default function RunBoard({ password }) {
  const [runs, setRuns] = useState([])
  const [minOrders, setMinOrders] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)        // `${point}|${runDate}` 正在结算
  const [confirming, setConfirming] = useState(null)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '读取失败')
      setRuns(data.runs ?? [])
      setMinOrders(data.minOrders ?? 5)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => { load() }, [load])

  async function dispatch(run, action) {
    const key = `${run.point}|${run.runDate}`
    setBusy(key)
    setConfirming(null)
    setResult(null)
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ password, point: run.point, runDate: run.runDate, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '结算失败')
      setResult({ action, ...data })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (loading && runs.length === 0) return <p className="runboard-empty">读取班次…</p>

  return (
    <section className="runboard">
      <div className="runboard-head">
        <h2>发车结算</h2>
        <button className="admin-refresh" onClick={load} disabled={loading}>
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      {result && (
        <div className={`runboard-result${result.failed > 0 ? ' runboard-result--warn' : ''}`}>
          <strong>
            {result.action === 'capture' ? '已扣款' : '已解除冻结'} {result.succeeded}/{result.total} 单
          </strong>
          {result.failed > 0 && (
            <ul className="runboard-fails">
              {result.results.filter(r => !r.ok).map(r => (
                <li key={r.id}>取餐码 {r.code ?? '—'}:{r.error}</li>
              ))}
            </ul>
          )}
          <button onClick={() => setResult(null)}>知道了</button>
        </div>
      )}

      {runs.length === 0 && <p className="runboard-empty">当前没有待结算的班次。</p>}

      {runs.map(run => {
        const key = `${run.point}|${run.runDate}`
        const left = Math.max(0, minOrders - run.orders)
        const dl = daysLeft(run.oldestAuthorizedAt)
        const expiring = dl !== null && dl <= 2
        return (
          <article key={key} className={`run-card${run.ready ? ' run-card--ready' : ''}`}>
            <div className="run-card-top">
              <span className="run-card-name">📍 {run.pointName ?? run.point}</span>
              <span className="run-card-date">{fmtRunDate(run.runDate)}</span>
              <span className="run-card-amount">${run.amount.toFixed(2)}</span>
            </div>

            <div className="run-card-progress">
              <span className="run-dots" aria-hidden="true">
                {Array.from({ length: Math.max(minOrders, run.orders) }, (_, i) => (
                  <i key={i} className={i < run.orders ? 'on' : ''} />
                ))}
              </span>
              <span className={`run-card-count${run.ready ? ' run-card-count--ready' : ''}`}>
                {run.ready ? `✅ 已成团 ${run.orders} 单` : `${run.orders}/${minOrders} 单 · 还差 ${left}`}
              </span>
            </div>

            {/* 授权过期 = 白送餐,所以剩 2 天以内就红字顶在按钮上面 */}
            {dl !== null && (
              <p className={`run-card-expiry${expiring ? ' run-card-expiry--warn' : ''}`}>
                {dl < 0
                  ? '⚠️ 授权可能已过期,扣款会失败 —— 请立即处理'
                  : `授权还剩 ${dl} 天(${AUTH_DAYS} 天后自动失效)`}
              </p>
            )}

            {confirming === key + '|capture' ? (
              <div className="run-confirm">
                <span>确认向 {run.orders} 位客人扣款 ${run.amount.toFixed(2)}?扣款后不可撤销。</span>
                <button className="run-btn run-btn--go" onClick={() => dispatch(run, 'capture')}>确认扣款</button>
                <button className="run-btn" onClick={() => setConfirming(null)}>取消</button>
              </div>
            ) : confirming === key + '|cancel' ? (
              <div className="run-confirm">
                <span>确认取消这一班?{run.orders} 位客人的冻结会全部解除,零扣费。</span>
                <button className="run-btn run-btn--stop" onClick={() => dispatch(run, 'cancel')}>确认取消</button>
                <button className="run-btn" onClick={() => setConfirming(null)}>返回</button>
              </div>
            ) : (
              <div className="run-card-actions">
                <button
                  className="run-btn run-btn--go"
                  disabled={busy === key}
                  onClick={() => setConfirming(key + '|capture')}>
                  {busy === key ? '处理中…' : `发车 · 扣款 ${run.orders} 单`}
                </button>
                <button
                  className="run-btn run-btn--stop"
                  disabled={busy === key}
                  onClick={() => setConfirming(key + '|cancel')}>
                  未成团 · 解除冻结
                </button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
