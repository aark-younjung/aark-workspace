import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import { FIX_GUIDES, PLATFORMS } from '../data/fixGuides'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const ACCENT = T.seo
const ACCENT2 = '#06b6d4'

const PAGE_KEYFRAMES = `
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.92)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
  /* SEO 頂部 Hero 兩欄響應式 grid（左:右 = 5:7，窄螢幕堆疊） */
  .seo-hero-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 16px; }
  @media (max-width: 880px) { .seo-hero-grid { grid-template-columns: 1fr; } }
  /* 頂部 breadcrumb + 操作鈕列 */
  .seo-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  /* Core Web Vitals 三欄響應式 */
  .seo-cwv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 540px) { .seo-cwv-grid { grid-template-columns: 1fr; } }
  /* IssueBoard 看板四欄：1100px 變兩欄、600px 變單欄 */
  .seo-issue-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 1100px) { .seo-issue-board { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .seo-issue-board { grid-template-columns: 1fr; } }
  /* IssueFixPanel 展開動畫 */
  .seo-fix-panel { animation: fadeUp .25s ease-out; }
`

const SEO_CHECKS = [
  {
    id: 'meta_title', name: 'Meta 標題', icon: '🏷️',
    description: '頁面標題是搜尋結果的第一印象，建議長度 30–60 字，包含主要關鍵字',
    recommendation: '在 <head> 加入 <title>頁面主題 | 品牌名稱</title>，長度控制在 30–60 字，將目標關鍵字放在前半段',
    priority: 'P1',
    getValue: (audit) => {
      const content = audit?.meta_tags?.titleContent
      const len = content?.length || 0
      if (!content) return { passed: false, detail: '未設置 Meta 標題' }
      if (len < 30) return { passed: false, detail: `標題過短（${len} 字），建議至少 30 字` }
      if (len > 60) return { passed: false, detail: `標題過長（${len} 字），建議縮短至 60 字以內` }
      return { passed: true, detail: `「${content.length > 35 ? content.substring(0, 35) + '...' : content}」（${len} 字）` }
    },
  },
  {
    id: 'meta_desc', name: 'Meta 描述', icon: '📝',
    description: 'Meta 描述出現在搜尋結果摘要，好的描述能提升點擊率（CTR），建議 70–155 字',
    recommendation: '在 <head> 加入 <meta name="description" content="...">，自然帶入關鍵字，並以行動呼籲結尾，長度 70–155 字',
    priority: 'P1',
    getValue: (audit) => {
      const content = audit?.meta_tags?.descriptionContent
      const len = content?.length || 0
      if (!content) return { passed: false, detail: '未設置 Meta 描述' }
      if (len < 70) return { passed: false, detail: `描述過短（${len} 字），建議至少 70 字` }
      if (len > 155) return { passed: false, detail: `描述過長（${len} 字），超過搜尋結果顯示上限` }
      return { passed: true, detail: `${len} 字，長度符合建議範圍` }
    },
  },
  {
    id: 'h1_structure', name: 'H1 標題結構', icon: '📖',
    description: 'H1 是頁面最重要的標題，Google 與 AI 依靠 H1 理解頁面主題。每頁應只有一個 H1',
    recommendation: '確保頁面只有一個 H1 標籤，清楚說明頁面核心主題，並自然包含目標關鍵字',
    priority: 'P2',
    getValue: (audit) => {
      const count = audit?.h1_structure?.h1Count ?? 0
      const content = audit?.h1_structure?.h1Content
      if (count === 0) return { passed: false, detail: '頁面沒有 H1 標題' }
      if (count > 1) return { passed: false, detail: `頁面有 ${count} 個 H1 標題，應只有 1 個` }
      return { passed: true, detail: `「${content?.length > 35 ? content.substring(0, 35) + '...' : content}」` }
    },
  },
  {
    id: 'alt_tags', name: '圖片 Alt 屬性', icon: '🖼️',
    description: 'Alt 屬性讓 Google 和 AI 理解圖片內容，同時幫助視障用戶，覆蓋率建議 ≥ 80%',
    recommendation: '為每張圖片加入描述性的 alt 文字（例如 alt="2024年台北辦公室外觀"），避免空白或通用描述如 alt="圖片"',
    priority: 'P2',
    getValue: (audit) => {
      const total = audit?.alt_tags?.totalImages ?? 0
      const coverage = audit?.alt_tags?.altCoverage ?? 100
      const missing = audit?.alt_tags?.imagesWithoutAlt ?? 0
      if (total === 0) return { passed: true, detail: '頁面無圖片，無需設置' }
      if (coverage < 80) return { passed: false, detail: `${total} 張圖片中 ${missing} 張缺少 Alt（覆蓋率 ${coverage}%）` }
      return { passed: true, detail: `${total} 張圖片，覆蓋率 ${coverage}%` }
    },
  },
  {
    id: 'mobile_compatible', name: '行動裝置相容', icon: '📱',
    description: 'Google 採用行動優先索引（Mobile-First Indexing），未設置 viewport 的網站排名會受影響',
    recommendation: '在 <head> 加入 <meta name="viewport" content="width=device-width, initial-scale=1">，並確認網站在手機上版面正常',
    priority: 'P1',
    getValue: (audit) => {
      const hasViewport = audit?.mobile_compatible?.hasViewport
      if (!hasViewport) return { passed: false, detail: '未設置 viewport meta 標籤' }
      return { passed: true, detail: 'viewport 已設置，支援行動裝置' }
    },
  },
  {
    id: 'page_speed', name: '頁面載入速度', icon: '⚡',
    description: '頁面速度是 Google 排名因素之一，也直接影響跳出率。建議伺服器回應時間 < 3 秒',
    recommendation: '壓縮圖片（使用 WebP 格式）、啟用瀏覽器快取、使用 CDN、移除不必要的 JavaScript 可大幅提升速度',
    priority: 'P3',
    getValue: (audit) => {
      const loadTime = audit?.page_speed?.loadTime
      const grade = audit?.page_speed?.speedGrade
      if (!loadTime) return { passed: false, detail: '無法測量載入速度' }
      if (loadTime > 3000) return { passed: false, detail: `${loadTime}ms（${grade}），超過 3 秒建議值` }
      return { passed: true, detail: `${loadTime}ms（${grade}）` }
    },
  },
]

