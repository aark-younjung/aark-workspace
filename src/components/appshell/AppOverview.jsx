import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { hostLabel } from '../../lib/url'
import { isHomepage } from '../../lib/pageAudit'
import { coreExposureRates, buildCompetitorComparison } from './aivisData'
import { computeBrandLevel, BRAND_LEVELS } from './brandLevel'
import { runFullScan } from '../../services/scanService'
import ClientReportModal from '../v2/ClientReportModal'
import LLMOChecklistModal from '../v2/LLMOChecklistModal'
import { buildHealthChecks } from './healthData'
import MetricGlossary from './MetricGlossary'
import SiteSwitcher from './SiteSwitcher'

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
  const navigate = useNavigate()
  // 試用一鍵開通（轉址前檢查：這條 4% 斷點修復不能只活在經典版）
  const { user, isPro, isTrial, hasTrialedBefore, startTrial } = useAuth()
  const [trialBusy, setTrialBusy] = useState(false)
  const [trialErr, setTrialErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [website, setWebsite] = useState(null)
  const [audits, setAudits] = useState({})   // 各面向最新完整 audit row（給分數 + 行動卡）
  const [brand, setBrand] = useState(null)   // 連結的 aivis 品牌（靠 website_id）或 null
  const [aivisRate, setAivisRate] = useState(null) // 近 30 天品類推薦曝光率（無資料 = null）
  const [aivisRaw, setAivisRaw] = useState(null)   // 90 天題庫+回應（品牌等級判定用）
  const [scanning, setScanning] = useState(false)  // 重新掃描中（共用 scanService）
  const [contentScore, setContentScore] = useState(null) // 內容品質（第 5 分數，content_audits 最新一筆）
  const [pdfOpen, setPdfOpen] = useState(false)        // 客戶提案 PDF modal（沿用 v2 元件）
  const [checklistOpen, setChecklistOpen] = useState(false) // 6 週清單 PDF modal（沿用 v2 元件）

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
          supabase.from('aivis_brands').select('*').eq('website_id', websiteId).limit(1),
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

        // 內容品質（第 5 分數）：content_audits 最新一筆
        const { data: contentRows } = await supabase
          .from('content_audits').select('score').eq('website_id', websiteId)
          .order('created_at', { ascending: false }).limit(1)
        if (!cancelled) setContentScore(contentRows?.[0]?.score ?? null)

        // 有連結品牌 → 抓近 30 天題庫+回應算真曝光率（共用聚合，與 AI 曝光監測數字一致）
        if (linkedBrand) {
          const since = new Date(Date.now() - 90 * 86_400_000).toISOString()  // 等級判定看 90 天；30 天儀表由聚合函式自己切窗
          const [promptResult, responseResult] = await Promise.all([
            supabase.from('aivis_prompts').select('id, brand_id, tier, is_active').eq('brand_id', linkedBrand.id),
            supabase.from('aivis_responses')
              .select('id, brand_id, prompt_id, brand_mentioned, created_at, engine_results')
              .eq('brand_id', linkedBrand.id).gte('created_at', since),
          ])
          if (!cancelled && !promptResult.error && !responseResult.error) {
            const prompts = promptResult.data || []
            const responses = responseResult.data || []
            const rates = coreExposureRates({ prompts, responses, rangeDays: 30 })
            setAivisRate(rates.get(linkedBrand.id) ?? null)
            setAivisRaw({ prompts, responses })   // 品牌等級用（90 天窗）
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

  // 試用一鍵開通：成功直接帶去設定品牌（預填名稱/網域）——與經典版 AivisHero 同一條斷點修復
  const canStartTrial = !isPro && !isTrial && !hasTrialedBefore
  async function handleStartTrial() {
    if (trialBusy) return
    setTrialBusy(true); setTrialErr('')
    const result = await startTrial()
    setTrialBusy(false)
    if (!result?.ok) {
      setTrialErr({
        already_trialed: '這個帳號已經用過免費試用了。',
        not_authenticated: '請先登入再啟用試用。',
      }[result?.error] || '啟用失敗，請稍後再試。')
      return
    }
    navigate('/ai-visibility', {
      state: {
        prefillName: website?.name || '',
        prefillDomain: (website?.url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      },
    })
  }

  // 重新掃描（硬切前置：搬進新版；走共用 scanService、與經典版同一支寫入邏輯）
  async function handleRescan() {
    if (!website?.url || scanning) return
    setScanning(true)
    try {
      await runFullScan({ websiteId, url: website.url })
      window.location.reload()   // 簡單做法：整頁重抓，所有卡片吃 DB 最新（與經典版一致）
    } catch (error) {
      console.error('rescan failed:', error)
      setScanning(false)
      // 透傳真實原因（fetch-url 的錯誤含 hint，例：逾時＝對方主機沒回應、非功能壞掉）
      alert(`掃描失敗：${error?.message || '請稍後再試'}`)
    }
  }

  // 品牌 AI 能見度等級（里程碑事件制）：全部從真實資料判定，逐級解鎖
  const rate90 = (() => {
    if (!brand || !aivisRaw) return null
    const rates = coreExposureRates({ prompts: aivisRaw.prompts, responses: aivisRaw.responses, rangeDays: 90 })
    return rates.get(brand.id) ?? null
  })()
  const leadsWatchlist = (() => {
    if (!brand?.competitors?.length || !aivisRaw) return false
    const comparison = buildCompetitorComparison({
      competitors: brand.competitors, prompts: aivisRaw.prompts, responses: aivisRaw.responses,
      mentions: [], rangeDays: 90,
    })
    return Boolean(comparison && comparison.basis > 0 && comparison.rows.every(row => row.rate <= comparison.own.rate))
  })()
  const level = computeBrandLevel({
    hasAudit: DIMS.some(d => audits[d.key]),
    hasBrand: Boolean(brand),
    hasAivisScan: Boolean(aivisRaw?.responses?.length),
    rate90,
    leadsWatchlist,
  })

  // 儀表弧線：r=60、周長 ≈ 377；有真實曝光率才畫（不捏造）
  const CIRC = 2 * Math.PI * 60

  return (
    <>
      <div className="as-ctx"><SiteSwitcher websiteId={websiteId} currentTitle={title} /></div>
      <div className="as-phead"><h2>總覽</h2><span className="sub">{title} 在 AI 眼中的整體狀態</span>
        <div className="as-head-actions">
          {/* PDF 匯出（硬切前置 #2）：沿用經典版同兩個 modal 元件、資料同源 */}
          <button type="button" className="as-vis-line-button" onClick={() => setPdfOpen(true)}>📄 客戶報告</button>
          <button type="button" className="as-vis-line-button" onClick={() => setChecklistOpen(true)}>📋 6 週清單</button>
          <button type="button" className="as-cta as-rescan" onClick={handleRescan} disabled={scanning} aria-live="polite">
            {scanning ? '掃描中…（約 30–60 秒）' : '🔄 重新掃描'}
          </button>
        </div>
      </div>

      {/* 品牌 AI 能見度等級（里程碑事件制・雷達隱喻）：每一級都是可驗證的真實事件、逐級解鎖 */}
      <div className="as-level" role="group" aria-label={`品牌 AI 能見度等級：Lv.${level.current.lv} ${level.current.name}`}>
        <div className="cur"><span className="ic" aria-hidden="true">{level.current.icon}</span><b>Lv.{level.current.lv}　{level.current.name}</b></div>
        <div className="ladder" aria-hidden="true">
          {BRAND_LEVELS.map(item => (
            <i key={item.lv} className={item.lv <= level.current.lv ? 'on' : ''} title={`Lv.${item.lv} ${item.name}：${item.condition}`} />
          ))}
        </div>
        {level.next ? (
          <div className="nx">
            下一級 <b>Lv.{level.next.lv} {level.next.name}</b>：{level.next.condition}
            {(level.next.lv === 4 || level.next.lv === 5) && rate90 != null && <span className="num">（目前 {rate90}%）</span>}
          </div>
        ) : (
          <div className="nx top">已達最高等級——維持住，AI 的世界每週都在變 🏆</div>
        )}
      </div>

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
          <div className="e-d">
            設定後，我們會真的拿你的品牌去問 ChatGPT／Claude／Gemini，量 AI 到底推不推薦你。
            {canStartTrial && <>　<b>你的帳號有 7 天免費試用，不用綁卡。</b></>}
          </div>
          {canStartTrial ? (
            <>
              <button type="button" className="as-cta" onClick={handleStartTrial} disabled={trialBusy}>
                {trialBusy ? '啟用中…' : '免費試用 7 天 → 看 AI 推不推薦我'}
              </button>
              {trialErr && <div className="e-d" role="alert" style={{ color: '#b4231f', marginTop: 8 }}>{trialErr}</div>}
            </>
          ) : (
            <Link className="as-cta" to={`/app/${websiteId}/visibility`}>設定 AI 曝光監測 →</Link>
          )}
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
        <div className="as-scores as-scores-5">
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
          {/* 內容品質＝第 5 分數（轉址前檢查：經典版有、新版不能少）；工具本體沿用現有頁 */}
          <Link className="as-card as-sc" to={`/content-audit/${websiteId}`}>
            <div className="top"><span className="nm">內容品質</span><span className="arrow">→</span></div>
            <span className="n num" style={{ color: '#ec4899' }}>{contentScore == null ? '–' : contentScore}</span>
            <div className="bar"><i style={{ width: `${contentScore ?? 0}%`, background: '#ec4899' }} /></div>
          </Link>
        </div>
      </div>

      {/* 指標詞彙表：解「為什麼技術分跟曝光率不一致」的信任地基 */}
      <MetricGlossary />

      {/* 改前/改後 — 誠實 placeholder，不假造趨勢 */}
      <div className="as-stub">📈 <b>改前 / 改後進展</b>：需要至少兩次掃描才能比較。接上趨勢資料後，這裡會顯示「你改了什麼 → AI 能見度怎麼變」。（建置中）</div>

      {/* PDF modals：沿用經典版元件（白標客戶提案 + 6 週執行清單），資料吃本頁已載入的 audits */}
      <ClientReportModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        data={{ website, seoAudit: audits.seo, aeoAudit: audits.aeo, geoAudit: audits.geo, eeatAudit: audits.eeat }}
      />
      <LLMOChecklistModal
        open={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        data={{ website }}
        baselineScores={{
          seo: audits.seo?.score || 0,
          aeo: audits.aeo?.score || 0,
          geo: audits.geo?.score || 0,
          eeat: audits.eeat?.score || 0,
        }}
      />
    </>
  )
}
