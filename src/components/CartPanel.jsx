import { useCart } from '../context/CartContext'
import PickupSummary from './PickupSummary'

// 桌面端常驻购物车 —— 贴在菜单右侧,客人随时看得到已选和总价,不用开抽屉。
// 手机端由底部固定条 + 抽屉负责,这个面板在窄屏隐藏。
export default function CartPanel({ t, lang }) {
  const { items, removeItem, updateQty, totalPrice, setCartOpen, startEdit } = useCart()

  return (
    <aside className="cart-panel">
      <div className="cart-panel-inner">
        <h3 className="cart-panel-title">{t.cart.title}</h3>

        <PickupSummary t={t} lang={lang} />

        {items.length === 0 ? (
          <p className="cart-panel-empty">{t.cart.empty}</p>
        ) : (
          <>
            <ul className="cart-panel-items">
              {items.map(item => {
                const opts = lang === 'zh' ? item.optionsZh : item.optionsEn
                return (
                  <li key={item.key} className="cart-panel-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{lang === 'zh' ? item.nameZh : item.nameEn}</span>
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
            <div className="cart-panel-footer">
              <div className="cart-total">
                <span>{t.cart.subtotalLabel}</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <p className="cart-tax-note">{t.cart.taxNote}</p>
            </div>
          </>
        )}

        <button
          className="btn-primary cart-panel-btn"
          disabled={items.length === 0}
          onClick={() => setCartOpen(true)}>
          {t.cart.checkout}
          {items.length > 0 && ` · $${totalPrice.toFixed(2)}`}
        </button>
      </div>
    </aside>
  )
}
