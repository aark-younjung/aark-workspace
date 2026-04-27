import { useState, useEffect } from 'react'

// 數字 0 → target 平滑滾動動畫，給 KPI 卡用
// duration: 動畫總時長（ms）/ delay: 延遲開始（ms，可錯開多張卡的動畫）
export function useCountUp(target, duration = 1500, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf
    const t = setTimeout(() => {
      let start = null
      const step = (ts) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / duration, 1)
        // ease-out cubic — 起頭快、收尾慢
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [target, duration, delay])
  return val
}
