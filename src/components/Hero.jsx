export default function Hero({ t }) {
  function scrollToMenu(e) {
    e.preventDefault()
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="hero">
      <div className="hero-content">
        <h1>{t.hero.tagline}</h1>
        <p>{t.hero.sub}</p>
        <a href="#menu" className="btn-primary" onClick={scrollToMenu}>{t.hero.cta}</a>
      </div>
    </section>
  )
}
