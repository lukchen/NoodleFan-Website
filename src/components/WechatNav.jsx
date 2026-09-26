import { useState, useEffect } from 'react'
import { QR_SRC, qrValid } from '../wechat-qr'
import useScrollLock from '../useScrollLock'
import useVisualViewport from '../useVisualViewport'
import '../wechat.css'

// 微信群入口 —— 常驻导航栏。
//
// 群是运营渠道不是联系方式:发车提醒、未成团的取消通知、群友优惠都走群,
// 所以它得跟购物车一样一直在,而不是藏在页面最底下等客人滚到。
//
// 点开是整屏大图:客人多半在手机上看,得能长按保存到相册、再用微信扫。
// 二维码过期就连按钮一起不渲染 —— 扫出来报错比没有更伤。
export default function WechatNav({ t }) {
  const [open, setOpen] = useState(false)
  if (!qrValid()) return null

  return (
    <>
      <button className="wechat-nav-btn" onClick={() => setOpen(true)}>
        {/* 带个小码缩略图 —— 光一个「微信群」文字按钮客人不知道点开是什么,
            看见是二维码才会想到「哦,可以扫」。见 wechat.css 里的裁切说明。 */}
        <span className="wechat-nav-thumb" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}${QR_SRC}`} alt="" />
        </span>
        {t.wechat.navBtn}
      </button>
      {open && <WechatModal t={t} onClose={() => setOpen(false)} />}
    </>
  )
}

// 结账页也用这个弹窗 —— 同一个群、同一套说明,没必要两处各写一遍。
export function WechatModal({ t, onClose }) {
  useScrollLock()
  useVisualViewport()   // iOS 地址栏收放时把弹窗对回可见区

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay wechat-overlay" onClick={onClose}>
      <div className="modal-frame">
        <div className="wechat-modal" onClick={e => e.stopPropagation()}>
          <button className="wechat-close" onClick={onClose} aria-label={t.wechat.close}>✕</button>

          <h2 className="wechat-title">{t.wechat.title}</h2>
          <ul className="wechat-list">
            {t.wechat.perks.map((p, i) => <li key={i}>{p}</li>)}
          </ul>

          {/* 整张群名片原样放大 —— 微信导出的图自带群名和有效期 */}
          <img
            className="wechat-img"
            src={`${import.meta.env.BASE_URL}${QR_SRC}`}
            alt={t.wechat.alt}
            width="450"
            height="708"
          />

          <p className="wechat-scan">{t.wechat.scan}</p>
        </div>
      </div>
    </div>
  )
}
