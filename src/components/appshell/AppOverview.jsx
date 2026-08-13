import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { hostLabel } from '../../lib/url'
import { isHomepage } from '../../lib/pageAudit'
import { coreExposureRates } from './aivisData'
import { buildHealthChecks } from './healthData'
import MetricGlossary from './MetricGlossary'

// 四大技術面向（沿用現有 audit 表；顏色對齊設計稿）
const DIMS = [
  { key: 'seo',  label: 'SEO',     table: 'seo_audits',  color: 'var(--seo)'  },
  { key: 'aeo',  label: 'AEO',     table: 'aeo_audits',  color: 'var(--aeo)'  },
  { key: 'geo',  label: 'GEO',     table: 'geo_audits',  color: 'var(--geo)'  },
  { key: 'eeat', label: 'E-E-A-T', table: 'eeat_audits', color: 'var(--eeat)' },
]

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 }

/**
 * 重點行動卡：從四面向最新 audit 的「未通過項」挑最重要的 3 條。
 * 沿用 buildHealthChecks（同一套判定，含頁型 N/A、faq_visual 等規則），不重寫檢測邏輯。
 */
function buildTopActions(audits, onHome, websiteId) {
  const actions = []
  for (const dim of DIMS) {
    for (const check of buildHealthChecks(dim.key, audits, onHome)) {
      if (check.passed) continue
      actions.push({
        id: `${dim.key}-${check.id}`,
        tab: dim.key,
        dimLabel: dim.label,
        color: dim.color,
        priority: check.priority || 'P3',
        name: check.name,
        diagnosis: check.detail || check.description || '',
        to: `/app/${websiteId}/health/${dim.key}`,
      })
    }
  }
  return actions
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))
    .slice(0, 3)
}

