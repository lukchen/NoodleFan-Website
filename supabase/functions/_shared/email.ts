// 订单邮件 —— 通过 Resend 发。
//
// 为什么非要有邮件:定点配送是「先冻结、成团才扣款」。客人卡上先挂一笔待处理金额,
// 截单时刻要么扣款要么解冻 —— 这两件事都发生在他的卡上,不告诉他一声就是:
//   · 未成团取消 → 他手里只有一封写着「周二 6PM Allston」的确认邮件,照样开车过去扑空
//   · 成团扣款   → 他看到卡上突然多一笔真实扣款,不知道是什么
// 微信群里我们会喊一声,但不在群里的客人照样能下单 —— 邮件是覆盖所有人的那条路。
//
// 发信失败绝不能影响钱的处理:capture/cancel 已经在 Stripe 那边生效了,
// 这时候抛错会让调用方以为结算失败而重试,重试就是重复扣款。所以一律吞掉错误、只记日志。

const FROM = 'NoodleFan 粉面王 <order@noodlefanboston.com>'
const REPLY_TO = 'order@noodlefanboston.com'

export type OrderForEmail = {
  customer_email?: string | null
  customer_name?: string | null
  pickup_code?: string | null
  pickup_point_name?: string | null
  pickup_date?: string | null
  pickup_time?: string | null
  run_date?: string | null
  total?: number | null
  items?: { nameZh: string; nameEn: string; qty: number; price: number;
            optionsZh?: string[]; optionsEn?: string[] }[] | null
  capture_mode?: string | null
}

// 取餐点地址 —— 邮件里必须写全。客人取餐那天翻的是这封邮件,不会再回网站找。
const ADDRESSES: Record<string, string> = {
  'Allston 取餐点': '1 Brighton Ave, Boston, MA 02134（Super 88 超市门口）',
  'Malden 取餐点': '300 Pleasant St, Malden, MA 02148（停车场）',
  '到店自取': '94 Shirley St, Boston, MA 02119',
}

const money = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`

// 「2026-09-29」+「18:00」→「周二 9/29 6:00 PM」
const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export function prettyWhen(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  // 用 UTC 构造再读 UTC 字段,避开服务器时区把日期推前一天
  const dow = DAY_ZH[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  let t = ''
  if (timeStr) {
    const [hh, mm] = timeStr.split(':').map(Number)
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    t = ` ${h12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`
  }
  return `${dow} ${m}/${d}${t}`
}

// ── 版式 ─────────────────────────────────────────────────────────────────
// 邮件客户端对 CSS 的支持停留在 2005 年:不认 flex/grid,Gmail 会剥掉 <style>。
// 所以一律用 table 布局 + 行内样式,深色模式也不做 —— 白底黑字到处都正常。
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4ece0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ece0;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fdf8f0;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#7a1f1f;padding:18px 24px;color:#fff;font-size:17px;font-weight:700;">
    NoodleFan 粉面王
  </td></tr>
  <tr><td style="padding:24px;color:#2b2420;font-size:15px;line-height:1.6;">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${title}</h1>
    ${bodyHtml}
  </td></tr>
  <tr><td style="padding:16px 24px;background:#f4ece0;color:#857a6b;font-size:12px;line-height:1.6;">
    有问题直接回复这封邮件。<br>
    Reply to this email if anything looks wrong.
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function itemsTable(o: OrderForEmail): string {
  const rows = (o.items ?? []).map(it => {
    const opts = (it.optionsZh ?? []).join('、')
    return `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #e8dcc8;">
        ${it.nameZh} × ${it.qty}
        ${opts ? `<br><span style="color:#857a6b;font-size:13px;">${opts}</span>` : ''}
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #e8dcc8;text-align:right;white-space:nowrap;">
        ${money(it.price * it.qty)}
      </td></tr>`
  }).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
    ${rows}
    <tr><td style="padding:10px 0;font-weight:700;">合计 Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;">${money(o.total)}</td></tr>
  </table>`
}

