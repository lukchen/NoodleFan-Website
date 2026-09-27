import { useState, useEffect, useMemo } from 'react'
import useScrollLock from '../useScrollLock'
import { usePickup } from '../context/PickupContext'
import { formatPickupAt, storeIsOpen, STORE_HOURS_TEXT, MIN_ORDERS } from '../pickup'
import { useCart } from '../context/CartContext'
import { QR_SRC, qrValid } from '../wechat-qr'
import { WechatModal } from './WechatNav'
import { SUPABASE_URL, SUPABASE_ANON_KEY, CHECKOUT_ENABLED } from '../config'
import '../checkout.css'

const TAX_RATE = 0.07 // MA 6.25% + Boston 本地附加 0.75%（与 create-checkout 保持一致）

function buildSlots() {
  const slots = []
  for (let h = 11; h <= 20; h++) {
    // 15 分钟一档 —— 半小时太粗,客人下了班想卡着点来取,只能在两档之间将就。
    for (const m of [0, 15, 30, 45]) {
      if (h === 20 && m > 0) break   // 最后一档 8:00 PM,给厨房留出到打烊的收尾时间
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const value = `${hh}:${mm}`
      const hour12 = h > 12 ? h - 12 : h
      const ampm = h >= 12 ? 'PM' : 'AM'
      const label = `${hour12}:${mm} ${ampm}`
      slots.push({ value, label })
    }
  }
  return slots
}

const TIME_SLOTS = buildSlots()

function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const FORM_KEY = 'nf_checkout_form'

export default function Checkout({ t, onClose }) {
  const { items, totalPrice } = useCart()
  const tax = totalPrice * TAX_RATE
  const grandTotal = totalPrice + tax

  const today = useMemo(() => toLocalDateString(new Date()), [])

  const { point, run } = usePickup()
  // 定点配送的取餐时刻是发车时间,不该让客人自己挑 —— 挑了也不作数。
  const fixedRun = point?.kind === 'dropoff' ? run : null

  // 打烊时段不拦单,当预约单处理 —— 只把已经过去的时段过滤掉,并明确告诉客人这是预约。
  const now = useMemo(() => new Date(), [])
  const openNow = storeIsOpen(now)
  // 到店自取只做当天 —— 现做现取,隔天的单没法保证品质,也占不了明天的备料。
  const cutoffMin = now.getHours() * 60 + now.getMinutes() + 20   // 留 20 分钟备餐
  const todaySlots = TIME_SLOTS.filter(sl => {
    const [h, m] = sl.value.split(':').map(Number)
    return h * 60 + m >= cutoffMin
  })

  // 表单也存本地 —— 从结账页退回菜单时这个组件会卸载,不存就等于客人白填一遍。
  // 存的是他自己设备上的联系方式,方便下次再来直接下单;卡号一概不经过这里。
  const [form, setForm] = useState(() => {
    const blank = { name: '', phone: '', email: '', date: today, time: '', note: '' }
    try {
      const raw = localStorage.getItem(FORM_KEY)
      if (!raw) return blank
      const saved = JSON.parse(raw)
      // 日期永远是今天;存的时段如果是昨天留下的就丢掉
      return { ...blank, ...saved, date: today, time: saved.date === today ? (saved.time ?? '') : '' }
    } catch { return blank }
  })

  useEffect(() => {
    try { localStorage.setItem(FORM_KEY, JSON.stringify(form)) } catch { /* ignore */ }
  }, [form])

  useScrollLock()

  // 定点配送:把日期/时间锁成这一班的发车时刻,表单校验照常通过。
  useEffect(() => {
    if (!fixedRun) return
    setForm(prev => ({
      ...prev,
      date: toLocalDateString(fixedRun.pickupAt),
      time: `${String(fixedRun.pickupAt.getHours()).padStart(2, '0')}:00`,
    }))
  }, [fixedRun])

  const [wechatOpen, setWechatOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isDirty = form.name || form.phone || form.email || form.time || form.note

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !isDirty) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, onClose])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleBackdrop() {
    if (isDirty) return
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!CHECKOUT_ENABLED) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          // Price/subtotal/tax/total are computed server-side from the canonical menu —
          // only the dish id, qty, and chosen options are sent.
          items: items.map(i => ({ id: i.id, qty: i.qty, selections: i.selections })),
          customer: { name: form.name, phone: form.phone, email: form.email },
          // 取餐点必须跟单走:少了它,Allston 的团购单和到店自取单在后台长得一模一样。
          pickupPoint: point
            ? { id: point.id, kind: point.kind, nameZh: point.nameZh, nameEn: point.nameEn }
            : null,
          // 哪一班车 —— 后台按「取餐点 + 发车日」统计成团进度并结算
          pickupRunDate: fixedRun ? toLocalDateString(fixedRun.pickupAt) : null,
          pickupDate: form.date,
          pickupTime: form.time,
          note: form.note,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout failed')
      window.location.href = data.url
    } catch {
      setError(t.checkout.errorMsg)
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleBackdrop}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.checkout.title}</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="checkout-summary">
          {items.map(item => {
            const opts = t.lang === 'zh' ? item.optionsZh : item.optionsEn
            return (
              <div key={item.key} className="checkout-summary-row">
                <span>
                  {t.lang === 'zh' ? item.nameZh : item.nameEn} × {item.qty}
                  {opts?.length > 0 && <span className="checkout-summary-opts"> ({opts.join(', ')})</span>}
                </span>
                <span>${(item.unitPrice * item.qty).toFixed(2)}</span>
              </div>
            )
          })}
          <div className="checkout-summary-row checkout-summary-subtotal">
            <span>{t.checkout.subtotal}</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
          <div className="checkout-summary-row">
            <span>{t.checkout.tax}</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="checkout-summary-row checkout-summary-total">
            <span>{t.cart.total}</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <form className="checkout-form" onSubmit={handleSubmit}>
          <label>
            {t.checkout.name}
            <input name="name" value={form.name} onChange={handleChange} required placeholder={t.checkout.namePlaceholder} />
          </label>
          <label>
            {t.checkout.phone}
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder={t.checkout.phonePlaceholder} />
          </label>
          <label>
            {t.checkout.email}
            <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder={t.checkout.emailPlaceholder} />
            <span className="checkout-field-hint">{t.checkout.emailNote}</span>
          </label>

          {/* 邮件是保底,群是更快的那条路 —— 紧挨着邮箱放,说的是同一件事:
              「我们怎么通知你」。不在群里的客人照样能下单,所以这里只是邀请。 */}
          {qrValid() && (
            <div className="checkout-wechat">
              {/* 这里的码只有 88px,直接扫勉强 —— 点一下开大图才是正经的扫码路径 */}
              <button
                type="button"
                className="checkout-wechat-thumb"
                onClick={() => setWechatOpen(true)}
                aria-label={t.checkout.wechatTitle}>
                <img
                  src={`${import.meta.env.BASE_URL}${QR_SRC}`}
                  alt={t.wechat.alt}
                  width="450"
                  height="708"
                  loading="lazy"
                />
              </button>
              <div className="checkout-wechat-text">
                <strong>{t.checkout.wechatTitle}</strong>
                <p>{t.checkout.wechatBody}</p>
              </div>
            </div>
          )}

