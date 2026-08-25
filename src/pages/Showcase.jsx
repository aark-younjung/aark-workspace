import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SiteHeader from '../components/lightsite/SiteHeader'
import SiteFooter from '../components/lightsite/SiteFooter'
import '../styles/lightsite.css'
import '../styles/showcase-light.css'

/**
 * 排行榜（亮色版）— 2026-08-26 全面重做（同 FAQ/Pricing 手法：不再是暗色殼、
 * 資料抓取/排序/輪播邏輯逐字保留，只換視覺層）。
 */

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

const scoreColor = (s) => s >= 70 ? 'var(--geo)' : s >= 40 ? '#b45309' : '#dc2626'

const timeAgo = (d) => {
  if (!d) return '—'
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

const LEADER_TABS = [
  ['total', '🏆 AI 友善度 TOP10'],
  ['ai', '🤖 AI 引用潛力'],
  ['progress', '📈 進步最多'],
  ['recent', '📅 最近更新'],
  ['crawled', '🔍 被爬蟲找到'],
]

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
        // 只撈 admin 已核准的 websites（is_approved=true），未審核 / 已拒絕的不上排行榜，
        // 避免有人刷奇怪測試 URL / 競品 / 不雅內容傷品牌；SAMPLE_SITES 是前端硬寫不受此影響。
        supabase.from('websites').select('id, name, url, created_at').eq('is_approved', true).order('created_at', { ascending: true }),
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
    <div className="ls-page showcase-light">
      <SiteHeader />
      <main className="ls-wrap sc-main">
        {/* 頁面標題 */}
        <div className="sc-hero">
          <span className="sc-badge"><span className="dot" aria-hidden="true" />即時更新</span>
          <h1>AI 能見度排行榜</h1>
          <p>查看所有網站的 SEO + AEO + GEO 綜合表現</p>

          {!loading && sites.length > 0 && (
            <div className="sc-summary">
              <div><div className="n">{sites.length}</div><div className="l">已檢測網站</div></div>
              <div className="sep" aria-hidden="true" />
              <div><div className="n">{avgScore}</div><div className="l">平均綜合分數</div></div>
              <div className="sep" aria-hidden="true" />
              <div><div className="n" style={{ color: scoreColor(maxScore) }}>{maxScore}</div><div className="l">最高分數</div></div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="sc-loading">
            <svg className="spin" width="40" height="40" viewBox="0 0 24 24">
              <circle opacity=".25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path opacity=".75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>載入中...</span>
          </div>
        ) : (
          <>
            {/* ===== Section 1: 進步之星 ===== */}
            {progressStars.length > 0 && star && (
              <section className="sc-section">
                <h2>🌟 進步之星 <span className="sub">分析後分數進步最多的網站</span></h2>
                <div className="sc-star">
                  <div className="body">
                    <div className="rank">#{starIndex + 1} 進步之星 · 共 {progressStars.length} 個</div>
                    <h3>{star.name}</h3>
                    <a href={star.url} target="_blank" rel="noopener noreferrer">{star.url}</a>
                    <div className="scores">
                      <div className="sc"><div className="n is-muted">{star.first_total_score}</div><div className="l">首次分數</div></div>
                      <div className="arrow" aria-hidden="true">→</div>
                      <div className="sc"><div className="n" style={{ color: scoreColor(star.total_score) }}>{star.total_score}</div><div className="l">最新分數</div></div>
                      <div className="delta"><div className="n">+{star.improvement}</div><div className="l">進步分數</div></div>
                    </div>
                    <div className="scanned">已掃描 {star.scan_count} 次</div>
                  </div>
                  <div className="dots">
                    {progressStars.map((_, i) => (
                      <button key={i} aria-label={`第 ${i + 1} 個進步之星`}
                        onClick={() => { setStarIndex(i); clearInterval(timerRef.current) }}
                        className={i === starIndex ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ===== Section 2: 排行榜 ===== */}
            <section className="sc-section">
              <h2>🏆 排行榜</h2>
              <div className="sc-tabs">
                {LEADER_TABS.map(([key, label]) => (
                  <button key={key} onClick={() => setLeaderTab(key)} className={leaderTab === key ? 'on' : ''}>{label}</button>
                ))}
              </div>

              <div className="sc-board">
                {leaders[leaderTab].length === 0 ? (
                  <div className="empty">尚無資料</div>
                ) : leaders[leaderTab].map((site, i) => (
                  <div className="row" key={site.id}>
                    <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="n">{i + 1}</span>}</div>
                    <div className="nm"><div className="t">{site.name}</div><div className="u">{site.url}</div></div>

                    {leaderTab === 'total' && (
                      <div className="scores">
                        {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                          <div className="s" key={label}><div className="n" style={{ color: scoreColor(score) }}>{score}</div><div className="l">{label}</div></div>
                        ))}
                        <div className="total" style={{ color: scoreColor(site.total_score) }}>{site.total_score}</div>
                      </div>
                    )}
                    {leaderTab === 'ai' && (
                      <div className="scores">
                        <div className="s"><div className="n" style={{ color: scoreColor(site.aeo_score) }}>{site.aeo_score}</div><div className="l">AEO</div></div>
                        <div className="s"><div className="n" style={{ color: scoreColor(site.geo_score) }}>{site.geo_score}</div><div className="l">GEO</div></div>
                        <div className="total" style={{ color: scoreColor(Math.round((site.aeo_score + site.geo_score) / 2)) }}>{Math.round((site.aeo_score + site.geo_score) / 2)}</div>
                      </div>
                    )}
                    {leaderTab === 'progress' && (
                      <div className="progress-cell">
                        <span className="from">{site.first_total_score} →</span>
                        <span className="to" style={{ color: scoreColor(site.total_score) }}>{site.total_score}</span>
                        <span className="delta">+{site.improvement}</span>
                      </div>
                    )}
                    {leaderTab === 'recent' && <div className="ago">{timeAgo(site.last_scanned_at)}</div>}
                    {leaderTab === 'crawled' && <div className="crawled"><b>{site.scan_count}</b> 次掃描</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* ===== Section 3: 成功案例 ===== */}
            {successStories.length > 0 && (
              <section className="sc-section">
                <h2>📖 成功案例 <span className="sub">分數進步 20 分以上</span></h2>
                <div className="sc-ticker-wrap">
                  <div className="track">
                    {[...successStories, ...successStories].map((site, idx) => (
                      <div className="tcard" key={idx} aria-hidden={idx >= successStories.length || undefined}>
                        <div className="t">{site.name}</div>
                        <div className="u">{site.url}</div>
                        <div className="scores">
                          <div className="sc"><div className="n is-muted">{site.first_total_score}</div><div className="l">首次</div></div>
                          <div className="arrow" aria-hidden="true">→</div>
                          <div className="sc"><div className="n" style={{ color: scoreColor(site.total_score) }}>{site.total_score}</div><div className="l">現在</div></div>
                          <div className="delta">+{site.improvement}</div>
                        </div>
                        <div className="chips">
                          {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                            <span className="chip" key={label} style={{ color: scoreColor(score), background: scoreColor(score) + '1f' }}>{label} {score}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ===== Section 4: 全部目錄 ===== */}
            <section className="sc-section">
              <div className="sc-list-hd">
                <h2>📋 全部網站</h2>
                <div className="sort">
                  <span className="lab">排序：</span>
                  <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0) }}>
                    <option value="total_score">總分</option>
                    <option value="last_scanned_at">最近更新</option>
                    <option value="scan_count">掃描次數</option>
                  </select>
                </div>
              </div>

              <div className="sc-table">
                <div className="thead">
                  <div className="c1">#</div><div className="c2">網站</div>
                  <div className="c3">SEO</div><div className="c3">AEO</div><div className="c3">GEO</div><div className="c4">總分</div>
                </div>
                {paged.length === 0 ? (
                  <div className="empty">尚無資料</div>
                ) : paged.map((site, i) => (
                  <div className="trow" key={site.id}>
                    <div className="c1">{page * PAGE_SIZE + i + 1}</div>
                    <div className="c2">
                      <div className="t">{site.name}</div>
                      <span className="ai-badge">🤖 AI 已讀取 {timeAgo(site.last_scanned_at)}</span>
                    </div>
                    {[site.seo_score, site.aeo_score, site.geo_score].map((score, si) => (
                      <div className="c3" key={si}>
                        <span className="n" style={{ color: scoreColor(score) }}>{score}</span>
                        <div className="bar"><i style={{ width: `${score}%`, background: scoreColor(score) }} /></div>
                      </div>
                    ))}
                    <div className="c4" style={{ color: scoreColor(site.total_score) }}>{site.total_score}</div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="sc-pager">
                  <span className="count">目前展示 {Math.min((page + 1) * PAGE_SIZE, sites.length)} 筆 · 共 {sites.length} 筆</span>
                  <div className="btns">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← 上一頁</button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                      return <button key={p} onClick={() => setPage(p)} className={p === page ? 'on' : ''}>{p + 1}</button>
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>下一頁 →</button>
                  </div>
                </div>
              )}
              {totalPages <= 1 && sites.length > 0 && <div className="sc-total-note">共 {sites.length} 筆</div>}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
