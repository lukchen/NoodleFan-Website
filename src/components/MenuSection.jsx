import { useState } from 'react'
import menu from '../data/menu'
import { useCart } from '../context/CartContext'
import OptionsModal from './OptionsModal'

function MenuCard({ item, t, lang, onCustomize }) {
  const { addItem, dishQty } = useCart()
  const qty = dishQty(item.id)
  const hasOptions = (item.optionGroups ?? []).length > 0

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
          {/* Dishes with options always go through the picker — each add is a specific
              combination; per-line qty is managed in the cart drawer. */}
          <button className="btn-add" onClick={() => hasOptions ? onCustomize(item) : addItem(item)}>
            {t.menu.add}{qty > 0 && <span className="btn-add-count"> ×{qty}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MenuSection({ t, lang }) {
  const { addItem } = useCart()
  const [customizing, setCustomizing] = useState(null)

  return (
    <section id="menu" className="menu-section">
      <h2>{t.menu.title}</h2>
      <div className="menu-grid">
        {menu.map(item => (
          <MenuCard key={item.id} item={item} t={t} lang={lang} onCustomize={setCustomizing} />
        ))}
      </div>
      {customizing && (
        <OptionsModal
          dish={customizing}
          t={t}
          lang={lang}
          onAdd={addItem}
          onClose={() => setCustomizing(null)}
        />
      )}
    </section>
  )
}
