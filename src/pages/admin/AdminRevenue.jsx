import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const PRO_PRICE = 1490

export default function AdminRevenue() {
  const [stats, setStats] = useState(null)
  const [proUsers, setProUsers] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 區分「付費 Pro」(stripe_subscription_id 不為 null) 與「手動授予 Pro」
      // MRR 只計算實際刷卡付費的用戶；授予僅是行銷/補償行為，不應算進營收
      const [
        { count: totalUsers },
        { count: proCount },
        { count: paidProCount },
        { data: proList },
        { count: totalWebsites },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true).not('stripe_subscription_id', 'is', null),
        supabase.from('profiles').select('id, name, email, created_at, stripe_subscription_id, subscribed_at').eq('is_pro', true).order('created_at', { ascending: false }),
        supabase.from('websites').select('*', { count: 'exact', head: true }),
      ])

      const grantedProCount = (proCount || 0) - (paidProCount || 0)

      setStats({
        totalUsers: totalUsers || 0,
        proCount: proCount || 0,
        paidProCount: paidProCount || 0,
        grantedProCount,
        mrr: (paidProCount || 0) * PRO_PRICE,
        conversionRate: totalUsers ? (((paidProCount || 0) / totalUsers) * 100).toFixed(1) : '0.0',
        totalWebsites: totalWebsites || 0,
      })
      setProUsers(proList || [])

      // 近 6 個月「實際付費」用戶圖表 — 用 subscribed_at（真實刷卡時間）而非 created_at（註冊時間）
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({
          label: `${d.getMonth() + 1}月`,
          year: d.getFullYear(),
          month: d.getMonth(),
        })
      }

      const { data: allPaidUsers } = await supabase
        .from('profiles')
        .select('subscribed_at')
        .eq('is_pro', true)
        .not('stripe_subscription_id', 'is', null)
        .not('subscribed_at', 'is', null)

      const chart = months.map(m => {
        const count = (allPaidUsers || []).filter(u => {
          const d = new Date(u.subscribed_at)
          return d.getFullYear() === m.year && d.getMonth() === m.month
        }).length
        return { name: m.label, 新增付費用戶: count, MRR: count * PRO_PRICE }
      })
      setChartData(chart)

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const STAT_CARDS = stats ? [
    // MRR 只算實際刷卡付費，不含手動授予
    { label: 'MRR（實際付費）', value: `NT$ ${stats.mrr.toLocaleString()}`, sub: `${stats.paidProCount} 位付費用戶 × NT$${PRO_PRICE}`, color: 'text-orange-400', icon: '💰' },
    { label: 'Pro 用戶數', value: stats.proCount.toLocaleString(), sub: `付費 ${stats.paidProCount} + 授予 ${stats.grantedProCount}`, color: 'text-yellow-400', icon: '⭐' },
    { label: '付費轉換率', value: `${stats.conversionRate}%`, sub: '註冊 → 實際付費', color: 'text-emerald-400', icon: '📈' },
    { label: '已分析網站', value: stats.totalWebsites.toLocaleString(), sub: '累積分析次數', color: 'text-blue-400', icon: '🌐' },
  ] : []

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">營收儀表板</h1>
            <p className="text-slate-400 text-sm mt-1">MRR 與轉換率僅計算實際透過 Stripe 付費的用戶（手動授予不算）</p>
          </div>

          {/* 數字卡 */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl p-5 h-28 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {STAT_CARDS.map(card => (
                <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="text-2xl mb-3">{card.icon}</div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{card.label}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* 圖表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-white font-semibold mb-4">近 6 個月 Pro 用戶增長</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="新增付費用戶" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-10">尚無資料</p>
            )}
          </div>

          {/* Pro 用戶列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-semibold">Pro 用戶列表（{proUsers.length} 人）</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {proUsers.length === 0 ? (
                <p className="px-6 py-10 text-slate-500 text-sm text-center">尚無 Pro 用戶</p>
              ) : (
                proUsers.map((u, i) => {
                  // 區分真實付費（有 stripe_subscription_id）與手動授予
                  const isPaid = !!u.stripe_subscription_id
                  // 升級時間：付費用戶用 subscribed_at（刷卡日），授予用戶用 created_at（註冊日）做為 fallback
                  const upgradeDate = u.subscribed_at || u.created_at
                  return (
                    <div key={u.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600 text-xs w-5 text-right">{i + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-200 text-sm font-medium">{u.name || '（未填姓名）'}</p>
                            {/* 區分付費 / 授予的徽章，營收只計付費那一群 */}
                            {isPaid ? (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">💳 付費</span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600/40 text-slate-400 font-medium">⭐ 授予</span>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${isPaid ? 'text-orange-400' : 'text-slate-500'}`}>
                          {isPaid ? `NT$ ${PRO_PRICE.toLocaleString()}/月` : '不計入營收'}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {isPaid ? '訂閱於' : '授予於'} {new Date(upgradeDate).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
