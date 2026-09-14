import { useState, useEffect } from 'react'
import strings from './i18n/strings'
import { CartProvider, useCart } from './context/CartContext'
import { PickupProvider, usePickup } from './context/PickupContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MenuSection from './components/MenuSection'
import OptionsModal from './components/OptionsModal'
import Cart from './components/Cart'
import Checkout from './components/Checkout'
import Footer from './components/Footer'
import Admin from './components/Admin'
import MobileCartBar from './components/MobileCartBar'
import OrderStatus from './components/OrderStatus'
import { ORDERING_ENABLED } from './config'
import './App.css'

function OrderSuccess({ t, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="checkout-success">
          <div className="checkout-success-icon">✓</div>
          <h2>{t.checkout.successTitle}</h2>
          <p>{t.checkout.successMsg}</p>
          <button className="btn-primary" style={{ marginTop: '1.5rem' }} onClick={onClose}>
            {t.checkout.done}
          </button>
        </div>
      </div>
    </div>
  )
}

function AppInner({ t, lang, setLang }) {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const { clearCart, editing, stopEdit, replaceItem } = useCart()
  // 取餐方式不再用吸顶横幅,而是放在「我的订单」最上面 —— 它是订单的一部分。
  const { point, changing, endChange } = usePickup()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setOrderSuccess(true)
      clearCart()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [clearCart])

  return (
    <>
      <Navbar t={t} lang={lang} onToggleLang={() => setLang(lang === 'en' ? 'zh' : 'en')} />
      <main>
        {/* 点餐开放后首屏直接给取餐方式选择;没开放时才用 hero 承载外卖平台入口 */}
        {!ORDERING_ENABLED && <Hero t={t} />}
        <MenuSection
          t={t}
          lang={lang}
          choosingPickup={ORDERING_ENABLED && (!point || changing)}
          onPickupChosen={endChange}
        />
      </main>
      <Footer t={t} />
      {ORDERING_ENABLED && <MobileCartBar t={t} lang={lang} />}
      {ORDERING_ENABLED && <Cart t={t} lang={lang} onCheckout={() => setCheckoutOpen(true)} />}
      {editing && (
        <OptionsModal
          dish={editing.dish}
          initial={editing.selections}
          mode="edit"
          t={t}
          lang={lang}
          onAdd={(dish, sel) => replaceItem(editing.key, dish, sel)}
          onClose={stopEdit}
        />
      )}
      {ORDERING_ENABLED && checkoutOpen && <Checkout t={t} onClose={() => setCheckoutOpen(false)} />}
      {orderSuccess && <OrderSuccess t={t} onClose={() => setOrderSuccess(false)} />}
    </>
  )
}

export default function App() {
  const [lang, setLang] = useState('zh')
  const [hash, setHash] = useState(window.location.hash)
  const t = { ...strings[lang], lang }

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#admin') return <Admin />

  // A saved/returned-from-Stripe link carries ?session_id — show that order's status.
  const sessionId = new URLSearchParams(window.location.search).get('session_id')

  return (
    <PickupProvider>
    <CartProvider>
      {sessionId
        ? <OrderStatus sessionId={sessionId} t={t} lang={lang} setLang={setLang} />
        : <AppInner t={t} lang={lang} setLang={setLang} />}
    </CartProvider>
    </PickupProvider>
  )
}
