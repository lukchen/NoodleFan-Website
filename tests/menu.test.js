// 菜单的完整性检查。
//
// 补的是一次真实的险情:下架卤肉饭时删掉了 MODIFIERS[6],但 COMBO2_BASE 里
// 「202: [6, 2]」还指着它。那个循环在模块加载时就跑,a.spice 直接 TypeError ——
// 不是少一道菜,是整个点餐页白屏。build 不会报错(它只打包不执行),
// 单元测试当时也没碰 menu,所以这个雷能一路滚到客人面前。
import { describe, it, expect } from 'vitest'
import menu, { categories } from '../src/data/menu.js'

describe('菜单加载', () => {
  it('能加载,并且不是空的', () => {
    expect(Array.isArray(menu)).toBe(true)
    expect(menu.length).toBeGreaterThan(0)
  })

  it('菜品 id 不重复 —— 重复的话下单时按 id 查价会查到错的那道', () => {
    const ids = menu.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每道菜都有中英文名和价格', () => {
    for (const d of menu) {
      expect(d.nameZh, `菜品 ${d.id} 缺中文名`).toBeTruthy()
      expect(d.nameEn, `菜品 ${d.id} 缺英文名`).toBeTruthy()
      expect(typeof d.price, `菜品 ${d.id} 价格不是数字`).toBe('number')
      expect(d.price).toBeGreaterThan(0)
    }
  })

  it('每道菜的 category 都在 categories 里 —— 否则它不会出现在页面上任何一节', () => {
    const known = new Set(categories.map(c => c.id))
    for (const d of menu) {
      expect(known.has(d.category), `菜品 ${d.id} 的分类 ${d.category} 不存在`).toBe(true)
    }
  })

  it('选项组的每个选项都有名字和 id —— 空选项在弹窗里是一个点不动的空行', () => {
    for (const d of menu) {
      for (const g of d.optionGroups ?? []) {
        expect(g.choices?.length, `菜品 ${d.id} 的 ${g.id} 没有选项`).toBeGreaterThan(0)
        for (const c of g.choices) {
          expect(c?.id, `菜品 ${d.id} 的 ${g.id} 里有个选项没有 id`).toBeTruthy()
          expect(c?.nameZh).toBeTruthy()
        }
      }
    }
  })

  it('必选的单选组都有一个真实存在的默认值', () => {
    for (const d of menu) {
      for (const g of d.optionGroups ?? []) {
        if (g.type !== 'single' || !g.required) continue
        expect(g.choices.some(c => c.id === g.default),
          `菜品 ${d.id} 的 ${g.id} 默认值 ${g.default} 不在选项里`).toBe(true)
      }
    }
  })

  it('下架的菜不在菜单里,也不在任何套餐描述里', () => {
    const 下架 = ['卤肉饭', '姐妹花']
    const blob = JSON.stringify(menu)
    for (const name of 下架) {
      expect(blob.includes(name), `${name} 已下架,但菜单里还提到它`).toBe(false)
    }
  })
})
