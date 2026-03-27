import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { getGA4Summary } from '../services/ga4Analyzer'
import { getGSCSummary } from '../services/gscAnalyzer'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export default function Dashboard() {
  const { id } = useParams()
  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [seoHistory, setSeoHistory] = useState([])
  const [aeoHistory, setAeoHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [activeFixTab, setActiveFixTab] = useState('suggestions')
  const [copiedCode, setCopiedCode] = useState(null)
  
  // GA4 & GSC 數據
  const [ga4Data, setGa4Data] = useState(null)
  const [gscData, setGscData] = useState(null)
  const [ga4Loading, setGa4Loading] = useState(false)
  const [gscLoading, setGscLoading] = useState(false)
  
  // 從 localStorage 獲取配置的 GA4 Property ID 和 GSC Site URL
  const ga4PropertyId = localStorage.getItem('ga4_property_id')
  const gscSiteUrl = localStorage.getItem('gsc_site_url')

  useEffect(() => {
    fetchData()
    fetchGA4GSCData()
  }, [id])
  
  // 獲取 GA4 和 GSC 數據
  const fetchGA4GSCData = async () => {
    if (ga4PropertyId) {
      setGa4Loading(true)
      try {
        const data = await getGA4Summary(ga4PropertyId, { startDate: '30daysAgo', endDate: 'today' })
        setGa4Data(data)
      } catch (error) {
        console.warn('GA4 data fetch failed:', error)
        setGa4Data(null)
      } finally {
        setGa4Loading(false)
      }
    }
    // 未設定 ga4PropertyId → 保持 null，顯示未串接狀態

    if (gscSiteUrl) {
      setGscLoading(true)
      try {
        const data = await getGSCSummary(gscSiteUrl, { startDate: '30daysAgo', endDate: 'today' })
        setGscData(data)
      } catch (error) {
        console.warn('GSC data fetch failed:', error)
        setGscData(null)
      } finally {
        setGscLoading(false)
      }
    }
    // 未設定 gscSiteUrl → 保持 null，顯示未串接狀態
  }
  

  const fetchData = async () => {
    try {
      // 獲取網站資料
      const { data: websiteData } = await supabase
        .from('websites')
        .select('*')
        .eq('id', id)
        .single()

      if (websiteData) {
        setWebsite(websiteData)

        // 獲取 SEO 審計
        const { data: seoData } = await supabase
          .from('seo_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (seoData && seoData.length > 0) {
          setSeoAudit(seoData[0])
          setSeoHistory(seoData.slice(0, 10).reverse())
        }

        // 獲取 AEO 審計
        const { data: aeoData } = await supabase
          .from('aeo_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (aeoData && aeoData.length > 0) {
          setAeoAudit(aeoData[0])
          setAeoHistory(aeoData.slice(0, 10).reverse())
        }

        // 獲取 GEO 審計
        const { data: geoData } = await supabase
          .from('geo_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (geoData) {
          setGeoAudit(geoData)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  if (!website) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">找不到網站</h2>
          <Link to="/" className="text-purple-600 hover:underline">返回首頁</Link>
        </div>
      </div>
    )
  }

  const seoScore = seoAudit?.score || 0
  const aeoScore = aeoAudit?.score || 0
  const geoScore = geoAudit?.score || 0

  // 雷達圖數據 - 5 項 SEO 檢測
  const radarData = [
    { subject: 'Meta 標籤', score: seoAudit?.meta_tags?.score || 0, fullMark: 100 },
    { subject: 'H1 結構', score: seoAudit?.h1_structure?.score || 0, fullMark: 100 },
    { subject: 'Alt 屬性', score: seoAudit?.alt_tags?.score || 0, fullMark: 100 },
    { subject: '行動版相容', score: seoAudit?.mobile_compatible?.score || 0, fullMark: 100 },
    { subject: '載入速度', score: seoAudit?.page_speed?.score || 0, fullMark: 100 },
  ]

  // 歷史趨勢數據
  const trendData = seoHistory.map((s, i) => ({
    name: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
    seo: s.score,
    aeo: aeoHistory[i]?.score || 0,
  }))

  const scoreData = [
    { name: 'SEO', value: seoScore, color: '#3b82f6' },
    { name: 'AEO', value: aeoScore, color: '#8b5cf6' },
    { name: 'GEO', value: geoScore, color: '#10b981' },
  ]

  // AEO 8 項檢測數據
  const aeoChecks = [
    { key: 'json_ld', name: 'JSON-LD', passed: !!aeoAudit?.json_ld },
    { key: 'faq_schema', name: 'FAQ Schema', passed: !!aeoAudit?.faq_schema },
    { key: 'canonical', name: 'Canonical', passed: !!aeoAudit?.canonical },
    { key: 'breadcrumbs', name: '麵包屑導航', passed: !!aeoAudit?.breadcrumbs },
    { key: 'open_graph', name: 'Open Graph', passed: !!aeoAudit?.open_graph },
    { key: 'question_headings', name: '問句式標題', passed: !!aeoAudit?.question_headings },
    { key: 'meta_desc_length', name: 'Meta 描述長度', passed: !!aeoAudit?.meta_desc_length },
    { key: 'structured_answer', name: '結構化答案', passed: !!aeoAudit?.structured_answer },
  ]

  const geoChecks = [
    { key: 'llms_txt', name: 'llms.txt', passed: !!geoAudit?.llms_txt },
    { key: 'robots_ai', name: 'AI 爬蟲開放', passed: !!geoAudit?.robots_ai },
    { key: 'sitemap', name: 'Sitemap', passed: !!geoAudit?.sitemap },
    { key: 'open_graph', name: 'Open Graph', passed: !!geoAudit?.open_graph },
    { key: 'twitter_card', name: 'Twitter Card', passed: !!geoAudit?.twitter_card },
    { key: 'json_ld_citation', name: 'JSON-LD 引用信號', passed: !!geoAudit?.json_ld_citation },
    { key: 'canonical', name: 'Canonical', passed: !!geoAudit?.canonical },
    { key: 'https', name: 'HTTPS', passed: !!geoAudit?.https },
  ]

  // 重新檢測功能
  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return

    setAnalyzing(true)
    try {
      const [seoResult, aeoResult, geoResult] = await Promise.all([
        analyzeSEO(website.url),
        analyzeAEO(website.url),
        analyzeGEO(website.url)
      ])

      await Promise.all([
        supabase.from('seo_audits').insert([{
          website_id: id,
          score: seoResult.score,
          meta_tags: seoResult.meta_tags,
          h1_structure: seoResult.h1_structure,
          alt_tags: seoResult.alt_tags,
          mobile_compatible: seoResult.mobile_compatible,
          page_speed: seoResult.page_speed
        }]),
        supabase.from('aeo_audits').insert([{
          website_id: id,
          score: aeoResult.score,
          json_ld: aeoResult.json_ld,
          faq_schema: aeoResult.faq_schema,
          canonical: aeoResult.canonical,
          breadcrumbs: aeoResult.breadcrumbs,
          open_graph: aeoResult.open_graph,
          question_headings: aeoResult.question_headings,
        }]),
        supabase.from('geo_audits').insert([{
          website_id: id,
          score: geoResult.score,
          llms_txt: geoResult.llms_txt,
          robots_ai: geoResult.robots_ai,
          sitemap: geoResult.sitemap,
          open_graph: geoResult.open_graph,
          twitter_card: geoResult.twitter_card,
          json_ld_citation: geoResult.json_ld_citation,
          canonical: geoResult.canonical,
          https: geoResult.https,
        }])
      ])

      fetchData()
    } catch (error) {
      console.error('Error reanalyzing:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── AI 優化工具 helper ───────────────────────────────────────────
  const domain = website?.url ? (() => { try { return new URL(website.url).hostname } catch(e) { return website.url } })() : ''
  const siteTitle = seoAudit?.meta_tags?.titleContent || website?.name || domain
  const siteDesc = seoAudit?.meta_tags?.descriptionContent || `${siteTitle} 的官方網站`

  const getImprovementSuggestions = () => {
    const tips = []
    if (!seoAudit?.h1_structure?.hasOnlyOneH1) tips.push({ icon: '🏷️', title: '修正 H1 標題結構', desc: `頁面目前有 ${seoAudit?.h1_structure?.h1Count ?? 0} 個 H1 標題。每個頁面應只有一個 H1，清楚說明頁面主題，幫助 Google 與 AI 理解內容核心。` })
    if (!geoAudit?.llms_txt) tips.push({ icon: '🤖', title: '建立 llms.txt 檔案', desc: 'AI 爬蟲無法識別你的服務內容。在根目錄建立 /llms.txt 說明你的品牌與服務特色，讓 ChatGPT、Perplexity 更容易引用你。' })
    if (!aeoAudit?.json_ld) tips.push({ icon: '📋', title: '新增 JSON-LD 結構化資料', desc: '缺少結構化資料讓 Google 難以理解你的頁面。至少加入 WebSite 和 Organization schema，可以直接複製右側「修復碼產生器」的程式碼。' })
    if (!aeoAudit?.faq_schema) tips.push({ icon: '❓', title: '新增 FAQ Schema', desc: '缺少 FAQPage schema 讓 Google 無法將你的問答內容顯示為精選摘要，為 FAQ 區塊添加結構化資料可大幅提升能見度。' })
    if (!aeoAudit?.open_graph) tips.push({ icon: '🔗', title: '補充 Open Graph 標籤', desc: '缺少 og:title、og:description 會讓 AI 引用時無法獲取標準化資訊，影響在 AI 摘要中呈現的品質。' })
    if (!aeoAudit?.canonical) tips.push({ icon: '🔒', title: '設置 Canonical 標籤', desc: '未設置 canonical 可能導致 AI 引用錯誤版本的頁面，在每頁 <head> 加入 <link rel="canonical" href="..."> 即可修正。' })
    if (!aeoAudit?.question_headings) tips.push({ icon: '💬', title: '使用問句式 H2/H3 標題', desc: '問答式標題更容易被 Google 選為精選摘要來源，將部分標題改為「什麼是...？」「如何...？」格式。' })
    if (!aeoAudit?.breadcrumbs) tips.push({ icon: '🍞', title: '加入麵包屑導航 Schema', desc: '麵包屑導航幫助 AI 理解你網站的資訊架構，使用 BreadcrumbList schema 可提升出現在精選摘要的機率。' })
    if ((seoAudit?.alt_tags?.altCoverage || 100) < 80) tips.push({ icon: '🖼️', title: '補充圖片 Alt 文字', desc: `目前僅 ${seoAudit?.alt_tags?.altCoverage || 0}% 的圖片有 Alt 描述，AI 爬蟲無法理解沒有 Alt 的圖片，建議全部補齊。` })
    return tips.slice(0, 5)
  }

  const generateLLMsTxt = () => `# ${siteTitle}
> ${siteDesc}

## About
${siteTitle} — ${siteDesc}

## Services
- Website: ${website?.url}

## Contact
- Website: ${website?.url}

## Notes
本網站內容可由 AI 助理引用和摘要。`

  const generateJSONLD = () => `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "${siteTitle}",
  "url": "${website?.url}",
  "description": "${siteDesc}",
  "publisher": {
    "@type": "Organization",
    "name": "${siteTitle}",
    "url": "${website?.url}"
  }
}
<\/script>`

  const generateFAQSchema = () => `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "${siteTitle} 是什麼？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${siteDesc}"
      }
    },
    {
      "@type": "Question",
      "name": "如何聯繫 ${siteTitle}？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "請造訪官網 ${website?.url} 取得聯絡資訊。"
      }
    },
    {
      "@type": "Question",
      "name": "${siteTitle} 提供哪些服務？",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "${siteDesc}"
      }
    }
  ]
}
<\/script>`

  const getKeywords = () => {
    const base = siteTitle.replace(/[-|·|–]/g, ' ').trim()
    return [
      `${base} 是什麼`,
      `${base} 怎麼使用`,
      `${base} 評價`,
      `${base} 服務內容`,
      `${base} 費用價格`,
      `${domain} 可信嗎`,
      `AI 推薦 ${base}`,
      `如何找到 ${base}`,
      `${base} 優缺點比較`,
      `${base} 常見問題`,
    ]
  }

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }
  // ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-500 hover:text-slate-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{website.name}</h1>
              <p className="text-sm text-slate-500">{website.url}</p>
            </div>
          </div>
          <button
            onClick={handleReanalyze}
            disabled={analyzing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 總分數卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {scoreData.map((item) => (
            <div key={item.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">{item.name} 分數</h3>
                <span className={`text-3xl font-bold`} style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 圖表區域 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 雷達圖 - 5 項 SEO 檢測 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-2">SEO 5 項檢測分析</h3>
            <p className="text-sm text-slate-500 mb-4">Meta · H1 · Alt · Mobile · Speed</p>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Radar
                  name="SEO 檢測"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
                <Tooltip formatter={(v) => [`${v} 分`, '分數']} />
              </RadarChart>
            </ResponsiveContainer>
            {/* 檢測結果說明 */}
            <div className="grid grid-cols-5 gap-2 mt-2">
              {radarData.map((item) => (
                <div key={item.subject} className="text-center">
                  <div className="text-lg font-bold text-slate-800">{item.score}</div>
                  <div className="text-xs text-slate-500">{item.subject}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 趨勢圖 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">分數趨勢</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="seo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="SEO" />
                  <Line type="monotone" dataKey="aeo" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="AEO" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-slate-400">
                尚無歷史資料，執行「重新檢測」建立記錄
              </div>
            )}
          </div>
        </div>

        {/* GA4 流量數據區塊 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-xl">📊</span> GA4 網站流量分析
            </h3>
            {ga4Loading && <span className="text-sm text-slate-500">載入中...</span>}
          </div>
          {ga4Data ? (
            <>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                  <div className="text-blue-100 text-sm mb-1">工作階段</div>
                  <div className="text-2xl font-bold">{ga4Data.sessions?.toLocaleString()}</div>
                  <div className="text-blue-200 text-xs mt-1">Sessions</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                  <div className="text-purple-100 text-sm mb-1">活躍使用者</div>
                  <div className="text-2xl font-bold">{ga4Data.activeUsers?.toLocaleString()}</div>
                  <div className="text-purple-200 text-xs mt-1">Active Users</div>
                </div>
                <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
                  <div className="text-cyan-100 text-sm mb-1">網頁瀏覽量</div>
                  <div className="text-2xl font-bold">{ga4Data.pageViews?.toLocaleString()}</div>
                  <div className="text-cyan-200 text-xs mt-1">Page Views</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                  <div className="text-orange-100 text-sm mb-1">跳出率</div>
                  <div className="text-2xl font-bold">{ga4Data.bounceRate?.toFixed(1)}%</div>
                  <div className="text-orange-200 text-xs mt-1">Bounce Rate</div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-4">流量趨勢 (近30天)</h4>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={ga4Data.timeline || []}>
                    <defs>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => val.slice(5)} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip formatter={(value) => value.toLocaleString()} labelFormatter={(label) => `日期: ${label}`} />
                    <Area type="monotone" dataKey="sessions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSessions)" name="工作階段" />
                    <Area type="monotone" dataKey="pageViews" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorPageViews)" name="瀏覽量" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h4 className="font-semibold text-slate-700 mb-1">尚未串接 Google Analytics 4</h4>
              <p className="text-sm text-slate-400">串接 GA4 後可查看真實流量數據（專業版功能）</p>
            </div>
          )}
        </div>

        {/* GSC 搜尋數據區塊 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-xl">🔍</span> Google Search Console 搜尋成效
            </h3>
            {gscLoading && <span className="text-sm text-slate-500">載入中...</span>}
          </div>
          {gscData ? (
            <>
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                  <div className="text-green-100 text-sm mb-1">曝光次數</div>
                  <div className="text-2xl font-bold">{gscData.impressions?.toLocaleString()}</div>
                  <div className="text-green-200 text-xs mt-1">Impressions</div>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-4 text-white">
                  <div className="text-teal-100 text-sm mb-1">點擊次數</div>
                  <div className="text-2xl font-bold">{gscData.clicks?.toLocaleString()}</div>
                  <div className="text-teal-200 text-xs mt-1">Clicks</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
                  <div className="text-indigo-100 text-sm mb-1">點擊率</div>
                  <div className="text-2xl font-bold">{gscData.ctr?.toFixed(2)}%</div>
                  <div className="text-indigo-200 text-xs mt-1">CTR</div>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white">
                  <div className="text-pink-100 text-sm mb-1">平均排名</div>
                  <div className="text-2xl font-bold">{gscData.position?.toFixed(1)}</div>
                  <div className="text-pink-200 text-xs mt-1">Avg Position</div>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-4">搜尋曝光與點擊趨勢</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={gscData.timeline || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(val) => val.slice(5)} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                      <Line type="monotone" dataKey="impressions" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} name="曝光" />
                      <Line type="monotone" dataKey="clicks" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="點擊" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h4 className="font-semibold text-slate-800 mb-4">熱門搜尋關鍵字</h4>
                  <div className="space-y-3">
                    {(gscData.topQueries || []).slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
                          <span className="text-sm text-slate-700 font-medium truncate max-w-[150px]">{item.query}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-500"><span className="text-green-600 font-medium">{item.clicks}</span> 點擊</span>
                          <span className="text-slate-500"><span className="text-blue-600 font-medium">{item.position.toFixed(1)}</span> 排名</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h4 className="font-semibold text-slate-700 mb-1">尚未串接 Google Search Console</h4>
              <p className="text-sm text-slate-400">串接 GSC 後可查看關鍵字排名、曝光與點擊數據（專業版功能）</p>
            </div>
          )}
        </div>

        {/* 詳細檢測項目 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* SEO 基本檢測 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-800">SEO 基本檢測</h3>
            </div>
            <div className="space-y-4">
              {[
                {
                  name: 'Meta 標題',
                  value: seoAudit?.meta_tags?.titleContent || '未設置',
                  score: seoAudit?.meta_tags?.score || 0,
                  passed: seoAudit?.meta_tags?.hasTitle
                },
                {
                  name: 'Meta 描述',
                  value: seoAudit?.meta_tags?.descriptionContent
                    ? (seoAudit.meta_tags.descriptionContent.length > 40
                      ? seoAudit.meta_tags.descriptionContent.substring(0, 40) + '...'
                      : seoAudit.meta_tags.descriptionContent)
                    : '未設置',
                  score: seoAudit?.meta_tags?.score || 0,
                  passed: seoAudit?.meta_tags?.hasDescription
                },
                {
                  name: 'H1 標題結構',
                  value: `${seoAudit?.h1_structure?.h1Count || 0} 個 H1`,
                  score: seoAudit?.h1_structure?.score || 0,
                  passed: seoAudit?.h1_structure?.hasOnlyOneH1
                },
                {
                  name: '圖片 Alt 屬性',
                  value: seoAudit?.alt_tags?.altCoverage + '%' || '0%',
                  score: seoAudit?.alt_tags?.score || 0,
                  passed: seoAudit?.alt_tags?.passed
                },
                {
                  name: '行動裝置相容',
                  value: seoAudit?.mobile_compatible?.hasViewport ? '已設置 viewport' : '未設置',
                  score: seoAudit?.mobile_compatible?.score || 0,
                  passed: seoAudit?.mobile_compatible?.passed
                },
                {
                  name: '頁面載入速度',
                  value: seoAudit?.page_speed ? `${seoAudit.page_speed.loadTime}ms` : '未知',
                  score: seoAudit?.page_speed?.score || 0,
                  passed: seoAudit?.page_speed?.passed
                },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 block">{item.name}</span>
                    <span className="text-xs text-slate-500 truncate block">{item.value}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-bold text-slate-700">{item.score}</span>
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      item.passed ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AEO 技術檢測 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">AEO 技術檢測</h3>
              <Link to={`/aeo-audit/${id}`} className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                查看詳情 →
              </Link>
            </div>
            <p className="text-xs text-slate-400 mb-4">Answer Engine — 傳統 Google 問答優化</p>
            <div className="grid grid-cols-2 gap-3">
              {aeoChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    check.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-slate-700">{check.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GEO 生成式 AI 優化檢測 */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">GEO 生成式 AI 優化</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">Generative Engine</span>
              <Link to={`/geo-audit/${id}`} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">查看詳情 →</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">檢測 AI 爬蟲開放性與引用可信度信號（ChatGPT、Perplexity、Gemini）</p>
          {geoAudit ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {geoChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    check.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-slate-700">{check.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">
              點擊「重新檢測」以執行 GEO 分析
            </div>
          )}
        </div>

        {/* AI 優化工具 */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <span className="text-2xl">🛠️</span>
            <div>
              <h3 className="font-bold text-slate-800">AI 優化工具</h3>
              <p className="text-sm text-slate-500">根據檢測結果自動產生優化建議與修復碼</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {[
              { id: 'suggestions', label: '💡 優化建議', sub: '5 條具體行動' },
              { id: 'code', label: '⚙️ 修復碼產生器', sub: 'llms.txt · JSON-LD · FAQ' },
              { id: 'keywords', label: '🔍 AI 搜尋關鍵字', sub: '10 組查詢詞' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFixTab(tab.id)}
                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                  activeFixTab === tab.id
                    ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <div>{tab.label}</div>
                <div className="text-xs opacity-60 hidden sm:block">{tab.sub}</div>
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Tab 1: 優化建議 */}
            {activeFixTab === 'suggestions' && (
              <div className="space-y-3">
                {getImprovementSuggestions().length === 0 ? (
                  <div className="text-center py-10">
                    <span className="text-5xl">🎉</span>
                    <p className="text-slate-700 mt-3 font-semibold">太棒了！所有 AI 優化項目都通過了</p>
                    <p className="text-sm text-slate-500 mt-1">繼續保持，定期重新掃描以確保持續優化</p>
                  </div>
                ) : (
                  getImprovementSuggestions().map((tip, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                      <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                      <div>
                        <p className="font-semibold text-slate-800 mb-1">{i + 1}. {tip.title}</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{tip.desc}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: 修復碼產生器 */}
            {activeFixTab === 'code' && (
              <div className="space-y-6">
                {[{ id: 'llms', label: 'llms.txt', hint: '放到網站根目錄 → /llms.txt', color: 'text-green-400', fn: generateLLMsTxt },
                  { id: 'jsonld', label: 'JSON-LD 結構化資料', hint: '貼到 <head> 區塊內', color: 'text-blue-400', fn: generateJSONLD },
                  { id: 'faq', label: 'FAQ Schema', hint: '貼到 <head> 或頁面底部，修改問題後使用', color: 'text-yellow-400', fn: generateFAQSchema },
                ].map(({ id, label, hint, color, fn }) => (
                  <div key={id}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-slate-800">{label}</h4>
                        <p className="text-xs text-slate-500">{hint}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(fn(), id)}
                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors flex-shrink-0"
                      >
                        {copiedCode === id ? '✓ 已複製！' : '複製'}
                      </button>
                    </div>
                    <pre className={`bg-slate-900 ${color} rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48`}>
                      {fn()}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 3: AI 搜尋關鍵字 */}
            {activeFixTab === 'keywords' && (
              <div>
                <p className="text-sm text-slate-600 mb-4">用戶可能在 ChatGPT、Perplexity 或 Gemini 上用以下方式搜尋你的品牌：</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {getKeywords().map((kw, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{kw}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700">💡 建議：在你的網站 FAQ 頁面或內容中，自然地回答這些問題，可大幅提升被 AI 引用的機率。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