export default function SEOAudit() {
  const { id } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  // 近 7 次掃描分數（最新在前），給頂部 Hero 趨勢迷你圖用
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)
      const { data: seoData } = await supabase
        .from('seo_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).single()
      setSeoAudit(seoData)
      // 拉最近 7 筆分數做趨勢迷你圖
      const { data: recentData } = await supabase
        .from('seo_audits').select('score, created_at').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(7)
      setRecentAudits(recentData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleReanalyze() {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeSEO(website.url)
      await supabase.from('seo_audits').insert([{
        website_id: id, score: result.score,
        meta_tags: result.meta_tags, h1_structure: result.h1_structure,
        alt_tags: result.alt_tags, mobile_compatible: result.mobile_compatible,
        page_speed: result.page_speed,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  const checks = SEO_CHECKS.map(c => ({ ...c, ...c.getValue(seoAudit) }))
  const passedCount = checks.filter(c => c.passed).length
  const failedCount = SEO_CHECKS.length - passedCount
  const score = seoAudit?.score ?? Math.round((passedCount / SEO_CHECKS.length) * 100)
  const loadTime = seoAudit?.page_speed?.loadTime
  const firstFail = checks.find(c => !c.passed)

  return (
    <>
      <style>{PAGE_KEYFRAMES}</style>
      <PageBg>
        <SiteHeader />
        <div className="relative z-10">
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>

            {/* ── 頂部頁首：breadcrumb（連回 Dashboard）+ 重新檢測 + 匯出 PDF ─ */}
            <div className="seo-topbar" style={{ marginBottom: 16 }}>
              <Link to={`/dashboard/${id}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
                padding: '9px 16px 9px 10px', borderRadius: 12,
                color: T.textMid, textDecoration: 'none', fontSize: 13, fontFamily: T.font,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', border: `1px solid ${T.cardBorder}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: T.textMid, lineHeight: 1,
                }}>‹</span>
                <span style={{ color: T.textMid }}>檢測報告</span>
                <span style={{ color: T.textLow }}>/</span>
                <span style={{ color: T.text, fontWeight: 600 }}>SEO</span>
                {website?.url && (
                  <>
                    <span style={{ color: T.textLow }}>/</span>
                    <span style={{ color: T.text, fontFamily: T.mono, fontSize: 12 }}>{website.url}</span>
                  </>
                )}
              </Link>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleReanalyze} disabled={analyzing} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
                  color: T.text, fontSize: 13, fontWeight: 600,
                  padding: '10px 18px', borderRadius: 12, cursor: analyzing ? 'not-allowed' : 'pointer',
                  fontFamily: T.font, opacity: analyzing ? 0.6 : 1,
                }}>
                  <span style={{
                    fontSize: 13, display: 'inline-block',
                    animation: analyzing ? 'spin .9s linear infinite' : 'none',
                  }}>↻</span>
                  {analyzing ? '檢測中…' : '重新檢測'}
                </button>
                <button onClick={() => window.print()} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                  padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
                  fontFamily: T.font, boxShadow: `0 4px 14px ${ACCENT}55`,
                }}>
                  <span>📄</span>匯出 PDF
                </button>
              </div>
            </div>

            {/* ── 兩欄 Hero：左邊分數圈 + 趨勢；右邊 SERP 預覽 + Core Web Vitals ─ */}
            <div className="seo-hero-grid" style={{ marginBottom: 32 }}>
              {loading ? (
                <>
                  <HeroSkeleton tall />
                  <HeroSkeleton tall />
                </>
              ) : (
                <>
                  <ScoreHero
                    score={score}
                    passedCount={passedCount}
                    failedCount={failedCount}
                    total={SEO_CHECKS.length}
                    recentAudits={recentAudits}
                    firstFail={firstFail}
                  />
                  <SerpAndVitals
                    website={website}
                    audit={seoAudit}
                    loadTime={loadTime}
                  />
                </>
              )}
            </div>

            {/* ── 區塊 3：詳細檢測項目（看板式 IssueBoard） ─── */}
            <SectionTitle title="詳細檢測項目" sub="依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟" />
            <div style={{ marginBottom: 32 }}>
              {loading ? (
                <IssueBoardSkeleton />
              ) : (
                <IssueBoard checks={checks} isPro={isPro} />
              )}
            </div>

            {/* ── 區塊 4：優化路線圖 ─────────────────── */}
            <SectionTitle title="SEO 優化路線圖" sub="按 P1 → P2 → P3 三階段執行，每階段對應的時程與重點" />
            <RoadmapPanel checks={checks} isPro={isPro} />
          </div>
        </div>
        <Footer dark />
      </PageBg>
    </>
  )
}

