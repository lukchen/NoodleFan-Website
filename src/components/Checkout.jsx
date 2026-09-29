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
  const tomorrow = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return toLocalDateString(d)
  }, [])

  const { point, run } = usePickup()
  // 定点配送的取餐时刻是发车时间,不该让客人自己挑 —— 挑了也不作数。
  const fixedRun = point?.kind === 'dropoff' ? run : null

  // 打烊时段不拦单,当预约单处理 —— 只把已经过去的时段过滤掉,并明确告诉客人这是预约。
  const now = useMemo(() => new Date(), [])
  const openNow = storeIsOpen(now)
  // 今天还剩哪些时段 —— 已经过去的、以及 20 分钟备餐来不及的,都去掉。
  const cutoffMin = now.getHours() * 60 + now.getMinutes() + 20
  const todaySlots = TIME_SLOTS.filter(sl => {
    const [h, m] = sl.value.split(':').map(Number)
    return h * 60 + m >= cutoffMin
  })

  // 今天的时段全过了(打烊、或者离最后一档不足 20 分钟)就顺延到明天,整天的时段都放开。
  // 不这么做的话,晚上来的客人看到一句「今天没时段了」就直接走了 —— 他本来是愿意
  // 订明天的。自取依然是「一天做一天的」,只是下单窗口提前到了前一晚。
  const rollToTomorrow = todaySlots.length === 0
  const orderDate = rollToTomorrow ? tomorrow : today
  const slots = rollToTomorrow ? TIME_SLOTS : todaySlots

  // 表单也存本地 —— 从结账页退回菜单时这个组件会卸载,不存就等于客人白填一遍。
  // 存的是他自己设备上的联系方式,方便下次再来直接下单;卡号一概不经过这里。
  const [form, setForm] = useState(() => {
    const blank = { name: '', phone: '', email: '', date: today, time: '', note: '' }
    try {
      const raw = localStorage.getItem(FORM_KEY)
      if (!raw) return blank
      const saved = JSON.parse(raw)
      // 存下来的时段只有在同一天才还作数,否则丢掉重选
      return { ...blank, ...saved, date: today, time: saved.date === today ? (saved.time ?? '') : '' }
    } catch { return blank }
  })

  useEffect(() => {
    try { localStorage.setItem(FORM_KEY, JSON.stringify(form)) } catch { /* ignore */ }
  }, [form])

  useScrollLock()

  // 到店自取:日期跟着 orderDate 走。跨过最后一档的那一刻会从今天翻到明天,
  // 这时候已经选好的时段可能已经不在列表里了(比如选了 7:45 PM 然后拖到 8 点),
  // 一并清掉,免得提交一个下拉里根本没有的时间。
  useEffect(() => {
    if (fixedRun) return
    setForm(prev => prev.date === orderDate
      ? prev
      : { ...prev, date: orderDate, time: '' })
  }, [fixedRun, orderDate])

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

  // 「改过没有」只看这一次打开之后客人有没有真的动过手 —— 不能看表单里有没有内容。
  // 表单会从 localStorage 把上次填的姓名邮箱带出来,按内容判断的话老客人一打开
  // 就是「脏」的,Esc 和点遮罩从此永远失效,只剩右上角那个 ✕ 能关。
  // 而且现在每次改动都会存进 localStorage,关掉也丢不了东西,这个拦截只是为了
  // 防手滑,不必拦得那么死。
  const [touched, setTouched] = useState(false)
  const isDirty = touched

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !isDirty) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDirty, onClose])

  function handleChange(e) {
    setTouched(true)
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
          // 取餐点只传 id —— kind 和名字由服务端查表得出(见 _shared/points.ts):
          // 那两个字段决定扣不扣款、查不查备料上限,不能让调用方说了算。
          pickupPoint: point ? { id: point.id } : null,
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
      <div className="modal checkout-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.checkout.title}</h2>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>

        <div className="checkout-body">
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
          {/* 手机号可选 —— 通知走邮件,电话只是万一出餐有问题时的备用联系方式。
              强制填会让一部分客人卡在这一步直接走掉。
              「可选」二字借用 t.options.optional(中「可选」/英「Optional」),
              免得为两个字再动一遍 12KB 的文案文件。 */}
          <label>
            {t.checkout.phone}
            <span className="checkout-optional"> · {t.options.optional}</span>
            <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder={t.checkout.phonePlaceholder} />
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
          {/* 两种预约情形话不一样:
              顺延到明天 —— 必须点明「这是明天的单」,客人最怕的是以为今晚能取;
              只是打烊(时段还在今天) —— 说清现在没在营业、按时段备餐就够了。 */}
          {rollToTomorrow
            ? <p className="checkout-preorder">{t.checkout.preorderTomorrow}</p>
            : !openNow && (
              <p className="checkout-preorder">{t.checkout.preorderNote(STORE_HOURS_TEXT)}</p>
            )}

          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.date}</span>
            <p className={`checkout-today${rollToTomorrow ? ' checkout-today--tomorrow' : ''}`}>
              {rollToTomorrow ? t.checkout.dateTomorrow : t.checkout.dateToday} · {orderDate}
            </p>
            <input type="hidden" name="date" value={orderDate} />
          </div>

          <div className="checkout-field">
            <span className="checkout-field-label">{t.checkout.time}</span>
            <input type="hidden" name="time" value={form.time} required />
            <div className="time-slots">
              {slots.map(slot => (
                <button
                  key={slot.value}
                  type="button"
                  className={`time-slot${form.time === slot.value ? ' time-slot--active' : ''}`}
                  onClick={() => { setTouched(true); setForm(prev => ({ ...prev, time: slot.value })) }}>
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
      </div>
      {wechatOpen && <WechatModal t={t} onClose={() => setWechatOpen(false)} />}
    </div>
  )
}
