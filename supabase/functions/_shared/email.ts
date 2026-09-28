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
  subtotal?: number | null
  tax?: number | null
  total?: number | null
  items?: { nameZh: string; nameEn: string; qty: number; price: number;
            optionsZh?: string[]; optionsEn?: string[] }[] | null
  capture_mode?: string | null
}

// 取餐点地址 —— 邮件里必须写全。客人取餐那天翻的是这封邮件,不会再回网站找。
const ADDRESSES: Record<string, string> = {
  'Allston 取餐点': '1 Brighton Ave, Boston, MA 02134（Super 88 超市门口）',
  'Malden 取餐点': '300 Pleasant St, Malden, MA 02148（停车场）',
  '当日到店自取': '94 Shirley St, Boston, MA 02119',
  // 改名前下的单在库里存的还是旧名字,这一行留着,否则那些订单的邮件里地址会空掉
  '到店自取': '94 Shirley St, Boston, MA 02119',
}

const money = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`

// 客人自己填的内容(姓名)会被拼进邮件正文的 HTML —— 不转义的话,
// 他填一段 <a href="...">点这里领券</a> 就变成了一封从我们域名发出、
// 带着我们品牌的钓鱼邮件。收件人虽然是他自己,但这封信可以被转发、截图,
// 看上去完全像是我们发的。菜名和选项来自后端菜单,不用管;姓名必须转义。
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    如有疑问，直接回复本邮件即可。<br>
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
        ${esc(it.nameZh)} × ${it.qty}
        ${opts ? `<br><span style="color:#857a6b;font-size:13px;">${esc(opts)}</span>` : ''}
      </td>
      <td style="padding:6px 0;border-bottom:1px solid #e8dcc8;text-align:right;white-space:nowrap;">
        ${money(it.price * it.qty)}
      </td></tr>`
  }).join('')
  // 小计/税分开列 —— 客人对账、报销都要看得到税。
  // 老订单没存这两列,那就只显示合计,不要凭总额倒算出一个可能不对的数。
  const hasBreakdown = o.subtotal != null && o.tax != null
  const breakdown = hasBreakdown
    ? `<tr><td style="padding:8px 0 2px;color:#857a6b;">小计 Subtotal</td>
           <td style="padding:8px 0 2px;text-align:right;color:#857a6b;">${money(o.subtotal)}</td></tr>
       <tr><td style="padding:2px 0;color:#857a6b;">销售税 Sales tax (7%)</td>
           <td style="padding:2px 0;text-align:right;color:#857a6b;">${money(o.tax)}</td></tr>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;">
    ${rows}
    ${breakdown}
    <tr><td style="padding:10px 0;font-weight:700;border-top:1px solid #e8dcc8;">合计 Total</td>
        <td style="padding:10px 0;text-align:right;font-weight:700;border-top:1px solid #e8dcc8;">${money(o.total)}</td></tr>
  </table>`
}

