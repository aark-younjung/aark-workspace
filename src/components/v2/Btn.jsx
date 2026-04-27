import { useState } from 'react'
import { T } from '../../styles/v2-tokens'

// v2 設計系統的標準按鈕
// variant:
//   primary   主 CTA — 橘紅漸層 + 投影（首頁「立即分析」、Pro 升級）
//   secondary 次要動作 — 半透明白底
//   ghost     無存在感 — 透明底細邊框（取消、返回類）
export default function Btn({ children, variant = 'primary', onClick, style, type = 'button', disabled }) {
  const [hov, setHov] = useState(false)

  const base = {
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: T.font,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    transition: 'all .2s',
    padding: '11px 22px',
    lineHeight: 1,
    opacity: disabled ? 0.45 : 1,
  }

  const variants = {
    primary: {
      // 橘 → 深紅漸層；hover 時更亮
      background: hov
        ? 'linear-gradient(135deg,#fb923c,#dc2626)'
        : `linear-gradient(135deg,${T.orange},${T.orangeDeep})`,
      color: '#fff',
      boxShadow: hov
        ? '0 6px 30px rgba(249,115,22,.55)'
        : '0 2px 16px rgba(249,115,22,.32)',
      transform: hov && !disabled ? 'translateY(-1px)' : 'none',
    },
    secondary: {
      background: hov ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.05)',
      color: T.text,
      border: `1px solid rgba(255,255,255,${hov ? .14 : .08})`,
    },
    ghost: {
      background: 'transparent',
      color: T.textMid,
      border: `1px solid rgba(255,255,255,${hov ? .1 : .06})`,
      fontSize: 12,
      padding: '7px 14px',
    },
  }

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  )
}
