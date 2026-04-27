import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { useAuth } from '../context/AuthContext'
import FixGuide from '../components/FixGuide'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

const AEO_CHECKS = [
  {
    id: 'json_ld',
    name: 'JSON-LD 結構化資料',
    description: '驗證網頁是否包含 schema.org JSON-LD 標記（特別是 FAQ/HowTo），幫助 Google 理解內容結構',
    icon: '📋',
    recommendation: '使用 schema.org 標準添加 JSON-LD 標記，至少包含 WebSite 或 Organization schema'
  },
  {
    id: 'faq_schema',
    name: 'FAQ Schema',
    description: '檢測是否含有 FAQPage 或 QAPage 類型的結構化資料，直接影響 Google 精選摘要呈現',
    icon: '❓',
    recommendation: '為常見問題區塊添加 FAQPage schema，每個 Q&A 需包含 Question 和 Answer 節點'
  },
  {
    id: 'canonical',
    name: 'Canonical 標籤',
    description: '驗證 canonical 標籤是否正確設置，防止重複內容影響精選摘要排名',
    icon: '🔒',
    recommendation: '在所有頁面 <head> 設置正確的 <link rel="canonical" href="..."> 標籤'
  },
  {
    id: 'breadcrumbs',
    name: '麵包屑導航',
    description: '檢測 BreadcrumbList schema，幫助 Google 理解網站層級結構並在搜尋結果中顯示路徑',
    icon: '🍞',
    recommendation: '使用 schema.org BreadcrumbList 標記網站導航層級'
  },
  {
    id: 'open_graph',
    name: 'Open Graph',
    description: '驗證 Open Graph 標籤（og:title、og:description、og:image、og:url），影響 Google 搜尋預覽品質',
    icon: '🔗',
    recommendation: '添加完整的 og:title, og:description, og:image, og:url 四項標籤'
  },
  {
    id: 'question_headings',
    name: 'H2/H3 問句式標題',
    description: '檢測 H2/H3 標題是否以問句形式呈現，問答式內容更容易被 Google 選為精選摘要',
    icon: '💬',
    recommendation: '將部分 H2/H3 標題改為問句格式（例如「什麼是...？」「如何...？」）'
  },
  {
    id: 'meta_desc_length',
    name: 'Meta 描述長度',
    description: '檢測 Meta 描述是否在 120-160 字元範圍內，精簡描述更容易出現在 Google 精選摘要',
    icon: '📝',
    recommendation: '將 Meta 描述控制在 120-160 字元，簡潔說明頁面核心內容'
  },
  {
    id: 'structured_answer',
    name: '結構化答案段落',
    description: '檢測頁面是否包含清楚的問答格式內容（FAQ 區塊、問句段落、details/summary 元素）',
    icon: '📖',
    recommendation: '在頁面中加入 FAQ 區塊，或使用 Q&A 格式撰寫內容，首段直接給出答案'
  }
]

