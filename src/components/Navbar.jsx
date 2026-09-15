import LangToggle from './LangToggle'
import { useCart } from '../context/CartContext'
import { usePickup } from '../context/PickupContext'
import { ORDERING_ENABLED } from '../config'

export default function Navbar({ t, lang, onToggleLang }) {
  const { totalItems, setCartOpen } = useCart()
  const { point, changing, endChange } = usePickup()

  // 点了「更换取餐方式」又不想换时,得有路回去 —— 点 logo / 店名就是那条路。
  // 还没选过取餐点的新客人点它不生效:选择本身是必答题,没有「上一页」可回。
  const canGoBack = changing && point
  function goHome() {
    if (canGoBack) endChange()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav className="navbar">
      <div
        className={`navbar-brand${canGoBack ? ' navbar-brand--clickable' : ''}`}
        role={canGoBack ? 'button' : undefined}
        tabIndex={canGoBack ? 0 : undefined}
        title={canGoBack ? t.pickup.backToMenu : undefined}
        onClick={goHome}
        onKeyDown={e => { if (canGoBack && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goHome() } }}>
        <img className="navbar-logo" src={`${import.meta.env.BASE_URL}images/logo-emblem.png`} alt="" />
        <span>NoodleFan 粉面王</span>
        {/* 原来 hero 里的大标语挪到这里 —— 首屏留给取餐方式选择,不给一张大 logo */}
        <span className="navbar-tagline">{t.hero.subA}</span>
      </div>
      <div className="navbar-links">
        <a href="#menu">{t.nav.menu}</a>
        {ORDERING_ENABLED && (
          <button className="cart-btn" onClick={() => setCartOpen(true)}>
            🛒 {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </button>
        )}
        <LangToggle lang={lang} onToggle={onToggleLang} />
      </div>
    </nav>
  )
}
