import menu from '../data/menu'

export default function MenuSection({ t, lang }) {
  return (
    <section id="menu" className="menu-section">
      <h2>{t.menu.title}</h2>
      <div className="menu-grid">
        {menu.map((item) => (
          <div key={item.id} className="menu-card">
            <div className="menu-card-image">
              {item.image
                ? <img src={item.image} alt={lang === 'en' ? item.nameEn : item.nameZh} />
                : <div className="menu-card-placeholder" />
              }
            </div>
            <div className="menu-card-body">
              <h3>{lang === 'en' ? item.nameEn : item.nameZh}</h3>
              {lang === 'en' && item.nameZh && (
                <p className="menu-card-subname">{item.nameZh}</p>
              )}
              {(lang === 'en' ? item.descEn : item.descZh) && (
                <p className="menu-card-desc">
                  {lang === 'en' ? item.descEn : item.descZh}
                </p>
              )}
              <p className="menu-card-price">{t.menu.price(item.price)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
