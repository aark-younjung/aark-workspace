import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
// 2026-06-06：公告從卡片堆疊改成右上角鈴鐺 + 下拉 panel（跟 GitHub / Notion 一致）
import NotificationBell from './NotificationBell'
// 2026-06-06：上 C 方向 logo（radar dial mark）— 取代之前留 wordmark only 的階段
import AarkMark from './AarkMark'

// 全站共用暗色頂部導覽列：Logo + 桌機 nav + 登入 / 用戶區 + 手機 nav
// 沿用 HomeDark 同款 — 黑色玻璃條 + 橘色強調 hover
export default function SiteHeader() {
  const { user, isPro, userName, signOut } = useAuth()

  return (
    <header className="relative z-50 border-b border-white/8 bg-black/50 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Logo 區（2026-06-06 v3 改）— 補上 C 方向 radar dial mark + 既有 Aark wordmark */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 no-underline">
            <AarkMark size={32} className="flex-shrink-0" />
            <span className="text-xl sm:text-2xl font-bold text-white leading-none"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '-0.04em',
              }}>
              Aark
            </span>
            <span className="hidden sm:inline text-sm sm:text-base text-white/55 leading-none">
              · AI 雷達
            </span>
          </Link>

          {/* 桌機 nav */}
          <nav className="hidden md:flex items-center gap-5">
            <Link to="/showcase" className="text-white hover:text-orange-300 transition-colors text-sm">排行榜</Link>
            <Link to="/compare" className="text-white hover:text-orange-300 transition-colors text-sm">競品比較</Link>
            <Link to="/pricing" className="text-white hover:text-orange-300 transition-colors text-sm">定價</Link>
            <Link to="/content-audit" className="text-white hover:text-orange-300 transition-colors text-sm">文章分析</Link>
            <Link to="/faq" className="text-white hover:text-orange-300 transition-colors text-sm">FAQ</Link>
          </nav>

          {/* 右側：公告鈴鐺 + 登入 / 用戶 avatar / 升級 Pro / 登出 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* 公告鈴鐺（2026-06-06）— 0 條未讀時自動隱藏、跟登入狀態無關 */}
            <NotificationBell />
            {user ? (
              <>
                {!isPro && (
                  <Link to="/pricing" className="hidden sm:block px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors font-medium">升級 Pro</Link>
                )}
                <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold">
                      {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </Link>
                <button onClick={signOut} className="text-white/70 hover:text-white text-sm sm:text-sm transition-colors">登出</button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
            )}
          </div>
        </div>

        {/* 手機版 nav — 橫向滾動 */}
        <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
          {[
            ['/showcase', '排行榜'], ['/compare', '競品比較'],
            ['/pricing', '定價'], ['/content-audit', '文章分析'], ['/faq', 'FAQ'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="flex-shrink-0 px-3 py-1 text-sm text-white hover:text-orange-300 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap">{label}</Link>
          ))}
        </div>
      </div>
    </header>
  )
}
