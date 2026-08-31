import { useState } from 'react'
import menu, { categories } from '../data/menu'
import { useCart } from '../context/CartContext'
import OptionsModal from './OptionsModal'
import { ORDERING_ENABLED } from '../config'

function MenuCard({ item, t, lang, onCustomize }) {
  const { addItem, dishQty } = useCart()
  const qty = dishQty(item.id)
  const hasOptions = (item.optionGroups ?? []).length > 0

  const imgSrc = item.image?.startsWith('/images/')
    ? `${import.meta.env.BASE_URL}${item.image.slice(1)}`
    : item.image

  const name = lang === 'en' ? item.nameEn : item.nameZh
  const altName = lang === 'en' ? item.nameZh : null
  const desc = lang === 'en' ? item.descEn : item.descZh

  return (
    <article className="menu-card">
      <div className="menu-card-image">
        {imgSrc ? <img src={imgSrc} alt={name} loading="lazy" /> : <div className="menu-card-placeholder" />}
      </div>
      <div className="menu-card-body">
        <h4 className="menu-card-name">{name}</h4>
        {altName && <p className="menu-card-subname">{altName}</p>}
        {desc && <p className="menu-card-desc">{desc}</p>}
        <div className="menu-card-footer">
          <p className="menu-card-price">{t.menu.price(item.price)}</p>
          {/* Dishes with options always go through the picker — each add is a specific
              combination; per-line qty is managed in the cart drawer. */}
          {ORDERING_ENABLED && (
            <button className="btn-add" onClick={() => (hasOptions ? onCustomize(item) : addItem(item))}>
              {t.menu.add}{qty > 0 && <span className="btn-add-count"> ×{qty}</span>}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function MenuSection({ t, lang }) {
  const { addItem } = useCart()
  const [customizing, setCustomizing] = useState(null)

  const sections = categories
    .map(c => ({ ...c, dishes: menu.filter(d => d.category === c.id) }))
    .filter(c => c.dishes.length > 0)

  return (
    <section id="menu" className="menu-section">
      <header className="menu-heading">
        <h2>{t.menu.title}</h2>
      </header>

      {sections.map(c => (
        <div key={c.id} className="cat-block">
          <div className="cat-header">
            <span className="cat-eyebrow">{lang === 'zh' ? c.nameEn : c.nameZh}</span>
            <h3 className="cat-name">{lang === 'zh' ? c.nameZh : c.nameEn}</h3>
            <p className="cat-tagline">{lang === 'zh' ? c.taglineZh : c.taglineEn}</p>
            <span className="cat-rule" aria-hidden="true" />
          </div>
          <div className="menu-grid">
            {c.dishes.map(item => (
              <MenuCard key={item.id} item={item} t={t} lang={lang} onCustomize={setCustomizing} />
            ))}
          </div>
        </div>
      ))}

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