// =====================================================
// SectionTitle（章節標題）
// =====================================================
function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{
        fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: '-.01em',
        marginBottom: 4, fontFamily: T.font,
      }}>{title}</h2>
      <div style={{ fontSize: 12, color: T.textLow }}>{sub}</div>
    </div>
  )
}

// =====================================================
// ScoreHero（左側分數總覽）— 大圈分數 + 7 日趨勢迷你圖 + 通過/待修兩格
// =====================================================
function ScoreHero({ score, passedCount, failedCount, total, recentAudits, firstFail }) {
  // recentAudits 是新→舊；翻成舊→新給趨勢線吃
  const trendData = recentAudits.slice().reverse().map(a => a.score)
  const trendDelta = trendData.length >= 2
    ? trendData[trendData.length - 1] - trendData[0]
    : 0
  // 分數色階：>=80 綠、>=60 SEO 藍、其他 警示橘
  const scoreColor = score >= 80 ? T.pass : score >= 60 ? ACCENT : T.warn
  const deltaColor = trendDelta > 0 ? T.pass : trendDelta < 0 ? T.fail : T.textMid
  const deltaSign = trendDelta > 0 ? '+' : ''

  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* 上：兩個 chip + 一行白話定位 */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: '.08em',
            background: ACCENT + '1f', border: `1px solid ${ACCENT}38`,
            padding: '3px 8px', borderRadius: 5,
          }}>SEO</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: T.textMid, letterSpacing: '.04em',
            background: 'rgba(255,255,255,.04)', border: `1px solid ${T.cardBorder}`,
            padding: '3px 8px', borderRadius: 5,
          }}>技術檢測</span>
        </div>
        <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.55 }}>
          傳統搜尋排名 — AI 爬蟲評估頁面品質的基礎
        </div>
      </div>

      {/* 中：分數圈 + 7 日趨勢迷你圖 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <ScoreCircle score={score} color={scoreColor} />
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, color: T.textLow, marginBottom: 4, letterSpacing: '.06em' }}>7 日趨勢</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: deltaColor,
            marginBottom: 8, fontFamily: T.font, letterSpacing: '-.01em',
          }}>
            {trendData.length >= 2 ? `${deltaSign}${trendDelta} 分` : '— 首次掃描'}
          </div>
          <Sparkline
            data={trendData.length >= 2 ? trendData : [score, score]}
            color={ACCENT}
          />
        </div>
      </div>

      {/* 下：已通過 / 需修復 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{
          background: T.pass + '14', border: `1px solid ${T.pass}33`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>已通過</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: T.pass, fontFamily: T.font }}>{passedCount}</span>
            <span style={{ fontSize: 12, color: T.textLow }}>/ {total}</span>
          </div>
        </div>
        <div style={{
          background: failedCount > 0 ? T.fail + '14' : 'rgba(255,255,255,.03)',
          border: `1px solid ${failedCount > 0 ? T.fail + '33' : T.cardBorder}`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>需修復</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: 24, fontWeight: 800,
              color: failedCount > 0 ? T.fail : T.textMid,
              fontFamily: T.font,
            }}>{failedCount}</span>
            <span style={{ fontSize: 12, color: T.textLow }}>
              {failedCount > 0 ? `項待處理${firstFail ? '' : ''}` : '項，全部達標'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ScoreCircle（SVG 圓形進度，搭配中央分數）
// =====================================================
function ScoreCircle({ score, color }) {
  const size = 150
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(score, 100)) / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset .8s ease-out',
            filter: `drop-shadow(0 0 8px ${color}aa)`,
          }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 38, fontWeight: 800, color: T.text,
          letterSpacing: '-.02em', fontFamily: T.font, lineHeight: 1,
        }}>{score}</div>
        <div style={{ fontSize: 10, color: T.textLow, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  )
}

// =====================================================
// Sparkline（趨勢迷你折線 + 漸層填充，給 Hero 用）
// =====================================================
function Sparkline({ data, color }) {
  if (!data?.length) return <div style={{ height: 40 }} />
  const max = Math.max(...data, 100)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100
    const y = 100 - ((v - min) / range) * 80 - 10  // 預留上下 padding
    return `${x},${y}`
  }).join(' ')
  const gradId = `spark-grad-${color.replace('#', '')}`
  return (
    <svg width="100%" height="44" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// =====================================================
// SerpAndVitals（右側）— Google SERP 預覽 + Core Web Vitals
// =====================================================
function SerpAndVitals({ website, audit, loadTime }) {
  const url = website?.url || ''
  // 去掉 protocol + 結尾斜線，給 SERP URL 列顯示用
  const hostname = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const title = audit?.meta_tags?.titleContent || website?.name || hostname || '尚無標題'
  const description = audit?.meta_tags?.descriptionContent || '尚無 Meta 描述，建議於 <head> 加入 <meta name="description">。'
  const siteName = website?.name || hostname || '網站'

  // LCP：用 loadTime 近似（< 2.5s 通過、< 4s 警告、其他失敗）
  const lcpSec = loadTime ? loadTime / 1000 : null
  const lcpStatus = lcpSec === null ? null : (lcpSec < 2.5 ? 'pass' : 'fail')
  const lcpColor = lcpStatus === null ? T.textLow : (lcpStatus === 'pass' ? T.pass : T.fail)
  // 進度條填充比：以 4s 為滿格上限
  const lcpRatio = lcpSec === null ? 0 : Math.min(lcpSec / 4, 1)

  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* SERP 預覽 */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMid,
          letterSpacing: '.12em', marginBottom: 12,
        }}>GOOGLE SERP 預覽</div>
        <div style={{
          background: 'rgba(0,0,0,.4)', border: `1px solid ${T.cardBorder}`,
          borderRadius: 14, padding: 18,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: T.orange, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>
              {(siteName || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: T.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{siteName}</div>
              <div style={{
                fontSize: 11, color: T.textLow, fontFamily: T.mono,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{url || '—'}</div>
            </div>
          </div>
          <div style={{
            fontSize: 16, color: '#93c5fd', fontWeight: 600,
            marginBottom: 6, lineHeight: 1.35,
            // SERP 標題模擬 Google 藍字一行截斷
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{title}</div>
          <div style={{
            fontSize: 12, color: T.textMid, lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{description}</div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textMid,
          letterSpacing: '.12em', marginBottom: 12,
        }}>CORE WEB VITALS</div>
        <div className="seo-cwv-grid">
          <CWVMetric
            label="LCP"
            value={lcpSec !== null ? `${lcpSec.toFixed(1)}s` : '—'}
            target="目標 < 2.5s"
            status={lcpStatus}
            color={lcpColor}
            fillRatio={lcpRatio}
          />
          {/* INP / CLS：目前 analyzer 未量測，先以 — 顯示，避免假數據 */}
          <CWVMetric label="INP" value="—" target="目標 < 200ms" status={null} color={T.textLow} fillRatio={0} note="尚未量測" />
          <CWVMetric label="CLS" value="—" target="目標 < 0.10" status={null} color={T.textLow} fillRatio={0} note="尚未量測" />
        </div>
      </div>
    </div>
  )
}

// 單一 Core Web Vitals 指標格
function CWVMetric({ label, value, target, status, color, fillRatio, note }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: `1px solid ${status ? color + '33' : T.cardBorder}`,
      borderRadius: 12, padding: '14px 14px 12px', minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.textMid, letterSpacing: '.1em',
        }}>{label}</span>
        {status && (
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: status === 'pass' ? T.pass : T.fail, lineHeight: 1,
          }}>{status === 'pass' ? '✓' : '×'}</span>
        )}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: T.text,
        letterSpacing: '-.02em', marginBottom: 4, fontFamily: T.font, lineHeight: 1.1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textLow, marginBottom: 8 }}>
        {note ? `${target} · ${note}` : target}
      </div>
      <div style={{
        height: 4, background: 'rgba(255,255,255,.06)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(fillRatio * 100, 100)}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width .6s ease-out',
        }} />
      </div>
    </div>
  )
}

