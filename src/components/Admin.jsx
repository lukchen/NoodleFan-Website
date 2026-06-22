import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-orders`

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Order status flow
const STATUSES = ['paid', 'preparing', 'ready', 'completed']
const STATUS_LABELS = {
  paid: '待处理',
  preparing: '备餐中',
  ready: '可取餐',
  completed: '已完成',
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Looping "ding-dong" alert via Web Audio — no audio file needed.
function createAlarm() {
  let ctx = null
  let timer = null
  let autoStop = null
  let live = []                 // currently scheduled oscillators
  const MAX_RING_MS = 60000     // auto-silence after 60s even if unacknowledged

  function unlock() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
  }

  function ding(freq, when, dur) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(0.5, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(gain).connect(ctx.destination)
    osc.start(when)
    osc.stop(when + dur)
    osc.onended = () => { live = live.filter(o => o !== osc) }
    live.push(osc)
  }

  function playOnce() {
    if (!ctx || ctx.state !== 'running') return
    const t = ctx.currentTime
    ding(880, t, 0.4)        // ding
    ding(660, t + 0.45, 0.5) // dong
  }

  function start() {
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    if (timer) return
    playOnce()
    timer = setInterval(playOnce, 2000)
    autoStop = setTimeout(stop, MAX_RING_MS)
  }

  // Bulletproof stop: clear timers, hard-stop every scheduled oscillator,
  // and suspend the whole audio context so nothing can keep sounding.
  function stop() {
    if (timer) { clearInterval(timer); timer = null }
    if (autoStop) { clearTimeout(autoStop); autoStop = null }
    live.forEach(o => { try { o.stop() } catch { /* already stopped */ } })
    live = []
    if (ctx && ctx.state === 'running') { try { ctx.suspend() } catch { /* ignore */ } }
  }

  return { unlock, start, stop, isReady: () => !!ctx }
}

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('nf_admin_pw') || '')
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [soundOn, setSoundOn] = useState(false)
  const [alerting, setAlerting] = useState(false)

  const alarm = useRef(null)
  const prevCount = useRef(0)
  if (!alarm.current) alarm.current = createAlarm()

  // Safety: stop ringing if the page is closed/hidden or component unmounts
  useEffect(() => {
    const a = alarm.current
    const onHide = () => { if (document.visibilityState === 'hidden') a.stop() }
    window.addEventListener('pagehide', a.stop)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      a.stop()
      window.removeEventListener('pagehide', a.stop)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [])

  const fetchOrders = useCallback(async (pw, { detectNew = false } = {}) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.status === 401) { setError('密码错误'); setAuthed(false); return }
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      const list = data.orders || []
      // New order detected → raise alert
      if (detectNew && list.length > prevCount.current && alarm.current.isReady()) {
        setAlerting(true)
        alarm.current.start()
      }
      prevCount.current = list.length
      setOrders(list)
      setAuthed(true)
      sessionStorage.setItem('nf_admin_pw', pw)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial auto-login if password saved
  useEffect(() => {
    if (password) fetchOrders(password)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: subscribe to PII-free "new_order" broadcast → instant re-fetch
  useEffect(() => {
    if (!authed) return
    const channel = supabase
      .channel('orders')
      .on('broadcast', { event: 'new_order' }, () => {
        fetchOrders(password, { detectNew: true })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authed, password, fetchOrders])

  // Fallback poll every 30s (belt-and-suspenders in case realtime drops)
  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => fetchOrders(password, { detectNew: true }), 30000)
    return () => clearInterval(id)
  }, [authed, password, fetchOrders])

  function enableSound() {
    alarm.current.unlock()
    setSoundOn(true)
  }

  function acknowledge() {
    alarm.current.stop()
    setAlerting(false)
  }

  async function updateStatus(id, status) {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, id, status }),
    })
  }

  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <h1>粉面王 · 接单后台</h1>
          <form onSubmit={e => { e.preventDefault(); fetchOrders(password) }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="管理员密码"
              autoFocus
            />
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
          {error && <p className="admin-error">{error}</p>}
        </div>
      </div>
    )
  }

  const activeOrders = orders.filter(o => o.status !== 'completed')
  const doneOrders = orders.filter(o => o.status === 'completed')

  return (
    <div className="admin">
      {/* New-order alert banner */}
      {alerting && (
        <div className="admin-alert-banner" onClick={acknowledge}>
          🔔 新订单！点击「确认收到」
          <button className="admin-alert-ack" onClick={acknowledge}>确认收到</button>
        </div>
      )}

      <header className="admin-header">
        <h1>接单后台</h1>
        <div className="admin-header-actions">
          {alerting && (
            <button className="admin-stop-btn" onClick={acknowledge}>🔕 停止响铃</button>
          )}
          <span className="admin-count">{activeOrders.length} 待处理</span>
          {!soundOn ? (
            <button className="admin-sound-btn" onClick={enableSound}>🔔 开启提醒</button>
          ) : (
            <span className="admin-sound-on">🔔 提醒已开</span>
          )}
          <button className="admin-refresh" onClick={() => fetchOrders(password)} disabled={loading}>
            {loading ? '刷新中...' : '↻ 刷新'}
          </button>
        </div>
      </header>

      {!soundOn && (
        <p className="admin-sound-hint">⚠️ 点「开启提醒」后，新订单会响铃提示（手机/电脑都需先点一次）</p>
      )}

      {orders.length === 0 && <p className="admin-empty">暂无订单</p>}

      <div className="admin-orders">
        {[...activeOrders, ...doneOrders].map(order => (
          <div key={order.id} className={`admin-order admin-order--${order.status}`}>
            <div className="admin-order-top">
              <div>
                <span className="admin-order-name">{order.customer_name}</span>
                <span className="admin-order-phone">{order.customer_phone}</span>
              </div>
              <span className={`admin-status-badge admin-status-badge--${order.status}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>

            <div className="admin-order-pickup">
              🕐 取餐 {order.pickup_date} {order.pickup_time}
            </div>

            <ul className="admin-order-items">
              {order.items.map((it, i) => (
                <li key={i}>
                  <span>{it.nameZh} × {it.qty}</span>
                  <span>${(it.price * it.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {order.note && <p className="admin-order-note">备注：{order.note}</p>}

            <div className="admin-order-bottom">
              <span className="admin-order-total">合计 ${Number(order.total).toFixed(2)}</span>
              <span className="admin-order-time">{formatTime(order.created_at)}</span>
            </div>

            <div className="admin-status-buttons">
              {STATUSES.map(s => (
                <button
                  key={s}
                  className={`admin-status-btn${order.status === s ? ' admin-status-btn--active' : ''}`}
                  onClick={() => updateStatus(order.id, s)}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
