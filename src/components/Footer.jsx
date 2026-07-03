export default function Footer({ t }) {
  return (
    <footer className="footer">
      <img className="footer-logo" src={`${import.meta.env.BASE_URL}images/logo-full.png`} alt="NoodleFan 粉面王" />
      <p>{t.footer.copy}</p>
    </footer>
  )
}