// 取餐码做大 —— 客人到了现场要一眼报得出来
function pickupBlock(o: OrderForEmail): string {
  const addr = esc(ADDRESSES[o.pickup_point_name ?? ''] ?? o.pickup_point_name ?? '')
  const when = prettyWhen(o.run_date ?? o.pickup_date, o.pickup_time)
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="margin:16px 0;background:#fff;border:1px solid #e8dcc8;border-radius:10px;">
    <tr><td style="padding:16px;">
      <div style="color:#857a6b;font-size:12px;">取餐码 Pickup code</div>
      <div style="font-size:28px;font-weight:700;letter-spacing:2px;margin:2px 0 12px;">${o.pickup_code ?? '—'}</div>
      <div style="color:#857a6b;font-size:12px;">取餐时间 When</div>
      <div style="font-weight:700;margin-bottom:10px;">${when}</div>
      <div style="color:#857a6b;font-size:12px;">取餐地点 Where</div>
      <div style="font-weight:700;">${esc(o.pickup_point_name)}</div>
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
           <strong>本次下单尚未实际扣款。</strong>该金额为您银行卡上的预授权冻结。
           取餐当天中午 12:00 截单后：本班次成团则正式扣款；未能成团则冻结自动解除，
           <strong>不收取任何费用</strong>。两种结果我们都会另行邮件通知您。
           <div style="color:#857a6b;font-size:13px;margin-top:8px;">
             This is an authorization hold, not a charge. After orders close at noon on
             your pickup day, we charge only if the run is confirmed; otherwise the hold
             is released automatically and you are not charged. We'll email you either way.
           </div>
         </td></tr></table>`
    : ''
  // 到店自取是下单即扣款,这封邮件就是客人唯一的收据 —— 把「已完成付款」写明,
  // 并留一句收据声明,免得他为了对账再来问一次。
  const paidNote = isHold
    ? ''
    : `<p style="margin:0 0 4px;">已完成付款 <strong>${money(o.total)}</strong>。本邮件即为您的收据。</p>
       <p style="margin:0 0 4px;color:#857a6b;font-size:13px;">
         Payment of ${money(o.total)} completed. This email is your receipt.</p>`
  return {
    subject: isHold
      ? `订单已确认 ${o.pickup_code ?? ''} · ${prettyWhen(o.run_date ?? o.pickup_date, o.pickup_time)}`
      : `收据 Receipt ${o.pickup_code ?? ''} · ${money(o.total)}`,
    html: layout(isHold ? '订单已确认 Order confirmed' : '付款成功 · 收据 Payment receipt', `
      <p style="margin:0 0 4px;">${esc(o.customer_name)}，感谢您的订购。</p>
      ${paidNote}
      ${pickupBlock(o)}
      ${holdNote}
      ${itemsTable(o)}
      ${isHold ? '' : `<p style="margin:12px 0 0;font-size:14px;">
        我们开始备餐后会再发一封邮件通知您「可以来取」，约 20 分钟。到店请出示取餐码。</p>`}
    `),
  }
}

// 到店自取:后台把状态改成「待取餐」时发这封。
// 客人付完款那个页面会实时变状态,但他一关浏览器就什么都看不到了 —— 邮件是唯一能追到他的路。
export function tplReady(o: OrderForEmail) {
  return {
    subject: `餐已做好，请来取餐 · 取餐码 ${o.pickup_code ?? ''}`,
    html: layout('餐已做好，请来取餐 Your order is ready', `
      <p style="margin:0 0 4px;">${esc(o.customer_name)}，您的餐已做好，随时可以来取。</p>
      <p style="margin:0 0 4px;color:#857a6b;font-size:13px;">
        Your order is ready for pickup.</p>
      ${pickupBlock(o)}
      <p style="margin:12px 0 0;font-size:14px;">到店请出示取餐码。
        趁热吃口感最好，建议尽快取餐。</p>
    `),
  }
}

export function tplCaptured(o: OrderForEmail) {
  return {
    subject: `本班次已成团 · 取餐码 ${o.pickup_code ?? ''}`,
    html: layout('已成团，今天发车 We roll today', `
      <p style="margin:0 0 4px;">${esc(o.customer_name)}，本班次已成团。</p>
      <p style="margin:0 0 4px;">已从您的银行卡正式扣款 <strong>${money(o.total)}</strong>
        （此前为预授权冻结，现已完成收取）。</p>
      <p style="margin:0 0 4px;color:#857a6b;font-size:13px;">
        The run filled — we've now charged the ${money(o.total)} that was on hold.</p>
      ${pickupBlock(o)}
      <p style="margin:12px 0 0;font-size:14px;">到取餐点请出示取餐码。</p>
    `),
  }
}

export function tplCancelled(o: OrderForEmail) {
  return {
    subject: `本班次未成团，订单已取消 · 未扣款`,
    html: layout('本班次未成团，订单已取消', `
      <p style="margin:0 0 10px;">${esc(o.customer_name)}，很抱歉 ——
        ${esc(o.pickup_point_name)} ${prettyWhen(o.run_date ?? o.pickup_date)}
        本班次未能成团，今天不发车。</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="margin:4px 0 16px;background:#fff;border:1px solid #e8dcc8;border-radius:10px;">
        <tr><td style="padding:16px;font-size:15px;line-height:1.6;">
          <strong>您未被收取任何费用。</strong><br>
          卡上那笔 ${money(o.total)} 的预授权冻结已解除，通常 1–3 个工作日内从账单上消失，
          具体以发卡行为准。
          <div style="color:#857a6b;font-size:13px;margin-top:8px;">
            You were not charged. The ${money(o.total)} hold has been released and will
            drop off your statement within a few business days.
          </div>
        </td></tr></table>
      <p style="margin:0;font-size:14px;">
        <strong>今天请勿前往取餐点</strong> —— 本班次不会有人在现场。
        欢迎预订下一班次：<a href="https://noodlefanboston.com" style="color:#7a1f1f;">noodlefanboston.com</a>
      </p>
    `),
  }
}

// ── 运营汇总(发给自己,不发客人)─────────────────────────────────────────
// 结算是这一整班的分水岭:扣了款就得把餐做出来送到,取消了就别有人白跑。
// 这两件事发生在 cron 里(取餐日中午 12:00 自动跑),没人盯着 —— 所以必须有一封
// 落到运营信箱的信,里面是「照着做就行」的那份东西:备料汇总 + 逐单清单。
// 失败单放最上面:扣款失败意味着钱没收到,这单不计入备料和逐单清单,得打电话。
//
// 收件人可配置。默认收在 noodlefanboston@gmail.com —— 店里的运营信箱,手机上能直接看。
// 注意不能发到 order@noodlefanboston.com:那个域在 Resend 里 Receiving 是关的
// (没有 MX 记录),只能发不能收,往它发信会退回。哪天 order@ 真能收信了,
// `supabase secrets set OPS_EMAIL=order@noodlefanboston.com` 即可,代码不用动。
export const OPS_EMAIL = Deno.env.get('OPS_EMAIL') ?? 'noodlefanboston@gmail.com'

type SettleResult = { id: string; code?: string | null; ok: boolean; error?: string | null }

export function tplRunSummary(r: {
  pointName: string
  runDate: string
  action: 'capture' | 'cancel'
  orders: any[]
  results: SettleResult[]
}) {
  const byId = new Map(r.results.map(x => [x.id, x]))
  const okOrders = r.orders.filter((o: any) => byId.get(o.id)?.ok)
  const bad = r.results.filter(x => !x.ok)
  const money2 = (n: number) => `$${n.toFixed(2)}`
  const sum = okOrders.reduce((s, o) => s + Number(o.total ?? 0), 0)
  const when = prettyWhen(r.runDate)
  const isCap = r.action === 'capture'

  // 备料汇总 —— 取消的班次不用做饭,这一块就没意义
  let prep = ''
  if (isCap && okOrders.length) {
    const tally = new Map<string, number>()
    for (const o of okOrders) {
      for (const it of o.items ?? []) {
        const k = (it.optionsZh ?? []).length ? `${it.nameZh}（${it.optionsZh!.join('、')}）` : it.nameZh
        tally.set(k, (tally.get(k) ?? 0) + it.qty)
      }
    }
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k, q]) =>
      `<tr><td style="padding:5px 0;border-bottom:1px solid #e8dcc8;">${esc(k)}</td>
           <td style="padding:5px 0;border-bottom:1px solid #e8dcc8;text-align:right;font-weight:700;">${q}</td></tr>`).join('')
    prep = `<h2 style="font-size:15px;margin:22px 0 6px;">备料汇总 —— 这一班要做的量</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows}</table>`
  }

  // 逐单清单 —— 装袋和现场核对取餐码用
  const list = okOrders.map((o: any) => {
    const items = (o.items ?? []).map((it: any) => {
      const opt = (it.optionsZh ?? []).length ? `（${it.optionsZh.join('、')}）` : ''
      return `${esc(it.nameZh)}${esc(opt)} × ${it.qty}`
    }).join('<br>')
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e8dcc8;vertical-align:top;">
        <strong style="font-size:16px;letter-spacing:1px;">${o.pickup_code ?? '—'}</strong>
        <span style="color:#857a6b;"> · ${esc(o.customer_name)}</span>
        ${o.customer_phone ? `<span style="color:#857a6b;"> · ${esc(o.customer_phone)}</span>` : ''}
        ${o.pickup_time ? `<span style="color:#857a6b;"> · ${esc(o.pickup_time)}</span>` : ''}
        <div style="font-size:13px;margin-top:2px;">${items}</div>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #e8dcc8;text-align:right;vertical-align:top;white-space:nowrap;">
        ${money2(Number(o.total ?? 0))}
      </td></tr>`
  }).join('')

  // 失败单 —— 唯一需要你立刻动手的部分,所以放在最前面
  const failBlock = bad.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 18px;background:#fdecec;border:1px solid #c94a4a;border-radius:10px;">
      <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;">
        <strong>${bad.length} 单${isCap ? '扣款' : '取消'}失败,需要手动处理。</strong>
        ${isCap ? '钱没收到,所以这几单<strong>没算进下面的备料</strong>,也没进逐单清单 —— 先打电话问清楚,要做再另外加。' : '这几笔冻结没解掉,客人卡上还挂着钱 —— 去 Stripe 后台手动 cancel,否则要挂到 7 天后才自动失效。'}
        <div style="margin-top:8px;">
          ${bad.map(b => `· ${esc(b.code ?? b.id)} —— ${esc(b.error ?? '未知错误')}`).join('<br>')}
        </div>
      </td></tr></table>` : ''

  const head = isCap
    ? `<p style="margin:0 0 4px;font-size:16px;"><strong>${esc(r.pointName)} · ${when} 发车。</strong></p>
       <p style="margin:0 0 4px;">已扣款 <strong>${okOrders.length}</strong> 单，合计 <strong>${money2(sum)}</strong>。
          客人已收到扣款通知，按下面的量备料。</p>`
    : `<p style="margin:0 0 4px;font-size:16px;"><strong>${esc(r.pointName)} · ${when} 不发车。</strong></p>
       <p style="margin:0 0 4px;">${okOrders.length} 单已取消，冻结已解除，未收取任何费用（合计 ${money2(sum)}）。
          客人已收到取消通知，今天不会有人来取餐。</p>`

  return {
    subject: isCap
      ? `【发车】${r.pointName} ${when} · ${okOrders.length} 单 · ${money2(sum)}${bad.length ? ` · ${bad.length} 单失败` : ''}`
      : `【不发车】${r.pointName} ${when} · ${okOrders.length} 单已取消${bad.length ? ` · ${bad.length} 单失败` : ''}`,
    html: layout(isCap ? '已发车 · 备料清单' : '未成团 · 已取消', `
      ${failBlock}
      ${head}
      ${prep}
      ${okOrders.length ? `<h2 style="font-size:15px;margin:22px 0 6px;">逐单清单${isCap ? ' —— 装袋 / 现场核对取餐码' : ''}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${list}</table>` : ''}
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
