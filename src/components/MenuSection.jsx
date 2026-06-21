import menu from '../data/menu'
import { useCart } from '../context/CartContext'

function MenuCard({ item, t, lang }) {
  const { items, addItem, updateQty } = useCart()
  const cartItem = items.find(i => i.id === item.id)
  const qty = cartItem?.qty ?? 0

  const imgSrc = item.image?.startsWith('/images/')
    ? `${import.meta.env.BASE_URL}${item.image.slice(1)}`
    : item.image

  return (
    <div className="menu-card">
      <div className="menu-card-image">
        {imgSrc ? <img src={imgSrc} alt={lang === 'en' ? item.nameEn : item.nameZh} /> : <div className="menu-card-placeholder" />}
      </div>
      <div className="menu-card-body">
        <h3>{lang === 'en' ? item.nameEn : item.nameZh}</h3>
        {lang === 'en' && item.nameZh && <p className="menu-card-subname">{item.nameZh}</p>}
        {(lang === 'en' ? item.descEn : item.descZh) && (
          <p className="menu-card-desc">{lang === 'en' ? item.descEn : item.descZh}</p>
        )}
        <div className="menu-card-footer">
          <p className="menu-card-price">{t.menu.price(item.price)}</p>
          {qty === 0
            ? <button className="btn-add" onClick={() => addItem(item)}>{t.menu.add}</button>
            : (
              <div className="btn-qty">
                <button onClick={() => updateQty(item.id, qty - 1)}>−</button>
                <span>{qty}</span>
                <button onClick={() => addItem(item)}>+</button>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

export default function MenuSection({ t, lang }) {
  return (
    <section id="menu" className="menu-section">
      <h2>{t.menu.title}</h2>
      <div className="menu-grid">
        {menu.map(item => <MenuCard key={item.id} item={item} t={t} lang={lang} />)}
      </div>
    </section>
  )
}