// 取餐码做大 —— 客人到了现场要一眼报得出来
function pickupBlock(o: OrderForEmail): string {
  const addr = ADDRESSES[o.pickup_point_name ?? ''] ?? o.pickup_point_name ?? ''
  const when = prettyWhen(o.run_date ?? o.pickup_date, o.pickup_time)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:16px 0;background:#fff;border:1px solid #e8dcc8;border-radius:10px;">
    <tr><td style="padding:16px;">
      <div style="color:#857a6b;font-size:12px;">取餐码 Pickup code</div>
      <div style="font-size:28px;font-weight:700;letter-spacing:2px;margin:2px 0 12px;">${o.pickup_code ?? '—'}</div>
      <div style="color:#857a6b;font-size:12px;">取餐时间 When</div>
      <div style="font-weight:700;margin-bottom:10px;">${when}</div>
      <div style="color:#857a6b;font-size:12px;">取餐地点 Where</div>
      <div style="font-weight:700;">${o.pickup_point_name ?? ''}</div>
      <div style="color:#5c5245;font-size:13px;">${addr}</div>
    </td></tr></table>`
}

// ── 三封邮件 ──────────────────────────────────────────────────────────────

export function tplConfirmed(o: OrderForEmail) {
  const isHold = o.capture_mode === 'manual'
  // 先授权的单必须把「现在没真扣钱」说死 —— 客人银行 App 里看到一笔 pending,
  // 不解释清楚就会打电话来问,或者直接找银行 dispute。
  const holdNote = isHold
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin:16px 0;background:#fdf6ec;border:1px solid #d9b26a;border-radius:10px;">
         <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
           <strong>现在还没扣款。</strong>你的卡上是一笔冻结,取餐当天中午 12 点截单:
           满 5 单发车才真正扣款;不满则自动解除冻结,<strong>不收取任何费用</strong>。
           两种情况我们都会再发一封邮件告诉你。
           <div style="color:#857a6b;font-size:13px;margin-top:8px;">
             Your card is on hold, not charged. We charge only if the run fills by
             noon on pickup day — otherwise the hold is released and you pay nothing.
           </div>
         </td></tr></table>`
    : ''
  return {
    subject: `订单已确认 ${o.pickup_code ?? ''} · ${prettyWhen(o.run_date ?? o.pickup_date, o.pickup_time)}`,
    html: layout('订单已确认 Order confirmed', `
      <p style="margin:0 0 4px;">${o.customer_name ?? ''}，感谢下单！</p>
      ${pickupBlock(o)}
      ${holdNote}
      ${itemsTable(o)}
    `),
  }
}

export function tplCaptured(o: OrderForEmail) {
  return {
    subject: `已成团，今天见 · 取餐码 ${o.pickup_code ?? ''}`,
    html: layout('已成团，今天发车 We roll today', `
      <p style="margin:0 0 4px;">${o.customer_name ?? ''}，这一班凑够单了。</p>
      <p style="margin:0 0 4px;">刚刚从你的卡上扣款 <strong>${money(o.total)}</strong>
        （此前是冻结,现在正式收取）。</p>
      <p style="margin:0 0 4px;color:#857a6b;font-size:13px;">
        The run filled — we've now charged the ${money(o.total)} that was on hold.</p>
      ${pickupBlock(o)}
      <p style="margin:12px 0 0;font-size:14px;">到了报取餐码就行,不用出示这封邮件。</p>
    `),
  }
}

export function tplCancelled(o: OrderForEmail) {
  return {
    subject: `今天未成团,订单已取消 · 未扣款`,
    html: layout('今天未成团,订单已取消', `
      <p style="margin:0 0 10px;">${o.customer_name ?? ''}，抱歉 ——
        ${o.pickup_point_name ?? ''} ${prettyWhen(o.run_date ?? o.pickup_date)}
        这一班没凑够起送单数,今天不发车。</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="margin:4px 0 16px;background:#fff;border:1px solid #e8dcc8;border-radius:10px;">
        <tr><td style="padding:16px;font-size:15px;line-height:1.6;">
          <strong>你没有被扣任何费用。</strong><br>
          之前卡上那笔 ${money(o.total)} 的冻结已经解除 —— 银行那边通常 1–3 个工作日
          消失,具体看发卡行。
          <div style="color:#857a6b;font-size:13px;margin-top:8px;">
            You were not charged. The ${money(o.total)} hold has been released and will
            drop off your statement within a few business days.
          </div>
        </td></tr></table>
      <p style="margin:0;font-size:14px;">
        <strong>别白跑一趟</strong> —— 今天这一班不会有人在取餐点。
        欢迎订下一班:<a href="https://noodlefanboston.com" style="color:#7a1f1f;">noodlefanboston.com</a>
      </p>
    `),
  }
}

// ── 发送 ─────────────────────────────────────────────────────────────────
export async function sendEmail(to: string | null | undefined, subject: string, html: string) {
  if (!to) { console.log('email skipped: no address'); return false }
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) { console.error('email skipped: RESEND_API_KEY not set'); return false }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    })
    if (!res.ok) {
      // 只记录,不抛 —— 见文件头:这时候钱已经动过了,抛错会招来重试即重复扣款。
      console.error('resend failed:', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('resend threw:', e)
    return false
  }
}
