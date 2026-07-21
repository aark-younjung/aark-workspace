import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'

/**
 * 導覽列配色切換鈕（2026-07-21）
 *
 * 放導覽列而非只放帳號頁的理由：未登入訪客也能切。
 * 但真正決定「訪客第一眼觀感」的仍是預設主題 —— 這顆是給想自己調的人用的。
 *
 * 刻意做小：只有一顆圓鈕 + 下拉，不搶導覽列空間。
 */
export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // 點外面 / Esc 關閉
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey) }
  }, [open])

  const current = themes[theme]

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="切換介面配色"
        aria-expanded={open}
        title="切換介面配色"
        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        {/* 用目前主題的兩個代表色當圖示，比放一個調色盤 icon 更直觀 */}
        <span className="flex gap-0.5">
          {(current?.swatch || []).slice(0, 2).map((c, i) => (
            <span key={i} style={{ width: 8, height: 14, borderRadius: 2, background: c, display: 'block' }} />
          ))}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl p-1.5 z-[80]"
          style={{
            minWidth: 190,
            background: 'rgba(10,14,18,0.97)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="px-2.5 py-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>介面配色</div>
          {Object.entries(themes).map(([key, t]) => {
            const active = theme === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setTheme(key); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                style={{ background: active ? 'rgba(255,255,255,0.09)' : 'transparent' }}
              >
                <span className="flex gap-1 flex-shrink-0">
                  {t.swatch.map((c, i) => (
                    <span key={i} style={{
                      width: 13, height: 13, borderRadius: 3, background: c,
                      border: '1px solid rgba(255,255,255,0.16)', display: 'block',
                    }} />
                  ))}
                </span>
                <span className="text-sm flex-1" style={{ color: 'rgba(255,255,255,0.9)' }}>{t.label}</span>
                {t.beta && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{
                    background: 'rgba(245,158,11,0.16)', color: '#fcd34d', whiteSpace: 'nowrap',
                  }}>測試</span>
                )}
                {active && <span className="text-xs" style={{ color: '#18c590' }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
