import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { getGA4Summary } from '../services/ga4Analyzer'
import { getGSCSummary } from '../services/gscAnalyzer'
import { exportDashboardPDF } from '../services/pdfExport'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']

export default function Dashboard() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPro, refreshProfile } = useAuth()
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [eeatAudit, setEeatAudit] = useState(null)
  const [seoHistory, setSeoHistory] = useState([])
  const [aeoHistory, setAeoHistory] = useState([])
  const [geoHistory, setGeoHistory] = useState([])
  const [eeatHistory, setEeatHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [activeFixTab, setActiveFixTab] = useState('suggestions')

  // Email notification state
  const [emailInput, setEmailInput] = useState('')
  const [emailSubscription, setEmailSubscription] = useState(null) // active subscription record
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailMessage, setEmailMessage] = useState(null) // { type: 'success'|'error', text }
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

  // 付款成功後刷新 isPro 狀態
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('upgraded') === 'true') {
      setUpgradeSuccess(true)
      refreshProfile()
      // 清除 URL 參數
      navigate(location.pathname, { replace: true })
      setTimeout(() => setUpgradeSuccess(false), 6000)
    }
  }, [])

  const handleUpgrade = async () => {
    if (!user) {
      alert('請先登入再升級 Pro 方案')
      return
    }
    setUpgrading(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          returnUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || '建立付款頁面失敗，請稍後再試')
      }
    } catch {
      alert('連線失敗，請稍後再試')
    } finally {
      setUpgrading(false)
    }
  }
  
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
          .limit(10)
        if (geoData && geoData.length > 0) {
          setGeoAudit(geoData[0])
          setGeoHistory(geoData.slice(0, 10).reverse())
        }

        // 獲取 E-E-A-T 審計
        const { data: eeatData } = await supabase
          .from('eeat_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(10)
        if (eeatData && eeatData.length > 0) {
          setEeatAudit(eeatData[0])
          setEeatHistory(eeatData.slice(0, 10).reverse())
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
  const eeatScore = eeatAudit?.score || 0

  // 雷達圖數據 - 5 項 SEO 檢測
  const radarData = [
    { subject: 'Meta 標籤', score: seoAudit?.meta_tags?.score || 0, fullMark: 100 },
    { subject: 'H1 結構', score: seoAudit?.h1_structure?.score || 0, fullMark: 100 },
    { subject: 'Alt 屬性', score: seoAudit?.alt_tags?.score || 0, fullMark: 100 },
    { subject: '行動版相容', score: seoAudit?.mobile_compatible?.score || 0, fullMark: 100 },
    { subject: '載入速度', score: seoAudit?.page_speed?.score || 0, fullMark: 100 },
  ]

  // 歷史趨勢數據（以 SEO 歷史為基準對齊各模組）
  const trendData = seoHistory.map((s, i) => {
    const seo = s.score
    const aeo = aeoHistory[i]?.score || 0
    const geo = geoHistory[i]?.score || 0
    const eeat = eeatHistory[i]?.score || 0
    const overall = Math.round((seo + aeo + geo + eeat) / 4)
    return {
      name: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      SEO: seo,
      AEO: aeo,
      GEO: geo,
      'E-E-A-T': eeat,
      綜合: overall,
    }
  })

  const scoreData = [
    { name: 'SEO', value: seoScore, color: '#3b82f6' },
    { name: 'AEO', value: aeoScore, color: '#8b5cf6' },
    { name: 'GEO', value: geoScore, color: '#10b981' },
    { name: 'E-E-A-T', value: eeatScore, color: '#f59e0b' },
  ]

  const eeatChecks = [
    { key: 'author_info',         name: '作者資訊',          passed: !!eeatAudit?.author_info },
    { key: 'about_page',          name: '關於我們',          passed: !!eeatAudit?.about_page },
    { key: 'contact_page',        name: '聯絡方式',          passed: !!eeatAudit?.contact_page },
    { key: 'privacy_policy',      name: '隱私權政策',        passed: !!eeatAudit?.privacy_policy },
    { key: 'organization_schema', name: 'Organization Schema', passed: !!eeatAudit?.organization_schema },
    { key: 'date_published',      name: '發布日期',          passed: !!eeatAudit?.date_published },
    { key: 'social_links',        name: '社群媒體連結',      passed: !!eeatAudit?.social_links },
    { key: 'outbound_links',      name: '外部權威連結',      passed: !!eeatAudit?.outbound_links },
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
      const seoResult = await analyzeSEO(website.url).catch(() => ({ score: 0 }))
      const aeoResult = await analyzeAEO(website.url).catch(() => ({ score: 0 }))
      const geoResult = await analyzeGEO(website.url).catch(() => ({ score: 0 }))
      const eeatResult = await analyzeEEAT(website.url).catch(() => ({ score: 0 }))

      await Promise.all([
        supabase.from('seo_audits').insert([{
          website_id: id, score: seoResult.score,
          meta_tags: seoResult.meta_tags, h1_structure: seoResult.h1_structure,
          alt_tags: seoResult.alt_tags, mobile_compatible: seoResult.mobile_compatible,
          page_speed: seoResult.page_speed
        }]),
        supabase.from('aeo_audits').insert([{
          website_id: id, score: aeoResult.score,
          json_ld: aeoResult.json_ld, faq_schema: aeoResult.faq_schema,
          canonical: aeoResult.canonical, breadcrumbs: aeoResult.breadcrumbs,
          open_graph: aeoResult.open_graph, question_headings: aeoResult.question_headings,
        }]),
        supabase.from('geo_audits').insert([{
          website_id: id, score: geoResult.score,
          llms_txt: geoResult.llms_txt, robots_ai: geoResult.robots_ai,
          sitemap: geoResult.sitemap, open_graph: geoResult.open_graph,
          twitter_card: geoResult.twitter_card, json_ld_citation: geoResult.json_ld_citation,
          canonical: geoResult.canonical, https: geoResult.https,
        }]),
        supabase.from('eeat_audits').insert([{
          website_id: id, score: eeatResult.score,
          author_info: !!eeatResult.author_info, about_page: !!eeatResult.about_page,
          contact_page: !!eeatResult.contact_page, privacy_policy: !!eeatResult.privacy_policy,
          organization_schema: !!eeatResult.organization_schema, date_published: !!eeatResult.date_published,
          social_links: !!eeatResult.social_links, outbound_links: !!eeatResult.outbound_links,
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

  const handleExportPDF = async () => {
    if (exportingPDF) return
    setExportingPDF(true)
    try {
      await exportDashboardPDF({ website, seoAudit, aeoAudit, geoAudit, eeatAudit })
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF 匯出失敗，請稍後再試')
    } finally {
      setExportingPDF(false)
    }
  }

  // ─── Email 訂閱 ─────────────────────────────────────────────────
  useEffect(() => {
    if (id) fetchEmailSubscription()
  }, [id])

  const fetchEmailSubscription = async () => {
    const { data } = await supabase
      .from('email_subscriptions')
      .select('*')
      .eq('website_id', id)
      .eq('is_active', true)
      .maybeSingle()
    if (data) {
      setEmailSubscription(data)
      setEmailInput(data.email)
    }
  }

  const handleEmailSubscribe = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      setEmailMessage({ type: 'error', text: '請輸入有效的 Email 地址' })
      return
    }
    setEmailLoading(true)
    setEmailMessage(null)
    try {
      if (emailSubscription) {
        // Update existing
        const { error } = await supabase
          .from('email_subscriptions')
          .update({ email: emailInput })
          .eq('id', emailSubscription.id)
        if (error) throw error
        setEmailSubscription({ ...emailSubscription, email: emailInput })
        setEmailMessage({ type: 'success', text: '訂閱 Email 已更新' })
      } else {
        // Create new
        const { data, error } = await supabase
          .from('email_subscriptions')
          .insert([{ website_id: id, email: emailInput, frequency: 'weekly', is_active: true }])
          .select()
          .single()
        if (error) throw error
        setEmailSubscription(data)
        setEmailMessage({ type: 'success', text: '已訂閱週報，每週一早上自動發送' })
      }
    } catch (err) {
      console.error('Subscribe error:', err)
      setEmailMessage({ type: 'error', text: '操作失敗，請稍後再試' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleEmailUnsubscribe = async () => {
    if (!emailSubscription) return
    setEmailLoading(true)
    setEmailMessage(null)
    try {
      const { error } = await supabase
        .from('email_subscriptions')
        .update({ is_active: false })
        .eq('id', emailSubscription.id)
      if (error) throw error
      setEmailSubscription(null)
      setEmailInput('')
      setEmailMessage({ type: 'success', text: '已取消訂閱' })
    } catch (err) {
      setEmailMessage({ type: 'error', text: '取消失敗，請稍後再試' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleSendNow = async () => {
    const targetEmail = emailInput || emailSubscription?.email
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailMessage({ type: 'error', text: '請先填入 Email 地址' })
      return
    }
    setEmailSending(true)
    setEmailMessage(null)
    try {
      const overall = Math.round(((seoAudit?.score || 0) + (aeoAudit?.score || 0) + (geoAudit?.score || 0) + (eeatAudit?.score || 0)) / 4)
      const res = await fetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          website,
          scores: {
            seo: seoAudit?.score || 0,
            aeo: aeoAudit?.score || 0,
            geo: geoAudit?.score || 0,
            eeat: eeatAudit?.score || 0,
            overall,
          },
          checks: {
            seo: [
              { name: 'Meta 標題', passed: !!seoAudit?.meta_tags?.hasTitle },
              { name: 'Meta 描述', passed: !!seoAudit?.meta_tags?.hasDescription },
              { name: 'H1 標題結構', passed: !!seoAudit?.h1_structure?.hasOnlyOneH1 },
              { name: '圖片 Alt 屬性', passed: (seoAudit?.alt_tags?.altCoverage || 0) >= 80 },
              { name: '行動版相容', passed: !!seoAudit?.mobile_compatible?.hasViewport },
            ],
            aeo: aeoChecks,
            geo: geoChecks,
            eeat: eeatChecks,
          },
          dashboardUrl: `${window.location.origin}/dashboard/${id}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEmailMessage({ type: 'success', text: `報告已寄送到 ${targetEmail}` })
    } catch (err) {
      setEmailMessage({ type: 'error', text: '發送失敗，請確認 Resend API Key 已設定' })
    } finally {
      setEmailSending(false)
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
    if (!eeatAudit?.about_page) tips.push({ icon: '🏢', title: '建立關於我們頁面', desc: '缺少品牌介紹頁面。建立 /about 頁面說明公司背景與核心服務，強化 Google 與 AI 對你品牌的「權威性」認知。' })
    if (!eeatAudit?.contact_page) tips.push({ icon: '📞', title: '提供聯絡方式', desc: '找不到聯絡資訊。建立 /contact 頁面或在頁尾加入 email 連結，讓訪客和搜尋引擎確認這是真實存在的機構。' })
    if (!eeatAudit?.privacy_policy) tips.push({ icon: '🔏', title: '建立隱私權政策', desc: '缺少隱私權政策。建立 /privacy-policy 頁面並在頁尾加入連結，是合規與信任的基本要求。' })
    if (!eeatAudit?.organization_schema) tips.push({ icon: '🏷️', title: '加入 Organization Schema', desc: '缺少機構結構化資料。在 JSON-LD 加入 Organization schema（含 name、url、logo），讓 Google 和 AI 明確識別你的品牌。' })
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
      {/* 升級成功提示 */}
      {upgradeSuccess && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-3 px-6 text-sm font-semibold">
          🎉 恭喜！Pro 方案啟用成功！所有進階功能已解鎖。
        </div>
      )}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || analyzing}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {exportingPDF ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  產生中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  匯出 PDF
                </>
              )}
            </button>
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
            <h3 className="font-semibold text-slate-800 mb-1">歷史趨勢</h3>
            <p className="text-xs text-slate-400 mb-5">每次重新檢測後自動記錄，最多顯示最近 10 次</p>

            {trendData.length >= 2 ? (
              <>
                {/* 進步摘要卡 */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
                  {[
                    { key: 'SEO',    color: '#3b82f6', bg: '#eff6ff' },
                    { key: 'AEO',    color: '#8b5cf6', bg: '#f5f3ff' },
                    { key: 'GEO',    color: '#10b981', bg: '#f0fdf4' },
                    { key: 'E-E-A-T',color: '#f59e0b', bg: '#fffbeb' },
                    { key: '綜合',   color: '#64748b', bg: '#f8fafc' },
                  ].map(({ key, color, bg }) => {
                    const first = trendData[0][key] || 0
                    const last = trendData[trendData.length - 1][key] || 0
                    const diff = last - first
                    return (
                      <div key={key} style={{ background: bg }} className="rounded-xl p-3 text-center">
                        <div className="text-xs text-slate-500 mb-1">{key}</div>
                        <div className="text-xl font-bold" style={{ color }}>{last}</div>
                        <div className={`text-xs font-medium mt-0.5 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '持平'}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                      formatter={(v, name) => [`${v} 分`, name]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                    <Line type="monotone" dataKey="SEO"    stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="AEO"    stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="GEO"    stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="E-E-A-T" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="綜合"   stroke="#64748b" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : trendData.length === 1 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="text-3xl">📈</div>
                <p className="text-sm">已有 1 筆記錄，再次「重新檢測」後即可顯示趨勢圖</p>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <div className="text-3xl">📊</div>
                <p className="text-sm">尚無歷史資料，執行「重新檢測」建立記錄</p>
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

        {/* E-E-A-T 可信度 */}
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">E-E-A-T 可信度</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">Trust Signals</span>
              <Link to={`/eeat-audit/${id}`} className="text-orange-500 hover:text-orange-600 text-sm font-medium">查看詳情 →</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">檢測作者資訊、組織可信度與外部權威連結（Experience · Expertise · Authoritativeness · Trustworthiness）</p>
          {eeatAudit ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eeatChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    check.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {check.passed ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-slate-700">{check.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm mb-2">點擊「重新檢測」以執行 E-E-A-T 分析</p>
              {!isPro && (
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="mt-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60"
                >
                  {upgrading ? '跳轉中...' : '🔒 升級 Pro，解鎖完整修改建議'}
                </button>
              )}
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

        {/* Email 通知訂閱 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xl">📧</span>
            <h3 className="font-semibold text-slate-800">Email 通知</h3>
            {emailSubscription && (
              <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                已訂閱週報
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-5">
            訂閱後每週一早上自動收到本網站的 AI 能見度週報，或立即發送一份報告到信箱。
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEmailSubscribe}
                disabled={emailLoading}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {emailLoading ? '處理中...' : emailSubscription ? '更新訂閱' : '訂閱週報'}
              </button>
              <button
                onClick={handleSendNow}
                disabled={emailSending}
                className="px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                {emailSending ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    發送中...
                  </>
                ) : '立即發送'}
              </button>
              {emailSubscription && (
                <button
                  onClick={handleEmailUnsubscribe}
                  disabled={emailLoading}
                  className="px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  取消訂閱
                </button>
              )}
            </div>
          </div>

          {emailMessage && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm ${
              emailMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {emailMessage.type === 'success' ? '✓ ' : '⚠ '}{emailMessage.text}
            </div>
          )}

          {emailSubscription && (
            <p className="text-xs text-slate-400 mt-3">
              訂閱信箱：{emailSubscription.email} ·
              上次發送：{emailSubscription.last_sent_at
                ? new Date(emailSubscription.last_sent_at).toLocaleDateString('zh-TW')
                : '尚未發送'}
            </p>
          )}
        </div>

      </main>
    </div>
  )
}
