import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import LangToggle from './LangToggle'
import Footer from './Footer'
import { useCart } from '../context/CartContext'
import { FORM_KEY } from './Checkout'
import { WechatModal } from './WechatNav'
import { qrValid } from '../wechat-qr'
import '../orderstatus.css'

const FN_URL = `${SUPABASE_URL}/functions/v1/order-status`
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Customer-facing order progression (mirrors the kitchen's status flow).
const STEPS = ['paid', 'preparing', 'ready', 'completed']

export default function OrderStatus({ sessionId, t, lang, setLang }) {
  const { clearCart } = useCart()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [wechatOpen, setWechatOpen] = useState(false)
  const s = t.orderStatus

  // 这个页面就是客人的小票 —— session_id 是查单的唯一钥匙,客人一关浏览器就找不回来了。
  // 所以给一条能复制的完整链接,让他发给自己存着。
  const orderUrl = `${window.location.origin}${window.location.pathname}?session_id=${sessionId}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(orderUrl)
    } catch {
      // clipboard API 在部分内置浏览器(微信、Instagram)里不可用,退回选中输入框再 copy
      const el = document.getElementById('os-link-input')
      if (el) { el.select(); try { document.execCommand('copy') } catch { /* 最后只能让他手动长按复制 */ } }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (data.order) { setOrder(data.order); setLoading(false); return true }
    } catch { /* transient — caller retries */ }
    return false
  }, [sessionId])

  // Arrived from a successful payment: clear the cart once, then drop the success flag
  // so the canonical bookmark URL is just ?session_id=… (revisits won't re-clear).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      clearCart()
      // 姓名/电话/邮箱留着,下次下单直接带出来;备注和时段必须清掉 ——
      // 上一单的「不要香菜」跟到下一单就是直接发到厨房的错误信息。
      try {
        const saved = JSON.parse(localStorage.getItem(FORM_KEY) || '{}')
        localStorage.setItem(FORM_KEY, JSON.stringify({ ...saved, note: '', time: '' }))
      } catch { /* ignore */ }
      window.history.replaceState({}, '', `${window.location.pathname}?session_id=${sessionId}`)
    }
  }, [clearCart, sessionId])

  // Poll until the webhook has written the order (it lands a few seconds after payment).
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let timer
    async function tick() {
      const ok = await fetchOrder()
      if (cancelled || ok) return
      if (++attempts >= 15) { setLoading(false); setNotFound(true); return }
      timer = setTimeout(tick, 2000)
    }
    tick()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [fetchOrder])

  // Live updates: kitchen status changes (and fee backfill) broadcast on the "orders"
  // channel → re-fetch this order. 30s fallback poll in case a broadcast is missed.
  const orderFound = !!order
  useEffect(() => {
    if (!orderFound) return
    const channel = supabase
      .channel('orders')
      .on('broadcast', { event: 'status_changed' }, () => fetchOrder())
      .on('broadcast', { event: 'order_updated' }, () => fetchOrder())
      .subscribe()
    const poll = setInterval(fetchOrder, 30000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [orderFound, fetchOrder])

  const currentStep = order ? STEPS.indexOf(order.status) : -1

  return (
    <>
      <nav className="navbar">
        <a className="navbar-brand" href={window.location.pathname}>
          <img className="navbar-logo" src={`${import.meta.env.BASE_URL}images/logo-emblem.png`} alt="" />
          <span>NoodleFan 粉面王</span>
        </a>
        <div className="navbar-links">
          <LangToggle lang={lang} onToggle={() => setLang(lang === 'en' ? 'zh' : 'en')} />
        </div>
      </nav>

      <main className="order-status">
        {loading && <p className="os-msg">{s.loading}</p>}
        {notFound && <p className="os-msg">{s.notFound}</p>}

        {order && (
          <div className="os-card">
            <div className="os-thanks">
              <div className="os-check">✓</div>
              <h1>{s.thanksTitle}</h1>
            </div>

            <div className="os-code">
              <span className="os-code-label">{s.codeLabel}</span>
              <span className="os-code-value">{order.pickup_code}</span>
            </div>

            <div className="os-steps">
              {STEPS.map((st, i) => {
                const state = i < currentStep ? 'done' : i === currentStep ? 'active' : 'todo'
                return (
                  <div key={st} className={`os-step os-step--${state}`}>
                    <span className="os-step-dot" />
                    <span className="os-step-label">{s.statuses[st]}</span>
                  </div>
                )
              })}
            </div>
            <p className="os-status-desc">{s.statusDesc[order.status]}</p>

            <div className="os-pickup">🕐 {s.pickupAt} {order.pickup_date} {order.pickup_time}</div>

            <ul className="os-items">
              {order.items.map((it, i) => {
                const opts = lang === 'zh' ? it.optionsZh : it.optionsEn
                return (
                  <li key={i}>
                    <span>
                      {lang === 'zh' ? it.nameZh : it.nameEn} × {it.qty}
                      {opts?.length > 0 && <span className="os-item-opts"> ({opts.join(', ')})</span>}
                    </span>
                    <span>${(it.price * it.qty).toFixed(2)}</span>
                  </li>
                )
              })}
              <li className="os-items-total">
                <span>{t.cart.total}</span>
                <span>${Number(order.total).toFixed(2)}</span>
              </li>
            </ul>

            {order.note && <p className="os-note">{order.note}</p>}

            <div className="os-save">
              <strong className="os-save-title">{s.saveTitle}</strong>
              <p className="os-save-hint">{s.saveHint}</p>
              <div className="os-link-row">
                <input
                  id="os-link-input"
                  className="os-link"
                  value={orderUrl}
                  readOnly
                  onFocus={e => e.target.select()}
                />
                <button
                  className={`os-copy${copied ? ' os-copy--done' : ''}`}
                  onClick={copyLink}
                >
                  {copied ? s.copied : s.copy}
                </button>
              </div>
            </div>

            <div className="os-help">
              <p className="os-help-title">{s.helpTitle}</p>
              {qrValid() && (
                <div className="os-help-actions">
                  <button className="os-help-btn" onClick={() => setWechatOpen(true)}>
                    {s.helpWechat}
                  </button>
                </div>
              )}
              <p className="os-help-email">{s.helpEmail}</p>
            </div>

            <a className="btn-primary os-again" href={window.location.pathname}>{s.orderAgain}</a>
          </div>
        )}
      </main>

      <Footer t={t} />
      {wechatOpen && <WechatModal t={t} onClose={() => setWechatOpen(false)} />}
    </>
  )
}
