import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// 四大技術面向（沿用現有 audit 表；顏色對齊設計稿）
const DIMS = [
  { key: 'seo',  label: 'SEO',     table: 'seo_audits',  color: 'var(--seo)'  },
  { key: 'aeo',  label: 'AEO',     table: 'aeo_audits',  color: 'var(--aeo)'  },
  { key: 'geo',  label: 'GEO',     table: 'geo_audits',  color: 'var(--geo)'  },
  { key: 'eeat', label: 'E-E-A-T', table: 'eeat_audits', color: 'var(--eeat)' },
]

export default function AppOverview() {
  const { websiteId } = useParams()
  const [loading, setLoading] = useState(true)
  const [website, setWebsite] = useState(null)
  const [scores, setScores] = useState({})
  const [brand, setBrand] = useState(null)   // 連結的 aivis 品牌（靠 website_id）或 null

  useEffect(() => {
    if (!websiteId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // 沿用 DashboardV2 的抓法：website + 每個 audit 最新一筆 + 連結的 aivis 品牌
        const { data: w } = await supabase.from('websites').select('*').eq('id', websiteId).single()
        if (cancelled) return
        setWebsite(w || null)

        const [seo, aeo, geo, eeat, br] = await Promise.all([
          ...DIMS.map(d => supabase.from(d.table).select('score').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1)),
          supabase.from('aivis_brands').select('id, name').eq('website_id', websiteId).limit(1),
        ])
        if (cancelled) return
        setScores({
          seo:  seo.data?.[0]?.score  ?? null,
          aeo:  aeo.data?.[0]?.score  ?? null,
          geo:  geo.data?.[0]?.score  ?? null,
          eeat: eeat.data?.[0]?.score ?? null,
        })
        setBrand(br.data?.[0] || null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [websiteId])

  if (loading) return <div className="as-loading">載入中…</div>
  if (!website) return (
    <div className="as-empty">
      <div className="e-t">找不到這個網站</div>
      <div className="e-d">網站不存在，或你沒有權限查看。</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const title = website.name || website.url
  // 最低分維度 → 下一步建議（真資料驅動、不捏造）
  const present = DIMS.filter(d => scores[d.key] != null)
  const lowest = present.length ? present.reduce((a, b) => (scores[a.key] <= scores[b.key] ? a : b)) : null

  return (
    <>
      <div className="as-ctx">
        <div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div>
      </div>
      <div className="as-phead"><h2>總覽</h2><span className="sub">{title} 在 AI 眼中的整體狀態</span></div>

      {/* aivis 主角卡 — 誠實：有連結品牌顯示入口、沒有就設定；不捏造分數 */}
      {brand ? (
        <div className="as-card as-truth">
          <div className="as-gauge">
            <svg width="142" height="142" viewBox="0 0 142 142"><circle cx="71" cy="71" r="60" fill="none" stroke="var(--surface-2)" strokeWidth="12"/></svg>
            <div className="cx"><div><div className="big" style={{ fontSize: 34 }}>📡</div><div className="cap">AI 曝光監測</div></div></div>
          </div>
          <div>
            <div className="as-lbl">真相指標 · AI 實際推不推薦你</div>
            <h3>已連結品牌：{brand.name}</h3>
            <p>AI 能見度分數與趨勢在「AI 曝光監測」裡。<b>分數計算接資料中</b>——完整曝光率會在該區塊建好後顯示於此。</p>
            <Link className="as-cta" to={`/app/${websiteId}/visibility`}>看 AI 曝光監測 →</Link>
          </div>
        </div>
      ) : (
        <div className="as-empty">
          <div className="e-t">還沒設定 AI 曝光監測</div>
          <div className="e-d">設定後，我們會真的拿你的品牌去問 ChatGPT／Claude／Gemini，量 AI 到底推不推薦你。</div>
          <Link className="as-cta" to={`/app/${websiteId}/visibility`}>設定 AI 曝光監測 →</Link>
        </div>
      )}

      {/* 技術體質 — 真實分數，點卡片進體檢 */}
      <div className="as-support">
        <div className="sh"><b>技術體質</b><span>讓 AI 找得到你的地基 · 輔助指標 · 點卡片看詳情</span></div>
        <div className="as-scores">
          {DIMS.map(d => {
            const v = scores[d.key]
            return (
              <Link key={d.key} className="as-card as-sc" to={`/app/${websiteId}/health`}>
                <div className="top"><span className="nm">{d.label}</span><span className="arrow">→</span></div>
                <span className="n num" style={{ color: d.color }}>{v == null ? '–' : v}</span>
                <div className="bar"><i style={{ width: `${v ?? 0}%`, background: d.color }} /></div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 下一步 — 從最低分維度給真建議 */}
      {lowest && (
        <div className="as-card as-next">
          <div className="no num">1</div>
          <div className="tx">
            <div className="h">下一步該做的一件事</div>
            <div className="d">你的 <em>{lowest.label}</em> 目前分數最低（{scores[lowest.key]} 分）——先從這一項下手，CP 值最高。</div>
          </div>
          <Link className="as-cta" to={`/app/${websiteId}/health`} style={{ marginTop: 0 }}>去看怎麼修 →</Link>
        </div>
      )}

      {/* 改前/改後 — 誠實 placeholder，不假造趨勢 */}
      <div className="as-stub">📈 <b>改前 / 改後進展</b>：需要至少兩次掃描才能比較。接上趨勢資料後，這裡會顯示「你改了什麼 → AI 能見度怎麼變」。（建置中）</div>
    </>
  )
}
