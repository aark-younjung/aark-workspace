import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'

const scoreColor = (s) => s >= 70 ? 'text-green-500' : s >= 40 ? 'text-yellow-500' : 'text-red-400'
const scoreBg = (s) => s >= 70 ? 'bg-green-500/20 border-green-500/30' : s >= 40 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30'
const scoreBar = (s) => s >= 70 ? 'bg-green-400' : s >= 40 ? 'bg-yellow-400' : 'bg-red-400'

// 每個網站的主色（最多4個）
const SITE_COLORS = [
  { border: 'border-orange-400', bg: 'bg-orange-50', badge: 'bg-orange-500', text: 'text-orange-600', bar: 'bg-orange-400', ring: 'ring-orange-300' },
  { border: 'border-blue-400',   bg: 'bg-blue-50',   badge: 'bg-blue-500',   text: 'text-blue-600',   bar: 'bg-blue-400',   ring: 'ring-blue-300' },
  { border: 'border-violet-400', bg: 'bg-violet-50', badge: 'bg-violet-500', text: 'text-violet-600', bar: 'bg-violet-400', ring: 'ring-violet-300' },
  { border: 'border-emerald-400',bg: 'bg-emerald-50',badge: 'bg-emerald-500',text: 'text-emerald-600',bar: 'bg-emerald-400',ring: 'ring-emerald-300' },
]

const SEO_CHECKS = [
  { key: 'meta_tags',         label: 'Meta 標籤',       getValue: r => r.seo?.meta_tags?.hasTitle && r.seo?.meta_tags?.hasDescription },
  { key: 'h1_structure',      label: 'H1 結構',         getValue: r => r.seo?.h1_structure?.hasOnlyOneH1 },
  { key: 'alt_tags',          label: '圖片 Alt',        getValue: r => r.seo?.alt_tags?.allHaveAlt },
  { key: 'mobile_compatible', label: '行動裝置',         getValue: r => r.seo?.mobile_compatible?.isCompatible },
  { key: 'page_speed',        label: '頁面速度',         getValue: r => r.seo?.page_speed?.isAcceptable },
]

const AEO_CHECKS = [
  { key: 'json_ld',           label: 'JSON-LD 結構化資料',   getValue: r => r.aeo?.json_ld },
  { key: 'faq_schema',        label: 'FAQ Schema',           getValue: r => r.aeo?.faq_schema },
  { key: 'canonical',         label: 'Canonical 標籤',       getValue: r => r.aeo?.canonical },
  { key: 'breadcrumbs',       label: '麵包屑導航',            getValue: r => r.aeo?.breadcrumbs },
  { key: 'open_graph',        label: 'Open Graph',           getValue: r => r.aeo?.open_graph },
  { key: 'question_headings', label: '問句式標題',            getValue: r => r.aeo?.question_headings },
  { key: 'meta_desc_length',  label: 'Meta 描述長度',        getValue: r => r.aeo?.meta_desc_length },
  { key: 'structured_answer', label: '結構化答案段落',        getValue: r => r.aeo?.structured_answer },
]

const EEAT_CHECKS = [
  { key: 'author_info',         label: '作者資訊',           getValue: r => r.eeat?.author_info },
  { key: 'about_page',          label: '關於我們頁面',       getValue: r => r.eeat?.about_page },
  { key: 'contact_page',        label: '聯絡方式',           getValue: r => r.eeat?.contact_page },
  { key: 'privacy_policy',      label: '隱私權政策',         getValue: r => r.eeat?.privacy_policy },
  { key: 'organization_schema', label: 'Organization Schema', getValue: r => r.eeat?.organization_schema },
  { key: 'date_published',      label: '發布日期',           getValue: r => r.eeat?.date_published },
  { key: 'social_links',        label: '社群媒體連結',       getValue: r => r.eeat?.social_links },
  { key: 'outbound_links',      label: '外部權威連結',       getValue: r => r.eeat?.outbound_links },
]

const GEO_CHECKS = [
  { key: 'llms_txt',          label: 'llms.txt',             getValue: r => r.geo?.llms_txt },
  { key: 'robots_ai',         label: 'AI 爬蟲開放',          getValue: r => r.geo?.robots_ai },
  { key: 'sitemap',           label: 'Sitemap',              getValue: r => r.geo?.sitemap },
  { key: 'open_graph',        label: 'Open Graph',           getValue: r => r.geo?.open_graph },
  { key: 'twitter_card',      label: 'Twitter Card',         getValue: r => r.geo?.twitter_card },
  { key: 'json_ld_citation',  label: 'JSON-LD 引用信號',     getValue: r => r.geo?.json_ld_citation },
  { key: 'canonical',         label: 'Canonical',            getValue: r => r.geo?.canonical },
  { key: 'https',             label: 'HTTPS',                getValue: r => r.geo?.https },
]

