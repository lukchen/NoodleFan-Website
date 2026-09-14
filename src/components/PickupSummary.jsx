import { formatPickupAt, formatCutoffAt, timeToCutoff } from '../pickup'
import { usePickup } from '../context/PickupContext'

// 取餐方式摘要 —— 放在「我的订单」最上面。
// 取餐点是这一单的前提(决定截单时间、备料份数、能不能成团),所以它属于订单本身,
// 而不是一条飘在页面顶部的横幅。客人看购物车时一定会看到它。
export default function PickupSummary({ t, lang }) {
  const { point, run, now, ordersSoFar, minOrders, startChange } = usePickup()
  if (!point) return null

  const zh = lang === 'zh'
  const isStore = point.kind === 'store'
  const left = Math.max(0, minOrders - ordersSoFar)
  const countdown = timeToCutoff(run, now)
  const remaining = countdown && !countdown.expired
    ? t.pickup.remaining(countdown.hours, countdown.minutes)
    : ''

  return (
    <div className={`pickup-sum${isStore ? ' pickup-sum--store' : ''}`}>
      <div className="pickup-sum-head">
        <span className="pickup-sum-icon" aria-hidden="true">{isStore ? '🏪' : '📍'}</span>
        <span className="pickup-sum-name">{zh ? point.nameZh : point.nameEn}</span>
        <button type="button" className="pickup-sum-change" onClick={startChange}>
          {t.pickup.change}
        </button>
      </div>

      {isStore ? (
        <div className="pickup-sum-rows">
          <span className="pw-item">
            <span className="pw-label">{t.pickup.hoursRow}</span>
            <span className="pw-value">{zh ? point.hoursZh : point.hoursEn}</span>
          </span>
        </div>
      ) : run ? (
        <>
          <div className="pickup-sum-rows">
            <span className="pw-item">
              <span className="pw-label">{t.pickup.pickupAtRow}</span>
              <span className="pw-value">{formatPickupAt(run, lang)}</span>
            </span>
            <span className="pw-item pw-item--cutoff">
              <span className="pw-label">{t.pickup.cutoffRow}</span>
              <span className="pw-value">{formatCutoffAt(run, lang)}</span>
            </span>
          </div>
          <div className="pickup-sum-foot">
            {remaining && <span className="pw-remaining">{remaining}</span>}
            <span className={`pickup-sum-need${left === 0 ? ' pickup-sum-need--ready' : ''}`}>
              {left > 0 && <i className="live-dot" aria-hidden="true" />}
              {left === 0 ? t.pickup.ready : t.pickup.shortBy(left)}
            </span>
          </div>
        </>
      ) : (
        <div className="pickup-sum-rows"><span className="pw-value">{t.pickup.noRun}</span></div>
      )}
    </div>
  )
}
