import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── 樣板資料：日本與台灣中小企業（真實掃描結果會自動取代同網址的樣板） ──
const SAMPLE_SITES = [
  // ── 日本中小企業 ──
  {
    id: 'sample-jp-01', isSample: true,
    name: '京都小川珈琲焙煎所', url: 'https://www.kyoto-ogawa-coffee.jp/',
    seo_score: 58, aeo_score: 42, geo_score: 35, total_score: 45, first_total_score: 27, improvement: 18,
    scan_count: 3, last_scanned_at: '2026-04-14T08:21:00Z',
  },
  {
    id: 'sample-jp-02', isSample: true,
    name: '鎌倉野菜工房', url: 'https://www.kamakura-yasai.jp/',
    seo_score: 52, aeo_score: 38, geo_score: 32, total_score: 41, first_total_score: 21, improvement: 20,
    scan_count: 2, last_scanned_at: '2026-04-13T14:05:00Z',
  },
  {
    id: 'sample-jp-03', isSample: true,
    name: '北海道ファームステイ農家', url: 'https://www.hokkaido-farmstay.jp/',
    seo_score: 65, aeo_score: 55, geo_score: 48, total_score: 56, first_total_score: 32, improvement: 24,
    scan_count: 4, last_scanned_at: '2026-04-15T09:10:00Z',
  },
  {
    id: 'sample-jp-04', isSample: true,
    name: '大阪たこ焼き本舗 道頓堀店', url: 'https://www.osaka-takoyaki-honpo.jp/',
    seo_score: 48, aeo_score: 35, geo_score: 28, total_score: 37, first_total_score: 15, improvement: 22,
    scan_count: 2, last_scanned_at: '2026-04-12T11:30:00Z',
  },
  {
    id: 'sample-jp-05', isSample: true,
    name: '東京手作りパン工房 こむぎ', url: 'https://www.tokyo-komugi-pan.jp/',
    seo_score: 62, aeo_score: 50, geo_score: 44, total_score: 52, first_total_score: 29, improvement: 23,
    scan_count: 3, last_scanned_at: '2026-04-11T07:44:00Z',
  },
  {
    id: 'sample-jp-06', isSample: true,
    name: '京都着物レンタル 雅', url: 'https://www.kyoto-kimono-miyabi.jp/',
    seo_score: 55, aeo_score: 45, geo_score: 38, total_score: 46, first_total_score: 25, improvement: 21,
    scan_count: 2, last_scanned_at: '2026-04-10T15:55:00Z',
  },
  {
    id: 'sample-jp-07', isSample: true,
    name: '湘南サーフショップ 波乗り堂', url: 'https://www.shonan-naminori.jp/',
    seo_score: 42, aeo_score: 32, geo_score: 26, total_score: 33, first_total_score: 33, improvement: 0,
    scan_count: 1, last_scanned_at: '2026-04-09T16:30:00Z',
  },
  {
    id: 'sample-jp-08', isSample: true,
    name: '奈良鹿スイーツ工房', url: 'https://www.nara-deer-sweets.jp/',
    seo_score: 50, aeo_score: 38, geo_score: 30, total_score: 39, first_total_score: 20, improvement: 19,
    scan_count: 2, last_scanned_at: '2026-04-08T10:18:00Z',
  },
  // ── 台灣中小企業 ──
  {
    id: 'sample-tw-01', isSample: true,
    name: '台南古早味碗粿 阿嬤的店', url: 'https://www.tainan-wangue.com.tw/',
    seo_score: 44, aeo_score: 32, geo_score: 25, total_score: 34, first_total_score: 13, improvement: 21,
    scan_count: 2, last_scanned_at: '2026-04-15T06:30:00Z',
  },
  {
    id: 'sample-tw-02', isSample: true,
    name: '基隆廟口手工臭豆腐', url: 'https://www.keelung-tofu.com.tw/',
    seo_score: 38, aeo_score: 28, geo_score: 22, total_score: 29, first_total_score: 29, improvement: 0,
    scan_count: 1, last_scanned_at: '2026-04-13T08:45:00Z',
  },
  {
    id: 'sample-tw-03', isSample: true,
    name: '台中日式甜點工作室 和菓子', url: 'https://www.taichung-wagashi.com.tw/',
    seo_score: 60, aeo_score: 48, geo_score: 42, total_score: 50, first_total_score: 26, improvement: 24,
    scan_count: 3, last_scanned_at: '2026-04-12T13:20:00Z',
  },
  {
    id: 'sample-tw-04', isSample: true,
    name: '花蓮慢活海景民宿', url: 'https://www.hualien-seaview-bb.com.tw/',
    seo_score: 52, aeo_score: 40, geo_score: 35, total_score: 42, first_total_score: 21, improvement: 21,
    scan_count: 2, last_scanned_at: '2026-04-11T16:00:00Z',
  },
  {
    id: 'sample-tw-05', isSample: true,
    name: '台北巷弄咖啡廳 晨光', url: 'https://www.taipei-morning-cafe.com.tw/',
    seo_score: 55, aeo_score: 44, geo_score: 38, total_score: 46, first_total_score: 23, improvement: 23,
    scan_count: 3, last_scanned_at: '2026-04-10T09:55:00Z',
  },
  {
    id: 'sample-tw-06', isSample: true,
    name: '宜蘭有機農場直售', url: 'https://www.yilan-organic-farm.com.tw/',
    seo_score: 45, aeo_score: 35, geo_score: 28, total_score: 36, first_total_score: 17, improvement: 19,
    scan_count: 2, last_scanned_at: '2026-04-14T11:10:00Z',
  },
  {
    id: 'sample-tw-07', isSample: true,
    name: '嘉義火雞肉飯専門店', url: 'https://www.chiayi-turkey-rice.com.tw/',
    seo_score: 40, aeo_score: 30, geo_score: 24, total_score: 31, first_total_score: 31, improvement: 0,
    scan_count: 1, last_scanned_at: '2026-04-08T14:30:00Z',
  },
  {
    id: 'sample-tw-08', isSample: true,
    name: '新竹客家擂茶坊', url: 'https://www.hsinchu-hakka-tea.com.tw/',
    seo_score: 48, aeo_score: 36, geo_score: 29, total_score: 38, first_total_score: 18, improvement: 20,
    scan_count: 2, last_scanned_at: '2026-04-07T12:00:00Z',
  },
]

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
  const [leaderTab, setLeaderTab] = useState('total')
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

      // 合併樣板資料：真實掃描結果覆蓋同網址的樣板
      const realUrls = new Set(combined.map(s => s.url.replace(/\/$/, '').toLowerCase()))
      const filteredSamples = SAMPLE_SITES.filter(
        s => !realUrls.has(s.url.replace(/\/$/, '').toLowerCase())
      )
      setSites([...combined, ...filteredSamples])
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
    total: [...sites].sort((a, b) => b.total_score - a.total_score).slice(0, 10),
    ai: [...sites].sort((a, b) => (b.aeo_score + b.geo_score) - (a.aeo_score + a.geo_score)).slice(0, 10),
    progress: [...sites].filter(s => s.scan_count >= 2 && s.improvement > 0).sort((a, b) => b.improvement - a.improvement).slice(0, 10),
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
    <div className="min-h-screen relative" >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-200 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800">優勢方舟數位行銷</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">免費檢測 →</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* 頁面標題 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 border border-orange-200 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-gray-500 text-sm">即時更新</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-3">AI 能見度排行榜</h1>
          <p className="text-gray-500">查看所有網站的 SEO + AEO + GEO 綜合表現</p>

          {!loading && sites.length > 0 && (
            <div className="flex items-center justify-center gap-12 mt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{sites.length}</div>
                <div className="text-gray-400 text-sm mt-1">已檢測網站</div>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-800">{avgScore}</div>
                <div className="text-gray-400 text-sm mt-1">平均綜合分數</div>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${scoreColor(maxScore)}`}>{maxScore}</div>
                <div className="text-gray-400 text-sm mt-1">最高分數</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <svg className="animate-spin h-10 w-10 text-orange-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-gray-500">載入中...</span>
          </div>
        ) : (
          <>
            {/* ===== Section 1: 進步之星 ===== */}
            {progressStars.length > 0 && star && (
              <section className="mb-14">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  🌟 進步之星
                  <span className="text-sm font-normal text-gray-400">分析後分數進步最多的網站</span>
                </h2>
                <div className="relative rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-8">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
                    <div className="flex-1">
                      <div className="text-gray-400 text-sm mb-2">#{starIndex + 1} 進步之星 · 共 {progressStars.length} 個</div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-1 truncate">{star.name}</h3>
                      <a href={star.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400 text-sm break-all transition-colors">
                        {star.url}
                      </a>
                      <div className="flex items-center gap-6 mt-6">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-gray-400">{star.first_total_score}</div>
                          <div className="text-xs text-gray-400 mt-1">首次分數</div>
                        </div>
                        <div className="text-gray-300 text-3xl">→</div>
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${scoreColor(star.total_score)}`}>{star.total_score}</div>
                          <div className="text-xs text-gray-400 mt-1">最新分數</div>
                        </div>
                        <div className="px-5 py-3 bg-green-500/20 rounded-xl border border-green-500/30 ml-2">
                          <div className="text-green-500 font-bold text-2xl">+{star.improvement}</div>
                          <div className="text-green-500/50 text-xs mt-1">進步分數</div>
                        </div>
                      </div>
                      <div className="text-gray-400 text-sm mt-4">已掃描 {star.scan_count} 次</div>
                    </div>

                    {/* 輪播指示點 */}
                    <div className="flex md:flex-col gap-2">
                      {progressStars.map((_, i) => (
                        <button key={i}
                          onClick={() => { setStarIndex(i); clearInterval(timerRef.current) }}
                          className={`rounded-full transition-all ${i === starIndex
                            ? 'bg-yellow-400 w-6 h-2 md:w-2 md:h-6'
                            : 'bg-gray-300 w-2 h-2'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ===== Section 2: 排行榜 ===== */}
            <section className="mb-14">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                🏆 排行榜
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  ['total',    '🏆 AI 友善度 TOP10'],
                  ['ai',       '🤖 AI 引用潛力'],
                  ['progress', '📈 進步最多'],
                  ['recent',   '📅 最近更新'],
                  ['crawled',  '🔍 被爬蟲找到'],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => setLeaderTab(key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${leaderTab === key
                      ? 'bg-orange-500 text-white'
                      : 'bg-orange-100 border border-orange-200 text-gray-500 hover:text-gray-800 hover:bg-orange-200'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 overflow-hidden">
                {leaders[leaderTab].length === 0 ? (
                  <div className="text-center py-12 text-gray-400">尚無資料</div>
                ) : leaders[leaderTab].map((site, i) => (
                  <div key={site.id}
                    className="flex items-center gap-4 px-6 py-4 border-b border-orange-50 last:border-0 hover:bg-white/30 transition-colors">
                    <div className="w-8 text-center flex-shrink-0">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' :
                        <span className="text-gray-400 text-sm font-mono">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-medium truncate">{site.name}</span>
                      </div>
                      <div className="text-gray-400 text-xs truncate">{site.url}</div>
                    </div>

                    {/* AI 友善度：顯示 SEO + AEO + GEO 三欄 */}
                    {leaderTab === 'total' && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                          <div key={label} className="text-center hidden sm:block">
                            <div className={`text-sm font-bold ${scoreColor(score)}`}>{score}</div>
                            <div className="text-xs text-gray-400">{label}</div>
                          </div>
                        ))}
                        <div className={`text-2xl font-bold ml-2 flex-shrink-0 ${scoreColor(site.total_score)}`}>
                          {site.total_score}
                        </div>
                      </div>
                    )}

                    {/* AI 引用潛力：AEO + GEO 合計 */}
                    {leaderTab === 'ai' && (
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-center hidden sm:block">
                          <div className={`text-sm font-bold ${scoreColor(site.aeo_score)}`}>{site.aeo_score}</div>
                          <div className="text-xs text-gray-400">AEO</div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <div className={`text-sm font-bold ${scoreColor(site.geo_score)}`}>{site.geo_score}</div>
                          <div className="text-xs text-gray-400">GEO</div>
                        </div>
                        <div className={`text-2xl font-bold ml-2 flex-shrink-0 ${scoreColor(Math.round((site.aeo_score + site.geo_score) / 2))}`}>
                          {Math.round((site.aeo_score + site.geo_score) / 2)}
                        </div>
                      </div>
                    )}

                    {/* 進步最多：首次 → 現在 + 進步分數 */}
                    {leaderTab === 'progress' && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-gray-400 text-sm hidden sm:block">{site.first_total_score} →</span>
                        <span className={`text-sm font-bold hidden sm:block ${scoreColor(site.total_score)}`}>{site.total_score}</span>
                        <span className="px-2 py-1 bg-green-100 text-green-600 rounded-lg font-bold text-sm">+{site.improvement}</span>
                      </div>
                    )}

                    {leaderTab === 'recent' && (
                      <div className="text-gray-500 text-sm flex-shrink-0">{timeAgo(site.last_scanned_at)}</div>
                    )}

                    {leaderTab === 'crawled' && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-orange-500 font-bold">{site.scan_count}</span>
                        <span className="text-gray-400 text-xs">次掃描</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ===== Section 3: 成功案例 ===== */}
            {successStories.length > 0 && (
              <section className="mb-14">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                  📖 成功案例
                  <span className="text-sm font-normal text-gray-400">分數進步 20 分以上</span>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-4"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(249,115,22,0.3) transparent' }}>
                  {successStories.map(site => (
                    <div key={site.id}
                      className="flex-shrink-0 w-72 p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 hover:border-orange-200 transition-colors">
                      <div className="text-gray-800 font-semibold mb-1 truncate">{site.name}</div>
                      <div className="text-gray-400 text-xs mb-5 truncate">{site.url}</div>
                      <div className="flex items-center gap-3 mb-5">
                        <div className="text-center">
                          <div className="text-xl font-bold text-gray-400">{site.first_total_score}</div>
                          <div className="text-xs text-gray-400 mt-1">首次</div>
                        </div>
                        <div className="text-gray-300 text-lg">→</div>
                        <div className="text-center">
                          <div className={`text-xl font-bold ${scoreColor(site.total_score)}`}>{site.total_score}</div>
                          <div className="text-xs text-gray-400 mt-1">現在</div>
                        </div>
                        <div className="ml-auto px-3 py-1.5 bg-green-500/20 rounded-lg border border-green-500/30 flex-shrink-0">
                          <span className="text-green-500 font-bold text-lg">+{site.improvement}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                          <span key={label}
                            className={`text-xs px-2 py-1 rounded-full font-medium ${score >= 70
                              ? 'bg-green-500/20 text-green-500'
                              : score >= 40
                              ? 'bg-yellow-500/20 text-yellow-600'
                              : 'bg-red-500/20 text-red-500'}`}>
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
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  📋 全部網站
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm hidden sm:block">排序：</span>
                  <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0) }}
                    className="bg-white/60 border border-orange-100 text-gray-800 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="total_score">總分</option>
                    <option value="last_scanned_at">最近更新</option>
                    <option value="scan_count">掃描次數</option>
                  </select>
                </div>
              </div>

              <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 overflow-hidden">
                {/* 表頭 */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-orange-100 text-gray-400 text-xs font-medium uppercase tracking-wide">
                  <div className="col-span-1">#</div>
                  <div className="col-span-4">網站</div>
                  <div className="col-span-2 text-center">SEO</div>
                  <div className="col-span-2 text-center">AEO</div>
                  <div className="col-span-2 text-center">GEO</div>
                  <div className="col-span-1 text-center">總分</div>
                </div>

                {paged.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">尚無資料</div>
                ) : paged.map((site, i) => (
                  <div key={site.id}
                    className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-orange-50 last:border-0 hover:bg-white/30 transition-colors items-center">
                    <div className="col-span-1 text-gray-400 text-sm font-mono">{page * PAGE_SIZE + i + 1}</div>
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-800 font-medium text-sm truncate">{site.name}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                          🤖 AI 已讀取 {timeAgo(site.last_scanned_at)}
                        </span>
                      </div>
                    </div>
                    {[site.seo_score, site.aeo_score, site.geo_score].map((score, si) => (
                      <div key={si} className="col-span-2 flex flex-col items-center gap-1.5">
                        <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}</span>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
                  <span className="text-gray-400 text-sm">
                    目前展示 {Math.min((page + 1) * PAGE_SIZE, sites.length)} 筆 · 共 {sites.length} 筆
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                      className="px-3 py-1.5 bg-orange-100 border border-orange-200 text-gray-500 rounded-lg disabled:opacity-30 hover:bg-orange-200 transition-colors text-sm">
                      ← 上一頁
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm transition-colors ${p === page
                            ? 'bg-orange-500 text-white'
                            : 'bg-orange-100 border border-orange-200 text-gray-500 hover:bg-orange-200'}`}>
                          {p + 1}
                        </button>
                      )
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 bg-orange-100 border border-orange-200 text-gray-500 rounded-lg disabled:opacity-30 hover:bg-orange-200 transition-colors text-sm">
                      下一頁 →
                    </button>
                  </div>
                </div>
              )}

              {totalPages <= 1 && sites.length > 0 && (
                <div className="mt-4 text-gray-400 text-sm text-center">
                  共 {sites.length} 筆
                </div>
              )}
            </section>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
