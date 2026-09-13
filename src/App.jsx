import { useState, useEffect } from 'react'
import strings from './i18n/strings'
import { CartProvider, useCart } from './context/CartContext'
import { PickupProvider, usePickup } from './context/PickupContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MenuSection from './components/MenuSection'
import Cart from './components/Cart'
import Checkout from './components/Checkout'
import Footer from './components/Footer'
import Admin from './components/Admin'
import PickupBar from './components/PickupBar'
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
  // 取餐方式不用弹窗:首页菜单的位置直接铺三个大按钮,选完才换成菜单。
  // changing = 客人点了顶栏的「更换取餐方式」,暂时把菜单换回选择界面。
  const [changing, setChanging] = useState(false)
  const { clearCart } = useCart()
  const { point } = usePickup()

  // 「更换取餐方式」:把菜单换回选择界面,并滚到它面前。
  function startChanging() {
    setChanging(true)
    requestAnimationFrame(() => {
      const el = document.getElementById('menu')
      if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' })
    })
  }

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
      {ORDERING_ENABLED && point && (
        <PickupBar t={t} lang={lang} onChange={startChanging} />
      )}
      <main>
        <Hero t={t} />
        <MenuSection
          t={t}
          lang={lang}
          choosingPickup={ORDERING_ENABLED && (!point || changing)}
          onPickupChosen={() => setChanging(false)}
        />
      </main>
      <Footer t={t} />
      {ORDERING_ENABLED && <MobileCartBar t={t} />}
      {ORDERING_ENABLED && <Cart t={t} onCheckout={() => setCheckoutOpen(true)} />}
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