// =====================================================
// IssueBoard（看板式詳細檢測）— 4 個 lane：P1 / P2 / P3 / 已通過
// =====================================================
function IssueBoard({ checks, isPro }) {
  // 展開的 check id（一次只展開一張卡）
  const [expanded, setExpanded] = useState(null)
  const lanes = [
    { id: 'P1', title: '立即修復', sub: '1–2 週內',  c: T.fail, glow: 'rgba(239,68,68,.16)' },
    { id: 'P2', title: '本月內',   sub: '1–3 個月', c: T.warn, glow: 'rgba(245,158,11,.14)' },
    { id: 'P3', title: '季度規劃', sub: '3 個月後', c: ACCENT, glow: 'rgba(59,130,246,.14)' },
    { id: 'OK', title: '已通過',   sub: '維持現狀',  c: T.pass, glow: 'rgba(16,185,129,.12)' },
  ]
  const grouped = lanes.map(l => ({
    ...l,
    items: checks.filter(c => l.id === 'OK' ? c.passed : (!c.passed && c.priority === l.id)),
  }))
  return (
    <div className="seo-issue-board">
      {grouped.map(lane => (
        <IssueLane key={lane.id}
          lane={lane}
          expandedId={expanded}
          onToggle={(id) => setExpanded(expanded === id ? null : id)}
          isPro={isPro} />
      ))}
    </div>
  )
}