export default function AppOverview() {
  const { websiteId } = useParams()
  const [loading, setLoading] = useState(true)
  const [website, setWebsite] = useState(null)
  const [audits, setAudits] = useState({})   // 各面向最新完整 audit row（給分數 + 行動卡）
  const [brand, setBrand] = useState(null)   // 連結的 aivis 品牌（靠 website_id）或 null
  const [aivisRate, setAivisRate] = useState(null) // 近 30 天品類推薦曝光率（無資料 = null）

  useEffect(() => {
    if (!websiteId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // 沿用 DashboardV2 的抓法：website + 每個 audit 最新一筆（完整 row）+ 連結的 aivis 品牌
        const { data: w } = await supabase.from('websites').select('*').eq('id', websiteId).single()
        if (cancelled) return
        setWebsite(w || null)

        const [seo, aeo, geo, eeat, br] = await Promise.all([
          ...DIMS.map(d => supabase.from(d.table).select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1)),
          supabase.from('aivis_brands').select('id, name').eq('website_id', websiteId).limit(1),
        ])
        if (cancelled) return
        setAudits({
          seo:  seo.data?.[0]  || null,
          aeo:  aeo.data?.[0]  || null,
          geo:  geo.data?.[0]  || null,
          eeat: eeat.data?.[0] || null,
        })
        const linkedBrand = br.data?.[0] || null
        setBrand(linkedBrand)

        // 有連結品牌 → 抓近 30 天題庫+回應算真曝光率（共用聚合，與 AI 曝光監測數字一致）
        if (linkedBrand) {
          const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
          const [promptResult, responseResult] = await Promise.all([
            supabase.from('aivis_prompts').select('id, brand_id, tier, is_active').eq('brand_id', linkedBrand.id),
            supabase.from('aivis_responses')
              .select('id, brand_id, prompt_id, brand_mentioned, created_at, engine_results')
              .eq('brand_id', linkedBrand.id).gte('created_at', since),
          ])
          if (!cancelled && !promptResult.error && !responseResult.error) {
            const rates = coreExposureRates({ prompts: promptResult.data || [], responses: responseResult.data || [], rangeDays: 30 })
            setAivisRate(rates.get(linkedBrand.id) ?? null)
          }
        } else {
          setAivisRate(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [websiteId])

  if (loading) return <div className="as-loading" aria-live="polite">載入中…</div>
  if (!website) return (
    <div className="as-empty">
      <div className="e-t">找不到這個網站</div>
      <div className="e-d">網站不存在，或你沒有權限查看。</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const title = website.name || hostLabel(website.url)
  const scores = Object.fromEntries(DIMS.map(d => [d.key, audits[d.key]?.score ?? null]))
  const onHome = isHomepage(website.url)
  const topActions = buildTopActions(audits, onHome, websiteId)

  // 儀表弧線：r=60、周長 ≈ 377；有真實曝光率才畫（不捏造）
  const CIRC = 2 * Math.PI * 60

  return (
    <>
      <div className="as-ctx">
        <div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div>
      </div>
      <div className="as-phead"><h2>總覽</h2><span className="sub">{title} 在 AI 眼中的整體狀態</span></div>

      {/* aivis 主角卡 — 誠實：有掃描資料顯示真曝光率；連結了但沒掃顯示接資料中；沒連結就設定 */}
      {brand ? (
        <div className="as-card as-truth">
          <div className="as-gauge">
            <svg width="142" height="142" viewBox="0 0 142 142" role="img" aria-label={aivisRate == null ? 'AI 曝光率接資料中' : `品類推薦曝光率 ${aivisRate}%`}>
              <circle cx="71" cy="71" r="60" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
              {aivisRate != null && (
                /* 真實曝光率弧線：transform 包在 g + fill-box 中心旋轉（Safari 相容，AGENTS §2） */
                <g style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: 'rotate(-90deg)' }}>
                  <circle cx="71" cy="71" r="60" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${CIRC * aivisRate / 100} ${CIRC}`} />
                </g>
              )}
            </svg>
            <div className="cx">
              {aivisRate == null
                ? <div><div className="big" style={{ fontSize: 34 }}>📡</div><div className="cap">接資料中</div></div>
                : <div><div className="big num">{aivisRate}<small>%</small></div><div className="cap">品類推薦曝光率</div></div>}
            </div>
          </div>
          <div>
            <div className="as-lbl">真相指標 · AI 實際推不推薦你</div>
            <h3>已連結品牌：{brand.name}</h3>
            <p>
              {aivisRate == null
                ? <>品牌已連結，但近 30 天還沒有掃描資料。<b>執行一次掃描</b>後，這裡會顯示真實曝光率。</>
                : <>近 30 天品類題掃描中，AI 回答提到你的比例。趨勢與逐題明細在「AI 曝光監測」。</>}
            </p>
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

      {/* 重點行動卡：全部檢測中最優先的 3 條（P1 在前），痛點＋診斷＋跳修復（Kuroma 實測學來） */}
      {topActions.length > 0 && (
        <section className="as-actions" aria-label="重點行動">
          <div className="sh"><b>現在最該修的 {topActions.length} 件事</b><span>依優先度自動挑選 · 點卡片直達修法</span></div>
          <div className="as-actions-row">
            {topActions.map((action, index) => (
              <Link key={action.id} className="as-card as-action" to={action.to}>
                <div className="top">
                  <span className="no num">{index + 1}</span>
                  <span className="dim" style={{ color: action.color }}>{action.dimLabel}</span>
                  <span className={`pri pri-${action.priority.toLowerCase()}`}>{action.priority}</span>
                </div>
                <div className="nm">{action.name}</div>
                <div className="dg">{action.diagnosis}</div>
                <div className="go">去修這一項 →</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 技術體質 — 真實分數，點卡片進體檢 */}
      <div className="as-support">
        <div className="sh"><b>技術體質</b><span>讓 AI 找得到你的地基 · 輔助指標 · 點卡片看詳情</span></div>
        <div className="as-scores">
          {DIMS.map(d => {
            const v = scores[d.key]
            return (
              <Link key={d.key} className="as-card as-sc" to={`/app/${websiteId}/health/${d.key}`}>
                <div className="top"><span className="nm">{d.label}</span><span className="arrow">→</span></div>
                <span className="n num" style={{ color: d.color }}>{v == null ? '–' : v}</span>
                <div className="bar"><i style={{ width: `${v ?? 0}%`, background: d.color }} /></div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* 指標詞彙表：解「為什麼技術分跟曝光率不一致」的信任地基 */}
      <MetricGlossary />

      {/* 改前/改後 — 誠實 placeholder，不假造趨勢 */}
      <div className="as-stub">📈 <b>改前 / 改後進展</b>：需要至少兩次掃描才能比較。接上趨勢資料後，這裡會顯示「你改了什麼 → AI 能見度怎麼變」。（建置中）</div>
    </>
  )
}