export default function AEOAudit() {
  const { id } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)

      const { data: aeoData } = await supabase
        .from('aeo_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).single()
      setAeoAudit(aeoData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheckStatus = (checkId) => {
    if (!aeoAudit) return 'unknown'
    return aeoAudit[checkId] ? 'pass' : 'fail'
  }

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeAEO(website.url)
      await supabase.from('aeo_audits').insert([{
        website_id: id,
        score: result.score,
        json_ld: result.json_ld,
        faq_schema: result.faq_schema,
        canonical: result.canonical,
        breadcrumbs: result.breadcrumbs,
        open_graph: result.open_graph,
        question_headings: result.question_headings,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  const passedCount = AEO_CHECKS.filter(check => getCheckStatus(check.id) === 'pass').length
  const totalCount = AEO_CHECKS.length
  const score = Math.round((passedCount / totalCount) * 100)

  if (loading) {
    return (
      <PageBg>
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.aeo }}></div>
            <p style={{ color: T.textMid }}>載入資料中...</p>
          </div>
        </div>
      </PageBg>
    )
  }

  return (
    <PageBg>
      <div className="relative z-10">
        {/* Header — 暗色玻璃條 + AEO 紫色 accent 細條 */}
        <header className="border-b backdrop-blur-xl" style={{ borderColor: T.cardBorder, background: 'rgba(0,0,0,0.5)' }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${T.aeo}, #6366f1)` }} />
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Link to={`/dashboard/${id}`} className="transition-colors hover:opacity-80" style={{ color: T.textMid }} aria-label="返回 Dashboard">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: T.text }}>AEO 技術檢測</h1>
                <p className="text-sm" style={{ color: T.textMid }}>Answer Engine Optimization — 傳統 Google 問答優化</p>
                <p className="text-xs mt-1" style={{ color: T.textLow }}>{website?.url}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* 總覽分數卡 */}
          <GlassCard color={T.aeo} style={{ padding: 32, marginBottom: 32 }}>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: T.text }}>AEO 技術檢測得分</h2>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-5xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${T.aeo}, #6366f1)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >{score}</span>
                  <span style={{ color: T.textMid }}>/ 100</span>
                </div>
                <p className="mt-2" style={{ color: T.textMid }}>通過 {passedCount} / {totalCount} 項檢測</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReanalyze}
                  disabled={analyzing}
                  className="px-6 py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${T.aeo}, #6366f1)`,
                    boxShadow: `0 8px 24px ${T.aeo}40`,
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
            </div>

            {/* 進度條 */}
            <div className="mt-8">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${T.aeo}, #6366f1)` }}
                />
              </div>
            </div>
          </GlassCard>

          {/* 檢測項目列表 */}
          <div className="grid md:grid-cols-2 gap-6">
            {AEO_CHECKS.map((check) => {
              const status = getCheckStatus(check.id)
              const statusColor = status === 'pass' ? T.pass : status === 'fail' ? T.fail : null
              return (
                <GlassCard key={check.id} color={statusColor} style={{ padding: 24 }}>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{check.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className="font-semibold" style={{ color: T.text }}>{check.name}</h3>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{
                            background: status === 'pass' ? T.pass + '26' : status === 'fail' ? T.fail + '26' : 'rgba(255,255,255,0.06)',
                            color: status === 'pass' ? '#86efac' : status === 'fail' ? '#fca5a5' : T.textMid,
                          }}
                        >
                          {status === 'pass' ? '✓ 通過' : status === 'fail' ? '✗ 未通過' : '⏳ 未知'}
                        </span>
                      </div>
                      <p className="text-sm mb-4" style={{ color: T.textMid }}>{check.description}</p>

                      {status === 'fail' && (
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
              )
            })}
          </div>

          {/* AI 搜尋優化建議 */}
          <div className="mt-8">
            <GlassCard color={T.aeo} style={{ padding: 32 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold" style={{ color: T.text }}>🚀 AI 搜尋優化建議</h3>
                {!isPro && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-semibold"
                    style={{ background: T.orange + '26', color: '#fdba74' }}
                  >Pro 功能</span>
                )}
              </div>
              {isPro ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>補齊所有缺少的 Open Graph 標籤</li>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>建立網站的 LLMs.txt 檔案</li>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>修復 canonical 標籤問題</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>建立完整的 JSON-LD 結構化資料</li>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>為常見問題頁面添加 FAQ Schema</li>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>優化麵包屑導航結構</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm mb-4" style={{ color: T.textMid }}>升級 Pro 方案，取得根據你網站現況量身訂製的優化路線圖</p>
                  <Link
                    to="/pricing"
                    className="inline-block px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${T.aeo}, #6366f1)`,
                      boxShadow: `0 8px 24px ${T.aeo}40`,
                    }}
                  >
                    🔒 升級 Pro 解鎖完整建議
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
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
