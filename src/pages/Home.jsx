import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const navigate = useNavigate()
  const { user, userName, signOut } = useAuth()

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
        // 建立新網站記錄
        const { data, error } = await supabase
          .from('websites')
          .insert([{ 
            url: cleanUrl, 
            name: new URL(cleanUrl).hostname 
          }])
          .select()
          .single()
        
        if (error) throw error
        websiteId = data.id
        setStatus('網站建立完成，正在執行 SEO 檢測...')
      }

      // 執行 SEO 分析
      setStatus('正在分析 Meta 標籤...')
      let seoResult
      try {
        seoResult = await analyzeSEO(cleanUrl)
      } catch (seoError) {
        console.warn('SEO analysis failed:', seoError)
        seoResult = { score: 0, meta_tags: {}, h1_structure: {}, alt_tags: {}, mobile_compatible: {}, page_speed: {} }
      }
      
      // 執行 AEO 分析
      setStatus('正在分析 AEO 技術指標...')
      let aeoResult
      try {
        aeoResult = await analyzeAEO(cleanUrl)
      } catch (aeoError) {
        console.warn('AEO analysis failed:', aeoError)
        aeoResult = { score: 0, json_ld: false, faq_schema: false, canonical: false, breadcrumbs: false, open_graph: false, question_headings: false }
      }

      // 執行 GEO 分析
      setStatus('正在分析 GEO 生成式 AI 優化...')
      let geoResult
      try {
        geoResult = await analyzeGEO(cleanUrl)
      } catch (geoError) {
        console.warn('GEO analysis failed:', geoError)
        geoResult = { score: 0, llms_txt: false, robots_ai: false, sitemap: false, open_graph: false, twitter_card: false, json_ld_citation: false, canonical: false, https: false }
      }

      // 執行 E-E-A-T 分析
      setStatus('正在分析 E-E-A-T 可信度指標...')
      let eeatResult
      try {
        eeatResult = await analyzeEEAT(cleanUrl)
      } catch (eeatError) {
        console.warn('EEAT analysis failed:', eeatError)
        eeatResult = { score: 0, author_info: false, about_page: false, contact_page: false, privacy_policy: false, organization_schema: false, date_published: false, social_links: false, outbound_links: false }
      }

      setStatus('正在儲存檢測結果...')

      // 儲存 SEO 審計結果到資料庫（直接存物件，Supabase 支援 JSONB）
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

      if (seoError) {
        console.error('Error saving SEO audit:', seoError)
      }

      // 儲存 AEO 審計結果到資料庫
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

      if (aeoError) {
        console.error('Error saving AEO audit:', aeoError)
      }

      // 儲存 GEO 審計結果到資料庫
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

      // 儲存 E-E-A-T 審計結果到資料庫
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
