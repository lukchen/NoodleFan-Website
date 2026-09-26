import { QR_SRC, qrValid } from '../wechat-qr'
import '../wechat.css'

// 微信群入口 —— 放在菜单末尾。
//
// 群不是「联系方式」,是运营渠道:发车通知、当天未成团的取消通知、限时优惠都走群。
// 所以文案讲的是「进群能拿到什么」,不是「欢迎加我们微信」。
//
// 二维码过期就整块不渲染 —— 扫出来报错比没有更伤。
export default function WechatGroup({ t }) {
  if (!qrValid()) return null

  return (
    <section className="wechat" id="wechat">
      <div className="wechat-card">
        <div className="wechat-text">
          <span className="wechat-eyebrow">{t.wechat.eyebrow}</span>
          <h3 className="wechat-title">{t.wechat.title}</h3>
          <ul className="wechat-list">
            {t.wechat.perks.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="wechat-scan">{t.wechat.scan}</p>
        </div>
        <div className="wechat-qr">
          <img src={QR_SRC} alt={t.wechat.alt} width="400" height="400" loading="lazy" />
        </div>
      </div>
    </section>
  )
}
