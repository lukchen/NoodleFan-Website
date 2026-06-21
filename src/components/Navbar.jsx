import LangToggle from './LangToggle'

export default function Navbar({ t, lang, onToggleLang }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">NoodleFan 粉面王</div>
      <div className="navbar-links">
        <a href="#menu">{t.nav.menu}</a>
        <a href="#order" className="btn-primary">{t.nav.order}</a>
        <LangToggle lang={lang} onToggle={onToggleLang} />
      </div>
    </nav>
  )
}
