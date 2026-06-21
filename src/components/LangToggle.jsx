export default function LangToggle({ lang, onToggle }) {
  return (
    <button onClick={onToggle} className="lang-toggle">
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  )
}
