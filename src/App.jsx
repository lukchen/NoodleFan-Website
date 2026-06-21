import { useState } from 'react'
import strings from './i18n/strings'
import { CartProvider } from './context/CartContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MenuSection from './components/MenuSection'
import Cart from './components/Cart'
import Checkout from './components/Checkout'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  const [lang, setLang] = useState('zh')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const t = { ...strings[lang], lang }

  return (
    <CartProvider>
      <Navbar t={t} lang={lang} onToggleLang={() => setLang(lang === 'en' ? 'zh' : 'en')} />
      <main>
        <Hero t={t} />
        <MenuSection t={t} lang={lang} />
      </main>
      <Footer t={t} />
      <Cart t={t} onCheckout={() => setCheckoutOpen(true)} />
      {checkoutOpen && <Checkout t={t} onClose={() => setCheckoutOpen(false)} />}
    </CartProvider>
  )
}