// 單一 lane（標頭 + 卡片清單）
function IssueLane({ lane, expandedId, onToggle, isPro }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)',
      border: `1px solid ${lane.c}33`,
      borderRadius: T.rL, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: `inset 0 1px 0 0 ${lane.glow}`,
    }}>
      {/* lane 標頭 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          padding: '4px 8px', borderRadius: 5,
          background: lane.c + '26', color: lane.c, border: `1px solid ${lane.c}55`,
        }}>{lane.id}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{lane.title}</div>
          <div style={{ fontSize: 10, color: T.textLow }}>{lane.sub}</div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, color: lane.c, fontFamily: T.font,
          minWidth: 22, textAlign: 'right',
        }}>{lane.items.length}</span>
      </div>

      {/* 卡片清單 */}
      {lane.items.length === 0 ? (
        <div style={{
          fontSize: 11, color: T.textLow, textAlign: 'center',
          padding: '20px 8px', border: `1px dashed ${T.cardBorder}`,
          borderRadius: 10, lineHeight: 1.55,
        }}>{lane.id === 'OK' ? '尚無通過項目' : '此優先度無待修項'}</div>
      ) : (
        lane.items.map(check => (
          <IssueCard key={check.id}
            check={check}
            lane={lane}
            isOpen={expandedId === check.id}
            onToggle={() => onToggle(check.id)}
            isPro={isPro} />
        ))
      )}
    </div>
  )
}

