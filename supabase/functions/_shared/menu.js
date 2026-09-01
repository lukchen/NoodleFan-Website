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
// 图片: 4 张江西/台牛为旧图,其余暂用占位 —— 12 张新产品图待上传后统一切换(见 IMAGES-TODO)。
// Option sets (辣度/面型/忌口/加料) mirror the Drive 菜品定价 sheet columns
// 「Modifier Group 1-4」 — that sheet is the single source of truth; see MODIFIERS below.

const menu = [
  {
    id: 1,
    category: 'noodle',
    price: 16.99,
    image: '/images/Golden%20Curry%20Beef%20Noodle.jpg',
    nameEn: 'Golden Curry Beef Noodle',
    nameZh: '天津黄汤牛肉拉面',
    descEn: 'Hand-pulled noodles in golden curry-spiced beef bone broth with tender brisket, cilantro and a fried egg.',
    descZh: '天津卫黄汤拉面，咖喱味慢熬的牛骨浓汤，配软烂牛腩、香菜蒜苗与煎蛋。',
  },
  {
    id: 2,
    category: 'noodle',
    price: 16.99,
    image: '/images/Taiwanese%20Beef%20Noodle.jpg',
    nameEn: 'Taiwanese Beef Noodle',
    nameZh: '台式牛肉面',
    descEn: 'Slow-braised beef brisket in a tomato, apple and spice broth built on beef tallow, with fresh noodles and a fried egg.',
    descZh: '台式慢炖牛腩面，牛油炒香、番茄苹果与八角桂皮吊出的醇厚汤头，配新鲜面条与煎蛋。',
  },
  {
    id: 3,
    category: 'ricenoodle',
    price: 14.99,
    image: '/images/Authentic%20Jiangxi%20Fried%20Rice%20Noodle.jpg',
    nameEn: 'Authentic Jiangxi Fried Rice Noodle',
    nameZh: '招牌江西炒粉',
    descEn: 'Wok-tossed Jiangxi rice noodles with egg, pork, cabbage and baby bok choy — smoky, savory street-food style.',
    descZh: '江西街头味的大火猛炒米粉，配鸡蛋、猪肉丝、包菜与小油菜，锅气十足、咸香够味。',
  },
  {
    id: 4,
    category: 'ricenoodle',
    price: 12.99,
    image: '/images/Jiangxi%20Garden%20Mushroom%20Rice%20Noodle%20Soup.jpg',
    nameEn: 'Jiangxi Garden Mushroom Rice Noodle Soup',
    nameZh: '江西三鲜泡粉',
    descEn: 'Silky rice noodles and a slow-braised pork spine bone in slow-simmered pork bone broth, with soybeans, wood ear, and shiitake. Clean and comforting.',
    descZh: '猪骨清汤慢煨的招牌泡粉，配黄豆、木耳、香菇三鲜，以及原汤猪脊骨。汤清味鲜，不辣不腻。',
  },
  {
    id: 5,
    category: 'ricenoodle',
    price: 16.99,
    image: '/images/Jiangxi%20Spicy%20Beef%20Rice%20Noodle%20Soup.jpg',
    nameEn: 'Jiangxi Spicy Beef Rice Noodle Soup',
    nameZh: '江西香辣牛肉泡粉',
    descEn: 'Rice noodles in clear pork bone broth, topped with chili-simmered beef in fragrant red oil, with soybeans, cilantro and crisp pickled greens.',
    descZh: '猪骨清汤打底，铺上小火慢煨的红油香辣牛肉块，配黄豆、香菜与爽口小咸菜，鲜辣入味，江西招牌。',
  },
  {
    id: 6,
    category: 'rice',
    price: 14.99,
    image: '/images/Taiwanese%20Braised%20Pork%20Rice%20Bowl.jpg',
    nameEn: 'Taiwanese Braised Pork Rice Bowl',
    nameZh: '台北夜市卤肉饭',
    descEn: 'Taipei street style braised pork belly over rice with pickled daikon, greens and an egg.',
    descZh: '台北夜市经典卤肉饭，红葱酥慢卤的五花肉浇在热米饭上，配腌黄萝卜、小咸菜、小油菜和香卤蛋。',
  },

  // ── 小菜 Sides (single-order) ──
  {
    id: 7,
    category: 'side',
    price: 2.5,
    image: '/images/Scallion%20Oil%20Fried%20Egg.jpg',
    nameEn: 'Scallion Oil Fried Egg',
    nameZh: '葱油煎蛋',
    descEn: 'Crispy-edged fried egg finished with fragrant scallion oil. Great on any noodle or rice bowl.',
    descZh: '现煎葱油煎蛋，边缘焦香、蛋心饱满，配面配饭都好吃。',
  },
  {
    id: 8,
    category: 'side',
    price: 2,
    image: '/images/Tea%20Egg.jpg',
    nameEn: 'Tea Egg',
    nameZh: '茶叶蛋',
    descEn: 'Tea egg steeped in black tea, star anise and cinnamon.',
    descZh: '红茶与八角桂皮慢卤、过夜浸味的茶叶蛋，整颗带壳，剥开满是纹路清香。',
  },

  // ── 饮料 Drinks (single-order) ──
  {
    id: 9,
    category: 'drink',
    price: 2.5,
    image: '/images/Coke.jpg',
    nameEn: 'Coke',
    nameZh: '可乐',
    descEn: 'Chilled canned Coca-Cola.',
    descZh: '冰镇罐装可乐。',
  },
  {
    id: 10,
    category: 'drink',
    price: 2.5,
    image: '/images/Diet%20Coke.jpg',
    nameEn: 'Diet Coke',
    nameZh: 'Diet可乐',
    descEn: 'Chilled canned Diet Coke.',
    descZh: '冰镇罐装健怡可乐。',
  },
  {
    id: 11,
    category: 'drink',
    price: 2.5,
    image: '/images/Sprite.jpg',
    nameEn: 'Sprite',
    nameZh: '雪碧',
    descEn: 'Chilled canned Sprite.',
    descZh: '冰镇罐装雪碧。',
  },
  {
    id: 20,
    category: 'drink',
    price: 2,
    image: '/images/Water.jpg',
    nameEn: 'Bottled Water',
    nameZh: '矿泉水',
    descEn: 'Chilled bottled water.',
    descZh: '冰镇瓶装水。',
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
    id: 'side', nameZh: '小菜', nameEn: 'Sides',
    taglineZh: '卤香小食，配面配饭', taglineEn: 'Small bites to round out the bowl',
  },
  {
    id: 'drink', nameZh: '饮料', nameEn: 'Drinks',
    taglineZh: '冰镇罐装与瓶装水', taglineEn: 'Chilled cans and bottled water',
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

// ── Modifier Groups ──────────────────────────────────────────────────────────
// 1:1 with the Drive「菜品定价」表 K–N 列（Modifier Group 1 辣度 / 2 忌口 / 3 面型 /
// 4 Add on）。改选项 = 先改那张表，再改这里。加料不单独上架，是加入购物车时勾选的。
const SPICE = {
  none:    { id: 'none',    nameEn: 'Not Spicy',     nameZh: '不辣' },
  mild:    { id: 'mild',    nameEn: 'Mild',          nameZh: '小辣' },
  regular: { id: 'regular', nameEn: 'Regular Spicy', nameZh: '正常辣' },
  extra:   { id: 'extra',   nameEn: 'Extra Spicy',   nameZh: '加辣' },
}
const NOODLE = [
  { id: 'thick', nameEn: 'Thick Round Noodles', nameZh: '粗面' },
  { id: 'wide',  nameEn: 'Wide Flat Noodles',   nameZh: '宽面' },
  { id: 'udon',  nameEn: 'Udon Noodles',        nameZh: '乌冬面' },
]
const REMOVE = {
  scallion: { id: 'no-scallion', nameEn: 'No Scallion',           nameZh: '不要葱' },
  cilantro: { id: 'no-cilantro', nameEn: 'No Cilantro',           nameZh: '不要香菜' },
  pickle:   { id: 'no-pickle',   nameEn: 'No Pickled Vegetables', nameZh: '不要咸菜' },
  woodear:  { id: 'no-woodear',  nameEn: 'No Wood Ear Mushroom',  nameZh: '不要木耳' },
  soybean:  { id: 'no-soybean',  nameEn: 'No Soybeans',           nameZh: '不要黄豆' },
  shiitake: { id: 'no-shiitake', nameEn: 'No Shiitake Mushroom',  nameZh: '不要香菇' },
  egg:      { id: 'no-egg',      nameEn: 'No Braised Egg',        nameZh: '不要卤蛋' },
}
const ADDONS = {
  riceNoodles:    { id: 'add-ricenoodles',    nameEn: 'Extra Rice Noodles', nameZh: '加粉',     delta: 2.5 },
  noodles:        { id: 'add-noodles',        nameEn: 'Extra Noodles',      nameZh: '加面',     delta: 3.5 },
  rice:           { id: 'add-rice',           nameEn: 'Extra Rice',         nameZh: '加饭',     delta: 2.5 },
  gardenMushroom: { id: 'add-gardenmushroom', nameEn: 'Extra Garden Mushroom (Wood Ear, Shiitake & Soybean)', nameZh: '加三鲜', delta: 2.5 },
  shreddedPork:   { id: 'add-shreddedpork',   nameEn: 'Extra Shredded Pork', nameZh: '加猪肉丝', delta: 2.5 },
  beefBrisket:    { id: 'add-beefbrisket',    nameEn: 'Extra Beef Brisket', nameZh: '加牛腩',   delta: 4.5 },
  braisedPork:    { id: 'add-braisedpork',    nameEn: 'Extra Braised Pork', nameZh: '加卤肉',   delta: 4.5 },
  egg:            { id: 'add-egg',            nameEn: 'Extra Egg',          nameZh: '加鸡蛋',   delta: 1.5 },
  vegetables:     { id: 'add-vegetables',     nameEn: 'Extra Vegetables',   nameZh: '加蔬菜',   delta: 2 },
  hamSausage:     { id: 'add-hamsausage',     nameEn: 'Extra Ham Sausage',  nameZh: '加火腿肠', delta: 3 },
}

// dish id -> { spice: [choices, defaultId], noodle: defaultId, remove: [...], addon: [...] }
const MODIFIERS = {
  1: { spice: [['none', 'extra'], 'none'],                     noodle: 'thick', remove: ['scallion', 'cilantro', 'pickle'],                                  addon: ['noodles', 'beefBrisket', 'egg', 'vegetables'] },
  2: { spice: [['none', 'extra'], 'none'],                     noodle: 'thick', remove: ['scallion', 'cilantro', 'pickle'],                                  addon: ['noodles', 'beefBrisket', 'egg', 'vegetables'] },
  3: { spice: [['none', 'mild', 'regular', 'extra'], 'regular'],                remove: ['pickle'],                                                          addon: ['riceNoodles', 'shreddedPork', 'egg', 'vegetables', 'hamSausage'] },
  4: { spice: [['none', 'extra'], 'none'],                                      remove: ['scallion', 'cilantro', 'pickle', 'woodear', 'soybean', 'shiitake'], addon: ['riceNoodles', 'gardenMushroom', 'egg', 'vegetables'] },
  5: { spice: [['mild', 'regular', 'extra'], 'regular'],                        remove: ['scallion', 'cilantro', 'pickle'],                                  addon: ['riceNoodles', 'beefBrisket', 'egg', 'vegetables'] },
  6: {                                                                          remove: ['egg', 'cilantro'],                                                 addon: ['rice', 'braisedPork', 'egg', 'vegetables'] },
}

for (const dish of menu) {
  const m = MODIFIERS[dish.id]
  if (!m) continue
  const groups = []
  if (m.spice) {
    groups.push({
      id: 'spice', type: 'single', required: true, default: m.spice[1],
      nameEn: 'Spice level', nameZh: '辣度',
      choices: m.spice[0].map(k => SPICE[k]),
    })
  }
  if (m.noodle) {
    groups.push({
      id: 'noodle', type: 'single', required: true, default: m.noodle,
      nameEn: 'Noodle type', nameZh: '面型',
      choices: NOODLE,
    })
  }
  if (m.remove) {
    groups.push({
      id: 'remove', type: 'multi', default: [],
      nameEn: 'Leave out', nameZh: '不要放',
      choices: m.remove.map(k => REMOVE[k]),
    })
  }
  groups.push({
    id: 'addon', type: 'multi', default: [],
    nameEn: 'Add-ons', nameZh: '加料',
    choices: m.addon.map(k => ADDONS[k]),
  })
  dish.optionGroups = groups
}

export default menu
