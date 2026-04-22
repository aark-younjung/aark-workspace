import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import FixGuide from '../components/FixGuide'

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
  const { isDark } = useTheme()
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? '' : 'bg-slate-50'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-black">載入資料中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? '' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/dashboard/${id}`} className="text-white/70 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">SEO 基本檢測</h1>
              <p className="text-white/80 text-sm">Search Engine Optimization — 搜尋引擎排名基礎優化</p>
              <p className="text-white/60 text-xs mt-1">{website?.url}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 總覽卡片 */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-lg font-semibold text-black mb-2">SEO 檢測得分</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {score}
                </span>
                <span className="text-gray-700">/ 100</span>
              </div>
              <p className="text-gray-700 mt-2">通過 {passedCount} / {SEO_CHECKS.length} 項檢測</p>
            </div>
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="mt-8">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        {/* 檢測項目列表 */}
        <div className="grid md:grid-cols-2 gap-6">
          {checks.map((check) => (
            <div
              key={check.id}
              className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                check.passed
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-red-200 bg-red-50/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{check.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-black">{check.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      check.passed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {check.passed ? '✓ 通過' : '✗ 未通過'}
                    </span>
                  </div>
                  <p className="text-sm text-black mb-2">{check.description}</p>
                  {check.detail && (
                    <p className={`text-xs font-medium mb-3 px-2 py-1 rounded ${
                      check.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {check.passed ? '✓ ' : '⚠ '}{check.detail}
                    </p>
                  )}
                  {!check.passed && (
                    isPro ? (
                      <FixGuide checkId={check.id} />
                    ) : (
                      <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-400 blur-sm select-none flex-1">升級 Pro 查看平台別修復指南升級 Pro 查看平台別修復指南</p>
                        <Link to="/pricing" className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">🔒 升級 Pro</Link>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SEO 優化路線圖 */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-black">🚀 SEO 優化路線圖</h3>
            {!isPro && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-semibold">Pro 功能</span>}
          </div>
          {isPro ? (
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  立即修復（本週）
                </h4>
                <ul className="space-y-2 text-sm text-black">
                  {!seoAudit?.meta_tags?.hasTitle && <li className="flex gap-2"><span className="text-red-500">•</span>補充 Meta 標題（影響最大）</li>}
                  {!seoAudit?.meta_tags?.hasDescription && <li className="flex gap-2"><span className="text-red-500">•</span>補充 Meta 描述（提升點擊率）</li>}
                  {!seoAudit?.mobile_compatible?.hasViewport && <li className="flex gap-2"><span className="text-red-500">•</span>加入 viewport meta 標籤</li>}
                  {seoAudit?.meta_tags?.hasTitle && seoAudit?.meta_tags?.hasDescription && seoAudit?.mobile_compatible?.hasViewport && (
                    <li className="flex gap-2 text-green-600"><span>✓</span>基礎項目已完成</li>
                  )}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  短期改善（1–2週）
                </h4>
                <ul className="space-y-2 text-sm text-black">
                  {!seoAudit?.h1_structure?.hasOnlyOneH1 && <li className="flex gap-2"><span className="text-amber-500">•</span>修正 H1 結構（每頁只留一個）</li>}
                  {(seoAudit?.alt_tags?.altCoverage ?? 100) < 80 && <li className="flex gap-2"><span className="text-amber-500">•</span>補充圖片 Alt 屬性（提升 AI 理解）</li>}
                  <li className="flex gap-2"><span className="text-amber-500">•</span>優化標題與描述的關鍵字密度</li>
                  <li className="flex gap-2"><span className="text-amber-500">•</span>建立 H2/H3 清楚的文章結構</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  中期優化（1–3月）
                </h4>
                <ul className="space-y-2 text-sm text-black">
                  {seoAudit?.page_speed?.loadTime > 3000 && <li className="flex gap-2"><span className="text-blue-500">•</span>優化載入速度（壓縮圖片、CDN）</li>}
                  <li className="flex gap-2"><span className="text-blue-500">•</span>建立內部連結結構</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span>搭配 AEO Schema 標記提升 AI 引用</li>
                  <li className="flex gap-2"><span className="text-blue-500">•</span>持續追蹤 GSC 關鍵字排名</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-700 text-sm mb-4">升級 Pro 方案，取得根據你網站現況量身訂製的 SEO 優化路線圖</p>
              <Link
                to={`/dashboard/${id}`}
                className="inline-block px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all"
              >
                🔒 升級 Pro 解鎖完整路線圖
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
