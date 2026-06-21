import { useCart } from '../context/CartContext'

export default function Cart({ t, onCheckout }) {
  const { items, removeItem, updateQty, totalPrice, cartOpen, setCartOpen } = useCart()

  if (!cartOpen) return null

  return (
    <>
      <div className="cart-overlay" onClick={() => setCartOpen(false)} />
      <aside className="cart-drawer">
        <div className="cart-header">
          <h2>{t.cart.title}</h2>
          <button className="cart-close" onClick={() => setCartOpen(false)}>✕</button>
        </div>

        {items.length === 0 ? (
          <p className="cart-empty">{t.cart.empty}</p>
        ) : (
          <>
            <ul className="cart-items">
              {items.map(item => (
                <li key={item.id} className="cart-item">
                  <div className="cart-item-info">
                    <span className="cart-item-name">{t.lang === 'zh' ? item.nameZh : item.nameEn}</span>
                    <span className="cart-item-price">${item.price}</span>
                  </div>
                  <div className="cart-item-controls">
                    <button onClick={() => updateQty(item.id, item.qty - 1)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)}>+</button>
                    <button className="cart-item-remove" onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="cart-footer">
              <div className="cart-total">
                <span>{t.cart.total}</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
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
