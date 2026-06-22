import { useState, useEffect, useMemo } from 'react'
import { useCart } from '../context/CartContext'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'

const TAX_RATE = 0.0625

function buildSlots() {
  const slots = []
  for (let h = 11; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break
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
  const { items, totalPrice } = useCart()
  const tax = totalPrice * TAX_RATE
  const grandTotal = totalPrice + tax

  const today = useMemo(() => toLocalDateString(new Date()), [])
  const tomorrow = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return toLocalDateString(d)
  }, [])

  const [form, setForm] = useState({ name: '', phone: '', date: today, time: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          items,
          customer: { name: form.name, phone: form.phone },
          pickupDate: form.date,
          pickupTime: form.time,
          note: form.note,
          subtotal: totalPrice,
          tax,
          total: grandTotal,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout failed')
      window.location.href = data.url
    } catch {
      setError(t.checkout.errorMsg)
      setSubmitting(false)
    }
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

          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.time}</span>
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

          {error && <p className="checkout-error">{error}</p>}

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
