import { useState, useEffect, useCallback, useRef } from 'react'
import RunBoard from './RunBoard'
import '../runboard.css'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-orders`

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 备餐流程(钱已到账之后才走)
const STATUSES = ['paid', 'preparing', 'ready', 'completed']
const STATUS_LABELS = {
  authorized: '已授权 · 未扣款',
  paid: '待处理',
  preparing: '备餐中',
  ready: '可取餐',
  completed: '已完成',
  cancelled_no_run: '未成团 · 已取消',
}

// 团餐订单在截单结算前钱还没到账,这时候按「备餐中」没有意义,
// 更危险的是会把 status 改成 paid —— 库里写着已付款,Stripe 那边其实一分没扣。
const SETTLED = (s) => s !== 'authorized' && s !== 'cancelled_no_run'

function fmtRunDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  return `${m}/${day} ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()]}`
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
  const [alerting, setAlerting] = useState(false)
  const [tab, setTab] = useState('store')   // store = 到店自取 | group = 团餐预约

  const prevCount = useRef(0)

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
      // New order detected → show visual banner (no sound)
      if (detectNew && list.length > prevCount.current) {
        setAlerting(true)
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
      // Fee/net backfill finished server-side → refresh silently (no new-order banner)
      // so "计算中…" flips to the real numbers within ~1s instead of waiting on the poll.
      .on('broadcast', { event: 'order_updated' }, () => {
        fetchOrders(password)
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

  function acknowledge() {
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

  // 两条完全不同的业务线:到店自取是实时单(钱已到账,马上备餐),
  // 团餐是预约单(钱还冻着,按班次成团后才结算)。混在一张列表里看不清楚,所以分开。
  const storeOrders = orders.filter(o => !o.run_date)
  const groupOrders = orders.filter(o => !!o.run_date)

  const sortActive = (list) => [
    ...list.filter(o => o.status !== 'completed' && o.status !== 'cancelled_no_run'),
    ...list.filter(o => o.status === 'completed' || o.status === 'cancelled_no_run'),
  ]

  const storeTodo = storeOrders.filter(o => o.status !== 'completed').length
  const groupTodo = groupOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled_no_run').length

  // 团餐按「取餐点 + 发车日」分组 —— 备餐和送货都是按班次来的
  const groupRuns = []
  for (const o of sortActive(groupOrders)) {
    const k = `${o.pickup_point}|${o.run_date}`
    let g = groupRuns.find(x => x.key === k)
    if (!g) {
      g = { key: k, name: o.pickup_point_name || o.pickup_point, runDate: o.run_date, orders: [] }
      groupRuns.push(g)
    }
    g.orders.push(o)
  }
  groupRuns.sort((a, b) => (a.runDate < b.runDate ? -1 : 1))

  function renderOrder(order) {
    const settled = SETTLED(order.status)
    return (
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
          <span>取餐 {order.pickup_date} {order.pickup_time}</span>
          {order.pickup_code && <span className="admin-order-code">取餐码 {order.pickup_code}</span>}
        </div>

        <ul className="admin-order-items">
          {order.items.map((it, i) => (
            <li key={i}>
              <span>
                {it.nameZh} × {it.qty}
                {it.optionsZh?.length > 0 && <span className="admin-order-item-opts"> ({it.optionsZh.join('、')})</span>}
              </span>
              <span>${(it.price * it.qty).toFixed(2)}</span>
            </li>
          ))}
        </ul>

        {order.note && <p className="admin-order-note">备注：{order.note}</p>}

        <div className="admin-order-summary">
          <div className="admin-order-bottom">
            <span className="admin-order-total">合计 ${Number(order.total).toFixed(2)}</span>
            <span className="admin-order-time">{formatTime(order.created_at)}</span>
          </div>
          {!settled ? null : order.stripe_fee != null ? (
            <div className="admin-order-fees">
              <span>手续费 −${Number(order.stripe_fee).toFixed(2)}</span>
              <span className="admin-order-net">净收入 ${Number(order.net_income).toFixed(2)}</span>
            </div>
          ) : (
            <div className="admin-order-fees admin-order-fees--pending">手续费计算中…</div>
          )}
        </div>

        {/* 钱还没扣就没有备餐流程可走;取消掉的更不用管 */}
        {order.status === 'authorized' && (
          <p className="admin-order-hold">款项已冻结,等截单结算后再备餐。</p>
        )}
        {order.status === 'cancelled_no_run' && (
          <p className="admin-order-hold">未成团已解除冻结,客人零扣费 —— 记得在群里通知。</p>
        )}
        {settled && (
          <div className="admin-status-buttons">
            {STATUSES.map(st => (
              <button
                key={st}
                className={`admin-status-btn${order.status === st ? ' admin-status-btn--active' : ''}`}
                onClick={() => updateStatus(order.id, st)}>
                {STATUS_LABELS[st]}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="admin">
      {/* New-order alert banner (visual only) */}
      {alerting && (
        <div className="admin-alert-banner" onClick={acknowledge}>
          有新订单！
          <button className="admin-alert-ack" onClick={acknowledge}>知道了</button>
        </div>
      )}

      <header className="admin-header">
        <h1>接单后台</h1>
        <div className="admin-header-actions">
          <span className="admin-count">{storeTodo + groupTodo} 待处理</span>
          <button className="admin-refresh" onClick={() => fetchOrders(password)} disabled={loading}>
            {loading ? '刷新中...' : '↻ 刷新'}
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab${tab === 'store' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('store')}>
          到店自取 <span className="admin-tab-count">{storeTodo}</span>
        </button>
        <button
          className={`admin-tab${tab === 'group' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('group')}>
          团餐预约 <span className="admin-tab-count">{groupTodo}</span>
        </button>
      </div>

      {tab === 'store' && (
        <div className="admin-orders">
          {storeOrders.length === 0
            ? <p className="admin-empty">暂无到店自取订单</p>
            : sortActive(storeOrders).map(renderOrder)}
        </div>
      )}

      {tab === 'group' && (
        <>
          {/* 团餐的钱卡在「已授权」上,不结算不会到账 —— 所以放在订单之前 */}
          <RunBoard password={password} />

          {groupRuns.length === 0 && <p className="admin-empty">暂无团餐预约订单</p>}
          {groupRuns.map(g => (
            <section key={g.key} className="admin-run-group">
              <h3 className="admin-run-group-head">
                {g.name} · {fmtRunDate(g.runDate)}
                <span className="admin-run-group-count">{g.orders.length} 单</span>
              </h3>
              <div className="admin-orders">{g.orders.map(renderOrder)}</div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
