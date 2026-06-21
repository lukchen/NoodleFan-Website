import { useState, useEffect, useMemo } from 'react'
import { useCart } from '../context/CartContext'

const TAX_RATE = 0.0625

// Generate 30-min slots from 11:00 to 20:30 (8:30 PM last order)
function buildSlots() {
  const slots = []
  for (let h = 11; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break // stop at 8:30 PM
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const value = `${hh}:${mm}`
      const hour12 = h > 12 ? h - 12 : h
      const ampm = h >= 12 ? 'PM' : 'AM'
      const label = `${hour12}:${mm} ${ampm}`
      slots.push({ value, label })
    }
  }
  return slots
}

const TIME_SLOTS = buildSlots()

function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function Checkout({ t, onClose }) {
  const { items, totalPrice, clearCart } = useCart()
  const tax = totalPrice * TAX_RATE
  const grandTotal = totalPrice + tax

  const today = useMemo(() => toLocalDateString(new Date()), [])
  const tomorrow = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return toLocalDateString(d)
  }, [])

  const [form, setForm] = useState({ name: '', phone: '', date: today, time: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const isDirty = form.name || form.phone || (form.date && form.date !== today) || form.time || form.note

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !isDirty) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, onClose])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleBackdrop() {
    if (isDirty) return
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      setConfirmedOrder({ items: [...items], form: { ...form }, grandTotal })
      clearCart()
      setSubmitted(true)
      setSubmitting(false)
    }, 800)
  }

  function formatDateLabel(dateStr) {
    if (dateStr === today) return t.checkout.dateToday
    if (dateStr === tomorrow) return t.checkout.dateTomorrow
    // e.g. "Mon, Jun 23"
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString(t.lang === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function formatTimeLabel(timeVal) {
    const slot = TIME_SLOTS.find(s => s.value === timeVal)
    return slot ? slot.label : timeVal
  }

  if (submitted && confirmedOrder) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="checkout-success">
            <div className="checkout-success-icon">✓</div>
            <h2>{t.checkout.successTitle}</h2>
            <p>{t.checkout.successMsg}</p>
            <div className="checkout-success-summary">
              {confirmedOrder.items.map(item => (
                <div key={item.id} className="checkout-summary-row">
                  <span>{t.lang === 'zh' ? item.nameZh : item.nameEn} × {item.qty}</span>
                  <span>${(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="checkout-summary-row checkout-summary-total">
                <span>{t.cart.total}</span>
                <span>${confirmedOrder.grandTotal.toFixed(2)}</span>
              </div>
              <div className="checkout-success-pickup">
                🕐 {formatDateLabel(confirmedOrder.form.date)}　{formatTimeLabel(confirmedOrder.form.time)}
              </div>
            </div>
            <button className="btn-primary" onClick={onClose}>{t.checkout.done}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.checkout.title}</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="checkout-summary">
          {items.map(item => (
            <div key={item.id} className="checkout-summary-row">
              <span>{t.lang === 'zh' ? item.nameZh : item.nameEn} × {item.qty}</span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="checkout-summary-row checkout-summary-subtotal">
            <span>{t.checkout.subtotal}</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
          <div className="checkout-summary-row">
            <span>{t.checkout.tax}</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="checkout-summary-row checkout-summary-total">
            <span>{t.cart.total}</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <form className="checkout-form" onSubmit={handleSubmit}>
          <label>
            {t.checkout.name}
            <input name="name" value={form.name} onChange={handleChange} required placeholder={t.checkout.namePlaceholder} />
          </label>
          <label>
            {t.checkout.phone}
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder={t.checkout.phonePlaceholder} />
          </label>

          {/* Date picker with Today / Tomorrow quick chips */}
          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.date}</span>
            <div className="date-chips">
              <button type="button"
                className={`date-chip${form.date === today ? ' date-chip--active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, date: today }))}>
                {t.checkout.dateToday}
              </button>
              <button type="button"
                className={`date-chip${form.date === tomorrow ? ' date-chip--active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, date: tomorrow }))}>
                {t.checkout.dateTomorrow}
              </button>
              <input
                type="date"
                name="date"
                value={form.date}
                min={today}
                onChange={handleChange}
                required
                className="date-input-other"
                title={t.checkout.dateOther}
              />
            </div>
          </div>

          {/* Time slot grid */}
          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.time}</span>
            {/* Hidden input to satisfy required validation */}
            <input type="hidden" name="time" value={form.time} required />
            <div className="time-slots">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot.value}
                  type="button"
                  className={`time-slot${form.time === slot.value ? ' time-slot--active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, time: slot.value }))}>
                  {slot.label}
                </button>
              ))}
            </div>
            {!form.time && <p className="checkout-field-hint">{t.checkout.timeHint}</p>}
          </div>

          <label>
            {t.checkout.note}
            <textarea name="note" value={form.note} onChange={handleChange} rows={2} placeholder={t.checkout.notePlaceholder} />
          </label>

          <button
            type="submit"
            className="btn-primary checkout-submit"
            disabled={submitting || !form.time}>
            {submitting ? t.checkout.processing : `${t.checkout.pay} $${grandTotal.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