const cleanUrl = (url) => {
  let u = url.trim()
  if (u && !u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u
  return u
}

const getHostname = (url) => {
  try { return new URL(url).hostname } catch { return url }
}

export default function Compare() {
  const { user, isPro, userName, signOut } = useAuth()
  const { isDark } = useTheme()
  const MAX_URLS = isPro ? 4 : 2
  const [urls, setUrls] = useState(['', ''])
  const [results, setResults] = useState([])
  const [loadingStates, setLoadingStates] = useState([])
  const [analyzed, setAnalyzed] = useState(false)
  const [myWebsites, setMyWebsites] = useState([])

  // 載入使用者的網站，自動帶入第一格
  useEffect(() => {
    if (!user) return
    supabase
      .from('websites')
      .select('id, name, url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        if (!data?.length) return
        setMyWebsites(data)
        // 第一格還沒填時，自動帶入最近分析的網站
        setUrls(prev => prev[0] === '' ? [data[0].url, ...prev.slice(1)] : prev)
      })
  }, [user])

  const addUrl = () => { if (urls.length < MAX_URLS) setUrls([...urls, '']) }
  const removeUrl = (i) => { if (urls.length > 2) setUrls(urls.filter((_, idx) => idx !== i)) }
  const updateUrl = (i, val) => setUrls(urls.map((u, idx) => idx === i ? val : u))

  const handleCompare = async () => {
    const cleaned = urls.map(cleanUrl).filter(Boolean)
    if (cleaned.length < 2) return alert('請至少輸入 2 個網址')

    setAnalyzed(false)
    setResults([])
    setLoadingStates(cleaned.map(() => '等待中'))

    // 逐個網站依序分析，避免並行請求過多導致 Serverless Function 失敗
    const all = []
    for (let idx = 0; idx < cleaned.length; idx++) {
      const url = cleaned[idx]
      setLoadingStates(prev => prev.map((s, i) => i === idx ? '分析中...' : s))
      try {
        const seo = await analyzeSEO(url).catch(() => ({ score: 0 }))
        const aeo = await analyzeAEO(url).catch(() => ({ score: 0 }))
        const geo = await analyzeGEO(url).catch(() => ({ score: 0 }))
        const eeat = await analyzeEEAT(url).catch(() => ({ score: 0 }))
        const total = Math.round(((seo.score || 0) + (aeo.score || 0) + (geo.score || 0) + (eeat.score || 0)) / 4)
        const result = { url, hostname: getHostname(url), seo, aeo, geo, eeat, total }
        all.push(result)
        setLoadingStates(prev => prev.map((s, i) => i === idx ? '完成' : s))
        setResults([...all])
      } catch {
        const result = { url, hostname: getHostname(url), seo: { score: 0 }, aeo: { score: 0 }, geo: { score: 0 }, eeat: { score: 0 }, total: 0 }
        all.push(result)
        setLoadingStates(prev => prev.map((s, i) => i === idx ? '失敗' : s))
        setResults([...all])
      }
    }
    setAnalyzed(true)
  }

  // 找出每個分數欄最高值（用來標示贏家）
  const getWinner = (vals) => {
    const max = Math.max(...vals)
    return vals.map(v => v === max && max > 0)
  }

  const seoWinners = analyzed ? getWinner(results.map(r => r.seo?.score || 0)) : []
  const aeoWinners = analyzed ? getWinner(results.map(r => r.aeo?.score || 0)) : []
  const geoWinners = analyzed ? getWinner(results.map(r => r.geo?.score || 0)) : []
  const eeatWinners = analyzed ? getWinner(results.map(r => r.eeat?.score || 0)) : []
  const totalWinners = analyzed ? getWinner(results.map(r => r.total)) : []

  const isLoading = loadingStates.length > 0 && loadingStates.some(s => s === '分析中...')

  return (
    <div className="min-h-screen relative" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, opacity: 0.30, mixBlendMode: 'multiply' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={isDark ? "/dark" : "/"} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-200 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800">優勢方舟數位行銷</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/showcase" className="hidden sm:block text-slate-600 hover:text-slate-900 transition-colors text-sm">排行榜</Link>
            <Link to={isDark ? "/dark" : "/"} className="hidden sm:block text-slate-600 hover:text-slate-900 transition-colors text-sm">免費檢測</Link>
            {user ? (
              <>
                {!isPro && <Link to="/pricing" className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors font-medium">升級 Pro</Link>}
                <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0" title={userName || user.email}>
                  {user?.user_metadata?.avatar_url
                    ? <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">{(userName || user?.email || '?').slice(0, 2).toUpperCase()}</div>
                  }
                </Link>
                <button onClick={signOut} className="text-slate-400 hover:text-slate-700 text-xs sm:text-sm transition-colors">登出</button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* 標題 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">競品比較分析</h1>
          <p className="text-gray-500">
            {isPro ? '同時比較最多 4 個網站的 SEO、AEO、GEO 分數與檢測項目' : '免費版可比較 2 個網站，升級 Pro 最多比較 4 個'}
          </p>
        </div>

        {/* URL 輸入區 */}
        <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-8 mb-10">
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={e => updateUrl(i, e.target.value)}
                  placeholder={i === 0 ? '您的網站 (例如: yoursite.com)' : `競品 ${i} (例如: competitor${i}.com)`}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/60 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm disabled:opacity-50"
                />
                {urls.length > 2 && (
                  <button onClick={() => removeUrl(i)} disabled={isLoading}
                    className="text-gray-400 hover:text-red-400 transition-colors text-lg disabled:opacity-30">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 我的網站快速選擇 */}
          {myWebsites.length > 0 && (
            <div className="mb-5 pb-5 border-b border-orange-100">
              <p className="text-xs text-slate-400 mb-2">📂 快速填入我的網站</p>
              <div className="flex flex-wrap gap-2">
                {myWebsites.map((site, i) => (
                  <button
                    key={site.id}
                    disabled={isLoading}
                    onClick={() => {
                      // 找第一個空格填入，否則填入第一格
                      const emptyIdx = urls.findIndex(u => !u.trim())
                      const targetIdx = emptyIdx !== -1 ? emptyIdx : 0
                      setUrls(prev => prev.map((u, idx) => idx === targetIdx ? site.url : u))
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                      urls.includes(site.url)
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'bg-white/60 border-orange-100 text-slate-600 hover:border-orange-300 hover:text-orange-600'
                    }`}
                  >
                    {urls.includes(site.url) && <span className="text-orange-400">✓</span>}
                    <span className="max-w-[140px] truncate">{site.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            {urls.length < MAX_URLS && (
              <button onClick={addUrl} disabled={isLoading}
                className="px-4 py-2 bg-orange-100 border border-orange-200 text-gray-500 hover:text-gray-800 rounded-lg text-sm transition-colors disabled:opacity-30">
                + 新增競品
              </button>
            )}
            {!isPro && urls.length >= MAX_URLS && (
              <Link to="/dashboard" className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 text-orange-600 rounded-lg text-sm hover:bg-orange-500/30 transition-colors">
                🔒 升級 Pro 比較最多 4 個網站
              </Link>
            )}
            <button onClick={handleCompare} disabled={isLoading}
              className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-200">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  分析中...
                </span>
              ) : '開始比較'}
            </button>
          </div>

          {/* 各網站載入狀態 */}
          {loadingStates.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-5">
              {loadingStates.map((state, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                  state === '完成' ? 'bg-green-500/10 border-green-500/20 text-green-600' :
                  state === '失敗' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  'bg-white/40 border-orange-100 text-gray-500'}`}>
                  {state === '分析中...' && <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>}
                  {state === '完成' && '✓'}
                  {state === '失敗' && '✗'}
                  <span>{urls[i] ? getHostname(cleanUrl(urls[i])) : `網站 ${i + 1}`}</span>
                  <span className="text-xs opacity-60">{state}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 比較結果 */}
        {analyzed && results.length > 0 && (
          <>
            {/* 總分概覽 */}
            <div className={`grid gap-4 mb-10 ${results.length === 2 ? 'sm:grid-cols-2' : results.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} grid-cols-1`}>
              {results.map((r, i) => {
                const c = SITE_COLORS[i % SITE_COLORS.length]
                return (
                  <div key={i} className={`relative rounded-2xl border-2 ${totalWinners[i] ? 'border-yellow-400 shadow-lg shadow-yellow-100' : c.border} bg-white/70 backdrop-blur-md overflow-hidden`}>
                    {/* 頂部色條 */}
                    <div className={`h-1.5 w-full ${totalWinners[i] ? 'bg-gradient-to-r from-yellow-400 to-amber-400' : c.badge}`} />
                    <div className="p-5">
                      {/* 名稱 + 名次 */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full ${c.badge} text-white text-xs font-bold flex items-center justify-center`}>{i + 1}</span>
                        <span className="text-slate-600 text-xs font-medium truncate">{r.hostname}</span>
                        {totalWinners[i] && <span className="ml-auto text-xs">🏆</span>}
                      </div>

                      {/* 大總分 */}
                      <div className="flex items-end gap-2 mb-4">
                        <span className={`text-5xl font-black ${scoreColor(r.total)}`}>{r.total}</span>
                        <span className="text-slate-400 text-sm mb-1">/ 100</span>
                      </div>

                      {/* 圓弧進度條 */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                        <div className={`h-2 rounded-full transition-all duration-700 ${scoreBar(r.total)}`} style={{ width: `${r.total}%` }} />
                      </div>

                      {/* 四項分數 */}
                      <div className="space-y-2.5">
                        {[
                          ['SEO', r.seo?.score || 0, seoWinners[i]],
                          ['AEO', r.aeo?.score || 0, aeoWinners[i]],
                          ['GEO', r.geo?.score || 0, geoWinners[i]],
                          ['E-E-A-T', r.eeat?.score || 0, eeatWinners[i]],
                        ].map(([label, score, winner]) => (
                          <div key={label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-medium ${winner ? c.text : 'text-slate-400'}`}>
                                {label} {winner ? '↑' : ''}
                              </span>
                              <span className={`text-xs font-bold ${scoreColor(score)}`}>{score}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${winner ? c.bar : scoreBar(score)}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 詳細比較表 */}
            {[
              { title: '🔍 SEO 檢測項目', checks: SEO_CHECKS },
              { title: '💬 AEO 檢測項目', checks: AEO_CHECKS },
              { title: '🤖 GEO 檢測項目', checks: GEO_CHECKS },
              { title: '🛡️ E-E-A-T 可信度', checks: EEAT_CHECKS },
            ].map(({ title, checks }) => (
              <div key={title} className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
                <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 overflow-hidden">
                  {/* 表頭 */}
                  <div className={`grid gap-2 px-6 py-3 border-b border-orange-100 text-xs font-medium`}
                    style={{ gridTemplateColumns: `1fr ${results.map(() => '1fr').join(' ')}` }}>
                    <div className="text-gray-400">檢測項目</div>
                    {results.map((r, i) => {
                      const c = SITE_COLORS[i % SITE_COLORS.length]
                      return (
                        <div key={i} className="flex justify-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${c.bg} ${c.text} truncate max-w-full`}>
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.badge}`} />
                            <span className="truncate">{r.hostname}</span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {/* 每一列 */}
                  {checks.map(({ key, label, getValue }) => {
                    const vals = results.map(r => getValue(r))
                    const passCount = vals.filter(Boolean).length
                    return (
                      <div key={key}
                        className="grid gap-2 px-6 py-3 border-b border-orange-50 last:border-0 hover:bg-white/30 transition-colors items-center"
                        style={{ gridTemplateColumns: `1fr ${results.map(() => '1fr').join(' ')}` }}>
                        <div className="text-gray-500 text-sm">{label}</div>
                        {vals.map((v, i) => {
                          const c = SITE_COLORS[i % SITE_COLORS.length]
                          return (
                            <div key={i} className="flex justify-center">
                              {v
                                ? <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600 text-sm font-bold`}>✓</span>
                                : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-300 text-sm">✗</span>
                              }
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* 優劣分析摘要 */}
            <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-8">
              <h2 className="text-xl font-bold text-gray-800 mb-6">📊 比較摘要</h2>
              <div className={`grid gap-4 ${results.length === 2 ? 'grid-cols-2' : results.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {results.map((r, i) => {
                  const allChecks = [...SEO_CHECKS, ...AEO_CHECKS, ...GEO_CHECKS, ...EEAT_CHECKS]
                  const passCount = allChecks.filter(c => c.getValue(r)).length
                  const totalCount = allChecks.length
                  return (
                    <div key={i} className={`p-5 rounded-xl border ${totalWinners[i] ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/60'}`}>
                      <div className="text-gray-800 font-medium mb-1 truncate">{r.hostname}</div>
                      <div className="text-gray-400 text-xs mb-4">通過 {passCount} / {totalCount} 項</div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full ${passCount / totalCount >= 0.7 ? 'bg-green-400' : passCount / totalCount >= 0.4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${(passCount / totalCount) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
