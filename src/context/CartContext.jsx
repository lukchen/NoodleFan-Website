import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([]) // [{ id, nameEn, nameZh, price, qty }]
  const [cartOpen, setCartOpen] = useState(false)

  function addItem(dish) {
    setItems(prev => {
      const existing = prev.find(i => i.id === dish.id)
      if (existing) return prev.map(i => i.id === dish.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: dish.id, nameEn: dish.nameEn, nameZh: dish.nameZh, price: dish.price, qty: 1 }]
    })
    setCartOpen(true)
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateQty(id, qty) {
    if (qty < 1) return removeItem(id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  function clearCart() {
    setItems([])
  }

  const totalItems = items.reduce((s, i) => s + i.qty, 0)
  const totalPrice = items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice, cartOpen, setCartOpen }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
