import LangToggle from './LangToggle'
import { useCart } from '../context/CartContext'

export default function Navbar({ t, lang, onToggleLang }) {
  const { totalItems, setCartOpen } = useCart()

  return (
    <nav className="navbar">
      <div className="navbar-brand">NoodleFan 粉面王</div>
      <div className="navbar-links">
        <a href="#menu">{t.nav.menu}</a>
        <button className="cart-btn" onClick={() => setCartOpen(true)}>
          🛒 {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </button>
        <LangToggle lang={lang} onToggle={onToggleLang} />
      </div>
    </nav>
  )
}
