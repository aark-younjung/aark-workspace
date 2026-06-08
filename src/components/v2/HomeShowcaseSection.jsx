/**
 * HomeShowcaseSection — 首頁內嵌的 Showcase 區塊（B4）
 *
 * 之前 HomeDark 只有一個小 GlassCard 按鈕「查看 AI 能見度排行榜」、要點才能看到內容
 * 改成在首頁直接顯示 Top 5 排行 + 進步之星 teaser、降低用戶探索門檻
 *
 * 設計策略：
 *   - 首頁只塞「最有衝擊力」的 — Top 5 AI 友善度 + 進步之星滾動條
 *   - 完整版（5 個分頁、所有目錄、全資料表）留在 /showcase 獨立頁、用「看完整排行 →」連過去
 *   - 跟 Showcase.jsx 共用查詢邏輯但簡化（只抓需要的、減少首頁載入負擔）
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { T } from '../../styles/v2-tokens'

// 跟 Showcase.jsx 同款的分數顯色（≥70 綠 / ≥40 黃 / 其他紅）
const scoreColor = (s) => s >= 70 ? '#4ade80' : s >= 40 ? '#facc15' : '#f87171'

// 每個 website_id 的歷次 audit → {first_score, latest_score, count}
// 從 Showcase.jsx 抄；input 是 already sorted by created_at asc 的 array
function buildStats(rows) {
  const map = {}
  for (const r of (rows || [])) {
    const wid = r.website_id
    if (!map[wid]) map[wid] = { count: 0, first_score: r.score, latest_score: r.score, latest_at: r.created_at }
    map[wid].count++
    map[wid].latest_score = r.score
    map[wid].latest_at = r.created_at
  }
  return map
}

export default function HomeShowcaseSection() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [wRes, sRes, aRes, gRes] = await Promise.all([
          // 只撈 admin 核准的 websites（同 Showcase.jsx 邏輯）
          supabase.from('websites').select('id, name, url').eq('is_approved', true).order('created_at', { ascending: true }).limit(200),
          supabase.from('seo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
          supabase.from('aeo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
          supabase.from('geo_audits').select('website_id, score, created_at').order('created_at', { ascending: true }),
        ])
        if (cancelled) return
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
          }
        }).filter(Boolean)

        if (!cancelled) setSites(combined)
      } catch (e) {
        console.error('HomeShowcaseSection load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Top 5 AI 友善度（total_score 排序）
  const top5 = [...sites].sort((a, b) => b.total_score - a.total_score).slice(0, 5)
  // 進步之星：至少掃 2 次 + 有進步、取進步幅度 Top 3
  const progressStars = [...sites]
    .filter(s => s.scan_count >= 2 && s.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 3)

  const totalApprovedSites = sites.length

  return (
    <section className="mt-20">
      {/* Section header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3" style={{
          background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
        }}>
          <span style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>🏆 SOCIAL PROOF</span>
        </div>
        <h2 className="text-3xl font-bold mb-3" style={{ color: T.text }}>
          其他品牌的 AI 能見度長這樣
        </h2>
        <p className="text-sm" style={{ color: T.textMid }}>
          {totalApprovedSites > 0
            ? <>{totalApprovedSites} 個品牌已經跑過完整掃描 — 看看 AI 怎麼評你的同行</>
            : <>看排行榜了解 AI 怎麼評各品牌、找出值得學的優化方向</>}
        </p>
      </div>

      {/* 主體：左 Top 5 排行 / 右 進步之星 */}
      <div className="grid lg:grid-cols-5 gap-6 mb-6">

        {/* 左：Top 5 排行（佔 3/5） */}
        <div className="lg:col-span-3">
          <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            🏆 AI 友善度 TOP 5
          </h3>
          <div className="rounded-2xl overflow-hidden" style={{
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {loading ? (
              <div className="text-center py-12 text-sm" style={{ color: T.textLow }}>載入中…</div>
            ) : top5.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: T.textLow }}>還沒有公開排行的資料</div>
            ) : (
              top5.map((site, i) => (
                <div key={site.id} className="flex items-center gap-4 px-5 py-4 border-b last:border-0 hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {/* 名次 */}
                  <div className="w-8 text-center flex-shrink-0 text-xl">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' :
                      <span className="text-sm font-mono" style={{ color: T.textLow }}>{i + 1}</span>}
                  </div>
                  {/* 網站名 + URL */}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate text-sm sm:text-base">{site.name}</div>
                    <div className="text-sm truncate font-mono" style={{ color: T.textLow }}>{site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
                  </div>
                  {/* 分數 */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                      <div key={label} className="text-center hidden sm:block">
                        <div className="text-sm font-bold" style={{ color: scoreColor(score) }}>{score}</div>
                        <div className="text-sm" style={{ color: T.textLow }}>{label}</div>
                      </div>
                    ))}
                    <div className="text-2xl font-bold ml-2" style={{ color: scoreColor(site.total_score) }}>
                      {site.total_score}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右：進步之星（佔 2/5） */}
        <div className="lg:col-span-2">
          <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
            📈 進步之星
          </h3>
          {loading ? (
            <div className="rounded-2xl py-12 text-center text-sm" style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: T.textLow,
            }}>載入中…</div>
          ) : progressStars.length === 0 ? (
            <div className="rounded-2xl p-6 text-center text-sm" style={{
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: T.textLow,
            }}>
              還沒有顯著進步資料
              <div className="mt-2 text-sm">第一輪掃描完後、第二輪會出現比較</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {progressStars.map(star => (
                <div key={star.id} className="rounded-xl p-4 flex items-center gap-4" style={{
                  background: 'linear-gradient(135deg, rgba(74,222,128,0.10), rgba(0,0,0,0.4))',
                  border: '1px solid rgba(74,222,128,0.25)',
                }}>
                  <div className="text-3xl flex-shrink-0">✨</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm truncate">{star.name}</div>
                    <div className="text-sm mt-0.5" style={{ color: T.textLow }}>
                      <span className="font-mono">{star.first_total_score}</span> → <span className="font-mono font-bold" style={{ color: scoreColor(star.total_score) }}>{star.total_score}</span>
                    </div>
                  </div>
                  <div className="text-base font-bold px-3 py-1.5 rounded-lg whitespace-nowrap" style={{
                    background: 'rgba(34,197,94,0.20)',
                    color: '#4ade80',
                  }}>
                    +{star.improvement} 分
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部 CTA：去完整 Showcase */}
      <div className="text-center mt-6">
        <Link to="/showcase"
          className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #18c590, #0d7a58)',
            boxShadow: '0 6px 20px rgba(24,197,144,0.35)',
          }}>
          查看完整排行榜（5 個分頁 + 全部目錄）→
        </Link>
      </div>
    </section>
  )
}
