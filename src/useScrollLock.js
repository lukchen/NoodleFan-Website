import { useEffect } from 'react'

// 弹窗/抽屉打开时锁住背景滚动。
// 不锁的话手机上滑选项框会「穿透」带着底下的菜单一起动,手指一松弹窗还在、
// 菜单已经滚到别处去了。记住并还原原来的 overflow,避免多个弹窗互相踩。
export default function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow }
  }, [active])
}
