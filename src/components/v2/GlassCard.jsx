import { useState } from 'react'
import { T } from '../../styles/v2-tokens'

// 玻璃擬態卡片 — v2 設計系統的基礎容器
// props:
//   color   給定主色，hover 時邊框會變成該色 + 投影
//   hover   true 時 hover 會輕微浮起（translateY -2px）
//   onClick 變成 cursor: pointer
export default function GlassCard({ children, style, color, hover, onClick }) {
  const [hov, setHov] = useState(false)
  // 邊框優先序：有色 hover > 無色 hover > 有色靜態 > 預設靜態
  const borderColor =
    hov && color ? color + '55' :
    hov ? T.cardBorderHover :
    color ? color + '28' :
    T.cardBorder

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.cardBg,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: `1px solid ${borderColor}`,
        borderRadius: T.rL,
        transition: 'border-color .2s, box-shadow .2s, transform .2s',
        transform: hover && hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov && color
          ? `0 8px 36px ${color}1a`
          : '0 2px 20px rgba(0,0,0,.45)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
