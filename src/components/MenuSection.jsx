import { useState, useEffect, useRef } from 'react'
import menu, { categories } from '../data/menu'
import { useCart } from '../context/CartContext'
import { usePickup } from '../context/PickupContext'
import OptionsModal from './OptionsModal'
import CartPanel from './CartPanel'
import { ORDERING_ENABLED } from '../config'

function MenuCard({ item, t, lang, onCustomize, remaining }) {
  const { addItem, dishQty } = useCart()
  const qty = dishQty(item.id)
  const hasOptions = (item.optionGroups ?? []).length > 0

  const imgSrc = item.image?.startsWith('/images/')
    ? `${import.meta.env.BASE_URL}${item.image.slice(1)}`
    : item.image

  const name = lang === 'en' ? item.nameEn : item.nameZh
  const altName = lang === 'en' ? item.nameZh : null
  const desc = lang === 'en' ? item.descEn : item.descZh

  // Cheapest combo upgrade, surfaced on the card so combos are visible while browsing.
  const comboGroup = (item.optionGroups ?? []).find(g => g.style === 'combo')
  const comboFrom = comboGroup
    ? Math.min(...comboGroup.choices.filter(c => c.delta).map(c => item.price + c.delta))
    : null

  const soldOut = remaining !== null && remaining <= 0
  const lowStock = remaining !== null && remaining > 0 && remaining <= 5

  return (
    <article className={`menu-card${soldOut ? ' menu-card--soldout' : ''}`}>
      <div className="menu-card-image">
        {imgSrc ? <img src={imgSrc} alt={name} loading="lazy" /> : <div className="menu-card-placeholder" />}
      </div>
      <div className="menu-card-body">
        <h4 className="menu-card-name">{name}</h4>
        {altName && <p className="menu-card-subname">{altName}</p>}
        {desc && <p className="menu-card-desc">{desc}</p>}
        {lowStock && <p className="menu-card-stock">{t.pickup.onlyLeft(remaining)}</p>}
        {soldOut && <p className="menu-card-stock menu-card-stock--out">{t.pickup.soldOut}</p>}
        <div className="menu-card-footer">
          {ORDERING_ENABLED && (
            <p className="menu-card-price">
              {t.menu.price(item.price)}
              {comboFrom && (
                <span className="menu-card-combo">{t.options.comboFrom} ${comboFrom.toFixed(2)}</span>
              )}
            </p>
          )}
          {/* Dishes with options always go through the picker — each add is a specific
              combination; per-line qty is managed in the cart drawer. */}
          {ORDERING_ENABLED && !soldOut && (
            <button className="btn-add" onClick={() => (hasOptions ? onCustomize(item) : addItem(item))}>
              {t.menu.add}{qty > 0 && <span className="btn-add-count"> ×{qty}</span>}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function MenuSection({ t, lang, onChoosePickup }) {
  const { addItem } = useCart()
  const { point, remainingFor } = usePickup()
  const [customizing, setCustomizing] = useState(null)
  const [activeCat, setActiveCat] = useState(null)
  const sectionRefs = useRef({})

  const sections = categories
    .map(c => ({ ...c, dishes: menu.filter(d => d.category === c.id) }))
    .filter(c => c.dishes.length > 0)

  // Highlight whichever category is currently under the sticky header.
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) setActiveCat(visible[0].target.dataset.cat)
      },
      { rootMargin: '-140px 0px -70% 0px', threshold: 0 },
    )
    Object.values(sectionRefs.current).forEach(el => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  function jumpTo(id) {
    const el = sectionRefs.current[id]
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 130
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  // Dropoff points cap each dish per day; store pickup has no cap.
  const capped = point?.kind === 'dropoff'

  // 菜单在取餐方式之后。没选之前只给一个明确的入口,不给半个菜单 ——
  // 否则客人加完购物车才发现今天那个点不发车。
  if (ORDERING_ENABLED && !point) {
    return (
      <section id="menu" className="menu-section">
        <div className="menu-gate">
          <span className="menu-gate-step">{t.pickup.step1}</span>
          <h3 className="menu-gate-title">{t.pickup.gateTitle}</h3>
          <p className="menu-gate-note">{t.pickup.gateNote}</p>
          <button className="btn-primary menu-gate-btn" onClick={onChoosePickup}>
            {t.pickup.gateBtn}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section id="menu" className="menu-section">
      {/* Mobile: horizontally scrollable sticky chips */}
      <nav className="cat-tabs" aria-label={t.menu.title}>
        {sections.map(c => (
          <button
            key={c.id}
            type="button"
            className={`cat-tab${activeCat === c.id ? ' cat-tab--active' : ''}`}
            onClick={() => jumpTo(c.id)}>
            {lang === 'zh' ? c.nameZh : c.nameEn}
          </button>
        ))}
      </nav>

      <div className="menu-layout">
        {/* Desktop: sticky left rail */}
        <aside className="cat-rail" aria-label={t.menu.title}>
          {sections.map(c => (
            <button
              key={c.id}
              type="button"
              className={`cat-rail-item${activeCat === c.id ? ' cat-rail-item--active' : ''}`}
              onClick={() => jumpTo(c.id)}>
              <span className="cat-rail-zh">{lang === 'zh' ? c.nameZh : c.nameEn}</span>
              <span className="cat-rail-count">{c.dishes.length}</span>
            </button>
          ))}
        </aside>

        <div className="menu-main">
          {sections.map(c => (
            <div
              key={c.id}
              className="cat-block"
              data-cat={c.id}
              ref={el => { sectionRefs.current[c.id] = el }}>
              <div className="cat-header">
                <span className="cat-eyebrow">{lang === 'zh' ? c.nameEn : c.nameZh}</span>
                <h3 className="cat-name">{lang === 'zh' ? c.nameZh : c.nameEn}</h3>
                <p className="cat-tagline">{lang === 'zh' ? c.taglineZh : c.taglineEn}</p>
                <span className="cat-rule" aria-hidden="true" />
              </div>
              <div className="menu-grid">
                {c.dishes.map(item => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    t={t}
                    lang={lang}
                    onCustomize={setCustomizing}
                    remaining={capped ? remainingFor(item.id) : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: always-visible cart so the total is never a click away */}
        {ORDERING_ENABLED && <CartPanel t={t} lang={lang} />}
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
