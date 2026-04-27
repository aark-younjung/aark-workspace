import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { useAuth } from '../context/AuthContext'
import FixGuide from '../components/FixGuide'
import { T } from '../styles/v2-tokens'

const ACCENT = T.seo
const ACCENT2 = '#06b6d4'

const PAGE_KEYFRAMES = `
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.92)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
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
  const speedGrade = seoAudit?.page_speed?.speedGrade
  const firstFail = checks.find(c => !c.passed)

  // 速度顏色：< 1.5s 綠 / < 3s 黃 / 其他紅
  const speedColor = !loadTime ? T.textLow : (loadTime < 1500 ? T.pass : loadTime < 3000 ? T.warn : T.fail)

  return (
    <>
      <style>{PAGE_KEYFRAMES}</style>
      <PageBg>
        <div className="relative z-10">
          {/* 返回連結 — 無頁首玻璃條，純 link 處理 */}
          <header style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 0' }}>
            <Link to={`/dashboard/${id}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: T.textMid, textDecoration: 'none', fontFamily: T.font,
            }}>← 返回 Dashboard</Link>
          </header>

          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>

            {/* ── Header：小寫追蹤碼 + H1 + 描述 ───────────── */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.12em',
                  color: ACCENT, textTransform: 'uppercase',
                }}>SEO · 技術檢測</span>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.textLow }}></span>
                <span style={{ fontSize: 11, color: T.textLow }}>Search Engine Optimization 排名基礎</span>
              </div>
              <h1 style={{
                fontSize: 34, fontWeight: 800, color: T.text, letterSpacing: '-.02em',
                marginBottom: 8, lineHeight: 1.15,
              }}>SEO 基本檢測</h1>
              <p style={{ fontSize: 15, color: T.textMid, lineHeight: 1.7, maxWidth: 680, marginBottom: 12 }}>
                檢測網站的 6 個 SEO 基本面：標題、描述、H1、圖片 Alt、行動裝置相容、載入速度 — 這些是 Google 與 AI 願不願意「讀懂你」的最低門檻。
              </p>
              {website?.url && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontSize: 12, color: T.textLow, fontFamily: T.mono,
                  background: 'rgba(0,6,10,.6)', border: `1px solid ${T.cardBorder}`,
                  padding: '6px 12px', borderRadius: 8,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: ACCENT,
                    boxShadow: `0 0 8px ${ACCENT}`,
                  }} />
                  {website.url}
                </div>
              )}
            </div>

            {/* ── 區塊 1：4 張 KPI 卡 ───────────────────── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14, marginBottom: 32,
            }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <OverviewSkeleton key={i} />)
              ) : (
                <>
                  <OverviewCard icon="🎯" label="SEO 總分" value={score} suffix=" / 100"
                    sub={`整體通過率 ${Math.round(passedCount / SEO_CHECKS.length * 100)}%`}
                    color={ACCENT} highlight />
                  <OverviewCard icon="✅" label="通過項目" value={passedCount} suffix={` / ${SEO_CHECKS.length}`}
                    sub={passedCount === SEO_CHECKS.length ? '全部達標 🎉' : `${SEO_CHECKS.length - passedCount} 項可再優化`}
                    color={T.pass} />
                  <OverviewCard icon="⚠️" label="待修復" value={failedCount} suffix=" 項"
                    sub={firstFail ? `首要：${firstFail.name}` : '目前無待修項目'}
                    color={failedCount > 0 ? T.fail : T.textMid} />
                  <OverviewCard icon="⚡" label="載入速度"
                    value={loadTime ? loadTime : '—'}
                    suffix={loadTime ? ' ms' : ''}
                    sub={speedGrade ? `等級 ${speedGrade}` : '尚未量測'}
                    color={speedColor} />
                </>
              )}
            </div>

            {/* ── 區塊 2：重新檢測 CTA banner ─────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18,
              background: `linear-gradient(135deg, ${ACCENT}1c, ${ACCENT2}10)`,
              border: `1px solid ${ACCENT}3a`,
              borderRadius: T.rL, padding: '20px 26px', marginBottom: 32, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 280 }}>
                <div style={{
                  width: 54, height: 54, borderRadius: 14,
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: `0 6px 20px ${ACCENT}55`,
                }}>
                  <span style={{ fontSize: 26 }}>🔄</span>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>重新執行檢測</div>
                  <div style={{ fontSize: 13, color: T.textMid }}>
                    重新對 {website?.url || '此網站'} 跑一次 SEO 6 項檢測 · 約耗時 8–12 秒
                  </div>
                </div>
              </div>
              <button onClick={handleReanalyze} disabled={analyzing}
                style={{
                  fontSize: 14, padding: '12px 24px', whiteSpace: 'nowrap',
                  border: 'none', borderRadius: 10, fontWeight: 700, fontFamily: T.font,
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: '#fff',
                  boxShadow: `0 2px 16px ${ACCENT}55`,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  opacity: analyzing ? 0.5 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                {analyzing && (
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff',
                    animation: 'spin .7s linear infinite',
                  }} />
                )}
                {analyzing ? '分析中…' : '🚀 立即重新檢測'}
              </button>
            </div>

            {/* ── 區塊 3：6 項詳細檢測 ─────────────────── */}
            <SectionTitle title="詳細檢測項目" sub={`SEO 6 項基本面，每項標示 P1/P2/P3 優先度`} />
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 14, marginBottom: 32,
            }}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <CheckSkeleton key={i} />)
              ) : (
                checks.map(check => (
                  <CheckCard key={check.id} check={check} isPro={isPro} />
                ))
              )}
            </div>

            {/* ── 區塊 4：優化路線圖 ─────────────────── */}
            <SectionTitle title="SEO 優化路線圖" sub="按 P1 → P2 → P3 三階段執行，每階段對應的時程與重點" />
            <RoadmapPanel checks={checks} isPro={isPro} />
          </div>
        </div>
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
// OverviewCard（KPI 卡）— 沿用 aivis 設計語言
// =====================================================
function OverviewCard({ icon, label, value, sub, color, prefix = '', suffix = '', highlight }) {
  return (
    <div style={{
      background: highlight
        ? `linear-gradient(155deg, ${color}1c 0%, rgba(1,8,14,.65) 70%)`
        : 'rgba(1,8,14,.6)',
      border: highlight ? `1px solid ${color}55` : `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: '18px 18px 16px', position: 'relative',
      boxShadow: highlight ? `0 8px 24px ${color}18` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: T.textMid, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {prefix && <span style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>{prefix}</span>}
        <span style={{
          fontSize: 30, fontWeight: 800, color, letterSpacing: '-.02em',
          textShadow: highlight ? `0 0 24px ${color}55` : 'none', fontFamily: T.font,
        }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 11, color: T.textLow, marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </div>
  )
}

// =====================================================
// CheckCard（單一檢測項目）— 通過 / 未通過 / Pro 鎖定
// =====================================================
function CheckCard({ check, isPro }) {
  const statusColor = check.passed ? T.pass : T.fail
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)',
      border: `1px solid ${check.passed ? T.cardBorder : statusColor + '38'}`,
      borderRadius: T.rL, padding: 18, position: 'relative',
      boxShadow: check.passed ? 'none' : `0 0 0 1px ${statusColor}14`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 標頭：icon + name + 狀態 chip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, fontSize: 20, flexShrink: 0,
          background: 'rgba(255,255,255,.04)',
          border: `1px solid ${T.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{check.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{check.name}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
              padding: '2px 6px', borderRadius: 4,
              background: priorityBg(check.priority), color: priorityFg(check.priority),
              border: `1px solid ${priorityFg(check.priority)}40`,
            }}>{check.priority}</span>
          </div>
          <div style={{ fontSize: 11, color: T.textLow, lineHeight: 1.55 }}>{check.description}</div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 5,
          background: statusColor + '1f', color: check.passed ? '#86efac' : '#fca5a5',
          border: `1px solid ${statusColor}40`, whiteSpace: 'nowrap', flexShrink: 0,
        }}>{check.passed ? '✓ 通過' : '✗ 未通過'}</span>
      </div>

      {/* 詳情條 */}
      {check.detail && (
        <div style={{
          fontSize: 12, color: check.passed ? '#86efac' : '#fca5a5',
          background: statusColor + '12',
          border: `1px solid ${statusColor}28`,
          padding: '8px 12px', borderRadius: 7, marginBottom: 10, lineHeight: 1.55,
          fontFamily: T.mono,
        }}>
          {check.passed ? '✓ ' : '⚠ '}{check.detail}
        </div>
      )}

      {/* 未通過時：Pro 看到 FixGuide / Free 看到鎖定提示 */}
      {!check.passed && (isPro ? (
        <div style={{
          background: 'rgba(255,255,255,.02)', border: `1px solid ${T.cardBorder}`,
          borderRadius: 8, padding: '4px 4px 8px 4px', marginTop: 'auto',
        }}>
          <FixGuide checkId={check.id} />
        </div>
      ) : (
        <ProLockChip />
      ))}
    </div>
  )
}

