import { formatRun, formatCutoffDay, timeToCutoff } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 吸顶状态条 —— 选定取餐点后一直在客人眼前。倒计时和「还差 N 单」这两个数字
// 是定点配送的两个催单杠杆,所以它们不能藏在页面某处,必须常驻。
export default function PickupBar({ t, lang, onChange }) {
  const { point, run, now, ordersSoFar, minOrders } = usePickup()
  if (!point) return null

  const zh = lang === 'zh'
  const isStore = point.kind === 'store'
  const left = Math.max(0, minOrders - ordersSoFar)
  const countdown = timeToCutoff(run, now)

  return (
    <div className={`pickup-bar${isStore ? ' pickup-bar--store' : ''}`}>
      <span className="pickup-bar-icon" aria-hidden="true">{isStore ? '🏪' : '📍'}</span>
      <span className="pickup-bar-main">{zh ? point.nameZh : point.nameEn}</span>

      {isStore ? (
        <span className="pickup-bar-meta">{zh ? point.noteZh : point.noteEn}</span>
      ) : (
        <>
          {run && <span className="pickup-bar-meta">{formatRun(run, lang)}</span>}
          {countdown && !countdown.expired && (
            <span className="pickup-bar-countdown">
              {countdown.hours &lt; 24
                ? t.pickup.closesIn(countdown.hours, countdown.minutes)
                : t.pickup.closesOn(formatCutoffDay(run, lang))}
            </span>
          )}
          <span className={`pickup-bar-need${left === 0 ? ' pickup-bar-need--ready' : ''}`}>
            {left === 0 ? t.pickup.ready : t.pickup.shortBy(left)}
          </span>
        </>
      )}

      <button type="button" className="pickup-bar-change" onClick={onChange}>
        {t.pickup.change}
      </button>
    </div>
  )
}
