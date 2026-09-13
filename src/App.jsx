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
import PickupPicker from './components/PickupPicker'
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
  // 第一次进站(还没选过取餐点)直接把选择器推到脸上 —— 取餐点决定截单时间和
  // 当天备料,菜单必须在它之后。没选之前这个弹窗不可关闭。
  const [pickerOpen, setPickerOpen] = useState(false)
  const { clearCart } = useCart()
  const { point } = usePickup()

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
        <PickupBar t={t} lang={lang} onChange={() => setPickerOpen(true)} />
      )}
      <main>
        <Hero t={t} onOrder={ORDERING_ENABLED && !point ? () => setPickerOpen(true) : undefined} />
        <MenuSection t={t} lang={lang} onChoosePickup={() => setPickerOpen(true)} />
      </main>
      <Footer t={t} />
      {ORDERING_ENABLED && <MobileCartBar t={t} />}
      {ORDERING_ENABLED && (pickerOpen || !point) && (
        <PickupPicker
          t={t}
          lang={lang}
          dismissable={!!point}
          onClose={() => setPickerOpen(false)}
        />
      )}
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
