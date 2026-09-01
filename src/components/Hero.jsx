import { ORDERING_ENABLED } from '../config'

export default function Hero({ t }) {
  function scrollToMenu(e) {
    e.preventDefault()
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="hero">
      <div className="hero-content">
        <img
          className="hero-logo"
          src={`${import.meta.env.BASE_URL}images/logo-full.png`}
          alt="NoodleFan 粉面王"
        />
        <p className="hero-sub">
          <span>{t.hero.subA}</span>
          <span>{t.hero.subB}</span>
        </p>
        {ORDERING_ENABLED ? (
          <a href="#menu" className="btn-primary" onClick={scrollToMenu}>{t.hero.cta}</a>
        ) : (
          <div className="coming-soon">
            <span className="coming-soon-badge">{t.hero.comingSoon}</span>
            <span className="coming-soon-platforms">{t.hero.platforms}</span>
            <span className="coming-soon-sub">{t.hero.comingSoonSub}</span>
          </div>
        )}
      </div>
    </section>
  )
}
