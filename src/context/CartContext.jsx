import { createContext, useContext, useState, useEffect } from 'react'
import menu, { resolveSelections } from '../data/menu'

const CartContext = createContext(null)

// A cart line is a dish + a specific option combination; the same dish with different
// options (e.g. 炒粉·牛肉·中辣 vs 炒粉·猪肉·微辣) is a separate line with its own qty.
// `key` is the line identity: dish id + canonical (default-filled, sorted) selections.
function lineKey(dishId, normalized) {
  return `${dishId}|${JSON.stringify(normalized)}`
}

// 购物车存本地 —— 客人加了菜去别处看一眼再回来、或者手机切出去接个电话,
// 回来东西还在。不存的话这一趟就白点了,多数人不会再点第二遍。
// 只存购物车内容,不碰任何支付信息(卡号在 Stripe 托管页面,我们这边从来拿不到)。
const CART_KEY = 'nf_cart'

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // 存的是旧版本结构或者被人手改过就直接丢掉,宁可空购物车也不要渲染崩掉
    return Array.isArray(parsed) ? parsed.filter(i => i && i.key && i.qty > 0) : []
  } catch { return [] }
}

export function CartProvider({ children }) {
  // [{ key, id, nameEn, nameZh, unitPrice, qty, optionsZh, optionsEn, selections }]
  const [items, setItems] = useState(loadCart)

  useEffect(() => {
    try {
      if (items.length) localStorage.setItem(CART_KEY, JSON.stringify(items))
      else localStorage.removeItem(CART_KEY)
    } catch { /* 无痕模式/禁用存储 —— 功能照常,只是不记住 */ }
  }, [items])
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
