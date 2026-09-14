// 未完成的菜品配置草稿。
//
// 客人在选项框里调了辣度、加了料,手一滑点到框外关掉 —— 再打开时应该接着改,
// 而不是从头再来。草稿按菜品 id 存,加入购物车后清掉(下一份从默认开始)。
//
// 存 localStorage 而不是内存:刷新、误关标签页、手机切后台被回收,都还在。
const KEY = 'nf-dish-drafts'

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* 隐私模式写不进,忽略 */ }
}

// 菜单随时会改(选项被删、改名)。草稿里认不出的选项一律丢掉,
// 单选回退到默认值 —— 否则客人会拿到一个已经不存在的配置。
function sanitize(dish, draft) {
  const out = {}
  for (const g of dish.optionGroups ?? []) {
    const ids = new Set(g.choices.map(c => c.id))
    const saved = draft?.[g.id]
    if (g.type === 'single') {
      out[g.id] = ids.has(saved) ? saved : g.default
    } else {
      out[g.id] = Array.isArray(saved) ? saved.filter(id => ids.has(id)) : [...(g.default ?? [])]
    }
  }
  return out
}

export function defaultSelections(dish) {
  return sanitize(dish, null)
}

export function loadDraft(dish) {
  return sanitize(dish, readAll()[dish.id])
}

export function saveDraft(dish, selections) {
  const all = readAll()
  all[dish.id] = selections
  writeAll(all)
}

export function clearDraft(dish) {
  const all = readAll()
  delete all[dish.id]
  writeAll(all)
}
