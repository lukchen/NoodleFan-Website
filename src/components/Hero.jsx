import { ORDERING_ENABLED, PLATFORM_LINKS } from '../config'

export default function Hero({ t, onOrder }) {
  // 还没选取餐点时,「立即点餐」先弹取餐方式选择;选过了就直接滚到菜单。
  function scrollToMenu(e) {
    e.preventDefault()
    if (onOrder) { onOrder(); return }
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
            <a
              className="btn-primary platform-cta"
              href={PLATFORM_LINKS.uberEats}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.hero.orderUberEats}
            </a>
            <span className="coming-soon-platforms">{t.hero.platforms}</span>
            <span className="coming-soon-sub">{t.hero.comingSoonSub}</span>
            <span className="coming-soon-note">{t.hero.siteOrderingSoon}</span>
          </div>
        )}
      </div>
    </section>
  )
}
