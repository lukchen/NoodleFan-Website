// Canonical menu — the SINGLE source of truth for dishes, prices, and option groups.
// Imported by BOTH sides:
//   - storefront: src/data/menu.js re-exports this file (Vite bundles it)
//   - create-checkout Edge Function: server-side pricing (client prices are never trusted)
// Keep this a plain data+pure-function ES module (no imports) so Vite and Deno both load it.
//
// Dish:         { id, price, image, nameEn, nameZh, descEn, descZh, optionGroups? }
// Option group: { id, nameEn, nameZh, type: 'single' | 'multi', required?, default?, choices }
//   - single: `default` is a choice id; required singles therefore always resolve
//   - multi:  `default` is an array of choice ids; `required` means "pick at least one"
// Choice:       { id, nameEn, nameZh, delta? }   delta = price adjustment in dollars
//
// Option sets are derived from the Notion recipe pages (菜单制作) — keep them in sync
// with what the kitchen can actually customize.

const menu = [
  {
    id: 1,
    price: 16,
    image: '/images/tianjin-beef-noodle.png',
    nameEn: 'Tianjin Yellow Broth Beef Noodle',
    nameZh: '天津黄汤牛肉拉面',
    descEn: 'Hand-pulled noodles in a rich golden bone broth seasoned with Tianjin-style spices. Topped with tender braised beef slices and fresh scallions.',
    descZh: '天津风味手工拉面，浓郁金黄骨汤，香料熬制，配以软烂卤牛肉片与葱花。',
    optionGroups: [
      {
        id: 'noodle', type: 'single', required: true, default: 'wide',
        nameEn: 'Noodle type', nameZh: '面型',
        choices: [
          { id: 'wide', nameEn: 'Wide noodles', nameZh: '宽面' },
          { id: 'thick', nameEn: 'Thick noodles', nameZh: '粗面' },
          { id: 'udon', nameEn: 'Udon', nameZh: '乌冬面' },
        ],
      },
      {
        id: 'remove', type: 'multi', default: [],
        nameEn: 'Leave out', nameZh: '不要放',
        choices: [
          { id: 'no-scallion', nameEn: 'No scallions', nameZh: '不要葱花' },
          { id: 'no-cilantro', nameEn: 'No cilantro', nameZh: '不要香菜' },
        ],
      },
    ],
  },
  {
    id: 2,
    price: 16,
    image: '/images/taiwanese-beef-noodle.jpg',
    nameEn: 'Taiwanese Beef Noodle',
    nameZh: '台式牛肉面',
    descEn: 'Slow-braised beef shank in a deep, spiced soy broth with chili bean paste. Served over springy wheat noodles with pickled mustard greens.',
    descZh: '红烧牛腱慢炖，汤底浓郁，加入豆瓣酱与香料。配劲道小麦面条，附酸菜提鲜。',
    optionGroups: [
      {
        id: 'remove', type: 'multi', default: [],
        nameEn: 'Leave out', nameZh: '不要放',
        choices: [
          { id: 'no-pickle', nameEn: 'No pickled mustard greens', nameZh: '不要酸菜' },
          { id: 'no-scallion', nameEn: 'No scallions', nameZh: '不要葱花' },
          { id: 'no-cilantro', nameEn: 'No cilantro', nameZh: '不要香菜' },
        ],
      },
    ],
  },
  {
    id: 3,
    price: 16,
    image: '/images/jiangxi-fried-noodle.jpg',
    nameEn: 'Jiangxi Signature Fried Rice Noodle',
    nameZh: '江西精品炒粉',
    descEn: 'Wok-tossed Jiangxi rice noodles with egg, vegetables, and shredded meat — your choice of pork or beef. Rich aroma and smoky wok breath in every bite.',
    descZh: '江西米粉大火爆炒，配鸡蛋、蔬菜与肉丝，香气浓郁，镬气十足。肉类可选猪肉或牛肉。',
    optionGroups: [
      {
        id: 'protein', type: 'single', required: true, default: 'pork',
        nameEn: 'Protein', nameZh: '肉类',
        choices: [
          { id: 'pork', nameEn: 'Pork', nameZh: '猪肉丝' },
          { id: 'beef', nameEn: 'Beef', nameZh: '牛肉', delta: 2 },
        ],
      },
      {
        id: 'veg', type: 'multi', required: true, default: ['cabbage'],
        nameEn: 'Vegetables (pick one or mix)', nameZh: '蔬菜（可单选或混搭）',
        choices: [
          { id: 'cabbage', nameEn: 'Cabbage', nameZh: '包菜' },
          { id: 'bokchoy', nameEn: 'Baby bok choy', nameZh: '小油菜' },
          { id: 'greens', nameEn: 'Chinese greens', nameZh: '青菜' },
        ],
      },
      {
        id: 'spice', type: 'single', required: true, default: 'mild',
        nameEn: 'Spice level', nameZh: '辣度',
        choices: [
          { id: 'none', nameEn: 'Not spicy', nameZh: '不辣' },
          { id: 'mild', nameEn: 'Mild', nameZh: '微辣' },
          { id: 'medium', nameEn: 'Medium', nameZh: '中辣' },
          { id: 'hot', nameEn: 'Extra hot', nameZh: '特辣' },
        ],
      },
    ],
  },
  {
    id: 4,
    price: 13,
    image: '/images/jiangxi-sancian.jpg',
    nameEn: 'Three Delicacies Rice Noodle Soup',
    nameZh: '三鲜泡粉',
    descEn: 'Silky Jiangxi rice noodles in a clear pork bone broth, topped with soybeans, wood ear mushroom, and shiitake — simple, hearty, and deeply satisfying.',
    descZh: '江西米粉泡在清澈猪骨汤中，铺满黄豆、木耳与香菇，朴实鲜香，回味绵长。',
    optionGroups: [
      {
        id: 'remove', type: 'multi', default: [],
        nameEn: 'Leave out', nameZh: '不要放',
        choices: [
          { id: 'no-woodear', nameEn: 'No wood ear mushroom', nameZh: '不要木耳' },
          { id: 'no-soybean', nameEn: 'No soybeans', nameZh: '不要黄豆' },
          { id: 'no-shiitake', nameEn: 'No shiitake mushroom', nameZh: '不要香菇' },
          { id: 'no-scallion', nameEn: 'No scallions', nameZh: '不要葱花' },
          { id: 'no-cilantro', nameEn: 'No cilantro', nameZh: '不要香菜' },
        ],
      },
    ],
  },
  {
    id: 5,
    price: 16,
    image: '/images/jiangxi-beef-noodle.jpg',
    nameEn: 'Spicy Beef Rice Noodle Soup',
    nameZh: '牛肉泡粉',
    descEn: 'Jiangxi rice noodles soaked in a bold, spicy red broth loaded with braised beef chunks, soybeans, and fresh cilantro. Rich heat with every sip.',
    descZh: '江西米粉泡入浓辣红汤，满铺卤牛肉块、黄豆与香菜，汤底醇厚，辣而过瘾。',
    optionGroups: [
      {
        // The beef topping is batch-braised, so per-bowl "spice level" isn't real —
        // what the kitchen can control is how much red chili oil goes on top.
        id: 'chili-oil', type: 'single', required: true, default: 'normal',
        nameEn: 'Chili oil', nameZh: '红油',
        choices: [
          { id: 'less', nameEn: 'Less chili oil', nameZh: '少红油' },
          { id: 'normal', nameEn: 'Normal', nameZh: '正常' },
          { id: 'extra', nameEn: 'Extra chili oil', nameZh: '多红油' },
        ],
      },
      {
        id: 'remove', type: 'multi', default: [],
        nameEn: 'Leave out', nameZh: '不要放',
        choices: [
          { id: 'no-cilantro', nameEn: 'No cilantro', nameZh: '不要香菜' },
          { id: 'no-pickle', nameEn: 'No pickled radish', nameZh: '不要酸萝卜' },
          { id: 'no-scallion', nameEn: 'No scallions', nameZh: '不要葱花' },
          { id: 'no-soybean', nameEn: 'No soybeans', nameZh: '不要黄豆' },
        ],
      },
    ],
  },
]

