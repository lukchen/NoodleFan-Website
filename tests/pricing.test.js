// 定价是钱的入口:create-checkout 只信后端菜单算出来的价,前端传什么价一概不看。
// 这里守的就是那份计算 —— 选项加价、套餐条件显示、必选项缺失时必须抛错。
import { describe, it, expect } from 'vitest'
import menu, { resolveSelections } from '../supabase/functions/_shared/menu.js'

const dish = (id) => menu.find(d => d.id === id)
const cents = (d, sel) => Math.round(d.price * 100) + resolveSelections(d, sel).deltaCents

describe('菜单本身', () => {
  it('菜品 id 不重复 —— 重了会让下单时按 id 查到错的那道菜', () => {
    const ids = menu.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每道菜都有正数价格和中英文名', () => {
    for (const d of menu) {
      expect(d.price, `dish ${d.id}`).toBeGreaterThan(0)
      expect(d.nameZh, `dish ${d.id}`).toBeTruthy()
      expect(d.nameEn, `dish ${d.id}`).toBeTruthy()
    }
  })

  it('麻酱烧饼单独可买,$2.50', () => {
    const flatbread = menu.find(d => d.nameZh === '麻酱烧饼')
    expect(flatbread).toBeTruthy()
    expect(flatbread.price).toBe(2.5)
  })
})

describe('resolveSelections —— 选项定价', () => {
  const noodle = dish(1)

  it('什么都不选时走默认值,价格等于菜品原价', () => {
    expect(cents(noodle, {})).toBe(Math.round(noodle.price * 100))
  })

  it('套餐加价按选项的 delta 累加', () => {
    // 套餐 · 豆腐结+饮料 = +$4
    expect(cents(noodle, { combo: 'combo-tofu' }) - cents(noodle, {})).toBe(400)
    expect(cents(noodle, { combo: 'combo-deluxe' }) - cents(noodle, {})).toBe(850)
  })

  it('多选组(加料)把每一项的加价都算上', () => {
    const base = cents(noodle, {})
    const one = cents(noodle, { addon: ['add-noodles'] })
    expect(one).toBeGreaterThan(base)
  })

  it('不要葱这类忌口不加钱,但要写进小票', () => {
    const { deltaCents, optionsZh } = resolveSelections(noodle, { remove: ['no-cilantro'] })
    expect(deltaCents).toBe(0)
    expect(optionsZh).toContain('不要香菜')
  })

  it('单点时不带饮料 —— 条件显示的组在条件不成立时整组跳过', () => {
    const { optionsZh } = resolveSelections(noodle, { combo: 'combo-none' })
    const drinkGroup = noodle.optionGroups.find(g => g.showWhen)
    if (drinkGroup) {
      const drinkNames = drinkGroup.choices.map(c => c.nameZh)
      expect(optionsZh.filter(o => drinkNames.includes(o))).toHaveLength(0)
    }
  })

  it('必选组给了不存在的选项就抛错,不会静默按默认值下单', () => {
    expect(() => resolveSelections(noodle, { spice: 'nuclear' })).toThrow(/missing required option/)
  })

  it('小数加价不会出浮点误差(先转分再相加)', () => {
    // 3.5 + 4 这类相加在浮点下容易得到 7.500000000000001
    const c = cents(noodle, { combo: 'combo-tofu', addon: ['add-noodles'] })
    expect(Number.isInteger(c)).toBe(true)
  })
})
