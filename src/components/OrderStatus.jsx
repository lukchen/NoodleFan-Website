import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import LangToggle from './LangToggle'
import Footer from './Footer'
import { useCart } from '../context/CartContext'

const FN_URL = `${SUPABASE_URL}/functions/v1/order-status`
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Customer-facing order progression (mirrors the kitchen's status flow).
const STEPS = ['paid', 'preparing', 'ready', 'completed']

export default function OrderStatus({ sessionId, t, lang, setLang }) {
  const { clearCart } = useCart()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const s = t.orderStatus

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
        <a className="navbar-brand" href={window.location.pathname}>NoodleFan 粉面王</a>
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
              {order.items.map((it, i) => (
                <li key={i}>
                  <span>{lang === 'zh' ? it.nameZh : it.nameEn} × {it.qty}</span>
                  <span>${(it.price * it.qty).toFixed(2)}</span>
                </li>
              ))}
              <li className="os-items-total">
                <span>{t.cart.total}</span>
                <span>${Number(order.total).toFixed(2)}</span>
              </li>
            </ul>

            {order.note && <p className="os-note">{order.note}</p>}

            <p className="os-bookmark">{s.bookmarkHint}</p>
            <a className="btn-primary os-again" href={window.location.pathname}>{s.orderAgain}</a>
          </div>
        )}
      </main>

      <Footer t={t} />
    </>
  )
}
