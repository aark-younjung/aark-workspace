import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { getGA4Summary } from '../services/ga4Analyzer'
import { getGSCSummary } from '../services/gscAnalyzer'
import {
  initiateGoogleAuth, isAuthenticated as isGoogleConnected,
  getPropertyId, getSiteUrl, setPropertyId, setSiteUrl, clearGoogleToken
} from '../services/googleAuth'
import { exportDashboardPDF } from '../services/pdfExport'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, Legend
} from 'recharts'

const timeAgo = (d) => {
  if (!d) return null
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

function InfoTooltip({ text }) {
  const lines = text.split('\n')
  return (
    <span className="relative group inline-flex items-center ml-1.5 align-middle">
      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-xs flex items-center justify-center cursor-help font-bold leading-none">?</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white text-xs rounded-lg px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
        {lines.map((line, i) => (
          <span key={i} className={`block ${line.startsWith('・') ? 'mt-1 text-slate-300' : 'font-medium mb-1'}`}>{line}</span>
        ))}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></span>
      </span>
    </span>
  )
}

export default function Dashboard() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPro, userName, refreshProfile } = useAuth()
  const { isDark } = useTheme()
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

  const [copiedCode, setCopiedCode] = useState(null)
  const [bizInfo, setBizInfo] = useState({ phone: '', address: '', hours: '', description: '' })
  const [pinging, setPinging] = useState(false)
  const [pingResult, setPingResult] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  // GA4 & GSC 數據
  const [ga4Data, setGa4Data] = useState(null)
  const [gscData, setGscData] = useState(null)
  const [ga4Loading, setGa4Loading] = useState(false)
  const [gscLoading, setGscLoading] = useState(false)
  const [ga4Error, setGa4Error] = useState('')
  const [gscError, setGscError] = useState('')
  
  // Google Analytics 連接狀態
  const [googleConnected, setGoogleConnected] = useState(isGoogleConnected())
  const [ga4PropertyId, setGa4PropertyId] = useState(getPropertyId(id) || '')
  const [gscSiteUrl, setGscSiteUrl] = useState(getSiteUrl(id) || '')
  const [showGoogleSettings, setShowGoogleSettings] = useState(false)
  const [ga4Input, setGa4Input] = useState(getPropertyId(id) || '')
  const [gscInput, setGscInput] = useState(getSiteUrl(id) || '')

  // AI 爬蟲追蹤
  const [crawlerResults, setCrawlerResults] = useState(null)
  const [crawlerScanning, setCrawlerScanning] = useState(false)
  const [terminalLogs, setTerminalLogs] = useState([])
  const terminalRef = useRef(null)

  useEffect(() => {
    fetchData()
    fetchGA4GSCData()
  }, [id])

  // 監聽 Google OAuth 彈窗成功訊息
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setGoogleConnected(true)
        // 若已有 Property ID / Site URL，直接拉取資料；否則開啟設定視窗
        const savedPid = getPropertyId(id)
        const savedUrl = getSiteUrl(id)
        if (savedPid || savedUrl) {
          fetchGA4GSCData(savedPid, savedUrl)
        } else {
          setShowGoogleSettings(true)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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

  // 自動滾動 terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLogs])

  // 切到 crawler tab 時自動掃描
  useEffect(() => {
    if (activeTab === 'crawler' && website && !crawlerResults && !crawlerScanning) {
      runCrawlerScan()
    }
  }, [activeTab, website])

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
  
  // 解析 GSC 輸入，轉成正確的 siteUrl 格式
  const parseGscInput = (input) => {
    const v = input.trim()
    if (!v) return ''
    // 已是 sc-domain: 格式（網域資源）→ 直接用
    if (v.startsWith('sc-domain:')) return v
    // 已有 https:// → 補結尾 /
    if (v.startsWith('http://') || v.startsWith('https://')) {
      return v.endsWith('/') ? v : v + '/'
    }
    // 純網域（如 a-ark.com.tw）→ 轉成網域資源格式
    return `sc-domain:${v}`
  }

  // 儲存 Google 設定並拉取數據
  const handleSaveGoogleSettings = () => {
    if (ga4Input) { setPropertyId(id, ga4Input); setGa4PropertyId(ga4Input) }
    if (gscInput) {
      const fullUrl = parseGscInput(gscInput)
      setSiteUrl(id, fullUrl)
      setGscSiteUrl(fullUrl)
    }
    setShowGoogleSettings(false)
    const fullGscUrl = gscInput ? parseGscInput(gscInput) : gscSiteUrl
    fetchGA4GSCData(ga4Input, fullGscUrl)
  }

  const handleDisconnectGoogle = () => {
    clearGoogleToken()
    setGoogleConnected(false)
    setGa4Data(null)
    setGscData(null)
    setGa4PropertyId('')
    setGscSiteUrl('')
    setGa4Input('')
    setGscInput('')
  }

  // 獲取 GA4 和 GSC 數據
  const fetchGA4GSCData = async (pid, surl) => {
    const propId = pid ?? ga4PropertyId
    const siteUrl = surl ?? gscSiteUrl
    if (propId) {
      setGa4Loading(true)
      setGa4Error('')
      try {
        const data = await getGA4Summary(propId, { startDate: '30daysAgo', endDate: 'today' })
        setGa4Data(data)
      } catch (error) {
        setGa4Data(null)
        if (error.message === 'NOT_AUTHENTICATED') {
          setGa4Error('Google 授權已過期，請重新連接帳號')
          setGoogleConnected(false)
        } else if (error.message?.includes('403')) {
          setGa4Error(`權限不足：請確認此 GA4 Property（${propId}）已授權給你的 Google 帳號`)
        } else if (error.message?.includes('400')) {
          setGa4Error(`Property ID 格式錯誤，請重新檢查（應為純數字，例如：123456789）`)
        } else {
          setGa4Error(`GA4 資料載入失敗：${error.message}`)
        }
      } finally {
        setGa4Loading(false)
      }
    }
    if (siteUrl) {
      setGscLoading(true)
      setGscError('')
      try {
        const data = await getGSCSummary(siteUrl, { startDate: '30daysAgo', endDate: 'today' })
        setGscData(data)
      } catch (error) {
        setGscData(null)
        if (error.message === 'NOT_AUTHENTICATED') {
          setGscError('Google 授權已過期，請重新連接帳號')
        } else if (error.message?.includes('403')) {
          setGscError(`權限不足：請確認此網站（${siteUrl}）已在 Search Console 驗證`)
        } else {
          setGscError(`GSC 資料載入失敗：${error.message}`)
        }
      } finally {
        setGscLoading(false)
      }
    }
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
      <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-slate-600">載入資料中...</p>
        </div>
      </div>
    )
  }

  if (!website) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">找不到網站</h2>
          <Link to={isDark ? "/dark" : "/"} className="text-orange-500 hover:underline">返回首頁</Link>
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

  // 歷史趨勢數據（從最新紀錄對齊，避免各模組筆數不同時錯位）
  const trendData = seoHistory.map((s, i) => {
    const offsetFromEnd = seoHistory.length - 1 - i
    const aeo = aeoHistory[aeoHistory.length - 1 - offsetFromEnd]?.score || 0
    const geo = geoHistory[geoHistory.length - 1 - offsetFromEnd]?.score || 0
    const eeat = eeatHistory[eeatHistory.length - 1 - offsetFromEnd]?.score || 0
    const seo = s.score
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
    { name: 'SEO', value: seoScore, color: '#3b82f6', icon: '🔍', desc: '讓 Google 搜尋找到你', detail: '搜尋引擎最佳化（SEO）讓你的網站在 Google、Bing 等搜尋結果中排名更高，帶來更多自然流量。' },
    { name: 'AEO', value: aeoScore, color: '#8b5cf6', icon: '🤖', desc: '讓 AI 直接回答關於你', detail: 'AI 引擎最佳化（AEO）讓 ChatGPT、Siri、Google AI 等助理在回答問題時，能直接引用你的內容或推薦你的品牌。' },
    { name: 'GEO', value: geoScore, color: '#10b981', icon: '🌐', desc: '讓 AI 生成式搜尋引用你', detail: '生成式引擎最佳化（GEO）讓 ChatGPT、Claude、Perplexity、Gemini 等 AI 在生成答案時，能主動提及並連結你的品牌。' },
    { name: 'E-E-A-T', value: eeatScore, color: '#f59e0b', icon: '🏆', desc: '建立品牌專業度與可信度', detail: '經驗、專業、權威、信任（E-E-A-T）是 Google 評估網站可信度的核心標準，影響你在 AI 時代被推薦的機率。' },
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

  // ─── 通知搜尋引擎 ────────────────────────────────────────────────
  const handlePingEngines = async () => {
    if (!website?.url || pinging) return
    setPinging(true)
    setPingResult(null)
    try {
      const res = await fetch('/api/indexnow-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: website.url }),
      })
      const data = await res.json()
      setPingResult({ success: true, pingedAt: data.pingedAt })
    } catch (e) {
      setPingResult({ success: false })
    } finally {
      setPinging(false)
    }
  }

  // ─── AI 優化工具 helper ───────────────────────────────────────────
  const domain = website?.url ? (() => { try { return new URL(website.url).hostname } catch(e) { return website.url } })() : ''
  const siteTitle = seoAudit?.meta_tags?.titleContent || website?.name || domain
  const siteDesc = seoAudit?.meta_tags?.descriptionContent || `${siteTitle} 的官方網站`

  const getImprovementSuggestions = () => {
    const tips = []
    if (!seoAudit?.h1_structure?.hasOnlyOneH1) tips.push({ icon: '🏷️', title: '修正 H1 標題結構', desc: `頁面目前有 ${seoAudit?.h1_structure?.h1Count ?? 0} 個 H1 標題。每個頁面應只有一個 H1，清楚說明頁面主題，幫助 Google 與 AI 理解內容核心。` })
    if (!geoAudit?.llms_txt) tips.push({ icon: '🤖', title: '建立 llms.txt 檔案', desc: 'AI 爬蟲無法識別你的服務內容。在根目錄建立 /llms.txt 說明你的品牌與服務特色，讓 ChatGPT、Claude、Perplexity 更容易引用你。' })
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
> ${bizInfo.description || siteDesc}

## About
${siteTitle} — ${bizInfo.description || siteDesc}

## Services
- Website: ${website?.url}

## Contact
- Website: ${website?.url}${bizInfo.phone ? `\n- Phone: ${bizInfo.phone}` : ''}${bizInfo.address ? `\n- Address: ${bizInfo.address}` : ''}${bizInfo.hours ? `\n- Hours: ${bizInfo.hours}` : ''}

## Notes
本網站內容可由 AI 助理引用和摘要。`

  const generateJSONLD = () => `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${siteTitle}",
  "url": "${website?.url}",
  "description": "${bizInfo.description || siteDesc}"${bizInfo.phone ? `,\n  "telephone": "${bizInfo.phone}"` : ''}${bizInfo.address ? `,\n  "address": {\n    "@type": "PostalAddress",\n    "streetAddress": "${bizInfo.address}"\n  }` : ''}${bizInfo.hours ? `,\n  "openingHours": "${bizInfo.hours}"` : ''}
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


  // ── AI 爬蟲追蹤 ──────────────────────────────────────────────────────
  const AI_CRAWLERS = [
    { id: 'gptbot', name: 'GPTBot', company: 'OpenAI', emoji: '🟢' },
    { id: 'claudebot', name: 'ClaudeBot', company: 'Anthropic', emoji: '🟠' },
    { id: 'anthropic-ai', name: 'anthropic-ai', company: 'Anthropic', emoji: '🟠' },
    { id: 'perplexitybot', name: 'PerplexityBot', company: 'Perplexity AI', emoji: '🔵' },
    { id: 'google-extended', name: 'Google-Extended', company: 'Google AI', emoji: '🔴' },
    { id: 'bytespider', name: 'Bytespider', company: 'ByteDance', emoji: '🕷️' },
    { id: 'ccbot', name: 'CCBot', company: 'Common Crawl', emoji: '📦' },
  ]

  const runCrawlerScan = async () => {
    if (!website?.url || crawlerScanning) return
    setCrawlerScanning(true)
    setTerminalLogs([])
    setCrawlerResults(null)

    const logs = []
    const addLog = (text, type = 'info') => {
      const entry = { text, type, id: Date.now() + Math.random() }
      logs.push(entry)
      setTerminalLogs([...logs])
    }
    const delay = ms => new Promise(r => setTimeout(r, ms))

    try {
      addLog(`> 初始化 AI 爬蟲追蹤掃描...`)
      await delay(350)
      addLog(`> 目標：${website.url}`)
      await delay(300)
      addLog(`> 正在請求 robots.txt...`)
      await delay(400)

      let robotsContent = ''
      let hasRobotsTxt = false
      try {
        const baseUrl = new URL(website.url).origin
        const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(baseUrl + '/robots.txt')}`)
        const data = await res.json()
        if (data.success && data.content) {
          robotsContent = data.content
          hasRobotsTxt = true
          addLog(`✓ 取得 robots.txt (${data.content.length} bytes)`, 'success')
        } else {
          addLog(`— robots.txt 不存在（所有爬蟲預設允許）`, 'warn')
        }
      } catch {
        addLog(`— 無法取得 robots.txt`, 'warn')
      }

      await delay(400)
      addLog(`> 逐一解析 AI 爬蟲規則...`)
      await delay(300)

      const text = robotsContent.toLowerCase()
      const robotsResults = {}

      for (const bot of AI_CRAWLERS) {
        await delay(180)
        const idx = text.indexOf(`user-agent: ${bot.id}`)
        if (idx === -1) {
          robotsResults[bot.id] = 'not_mentioned'
          addLog(`  ${bot.name.padEnd(18)} 未設定（預設允許）`)
        } else {
          const section = text.substring(idx, idx + 300)
          if (section.includes('disallow: /') && !section.includes('disallow: \n') && !section.includes('disallow: \r')) {
            robotsResults[bot.id] = 'blocked'
            addLog(`  ${bot.name.padEnd(18)} ✗ 封鎖 (Disallow: /)`, 'error')
          } else {
            robotsResults[bot.id] = 'allowed'
            addLog(`  ${bot.name.padEnd(18)} ✓ 明確允許`, 'success')
          }
        }
      }

      await delay(400)
      addLog(`> 檢查 AI 可見度信號...`)
      await delay(300)
      addLog(`  llms.txt      ${geoAudit?.llms_txt ? '✓ 存在' : '✗ 未找到'}`, geoAudit?.llms_txt ? 'success' : 'error')
      await delay(200)
      addLog(`  sitemap.xml   ${geoAudit?.sitemap ? '✓ 存在' : '✗ 未找到'}`, geoAudit?.sitemap ? 'success' : 'error')
      await delay(200)
      addLog(`  HTTPS         ${geoAudit?.https ? '✓ 啟用' : '✗ 未啟用'}`, geoAudit?.https ? 'success' : 'error')
      await delay(400)
      addLog(`> ✓ 掃描完成`, 'success')

      setCrawlerResults({ robots: robotsResults, hasRobotsTxt })
    } catch (e) {
      addLog(`✗ 掃描失敗：${e.message}`, 'error')
    } finally {
      setCrawlerScanning(false)
    }
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
    <div className="min-h-screen relative" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative">
      {/* 升級成功提示 */}
      {upgradeSuccess && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-center py-3 px-6 text-sm font-semibold">
          🎉 恭喜！Pro 方案啟用成功！所有進階功能已解鎖。
        </div>
      )}
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* 第一列：返回 + 標題 + 頭像 */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to={isDark ? "/dark" : "/"} className="text-slate-500 hover:text-slate-700 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 truncate">{website.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 truncate hidden sm:block">{website.url}</p>
                  {(seoAudit || aeoAudit || geoAudit || eeatAudit) && (() => {
                    const ts = seoAudit?.created_at || aeoAudit?.created_at || geoAudit?.created_at || eeatAudit?.created_at
                    const ago = timeAgo(ts)
                    return ago ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-full font-medium whitespace-nowrap">
                        🤖 {ago}
                      </span>
                    ) : null
                  })()}
                </div>
              </div>
            </div>
            {/* 頭像（桌面版同排；手機版也顯示） */}
            <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0 ml-2" title="帳號設定">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                  {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                </div>
              )}
            </Link>
          </div>

          {/* 第二列：動作按鈕（手機橫向捲動，桌面正常排列） */}
          <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
            {/* 連接 Google */}
            {googleConnected ? (
              <button
                onClick={() => setShowGoogleSettings(true)}
                className="flex-shrink-0 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                <span className="hidden sm:inline">Google 已連接</span>
                <span className="sm:hidden">已連接</span>
              </button>
            ) : (
              <button
                onClick={initiateGoogleAuth}
                className="flex-shrink-0 px-3 py-1.5 bg-white/60 text-slate-600 border border-orange-100 rounded-lg text-xs font-medium hover:bg-white/80 transition-colors flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block"></span>
                連接 Google
              </button>
            )}
            {/* 重新檢測 */}
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="flex-shrink-0 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  分析中...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  重新檢測
                </>
              )}
            </button>
            {/* 匯出 PDF */}
            {isPro ? (
              <button
                onClick={handleExportPDF}
                disabled={exportingPDF || analyzing}
                className="flex-shrink-0 px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium"
              >
                {exportingPDF ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    產生中...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    匯出 PDF
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                🔒 <span className="hidden sm:inline">匯出 PDF</span> (Pro)
              </button>
            )}
            {!isPro && (
              <Link to="/pricing" className="flex-shrink-0 px-3 py-1.5 text-xs text-orange-500 hover:text-orange-600 border border-orange-200 rounded-lg hover:border-orange-400 transition-colors whitespace-nowrap">
                查看方案 →
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 總分數卡片 */}
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {scoreData.map((item) => (
            <div key={item.name} className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <h3 className="font-semibold text-slate-700">{item.name}</h3>
                </div>
                <span className="text-3xl font-bold" style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
              <p className="text-xs font-medium mb-3" style={{ color: item.color }}>{item.desc}</p>
              <div className="h-2 bg-orange-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                />
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">{item.detail}</p>
            </div>
          ))}
        </div>

        {/* Tab 頁籤列 */}
        <div className="flex border-b border-orange-200 mb-8 overflow-x-auto scrollbar-hide">
          {[
            { id: 'overview', label: '總覽', icon: '📊' },
            { id: 'traffic', label: '流量數據', icon: '📈' },
            { id: 'crawler', labelMobile: 'AI 爬蟲', label: 'AI 爬蟲追蹤', icon: '🤖' },
            { id: 'tools', label: '優化工具', icon: '⚙️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 -mb-px transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="sm:hidden">{tab.labelMobile || tab.label}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: 總覽 ── */}
        {activeTab === 'overview' && <>
        {/* 圖表區域 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 雷達圖 - 5 項 SEO 檢測 */}
          <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
            <h3 className={`font-semibold mb-2 ${isDark ? "text-white" : "text-slate-800"}`}>SEO 5 項檢測分析<InfoTooltip text={`以雷達圖呈現 5 項 SEO 核心指標得分\n・Meta 標籤：標題與描述是否完整且長度符合規範\n・H1 結構：頁面是否只有一個清晰的主標題\n・Alt 屬性：圖片是否都有描述文字\n・行動版相容：是否適合手機瀏覽（Google 行動優先索引）\n・載入速度：頁面回應時間，影響排名與跳出率`} /></h3>
            <p className={`text-sm mb-4 ${isDark ? "text-white/60" : "text-slate-500"}`}>Meta · H1 · Alt · Mobile · Speed</p>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: isDark ? '#ffffff' : '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: isDark ? 'rgba(255,255,255,0.5)' : '#94a3b8' }} />
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
                  <div className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-800"}`}>{item.score}</div>
                  <div className={`text-xs ${isDark ? "text-white/60" : "text-slate-500"}`}>{item.subject}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 趨勢圖 */}
          <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-slate-800">歷史趨勢<InfoTooltip text={`每次重新檢測後自動記錄，最多顯示近 10 次\n・折線圖追蹤 SEO、AEO、GEO、E-E-A-T 四項分數變化\n・綜合分數為四項平均值\n・可觀察優化動作是否有效提升分數\n・卡片上的 +/- 數字代表與上次相比的變化`} /></h3>
              {!isPro && <span className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full font-semibold">🔒 Pro 功能</span>}
            </div>
            <p className="text-xs text-slate-400 mb-5">每次重新檢測後自動記錄，最多顯示最近 10 次</p>

            {!isPro ? (
              <div className="relative">
                {/* 模糊假圖 */}
                <div className="h-[280px] blur-sm opacity-50 pointer-events-none select-none flex items-end gap-2 px-4 pb-4">
                  {[45,60,55,70,65,80,75,85].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col gap-1 items-center justify-end h-full">
                      <div className="w-full rounded-t-sm" style={{ height: `${h}%`, background: i % 4 === 0 ? '#3b82f6' : i % 4 === 1 ? '#8b5cf6' : i % 4 === 2 ? '#10b981' : '#f59e0b', opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
                  <div className="text-3xl mb-3">📈</div>
                  <p className="font-bold text-slate-800 mb-1">歷史趨勢圖為 Pro 功能</p>
                  <p className="text-sm text-slate-500 mb-5 text-center px-4">追蹤每次優化後分數的變化，確認行動是否有效</p>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgrading}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-200 text-sm"
                  >
                    {upgrading ? '跳轉中...' : '升級 Pro 解鎖'}
                  </button>
                </div>
              </div>
            ) : trendData.length >= 2 ? (
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

        </>}

        {/* ── Tab: 流量數據 ── */}
        {activeTab === 'traffic' && <>
        {/* GA4 流量數據區塊 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-xl">📊</span> GA4 網站流量分析<InfoTooltip text={`串接 Google Analytics 4 顯示真實流量數據\n・工作階段：用戶造訪網站的次數\n・活躍使用者：實際與網站互動的人數\n・跳出率：只看一頁就離開的比例（越低越好）\n・互動率：有效互動工作階段的比例（越高越好）\n・新使用者：首次造訪的訪客比例\n系統會根據數據自動給出優化建議`} />
            </h3>
            <div className="flex items-center gap-3">
              {ga4Loading && <span className="text-sm text-slate-500">載入中...</span>}
              {!ga4Loading && ga4PropertyId && <button onClick={() => fetchGA4GSCData()} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors" title="重新載入數據">↻</button>}
              <button onClick={() => setShowGoogleSettings(true)} className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">⚙️ 修改設定</button>
              {ga4Data && <Link to={`/ga4-report/${id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">查看詳情 →</Link>}
            </div>
          </div>
          {ga4Error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-red-500 flex-shrink-0">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{ga4Error}</p>
              </div>
              {ga4PropertyId && (
                <p className="text-xs text-red-500 mb-2">目前設定的 Property ID：<span className="font-mono bg-red-100 px-1 rounded">{ga4PropertyId}</span></p>
              )}
              <div className="flex gap-2 flex-wrap">
                {ga4Error.includes('授權已過期') || ga4Error.includes('NOT_AUTHENTICATED') ? (
                  <button
                    onClick={initiateGoogleAuth}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    🔄 重新連接 Google
                  </button>
                ) : null}
                <button
                  onClick={() => setShowGoogleSettings(true)}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  ✏️ 修正 Property ID 設定
                </button>
              </div>
            </div>
          )}
          {ga4Data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                  <div className="text-emerald-100 text-sm mb-1">新使用者</div>
                  <div className="text-2xl font-bold">{ga4Data.newUsers?.toLocaleString()}</div>
                  <div className="text-emerald-200 text-xs mt-1">New Users</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
                  <div className="text-orange-100 text-sm mb-1">跳出率</div>
                  <div className="text-2xl font-bold">{ga4Data.bounceRate?.toFixed(1)}%</div>
                  <div className="text-orange-200 text-xs mt-1">Bounce Rate</div>
                </div>
                <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-4 text-white">
                  <div className="text-rose-100 text-sm mb-1">互動率</div>
                  <div className="text-2xl font-bold">
                    {ga4Data.sessions > 0 ? Math.round(ga4Data.engagedSessions / ga4Data.sessions * 100) : 0}%
                  </div>
                  <div className="text-rose-200 text-xs mt-1">Engagement Rate</div>
                </div>
              </div>
              {isPro ? (
              <div className="grid md:grid-cols-2 gap-6 mb-4">
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
                  <h4 className="font-semibold text-slate-800 mb-4">流量趨勢 (近30天)</h4>
                  <ResponsiveContainer width="100%" height={240}>
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
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
                  <h4 className="font-semibold text-slate-800 mb-4">📊 流量洞察與建議</h4>
                  <div className="space-y-3">
                    {ga4Data.bounceRate > 70 ? (
                      <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                        <span className="text-lg flex-shrink-0">⚠️</span>
                        <div>
                          <div className="font-medium text-red-700 text-sm">跳出率偏高（{ga4Data.bounceRate?.toFixed(1)}%）</div>
                          <div className="text-red-600 text-xs mt-0.5">建議改善頁面載入速度、提升內容相關性，加入明確的 CTA 引導使用者繼續瀏覽</div>
                        </div>
                      </div>
                    ) : ga4Data.bounceRate > 0 && ga4Data.bounceRate <= 50 ? (
                      <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <span className="text-lg flex-shrink-0">✅</span>
                        <div>
                          <div className="font-medium text-green-700 text-sm">跳出率表現良好（{ga4Data.bounceRate?.toFixed(1)}%）</div>
                          <div className="text-green-600 text-xs mt-0.5">使用者願意留在頁面繼續瀏覽，內容相關性高</div>
                        </div>
                      </div>
                    ) : null}
                    {ga4Data.sessions > 0 && (ga4Data.engagedSessions / ga4Data.sessions) < 0.4 && (
                      <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-lg flex-shrink-0">💡</span>
                        <div>
                          <div className="font-medium text-amber-700 text-sm">互動率偏低（{Math.round(ga4Data.engagedSessions / ga4Data.sessions * 100)}%）</div>
                          <div className="text-amber-600 text-xs mt-0.5">考慮加入影片、互動元素或清晰的號召行動按鈕</div>
                        </div>
                      </div>
                    )}
                    {ga4Data.activeUsers > 0 && ga4Data.newUsers / ga4Data.activeUsers > 0.7 && (
                      <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="text-lg flex-shrink-0">📣</span>
                        <div>
                          <div className="font-medium text-blue-700 text-sm">新訪客佔比高（{Math.round(ga4Data.newUsers / ga4Data.activeUsers * 100)}%）</div>
                          <div className="text-blue-600 text-xs mt-0.5">建議加強留存策略：Email 訂閱、社群追蹤、推播通知</div>
                        </div>
                      </div>
                    )}
                    {ga4Data.sessions > 0 && ga4Data.bounceRate >= 50 && ga4Data.bounceRate <= 70 && (
                      <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="text-lg flex-shrink-0">📈</span>
                        <div>
                          <div className="font-medium text-amber-700 text-sm">跳出率尚可（{ga4Data.bounceRate?.toFixed(1)}%），仍有改善空間</div>
                          <div className="text-amber-600 text-xs mt-0.5">嘗試優化首屏內容、加快頁面載入速度可進一步降低跳出率</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ) : (
              <div className="bg-orange-50/80 rounded-2xl p-4 border border-orange-100 text-center mb-4">
                <p className="text-sm text-orange-700 font-medium">🔒 趨勢圖與流量洞察建議為 Pro 功能</p>
                <button onClick={handleUpgrade} disabled={upgrading} className="mt-2 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60">
                  {upgrading ? '跳轉中...' : '升級 Pro 解鎖'}
                </button>
              </div>
              )}
            </>
          ) : (
            <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">📊</span>
                    <div>
                      <h4 className="font-semibold text-slate-800">串接 Google Analytics 4</h4>
                      <p className="text-sm text-slate-500">了解你的網站流量與用戶行為</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['工作階段數', '活躍使用者', '跳出率', '頁面瀏覽量', '新使用者', '互動率'].map(m => (
                      <div key={m} className="bg-blue-50 text-blue-700 text-xs px-2 py-1.5 rounded-lg text-center font-medium">{m}</div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { step: '1', text: '點擊「連接 Google 帳號」，選擇有 GA4 管理權限的帳號', done: googleConnected },
                      { step: '2', text: '前往 GA4 後台 → 左下角齒輪「管理」→ 中間欄點「資源詳細資料」→ 頁面右上角可看到「資源 ID」（純數字，例如：123456789）', done: false },
                      { step: '3', text: '點擊「設定 GA4 Property ID」填入資源 ID，即可看到流量數據', done: false },
                    ].map(({ step, text, done }) => (
                      <div key={step} className="flex gap-3 items-start">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {done ? '✓' : step}
                        </span>
                        <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-center items-center gap-3 md:w-44">
                  {!googleConnected ? (
                    <button onClick={initiateGoogleAuth} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-xl shadow-sm hover:shadow-md text-slate-700 font-medium text-sm transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      步驟 1：連接帳號
                    </button>
                  ) : (
                    <div className="w-full text-center text-sm text-green-600 font-medium bg-green-50 rounded-xl py-2">✓ Google 帳號已連接</div>
                  )}
                  <button onClick={() => setShowGoogleSettings(true)} className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all">
                    步驟 2：設定 Property ID
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GSC 搜尋數據區塊 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="text-xl">🔍</span> Google Search Console 搜尋成效<InfoTooltip text={`顯示網站在 Google 搜尋結果的真實表現\n・曝光次數：網站出現在搜尋結果的次數\n・點擊次數：用戶實際點進網站的次數\n・點擊率 CTR：曝光中有多少人點擊（越高越好）\n・平均排名：關鍵字在 Google 的平均位置\n・機會關鍵字：排名第 4–10 名、稍加優化就能衝進前三的關鍵字`} />
            </h3>
            <div className="flex items-center gap-3">
              {gscLoading && <span className="text-sm text-slate-500">載入中...</span>}
              {!gscLoading && gscSiteUrl && <button onClick={() => fetchGA4GSCData()} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors" title="重新載入數據">↻</button>}
              <button onClick={() => setShowGoogleSettings(true)} className="text-xs text-slate-500 hover:text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">⚙️ 修改設定</button>
              {gscData && <Link to={`/gsc-report/${id}`} className="text-green-600 hover:text-green-700 text-sm font-medium">查看詳情 →</Link>}
            </div>
          </div>
          {gscError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-red-500 flex-shrink-0">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{gscError}</p>
              </div>
              {gscSiteUrl && (
                <p className="text-xs text-red-500 mb-2">目前設定的網域：<span className="font-mono bg-red-100 px-1 rounded">{gscSiteUrl}</span></p>
              )}
              <div className="flex gap-2 flex-wrap">
                {gscError.includes('授權已過期') || gscError.includes('NOT_AUTHENTICATED') ? (
                  <button
                    onClick={initiateGoogleAuth}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    🔄 重新連接 Google
                  </button>
                ) : null}
                <button
                  onClick={() => setShowGoogleSettings(true)}
                  className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  ✏️ 修正網域設定
                </button>
              </div>
            </div>
          )}
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
              {isPro ? (
              <>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
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
                <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
                  <h4 className="font-semibold text-slate-800 mb-3">熱門搜尋關鍵字</h4>
                  <div className="flex gap-4 text-xs text-slate-400 mb-2 px-3">
                    <span className="flex-1">關鍵字</span>
                    <span className="w-10 text-right">點擊</span>
                    <span className="w-12 text-right">CTR</span>
                    <span className="w-10 text-right">排名</span>
                  </div>
                  <div className="space-y-2">
                    {(gscData.topQueries || []).slice(0, 10).map((item, index) => {
                      const isOpportunity = item.position >= 4 && item.position <= 10
                      const posColor = item.position <= 3 ? 'text-green-600' : item.position <= 10 ? 'text-amber-600' : 'text-red-500'
                      return (
                        <div key={index} className="flex items-center gap-2 p-2.5 bg-white/50 rounded-lg">
                          <span className="w-5 h-5 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</span>
                          <span className="text-sm text-slate-700 font-medium truncate flex-1">{item.query}</span>
                          {isOpportunity && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">機會</span>}
                          <span className="w-10 text-right text-xs text-green-600 font-medium flex-shrink-0">{item.clicks}</span>
                          <span className="w-12 text-right text-xs text-blue-600 font-medium flex-shrink-0">{(item.ctr * 100).toFixed(1)}%</span>
                          <span className={`w-10 text-right text-xs font-bold flex-shrink-0 ${posColor}`}>#{item.position.toFixed(0)}</span>
                        </div>
                      )
                    })}
                    {(gscData.topQueries || []).length === 0 && (
                      <div className="text-center text-slate-400 text-sm py-6">尚無搜尋關鍵字數據</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60 mt-4">
                <h4 className="font-semibold text-slate-800 mb-4">🎯 搜尋優化建議</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {gscData.position > 10 && (
                    <div className="flex gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                      <span className="text-lg flex-shrink-0">⚠️</span>
                      <div>
                        <div className="font-medium text-red-700 text-sm">平均排名在第 2 頁（#{gscData.position?.toFixed(1)}）</div>
                        <div className="text-red-600 text-xs mt-0.5">加強內容深度、Schema 標記、E-E-A-T 指標可提升排名</div>
                      </div>
                    </div>
                  )}
                  {gscData.position > 0 && gscData.position <= 10 && (
                    <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                      <span className="text-lg flex-shrink-0">✅</span>
                      <div>
                        <div className="font-medium text-green-700 text-sm">平均排名在第 1 頁（#{gscData.position?.toFixed(1)}）</div>
                        <div className="text-green-600 text-xs mt-0.5">持續維持內容品質，爭取更多精選摘要（Featured Snippet）</div>
                      </div>
                    </div>
                  )}
                  {gscData.impressions > 0 && gscData.ctr < 0.02 && (
                    <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="text-lg flex-shrink-0">💡</span>
                      <div>
                        <div className="font-medium text-amber-700 text-sm">點擊率偏低（{(gscData.ctr * 100).toFixed(2)}%）</div>
                        <div className="text-amber-600 text-xs mt-0.5">優化 Meta 標題與描述，加入數字、問句或情緒詞提升吸引力</div>
                      </div>
                    </div>
                  )}
                  {(gscData.topQueries || []).filter(q => q.position >= 4 && q.position <= 10).length > 0 && (
                    <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-lg flex-shrink-0">🚀</span>
                      <div>
                        <div className="font-medium text-blue-700 text-sm">
                          {(gscData.topQueries || []).filter(q => q.position >= 4 && q.position <= 10).length} 個「機會關鍵字」排名 4–10
                        </div>
                        <div className="text-blue-600 text-xs mt-0.5">針對這些關鍵字加強內頁內容、內部連結、取得反向連結可衝進前三</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </>
              ) : (
              <div className="bg-orange-50/80 rounded-2xl p-4 border border-orange-100 text-center mt-4">
                <p className="text-sm text-orange-700 font-medium">🔒 趨勢圖、熱門關鍵字與搜尋建議為 Pro 功能</p>
                <button onClick={handleUpgrade} disabled={upgrading} className="mt-2 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60">
                  {upgrading ? '跳轉中...' : '升級 Pro 解鎖'}
                </button>
              </div>
              )}
            </>
          ) : (
            <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">🔍</span>
                    <div>
                      <h4 className="font-semibold text-slate-800">串接 Google Search Console</h4>
                      <p className="text-sm text-slate-500">掌握網站在 Google 搜尋的真實成效</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {['搜尋曝光次數', '點擊次數', '點擊率 CTR', '平均排名', '熱門關鍵字', '機會關鍵字'].map(m => (
                      <div key={m} className="bg-green-50 text-green-700 text-xs px-2 py-1.5 rounded-lg text-center font-medium">{m}</div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { step: '1', text: '確認網站已在 Google Search Console 完成驗證（search.google.com/search-console）', done: false },
                      { step: '2', text: '點擊「連接 Google 帳號」，選擇有 GSC 管理權限的帳號', done: googleConnected },
                      { step: '3', text: '點擊「設定 GSC Site URL」，填入 GSC 中的網站網址（如 https://example.com/）', done: false },
                    ].map(({ step, text, done }) => (
                      <div key={step} className="flex gap-3 items-start">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {done ? '✓' : step}
                        </span>
                        <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-center items-center gap-3 md:w-44">
                  {!googleConnected ? (
                    <button onClick={initiateGoogleAuth} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-orange-100 rounded-xl shadow-sm hover:shadow-md text-slate-700 font-medium text-sm transition-all">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      步驟 2：連接帳號
                    </button>
                  ) : (
                    <div className="w-full text-center text-sm text-green-600 font-medium bg-green-50 rounded-xl py-2">✓ Google 帳號已連接</div>
                  )}
                  <button onClick={() => setShowGoogleSettings(true)} className="w-full px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-all">
                    步驟 3：設定 Site URL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        </>}

        {/* ── Tab: 總覽（詳細檢測）── */}
        {activeTab === 'overview' && <>
        {/* 詳細檢測項目 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* SEO 基本檢測 */}
          <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-800">SEO 基本檢測<InfoTooltip text={`搜尋引擎排名的基礎要素，共 5 項\n・Meta 標題：建議 30–60 字，包含目標關鍵字\n・Meta 描述：建議 70–155 字，吸引用戶點擊\n・H1 結構：每頁應只有一個 H1，明確傳達主題\n・圖片 Alt：所有圖片需有描述文字（SEO + 無障礙）\n・載入速度：回應時間越短，排名與用戶體驗越好`} /></h3>
              <Link to={`/seo-audit/${id}`} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                查看詳情 →
              </Link>
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
                <div key={i} className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
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
          <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">AEO 技術檢測<InfoTooltip text={`AEO（答案引擎優化）共 8 項技術指標\n・JSON-LD：結構化資料，幫助 AI 理解網頁內容\n・FAQ Schema：問答格式，提升被 AI 直接引用的機率\n・Canonical：避免重複內容，集中 SEO 權重\n・麵包屑：網站層級結構，改善索引效率\n・Open Graph：社群分享時的標題與圖片預覽\n・問句式標題：以問題形式撰寫標題，符合 AI 搜尋行為\n・Meta 描述長度：控制在適當範圍內\n・結構化答案：直接在頁面上給出清晰答案`} /></h3>
              <Link to={`/aeo-audit/${id}`} className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                查看詳情 →
              </Link>
            </div>
            <p className="text-xs text-slate-400 mb-4">Answer Engine — 傳統 Google 問答優化</p>
            <div className="grid grid-cols-2 gap-3">
              {aeoChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
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
        <div className="mt-6 bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">GEO 生成式 AI 優化<InfoTooltip text={`GEO（生成式引擎優化）共 8 項指標\n・llms.txt：專為 AI 爬蟲設計的說明文件\n・AI 爬蟲開放：robots.txt 是否允許 GPTBot 等爬取\n・Sitemap：網站地圖，幫助搜尋引擎完整索引\n・Open Graph：頁面的標題、描述、圖片標記\n・Twitter Card：社群預覽卡片設定\n・JSON-LD 引用信號：提供 AI 引用所需的結構化資訊\n・Canonical：告知搜尋引擎頁面的標準版本\n・HTTPS：安全連線，影響排名與用戶信任`} /></h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-medium">Generative Engine</span>
              <Link to={`/geo-audit/${id}`} className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">查看詳情 →</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">檢測 AI 爬蟲開放性與引用可信度信號（ChatGPT、Claude、Perplexity、Gemini）</p>
          {geoAudit ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {geoChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
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
        <div className="mt-8 bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-800">E-E-A-T 可信度<InfoTooltip text={`Google 品質評分核心：經驗、專業、權威、可信度\n・作者資訊：頁面是否標示作者姓名與專業背景\n・關於我們：是否有介紹公司/團隊的頁面\n・聯絡方式：是否提供可驗證的聯絡資訊\n・隱私權政策：必備的法律合規頁面\n・Organization Schema：結構化的組織資訊標記\n・發布日期：文章是否標示發布與更新時間\n・社群媒體連結：提升品牌可信度與權威性\n・外部權威連結：引用可信來源，增加內容可信度`} /></h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">Trust Signals</span>
              <Link to={`/eeat-audit/${id}`} className="text-orange-500 hover:text-orange-600 text-sm font-medium">查看詳情 →</Link>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">檢測作者資訊、組織可信度與外部權威連結（Experience · Expertise · Authoritativeness · Trustworthiness）</p>
          {eeatAudit ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eeatChecks.map((check) => (
                <div key={check.key} className="flex items-center gap-3 p-3 bg-white/50 rounded-lg">
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

        </>}

        {/* ── Tab: AI 爬蟲追蹤 ── */}
        {activeTab === 'crawler' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-800">AI 爬蟲追蹤</h3>
                <p className="text-slate-500 text-sm mt-0.5">檢測 AI 爬蟲是否能存取你的網站，以及 robots.txt 設定狀況</p>
              </div>
              <button
                onClick={runCrawlerScan}
                disabled={crawlerScanning}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {crawlerScanning
                  ? <><span className="inline-block animate-spin">↻</span> 掃描中...</>
                  : <><span>🔍</span> 重新掃描</>}
              </button>
            </div>

            {/* Terminal */}
            <div className="bg-slate-950 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-900 border-b border-slate-700">
                <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
                <span className="text-slate-500 text-xs ml-3 font-mono truncate">crawler-scan ~ {website?.url}</span>
              </div>
              <div ref={terminalRef} className="p-4 h-52 overflow-y-auto font-mono text-xs space-y-0.5 scrollbar-hide">
                {terminalLogs.length === 0 ? (
                  <span className="text-slate-600">等待掃描...</span>
                ) : terminalLogs.map(log => (
                  <div key={log.id} className={
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'warn' ? 'text-yellow-400' :
                    'text-slate-400'
                  }>{log.text}</div>
                ))}
                {crawlerScanning && <span className="text-green-400 animate-pulse">█</span>}
              </div>
            </div>

            {/* Crawler Status Grid */}
            {crawlerResults && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">AI 爬蟲存取權限</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {AI_CRAWLERS.map(bot => {
                      const status = crawlerResults.robots[bot.id]
                      return (
                        <div key={bot.id} className={`p-3 rounded-xl border backdrop-blur-sm ${
                          status === 'blocked'
                            ? 'bg-red-50/80 border-red-200'
                            : status === 'allowed'
                            ? 'bg-green-50/80 border-green-200'
                            : 'bg-white/60 border-white/60'
                        }`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xl leading-none">{bot.emoji}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                              status === 'blocked'
                                ? 'bg-red-100 text-red-600'
                                : status === 'allowed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {status === 'blocked' ? '封鎖' : status === 'allowed' ? '允許' : '預設'}
                            </span>
                          </div>
                          <p className="text-slate-800 font-semibold text-sm leading-tight">{bot.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{bot.company}</p>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">「預設」代表 robots.txt 未特別設定，爬蟲預設可存取</p>
                </div>

                {/* AI Visibility Signals */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">AI 可見度信號</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'llms.txt', desc: '讓 AI 了解你的品牌與服務', passed: !!geoAudit?.llms_txt, icon: '📄', fix: '在根目錄建立 /llms.txt' },
                      { label: 'sitemap.xml', desc: '協助 AI 探索所有頁面', passed: !!geoAudit?.sitemap, icon: '🗺️', fix: '提交 sitemap 至 GSC' },
                      { label: 'robots.txt', desc: '爬蟲規則文件', passed: crawlerResults.hasRobotsTxt, icon: '🤖', fix: '建立 /robots.txt 明確設定規則' },
                    ].map(item => (
                      <div key={item.label} className={`flex items-center gap-3 p-4 rounded-xl border ${
                        item.passed ? 'bg-green-50/80 border-green-200' : 'bg-orange-50/80 border-orange-200'
                      }`}>
                        <span className="text-2xl flex-shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                          <p className="text-xs text-slate-500 truncate">{item.passed ? item.desc : item.fix}</p>
                        </div>
                        <span className={`text-xl flex-shrink-0 ${item.passed ? 'text-green-500' : 'text-orange-400'}`}>
                          {item.passed ? '✓' : '✗'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {(Object.values(crawlerResults.robots).some(v => v === 'blocked') || !geoAudit?.llms_txt || !geoAudit?.sitemap) && (
                  <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-xl">
                    <h4 className="font-semibold text-amber-800 mb-3">⚠️ 優化建議</h4>
                    <ul className="space-y-2 text-sm text-amber-700">
                      {Object.entries(crawlerResults.robots)
                        .filter(([, v]) => v === 'blocked')
                        .map(([botId]) => {
                          const bot = AI_CRAWLERS.find(b => b.id === botId)
                          return <li key={botId}>• robots.txt 封鎖了 <strong>{bot?.name}</strong>，建議移除封鎖或改為 <code className="bg-amber-100 px-1 rounded">Allow: /</code></li>
                        })
                      }
                      {!geoAudit?.llms_txt && (
                        <li>• 尚未建立 <strong>llms.txt</strong>，AI 無法識別你的品牌服務，前往「優化工具」Tab 產生修復碼</li>
                      )}
                      {!geoAudit?.sitemap && (
                        <li>• 尚未偵測到 <strong>sitemap.xml</strong>，AI 爬蟲可能無法完整索引你的頁面</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* All Good */}
                {!Object.values(crawlerResults.robots).some(v => v === 'blocked') && geoAudit?.llms_txt && geoAudit?.sitemap && (
                  <div className="p-5 bg-green-50/80 border border-green-200 rounded-xl text-center">
                    <span className="text-3xl">🎉</span>
                    <p className="font-semibold text-green-700 mt-2">太棒了！所有 AI 爬蟲都可以存取你的網站</p>
                    <p className="text-sm text-green-600 mt-1">llms.txt、sitemap.xml 齊備，AI 引用能見度最佳化</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Tab: 優化工具 ── */}
        {activeTab === 'tools' && <>
        {/* AI 優化工具 */}
        <div className="mt-0 bg-white/40 backdrop-blur-md rounded-2xl shadow-sm border border-white/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-100 flex items-center gap-3">
            <span className="text-2xl">🛠️</span>
            <div>
              <h3 className="font-bold text-slate-800">AI 優化工具</h3>
              <p className="text-sm text-slate-500">根據檢測結果自動產生優化建議與修復碼</p>
            </div>
          </div>

          <>
          {/* Tabs */}
          <div className="flex border-b border-orange-100">
            {[
              { id: 'suggestions', label: '💡 優化建議', sub: '5 條具體行動' },
              { id: 'code', label: '⚙️ 修復碼產生器', sub: 'llms.txt · JSON-LD · FAQ' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFixTab(tab.id)}
                className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                  activeFixTab === tab.id
                    ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
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
                    <div key={i} className="flex gap-4 p-4 rounded-xl border border-white/15" style={{ background: 'rgba(0,0,0,0.45)' }}>
                      <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                      <div>
                        <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{i + 1}. {tip.title}</p>
                        <p className={`text-sm leading-relaxed ${isDark ? 'text-white/70' : 'text-slate-600'}`}>{tip.desc}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: 修復碼產生器（免費開放） */}
            {activeFixTab === 'code' && (
              <div className="space-y-6">
                {/* 補充資訊輸入區 */}
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">✏️</span>
                    <h4 className="text-sm font-semibold text-slate-700">補充商家資訊（選填）</h4>
                    <span className="text-xs text-slate-400">填入後程式碼即時更新</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: 'phone', label: '電話號碼', placeholder: '例：02-1234-5678', icon: '📞' },
                      { key: 'address', label: '地址', placeholder: '例：台北市信義區信義路五段7號', icon: '📍' },
                      { key: 'hours', label: '營業時間', placeholder: '例：Mo-Fr 09:00-18:00', icon: '🕐' },
                      { key: 'description', label: '品牌描述', placeholder: '簡短說明你的品牌與服務（留空則使用網站描述）', icon: '📝' },
                    ].map(({ key, label, placeholder, icon }) => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <span>{icon}</span>{label}
                        </label>
                        <input
                          type="text"
                          value={bizInfo[key]}
                          onChange={e => setBizInfo(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-3 py-2 text-xs rounded-lg border border-blue-200 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </div>
                    ))}
                  </div>
                </div>

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
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200 transition-colors flex-shrink-0"
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

          </div>
          </>
        </div>

        {/* 通知搜尋引擎 */}
        <div className="mt-6 bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📡</span>
              <div>
                <h3 className="font-bold text-slate-800 mb-1">通知搜尋引擎，讓 AI 更快找到你</h3>
                <p className="text-sm text-slate-500">向 Google 與 Bing 發送 Sitemap 更新通知，讓 AI 爬蟲優先重新索引你的網站內容。</p>
                {pingResult && (
                  <p className={`text-xs mt-2 font-medium ${pingResult.success ? 'text-green-600' : 'text-red-500'}`}>
                    {pingResult.success
                      ? `✓ 已成功通知 Google & Bing（${new Date(pingResult.pingedAt).toLocaleTimeString('zh-TW')}）`
                      : '✗ 通知失敗，請稍後再試'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handlePingEngines}
              disabled={pinging}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pinging ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  通知中...
                </>
              ) : '📡 立即通知'}
            </button>
          </div>
        </div>

        </>}

        {/* Email 通知訂閱 - 暫時停用
        <div className="bg-white/40 backdrop-blur-md rounded-2xl p-6 shadow-sm border border-white/60 mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xl">📧</span>
            <h3 className="font-semibold text-slate-800">Email 通知</h3>
            {isPro && emailSubscription && (
              <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                已訂閱週報
              </span>
            )}
            {!isPro && (
              <span className="ml-auto text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full font-semibold">Pro 功能</span>
            )}
          </div>
          <p className="text-sm text-slate-500 mb-5">
            訂閱後每週一早上自動收到本網站的 AI 能見度週報，或立即發送一份報告到信箱。
          </p>

          {!isPro ? (
            <div className="text-center py-4">
              <button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-60"
              >
                {upgrading ? '跳轉中...' : '🔒 升級 Pro，開啟 Email 週報'}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-orange-100 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm bg-white/60"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleEmailSubscribe}
                    disabled={emailLoading}
                    className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
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
            </>
          )}
        </div>
        */}

      </main>

      {/* Google 連接設定 Modal */}
      {showGoogleSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800">設定 Google 串接</h3>
              <button onClick={() => setShowGoogleSettings(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  GA4 Property ID
                  <span className="ml-1 text-slate-400 font-normal">（格式：123456789）</span>
                </label>
                <input
                  type="text"
                  value={ga4Input}
                  onChange={e => setGa4Input(e.target.value)}
                  placeholder="例：123456789"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">GA4 後台 → 管理 → 資源設定 → 資源 ID</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  GSC 屬性網址
                  <span className="ml-1 text-slate-400 font-normal">（需已在 GSC 驗證）</span>
                </label>
                <input
                  type="text"
                  value={gscInput}
                  onChange={e => setGscInput(e.target.value.trim())}
                  placeholder="https://www.example.com/"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-600">請依照 GSC 左上角顯示的格式填入：</p>
                  <p>・<span className="font-mono bg-white px-1 rounded">https://www.example.com/</span>　URL 前置詞（有 www）</p>
                  <p>・<span className="font-mono bg-white px-1 rounded">https://example.com/</span>　URL 前置詞（無 www）</p>
                  <p>・<span className="font-mono bg-white px-1 rounded">example.com</span>　網域資源（會自動轉換）</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveGoogleSettings}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
              >
                儲存並載入數據
              </button>
              <button
                onClick={handleDisconnectGoogle}
                className="px-4 py-2.5 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 transition-all"
              >
                中斷連接
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
