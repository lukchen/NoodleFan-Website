import { createContext, useContext, useState } from 'react'
import { resolveSelections } from '../data/menu'

const CartContext = createContext(null)

// A cart line is a dish + a specific option combination; the same dish with different
// options (e.g. 炒粉·牛肉·中辣 vs 炒粉·猪肉·微辣) is a separate line with its own qty.
// `key` is the line identity: dish id + canonical (default-filled, sorted) selections.
function lineKey(dishId, normalized) {
  return `${dishId}|${JSON.stringify(normalized)}`
}

export function CartProvider({ children }) {
  // [{ key, id, nameEn, nameZh, unitPrice, qty, optionsZh, optionsEn, selections }]
  const [items, setItems] = useState([])
  const [cartOpen, setCartOpen] = useState(false)

  function addItem(dish, selections = {}) {
    const { deltaCents, optionsZh, optionsEn, normalized } = resolveSelections(dish, selections)
    const key = lineKey(dish.id, normalized)
    const unitPrice = (Math.round(dish.price * 100) + deltaCents) / 100
    setItems(prev => {
      const existing = prev.find(i => i.key === key)
      if (existing) return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, {
        key, id: dish.id,
        nameEn: dish.nameEn, nameZh: dish.nameZh,
        unitPrice, qty: 1,
        optionsZh, optionsEn,
        selections: normalized,
      }]
    })
    // don't auto-open drawer — user stays on menu to keep adding
  }

  function removeItem(key) {
    setItems(prev => prev.filter(i => i.key !== key))
  }

  function updateQty(key, qty) {
    if (qty < 1) return removeItem(key)
    setItems(prev => prev.map(i => i.key === key ? { ...i, qty } : i))
  }

  function clearCart() {
    setItems([])
  }

  // Total qty of a dish across all its option lines (for the menu-card badge).
  function dishQty(dishId) {
    return items.reduce((s, i) => s + (i.id === dishId ? i.qty : 0), 0)
  }

  const totalItems = items.reduce((s, i) => s + i.qty, 0)
  const totalPrice = items.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, dishQty, totalItems, totalPrice, cartOpen, setCartOpen }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
