import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AarkMark from '../../components/v2/AarkMark'

const NAV = [
  { path: '/admin', label: '總覽', icon: '📊' },
  { path: '/admin/users', label: '用戶管理', icon: '👥' },
  { path: '/admin/websites', label: '掃描紀錄', icon: '🌐' },
  { path: '/admin/revenue', label: '營收儀表板', icon: '💰' },
  { path: '/admin/announcements', label: '站內公告', icon: '📢' },
  { path: '/admin/showcase', label: '排行榜審核', icon: '⭐' },
  { path: '/admin/monitoring', label: '系統監控', icon: '📡' },
  { path: '/admin/activity', label: '活躍分析', icon: '📈' },
  { path: '/admin/waitlist', label: '代理商候補', icon: '🤝' },
]

export default function AdminLayout({ children }) {
  const { pathname } = useLocation()
  const { userName, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-slate-800">
          {/* Brand（2026-06-06 v3）— C 方向 radar mark + Aark wordmark + 後臺管理 */}
          <div className="flex items-center gap-2">
            <AarkMark size={28} className="flex-shrink-0" />
            <span className="text-lg font-bold text-white leading-none"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '-0.04em',
              }}>
              Aark
            </span>
            <div>
              <p className="text-white text-sm font-bold leading-none">後臺管理</p>
              <p className="text-slate-500 text-sm mt-0.5">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const isActive = item.path === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800">
          <p className="text-sm text-slate-500 mb-2 truncate">{userName}</p>
          <div className="flex gap-2">
            <Link
              to="/"
              className="flex-1 text-center text-sm px-2 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              前臺
            </Link>
            <button
              onClick={handleSignOut}
              className="flex-1 text-sm px-2 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
