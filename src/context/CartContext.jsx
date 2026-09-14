import { createContext, useContext, useState } from 'react'
import menu, { resolveSelections } from '../data/menu'

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
  // 正在改配置的那一行(点购物车里的「修改」打开选项框)。放在 context 里是因为
  // 触发点有两个(桌面面板 / 手机抽屉),而选项框只渲染一个。
  const [editing, setEditing] = useState(null)

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

  // 改完配置:原来那行按新配置重算。如果新配置和购物车里另一行撞了,就合并数量。
  function replaceItem(key, dish, selections) {
    const { deltaCents, optionsZh, optionsEn, normalized } = resolveSelections(dish, selections)
    const newKey = lineKey(dish.id, normalized)
    const unitPrice = (Math.round(dish.price * 100) + deltaCents) / 100
    setItems(prev => {
      const old = prev.find(i => i.key === key)
      if (!old) return prev
      const rest = prev.filter(i => i.key !== key)
      const dup = rest.find(i => i.key === newKey)
      if (dup) return rest.map(i => i.key === newKey ? { ...i, qty: i.qty + old.qty } : i)
      return prev.map(i => i.key === key
        ? { ...i, key: newKey, unitPrice, optionsZh, optionsEn, selections: normalized }
        : i)
    })
  }

  function startEdit(item) {
    const dish = menu.find(d => d.id === item.id)
    if (dish && (dish.optionGroups ?? []).length > 0) setEditing({ key: item.key, dish, selections: item.selections })
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
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, dishQty, totalItems, totalPrice, cartOpen, setCartOpen, editing, startEdit, stopEdit: () => setEditing(null), replaceItem }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
