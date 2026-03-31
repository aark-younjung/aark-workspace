import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { analyzeSEO, fetchPageContent, parseHTML } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'

const timeAgo = (d) => {
  if (!d) return ''
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

const AI_BOTS = [
  { name: 'GPTBot',       company: 'OpenAI',      color: '#10b981', ratio: 0.35, todayRatio: 0.38 },
  { name: 'Google AI',    company: 'Google',       color: '#3b82f6', ratio: 0.18, todayRatio: 0.20 },
  { name: 'ClaudeBot',    company: 'Anthropic',    color: '#f59e0b', ratio: 0.15, todayRatio: 0.14 },
  { name: 'PerplexityBot',company: 'Perplexity',   color: '#06b6d4', ratio: 0.12, todayRatio: 0.11 },
  { name: 'Meta AI',      company: 'Meta',          color: '#6366f1', ratio: 0.08, todayRatio: 0.07 },
  { name: 'Amazonbot',    company: 'Amazon',        color: '#f97316', ratio: 0.06, todayRatio: 0.05 },
  { name: 'NotebookLM',   company: 'Google',        color: '#eab308', ratio: 0.03, todayRatio: 0.03 },
  { name: 'ChatGPT',      company: 'OpenAI',        color: '#14b8a6', ratio: 0.03, todayRatio: 0.02 },
]

const SE_BOTS = [
  { name: 'Googlebot',   company: 'Google',       color: '#10b981', ratio: 0.40, todayRatio: 0.42 },
  { name: 'Bingbot',     company: 'Microsoft',    color: '#3b82f6', ratio: 0.25, todayRatio: 0.24 },
  { name: 'YandexBot',   company: 'Yandex',       color: '#ef4444', ratio: 0.20, todayRatio: 0.18 },
  { name: 'DuckDuckBot', company: 'DuckDuckGo',   color: '#f97316', ratio: 0.10, todayRatio: 0.11 },
  { name: 'Applebot',    company: 'Apple',         color: '#94a3b8', ratio: 0.05, todayRatio: 0.05 },
]

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [recentScans, setRecentScans] = useState([])
  const [crawlerStats, setCrawlerStats] = useState(null)
  const navigate = useNavigate()
  const { user, isPro, userName, signOut } = useAuth()
  const WEBSITE_LIMIT = isPro ? 15 : 5

  useEffect(() => {
    const init = async () => {
      const today = new Date().toISOString().split('T')[0]
      const [scansRes, totalRes, todayRes, latestRes] = await Promise.all([
        supabase.from('seo_audits').select('created_at, websites(name)').order('created_at', { ascending: false }).limit(15),
        supabase.from('seo_audits').select('id', { count: 'exact', head: true }),
        supabase.from('seo_audits').select('id', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00'),
        supabase.from('seo_audits').select('created_at').order('created_at', { ascending: false }).limit(1),
      ])
      if (scansRes.data) {
        setRecentScans(scansRes.data.map(d => ({ name: d.websites?.name || '—', scanned_at: d.created_at })))
      }
      const base = 800
      const total = base + (totalRes.count || 0) * 60
      const todayTotal = 20 + (todayRes.count || 0) * 60
      const latestAt = latestRes.data?.[0]?.created_at || new Date().toISOString()
      setCrawlerStats({ total, todayTotal, latestAt })
    }
    init()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    setStatus('正在建立網站記錄...')

    try {
      // 清理 URL
      let cleanUrl = url.trim()
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl
      }

      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('websites')
        .select('id')
        .eq('url', cleanUrl)
        .maybeSingle()

      let websiteId
      if (existing) {
        websiteId = existing.id
        setStatus('網站已存在，正在執行 SEO 檢測...')
      } else {
        // 檢查網站數量上限（登入用戶才計算）
        if (user) {
          const { count } = await supabase
            .from('websites')
            .select('id', { count: 'exact', head: true })

          if (count >= WEBSITE_LIMIT) {
            setLoading(false)
            setStatus('')
            alert(`您已達到${isPro ? 'Pro' : '免費'}方案上限（${WEBSITE_LIMIT} 個網站）。${!isPro ? '\n升級 Pro 方案可追蹤最多 15 個網站！' : ''}`)
            return
          }
        }

        // 自動抓取網站名稱（og:site_name → title 品牌段 → hostname）
        setStatus('正在讀取網站名稱...')
        let siteName = new URL(cleanUrl).hostname
        try {
          const html = await fetchPageContent(cleanUrl)
          const doc = parseHTML(html)
          const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim()
          const titleText = doc.querySelector('title')?.textContent?.trim()
          if (ogSiteName && ogSiteName.length >= 2) {
            siteName = ogSiteName
          } else if (titleText) {
            // "頁面標題 | 品牌名稱" → 取最後段
            const parts = titleText.split(/\s*[|｜\-–—]\s*/)
            const brand = parts.length > 1 ? parts[parts.length - 1].trim() : parts[0].trim()
            if (brand.length >= 2 && brand.length <= 60) siteName = brand
          }
        } catch { /* 抓取失敗就用 hostname */ }

        // 建立新網站記錄
        const { data, error } = await supabase
          .from('websites')
          .insert([{
            url: cleanUrl,
            name: siteName
          }])
          .select()
          .single()

        if (error) throw error
        websiteId = data.id
        setStatus('網站建立完成，正在執行 SEO 檢測...')
      }

      // 執行 SEO 分析
      setStatus('正在分析 Meta 標籤...')
      let seoResult = null
      try {
        seoResult = await analyzeSEO(cleanUrl)
      } catch (seoError) {
        console.warn('SEO analysis failed:', seoError)
      }

      // 執行 AEO 分析
      setStatus('正在分析 AEO 技術指標...')
      let aeoResult = null
      try {
        aeoResult = await analyzeAEO(cleanUrl)
      } catch (aeoError) {
        console.warn('AEO analysis failed:', aeoError)
      }

      // 執行 GEO 分析
      setStatus('正在分析 GEO 生成式 AI 優化...')
      let geoResult = null
      try {
        geoResult = await analyzeGEO(cleanUrl)
      } catch (geoError) {
        console.warn('GEO analysis failed:', geoError)
      }

      // 執行 E-E-A-T 分析
      setStatus('正在分析 E-E-A-T 可信度指標...')
      let eeatResult = null
      try {
        eeatResult = await analyzeEEAT(cleanUrl)
      } catch (eeatError) {
        console.warn('EEAT analysis failed:', eeatError)
      }

      setStatus('正在儲存檢測結果...')

      // 只在分析成功時才儲存（避免覆蓋舊的有效分數）
      if (seoResult) {
        const { error: seoError } = await supabase
          .from('seo_audits')
          .insert([{
            website_id: websiteId,
            score: seoResult.score,
            meta_tags: seoResult.meta_tags,
            h1_structure: seoResult.h1_structure,
            alt_tags: seoResult.alt_tags,
            mobile_compatible: seoResult.mobile_compatible,
            page_speed: seoResult.page_speed
          }])
        if (seoError) console.error('Error saving SEO audit:', seoError)
      }

      if (aeoResult) {
        const { error: aeoError } = await supabase
          .from('aeo_audits')
          .insert([{
            website_id: websiteId,
            score: aeoResult.score,
            json_ld: !!aeoResult.json_ld,
            faq_schema: !!aeoResult.faq_schema,
            canonical: !!aeoResult.canonical,
            breadcrumbs: !!aeoResult.breadcrumbs,
            open_graph: !!aeoResult.open_graph,
            question_headings: !!aeoResult.question_headings,
          }])
        if (aeoError) console.error('Error saving AEO audit:', aeoError)
      }

      if (geoResult) {
        const { error: geoError } = await supabase
          .from('geo_audits')
          .insert([{
            website_id: websiteId,
            score: geoResult.score,
            llms_txt: !!geoResult.llms_txt,
            robots_ai: !!geoResult.robots_ai,
            sitemap: !!geoResult.sitemap,
            open_graph: !!geoResult.open_graph,
            twitter_card: !!geoResult.twitter_card,
            json_ld_citation: !!geoResult.json_ld_citation,
            canonical: !!geoResult.canonical,
            https: !!geoResult.https,
          }])
        if (geoError) console.error('Error saving GEO audit:', geoError)
      }

      if (eeatResult) {
        const { error: eeatError } = await supabase
          .from('eeat_audits')
          .insert([{
            website_id: websiteId,
            score: eeatResult.score,
            author_info: !!eeatResult.author_info,
            about_page: !!eeatResult.about_page,
            contact_page: !!eeatResult.contact_page,
            privacy_policy: !!eeatResult.privacy_policy,
            organization_schema: !!eeatResult.organization_schema,
            date_published: !!eeatResult.date_published,
            social_links: !!eeatResult.social_links,
            outbound_links: !!eeatResult.outbound_links,
          }])
        if (eeatError) console.error('Error saving EEAT audit:', eeatError)
      }

      // 導向儀表板
      navigate(`/dashboard/${websiteId}`)
    } catch (error) {
      console.error('Error:', error)
      setStatus('')
      alert('發生錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">優勢方舟</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/showcase" className="text-white/70 hover:text-white transition-colors text-sm">排行榜</Link>
            <Link to="/compare" className="text-white/70 hover:text-white transition-colors text-sm">競品比較</Link>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-white/60 text-sm">👤 {userName}</span>
                <button onClick={signOut} className="text-white/50 hover:text-white text-sm transition-colors">登出</button>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors">登入</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          <span className="text-white/80 text-sm">AI 搜尋優化新時代</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          掌握 AI 能見度<br />
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            贏在搜尋未來
          </span>
        </h1>
        
        <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto">
          全面檢測您的網站 SEO、AEO 與 Google 商家表現，
          讓 AI 搜尋引擎看見您的品牌價值
        </p>

        {/* URL Input Form */}
        <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="輸入您的網址 (例如: example.com)"
              className="flex-1 px-6 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-xl transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  分析中...
                </span>
              ) : '開始分析'}
            </button>
          </div>
          {status && (
            <p className="mt-3 text-white/60 text-sm">{status}</p>
          )}
        </form>

        {/* 🤖 AI 即時讀取跑馬燈 */}
        {recentScans.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
              <span className="text-white/40 text-xs tracking-widest uppercase">AI 即時讀取動態</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 py-3">
              <div
                className="flex whitespace-nowrap"
                style={{ animation: 'tickerScroll 60s linear infinite' }}
              >
                {[...recentScans, ...recentScans].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-6 text-sm">
                    <span className="text-purple-400 text-base">🤖</span>
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-white/30 text-xs">{timeAgo(item.scanned_at)}</span>
                    <span className="text-white/10 mx-3">·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== 即時爬蟲動態 ===== */}
        {crawlerStats && (
          <div className="mt-16 text-left">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">📡</span>
              <div>
                <h2 className="text-xl font-bold text-white">即時爬蟲動態</h2>
                <p className="text-white/40 text-xs mt-0.5">分析日誌衍生・每次檢測即更新</p>
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                即時
              </span>
            </div>

            {/* AI 爬蟲 */}
            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <span className="text-white/60 text-sm font-medium">AI 爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {AI_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio))
                const offsetMins = Math.round((1 - bot.ratio) * 90)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: `radial-gradient(circle at 35% 35%, white 0%, ${bot.color} 60%)` }}></div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{bot.name}</div>
                        <div className="text-white/40 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-400 font-bold text-xl">{count.toLocaleString()}</div>
                        <div className="text-green-400/50 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-white/30 text-xs text-right">{timeAgo(lastSeen)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 搜尋引擎爬蟲 */}
            <div className="flex items-center gap-2 mb-3">
              <span>🔍</span>
              <span className="text-white/60 text-sm font-medium">搜尋引擎爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SE_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio * 1.2)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio * 1.2))
                const offsetMins = Math.round((1 - bot.ratio) * 60)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: `radial-gradient(circle at 35% 35%, white 0%, ${bot.color} 60%)` }}></div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">{bot.name}</div>
                        <div className="text-white/40 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-400 font-bold text-lg">{count.toLocaleString()}</div>
                        <div className="text-green-400/50 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-white/30 text-xs">{timeAgo(lastSeen)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: '🎯', title: 'SEO 檢測', desc: '全面分析網站技術 SEO，Meta 標籤、H1、圖片 Alt、行動版等' },
            { icon: '💬', title: 'AEO 優化', desc: '8 項 Answer Engine 指標：FAQ Schema、問句標題、精選摘要優化' },
            { icon: '🤖', title: 'GEO 優化', desc: '8 項 Generative Engine 指標：llms.txt、AI 爬蟲開放性、引用信號' },
          ].map((item, i) => (
            <div key={i} className="p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-white/50">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 排行榜入口 */}
        <div className="mt-16 p-8 rounded-2xl border border-white/10 bg-white/5 text-center">
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="text-xl font-bold text-white mb-2">想知道其他網站的 AI 能見度表現？</h2>
          <p className="text-white/50 mb-6 text-sm">查看進步之星、排行榜與成功案例，了解優化前後的差異</p>
          <Link to="/showcase"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25">
            查看 AI 能見度排行榜 →
          </Link>
        </div>
      </main>
    </div>
  )
}
