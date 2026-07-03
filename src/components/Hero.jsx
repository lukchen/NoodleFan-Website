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
        <a href="#menu" className="btn-primary" onClick={scrollToMenu}>{t.hero.cta}</a>
      </div>
    </section>
  )
}
