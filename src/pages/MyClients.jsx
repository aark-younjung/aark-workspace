/**
 * MyClients — 我的客戶（Agency 多客戶工作區、2026-06-10）
 *
 * 功能：
 *   1. 列出此 Agency 代管的所有客戶站（agency_managed_by = 自己 user_id）
 *   2. 每張卡顯示：client_alias / URL / 最新檢測分數 / 動作
 *   3. 「+ 新增客戶站」開 AddClientModal
 *   4. 進客戶站的 Dashboard → /dashboard/{website_id}
 *   5. 取消代管 → 設 agency_managed_by = null（不刪 site）
 *
 * 權限：
 *   - 非 Agency tier 進來自動導回 /pricing 引導升級
 *   - 已是 Pro 但非 Agency 也擋掉（沒這個概念）
 *
 * 注意：
 *   - 代管模式（v0）下、客戶站的 user_id = agency 自己、所以「我的網站」也會看到
 *   - 「我的網站」vs「我的客戶」的差別：agency_managed_by 是否為 null
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import AddClientModal from '../components/v2/AddClientModal'
import { T } from '../styles/v2-tokens'

export default function MyClients() {
  const { user, isAgency, siteLimit, tierName, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)

  // 非 Agency 用戶導去 Pricing 升級
  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login?from=/clients'); return }
    if (!isAgency) { navigate('/pricing'); return }
  }, [authLoading, user, isAgency, navigate])

  // 撈代管的客戶站 + 各自最新分數
  const fetchClients = async () => {
    if (!user) return
    setLoading(true)
    try {
      // 撈 agency_managed_by = 自己 user_id 的站
      const { data: sites } = await supabase
        .from('websites')
        .select('id, url, name, client_alias, created_at')
        .eq('user_id', user.id)
        .eq('agency_managed_by', user.id)
        .order('created_at', { ascending: false })

      if (!sites || sites.length === 0) {
        setClients([])
        setLoading(false)
        return
      }

      // 各 site 最新 4 大 audit 分數（並行抓）
      const siteIds = sites.map(s => s.id)
      const [seoResults, aeoResults, geoResults, eeatResults] = await Promise.all([
        supabase.from('seo_audits').select('website_id, score').in('website_id', siteIds).order('created_at', { ascending: false }),
        supabase.from('aeo_audits').select('website_id, score').in('website_id', siteIds).order('created_at', { ascending: false }),
        supabase.from('geo_audits').select('website_id, score').in('website_id', siteIds).order('created_at', { ascending: false }),
        supabase.from('eeat_audits').select('website_id, score').in('website_id', siteIds).order('created_at', { ascending: false }),
      ])

      // 每個 site 取最新一筆（同 website_id 第一個就是最新）
      const latestBy = (rows) => {
        const map = {}
        for (const r of rows || []) {
          if (!(r.website_id in map)) map[r.website_id] = r.score
        }
        return map
      }
      const seoMap = latestBy(seoResults.data)
      const aeoMap = latestBy(aeoResults.data)
      const geoMap = latestBy(geoResults.data)
      const eeatMap = latestBy(eeatResults.data)

      const enriched = sites.map(s => ({
        ...s,
        seo: seoMap[s.id] ?? null,
        aeo: aeoMap[s.id] ?? null,
        geo: geoMap[s.id] ?? null,
        eeat: eeatMap[s.id] ?? null,
      }))
      setClients(enriched)
    } catch (e) {
      console.error('fetchClients error:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && isAgency) fetchClients()
  }, [user, isAgency])

  // 計算客戶站平均總分（4 個 audit 平均、null 跳過）
  const calcOverall = (c) => {
    const vals = [c.seo, c.aeo, c.geo, c.eeat].filter(v => v !== null)
    if (vals.length === 0) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  // 取消代管（不刪 website、只把 agency_managed_by / client_alias 清 NULL）
  // 之後若用戶 sub_tier 降回 pro、這站還在「我的網站」可以正常使用
  const handleUnlink = async (clientId) => {
    if (!confirm('確認取消代管這個客戶站？網站不會被刪除、會回到「我的網站」一般列表。')) return
    try {
      const { error } = await supabase
        .from('websites')
        .update({ agency_managed_by: null, client_alias: null })
        .eq('id', clientId)
      if (error) throw error
      setClients(prev => prev.filter(c => c.id !== clientId))
    } catch (e) {
      console.error('Unlink failed:', e)
      alert('取消代管失敗、請稍後再試')
    }
  }

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-white/60">載入中…</div>
  }
  if (!user || !isAgency) {
    return null  // 上面 useEffect 會導頁
  }

  // GlobalDarkBg 由 App.jsx 全域套用、不需要自己包 PageBg
  return (
    <div className="min-h-screen text-white">
      <SiteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* 頁標 + 計數 + 新增 */}
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🤝</span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">我的客戶</h1>
              <span
                className="px-2.5 py-1 rounded-full text-sm font-mono"
                style={{ background: T.aeo + '22', color: T.aeo, border: `1px solid ${T.aeo}55` }}
              >
                {clients.length} / {siteLimit}
              </span>
            </div>
            <p className="text-sm text-white/55 leading-relaxed">
              你 <strong className="text-white/85">{tierName}</strong> 方案、可代管 {siteLimit} 個客戶站、產白標 PDF 報告、5 訊號層即時監測。
            </p>
          </div>
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={clients.length >= siteLimit}
            className="px-5 py-2.5 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
            title={clients.length >= siteLimit ? `已達 ${siteLimit} 站上限、需升級方案` : '新增代管客戶站'}
          >
            + 新增客戶站
          </button>
        </div>

        {/* 列表 / Loading / Empty */}
        {loading ? (
          <div className="py-20 text-center text-white/50">載入客戶清單中…</div>
        ) : clients.length === 0 ? (
          // Empty state
          <div className="py-16 text-center">
            <div className="text-6xl mb-4">📂</div>
            <h2 className="text-xl font-bold text-white mb-2">還沒有任何代管客戶站</h2>
            <p className="text-sm text-white/55 mb-6 max-w-md mx-auto leading-relaxed">
              點右上「+ 新增客戶站」加入第一位客戶。
              加完之後你可以追蹤每個客戶的 5 訊號層分數、產出白標 PDF、用一個帳號管所有客戶。
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20"
            >
              + 新增第一位客戶
            </button>
          </div>
        ) : (
          // 客戶列表
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(c => {
              const overall = calcOverall(c)
              const hasScore = overall !== null
              return (
                <div
                  key={c.id}
                  className="group p-5 rounded-2xl border transition-all hover:border-emerald-400/40 hover:bg-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.10)' }}
                >
                  {/* 客戶名 + URL */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-1 truncate" title={c.client_alias}>
                      {c.client_alias || '（未設別名）'}
                    </h3>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-sm text-white/45 hover:text-white/70 truncate block font-mono"
                      title={c.url}
                    >
                      {c.url}
                    </a>
                  </div>

                  {/* 分數列 */}
                  {hasScore ? (
                    <div className="mb-4 grid grid-cols-5 gap-1 text-center">
                      <ScorePill label="總" v={overall} />
                      <ScorePill label="SEO" v={c.seo} color={T.seo} />
                      <ScorePill label="AEO" v={c.aeo} color={T.aeo} />
                      <ScorePill label="GEO" v={c.geo} color={T.geo} />
                      <ScorePill label="EEAT" v={c.eeat} color={T.eeat} />
                    </div>
                  ) : (
                    <div className="mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/50 text-center">
                      尚未檢測、進 Dashboard 觸發
                    </div>
                  )}

                  {/* 動作列 */}
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/dashboard/${c.id}`}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-center bg-emerald-500 hover:bg-emerald-400 text-black transition"
                    >
                      進 Dashboard →
                    </Link>
                    <button
                      onClick={() => handleUnlink(c.id)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-white/55 hover:text-red-300 hover:bg-red-500/10 border border-white/10 hover:border-red-400/30 transition"
                      title="取消代管（不刪除網站、回到一般列表）"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 站數上限到了的引導 */}
        {clients.length >= siteLimit && (
          <div className="mt-8 p-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 text-center">
            <div className="text-2xl mb-2">⚠️</div>
            <h3 className="text-base font-bold text-white mb-1">已達 {siteLimit} 站上限</h3>
            <p className="text-sm text-white/65 mb-3">
              想代管更多客戶？升級到 Agency Plus（100 站）。
            </p>
            <Link
              to="/pricing"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
            >
              查看升級方案 →
            </Link>
          </div>
        )}
      </main>

      <Footer />

      {/* 新增客戶 Modal */}
      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => fetchClients()}
      />
    </div>
  )
}

// 單一分數膠囊（傳 null 顯示 -）
function ScorePill({ label, v, color }) {
  const display = v === null || v === undefined ? '—' : v
  const scoreColor = v === null
    ? 'rgba(255,255,255,0.25)'
    : v >= 70 ? '#22c55e'
    : v >= 40 ? '#f59e0b'
    : '#ef4444'
  return (
    <div
      className="py-1.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color || 'rgba(255,255,255,0.08)'}33` }}
    >
      <div className="text-base font-bold" style={{ color: scoreColor }}>{display}</div>
      <div className="text-sm" style={{ color: color || 'rgba(255,255,255,0.4)' }}>{label}</div>
    </div>
  )
}
