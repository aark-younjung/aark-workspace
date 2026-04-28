import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import {
  AuditTopBar, ScoreHero, HeroSkeleton,
  IssueBoard, IssueBoardSkeleton, SerpAndVitals,
} from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const ACCENT = T.seo
const ACCENT2 = '#06b6d4'

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

  return (
    <PageBg>
      <SiteHeader />
      <div className="relative z-10">
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>

          {/* 頂部麵包屑列：返回 Dashboard + 重新檢測 + 匯出 PDF */}
          <AuditTopBar
            websiteId={id}
            face="SEO"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={ACCENT}
            accent2={ACCENT2}
          />

          {/* 兩欄 Hero：左 ScoreHero（分數圈 + 趨勢） + 右 SerpAndVitals（SERP 預覽 + Core Web Vitals） */}
          <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
            {loading ? (
              <>
                <HeroSkeleton />
                <HeroSkeleton />
              </>
            ) : (
              <>
                <ScoreHero
                  face="SEO"
                  subChip="技術檢測"
                  tagline="傳統搜尋排名 — AI 爬蟲評估頁面品質的基礎"
                  score={score}
                  passedCount={passedCount}
                  failedCount={failedCount}
                  total={SEO_CHECKS.length}
                  recentAudits={recentAudits}
                  accent={ACCENT}
                />
                <SerpAndVitals
                  website={website}
                  audit={seoAudit}
                  loadTime={loadTime}
                />
              </>
            )}
          </div>

          {/* 詳細檢測項目（看板式 IssueBoard） */}
          <SectionTitle title="詳細檢測項目" sub="依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟" />
          <div style={{ marginBottom: 32 }}>
            {loading ? (
              <IssueBoardSkeleton />
            ) : (
              <IssueBoard checks={checks} isPro={isPro} accent={ACCENT} accentGlow={`${ACCENT}28`} />
            )}
          </div>

          {/* 優化路線圖（SEO 專屬，三段 P1/P2/P3） */}
          <SectionTitle title="SEO 優化路線圖" sub="按 P1 → P2 → P3 三階段執行，每階段對應的時程與重點" />
          <RoadmapPanel checks={checks} isPro={isPro} />
        </main>
      </div>
      <Footer dark />
    </PageBg>
  )
}

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

// SEO 專屬：P1/P2/P3 三段優化路線圖（其他面向頁不需要這塊）
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

// 共用暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 上方青綠漸層 + 雜訊）
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
