import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

const PRO_PRICE = 1490

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentUsers, setRecentUsers] = useState([])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: proUsers },
        { count: totalWebsites },
        { data: recent },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
        supabase.from('websites').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('id, name, email, is_pro, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        totalUsers: totalUsers || 0,
        proUsers: proUsers || 0,
        totalWebsites: totalWebsites || 0,
        mrr: (proUsers || 0) * PRO_PRICE,
      })
      setRecentUsers(recent || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const STAT_CARDS = stats ? [
    { label: '總用戶數', value: stats.totalUsers.toLocaleString(), icon: '👥', color: 'text-blue-400', link: '/admin/users' },
    { label: 'Pro 用戶', value: stats.proUsers.toLocaleString(), icon: '⭐', color: 'text-orange-400', link: '/admin/users?filter=pro' },
    { label: '已分析網站', value: stats.totalWebsites.toLocaleString(), icon: '🌐', color: 'text-emerald-400', link: '/admin/websites' },
    { label: '估算 MRR', value: `NT$ ${stats.mrr.toLocaleString()}`, icon: '💰', color: 'text-purple-400', link: '/admin/revenue' },
  ] : []

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">後臺總覽</h1>
            <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-800 rounded-xl p-5 animate-pulse h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {STAT_CARDS.map(card => (
                <Link key={card.label} to={card.link} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl p-5 transition-colors group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{card.label}</p>
                </Link>
              ))}
            </div>
          )}

          {/* 快捷導覽 */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { to: '/admin/users', icon: '👥', label: '用戶管理', desc: '查看所有用戶、手動升降級 Pro' },
              { to: '/admin/websites', icon: '🌐', label: '掃描紀錄', desc: '查看所有被分析的網站與分數' },
              { to: '/admin/revenue', icon: '💰', label: '營收儀表板', desc: '訂閱數、MRR、付費用戶統計' },
            ].map(item => (
              <Link key={item.to} to={item.to} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-orange-500/50 transition-colors group">
                <div className="text-3xl mb-3">{item.icon}</div>
                <p className="text-white font-semibold mb-1">{item.label}</p>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </Link>
            ))}
          </div>

          {/* 最新加入用戶 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold">最新加入用戶</h2>
              <Link to="/admin/users" className="text-orange-400 text-sm hover:text-orange-300 transition-colors">查看全部 →</Link>
            </div>
            <div className="divide-y divide-slate-700">
              {recentUsers.map(u => (
                <div key={u.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-slate-200 text-sm font-medium">{u.name || '—'}</p>
                    <p className="text-slate-500 text-xs">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_pro ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`}>
                      {u.is_pro ? 'Pro' : 'Free'}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                </div>
              ))}
              {recentUsers.length === 0 && (
                <p className="px-6 py-6 text-slate-500 text-sm text-center">尚無用戶資料</p>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
