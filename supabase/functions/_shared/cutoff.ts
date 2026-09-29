// 截单时刻 —— 这个函数决定「什么时候把客人的钱从冻结变成真扣」。
// 单独成文件是为了能被测试直接 import:run-dispatch/index.ts 顶层就 Deno.serve 了,
// 在测试里 import 不进来。算错的后果很实在:早一小时截单,那一小时的单全被取消;
// 晚一小时,客人中午看到还能下单,而车其实已经走了。

const TZ = 'America/New_York'

// run_date 是「哪天发车」,截单时刻是那天波士顿时间的 CUTOFF_HOUR。
// 服务器跑在 UTC,夏令时一年变两次,所以按当天的实际偏移换算,不写死 -5/-4。
export function cutoffUtc(runDate: string, cutoffHour = 12): Date {
  const guess = new Date(`${runDate}T${String(cutoffHour).padStart(2, '0')}:00:00Z`)
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(guess).find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5'
  const m = tzName.match(/GMT([+-]\d+)(?::(\d+))?/)
  const offMin = m ? Number(m[1]) * 60 + (Number(m[2] ?? 0) * Math.sign(Number(m[1]))) : -300
  return new Date(guess.getTime() - offMin * 60000)
}
