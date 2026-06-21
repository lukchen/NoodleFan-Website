import menu from '../data/menu'
import { useCart } from '../context/CartContext'

export default function MenuSection({ t, lang }) {
  const { addItem } = useCart()
  return (
    <section id="menu" className="menu-section">
      <h2>{t.menu.title}</h2>
      <div className="menu-grid">
        {menu.map((item) => (
          <div key={item.id} className="menu-card">
            <div className="menu-card-image">
              {item.image
                ? <img src={item.image.startsWith('/images/') ? `${import.meta.env.BASE_URL}${item.image.slice(1)}` : item.image} alt={lang === 'en' ? item.nameEn : item.nameZh} />
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
              <div className="menu-card-footer">
                <p className="menu-card-price">{t.menu.price(item.price)}</p>
                <button className="btn-add" onClick={() => addItem(item)}>{t.menu.add}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
