import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

export default function AdminWebsites() {
  const [websites, setWebsites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [deletingId, setDeletingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [togglingTest, setTogglingTest] = useState({})  // key=siteId, 防 double-click
  const [filterTest, setFilterTest] = useState('all')  // all / not_test / test_only

  useEffect(() => {
    fetchWebsites()
  }, [])

  const fetchWebsites = async () => {
    setLoading(true)
    try {
      // Step 1：取網站 + 分析分數 + is_test_site / is_public_optout 旗標
      const { data: sitesData, error: sitesError } = await supabase
        .from('websites')
        .select(`
          id, url, name, created_at, user_id, is_test_site, is_public_optout,
          seo_audits(score, created_at),
          aeo_audits(score, created_at),
          geo_audits(score, created_at),
          eeat_audits(score, created_at)
        `)
        .order('created_at', { ascending: false })

      if (sitesError) throw sitesError

      // Step 2：取有 user_id 的 profiles
      const userIds = [...new Set((sitesData || []).map(s => s.user_id).filter(Boolean))]
      let profilesMap = {}
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email, is_pro')
          .in('id', userIds)
        ;(profilesData || []).forEach(p => { profilesMap[p.id] = p })
      }

      // 合併 profiles 進 websites
      const merged = (sitesData || []).map(site => ({
        ...site,
        profiles: profilesMap[site.user_id] || null,
      }))

      // 依 URL 去重複，保留最新一筆
      const seen = new Set()
      const deduped = merged.filter(site => {
        if (seen.has(site.url)) return false
        seen.add(site.url)
        return true
      })
      setWebsites(deduped)
    } catch (e) {
      console.error('AdminWebsites error:', e)
    } finally {
      setLoading(false)
    }
  }

  const getLatestScore = (audits) => {
    if (!audits || audits.length === 0) return null
    return audits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.score ?? null
  }

  const getOverall = (site) => {
    const scores = [
      getLatestScore(site.seo_audits),
      getLatestScore(site.aeo_audits),
      getLatestScore(site.geo_audits),
      getLatestScore(site.eeat_audits),
    ].filter(s => s !== null)
    if (scores.length === 0) return null
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  const handleDelete = async (siteId) => {
    setDeletingId(siteId)
    try {
      const { error } = await supabase.from('websites').delete().eq('id', siteId)
      if (error) throw error
      setWebsites(prev => prev.filter(w => w.id !== siteId))
    } catch (e) {
      console.error('Delete failed:', e)
      alert('刪除失敗：' + e.message)
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  // 切換網站 is_test_site 旗標（測試紀錄不入 TOP 8 公開排行榜）
  const handleToggleTestSite = async (siteId, currentValue) => {
    if (togglingTest[siteId]) return
    setTogglingTest(prev => ({ ...prev, [siteId]: true }))
    try {
      const { error } = await supabase
        .from('websites')
        .update({ is_test_site: !currentValue })
        .eq('id', siteId)
      if (error) throw error
      setWebsites(prev => prev.map(w => w.id === siteId ? { ...w, is_test_site: !currentValue } : w))
    } catch (e) {
      alert('切換測試標記失敗：' + e.message)
    } finally {
      setTogglingTest(prev => ({ ...prev, [siteId]: false }))
    }
  }

  const ScoreBadge = ({ score, color }) => {
    if (score === null) return <span className="text-slate-600">—</span>
    return <span className={`font-semibold ${color}`}>{score}</span>
  }

  const filtered = websites
    .filter(w => {
      // is_test_site 篩選
      if (filterTest === 'not_test' && w.is_test_site) return false
      if (filterTest === 'test_only' && !w.is_test_site) return false
      // 搜尋
      const q = search.toLowerCase()
      if (!q) return true
      return (
        w.url?.toLowerCase().includes(q) ||
        w.name?.toLowerCase().includes(q) ||
        w.profiles?.email?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      if (sortBy === 'score') return (getOverall(b) ?? 0) - (getOverall(a) ?? 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">掃描紀錄</h1>
            <p className="text-slate-400 text-sm mt-1">共 {websites.length} 個網站</p>
          </div>

          {/* 搜尋 + 排序 */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <input
              type="text"
              placeholder="搜尋網址、名稱或用戶 Email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="created_at" style={{ color: '#0f172a', background: '#fff' }}>最新分析</option>
              <option value="score" style={{ color: '#0f172a', background: '#fff' }}>綜合分數高到低</option>
            </select>
            {/* 測試紀錄篩選 — 預設全部，可切「正式網站」/「僅測試」單獨檢視 */}
            <select
              value={filterTest}
              onChange={e => setFilterTest(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="all" style={{ color: '#0f172a', background: '#fff' }}>全部網站</option>
              <option value="not_test" style={{ color: '#0f172a', background: '#fff' }}>僅正式網站（前台可見）</option>
              <option value="test_only" style={{ color: '#0f172a', background: '#fff' }}>🧪 僅測試網站（前台隱藏）</option>
            </select>
          </div>

          {/* 列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-sm text-slate-500 font-semibold uppercase tracking-wider">
              <div className="col-span-3">網站</div>
              {/* 分析欄：點擊按鈕另開新分頁查看完整儀表板 */}
              <div className="col-span-1 text-center">分析</div>
              <div className="col-span-2">所屬用戶</div>
              <div className="col-span-3 grid grid-cols-4 text-center">
                <span className="text-blue-500">SEO</span>
                <span className="text-purple-500">AEO</span>
                <span className="text-emerald-500">GEO</span>
                <span className="text-amber-500">E-E-A-T</span>
              </div>
              <div className="col-span-2 text-right">分析時間</div>
              <div className="col-span-1 text-right">操作</div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-700">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="px-6 py-4 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-6 py-10 text-slate-500 text-sm text-center">沒有符合條件的紀錄</p>
            ) : (
              <div className="divide-y divide-slate-700">
                {filtered.map(site => (
                  <div key={site.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-700/30 transition-colors">
                    <div className="col-span-3">
                      {/* 網站名稱 + 測試標記 chip（可點切換） */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-slate-200 text-sm font-medium truncate">
                          {site.name || site.url}
                        </p>
                        <button
                          onClick={() => handleToggleTestSite(site.id, !!site.is_test_site)}
                          disabled={togglingTest[site.id]}
                          className={`px-1.5 py-0.5 rounded text-sm font-semibold transition-colors disabled:opacity-40 ${
                            site.is_test_site
                              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-slate-700/50 text-slate-500 hover:bg-yellow-500/15 hover:text-yellow-400'
                          }`}
                          title={site.is_test_site
                            ? '此網站已標為測試 — 點擊取消測試標記（讓它重新出現在前台 TOP 8）'
                            : '點擊標為測試網站（從前台 TOP 8 排行榜排除）'}
                        >
                          {togglingTest[site.id] ? '...' : site.is_test_site ? '🧪 測試' : '⭕ 標為測試'}
                        </button>
                        {site.is_public_optout && (
                          <span className="px-1.5 py-0.5 rounded text-sm font-semibold bg-purple-500/20 text-purple-300" title="用戶 opt-out 不在 TOP 8 公開">
                            🔒 不公開
                          </span>
                        )}
                      </div>
                      {/* 網址直接連到客戶實際網站（外部開新分頁） */}
                      <a href={site.url} target="_blank" rel="noopener noreferrer"
                        className="text-slate-500 text-sm hover:text-slate-300 transition-colors truncate block">
                        {site.url}
                      </a>
                    </div>
                    {/* 分析欄：獨立按鈕另開新分頁進入完整儀表板，避免與網址連結衝突 */}
                    <div className="col-span-1 flex items-center justify-center">
                      <Link
                        to={`/dashboard/${site.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 text-sm rounded-md font-medium transition-colors whitespace-nowrap"
                        title="於新分頁查看完整分析儀表板"
                      >
                        📊 查看
                      </Link>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-300 text-sm truncate">{site.profiles?.name || '—'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {site.profiles?.is_pro && (
                          <span className="text-sm px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">Pro</span>
                        )}
                        <p className="text-slate-500 text-sm truncate">{site.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="col-span-3 grid grid-cols-4 text-center text-sm">
                      <ScoreBadge score={getLatestScore(site.seo_audits)} color="text-blue-400" />
                      <ScoreBadge score={getLatestScore(site.aeo_audits)} color="text-purple-400" />
                      <ScoreBadge score={getLatestScore(site.geo_audits)} color="text-emerald-400" />
                      <ScoreBadge score={getLatestScore(site.eeat_audits)} color="text-amber-400" />
                    </div>
                    <div className="col-span-2 text-right text-slate-500 text-sm">
                      {new Date(site.created_at).toLocaleDateString('zh-TW')}
                    </div>
                    {/* 刪除操作 */}
                    <div className="col-span-1 flex justify-end">
                      {confirmId === site.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(site.id)}
                            disabled={deletingId === site.id}
                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded font-medium disabled:opacity-50"
                          >
                            {deletingId === site.id ? '刪除中...' : '確認'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(site.id)}
                          className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                          title="刪除此網站及所有分析紀錄"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
