import { useState } from 'react'
import { useCart } from '../context/CartContext'

export default function Checkout({ t, onClose }) {
  const { items, totalPrice, clearCart } = useCart()
  const [form, setForm] = useState({ name: '', phone: '', time: '', note: '' })
  const [submitted, setSubmitted] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Stripe payment will be wired here later
    setSubmitted(true)
    clearCart()
  }

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="checkout-success">
            <div className="checkout-success-icon">✓</div>
            <h2>{t.checkout.successTitle}</h2>
            <p>{t.checkout.successMsg}</p>
            <button className="btn-primary" onClick={onClose}>{t.checkout.done}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
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
          <div className="checkout-summary-row checkout-summary-total">
            <span>{t.cart.total}</span>
            <span>${totalPrice.toFixed(2)}</span>
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
          <label>
            {t.checkout.time}
            <input name="time" type="time" value={form.time} onChange={handleChange} required />
          </label>
          <label>
            {t.checkout.note}
            <textarea name="note" value={form.note} onChange={handleChange} rows={3} placeholder={t.checkout.notePlaceholder} />
          </label>
          <button type="submit" className="btn-primary checkout-submit">
            {t.checkout.pay} ${totalPrice.toFixed(2)}
          </button>
        </form>
      </div>
    </div>
  )
}
