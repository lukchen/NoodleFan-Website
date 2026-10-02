import { useState, useEffect, useCallback, useRef } from 'react'
import RunBoard from './RunBoard'
import Stats from './Stats'
import MenuAdmin from './MenuAdmin'
import '../runboard.css'
import '../admin.css'
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

// 哪些状态要二次确认,以及确认框里说什么。
// 只拦有外部后果的两步 —— 一个会发邮件,一个是收尾。
const NEEDS_CONFIRM = {
  ready: {
    title: '确认通知客人来取餐？',
    warn: <>点确认会<strong>立刻给客人发一封「餐已做好」邮件</strong>。邮件发出去就收不回来了,客人会直接过来。</>,
    ok: '确认,通知客人',
  },
  completed: {
    title: '确认这单已经交到客人手上？',
    warn: <>点确认这单就从待处理里移走,不再提醒你。<strong>确认前请先核对取餐码</strong> —— 标错了就没人盯着这份餐了。</>,
    ok: '确认,已交付',
  },
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
  const [tab, setTab] = useState('store')   // store = 到店自取 | group = 团餐预约 | menu = 菜单 | stats = 数据
  // 两个按钮要二次确认:
  //   待取餐 —— 会立刻给客人发邮件,发出去收不回来,客人会直接过来
  //   已完成 —— 收尾动作,点了这单就从待处理里消失,漏发的餐没人再盯着
  // 备餐中不拦:点错了改回来就行,而且厨房忙起来每步弹窗很烦。
  // 存 { order, status },null 表示没有待确认的。
  const [confirming, setConfirming] = useState(null)

  const prevCount = useRef(0)

  const fetchOrders = useCallback(async (pw, { detectNew = false } = {}) => {
    setLoading(true)
    setError('')
    try {
      // apikey / Authorization 必须带 —— Supabase 网关对所有 Edge Function 调用都要求
      // 带 anon key,哪怕函数自己 verify_jwt 是关的。漏了就是网关层 401,
      // 和「密码错」长得一模一样,查起来很费劲(就吃过这个亏)。
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
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

  // 新单响铃 —— 厨房忙起来没人盯屏幕,只有横幅是会漏单的。
  // 不用音频文件:图片/音频推不进这个仓库的部署流程,而且 WebAudio 合成的「叮咚」
  // 不用等下载、离线也响。浏览器要求先有用户手势才能出声 —— 店员是点「登录」进来的,
  // 那一下就是手势,AudioContext 能正常启动。
  useEffect(() => {
    if (!alerting) return
    let ctx
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch { return }

    function ding() {
      if (ctx.state === 'suspended') ctx.resume()
      // 两声一高一低,比单音更容易从厨房噪音里分辨出来
      ;[[880, 0], [1320, 0.18]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const t0 = ctx.currentTime + delay
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + 0.4)
      })
    }

    ding()
    // 一直响到店员点「知道了」—— 响一次就停的话,离开两分钟回来照样不知道有新单
    const id = setInterval(ding, 3000)
    return () => { clearInterval(id); ctx.close().catch(() => {}) }
  }, [alerting])

  function acknowledge() {
    setAlerting(false)
  }

  async function updateStatus(id, status) {
    // 先乐观更新,点下去立刻有反馈 —— 但请求失败必须回滚。
    // 不回滚的话:界面写着「待取餐」,库里还是「备餐中」,客人那边也没收到邮件,
    // 而你以为已经通知过了。
    const prev = orders.find(o => o.id === id)?.status
    setOrders(list => list.map(o => o.id === id ? { ...o, status } : o))
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ password, id, status }),
      })
      if (!res.ok) throw new Error(res.status === 401 ? '密码错误' : `改状态失败 (${res.status})`)
      setError('')
    } catch (e) {
      if (prev) setOrders(list => list.map(o => o.id === id ? { ...o, status: prev } : o))
      setError(e.message || '改状态失败,请重试')
    }
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
                onClick={() => NEEDS_CONFIRM[st]
                  ? setConfirming({ order, status: st })
                  : updateStatus(order.id, st)}>
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
        <button
          className={`admin-tab${tab === 'menu' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('menu')}>
          菜单
        </button>
        <button
          className={`admin-tab${tab === 'stats' ? ' admin-tab--active' : ''}`}
          onClick={() => setTab('stats')}>
          数据
        </button>
      </div>

      {/* 挂载时才去拉数据 —— 聚合要扫全表,没人看的时候不该每次刷新订单都跟着跑一遍 */}
      {tab === 'menu' && <MenuAdmin password={password} />}
      {tab === 'stats' && <Stats password={password} />}

      {tab === 'store' && (
        <div className="admin-orders">
          {storeOrders.length === 0
            ? <p className="admin-empty">暂无到店自取订单</p>
            : sortActive(storeOrders).map(renderOrder)}
        </div>
      )}

      {confirming && (
        <div className="admin-confirm-overlay" onClick={() => setConfirming(null)}>
          <div className="admin-confirm" onClick={e => e.stopPropagation()}>
            <h3>{NEEDS_CONFIRM[confirming.status].title}</h3>
            <p className="admin-confirm-who">
              {confirming.order.customer_name}
              {confirming.order.pickup_code && <span> · 取餐码 {confirming.order.pickup_code}</span>}
            </p>
            <p className="admin-confirm-warn">{NEEDS_CONFIRM[confirming.status].warn}</p>
            <div className="admin-confirm-actions">
              <button className="admin-confirm-cancel" onClick={() => setConfirming(null)}>
                取消
              </button>
              <button
                className="admin-confirm-ok"
                onClick={() => {
                  updateStatus(confirming.order.id, confirming.status)
                  setConfirming(null)
                }}>
                {NEEDS_CONFIRM[confirming.status].ok}
              </button>
            </div>
          </div>
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
