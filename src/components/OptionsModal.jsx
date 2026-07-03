import { useState, useEffect, useMemo } from 'react'
import { resolveSelections } from '../data/menu'

// Option picker shown when adding a dish that has optionGroups.
// Single groups render as radio-style chips (default preselected); multi groups as
// toggle chips. Confirm adds ONE unit of the chosen combination to the cart.
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

  // Required multi groups (e.g. 炒粉 vegetables) need at least one pick.
  const missingRequired = (dish.optionGroups ?? []).some(
    g => g.type === 'multi' && g.required && (selections[g.id] ?? []).length === 0,
  )

  const unitPrice = useMemo(() => {
    if (missingRequired) return dish.price
    const { deltaCents } = resolveSelections(dish, selections)
    return (Math.round(dish.price * 100) + deltaCents) / 100
  }, [dish, selections, missingRequired])

  const name = lang === 'zh' ? dish.nameZh : dish.nameEn

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal options-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{name}</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        {(dish.optionGroups ?? []).map(g => (
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
          {t.options.addToCart} ${unitPrice.toFixed(2)}
        </button>
      </div>
    </div>
  )
}
