import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * 亮色站台共用頂部導覽 — FAQ/Pricing/Showcase 共用（2026-08-26）。
 * 文案與結構照抄 HomeLight.jsx 的 hl-nav（同狀態同字：登入者「進入儀表板」，
 * 訪客「登入」＋「免費註冊」），視覺 token 對齊 .homelight/.appshell。
 */
export default function SiteHeader() {
  const { user } = useAuth()
  return (
    <header className="ls-nav">
      <Link to="/" className="ls-wm">
        <svg className="ls-mark" width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
          <circle cx="17" cy="17" r="15.5" fill="none" stroke="rgba(0,0,62,.12)" />
          <circle cx="17" cy="17" r="10" fill="none" stroke="rgba(0,0,62,.12)" />
          <circle cx="17" cy="17" r="4.5" fill="none" stroke="rgba(0,0,62,.12)" />
          <g className="sweep"><path d="M17 17 L17 1.5 A15.5 15.5 0 0 1 30 9 Z" fill="#ff6e34" opacity=".9" /></g>
          <circle cx="17" cy="17" r="2.4" fill="#00003e" />
        </svg>
        <span className="nm">方舟 AI 雷達</span>
      </Link>
      <div className="r">
        {user ? (
          <Link to="/app/websites" className="ls-btn ls-cta ls-sm">進入儀表板</Link>
        ) : (
          <>
            <Link to="/login" className="ls-btn ls-ghost ls-sm">登入</Link>
            <Link to="/register" className="ls-btn ls-cta ls-sm">免費註冊</Link>
          </>
        )}
      </div>
    </header>
  )
}
