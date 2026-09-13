import { PICKUP_POINTS, nextRun, formatRun, MIN_ORDERS } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 取餐方式三选一 —— 看菜单之前的第一个决定,因为它决定截单时间、备料份数和是否成团。
// 定点配送卡上的进度条是转化引擎:「还差 N 单发车」促使客人去群里喊人凑单。
export default function PickupPicker({ t, lang, onClose, dismissable = true }) {
  const { pointId, setPointId, now, ordersSoFar, minOrders } = usePickup()
  const zh = lang === 'zh'

  function choose(id) {
    setPointId(id)
    onClose?.()
  }

  return (
    <div className="modal-overlay" onClick={dismissable ? onClose : undefined}>
      <div className="modal pickup-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.pickup.title}</h2>
          {dismissable && <button className="cart-close" onClick={onClose}>✕</button>}
        </div>
        <p className="pickup-sub">{t.pickup.subtitle}</p>

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
                  {!isStore && run && (
                    <span className="pickup-cutoff">{t.pickup.cutoffAt}</span>
                  )}
                </span>

                <span className="pickup-option-area">{zh ? p.areaZh : p.areaEn}</span>

                {isStore ? (
                  <span className="pickup-option-note">{zh ? p.noteZh : p.noteEn}</span>
                ) : run ? (
                  <>
                    <span className="pickup-option-note">
                      {t.pickup.arrives} {formatRun(run, lang)}
                    </span>
                    <span className="pickup-progress">
                      <span className="pickup-dots" aria-hidden="true">
                        {Array.from({ length: minOrders }, (_, i) => (
                          <i key={i} className={i < filled ? 'on' : ''} />
                        ))}
                      </span>
                      <span className="pickup-progress-text">
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

        <p className="pickup-fineprint">{t.pickup.fineprint(MIN_ORDERS)}</p>
      </div>
    </div>
  )
}
