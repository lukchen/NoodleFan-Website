export default function Hero({ t }) {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>{t.hero.tagline}</h1>
        <p>{t.hero.sub}</p>
        <a href="#order" className="btn-primary">{t.hero.cta}</a>
      </div>
    </section>
  )
}