function ProLockChip() {
  return (
    <Link to="/pricing" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      background: 'rgba(255,255,255,.03)', border: `1px dashed ${T.cardBorder}`,
      borderRadius: 8, padding: '10px 12px', textDecoration: 'none', marginTop: 'auto',
      transition: 'all .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange + '88'; e.currentTarget.style.background = T.orange + '08' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.cardBorder; e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}>
      <span style={{ fontSize: 11, color: T.textLow }}>升級 Pro 看平台別修復指南（WordPress / Shopify / Wix…）</span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 5,
        background: T.orange + '26', color: '#fdba74', whiteSpace: 'nowrap',
      }}>🔒 升級 Pro</span>
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

function OverviewSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: '18px 18px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ ...shimmerStyle, width: 18, height: 18, borderRadius: 4 }} />
        <div style={{ ...shimmerStyle, width: 80, height: 11 }} />
      </div>
      <div style={{ ...shimmerStyle, width: '70%', height: 30, marginBottom: 10 }} />
      <div style={{ ...shimmerStyle, width: '90%', height: 11 }} />
    </div>
  )
}

function CheckSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 18,
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ ...shimmerStyle, width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmerStyle, width: '60%', height: 14, marginBottom: 6 }} />
          <div style={{ ...shimmerStyle, width: '90%', height: 11 }} />
        </div>
      </div>
      <div style={{ ...shimmerStyle, width: '100%', height: 32, borderRadius: 7 }} />
    </div>
  )
}

// =====================================================
// 工具：P1/P2/P3 配色
// =====================================================
function priorityBg(p) {
  if (p === 'P1') return T.fail + '1f'
  if (p === 'P2') return T.warn + '1f'
  return ACCENT + '1f'
}
function priorityFg(p) {
  if (p === 'P1') return '#fca5a5'
  if (p === 'P2') return '#fcd34d'
  return '#93c5fd'
}

// =====================================================
// PageBg：暗色青綠頂部漸層 + 雜訊
// =====================================================
function PageBg({ children }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)' }}
    >
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
