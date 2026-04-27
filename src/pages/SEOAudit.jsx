import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { useAuth } from '../context/AuthContext'
import FixGuide from '../components/FixGuide'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

const SEO_CHECKS = [
  {
    id: 'meta_title',
    name: 'Meta 標題',
    description: '頁面標題是搜尋結果的第一印象，建議長度 30–60 字，包含主要關鍵字',
    icon: '🏷️',
    recommendation: '在 <head> 加入 <title>頁面主題 | 品牌名稱</title>，長度控制在 30–60 字，將目標關鍵字放在前半段',
    getValue: (audit) => {
      const content = audit?.meta_tags?.titleContent
      const len = content?.length || 0
      if (!content) return { passed: false, detail: '未設置 Meta 標題' }
      if (len < 30) return { passed: false, detail: `標題過短（${len} 字），建議至少 30 字` }
      if (len > 60) return { passed: false, detail: `標題過長（${len} 字），建議縮短至 60 字以內` }
      return { passed: true, detail: `「${content.length > 35 ? content.substring(0, 35) + '...' : content}」（${len} 字）` }
    }
  },
  {
    id: 'meta_desc',
    name: 'Meta 描述',
    description: 'Meta 描述出現在搜尋結果摘要，好的描述能提升點擊率（CTR），建議 70–155 字',
    icon: '📝',
    recommendation: '在 <head> 加入 <meta name="description" content="...">，自然帶入關鍵字，並以行動呼籲結尾，長度 70–155 字',
    getValue: (audit) => {
      const content = audit?.meta_tags?.descriptionContent
      const len = content?.length || 0
      if (!content) return { passed: false, detail: '未設置 Meta 描述' }
      if (len < 70) return { passed: false, detail: `描述過短（${len} 字），建議至少 70 字` }
      if (len > 155) return { passed: false, detail: `描述過長（${len} 字），超過搜尋結果顯示上限` }
      return { passed: true, detail: `${len} 字，長度符合建議範圍` }
    }
  },
  {
    id: 'h1_structure',
    name: 'H1 標題結構',
    description: 'H1 是頁面最重要的標題，Google 與 AI 依靠 H1 理解頁面主題。每頁應只有一個 H1',
    icon: '📖',
    recommendation: '確保頁面只有一個 H1 標籤，清楚說明頁面核心主題，並自然包含目標關鍵字',
    getValue: (audit) => {
      const count = audit?.h1_structure?.h1Count ?? 0
      const content = audit?.h1_structure?.h1Content
      if (count === 0) return { passed: false, detail: '頁面沒有 H1 標題' }
      if (count > 1) return { passed: false, detail: `頁面有 ${count} 個 H1 標題，應只有 1 個` }
      return { passed: true, detail: `「${content?.length > 35 ? content.substring(0, 35) + '...' : content}」` }
    }
  },
  {
    id: 'alt_tags',
    name: '圖片 Alt 屬性',
    description: 'Alt 屬性讓 Google 和 AI 理解圖片內容，同時幫助視障用戶，覆蓋率建議 ≥ 80%',
    icon: '🖼️',
    recommendation: '為每張圖片加入描述性的 alt 文字（例如 alt="2024年台北辦公室外觀"），避免空白或通用描述如 alt="圖片"',
    getValue: (audit) => {
      const total = audit?.alt_tags?.totalImages ?? 0
      const coverage = audit?.alt_tags?.altCoverage ?? 100
      const missing = audit?.alt_tags?.imagesWithoutAlt ?? 0
      if (total === 0) return { passed: true, detail: '頁面無圖片，無需設置' }
      if (coverage < 80) return { passed: false, detail: `${total} 張圖片中 ${missing} 張缺少 Alt（覆蓋率 ${coverage}%）` }
      return { passed: true, detail: `${total} 張圖片，覆蓋率 ${coverage}%` }
    }
  },
  {
    id: 'mobile_compatible',
    name: '行動裝置相容',
    description: 'Google 採用行動優先索引（Mobile-First Indexing），未設置 viewport 的網站排名會受影響',
    icon: '📱',
    recommendation: '在 <head> 加入 <meta name="viewport" content="width=device-width, initial-scale=1">，並確認網站在手機上版面正常',
    getValue: (audit) => {
      const hasViewport = audit?.mobile_compatible?.hasViewport
      if (!hasViewport) return { passed: false, detail: '未設置 viewport meta 標籤' }
      return { passed: true, detail: 'viewport 已設置，支援行動裝置' }
    }
  },
  {
    id: 'page_speed',
    name: '頁面載入速度',
    description: '頁面速度是 Google 排名因素之一，也直接影響跳出率。建議伺服器回應時間 < 3 秒',
    icon: '⚡',
    recommendation: '壓縮圖片（使用 WebP 格式）、啟用瀏覽器快取、使用 CDN、移除不必要的 JavaScript 可大幅提升速度',
    getValue: (audit) => {
      const loadTime = audit?.page_speed?.loadTime
      const grade = audit?.page_speed?.speedGrade
      if (!loadTime) return { passed: false, detail: '無法測量載入速度' }
      if (loadTime > 3000) return { passed: false, detail: `${loadTime}ms（${grade}），超過 3 秒建議值` }
      return { passed: true, detail: `${loadTime}ms（${grade}）` }
    }
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

  const fetchData = async () => {
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

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeSEO(website.url)
      await supabase.from('seo_audits').insert([{
        website_id: id,
        score: result.score,
        meta_tags: result.meta_tags,
        h1_structure: result.h1_structure,
        alt_tags: result.alt_tags,
        mobile_compatible: result.mobile_compatible,
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
  const score = seoAudit?.score ?? Math.round((passedCount / SEO_CHECKS.length) * 100)

  if (loading) {
    return (
      <PageBg>
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.seo }}></div>
            <p style={{ color: T.textMid }}>載入資料中...</p>
          </div>
        </div>
      </PageBg>
    )
  }

  return (
    <PageBg>
      <div className="relative z-10">
        {/* Header — 暗色玻璃條 + SEO 藍色 accent 細條 */}
        <header className="border-b backdrop-blur-xl" style={{ borderColor: T.cardBorder, background: 'rgba(0,0,0,0.5)' }}>
          {/* 頂部色條 — 強化四大面向辨識 */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${T.seo}, #06b6d4)` }} />
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Link to={`/dashboard/${id}`} className="transition-colors hover:opacity-80" style={{ color: T.textMid }} aria-label="返回 Dashboard">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: T.text }}>SEO 基本檢測</h1>
                <p className="text-sm" style={{ color: T.textMid }}>Search Engine Optimization — 搜尋引擎排名基礎優化</p>
                <p className="text-xs mt-1" style={{ color: T.textLow }}>{website?.url}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* 總覽分數卡 */}
          <GlassCard color={T.seo} style={{ padding: 32, marginBottom: 32 }}>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: T.text }}>SEO 檢測得分</h2>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-5xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${T.seo}, #06b6d4)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >{score}</span>
                  <span style={{ color: T.textMid }}>/ 100</span>
                </div>
                <p className="mt-2" style={{ color: T.textMid }}>通過 {passedCount} / {SEO_CHECKS.length} 項檢測</p>
              </div>
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="px-6 py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${T.seo}, #06b6d4)`,
                  boxShadow: `0 8px 24px ${T.seo}40`,
                }}
              >
                {analyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    分析中...
                  </>
                ) : '重新檢測'}
              </button>
            </div>
            {/* 進度條 */}
            <div className="mt-8">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${T.seo}, #06b6d4)` }}
                />
              </div>
            </div>
          </GlassCard>

          {/* 檢測項目列表 */}
          <div className="grid md:grid-cols-2 gap-6">
            {checks.map((check) => (
              <GlassCard key={check.id} color={check.passed ? T.pass : T.fail} style={{ padding: 24 }}>
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{check.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h3 className="font-semibold" style={{ color: T.text }}>{check.name}</h3>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          background: (check.passed ? T.pass : T.fail) + '26',
                          color: check.passed ? '#86efac' : '#fca5a5',
                        }}
                      >
                        {check.passed ? '✓ 通過' : '✗ 未通過'}
                      </span>
                    </div>
                    <p className="text-sm mb-2" style={{ color: T.textMid }}>{check.description}</p>
                    {check.detail && (
                      <p
                        className="text-xs font-medium mb-3 px-2 py-1 rounded inline-block"
                        style={{
                          background: (check.passed ? T.pass : T.fail) + '1a',
                          color: check.passed ? '#86efac' : '#fca5a5',
                        }}
                      >
                        {check.passed ? '✓ ' : '⚠ '}{check.detail}
                      </p>
                    )}
                    {!check.passed && (
                      isPro ? (
                        <FixGuide checkId={check.id} />
                      ) : (
                        <div
                          className="p-3 rounded-lg flex items-center justify-between gap-3"
                          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}` }}
                        >
                          <p className="text-xs blur-sm select-none flex-1" style={{ color: T.textLow }}>升級 Pro 查看平台別修復指南升級 Pro 查看平台別修復指南</p>
                          <Link
                            to="/pricing"
                            className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 hover:opacity-80"
                            style={{ background: T.orange + '26', color: '#fdba74' }}
                          >🔒 升級 Pro</Link>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* SEO 優化路線圖 */}
          <div className="mt-8">
            <GlassCard color={T.seo} style={{ padding: 32 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold" style={{ color: T.text }}>🚀 SEO 優化路線圖</h3>
                {!isPro && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: T.orange + '26', color: '#fdba74' }}
                  >Pro 功能</span>
                )}
              </div>
              {isPro ? (
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: T.text }}>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: T.fail }}
                      >1</span>
                      立即修復（本週）
                    </h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      {!seoAudit?.meta_tags?.hasTitle && <li className="flex gap-2"><span style={{ color: T.fail }}>•</span>補充 Meta 標題（影響最大）</li>}
                      {!seoAudit?.meta_tags?.hasDescription && <li className="flex gap-2"><span style={{ color: T.fail }}>•</span>補充 Meta 描述（提升點擊率）</li>}
                      {!seoAudit?.mobile_compatible?.hasViewport && <li className="flex gap-2"><span style={{ color: T.fail }}>•</span>加入 viewport meta 標籤</li>}
                      {seoAudit?.meta_tags?.hasTitle && seoAudit?.meta_tags?.hasDescription && seoAudit?.mobile_compatible?.hasViewport && (
                        <li className="flex gap-2" style={{ color: T.pass }}><span>✓</span>基礎項目已完成</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: T.text }}>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: T.warn }}
                      >2</span>
                      短期改善（1–2週）
                    </h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      {!seoAudit?.h1_structure?.hasOnlyOneH1 && <li className="flex gap-2"><span style={{ color: T.warn }}>•</span>修正 H1 結構（每頁只留一個）</li>}
                      {(seoAudit?.alt_tags?.altCoverage ?? 100) < 80 && <li className="flex gap-2"><span style={{ color: T.warn }}>•</span>補充圖片 Alt 屬性（提升 AI 理解）</li>}
                      <li className="flex gap-2"><span style={{ color: T.warn }}>•</span>優化標題與描述的關鍵字密度</li>
                      <li className="flex gap-2"><span style={{ color: T.warn }}>•</span>建立 H2/H3 清楚的文章結構</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: T.text }}>
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: T.seo }}
                      >3</span>
                      中期優化（1–3月）
                    </h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      {seoAudit?.page_speed?.loadTime > 3000 && <li className="flex gap-2"><span style={{ color: T.seo }}>•</span>優化載入速度（壓縮圖片、CDN）</li>}
                      <li className="flex gap-2"><span style={{ color: T.seo }}>•</span>建立內部連結結構</li>
                      <li className="flex gap-2"><span style={{ color: T.seo }}>•</span>搭配 AEO Schema 標記提升 AI 引用</li>
                      <li className="flex gap-2"><span style={{ color: T.seo }}>•</span>持續追蹤 GSC 關鍵字排名</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm mb-4" style={{ color: T.textMid }}>升級 Pro 方案，取得根據你網站現況量身訂製的 SEO 優化路線圖</p>
                  <Link
                    to="/pricing"
                    className="inline-block px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${T.seo}, #06b6d4)`,
                      boxShadow: `0 8px 24px ${T.seo}40`,
                    }}
                  >
                    🔒 升級 Pro 解鎖完整路線圖
                  </Link>
                </div>
              )}
            </GlassCard>
          </div>
        </main>
      </div>
    </PageBg>
  )
}

// 共用的暗色背景 wrapper（青綠頂部漸層 + 雜訊疊層）
function PageBg({ children }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)' }}
    >
      {/* 雜訊疊層 — 與 HomeDark / Login 一致 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
