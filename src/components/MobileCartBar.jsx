import { useCart } from '../context/CartContext'
import { ORDERING_ENABLED } from '../config'

// 手机端底部固定结算条 —— 外卖 App 的标配。没有它,客人加完菜要滚回顶部找购物车。
// 购物车为空时不出现,不占屏幕。
export default function MobileCartBar({ t }) {
  const { totalItems, totalPrice, setCartOpen } = useCart()
  if (!ORDERING_ENABLED || totalItems === 0) return null

  return (
    <button type="button" className="mobile-cart-bar" onClick={() => setCartOpen(true)}>
      <span className="mobile-cart-bar-left">
        🛒 <strong>{totalItems}</strong> {t.cart.itemsUnit} · ${totalPrice.toFixed(2)}
      </span>
      <span className="mobile-cart-bar-cta">{t.cart.checkout}</span>
    </button>
  )
}
