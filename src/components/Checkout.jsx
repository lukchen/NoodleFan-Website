import { useState, useEffect, useMemo } from 'react'
import { usePickup } from '../context/PickupContext'
import { formatPickupAt } from '../pickup'
import { useCart } from '../context/CartContext'
import { SUPABASE_URL, SUPABASE_ANON_KEY, CHECKOUT_ENABLED } from '../config'

const TAX_RATE = 0.07 // MA 6.25% + Boston 本地附加 0.75%（与 create-checkout 保持一致）

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

  const { point, run } = usePickup()
  // 定点配送的取餐时刻是发车时间,不该让客人自己挑 —— 挑了也不作数。
  const fixedRun = point?.kind === 'dropoff' ? run : null

  const [form, setForm] = useState({ name: '', phone: '', date: today, time: '', note: '' })

  // 定点配送:把日期/时间锁成这一班的发车时刻,表单校验照常通过。
  useEffect(() => {
    if (!fixedRun) return
    setForm(prev => ({
      ...prev,
      date: toLocalDateString(fixedRun.pickupAt),
      time: `${String(fixedRun.pickupAt.getHours()).padStart(2, '0')}:00`,
    }))
  }, [fixedRun])
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
    if (!CHECKOUT_ENABLED) return
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
          // Price/subtotal/tax/total are computed server-side from the canonical menu —
          // only the dish id, qty, and chosen options are sent.
          items: items.map(i => ({ id: i.id, qty: i.qty, selections: i.selections })),
          customer: { name: form.name, phone: form.phone },
          // 取餐点必须跟单走:少了它,Allston 的团购单和到店自取单在后台长得一模一样。
          pickupPoint: point
            ? { id: point.id, kind: point.kind, nameZh: point.nameZh, nameEn: point.nameEn }
            : null,
          pickupDate: form.date,
          pickupTime: form.time,
          note: form.note,
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
          {items.map(item => {
            const opts = t.lang === 'zh' ? item.optionsZh : item.optionsEn
            return (
              <div key={item.key} className="checkout-summary-row">
                <span>
                  {t.lang === 'zh' ? item.nameZh : item.nameEn} × {item.qty}
                  {opts?.length > 0 && <span className="checkout-summary-opts"> ({opts.join(', ')})</span>}
                </span>
                <span>${(item.unitPrice * item.qty).toFixed(2)}</span>
              </div>
            )
          })}
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

{fixedRun ? (
            <div className="checkout-fixed-run">
              <span className="checkout-field-label">{t.checkout.pickupAtLabel}</span>
              <strong>{t.lang === 'zh' ? point.nameZh : point.nameEn} · {formatPickupAt(run, t.lang)}</strong>
            </div>
          ) : (<>
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
          </>)}

          <label>
            {t.checkout.note}
            <textarea name="note" value={form.note} onChange={handleChange} rows={2} placeholder={t.checkout.notePlaceholder} />
          </label>

          {error && <p className="checkout-error">{error}</p>}

          {!CHECKOUT_ENABLED && (
            <p className="checkout-disabled-note">{t.checkout.disabledNote}</p>
          )}

          <button
            type="submit"
            className="btn-primary checkout-submit"
            disabled={!CHECKOUT_ENABLED || submitting || !form.time}>
            {!CHECKOUT_ENABLED
              ? t.checkout.disabled
              : submitting ? t.checkout.processing : `${t.checkout.pay} $${grandTotal.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
