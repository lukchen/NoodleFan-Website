import { useEffect } from 'react'

// 把「真正看得见的那块区域」写成 CSS 变量,供弹窗定位用。
//
// 为什么非得用 JS:iOS Safari 的 position:fixed 是按 layout viewport 排版的,
// 而 layout viewport 的顶部藏在地址栏底下、底部伸到工具栏底下。所以 inset:0
// 的弹窗层,上下各有一截在屏幕外 —— 顶对齐的弹窗标题就被地址栏压住了。
// 换 svh / dvh 只改高度,改不了这个「起点就在屏幕外」的事实。
//
// visualViewport 给的才是真实可见区:
//   offsetTop —— 可见区顶端相对 layout viewport 的偏移(地址栏展开时 > 0)
//   height    —— 可见区高度
// 地址栏收放、软键盘弹出都会触发 resize/scroll,跟着更新即可。
export default function useVisualViewport(active = true) {
  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    if (!vv) return                       // 不支持就退回 CSS 里的默认值

    const root = document.documentElement
    function sync() {
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
      root.style.setProperty('--vv-h', `${vv.height}px`)
    }
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      root.style.removeProperty('--vv-top')
      root.style.removeProperty('--vv-h')
    }
  }, [active])
}
