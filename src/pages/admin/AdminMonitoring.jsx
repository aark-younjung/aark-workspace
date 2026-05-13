import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const DAY_MS = 24 * 60 * 60 * 1000

// 取得某日（UTC）的 00:00 起始 ISO，供 GROUP BY 日期用
function dayKey(d) {
  const dt = new Date(d)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function dayLabel(key) {
  // YYYY-MM-DD → MM/DD
  return key.slice(5).replace('-', '/')
}

export default function AdminMonitoring() {
  const [stats, setStats] = useState(null)
  const [trend7, setTrend7] = useState([])
  const [trend30, setTrend30] = useState([])
  const [topUsers, setTopUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const day30Ago = new Date(now.getTime() - 30 * DAY_MS)
      const day7Ago = new Date(now.getTime() - 7 * DAY_MS)

      // 並行抓 4 個資料源：本月所有 responses（含 cost / mention / user_id）/ 過去 30 天 responses（趨勢圖）/ 用戶名稱 lookup
      const [
        { data: monthResponses },
        { data: trendResponses },
      ] = await Promise.all([
        supabase
          .from('aivis_responses')
          .select('user_id, cost_usd, brand_mentioned, created_at')
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('aivis_responses')
          .select('created_at, brand_mentioned')
          .gte('created_at', day30Ago.toISOString())
          .order('created_at', { ascending: true }),
      ])

      const monthRows = monthResponses || []
      const trendRows = trendResponses || []

      // ── 上排 KPI：本月掃描次數 / 本月成本（USD）/ 本月提及率 / 本月活躍用戶數
      const monthScans = monthRows.length
      const monthCostUsd = monthRows.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
      const monthMentioned = monthRows.filter(r => r.brand_mentioned).length
      const monthMentionRate = monthScans > 0 ? ((monthMentioned / monthScans) * 100).toFixed(1) : '0.0'
      const monthActiveUsers = new Set(monthRows.map(r => r.user_id)).size

      setStats({
        monthScans,
        monthCostUsd,
        monthMentionRate,
        monthActiveUsers,
        monthMentioned,
      })

      // ── 30 天趨勢：按日 GROUP BY，含總掃描 + 被提及次數
      const buckets30 = new Map()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * DAY_MS)
        const k = dayKey(d)
        buckets30.set(k, { name: dayLabel(k), 掃描次數: 0, 被提及: 0 })
      }
      trendRows.forEach(r => {
        const k = dayKey(r.created_at)
        const b = buckets30.get(k)
        if (!b) return
        b.掃描次數 += 1
        if (r.brand_mentioned) b.被提及 += 1
      })
      const arr30 = Array.from(buckets30.values())
      setTrend30(arr30)
      // 7 天趨勢：直接取最後 7 筆
      setTrend7(arr30.slice(-7))

      // ── 本月 Top 10 重度使用者（按掃描次數）
      const userAgg = new Map()
      monthRows.forEach(r => {
        const cur = userAgg.get(r.user_id) || { user_id: r.user_id, scans: 0, cost: 0, mentioned: 0 }
        cur.scans += 1
        cur.cost += Number(r.cost_usd || 0)
        if (r.brand_mentioned) cur.mentioned += 1
        userAgg.set(r.user_id, cur)
      })
      const topList = Array.from(userAgg.values())
        .sort((a, b) => b.scans - a.scans)
        .slice(0, 10)

      // 帶用戶 email/name 進來
      if (topList.length > 0) {
        const ids = topList.map(u => u.user_id)
        const { data: profilesList } = await supabase
          .from('profiles')
          .select('id, name, email, is_pro')
          .in('id', ids)
        const profileMap = new Map((profilesList || []).map(p => [p.id, p]))
        topList.forEach(u => {
          const p = profileMap.get(u.user_id)
          u.name = p?.name || ''
          u.email = p?.email || '(unknown)'
          u.is_pro = !!p?.is_pro
        })
      }
      setTopUsers(topList)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 4 張上排 KPI 卡：本月掃描 / 本月成本 / 本月提及率 / 本月活躍用戶
  const STAT_CARDS = stats ? [
    { label: '本月 aivis 掃描', value: stats.monthScans.toLocaleString(), sub: `${stats.monthMentioned} 次被品牌提及`, color: 'text-blue-400', icon: '🔍' },
    { label: '本月 API 成本', value: `$ ${stats.monthCostUsd.toFixed(2)}`, sub: `≈ NT$ ${Math.round(stats.monthCostUsd * 31).toLocaleString()}（×31 換算）`, color: 'text-amber-400', icon: '💸' },
    { label: '本月品牌提及率', value: `${stats.monthMentionRate}%`, sub: `${stats.monthMentioned} / ${stats.monthScans} 次回應`, color: stats.monthMentionRate > 30 ? 'text-emerald-400' : 'text-orange-400', icon: '🎯' },
    { label: '本月活躍用戶', value: stats.monthActiveUsers.toLocaleString(), sub: '至少跑過 1 次 aivis 掃描', color: 'text-purple-400', icon: '👥' },
  ] : []

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">系統監控</h1>
            <p className="text-slate-400 text-sm mt-1">
              aivis AI 曝光監測模組使用量、API 成本與品牌提及率趨勢。錯誤日誌 viewer 待 schema 加 error 欄位後另外做。
            </p>
          </div>

          {/* 上排：4 張 KPI */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl p-5 h-32 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

          {/* 7 天趨勢 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">近 7 天掃描趨勢</h2>
              <p className="text-slate-500 text-xs">按日統計 aivis_responses 寫入量</p>
            </div>
            {trend7.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="掃描次數" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                  <Line type="monotone" dataKey="被提及" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-10">尚無資料</p>
            )}
          </div>

          {/* 30 天趨勢 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">近 30 天掃描趨勢</h2>
              <p className="text-slate-500 text-xs">看月度起伏與週週成長</p>
            </div>
            {trend30.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={3} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="掃描次數" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="被提及" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-10">尚無資料</p>
            )}
          </div>

          {/* 本月 Top 10 重度使用者 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold">本月 Top 10 重度使用者</h2>
              <p className="text-slate-500 text-xs">依掃描次數排序，異常用量可警示刷單</p>
            </div>
            <div className="divide-y divide-slate-700">
              {topUsers.length === 0 ? (
                <p className="px-6 py-10 text-slate-500 text-sm text-center">本月尚無 aivis 掃描紀錄</p>
              ) : (
                topUsers.map((u, i) => (
                  <div key={u.user_id} className="flex items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 text-xs w-5 text-right">{i + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-slate-200 text-sm font-medium">{u.name || '（未填姓名）'}</p>
                          {u.is_pro && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">⭐ Pro</span>}
                        </div>
                        <p className="text-slate-500 text-xs">{u.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-400">
                        {u.scans.toLocaleString()} 次掃描
                      </p>
                      <p className="text-slate-500 text-xs">
                        $ {u.cost.toFixed(3)} · 提及 {u.mentioned} 次
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
