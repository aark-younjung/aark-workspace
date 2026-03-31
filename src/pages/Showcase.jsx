import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// 將各資料表的審計紀錄（依 created_at ASC）轉成 map：website_id → { first_score, latest_score, count, latest_at }
const buildStats = (audits) => {
  const map = {}
  if (!audits) return map
  audits.forEach(a => {
    if (!map[a.website_id]) {
      map[a.website_id] = { first_score: a.score || 0, latest_score: a.score || 0, count: 1, latest_at: a.created_at }
    } else {
      map[a.website_id].latest_score = a.score || 0
      map[a.website_id].count++
      map[a.website_id].latest_at = a.created_at
    }
  })
  return map
}

const scoreColor = (s) => s >= 70 ? 'text-green-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400'
const scoreBgColor = (s) => s >= 70 ? 'bg-green-400' : s >= 40 ? 'bg-yellow-400' : 'bg-red-400'

const timeAgo = (d) => {
  if (!d) return '—'
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

export default function Showcase() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [leaderTab, setLeaderTab] = useState('ai')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('total_score')
  const [starIndex, setStarIndex] = useState(0)
  const timerRef = useRef(null)
  const PAGE_SIZE = 20

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [wRes, sRes, aRes, gRes] = await Promise.all([
        supabase.from('websites').select('id, name, url, created_at').order('created_at', { ascending: true }),
        supabase.from('seo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
        supabase.from('aeo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
        supabase.from('geo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
      ])
      const seoMap = buildStats(sRes.data)
      const aeoMap = buildStats(aRes.data)
      const geoMap = buildStats(gRes.data)

      const combined = (wRes.data || []).map(w => {
        const seo = seoMap[w.id] || {}
        const aeo = aeoMap[w.id] || {}
        const geo = geoMap[w.id] || {}
        const scanCount = Math.max(seo.count || 0, aeo.count || 0, geo.count || 0)
        if (scanCount === 0) return null
        const firstScore = Math.round(((seo.first_score || 0) + (aeo.first_score || 0) + (geo.first_score || 0)) / 3)
        const latestScore = Math.round(((seo.latest_score || 0) + (aeo.latest_score || 0) + (geo.latest_score || 0)) / 3)
        return {
          ...w,
          seo_score: seo.latest_score || 0,
          aeo_score: aeo.latest_score || 0,
          geo_score: geo.latest_score || 0,
          total_score: latestScore,
          first_total_score: firstScore,
          improvement: latestScore - firstScore,
          scan_count: scanCount,
          last_scanned_at: seo.latest_at || aeo.latest_at || geo.latest_at || w.created_at,
        }
      }).filter(Boolean)

      setSites(combined)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 進步之星：至少掃 2 次且分數有進步，依進步幅度排序
  const progressStars = [...sites]
    .filter(s => s.scan_count >= 2 && s.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 5)

  // 成功案例：進步 ≥ 20 分
  const successStories = [...sites]
    .filter(s => s.improvement >= 20)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 6)

  // 排行榜資料
  const leaders = {
    ai: [...sites].sort((a, b) => b.geo_score - a.geo_score).slice(0, 10),
    recent: [...sites].sort((a, b) => new Date(b.last_scanned_at) - new Date(a.last_scanned_at)).slice(0, 10),
    crawled: [...sites].sort((a, b) => b.scan_count - a.scan_count).slice(0, 10),
  }

  // 目錄排序
  const sorted = [...sites].sort((a, b) => {
    if (sortBy === 'last_scanned_at') return new Date(b.last_scanned_at) - new Date(a.last_scanned_at)
    if (sortBy === 'scan_count') return b.scan_count - a.scan_count
    return b.total_score - a.total_score
  })
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sites.length / PAGE_SIZE)

  // 進步之星自動輪播
  useEffect(() => {
    clearInterval(timerRef.current)
    if (progressStars.length > 1) {
      timerRef.current = setInterval(() => setStarIndex(i => (i + 1) % progressStars.length), 8000)
    }
    return () => clearInterval(timerRef.current)
  }, [progressStars.length])

  const star = progressStars[starIndex] || null
  const avgScore = sites.length ? Math.round(sites.reduce((s, x) => s + x.total_score, 0) / sites.length) : 0
  const maxScore = sites.length ? Math.max(...sites.map(s => s.total_score)) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">優勢方舟</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-white/70 hover:text-white transition-colors text-sm">免費檢測 →</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* 頁面標題 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-white/80 text-sm">即時更新</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">AI 能見度排行榜</h1>
          <p className="text-white/60">查看所有網站的 SEO + AEO + GEO 綜合表現</p>

          {!loading && sites.length > 0 && (
            <div className="flex items-center justify-center gap-12 mt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{sites.length}</div>
                <div className="text-white/40 text-sm mt-1">已檢測網站</div>
              </div>
              <div className="w-px h-10 bg-white/10"></div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{avgScore}</div>
                <div className="text-white/40 text-sm mt-1">平均綜合分數</div>
              </div>
              <div className="w-px h-10 bg-white/10"></div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${scoreColor(maxScore)}`}>{maxScore}</div>
                <div className="text-white/40 text-sm mt-1">最高分數</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <svg className="animate-spin h-10 w-10 text-purple-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-white/50">載入中...</span>
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-32">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-white/50 text-lg">尚無檢測紀錄</div>
            <Link to="/" className="mt-6 inline-block px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
              立即檢測您的網站
            </Link>
          </div>
        ) : (
          <>
            {/* ===== Section 1: 進步之星 ===== */}
            {progressStars.length > 0 && star && (
              <section className="mb-14">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  🌟 進步之星
                  <span className="text-sm font-normal text-white/40">分析後分數進步最多的網站</span>
                </h2>
                <div className="relative rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                    <div className="flex-1">
                      <div className="text-white/30 text-sm mb-2">#{starIndex + 1} 進步之星 · 共 {progressStars.length} 個</div>
                      <h3 className="text-2xl font-bold text-white mb-1 truncate">{star.name}</h3>
                      <a href={star.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-sm break-all transition-colors">
                        {star.url}
                      </a>
                      <div className="flex items-center gap-6 mt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-white/40">{star.first_total_score}</div>
                          <div className="text-xs text-white/30 mt-1">首次分數</div>
                        </div>
                        <div className="text-white/20 text-3xl">→</div>
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${scoreColor(star.total_score)}`}>{star.total_score}</div>
                          <div className="text-xs text-white/30 mt-1">最新分數</div>
                        </div>
                        <div className="px-5 py-3 bg-green-500/20 rounded-xl border border-green-500/30 ml-2">
                          <div className="text-green-400 font-bold text-2xl">+{star.improvement}</div>
                          <div className="text-green-400/50 text-xs mt-1">進步分數</div>
                        </div>
                      </div>
                      <div className="text-white/30 text-sm mt-4">已掃描 {star.scan_count} 次</div>
                    </div>

                    {/* 輪播指示點 */}
                    <div className="flex md:flex-col gap-2">
                      {progressStars.map((_, i) => (
                        <button key={i}
                          onClick={() => { setStarIndex(i); clearInterval(timerRef.current) }}
                          className={`rounded-full transition-all ${i === starIndex
                            ? 'bg-yellow-400 w-6 h-2 md:w-2 md:h-6'
                            : 'bg-white/20 w-2 h-2'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ===== Section 2: 排行榜 ===== */}
            <section className="mb-14">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                🏆 排行榜
              </h2>
              <div className="flex gap-2 mb-4">
                {[['ai', '🤖 今日 AI 關注'], ['recent', '📅 最近更新'], ['crawled', '🔍 被爬蟲找到']].map(([key, label]) => (
                  <button key={key} onClick={() => setLeaderTab(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${leaderTab === key
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/15'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                {leaders[leaderTab].length === 0 ? (
                  <div className="text-center py-12 text-white/40">尚無資料</div>
                ) : leaders[leaderTab].map((site, i) => (
                  <div key={site.id}
                    className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <div className="w-8 text-center flex-shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' :
                        <span className="text-white/30 text-sm font-mono">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{site.name}</div>
                      <div className="text-white/30 text-xs truncate">{site.url}</div>
                    </div>
                    {leaderTab === 'ai' && (
                      <>
                        <div className="hidden sm:flex items-center gap-2 text-xs text-white/40">
                          GEO 分數
                        </div>
                        <div className={`text-2xl font-bold ml-4 flex-shrink-0 ${scoreColor(site.geo_score)}`}>
                          {site.geo_score}
                        </div>
                      </>
                    )}
                    {leaderTab === 'recent' && (
                      <div className="text-white/50 text-sm flex-shrink-0">{timeAgo(site.last_scanned_at)}</div>
                    )}
                    {leaderTab === 'crawled' && (
                      <div className="text-purple-400 font-bold flex-shrink-0">{site.scan_count} 次</div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ===== Section 3: 成功案例 ===== */}
            {successStories.length > 0 && (
              <section className="mb-14">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  📖 成功案例
                  <span className="text-sm font-normal text-white/40">分數進步 20 分以上</span>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                  {successStories.map(site => (
                    <div key={site.id}
                      className="flex-shrink-0 w-72 p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-colors">
                      <div className="text-white font-semibold mb-1 truncate">{site.name}</div>
                      <div className="text-white/30 text-xs mb-5 truncate">{site.url}</div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="text-center">
                          <div className="text-xl font-bold text-white/40">{site.first_total_score}</div>
                          <div className="text-xs text-white/30 mt-1">首次</div>
                        </div>
                        <div className="text-white/20 text-lg">→</div>
                        <div className="text-center">
                          <div className={`text-xl font-bold ${scoreColor(site.total_score)}`}>{site.total_score}</div>
                          <div className="text-xs text-white/30 mt-1">現在</div>
                        </div>
                        <div className="ml-auto px-3 py-1.5 bg-green-500/20 rounded-lg border border-green-500/30 flex-shrink-0">
                          <span className="text-green-400 font-bold text-lg">+{site.improvement}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                          <span key={label}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${score >= 70
                              ? 'bg-green-500/20 text-green-400'
                              : score >= 40
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'}`}>
                            {label} {score}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===== Section 4: 全部目錄 ===== */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  📋 全部網站
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-sm hidden sm:block">排序：</span>
                  <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0) }}
                    className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    style={{ backgroundColor: '#1e1b4b' }}>
                    <option value="total_score">總分</option>
                    <option value="last_scanned_at">最近更新</option>
                    <option value="scan_count">掃描次數</option>
                  </select>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                {/* 表頭 */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-white/10 text-white/30 text-xs font-medium uppercase tracking-wide">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">網站</div>
                  <div className="col-span-2 text-center">SEO</div>
                  <div className="col-span-2 text-center">AEO</div>
                  <div className="col-span-2 text-center">GEO</div>
                  <div className="col-span-1 text-center">總分</div>
                </div>

                {paged.length === 0 ? (
                  <div className="text-center py-12 text-white/40">尚無資料</div>
                ) : paged.map((site, i) => (
                  <div key={site.id}
                    className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors items-center">
                    <div className="col-span-1 text-white/30 text-sm font-mono">{page * PAGE_SIZE + i + 1}</div>
                    <div className="col-span-4 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{site.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-purple-500/15 text-purple-300/80 rounded-full">
                          🤖 AI 已讀取 {timeAgo(site.last_scanned_at)}
                        </span>
                      </div>
                    </div>
                    {[site.seo_score, site.aeo_score, site.geo_score].map((score, si) => (
                      <div key={si} className="col-span-2 flex flex-col items-center gap-1.5">
                        <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-1.5 rounded-full ${scoreBgColor(score)}`} style={{ width: `${score}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className={`col-span-1 text-center text-lg font-bold ${scoreColor(site.total_score)}`}>
                      {site.total_score}
                    </div>
                  </div>
                ))}
              </div>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-5">
                  <span className="text-white/40 text-sm">
                    目前展示 {Math.min((page + 1) * PAGE_SIZE, sites.length)} 筆 · 共 {sites.length} 筆
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-3 py-1.5 bg-white/10 text-white/60 rounded-lg disabled:opacity-30 hover:bg-white/20 transition-colors text-sm">
                      ← 上一頁
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm transition-colors ${p === page
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>
                          {p + 1}
                        </button>
                      )
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 bg-white/10 text-white/60 rounded-lg disabled:opacity-30 hover:bg-white/20 transition-colors text-sm">
                      下一頁 →
                    </button>
                  </div>
                </div>
              )}

              {totalPages <= 1 && sites.length > 0 && (
                <div className="mt-4 text-white/30 text-sm text-center">
                  共 {sites.length} 筆
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
