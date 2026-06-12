import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

const DAY_MS = 24 * 60 * 60 * 1000
// 活動回看窗：120 天（涵蓋「>90 天=不活躍」的分界 + 緩衝）
const LOOKBACK_DAYS = 120

// =====================================================
// 分群定義 — 以「最後一次產品行為」距今天數切
// 產品行為 = aivis 掃描 / 網站掃描 / 新增網站 / 批次掃描（登入但沒做事不算活躍）
// =====================================================
const SEGMENTS = [
  { key: 'hot',      label: '🔥 活躍',     desc: '7 天內有活動',           color: 'text-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { key: 'warm',     label: '🌤 一般',     desc: '8–30 天前有活動',        color: 'text-blue-400',    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { key: 'sleeping', label: '😴 沉睡',     desc: '31–90 天前有活動',       color: 'text-amber-400',   chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { key: 'lost',     label: '🪦 不活躍',   desc: '超過 90 天無活動',        color: 'text-slate-400',   chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { key: 'new',      label: '🆕 未啟用',   desc: '註冊 14 天內、還沒用過',  color: 'text-purple-400',  chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
]
const SEGMENT_MAP = Object.fromEntries(SEGMENTS.map(s => [s.key, s]))

function classify(user) {
  const now = Date.now()
  const regDays = (now - new Date(user.created_at).getTime()) / DAY_MS
  if (!user.lastActive) {
    // 回看窗內完全無活動：新帳號=未啟用、老帳號=不活躍
    return regDays <= 14 ? 'new' : 'lost'
  }
  const idleDays = (now - user.lastActive) / DAY_MS
  if (idleDays <= 7) return 'hot'
  if (idleDays <= 30) return 'warm'
  if (idleDays <= 90) return 'sleeping'
  return 'lost'
}

// 「3 天前」「今天」這種人話格式
function agoLabel(ts) {
  if (!ts) return '—'
  const days = Math.floor((Date.now() - ts) / DAY_MS)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

function planChip(u) {
  if (u.is_pro) return <span className="px-2 py-0.5 rounded text-xs border bg-orange-500/15 text-orange-300 border-orange-500/30">Pro</span>
  if (u.is_trial) return <span className="px-2 py-0.5 rounded text-xs border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">試用</span>
  return <span className="px-2 py-0.5 rounded text-xs border bg-slate-500/15 text-slate-400 border-slate-500/30">Free</span>
}

export default function AdminActivity() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(null)        // null = 全部；'hot' 等 = 分群過濾；'risk' / 'upsell' = 行動名單
  const [error, setError] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const cutoff = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString()

      // 並行抓 5 個來源。各 query 上限 1000 row（PostgREST 預設）、皆按時間倒序 —
      // 取的是「最新事件」，現階段量級下足以判定每個用戶的最後活躍時間。
      // ⚠️ 規模備忘：當單一來源 120 天事件數 > 1000 時，老用戶的最後事件可能被擠出窗外
      // 而誤判成不活躍 → 屆時改用 Supabase RPC（SQL GROUP BY user_id, MAX(created_at)）一次到位。
      const [
        { data: profiles, error: pErr },
        { data: aivisRows },
        { data: siteRows },
        { data: auditRows },
        { data: bulkRows },
      ] = await Promise.all([
        supabase.from('profiles')
          .select('id, name, email, is_pro, is_trial, created_at')
          .order('created_at', { ascending: false }).limit(1000),
        supabase.from('aivis_responses')
          .select('user_id, created_at')
          .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(1000),
        supabase.from('websites')
          .select('id, user_id, created_at')
          .order('created_at', { ascending: false }).limit(1000),
        supabase.from('seo_audits')
          .select('website_id, created_at')
          .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(1000),
        supabase.from('bulk_scan_jobs')
          .select('user_id, created_at')
          .gte('created_at', cutoff).order('created_at', { ascending: false }).limit(500),
      ])
      if (pErr) throw pErr

      // website_id → user_id 對照（seo_audits 沒有 user_id、要透過 websites 轉）
      const siteOwner = new Map((siteRows || []).map(w => [w.id, w.user_id]))

      // 彙整每個用戶的活動：{ lastActive, lastSource, count30 }
      const activity = new Map()
      const track = (userId, createdAt, source) => {
        if (!userId) return
        const ts = new Date(createdAt).getTime()
        const cur = activity.get(userId) || { lastActive: 0, lastSource: '', count30: 0 }
        if (ts > cur.lastActive) { cur.lastActive = ts; cur.lastSource = source }
        if (Date.now() - ts <= 30 * DAY_MS) cur.count30 += 1
        activity.set(userId, cur)
      }
      ;(aivisRows || []).forEach(r => track(r.user_id, r.created_at, 'AI 掃描'))
      ;(bulkRows || []).forEach(r => track(r.user_id, r.created_at, '批次掃描'))
      ;(auditRows || []).forEach(r => track(siteOwner.get(r.website_id), r.created_at, '網站掃描'))
      // 新增網站也算活動（但只算回看窗內的）
      ;(siteRows || []).forEach(w => {
        if (new Date(w.created_at).getTime() >= new Date(cutoff).getTime()) {
          track(w.user_id, w.created_at, '新增網站')
        }
      })

      const merged = (profiles || []).map(p => {
        const act = activity.get(p.id) || { lastActive: 0, lastSource: '', count30: 0 }
        const u = { ...p, lastActive: act.lastActive || null, lastSource: act.lastSource, count30: act.count30 }
        u.segment = classify(u)
        return u
      })
      setUsers(merged)
    } catch (e) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── 分群統計 + 兩張行動名單 ──
  const stats = useMemo(() => {
    const bySegment = Object.fromEntries(SEGMENTS.map(s => [s.key, 0]))
    users.forEach(u => { bySegment[u.segment] += 1 })
    // ⚠️ 流失風險：付費中（Pro 或試用）但 30 天以上沒活動 → 客服該主動關懷的名單
    const risk = users.filter(u => (u.is_pro || u.is_trial) && (u.segment === 'sleeping' || u.segment === 'lost'))
    // 💎 升級潛力：Free 但 7 天內活躍且 30 天活動 ≥ 5 次 → 行銷該對話的名單
    const upsell = users.filter(u => !u.is_pro && !u.is_trial && u.segment === 'hot' && u.count30 >= 5)
    return { bySegment, risk, upsell }
  }, [users])

  // ── 表格資料（依過濾器）──
  const tableRows = useMemo(() => {
    let rows = users
    if (filter === 'risk') rows = stats.risk
    else if (filter === 'upsell') rows = stats.upsell
    else if (filter) rows = users.filter(u => u.segment === filter)
    // 最後活躍倒序、沒活動的沉底（按註冊日倒序）
    return [...rows].sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0) || new Date(b.created_at) - new Date(a.created_at))
  }, [users, filter, stats])

  const total = users.length || 1

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">用戶活躍分析</h1>
            <p className="text-slate-400 text-sm mt-1">
              以「最後一次產品行為」分群（AI 掃描 / 網站掃描 / 新增網站 / 批次掃描）。點 KPI 卡可過濾下方名單。
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">⚠️ {error}</div>
          )}

          {/* 上排：5 張分群 KPI（可點擊過濾） */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {[...Array(5)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl p-5 h-28 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {SEGMENTS.map(s => (
                <button
                  key={s.key}
                  onClick={() => setFilter(filter === s.key ? null : s.key)}
                  className={`bg-slate-800 border rounded-xl p-5 text-left transition-colors ${filter === s.key ? 'border-orange-500' : 'border-slate-700 hover:border-slate-500'}`}
                >
                  <p className={`text-2xl font-bold ${s.color}`}>{stats.bySegment[s.key]}</p>
                  <p className="text-slate-300 text-sm mt-1">{s.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* 分布條 */}
          {!loading && (
            <div className="flex h-3 rounded-full overflow-hidden mb-6 border border-slate-700">
              {SEGMENTS.map(s => {
                const pct = (stats.bySegment[s.key] / total) * 100
                const bg = { hot: '#10b981', warm: '#3b82f6', sleeping: '#f59e0b', lost: '#64748b', new: '#a855f7' }[s.key]
                return pct > 0 ? <div key={s.key} style={{ width: `${pct}%`, background: bg }} title={`${s.label} ${pct.toFixed(0)}%`} /> : null
              })}
            </div>
          )}

          {/* 兩張行動名單卡（可點擊過濾） */}
          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setFilter(filter === 'risk' ? null : 'risk')}
                className={`bg-slate-800 border rounded-xl p-5 text-left transition-colors ${filter === 'risk' ? 'border-orange-500' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">⚠️ 流失風險名單</p>
                    <p className="text-slate-500 text-sm mt-0.5">Pro / 試用中、但超過 30 天沒活動 — 退訂前兆，客服該主動關懷</p>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{stats.risk.length}</p>
                </div>
              </button>
              <button
                onClick={() => setFilter(filter === 'upsell' ? null : 'upsell')}
                className={`bg-slate-800 border rounded-xl p-5 text-left transition-colors ${filter === 'upsell' ? 'border-orange-500' : 'border-slate-700 hover:border-slate-500'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">💎 升級潛力名單</p>
                    <p className="text-slate-500 text-sm mt-0.5">Free、7 天內活躍且 30 天活動 ≥ 5 次 — 最該收到升級訊息的人</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{stats.upsell.length}</p>
                </div>
              </button>
            </div>
          )}

          {/* 用戶名單表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-semibold">
                {filter === 'risk' ? '⚠️ 流失風險名單' : filter === 'upsell' ? '💎 升級潛力名單' : filter ? `${SEGMENT_MAP[filter].label} 用戶` : '全部用戶'}
                <span className="text-slate-500 text-sm ml-2">{tableRows.length} 人</span>
              </h2>
              {filter && (
                <button onClick={() => setFilter(null)} className="text-slate-400 text-sm hover:text-white">✕ 清除過濾</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-left border-b border-slate-700">
                    <th className="px-6 py-3 font-medium">用戶</th>
                    <th className="px-4 py-3 font-medium">方案</th>
                    <th className="px-4 py-3 font-medium">狀態</th>
                    <th className="px-4 py-3 font-medium">最後活躍</th>
                    <th className="px-4 py-3 font-medium">最後行為</th>
                    <th className="px-4 py-3 font-medium">30 天活動</th>
                    <th className="px-4 py-3 font-medium">註冊</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">載入中...</td></tr>
                  ) : tableRows.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">沒有符合的用戶</td></tr>
                  ) : tableRows.map(u => (
                    <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-6 py-3">
                        <p className="text-slate-200">{u.name || '(未填名稱)'}</p>
                        <p className="text-slate-500 text-xs">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">{planChip(u)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs border ${SEGMENT_MAP[u.segment].chip}`}>{SEGMENT_MAP[u.segment].label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{agoLabel(u.lastActive)}</td>
                      <td className="px-4 py-3 text-slate-400">{u.lastSource || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{u.count30 > 0 ? `${u.count30} 次` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString('zh-TW')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
