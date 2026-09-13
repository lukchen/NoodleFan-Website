import { PICKUP_POINTS, nextRun, formatPickupAt, formatCutoffAt, MIN_ORDERS } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 取餐方式三选一 —— 看菜单之前的第一个决定,因为它决定截单时间、备料份数和是否成团。
// 定点配送卡上的进度条是转化引擎:「还差 N 单发车」促使客人去群里喊人凑单。
//
// 两种形态:inline(首页上中下三个大按钮,菜单位置直接铺开,不弹窗)和 modal(保留,
// 目前没人用)。默认 inline —— 弹窗会挡住页面,客人第一眼看到的应该是选择本身。
export default function PickupPicker({ t, lang, onClose, dismissable = true, inline = false }) {
  const { pointId, setPointId, now, ordersSoFar, minOrders } = usePickup()
  const zh = lang === 'zh'

  function choose(id) {
    setPointId(id)
    onClose?.()
  }

  const options = (
    <div className="pickup-options">
          {PICKUP_POINTS.map(p => {
            const run = nextRun(p, now)
            const active = pointId === p.id
            const isStore = p.kind === 'store'
            const left = Math.max(0, minOrders - ordersSoFar)
            const filled = Math.min(ordersSoFar, minOrders)
            return (
              <button
                key={p.id}
                type="button"
                className={`pickup-option${active ? ' pickup-option--active' : ''}`}
                onClick={() => choose(p.id)}>
                <span className="pickup-option-head">
                  <span className="pickup-icon" aria-hidden="true">{isStore ? '🏪' : '📍'}</span>
                  <span className="pickup-option-name">{zh ? p.nameZh : p.nameEn}</span>
                </span>

                <span className="pickup-option-area">{zh ? p.areaZh : p.areaEn}</span>

                {isStore ? (
                  <>
                    <span className="pickup-when">
                      <span className="pw-item">
                        <span className="pw-label">{t.pickup.hoursRow}</span>
                        <span className="pw-value">{zh ? p.hoursZh : p.hoursEn}</span>
                      </span>
                    </span>
                    <span className="pickup-option-note">{zh ? p.noteZh : p.noteEn}</span>
                  </>
                ) : run ? (
                  <>
                    <span className="pickup-when">
                      <span className="pw-item">
                        <span className="pw-label">{t.pickup.pickupAtRow}</span>
                        <span className="pw-value">{formatPickupAt(run, lang)}</span>
                      </span>
                      <span className="pw-item pw-item--cutoff">
                        <span className="pw-label">{t.pickup.cutoffRow}</span>
                        <span className="pw-value">{formatCutoffAt(run, lang)}</span>
                      </span>
                    </span>
                    <span className="pickup-progress">
                      <span className="pickup-dots" aria-hidden="true">
                        {Array.from({ length: minOrders }, (_, i) => (
                          <i key={i} className={i < filled ? 'on' : ''} />
                        ))}
                      </span>
                      <span className="pickup-progress-text">
                        {left > 0 && <i className="live-dot" aria-hidden="true" />}
                        {left === 0
                          ? t.pickup.ready
                          : t.pickup.needMore(ordersSoFar, minOrders, left)}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="pickup-option-note">{t.pickup.noRun}</span>
                )}
              </button>
            )
      })}
    </div>
  )

  if (inline) {
    return (
      <div className="pickup-choose">
        <span className="pickup-choose-step">{t.pickup.step1}</span>
        <h3 className="pickup-choose-title">{t.pickup.title}</h3>
        <p className="pickup-choose-sub">{t.pickup.subtitle}</p>
        {options}
        <p className="pickup-fineprint">{t.pickup.fineprint(MIN_ORDERS)}</p>
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
        <p className="pickup-sub">{t.pickup.subtitle}</p>
        {options}
        <p className="pickup-fineprint">{t.pickup.fineprint(MIN_ORDERS)}</p>
      </div>
    </div>
  )
}
