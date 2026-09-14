import { useEffect } from 'react'
import useScrollLock from '../useScrollLock'
import { useCart } from '../context/CartContext'
import PickupSummary from './PickupSummary'

export default function Cart({ t, lang, onCheckout }) {
  const { items, removeItem, updateQty, totalPrice, cartOpen, setCartOpen, startEdit } = useCart()

  useScrollLock(cartOpen)

  useEffect(() => {
    if (!cartOpen) return
    function onKey(e) { if (e.key === 'Escape') setCartOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartOpen, setCartOpen])

  return (
    <>
      <div className={`cart-overlay${cartOpen ? ' cart-overlay--open' : ''}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer${cartOpen ? ' cart-drawer--open' : ''}`}>
        <div className="cart-header">
          <h2>{t.cart.title}</h2>
          <button className="cart-close" onClick={() => setCartOpen(false)}>✕</button>
        </div>

        <PickupSummary t={t} lang={lang} />

        {items.length === 0 ? (
          <p className="cart-empty">{t.cart.empty}</p>
        ) : (
          <>
            <ul className="cart-items">
              {items.map(item => {
                const opts = t.lang === 'zh' ? item.optionsZh : item.optionsEn
                return (
                  <li key={item.key} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{t.lang === 'zh' ? item.nameZh : item.nameEn}</span>
                      <span className="cart-item-price">${(item.unitPrice * item.qty).toFixed(2)}</span>
                    </div>
                    {opts?.length > 0 && <p className="cart-item-opts">{opts.join(' · ')}</p>}
                    {/* 加错了辣度不用删了重加 —— 点「修改」原地改配置 */}
                    <button type="button" className="cart-item-edit" onClick={() => startEdit(item)}>
                      {t.options.edit}
                    </button>
                    <div className="cart-item-controls">
                      <button onClick={() => updateQty(item.key, item.qty - 1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.key, item.qty + 1)}>+</button>
                      <button className="cart-item-remove" onClick={() => removeItem(item.key)}>✕</button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="cart-footer">
              <div className="cart-total">
                <span>{t.cart.subtotalLabel}</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <p className="cart-tax-note">{t.cart.taxNote}</p>
              <button className="btn-primary cart-checkout-btn" onClick={onCheckout}>
                {t.cart.checkout}
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