// 單一卡片：上半摘要可點擊展開、下半 FixPanel
function IssueCard({ check, lane, isOpen, onToggle, isPro }) {
  // 已通過 lane 不展開（沒修復內容）
  const canExpand = !check.passed
  return (
    <div style={{
      background: 'rgba(0,0,0,.35)',
      border: `1px solid ${isOpen ? lane.c + '88' : T.cardBorder}`,
      borderRadius: 12, overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        style={{
          all: 'unset',
          width: '100%', boxSizing: 'border-box',
          padding: 12, cursor: canExpand ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: 6,
          fontFamily: T.font,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{check.icon}</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: T.text,
            flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{check.name}</span>
          {canExpand && (
            <span style={{
              fontSize: 16, color: lane.c, lineHeight: 1,
              transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
              transition: 'transform .2s',
            }}>+</span>
          )}
        </div>
        {check.detail && (
          <div style={{
            fontSize: 11, color: T.textMid, lineHeight: 1.55,
            paddingLeft: 24,
          }}>{check.detail}</div>
        )}
      </button>

      {/* 展開後：Pro 看 FixPanel / Free 看鎖定 CTA */}
      {isOpen && canExpand && (
        <div className="seo-fix-panel" style={{
          borderTop: `1px solid ${lane.c}33`,
          background: 'rgba(255,255,255,.02)', padding: 14,
        }}>
          {isPro
            ? <IssueFixPanel check={check} lane={lane} />
            : <IssueLockCTA lane={lane} />}
        </div>
      )}
    </div>
  )
}

// Pro 用戶展開後：建議 + 平台別 tab + 步驟 + 程式碼
function IssueFixPanel({ check, lane }) {
  const guide = FIX_GUIDES[check.id]
  // 預設選第一個有資料的平台
  const availablePlatforms = guide
    ? PLATFORMS.filter(p => guide.platforms?.[p.id])
    : []
  const [activePlatform, setActivePlatform] = useState(availablePlatforms[0]?.id || 'html')
  const platformData = guide?.platforms?.[activePlatform]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 建議文案 */}
      <div style={{
        fontSize: 12, color: T.textMid, lineHeight: 1.7,
        padding: '10px 12px', background: 'rgba(255,255,255,.03)',
        border: `1px solid ${T.cardBorder}`, borderRadius: 8,
      }}>
        <span style={{ color: lane.c, fontWeight: 700 }}>建議：</span>
        {guide?.summary || check.recommendation}
      </div>

      {/* 平台別 tab */}
      {availablePlatforms.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availablePlatforms.map(p => (
              <button key={p.id} type="button"
                onClick={() => setActivePlatform(p.id)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  background: activePlatform === p.id ? lane.c + '22' : 'rgba(255,255,255,.03)',
                  color: activePlatform === p.id ? lane.c : T.textMid,
                  border: `1px solid ${activePlatform === p.id ? lane.c + '55' : T.cardBorder}`,
                  fontFamily: T.font, transition: 'all .15s',
                }}>{p.label}</button>
            ))}
          </div>

          {/* 步驟 */}
          {platformData?.steps && (
            <ol style={{
              margin: 0, paddingLeft: 22,
              fontSize: 12, color: T.textMid, lineHeight: 1.75,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {platformData.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}

          {/* 程式碼 */}
          {platformData?.code && (
            <pre style={{
              margin: 0, padding: 12, fontSize: 11, lineHeight: 1.6,
              background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
              borderRadius: 8, color: '#cbd5e1', fontFamily: T.mono,
              overflow: 'auto', whiteSpace: 'pre',
            }}>{platformData.code}</pre>
          )}
        </>
      )}

      {/* 沒有平台別資料時的 fallback */}
      {availablePlatforms.length === 0 && (
        <div style={{ fontSize: 11, color: T.textLow, fontStyle: 'italic' }}>
          目前無平台別操作步驟，可參考上方建議自行調整。
        </div>
      )}
    </div>
  )
}

// 免費用戶展開後：升級 CTA
function IssueLockCTA({ lane }) {
  return (
    <Link to="/pricing" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(0,0,0,.3)',
      border: `1px dashed ${lane.c}55`, borderRadius: 8,
      padding: '12px 14px', textDecoration: 'none',
      transition: 'all .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = lane.c + '12' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,.3)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>
          🔒 升級 Pro 解鎖修復指南
        </div>
        <div style={{ fontSize: 10, color: T.textLow, lineHeight: 1.5 }}>
          含 WordPress / Shopify / Wix / 自架 HTML 平台別操作步驟與程式碼
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 5,
        background: T.orange + '26', color: '#fdba74', whiteSpace: 'nowrap',
        border: `1px solid ${T.orange}40`,
      }}>升級 →</span>
    </Link>
  )
}

// =====================================================
// RoadmapPanel（P1/P2/P3 三段路線圖）
// =====================================================
function RoadmapPanel({ checks, isPro }) {
  const failedByPrio = {
    P1: checks.filter(c => !c.passed && c.priority === 'P1'),
    P2: checks.filter(c => !c.passed && c.priority === 'P2'),
    P3: checks.filter(c => !c.passed && c.priority === 'P3'),
  }

  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 26, position: 'relative',
    }}>
      {!isPro && <RoadmapLockOverlay />}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18,
        filter: isPro ? 'none' : 'blur(4px)', pointerEvents: isPro ? 'auto' : 'none',
      }}>
        <RoadmapColumn level="P1" tone={T.fail} title="立即修復"
          subtitle="本週內處理（影響最大）"
          items={failedByPrio.P1}
          fallback="P1 全部通過 — 基礎面已穩 ✓" />
        <RoadmapColumn level="P2" tone={T.warn} title="短期改善"
          subtitle="1–2 週內優化"
          items={failedByPrio.P2}
          fallback="P2 全部通過 — 內容結構良好 ✓" />
        <RoadmapColumn level="P3" tone={ACCENT} title="中期優化"
          subtitle="1–3 個月持續執行"
          items={failedByPrio.P3.length > 0 ? failedByPrio.P3 : []}
          extras={[
            { name: '建立內部連結結構', description: '讓 Google 爬蟲快速理解網站層級' },
            { name: '搭配 AEO Schema', description: 'JSON-LD 結構化資料提升 AI 引用率' },
            { name: '持續追蹤 GSC', description: '每月看一次關鍵字排名變化' },
          ]}
          fallback="" />
      </div>
    </div>
  )
}

