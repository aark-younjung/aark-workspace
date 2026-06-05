/**
 * AarkMark — Direction C「暗黑科技權威派」radar dial mark
 *
 * 設計來源：_prototypes/logo-exploration-aark.html#2（Direction C 雷達 dial + 鏡像 wedge）
 *   - 外環：雷達範圍
 *   - 右上實心 wedge（85% 不透明）+ 左上鏡像 wedge（40% 不透明）→ 視覺上形成「雙 A 山峰」
 *   - 中央圓點：雷達中心
 *
 * 簡化版（拿掉內環 + 十字線 + 4 個 cardinal ticks）— 在 favicon / 小尺寸場景仍清晰
 *
 * 用法：
 *   import AarkMark from '../components/v2/AarkMark'
 *   <AarkMark size={32} />
 *   <AarkMark size={24} className="..." />
 */
export default function AarkMark({ size = 32, color = '#18c590', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="Aark logo"
    >
      {/* 外環 — 雷達範圍 */}
      <circle cx="32" cy="32" r="26" stroke={color} strokeWidth="3" />
      {/* 右上實心 wedge — 形成 A 山峰 */}
      <path d="M 32 32 L 32 6 L 51 16 Z" fill={color} opacity="0.85" />
      {/* 左上鏡像 wedge — 形成第二個 A */}
      <path d="M 32 32 L 32 6 L 13 16 Z" fill={color} opacity="0.4" />
      {/* 中央圓點 — 雷達中心 */}
      <circle cx="32" cy="32" r="3" fill={color} />
    </svg>
  )
}
