import { useState } from 'react'
import strings from './i18n/strings'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MenuSection from './components/MenuSection'
import Footer from './components/Footer'
import './App.css'

export default function App() {
  const [lang, setLang] = useState('en')
  const t = strings[lang]

  return (
    <>
      <Navbar t={t} lang={lang} onToggleLang={() => setLang(lang === 'en' ? 'zh' : 'en')} />
      <main>
        <Hero t={t} />
        <MenuSection t={t} lang={lang} />
      </main>
      <Footer t={t} />
    </>
  )
}
