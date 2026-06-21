import { useState, useEffect } from 'react'
import { useCart } from '../context/CartContext'

const TAX_RATE = 0.0625 // Massachusetts prepared food tax

export default function Checkout({ t, onClose }) {
  const { items, totalPrice, clearCart } = useCart()
  const tax = totalPrice * TAX_RATE
  const grandTotal = totalPrice + tax
  const [form, setForm] = useState({ name: '', phone: '', date: '', time: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const isDirty = form.name || form.phone || form.date || form.time || form.note

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !isDirty) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, onClose])

  // Default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setForm(prev => ({ ...prev, date: today }))
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleBackdrop() {
    if (isDirty) return // prevent accidental close when form has data
    onClose()
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    // Stripe payment will be wired here later
    setTimeout(() => {
      setConfirmedOrder({ items: [...items], form: { ...form }, grandTotal })
      clearCart()
      setSubmitted(true)
      setSubmitting(false)
    }, 800) // simulate async
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
                🕐 {confirmedOrder.form.date} {confirmedOrder.form.time}
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
          <div className="checkout-form-row">
            <label>
              {t.checkout.date}
              <input name="date" type="date" value={form.date} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} />
            </label>
            <label>
              {t.checkout.time}
              <input name="time" type="time" value={form.time} onChange={handleChange} required />
            </label>
          </div>
          <label>
            {t.checkout.note}
            <textarea name="note" value={form.note} onChange={handleChange} rows={2} placeholder={t.checkout.notePlaceholder} />
          </label>
          <button type="submit" className="btn-primary checkout-submit" disabled={submitting}>
            {submitting ? t.checkout.processing : `${t.checkout.pay} $${grandTotal.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