{fixedRun ? (
            <div className="checkout-fixed-run">
              <span className="checkout-field-label">{t.checkout.pickupAtLabel}</span>
              <strong>{t.lang === 'zh' ? point.nameZh : point.nameEn} · {formatPickupAt(run, t.lang)}</strong>
            </div>
          ) : (<>
          {!openNow && (
            <p className="checkout-preorder">{t.checkout.preorderNote(STORE_HOURS_TEXT)}</p>
          )}

          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.date}</span>
            <p className="checkout-today">
              {t.checkout.dateToday} · {today}
              <span className="checkout-today-note">{t.checkout.todayOnly}</span>
            </p>
            <input type="hidden" name="date" value={today} />
          </div>

          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.time}</span>
            <input type="hidden" name="time" value={form.time} required />
            {todaySlots.length === 0 && (
              <p className="checkout-preorder">{t.checkout.noSlotsToday}</p>
            )}
            <div className="time-slots">
              {todaySlots.map(slot => (
                <button
                  key={slot.value}
                  type="button"
                  className={`time-slot${form.time === slot.value ? ' time-slot--active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, time: slot.value }))}>
                  {slot.label}
                </button>
              ))}
            </div>
            {!form.time && <p className="checkout-field-hint">{t.checkout.timeHint}</p>}
          </div>
          </>)}

          <label>
            {t.checkout.note}
            <textarea name="note" value={form.note} onChange={handleChange} rows={2} placeholder={t.checkout.notePlaceholder} />
          </label>

          {error && <p className="checkout-error">{error}</p>}

          {fixedRun && (
            <p className="checkout-hold-note">{t.checkout.holdNote(MIN_ORDERS)}</p>
          )}

          {!CHECKOUT_ENABLED && (
            <p className="checkout-disabled-note">{t.checkout.disabledNote}</p>
          )}

          <button
            type="submit"
            className="btn-primary checkout-submit"
            disabled={!CHECKOUT_ENABLED || submitting || !form.time}>
            {!CHECKOUT_ENABLED
              ? t.checkout.disabled
              : submitting ? t.checkout.processing : `${t.checkout.pay} $${grandTotal.toFixed(2)}`}
          </button>
        </form>
      </div>
      {wechatOpen && <WechatModal t={t} onClose={() => setWechatOpen(false)} />}
    </div>
  )
}
