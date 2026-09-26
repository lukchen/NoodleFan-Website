// 「这一班车已经卖掉多少」的唯一口径。
//
// 前端菜单上的「仅剩 N 份」和 create-checkout 里的超卖拦截必须用同一套算法 ——
// 各写一份迟早会对不上,然后客人看着「还剩 3 份」却被拒单。所以只此一份。

// 草稿单(点了结账没付完)不占料;未成团取消的也已经把料放回来了。
// 其余状态都是真占着一份备料的单。
export const COUNTED = ['authorized', 'paid', 'preparing', 'ready', 'completed']

type Client = { from: (t: string) => any }

export type Tally = {
  orders: number                      // 这一班总单数
  dishes: Record<number, number>      // 菜品 id → 已卖份数
}

export async function runTally(supabase: Client, pointId: string, runDate: string): Promise<Tally> {
  const { data, error } = await supabase
    .from('orders')
    .select('items')
    .eq('pickup_point', pointId)
    .eq('run_date', runDate)
    .in('status', COUNTED)
  if (error) throw new Error(error.message)

  const dishes: Record<number, number> = {}
  for (const row of data ?? []) {
    for (const it of (row.items ?? []) as { id: number; qty: number }[]) {
      dishes[it.id] = (dishes[it.id] ?? 0) + (Number(it.qty) || 0)
    }
  }
  return { orders: data?.length ?? 0, dishes }
}
