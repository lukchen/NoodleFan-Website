import { useState, useEffect, useMemo } from 'react'
import { resolveSelections } from '../data/menu'

// Option picker shown when adding a dish that has optionGroups.
//
// The `combo` group ("Make it a Combo") renders as side-by-side cards instead of
// chips: fast-food convention — show the TOTAL price of each path, strike through
// what the same food would cost bought separately, and badge the savings. Groups
// carrying `showWhen` (the combo drink) only appear once the combo is chosen.
export default function OptionsModal({ dish, t, lang, onAdd, onClose }) {
  const [selections, setSelections] = useState(() => {
    const init = {}
    for (const g of dish.optionGroups ?? []) {
      init[g.id] = g.type === 'single' ? g.default : [...(g.default ?? [])]
    }
    return init
  })

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function pickSingle(groupId, choiceId) {
    setSelections(prev => ({ ...prev, [groupId]: choiceId }))
  }

  function toggleMulti(groupId, choiceId) {
    setSelections(prev => {
      const cur = prev[groupId] ?? []
      return {
        ...prev,
        [groupId]: cur.includes(choiceId) ? cur.filter(id => id !== choiceId) : [...cur, choiceId],
      }
    })
  }

  // A group is hidden until its `showWhen` condition holds (combo drink).
  const visible = (dish.optionGroups ?? []).filter(g => {
    if (!g.showWhen) return true
    return selections[g.showWhen.group] !== g.showWhen.not
  })

  // Required multi groups (e.g. 炒粉 vegetables) need at least one pick.
  const missingRequired = visible.some(
    g => g.type === 'multi' && g.required && (selections[g.id] ?? []).length === 0,
  )

  const unitPrice = useMemo(() => {
    if (missingRequired) return dish.price
    const { deltaCents } = resolveSelections(dish, selections)
    return (Math.round(dish.price * 100) + deltaCents) / 100
  }, [dish, selections, missingRequired])

  const name = lang === 'zh' ? dish.nameZh : dish.nameEn
  const money = n => `$${n.toFixed(2)}`

  function renderCombo(g) {
    const short = lang === 'zh' ? (dish.shortZh ?? dish.nameZh) : (dish.shortEn ?? dish.nameEn)
    return (
      <div key={g.id} className="opt-group combo-group">
        <span className="opt-group-label">{lang === 'zh' ? g.nameZh : g.nameEn}</span>
        <div className="combo-cards">
          {g.choices.map(c => {
            const active = selections[g.id] === c.id
            const isCombo = !!c.delta
            const total = dish.price + (c.delta ?? 0)
            const listed = isCombo ? dish.price + c.alaCarte : null
            const save = isCombo ? c.alaCarte - c.delta : 0
            return (
              <button
                key={c.id}
                type="button"
                className={`combo-card${active ? ' combo-card--active' : ''}`}
                onClick={() => pickSingle(g.id, c.id)}>
                {save > 0 && (
                  <span className="combo-save">{t.options.save} {money(save)}</span>
                )}
                <span className="combo-card-name">{lang === 'zh' ? c.nameZh : c.nameEn}</span>
                {/* 套餐写清内容:炒粉 + 火腿肠 + 饮料。单点不用解释,卡片标题
                    「单点」本身就够清楚,多一行说明反而把两张卡的高度撑不齐。 */}
                {isCombo && (
                  <span className="combo-card-sub">
                    {`${short} + ${lang === 'zh' ? c.itemZh : c.itemEn} + ${t.options.drinkWord}`}
                  </span>
                )}
                <span className="combo-card-prices">
                  {listed && <s className="combo-card-was">{money(listed)}</s>}
                  <strong className="combo-card-now">{money(total)}</strong>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal options-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{name}</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        {visible.map(g => g.style === 'combo' ? renderCombo(g) : (
          <div key={g.id} className="opt-group">
            <span className="opt-group-label">
              {lang === 'zh' ? g.nameZh : g.nameEn}
              {g.type === 'multi' && g.required && (selections[g.id] ?? []).length === 0 && (
                <em className="opt-group-hint">{t.options.pickAtLeastOne}</em>
              )}
            </span>
            <div className="opt-chips">
              {g.choices.map(c => {
                const active = g.type === 'single'
                  ? selections[g.id] === c.id
                  : (selections[g.id] ?? []).includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`opt-chip${active ? ' opt-chip--active' : ''}`}
                    onClick={() => g.type === 'single' ? pickSingle(g.id, c.id) : toggleMulti(g.id, c.id)}>
                    {lang === 'zh' ? c.nameZh : c.nameEn}
                    {c.delta ? <span className="opt-chip-delta"> +${c.delta}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <button
          className="btn-primary options-add-btn"
          disabled={missingRequired}
          onClick={() => { onAdd(dish, selections); onClose() }}>
          {t.options.addToCart} {money(unitPrice)}
        </button>
      </div>
    </div>
  )
}
