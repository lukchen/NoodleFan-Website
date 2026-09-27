import { useState, useEffect } from 'react'

// 吸顶条:往下滚时收起,往上滚时露出。
//
// 为什么不能就这么一直吸着:sticky 条是不透明的,内容从它底下滑过去 ——
// 也就是说屏幕顶上那几十像素永远被占着。菜品卡正好在那个位置时,客人看到的是
// 「一段描述 + 一个价格」,菜名被压在条底下,像坏掉一样。
//
// 但取餐点和分类切换确实该随手可得。折中:看菜(往下滚)时让开,找导航(往上滚)
// 时立刻回来 —— 这两个动作的意图本来就不一样。
//
// threshold 是为了忽略手指的细微抖动和 iOS 的橡皮筋回弹,不然条会疯狂闪。
export default function useStickyReveal({ threshold = 8, showAbove = 160 } = {}) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const dy = y - last
        if (Math.abs(dy) > threshold) {
          // 页面顶部附近永远显示 —— 那儿本来就没有会被挡住的菜品卡,
          // 而且客人刚进来就该看到自己选的是哪个取餐点。
          setHidden(y > showAbove && dy > 0)
          last = y
        }
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold, showAbove])

  return hidden
}
