import { useEffect } from 'react'
import { PICKUP_POINTS, upcomingRuns, formatPickupAt, formatCutoffAt, formatRunDate, MIN_ORDERS } from '../pickup'
import { usePickup } from '../context/PickupContext'
import '../pickup-sum.css'

// 取餐方式三选一 —— 看菜单之前的第一个决定,因为它决定截单时间和备料份数。
//
// 不显示凑单进度:「还差 N 单」会让客人担心自己这单到底做不做,反而不敢下单。
// 未成团我们在群里通知取消,不必让每个人盯着计数器。
//
// 两种形态:inline(首页上中下三个大按钮,菜单位置直接铺开,不弹窗)和 modal(保留,
// 目前没人用)。默认 inline —— 弹窗会挡住页面,客人第一眼看到的应该是选择本身。
export default function PickupPicker({ t, lang, onClose, dismissable = true, inline = false }) {
  const { pointId, choose: chooseRun, runKey, now } = usePickup()
  const zh = lang === 'zh'

  // 已经选过取餐点的,按 Esc 等于「不换了」—— 和弹窗一个习惯。
  // 没选过就没得退:菜单还锁着,退回去是一片空白。
  useEffect(() => {
    if (!pointId || !onClose) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pointId, onClose])

  function choose(id, key = null) {
    chooseRun(id, key)
    onClose?.()
  }

  const options = (
    <div className="pickup-options">
          {PICKUP_POINTS.map(p => {
            const active = pointId === p.id
            const isStore = p.kind === 'store'

            // 到店自取没有班次,整张卡就是一个按钮。
            if (isStore) {
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`pickup-option${active ? ' pickup-option--active' : ''}`}
                  onClick={() => choose(p.id)}>
                  <span className="pickup-option-head">
                    <span className="pickup-icon" aria-hidden="true">🏪</span>
                    <span className="pickup-option-name">{zh ? p.nameZh : p.nameEn}</span>
                  </span>
                  <span className="pickup-option-area">{zh ? p.areaZh : p.areaEn}</span>
                  <span className="pickup-when">
                    <span className="pw-item">
                      <span className="pw-label">{t.pickup.hoursRow}</span>
                      <span className="pw-value">{zh ? p.hoursZh : p.hoursEn}</span>
                    </span>
                  </span>
                  <span className="pickup-option-note">{zh ? p.noteZh : p.noteEn}</span>
                </button>
              )
            }

            // 定点配送每天都跑,开放明天和后天 —— 日期直接摊在卡上让客人挑,
            // 因为每一天是独立的一班:各自截单、各自备料。
            const runs = upcomingRuns(p, now)
            return (
              <div key={p.id} className={`pickup-option pickup-option--multi${active ? ' pickup-option--active' : ''}`}>
                <span className="pickup-option-head">
                  <span className="pickup-icon" aria-hidden="true">📍</span>
                  <span className="pickup-option-name">{zh ? p.nameZh : p.nameEn}</span>
                </span>
                <span className="pickup-option-area">{zh ? p.areaZh : p.areaEn}</span>

                <div className="pickup-days">
                  {runs.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      className={`pickup-day${active && runKey === r.key ? ' pickup-day--active' : ''}`}
                      onClick={() => choose(p.id, r.key)}>
                      <span className="pickup-day-date">{formatRunDate(r, lang)}</span>
                      <span className="pickup-when">
                        <span className="pw-item">
                          <span className="pw-label">{t.pickup.pickupAtRow}</span>
                          <span className="pw-value">{formatPickupAt(r, lang)}</span>
                        </span>
                        <span className="pw-item pw-item--cutoff">
                          <span className="pw-label">{t.pickup.cutoffRow}</span>
                          <span className="pw-value">{formatCutoffAt(r, lang)}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )
      })}
    </div>
  )

  if (inline) {
    return (
      <div className="pickup-choose">
        {/* 返回放在最上面 —— 客人点进来发现选错了,第一反应是找左上角。
            页面底部原来还有一个「不换了,继续用 X」,和这个重复,已删。 */}
        {pointId && (
          <button type="button" className="pickup-back" onClick={onClose}>
            <span aria-hidden="true">←</span> {t.pickup.backToMenu}
          </button>
        )}
        <h3 className="pickup-choose-title">{t.pickup.title}</h3>
        <p className="pickup-choose-sub">{t.pickup.subtitle(MIN_ORDERS)}</p>
        {options}
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={dismissable ? onClose : undefined}>
      <div className="modal pickup-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.pickup.title}</h2>
          {dismissable && <button className="cart-close" onClick={onClose}>✕</button>}
        </div>
        <p className="pickup-sub">{t.pickup.subtitle(MIN_ORDERS)}</p>
        {options}
      </div>
    </div>
  )
}
