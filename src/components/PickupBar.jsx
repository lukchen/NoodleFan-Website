import { formatPickupAt, formatCutoffAt, timeToCutoff } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 吸顶状态条 —— 选定取餐点后一直在客人眼前。
// 时间信息写成带标签的两项(取餐时间 / 下单截止),各自带完整的星期+日期+时刻,
// 而不是把「周二 6:00 PM 周二 3:00PM 截单」堆成一行 —— 那样客人得自己猜哪个是哪个。
export default function PickupBar({ t, lang, onChange }) {
  const { point, run, now, ordersSoFar, minOrders } = usePickup()
  if (!point) return null

  const zh = lang === 'zh'
  const isStore = point.kind === 'store'
  const left = Math.max(0, minOrders - ordersSoFar)
  const countdown = timeToCutoff(run, now)
  const remaining = countdown && !countdown.expired
    ? t.pickup.remaining(countdown.hours, countdown.minutes)
    : ''

  return (
    <div className={`pickup-bar${isStore ? ' pickup-bar--store' : ''}`}>
      <span className="pickup-bar-icon" aria-hidden="true">{isStore ? '🏪' : '📍'}</span>

      <div className="pickup-bar-text">
        <div className="pickup-bar-line">
          <span className="pickup-bar-main">{zh ? point.nameZh : point.nameEn}</span>
          {/* 更换按钮紧跟取餐点名字,不甩到屏幕最右边 —— 手机单手够得到 */}
          <button type="button" className="pickup-bar-change" onClick={onChange}>
            <span className="pbc-long">{t.pickup.changeLong}</span>
            <span className="pbc-short">{t.pickup.change}</span>
          </button>
          {!isStore && (
            <span className={`pickup-bar-need${left === 0 ? ' pickup-bar-need--ready' : ''}`}>
              {left > 0 && <i className="live-dot" aria-hidden="true" />}
              {left === 0 ? t.pickup.ready : t.pickup.shortBy(left)}
            </span>
          )}
        </div>

        {isStore ? (
          <span className="pickup-bar-meta">{zh ? point.noteZh : point.noteEn}</span>
        ) : run ? (
          <div className="pickup-bar-when">
            <span className="pw-item">
              <span className="pw-label">{t.pickup.pickupAtRow}</span>
              <span className="pw-value">{formatPickupAt(run, lang)}</span>
            </span>
            <span className="pw-item pw-item--cutoff">
              <span className="pw-label">{t.pickup.cutoffRow}</span>
              <span className="pw-value">{formatCutoffAt(run, lang)}</span>
              {remaining && <span className="pw-remaining">{remaining}</span>}
            </span>
          </div>
        ) : (
          <span className="pickup-bar-meta">{t.pickup.noRun}</span>
        )}
      </div>
    </div>
  )
}
