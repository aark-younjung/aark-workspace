import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

export default function AdminWebsites() {
  const [websites, setWebsites] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')

  useEffect(() => {
    fetchWebsites()
  }, [])

  const fetchWebsites = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('websites')
        .select(`
          id, url, name, created_at, user_id,
          profiles(name, email, is_pro),
          seo_audits(score, created_at),
          aeo_audits(score, created_at),
          geo_audits(score, created_at),
          eeat_audits(score, created_at)
        `)
        .order('created_at', { ascending: false })

      setWebsites(data || [])
    } catch (e) {
      console.error(e)
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

  const ScoreBadge = ({ score, color }) => {
    if (score === null) return <span className="text-slate-600">—</span>
    return <span className={`font-semibold ${color}`}>{score}</span>
  }

  const filtered = websites
    .filter(w =>
      w.url?.toLowerCase().includes(search.toLowerCase()) ||
      w.name?.toLowerCase().includes(search.toLowerCase()) ||
      w.profiles?.email?.toLowerCase().includes(search.toLowerCase())
    )
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
              <option value="created_at">最新分析</option>
              <option value="score">綜合分數高到低</option>
            </select>
          </div>

          {/* 列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <div className="col-span-4">網站</div>
              <div className="col-span-2">所屬用戶</div>
              <div className="col-span-4 grid grid-cols-4 text-center">
                <span className="text-blue-500">SEO</span>
                <span className="text-purple-500">AEO</span>
                <span className="text-emerald-500">GEO</span>
                <span className="text-amber-500">E-E-A-T</span>
              </div>
              <div className="col-span-2 text-right">分析時間</div>
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
                  <div key={site.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-750 transition-colors">
                    <div className="col-span-4">
                      <p className="text-slate-200 text-sm font-medium truncate">{site.name || site.url}</p>
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 text-xs hover:text-slate-300 transition-colors truncate block"
                        onClick={e => e.stopPropagation()}
                      >
                        {site.url}
                      </a>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-300 text-sm truncate">{site.profiles?.name || '—'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {site.profiles?.is_pro && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">Pro</span>
                        )}
                        <p className="text-slate-500 text-xs truncate">{site.profiles?.email}</p>
                      </div>
                    </div>
                    <div className="col-span-4 grid grid-cols-4 text-center text-sm">
                      <ScoreBadge score={getLatestScore(site.seo_audits)} color="text-blue-400" />
                      <ScoreBadge score={getLatestScore(site.aeo_audits)} color="text-purple-400" />
                      <ScoreBadge score={getLatestScore(site.geo_audits)} color="text-emerald-400" />
                      <ScoreBadge score={getLatestScore(site.eeat_audits)} color="text-amber-400" />
                    </div>
                    <div className="col-span-2 text-right text-slate-500 text-xs">
                      {new Date(site.created_at).toLocaleDateString('zh-TW')}
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
