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
// Prices are the 直营 (direct/website) prices from the Drive 菜品定价 sheet.
// Sides/drinks/add-ons and 卤肉饭 use a placeholder image (logo) until real photos are uploaded.
// Option sets are derived from the recipe pages (菜单制作) — keep them in sync
// with what the kitchen can actually customize.

const menu = [
  {
    id: 1,
    category: 'noodle',
    price: 16.99,
    image: '/images/tianjin-beef-noodle.png',
    nameEn: 'Golden Soup Beef Noodle',
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
    category: 'noodle',
    price: 16.99,
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
    category: 'ricenoodle',
    price: 14.99,
    image: '/images/jiangxi-fried-noodle.jpg',
    nameEn: 'Authentic Jiangxi Fried Rice Noodle',
    nameZh: '招牌江西炒粉',
    descEn: 'Wok-tossed Jiangxi rice noodles with egg, vegetables, and shredded pork. Rich aroma and smoky wok breath in every bite.',
    descZh: '江西米粉大火爆炒，配鸡蛋、蔬菜与猪肉丝，香气浓郁，镬气十足。',
    optionGroups: [
      {
        id: 'veg', type: 'multi', required: true, default: ['cabbage', 'bokchoy'],
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
    category: 'ricenoodle',
    price: 12.99,
    image: '/images/jiangxi-sancian.jpg',
    nameEn: 'Jiangxi Garden Mushroom Rice Noodle Soup',
    nameZh: '江西三鲜泡粉',
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
    category: 'ricenoodle',
    price: 16.99,
    image: '/images/jiangxi-beef-noodle.jpg',
    nameEn: 'Jiangxi Spicy Beef Rice Noodle Soup',
    nameZh: '江西香辣牛肉泡粉',
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
  {
    id: 6,
    category: 'rice',
    price: 14.99,
    image: '/images/logo-emblem.png',
    nameEn: 'Taiwanese Braised Pork Rice Bowl',
    nameZh: '台北夜市卤肉饭',
    descEn: 'Taipei night-market braised pork belly, slow-simmered in soy and spices, ladled over steamed rice with a braised egg.',
    descZh: '台北夜市风味卤肉饭：五花肉慢卤入味，浇在白饭上，配一颗卤蛋。',
    optionGroups: [
      {
        id: 'remove', type: 'multi', default: [],
        nameEn: 'Leave out', nameZh: '不要放',
        choices: [
          { id: 'no-egg', nameEn: 'No braised egg', nameZh: '不要卤蛋' },
          { id: 'no-cilantro', nameEn: 'No cilantro', nameZh: '不要香菜' },
        ],
      },
    ],
  },

  // ── 小菜·饮料 Sides & Drinks (single-order add-ons) ──
  {
    id: 7,
    category: 'side',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Scallion Oil Fried Egg',
    nameZh: '葱油煎蛋',
    descEn: 'Fried egg finished with fragrant scallion oil.',
    descZh: '葱油煎蛋，香气十足。',
  },
  {
    id: 8,
    category: 'side',
    price: 2,
    image: '/images/logo-emblem.png',
    nameEn: 'Tea Egg',
    nameZh: '茶叶蛋',
    descEn: 'Egg marinated and simmered in spiced tea broth.',
    descZh: '茶香卤制的茶叶蛋。',
  },
  {
    id: 9,
    category: 'side',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Coke',
    nameZh: '可乐',
    descEn: 'Chilled canned Coca-Cola.',
    descZh: '冰镇罐装可乐。',
  },
  {
    id: 10,
    category: 'side',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Diet Coke',
    nameZh: 'Diet可乐',
    descEn: 'Chilled canned Diet Coke.',
    descZh: '冰镇罐装健怡可乐。',
  },
  {
    id: 11,
    category: 'side',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Sprite',
    nameZh: '雪碧',
    descEn: 'Chilled canned Sprite.',
    descZh: '冰镇罐装雪碧。',
  },
  {
    id: 20,
    category: 'side',
    price: 2,
    image: '/images/logo-emblem.png',
    nameEn: 'Bottled Water',
    nameZh: '矿泉水',
    descEn: 'Chilled bottled water.',
    descZh: '冰镇瓶装水。',
  },

  // ── 加料 Add-ons (extra portions) ──
  {
    id: 13,
    category: 'addon',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Rice Noodles',
    nameZh: '加粉',
    descEn: 'An extra portion of Jiangxi rice noodles.',
    descZh: '加一份江西米粉。',
  },
  {
    id: 14,
    category: 'addon',
    price: 3.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Noodles',
    nameZh: '加面',
    descEn: 'An extra portion of wheat noodles.',
    descZh: '加一份面条。',
  },
  {
    id: 15,
    category: 'addon',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Rice',
    nameZh: '加饭',
    descEn: 'An extra portion of steamed rice.',
    descZh: '加一份米饭。',
  },
  {
    id: 16,
    category: 'addon',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Garden Mushroom (Wood Ear, Shiitake & Soybean)',
    nameZh: '加三鲜',
    descEn: 'An extra portion of wood ear mushroom, shiitake, and soybeans.',
    descZh: '加一份木耳、香菇与黄豆。',
  },
  {
    id: 17,
    category: 'addon',
    price: 2.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Shredded Pork',
    nameZh: '加猪肉丝',
    descEn: 'An extra portion of shredded pork.',
    descZh: '加一份猪肉丝。',
  },
  {
    id: 18,
    category: 'addon',
    price: 4.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Beef Brisket',
    nameZh: '加牛腩',
    descEn: 'An extra portion of braised beef brisket.',
    descZh: '加一份卤牛腩。',
  },
  {
    id: 19,
    category: 'addon',
    price: 4.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Braised Pork',
    nameZh: '加卤肉',
    descEn: 'An extra portion of braised pork belly.',
    descZh: '加一份卤肉。',
  },
  {
    id: 21,
    category: 'addon',
    price: 1.5,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Egg',
    nameZh: '加鸡蛋',
    descEn: 'An extra egg.',
    descZh: '加一个鸡蛋。',
  },
  {
    id: 22,
    category: 'addon',
    price: 2,
    image: '/images/logo-emblem.png',
    nameEn: 'Extra Vegetables',
    nameZh: '加蔬菜',
    descEn: 'An extra portion of vegetables.',
    descZh: '加一份蔬菜。',
  },
]

// Menu sections for the storefront — ordered; dishes group by `dish.category`.
// Presentational only (create-checkout ignores this).
export const categories = [
  {
    id: 'ricenoodle', nameZh: '粉', nameEn: 'Rice Noodles',
    taglineZh: '爽滑米粉，鲜香入味', taglineEn: 'Silky rice noodles, fragrant and flavorful',
  },
  {
    id: 'noodle', nameZh: '面', nameEn: 'Noodles',
    taglineZh: '劲道面条，汤醇味浓', taglineEn: 'Springy noodles in rich, savory broth',
  },
  {
    id: 'rice', nameZh: '饭', nameEn: 'Rice Bowls',
    taglineZh: '卤香浇饭，扎实满足', taglineEn: 'Savory braise over rice, hearty and filling',
  },
  {
    id: 'side', nameZh: '小菜·饮料', nameEn: 'Sides & Drinks',
    taglineZh: '小食与冰饮', taglineEn: 'Small bites and cold drinks',
  },
  {
    id: 'addon', nameZh: '加料', nameEn: 'Add-ons',
    taglineZh: '加量更满足', taglineEn: 'Add an extra portion',
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
