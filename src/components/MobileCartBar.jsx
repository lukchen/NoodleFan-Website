import { useCart } from '../context/CartContext'
import { usePickup } from '../context/PickupContext'
import { formatRun } from '../pickup'
import { ORDERING_ENABLED } from '../config'

// 手机端底部固定条 —— 身兼两职:
//   1. 结算入口(外卖 App 标配,不然客人加完菜要滚回顶部找购物车)
//   2. 取餐条:客人任何时候都该知道「这单是哪天、去哪儿拿」
//
// 为什么放底部而不是顶部:顶部的常驻条会一直压在菜品卡上,内容从它底下滑过 ——
// 客人只看到「一段描述 + 一个价格」,菜名被盖住。底部这条不一样:
// 菜单区留了 5rem 的下边距(见 App.css),它下面本来就没有内容,一个像素都不挡。
//
// 购物车为空时也显示 —— 那正是客人最需要确认取餐点的时候(还没下决心买)。
export default function MobileCartBar({ t, lang }) {
  const { totalItems, totalPrice, setCartOpen } = useCart()
  const { point, run } = usePickup()
  if (!ORDERING_ENABLED) return null
  // 连取餐点都还没选的话没什么可说的,菜单这时候也还没开
  if (!point && totalItems === 0) return null

  const empty = totalItems === 0
  const when = point?.kind === 'dropoff' && run ? formatRun(run, lang) : null

  return (
    <button
      type="button"
      className={`mobile-cart-bar${empty ? ' mobile-cart-bar--info' : ''}`}
      onClick={() => setCartOpen(true)}>
      <span className="mobile-cart-bar-left">
        {point && (
          <span className="mobile-cart-bar-point">
            {point.kind === 'store' ? '🏪' : '📍'} {lang === 'zh' ? point.nameZh : point.nameEn}
            {when && <span className="mobile-cart-bar-when"> · {when}</span>}
          </span>
        )}
        {!empty && (
          <span>🛒 <strong>{totalItems}</strong> {t.cart.itemsUnit} · ${totalPrice.toFixed(2)}</span>
        )}
      </span>
      <span className="mobile-cart-bar-cta">
        {empty ? t.pickup.change : t.cart.checkout}
      </span>
    </button>
  )
}
