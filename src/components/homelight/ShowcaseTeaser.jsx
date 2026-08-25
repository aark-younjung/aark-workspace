import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

/**
 * 首頁排行榜內嵌（亮色版）— 查詢/計分邏輯照抄暗色版 HomeShowcaseSection
 * （同款分數門檻、同款進步之星判定），只換視覺外殼成 .homelight token。
 * 兩邊各自維護一份查詢：HomeDark 屬於觀察期逃生口、之後會整支退役，
 * 現在不為了共用硬拉一層 theme prop 增加耦合。
 */
const scoreColor = s => (s >= 70 ? 'var(--geo)' : s >= 40 ? 'var(--eeat)' : '#dc2626')

function buildStats(rows) {
  const map = {}
  for (const r of rows || []) {
    const wid = r.website_id
    if (!map[wid]) map[wid] = { count: 0, first_score: r.score, latest_score: r.score }
    map[wid].count++
    map[wid].latest_score = r.score
  }
  return map
}

export default function HomeLightShowcase() {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [wRes, sRes, aRes, gRes] = await Promise.all([
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
            seo_score: seo.latest_score || 0, aeo_score: aeo.latest_score || 0, geo_score: geo.latest_score || 0,
            total_score: latestScore, first_total_score: firstScore,
            improvement: latestScore - firstScore, scan_count: scanCount,
          }
        }).filter(Boolean)

        if (!cancelled) setSites(combined)
      } catch (error) {
        console.error('[HomeLightShowcase] load error:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const top5 = [...sites].sort((a, b) => b.total_score - a.total_score).slice(0, 5)
  const progressStars = [...sites]
    .filter(s => s.scan_count >= 2 && s.improvement > 0)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 3)

  return (
    <section className="hl-showcase">
      <div className="hd">
        <span className="kick">🏆 社會證明</span>
        <h2>其他品牌的 AI 能見度長這樣</h2>
        <p>
          {sites.length > 0
            ? `${sites.length} 個品牌已經跑過完整掃描——看看 AI 怎麼評你的同行`
            : '看排行榜了解 AI 怎麼評各品牌、找出值得學的優化方向'}
        </p>
      </div>

      <div className="body">
        <div className="top5">
          <h3>AI 友善度 TOP 5</h3>
          <div className="card">
            {loading ? (
              <div className="empty">載入中…</div>
            ) : top5.length === 0 ? (
              <div className="empty">還沒有公開排行的資料</div>
            ) : (
              top5.map((site, i) => (
                <div className="row" key={site.id}>
                  <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
                  <div className="nm">
                    <div className="t">{site.name}</div>
                    <div className="u">{site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>
                  </div>
                  <div className="scores">
                    {[['SEO', site.seo_score], ['AEO', site.aeo_score], ['GEO', site.geo_score]].map(([label, score]) => (
                      <div className="s" key={label}>
                        <div className="n" style={{ color: scoreColor(score) }}>{score}</div>
                        <div className="l">{label}</div>
                      </div>
                    ))}
                    <div className="total" style={{ color: scoreColor(site.total_score) }}>{site.total_score}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stars">
          <h3>📈 進步之星</h3>
          {loading ? (
            <div className="card empty">載入中…</div>
          ) : progressStars.length === 0 ? (
            <div className="card empty">
              還沒有顯著進步資料
              <span>第一輪掃描完後、第二輪會出現比較</span>
            </div>
          ) : (
            <div className="starlist">
              {progressStars.map(star => (
                <div className="star" key={star.id}>
                  <span className="ic">✨</span>
                  <div className="nm">
                    <div className="t">{star.name}</div>
                    <div className="d">{star.first_total_score} → <b style={{ color: scoreColor(star.total_score) }}>{star.total_score}</b></div>
                  </div>
                  <div className="delta">+{star.improvement} 分</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="more"><Link to="/showcase">查看完整排行榜（5 個分頁＋全部目錄） →</Link></div>
    </section>
  )
}
