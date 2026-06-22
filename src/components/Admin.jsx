import { useState, useEffect, useCallback } from 'react'
import { SUPABASE_URL } from '../config'

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-orders`

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

export default function Admin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('nf_admin_pw') || '')
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchOrders = useCallback(async (pw) => {
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
      setOrders(data.orders || [])
      setAuthed(true)
      sessionStorage.setItem('nf_admin_pw', pw)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-login if password saved in session
  useEffect(() => {
    if (password) fetchOrders(password)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll every 20s while authed
  useEffect(() => {
    if (!authed) return
    const id = setInterval(() => fetchOrders(password), 20000)
    return () => clearInterval(id)
  }, [authed, password, fetchOrders])

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
      <header className="admin-header">
        <h1>接单后台</h1>
        <div className="admin-header-actions">
          <span className="admin-count">{activeOrders.length} 待处理</span>
          <button className="admin-refresh" onClick={() => fetchOrders(password)} disabled={loading}>
            {loading ? '刷新中...' : '↻ 刷新'}
          </button>
        </div>
      </header>

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
