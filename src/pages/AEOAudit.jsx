import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeAEO } from '../services/aeoAnalyzer'

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
  const [website, setWebsite] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites')
        .select('*')
        .eq('id', id)
        .single()
      
      setWebsite(websiteData)

      const { data: aeoData } = await supabase
        .from('aeo_audits')
        .select('*')
        .eq('website_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">載入資料中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/dashboard/${id}`} className="text-white/70 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">AEO 技術檢測</h1>
              <p className="text-white/80 text-sm">Answer Engine Optimization — 傳統 Google 問答優化</p>
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
              <h2 className="text-lg font-semibold text-slate-700 mb-2">AEO 技術檢測得分</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {score}
                </span>
                <span className="text-slate-500">/ 100</span>
              </div>
              <p className="text-slate-500 mt-2">
                通過 {passedCount} / {totalCount} 項檢測
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <button className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium">
                匯出報告
              </button>
            </div>
          </div>

          {/* 進度條 */}
          <div className="mt-8">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        {/* 檢測項目列表 */}
        <div className="grid md:grid-cols-2 gap-6">
          {AEO_CHECKS.map((check) => {
            const status = getCheckStatus(check.id)
            
            return (
              <div 
                key={check.id}
                className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                  status === 'pass' 
                    ? 'border-green-200 bg-green-50/30' 
                    : status === 'fail'
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-slate-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{check.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-800">{check.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        status === 'pass' 
                          ? 'bg-green-100 text-green-700' 
                          : status === 'fail'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {status === 'pass' ? '✓ 通過' : status === 'fail' ? '✗ 未通過' : '⏳ 未知'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{check.description}</p>
                    
                    {status === 'fail' && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 mb-1">💡 建議優化</p>
                        <p className="text-sm text-blue-600">{check.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* AI 搜尋優化建議 */}
        <div className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
          <h3 className="text-xl font-bold text-slate-800 mb-4">🚀 AI 搜尋優化建議</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">短期目標 (1-2週)</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">•</span>
                  補齊所有缺少的 Open Graph 標籤
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">•</span>
                  建立網站的 LLMs.txt 檔案
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500">•</span>
                  修復 canonical 標籤問題
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-3">中期目標 (1-3月)</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  建立完整的 JSON-LD 結構化資料
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  為常見問題頁面添加 FAQ Schema
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  優化麵包屑導航結構
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
