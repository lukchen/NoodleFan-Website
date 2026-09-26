import { formatRun } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 菜单页顶部的吸顶条 —— 一句话回答「我在给哪儿、哪天点餐」,外加一个回去改的入口。
//
// 为什么必须常驻:取餐点和日期决定了这一单能不能成团、几点截单,客人滑了三屏菜之后
// 很容易忘了自己是在给 Allston 周一那班点。购物车里虽然也写了,但购物车是空的时候
// 底部栏不出现,新客人反而最需要这个提示。
export default function PickupStrip({ t, lang }) {
  const { point, run, startChange } = usePickup()
  if (!point) return null

  const zh = lang === 'zh'
  const isStore = point.kind === 'store'

  return (
    <div className={`pickup-strip${isStore ? ' pickup-strip--store' : ''}`}>
      <span className="pickup-strip-icon" aria-hidden="true">{isStore ? '🏪' : '📍'}</span>
      <span className="pickup-strip-name">{zh ? point.nameZh : point.nameEn}</span>
      <span className="pickup-strip-when">
        {isStore ? (zh ? point.hoursZh : point.hoursEn) : formatRun(run, lang)}
      </span>
      <button type="button" className="pickup-strip-change" onClick={startChange}>
        {t.pickup.change}
      </button>
    </div>
  )
}