function RoadmapColumn({ level, tone, title, subtitle, items = [], extras = [], fallback }) {
  const allItems = [...items, ...extras]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, fontSize: 11, fontWeight: 800,
          background: tone, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${tone}55`,
        }}>{level}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ fontSize: 11, color: T.textLow, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allItems.length === 0 ? (
          <div style={{
            fontSize: 12, color: T.pass, padding: '10px 12px',
            background: T.pass + '0d', border: `1px solid ${T.pass}28`, borderRadius: 7,
          }}>{fallback}</div>
        ) : (
          allItems.map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,.02)', border: `1px solid rgba(255,255,255,.06)`,
              borderRadius: 7, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ color: tone, fontSize: 13, lineHeight: 1.5, flexShrink: 0 }}>•</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: T.textLow, lineHeight: 1.5 }}>
                  {item.recommendation || item.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function RoadmapLockOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,6,10,.55)', backdropFilter: 'blur(6px)',
      borderRadius: T.rL, padding: 24,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 38, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          解鎖完整優化路線圖
        </div>
        <div style={{ fontSize: 13, color: T.textMid, marginBottom: 18, lineHeight: 1.7 }}>
          升級 Pro 取得依你網站現況量身排序的 P1 / P2 / P3 修復順序，搭配每項目的詳細修復步驟與程式碼。
        </div>
        <Link to="/pricing" style={{
          display: 'inline-block',
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          color: '#fff', fontSize: 13, fontWeight: 700,
          padding: '12px 24px', borderRadius: 9, textDecoration: 'none',
          boxShadow: `0 6px 18px ${ACCENT}55`, fontFamily: T.font,
        }}>升級 Pro 解鎖路線圖</Link>
      </div>
    </div>
  )
}

// =====================================================
// 載入骨架
// =====================================================
const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.04) 100%)',
  backgroundSize: '400% 100%', animation: 'shimmer 1.6s linear infinite', borderRadius: 6,
}

// Hero 雙欄載入骨架（左右各一張大卡）
function HeroSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24, minHeight: 320,
    }}>
      <div style={{ ...shimmerStyle, width: 120, height: 14, marginBottom: 18 }} />
      <div style={{ ...shimmerStyle, width: '85%', height: 14, marginBottom: 24 }} />
      <div style={{ ...shimmerStyle, width: '100%', height: 110, marginBottom: 18, borderRadius: 12 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ ...shimmerStyle, flex: 1, height: 56, borderRadius: 12 }} />
        <div style={{ ...shimmerStyle, flex: 1, height: 56, borderRadius: 12 }} />
      </div>
    </div>
  )
}

// IssueBoard 載入骨架（4 個 lane 假框）
function IssueBoardSkeleton() {
  return (
    <div className="seo-issue-board">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{
          background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
          borderRadius: T.rL, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ ...shimmerStyle, width: 32, height: 22, borderRadius: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...shimmerStyle, width: '60%', height: 12, marginBottom: 4 }} />
              <div style={{ ...shimmerStyle, width: '40%', height: 10 }} />
            </div>
          </div>
          <div style={{ ...shimmerStyle, width: '100%', height: 56, borderRadius: 12 }} />
          <div style={{ ...shimmerStyle, width: '100%', height: 56, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  )
}

// =====================================================
// PageBg：與首頁 HomeDark 同款 — 黑底 + 上方青綠漸層光暈 + 雜訊
// 註：頁面高度通常不及首頁，下方漸層會壓到上半部反而互蓋，故捨棄只保留上方
// =====================================================
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層光暈 — 從左上往中央漸隱至純黑（與首頁同款 155deg） */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒感疊層（與首頁同款雜訊） */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
