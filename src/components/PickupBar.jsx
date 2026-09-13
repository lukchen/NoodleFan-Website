import { formatRun, formatCutoffDay, timeToCutoff } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 吸顶状态条 —— 选定取餐点后一直在客人眼前。
// 之前做成一条细窄的深色 tab,客人容易整条略过,所以改成:左侧一道品牌红竖条 +
// 明确的「取餐方式」小标签 + 大字取餐点名,右边是带边框的「更换取餐方式」按钮。
// 倒计时和「还差 N 单」是定点配送的两个催单杠杆,必须常驻。
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

      <span className="pickup-bar-text">
        <span className="pickup-bar-label">{t.pickup.pickupAtLabel}</span>
        <span className="pickup-bar-line">
          <span className="pickup-bar-main">{zh ? point.nameZh : point.nameEn}</span>
          {/* 更换按钮紧跟取餐点名字,不甩到屏幕最右边 —— 手机单手够得到 */}
          <button type="button" className="pickup-bar-change" onClick={onChange}>
            <span className="pbc-long">{t.pickup.changeLong}</span>
            <span className="pbc-short">{t.pickup.change}</span>
          </button>
          {isStore ? (
            <span className="pickup-bar-meta">{zh ? point.noteZh : point.noteEn}</span>
          ) : (
            <>
              {run && <span className="pickup-bar-meta">{formatRun(run, lang)}</span>}
              {countdown && !countdown.expired && (
                <span className="pickup-bar-countdown">
                  {countdown.hours < 24
                    ? t.pickup.closesIn(countdown.hours, countdown.minutes)
                    : t.pickup.closesOn(formatCutoffDay(run, lang))}
                </span>
              )}
              <span className={`pickup-bar-need${left === 0 ? ' pickup-bar-need--ready' : ''}`}>
                {left === 0 ? t.pickup.ready : t.pickup.shortBy(left)}
              </span>
            </>
          )}
        </span>
      </span>

    </div>
  )
}
