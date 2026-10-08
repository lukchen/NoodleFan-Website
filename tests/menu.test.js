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

  it('每道菜的图都真的在 public/images 里 —— 文件名拼错就是一个破图框', () => {
    const fs = require('node:fs')
    for (const d of menu) {
      for (const img of [d.image, ...(d.images ?? [])]) {
        // 菜单里的路径是 URL 编码过的(中文名、空格),对应到磁盘要先解回来
        const file = 'public' + decodeURIComponent(img)
        expect(fs.existsSync(file), `菜品 ${d.id}(${d.nameZh}) 的图找不到:${img}`).toBe(true)
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

// 「不要放」的选项和描述必须对得上。
//
// 这条规则是 Betsy 定的:菜里有的东西才给「不要」的选择。两个方向都会出事 ——
// 客人勾了「不要香菜」、拿到手发现本来就没有,会觉得这店不靠谱;
// 反过来碗里有葱却没写进描述,不吃葱的人根本不会想到要去点那个选项。
//
// 查出来的办法很笨但管用:选项说可以去掉某样配料,描述里就得提到它。
describe('「不要放」的选项和描述对得上', () => {
  // 选项 id → 描述里该出现的词(中文 / 英文)
  const 配料 = {
    scallion: ['葱', 'callion'],
    cilantro: ['香菜', 'ilantro'],
    pickle:   ['咸菜', 'ickled'],
    woodear:  ['木耳', 'ood ear'],
    soybean:  ['黄豆', 'oybean'],
    shiitake: ['香菇', 'hiitake'],
    egg:      ['蛋',   'gg'],
  }

  // 双人套餐的描述只写「A + B 两份主食」,本来就不列配料 —— 不适用这条规则。
  const 单品 = (d) => d.category !== 'combo2'

  it.each(menu.filter(单品).filter(d => (d.optionGroups ?? []).some(g => g.id === 'remove')).map(d => [d.nameZh, d]))(
    '%s',
    (_name, dish) => {
      const group = dish.optionGroups.find(g => g.id === 'remove')
      for (const choice of group.choices) {
        const [zh, en] = 配料[choice.id.replace('no-', '')] ?? []
        if (!zh) continue
        expect(dish.descZh.includes(zh),
          `可以「${choice.nameZh}」,但中文描述里没提到${zh}`).toBe(true)
        expect(dish.descEn.toLowerCase().includes(en.toLowerCase()),
          `可以「${choice.nameZh}」,但英文描述里没提到${en}`).toBe(true)
      }
    },
  )
})

// 微信群二维码那张图也必须真的在 public/ 里。
//
// 补的是一次真实的事故:微信导出的群名片有时是 .png 有时是 .JPG。
// 换码时文件扩展名变了、QR_SRC 没跟着改,页面上就是一个破图框 ——
// 而且本地开发时浏览器可能还缓存着旧图,看不出来,只有客人那边是空的。
// 这是「新客人进不了群」,不是「图有点丑」。
describe('微信群二维码', () => {
  it('QR_SRC 指的文件真的存在', async () => {
    const fs = require('node:fs')
    const { QR_SRC } = await import('../src/wechat-qr.js')
    const file = 'public/' + decodeURIComponent(QR_SRC)
    expect(fs.existsSync(file), `QR_SRC 指向的图找不到:${QR_SRC}`).toBe(true)
  })

  it('有效期还没过 —— 过期了整块微信群入口会从网站上消失', async () => {
    const { qrValid, QR_EXPIRES } = await import('../src/wechat-qr.js')
    // 这条会在码过期那天变红。那正是它存在的意义:提醒换码,
    // 而不是等到有人问「群二维码怎么没了」。
    expect(qrValid(), `群码 ${QR_EXPIRES} 已过期,换一张新的并更新 QR_EXPIRES`).toBe(true)
  })
})