// Resolve a customer's selections against a dish's option groups.
// selections: { [groupId]: choiceId (single) | choiceId[] (multi) }
// Returns { deltaCents, optionsZh, optionsEn, normalized } where `normalized` fills in
// defaults, drops unknown ids, and sorts multi selections — a canonical form usable as
// a cart-line identity and as the payload sent to the server.
// Throws on a missing required group so the server rejects malformed orders.
export function resolveSelections(dish, selections = {}) {
  const optionsZh = []
  const optionsEn = []
  const normalized = {}
  let deltaCents = 0

  for (const g of dish.optionGroups ?? []) {
    if (g.type === 'single') {
      const chosenId = selections[g.id] ?? g.default
      const c = g.choices.find((x) => x.id === chosenId)
      if (!c) {
        if (g.required) throw new Error(`missing required option: ${g.id}`)
        continue
      }
      normalized[g.id] = c.id
      deltaCents += Math.round((c.delta ?? 0) * 100)
      optionsZh.push(c.nameZh)
      optionsEn.push(c.nameEn)
    } else {
      const ids = selections[g.id] ?? g.default ?? []
      const chosen = g.choices.filter((x) => ids.includes(x.id))
      if (g.required && chosen.length === 0) throw new Error(`missing required option: ${g.id}`)
      if (chosen.length === 0) continue
      normalized[g.id] = chosen.map((c) => c.id).sort()
      for (const c of chosen) {
        deltaCents += Math.round((c.delta ?? 0) * 100)
        optionsZh.push(c.nameZh)
        optionsEn.push(c.nameEn)
      }
    }
  }

  return { deltaCents, optionsZh, optionsEn, normalized }
}

export default menu
