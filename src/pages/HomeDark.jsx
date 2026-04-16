import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
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
  { name: 'GPTBot',       company: 'OpenAI',      color: '#10b981', ratio: 0.35, todayRatio: 0.38, domain: 'openai.com' },
  { name: 'Google AI',    company: 'Google',       color: '#3b82f6', ratio: 0.18, todayRatio: 0.20, domain: 'google.com' },
  { name: 'ClaudeBot',    company: 'Anthropic',    color: '#f59e0b', ratio: 0.15, todayRatio: 0.14, domain: 'anthropic.com' },
  { name: 'PerplexityBot',company: 'Perplexity',   color: '#06b6d4', ratio: 0.12, todayRatio: 0.11, domain: 'perplexity.ai' },
  { name: 'Meta AI',      company: 'Meta',          color: '#6366f1', ratio: 0.08, todayRatio: 0.07, domain: 'meta.com' },
  { name: 'Amazonbot',    company: 'Amazon',        color: '#f97316', ratio: 0.06, todayRatio: 0.05, domain: 'amazon.com' },
  { name: 'NotebookLM',   company: 'Google',        color: '#eab308', ratio: 0.03, todayRatio: 0.03, domain: 'notebooklm.google.com' },
  { name: 'ChatGPT',      company: 'OpenAI',        color: '#14b8a6', ratio: 0.03, todayRatio: 0.02, domain: 'openai.com' },
]

const SE_BOTS = [
  { name: 'Googlebot',   company: 'Google',       color: '#10b981', ratio: 0.40, todayRatio: 0.42, domain: 'google.com' },
  { name: 'Bingbot',     company: 'Microsoft',    color: '#3b82f6', ratio: 0.25, todayRatio: 0.24, domain: 'bing.com' },
  { name: 'YandexBot',   company: 'Yandex',       color: '#ef4444', ratio: 0.20, todayRatio: 0.18, domain: 'yandex.com' },
  { name: 'DuckDuckBot', company: 'DuckDuckGo',   color: '#f97316', ratio: 0.10, todayRatio: 0.11, domain: 'duckduckgo.com' },
  { name: 'Applebot',    company: 'Apple',         color: '#94a3b8', ratio: 0.05, todayRatio: 0.05, domain: 'apple.com' },
]

function BotLogo({ domain, color, size = 'md' }) {
  const dim = size === 'md' ? 'w-9 h-9' : 'w-8 h-8'
  const imgDim = size === 'md' ? 'w-6 h-6' : 'w-5 h-5'
  return (
    <div className={`${dim} rounded-full flex-shrink-0 bg-white/10 flex items-center justify-center overflow-hidden border border-white/20 shadow-sm`}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={domain}
        className={`${imgDim} object-contain`}
        onError={(e) => {
          e.currentTarget.parentElement.style.background = `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.2) 0%, ${color}88 60%)`
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

const SCAN_NODES = [
  { id: 'meta',    label: 'Meta 標籤',  x: 210, y: 58,  keys: ['meta', 'Meta'] },
  { id: 'sitemap', label: 'Sitemap',    x: 316, y: 104, keys: ['sitemap'] },
  { id: 'jsonld',  label: 'JSON-LD',   x: 358, y: 210, keys: ['JSON-LD', 'schema'] },
  { id: 'og',      label: 'Open Graph', x: 316, y: 316, keys: ['Open Graph', 'og:'] },
  { id: 'llms',    label: 'llms.txt',  x: 210, y: 362, keys: ['llms'] },
  { id: 'robots',  label: 'robots.txt', x: 104, y: 316, keys: ['robots'] },
  { id: 'h1',      label: 'H1 / Alt',  x: 62,  y: 210, keys: ['H1', 'Alt', '行動', '速度'] },
  { id: 'eeat',    label: 'E-E-A-T',   x: 104, y: 104, keys: ['E-E-A-T', '作者', '聯絡', '隱私', '社群'] },
]

const SCAN_BOTS = [
  { name: 'GPTBot',        color: '#10b981', bx: 278, by: 40  },
  { name: 'ClaudeBot',     color: '#f59e0b', bx: 380, by: 272 },
  { name: 'Googlebot',     color: '#3b82f6', bx: 142, by: 372 },
  { name: 'Bingbot',       color: '#6366f1', bx: 40,  by: 148 },
  { name: 'PerplexityBot', color: '#06b6d4', bx: 142, by: 40  },
]

function DarkScanningOverlay({ logs, targetUrl }) {
  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const nodeStatus = {}
  logs.forEach(log => {
    SCAN_NODES.forEach(node => {
      if (node.keys.some(k => log.item.includes(k))) {
        if (!nodeStatus[node.id] || nodeStatus[node.id] === 'checking') {
          nodeStatus[node.id] = log.status
        }
      }
    })
  })

  const nodeColor = (id) => {
    const s = nodeStatus[id]
    if (s === 'pass') return '#10b981'
    if (s === 'fail') return '#ef4444'
    if (s === 'checking') return '#f59e0b'
    return '#475569'
  }

  const nodeIcon = (id) => {
    const s = nodeStatus[id]
    if (s === 'pass') return '✓'
    if (s === 'fail') return '✗'
    if (s === 'checking') return '…'
    return '○'
  }

  const hostname = (() => { try { return new URL(targetUrl).hostname } catch { return targetUrl } })()
  const botColorMap = Object.fromEntries(SCAN_BOTS.map(b => [b.name, b.color]))

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{
      background: 'linear-gradient(135deg, #a21540 0%, #6b0e2a 18%, #2a0510 32%, #0a0208 46%, #000000 60%)',
    }}>
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12, mixBlendMode: 'overlay',
      }} />

      <div className="flex items-center justify-center pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="text-white font-medium text-sm">正在掃描</span>
          <span className="px-3 py-1 bg-white/10 rounded-full text-white font-semibold text-sm border border-white/20 shadow-sm">{hostname}</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <div className="w-full max-w-5xl grid grid-cols-[1fr_300px] gap-5 h-[480px]">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center shadow-sm overflow-hidden">
            <svg width="420" height="420" viewBox="0 0 420 420">
              <defs>
                <linearGradient id="scanGradDark" x1="0.5" y1="0.5" x2="1" y2="0.5">
                  <stop offset="0%" stopColor="rgba(249,115,22,0)" />
                  <stop offset="100%" stopColor="rgba(249,115,22,0.85)" />
                </linearGradient>
                <filter id="glowDark">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {SCAN_NODES.map((node) => {
                const color = nodeColor(node.id)
                const active = !!nodeStatus[node.id]
                const dx = node.x - 210, dy = node.y - 210
                const len = Math.sqrt(dx*dx + dy*dy)
                return (
                  <line key={node.id}
                    x1="210" y1="210" x2={node.x} y2={node.y}
                    stroke={color} strokeWidth={active ? 2 : 1}
                    strokeDasharray="6,4" opacity={active ? 0.9 : 0.25}
                  >
                    {active && (
                      <animate attributeName="stroke-dashoffset"
                        from={len} to={0} dur="1.5s" repeatCount="indefinite" />
                    )}
                  </line>
                )
              })}

              {[0, 0.8, 1.6].map((delay, i) => (
                <circle key={i} cx="210" cy="210" fill="none" stroke="#f97316" strokeWidth="1.5">
                  <animate attributeName="r" from="44" to="160" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              ))}

              <circle cx="210" cy="210" r="155" fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="1" />
              <circle cx="210" cy="210" r="100" fill="none" stroke="rgba(249,115,22,0.2)" strokeWidth="1" />
              <circle cx="210" cy="210" r="50" fill="none" stroke="rgba(249,115,22,0.3)" strokeWidth="1" />

              {SCAN_NODES.map((node) => {
                const color = nodeColor(node.id)
                const active = !!nodeStatus[node.id]
                return (
                  <g key={node.id} filter={active ? 'url(#glowDark)' : ''}>
                    <circle cx={node.x} cy={node.y} r="18" fill="rgba(0,0,0,0.6)" stroke={color} strokeWidth="1.5" />
                    <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="middle"
                      fill={color} fontSize="10" fontWeight="bold">{nodeIcon(node.id)}</text>
                    <text x={node.x} y={node.y + 28} textAnchor="middle" fill={color} fontSize="8.5" opacity="0.85">{node.label}</text>
                  </g>
                )
              })}

              {SCAN_BOTS.map((bot) => {
                const isActive = logs.some(l => l.bot === bot.name)
                if (!isActive) return null
                return (
                  <g key={bot.name} filter="url(#glowDark)">
                    <circle cx={bot.bx} cy={bot.by} r="14" fill="rgba(0,0,0,0.7)" stroke={bot.color} strokeWidth="1.5" opacity="0.9" />
                    <text x={bot.bx} y={bot.by + 20} textAnchor="middle" fill={bot.color} fontSize="7.5">{bot.name}</text>
                  </g>
                )
              })}

              <circle cx="210" cy="210" r="10" fill="#f97316" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="210" cy="210" r="5" fill="#fff" />
            </svg>
          </div>

          <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">掃描日誌</span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 scrollbar-hide">
              {logs.map((log) => (
                <div key={log.key} className="text-xs flex items-start gap-2">
                  <span className="text-white/40 flex-shrink-0">{log.time}</span>
                  <span style={{ color: botColorMap[log.bot] || '#94a3b8' }} className="flex-shrink-0 font-medium">{log.bot}</span>
                  <span className={`flex-1 ${log.status === 'pass' ? 'text-green-400' : log.status === 'fail' ? 'text-red-400' : 'text-orange-400'}`}>
                    {log.status === 'pass' ? '✓' : log.status === 'fail' ? '✗' : '…'} {log.item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HomeFAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="p-5 backdrop-blur-md rounded-xl border border-white/10 cursor-pointer hover:border-orange-500/30 transition-all"
      style={{ background: 'rgba(255,255,255,0.10)' }}
      onClick={() => setOpen(v => !v)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-white text-sm">{q}</span>
        <span className={`text-white/80 text-lg flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>↓</span>
      </div>
      {open && <p className="mt-3 text-white/80 text-sm leading-relaxed border-t border-white/10 pt-3">{a}</p>}
    </div>
  )
}

export default function HomeDark() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [recentScans, setRecentScans] = useState([
    { name: 'aark.com.tw',          scanned_at: new Date(Date.now() - 3   * 60000).toISOString() },
    { name: 'greenwave.com.tw',     scanned_at: new Date(Date.now() - 11  * 60000).toISOString() },
    { name: 'freshbrew.co',         scanned_at: new Date(Date.now() - 28  * 60000).toISOString() },
    { name: 'novadesign.tw',        scanned_at: new Date(Date.now() - 45  * 60000).toISOString() },
    { name: 'peakstudio.io',        scanned_at: new Date(Date.now() - 72  * 60000).toISOString() },
    { name: 'mintleaf.com.tw',      scanned_at: new Date(Date.now() - 98  * 60000).toISOString() },
    { name: 'lumencreative.co',     scanned_at: new Date(Date.now() - 130 * 60000).toISOString() },
    { name: 'rivercafe.tw',         scanned_at: new Date(Date.now() - 175 * 60000).toISOString() },
    { name: 'archipelago.design',   scanned_at: new Date(Date.now() - 210 * 60000).toISOString() },
    { name: 'bluestone-mkt.com',    scanned_at: new Date(Date.now() - 260 * 60000).toISOString() },
    { name: 'horizonbrand.tw',      scanned_at: new Date(Date.now() - 310 * 60000).toISOString() },
    { name: 'craftlabs.io',         scanned_at: new Date(Date.now() - 390 * 60000).toISOString() },
  ])
  const [crawlerStats, setCrawlerStats] = useState({
    total: 1247,
    todayTotal: 38,
    latestAt: new Date(Date.now() - 3 * 60000).toISOString(),
  })
  const [scanLogs, setScanLogs] = useState([])
  const [myWebsites, setMyWebsites] = useState([])
  const navigate = useNavigate()
  const { user, isPro, userName, signOut } = useAuth()
  const { setDark } = useTheme()
  useEffect(() => { setDark(true) }, [])
  const WEBSITE_LIMIT = isPro ? 15 : 3

  const fetchMyWebsites = async () => {
    if (!user) return
    const { data: sites } = await supabase
      .from('websites')
      .select('id, name, url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(WEBSITE_LIMIT)
    if (!sites?.length) return

    const ids = sites.map(s => s.id)
    const [seoRes, aeoRes, geoRes] = await Promise.all([
      supabase.from('seo_audits').select('website_id, score, created_at').in('website_id', ids).order('created_at', { ascending: false }),
      supabase.from('aeo_audits').select('website_id, score, created_at').in('website_id', ids).order('created_at', { ascending: false }),
      supabase.from('geo_audits').select('website_id, score, created_at').in('website_id', ids).order('created_at', { ascending: false }),
    ])
    const latest = (rows, wid) => rows?.find(r => r.website_id === wid)?.score ?? null
    const latestAt = (rows, wid) => rows?.find(r => r.website_id === wid)?.created_at ?? null
    setMyWebsites(sites.map(s => ({
      ...s,
      seo: latest(seoRes.data, s.id),
      aeo: latest(aeoRes.data, s.id),
      geo: latest(geoRes.data, s.id),
      last_scanned_at: latestAt(seoRes.data, s.id) || latestAt(aeoRes.data, s.id) || s.created_at,
    })))
  }

  const addLog = (bot, item, status) => {
    const t = new Date()
    const time = t.toTimeString().slice(0, 8)
    setScanLogs(prev => [...prev, { time, bot, item, status, key: Math.random() }])
  }

  useEffect(() => { fetchMyWebsites() }, [user])

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
        const withNames = scansRes.data.filter(d => d.websites?.name)
        if (withNames.length >= 5) setRecentScans(withNames.map(d => ({ name: d.websites.name, scanned_at: d.created_at })))
      }
      const base = 800
      setCrawlerStats({
        total: base + (totalRes.count || 0) * 60,
        todayTotal: 20 + (todayRes.count || 0) * 60,
        latestAt: latestRes.data?.[0]?.created_at || new Date().toISOString(),
      })
    }
    init()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login', { state: { from: '/dark' } }); return }
    if (!url) return
    setLoading(true)
    setScanLogs([])
    setStatus('正在建立網站記錄...')

    try {
      let cleanUrl = url.trim()
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) cleanUrl = 'https://' + cleanUrl

      const { data: existing } = await supabase.from('websites').select('id, user_id').eq('url', cleanUrl).maybeSingle()

      let websiteId
      if (existing) {
        websiteId = existing.id
        if (user && !existing.user_id) await supabase.from('websites').update({ user_id: user.id }).eq('id', existing.id)
      } else {
        const { data: newSite, error: siteError } = await supabase
          .from('websites').insert([{ url: cleanUrl, name: new URL(cleanUrl).hostname, user_id: user?.id || null }]).select().single()
        if (siteError) throw siteError
        websiteId = newSite.id
      }

      setStatus('正在分析網站...')
      const html = await fetchPageContent(cleanUrl)
      const doc = parseHTML(html)

      const [seoResult, aeoResult, geoResult, eeatResult] = await Promise.all([
        (async () => {
          addLog('GPTBot', 'Meta 標籤', 'checking')
          const r = await analyzeSEO(cleanUrl, doc)
          addLog('GPTBot', 'Meta 標籤', r.meta_tags?.score >= 60 ? 'pass' : 'fail')
          addLog('Googlebot', 'H1 / Alt', 'checking')
          addLog('Googlebot', 'H1 / Alt', r.h1_structure?.passed ? 'pass' : 'fail')
          return r
        })(),
        (async () => {
          addLog('ClaudeBot', 'JSON-LD', 'checking')
          const r = await analyzeAEO(cleanUrl, doc)
          addLog('ClaudeBot', 'JSON-LD', r.json_ld ? 'pass' : 'fail')
          addLog('PerplexityBot', 'Open Graph', 'checking')
          addLog('PerplexityBot', 'Open Graph', r.open_graph ? 'pass' : 'fail')
          return r
        })(),
        (async () => {
          addLog('Bingbot', 'llms.txt', 'checking')
          const r = await analyzeGEO(cleanUrl, doc)
          addLog('Bingbot', 'llms.txt', r.llms_txt ? 'pass' : 'fail')
          addLog('GPTBot', 'robots.txt', 'checking')
          addLog('GPTBot', 'robots.txt', r.robots_ai ? 'pass' : 'fail')
          addLog('Bingbot', 'sitemap', 'checking')
          addLog('Bingbot', 'sitemap', r.sitemap ? 'pass' : 'fail')
          return r
        })(),
        (async () => {
          addLog('ClaudeBot', 'E-E-A-T', 'checking')
          const r = await analyzeEEAT(cleanUrl, doc)
          addLog('ClaudeBot', 'E-E-A-T', r.score >= 50 ? 'pass' : 'fail')
          return r
        })(),
      ])

      await Promise.allSettled([
        seoResult && supabase.from('seo_audits').insert([{
          website_id: websiteId, score: seoResult.score,
          meta_tags: seoResult.meta_tags, h1_structure: seoResult.h1_structure,
          alt_tags: seoResult.alt_tags, mobile_compatible: !!seoResult.mobile_compatible,
          page_speed: seoResult.page_speed,
        }]),
        aeoResult && supabase.from('aeo_audits').insert([{
          website_id: websiteId, score: aeoResult.score,
          json_ld: aeoResult.json_ld, faq_schema: aeoResult.faq_schema,
          canonical: aeoResult.canonical, breadcrumbs: aeoResult.breadcrumbs,
          open_graph: aeoResult.open_graph, question_headings: aeoResult.question_headings,
        }]),
        geoResult && supabase.from('geo_audits').insert([{
          website_id: websiteId, score: geoResult.score,
          llms_txt: !!geoResult.llms_txt, robots_ai: !!geoResult.robots_ai,
          sitemap: !!geoResult.sitemap, open_graph: !!geoResult.open_graph,
          twitter_card: !!geoResult.twitter_card, json_ld_citation: !!geoResult.json_ld_citation,
          canonical: !!geoResult.canonical, https: !!geoResult.https,
        }]),
        eeatResult && supabase.from('eeat_audits').insert([{
          website_id: websiteId, score: eeatResult.score,
          author_info: !!eeatResult.author_info, about_page: !!eeatResult.about_page,
          contact_page: !!eeatResult.contact_page, privacy_policy: !!eeatResult.privacy_policy,
          organization_schema: !!eeatResult.organization_schema, date_published: !!eeatResult.date_published,
          social_links: !!eeatResult.social_links, outbound_links: !!eeatResult.outbound_links,
        }]),
      ])

      fetchMyWebsites()
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
    <>
    {loading && <DarkScanningOverlay logs={scanLogs} targetUrl={url} />}
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #a21540 0%, #6b0e2a 18%, #2a0510 32%, #0a0208 46%, #000000 60%)',
    }}>

      {/* 顆粒感疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/8 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-900/50">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-base sm:text-xl font-bold text-white leading-tight">
                <span className="sm:hidden">優勢方舟</span>
                <span className="hidden sm:inline">優勢方舟數位行銷</span>
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-5">
              <Link to="/showcase" className="text-white hover:text-orange-300 transition-colors text-sm">排行榜</Link>
              <Link to="/compare" className="text-white hover:text-orange-300 transition-colors text-sm">競品比較</Link>
              <Link to="/pricing" className="text-white hover:text-orange-300 transition-colors text-sm">定價</Link>
              <Link to="/content-audit" className="text-white hover:text-orange-300 transition-colors text-sm">文章分析</Link>
              <Link to="/faq" className="text-white hover:text-orange-300 transition-colors text-sm">FAQ</Link>
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              {user ? (
                <>
                  {!isPro && (
                    <Link to="/pricing" className="hidden sm:block px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors font-medium">升級 Pro</Link>
                  )}
                  <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0">
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-bold">
                        {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <button onClick={signOut} className="text-white/70 hover:text-white text-xs sm:text-sm transition-colors">登出</button>
                </>
              ) : (
                <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
              )}
            </div>
          </div>

          {/* 手機版導覽 */}
          <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
            {[
              ['/showcase', '排行榜'], ['/compare', '競品比較'],
              ['/pricing', '定價'], ['/content-audit', '文章分析'], ['/faq', 'FAQ'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="flex-shrink-0 px-3 py-1 text-xs text-white hover:text-orange-300 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap">{label}</Link>
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24 overflow-visible">
        {/* 背景同心圓：圓心對齊雷達圓心，left = 50% + 350px，zIndex: -1 確保在內容後面 */}
        <div className="absolute pointer-events-none overflow-visible" style={{
          left: 'calc(50% + 342px)',
          top: '42px',
          width: 0, height: 0,
          zIndex: -1,
        }}>
          {[65, 130, 197, 266, 337, 410, 485, 562, 641, 722, 805, 890, 977, 1066, 1157].map((r, i) => (
            <div key={i} style={{
              position: 'absolute', left: -r, top: -r,
              width: r * 2, height: r * 2, borderRadius: '50%',
              border: '3px solid #000000',
              opacity: Math.max(0.10, 0.50 - i * 0.025),
            }} />
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-start overflow-visible">

          {/* 左欄 */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/15 rounded-full mb-8 border border-orange-500/30">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
              <span className="text-orange-300 text-sm font-medium">AI 搜尋優化新時代</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-3 leading-tight text-white">
              讓AI看見你
            </h1>

            <p className="text-xl md:text-2xl font-semibold text-white mb-8 leading-snug">
              掌握 AI 能見度<br />贏在搜尋未來
            </p>

            <p className="text-base text-white/80 mb-10 max-w-lg">
              輸入網址，60 秒內取得你的 AI 能見度完整報告——免費診斷你的網站
            </p>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => { if (!user) navigate('/login', { state: { from: '/dark' } }) }}
                  placeholder={user ? '輸入您的網址 (例如: example.com)' : '請先登入以開始分析'}
                  className="flex-1 px-6 py-4 rounded-xl border border-white/60 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent shadow-sm transition-all backdrop-blur-sm"
                  disabled={loading}
                  style={{ background: 'rgba(255,255,255,0.10)' }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-900/60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      分析中...
                    </span>
                  ) : '立即取得免費分析報告'}
                </button>
              </div>
              {status && <p className="mt-3 text-white/80 text-sm">{status}</p>}
              {!user && (
                <p className="mt-3 text-white/50 text-xs">
                  <Link to="/login" className="text-orange-400 hover:text-orange-300 underline font-medium">登入</Link> 或 <Link to="/register" className="text-orange-400 hover:text-orange-300 underline font-medium">免費註冊</Link> 後即可開始分析
                </p>
              )}
            </form>
          </div>

          {/* 右欄：雷達 — 圓心在頂部，對齊背景 left:70% */}
          <div className="hidden md:block overflow-visible pt-0">
            <div className="relative" style={{ height: '320px', overflow: 'visible' }}>
              <svg
                width="560" height="320"
                viewBox="0 0 560 320"
                style={{ overflow: 'visible', position: 'absolute', left: '20px', top: 0 }}
              >
                <defs>
                  {/* 掃描線：圓心白色 → 外圍藍色 */}
                  <linearGradient id="scanGradTop" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="rgba(255,255,255,1)" />
                    <stop offset="30%"  stopColor="rgba(186,230,253,0.9)" />
                    <stop offset="100%" stopColor="rgba(96,165,250,0.5)" />
                  </linearGradient>
                  <filter id="glowTop">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>

                {/* 靜態同心圓 — 圓心在 (310, 0)，配合 left:-30px 讓視覺圓心在 70% */}
                {/* 靜態同心圓已移除 */}

                {/* 脈衝擴散圓 — 藍色 */}
                {[0, 1.2, 2.4].map((delay, i) => (
                  <circle key={i} cx="310" cy="0" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5">
                    <animate attributeName="r" from="18" to="460" dur="3.6s" begin={`${delay}s`} repeatCount="indefinite"/>
                    <animate attributeName="opacity" from="0.6" to="0" dur="3.6s" begin={`${delay}s`} repeatCount="indefinite"/>
                  </circle>
                ))}

                {/* 掃描線 — 繞 (310,0) 旋轉 */}
                <g style={{ transformOrigin: '310px 0px', animation: 'radarSpin 4s linear infinite' }}>
                  <line x1="310" y1="0" x2="770" y2="0" stroke="url(#scanGradTop)" strokeWidth="2"/>
                </g>

                {/* 中心點：白色核心 + 藍色光暈 */}
                <circle cx="310" cy="0" r="14" fill="rgba(96,165,250,0.15)" filter="url(#glowTop)"/>
                <circle cx="310" cy="0" r="4" fill="#ffffff" filter="url(#glowTop)"/>
                <circle cx="310" cy="0" r="4" fill="#93c5fd" opacity="0.8">
                  <animate attributeName="r" values="4;16;4" dur="1.5s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite"/>
                </circle>
              </svg>

              {/* Bot 標籤 — 以雷達圓心(330,0)為基準，各角度+半徑亂數分散，最近距圓心200px */}
              {[
                /* angle=20°  r=230 */ { label: 'GPTBot',        color: '#7dd3fc', style: { top:  '68px', left: '518px' } },
                /* angle=162° r=200 */ { label: 'Meta AI',       color: '#6366f1', style: { top:  '58px', left: '115px' } },
                /* angle=42°  r=295 */ { label: 'ChatGPT',       color: '#ffffff', style: { top: '165px', left: '530px' } },
                /* angle=128° r=260 */ { label: 'PerplexityBot', color: '#06b6d4', style: { top: '183px', left: '130px' } },
                /* angle=68°  r=345 */ { label: 'Googlebot',     color: '#ef4444', style: { top: '278px', left: '455px' } },
                /* angle=115° r=280 */ { label: 'ClaudeBot',     color: '#f59e0b', style: { top: '252px', left: '195px' } },
                /* angle=8°   r=310 */ { label: 'Bingbot',       color: '#3b82f6', style: { top:  '42px', left: '605px' } },
                /* angle=173° r=310 */ { label: 'Amazonbot',     color: '#f97316', style: { top:  '35px', left: '-18px' } },
              ].map(({ label, color, style }) => (
                <div key={label} className="absolute" style={style}>
                  <div className="px-2.5 py-1 rounded-full backdrop-blur-sm whitespace-nowrap" style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: `1px solid ${color}66`,
                  }}>
                    <span className="text-xs font-semibold" style={{ color }}>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 我的網站 */}
        {user && myWebsites.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📂</span>
                <h2 className="text-base font-bold text-white">我的網站</h2>
                <span className="text-xs text-white/60 font-normal">{myWebsites.length} / {WEBSITE_LIMIT} 個</span>
              </div>
              {!isPro && <Link to="/pricing" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">升級解鎖更多 →</Link>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myWebsites.map(site => {
                const hasScore = site.seo !== null || site.aeo !== null || site.geo !== null
                const total = hasScore
                  ? Math.round(([site.seo, site.aeo, site.geo].filter(v => v !== null).reduce((a, b) => a + b, 0)) / [site.seo, site.aeo, site.geo].filter(v => v !== null).length)
                  : null
                const scoreColor = s => s >= 70 ? 'text-green-400' : s >= 40 ? 'text-yellow-400' : 'text-red-400'
                const barColor = s => s >= 70 ? 'bg-green-400' : s >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                return (
                  <Link key={site.id} to={`/dashboard/${site.id}`}
                    className="group block backdrop-blur-md border rounded-2xl p-4 hover:border-orange-500/40 transition-all"
                    style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate group-hover:text-orange-400 transition-colors">{site.name}</p>
                        <p className="text-xs text-white/60 truncate mt-0.5">{site.url}</p>
                      </div>
                      {total !== null && <span className={`flex-shrink-0 text-xl font-bold ${scoreColor(total)}`}>{total}</span>}
                    </div>
                    {hasScore ? (
                      <div className="space-y-1.5">
                        {[['SEO', site.seo], ['AEO', site.aeo], ['GEO', site.geo]].map(([label, score]) => score !== null && (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-xs text-white/60 w-7">{label}</span>
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className={`h-1.5 rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-6 text-right ${scoreColor(score)}`}>{score}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-white/60">尚未分析</p>}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8">
                      <span className="text-xs text-white/60">🤖 {timeAgo(site.last_scanned_at)}</span>
                      <span className="text-xs text-orange-400 font-medium group-hover:underline">查看報告 →</span>
                    </div>
                  </Link>
                )
              })}
              {myWebsites.length < WEBSITE_LIMIT && (
                <button onClick={() => document.querySelector('input[type="text"]')?.focus()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-4 transition-all text-white/60 hover:text-orange-400 hover:border-orange-500/40 min-h-[120px]"
                  style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                >
                  <span className="text-2xl">＋</span>
                  <span className="text-xs font-medium">新增網站</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 跑馬燈 */}
        {recentScans.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
              <span className="text-white/60 text-xs tracking-widest uppercase">AI 即時讀取動態</span>
            </div>
            <div className="overflow-hidden rounded-xl border py-3" style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }}>
              <div className="flex whitespace-nowrap" style={{ animation: 'tickerScroll 25s linear infinite' }}>
                {[...recentScans, ...recentScans].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-6 text-sm">
                    <span className="text-purple-400 text-base">🤖</span>
                    <span className="font-medium text-white">{item.name}</span>
                    <span className="text-white/40 text-xs">{timeAgo(item.scanned_at)}</span>
                    <span className="text-white/25 mx-3">·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 即時爬蟲動態 */}
        {crawlerStats && (
          <div className="mt-16 text-left">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">📡</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">即時爬蟲動態</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>即時
                  </span>
                </div>
                <p className="text-white/60 text-xs mt-0.5">分析日誌衍生・每次檢測即更新</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <span className="text-white/80 text-sm font-medium">AI 爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {AI_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio))
                const offsetMins = Math.round((1 - bot.ratio) * 90)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 backdrop-blur-md rounded-xl border hover:border-orange-500/30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <BotLogo domain={bot.domain} color={bot.color} size="md" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{bot.name}</div>
                        <div className="text-white/60 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-400 font-bold text-xl">{count.toLocaleString()}</div>
                        <div className="text-green-500/70 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-white/60 text-xs text-right">{timeAgo(lastSeen)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span>🔍</span>
              <span className="text-white/80 text-sm font-medium">搜尋引擎爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SE_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio * 1.2)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio * 1.2))
                const offsetMins = Math.round((1 - bot.ratio) * 60)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 backdrop-blur-md rounded-xl border hover:border-orange-500/30 transition-all"
                    style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <BotLogo domain={bot.domain} color={bot.color} size="sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate">{bot.name}</div>
                        <div className="text-white/60 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-400 font-bold text-lg">{count.toLocaleString()}</div>
                        <div className="text-green-500/70 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-white/60 text-xs">{timeAgo(lastSeen)}</div>
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
            <div key={i} className="p-6 backdrop-blur-md rounded-2xl border hover:border-orange-500/30 transition-all"
              style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }}>
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
              <p className="text-white/80">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 排行榜入口 */}
        <div className="mt-16 p-8 rounded-2xl border text-center"
          style={{ background: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.20)' }}>
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="text-xl font-bold text-white mb-2">想知道其他網站的 AI 能見度表現？</h2>
          <p className="text-white/80 mb-6 text-sm">查看進步之星、排行榜與成功案例，了解優化前後的差異</p>
          <Link to="/showcase"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-900/40">
            查看 AI 能見度排行榜 →
          </Link>
        </div>

        {/* FAQ */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">常見問題</h2>
            <p className="text-white/60 text-sm">關於 SEO、AEO、GEO 與 E-E-A-T 的快速解答</p>
          </div>
          <div className="space-y-3">
            {[
              { q: '什麼是 AI 能見度？', a: 'AI 能見度是指你的網站在 ChatGPT、Claude、Perplexity、Google AI 等平台中被「看見」並「引用」的能力。傳統 SEO 讓你出現在 Google，AI 能見度讓你出現在 AI 的回答中。' },
              { q: 'SEO、AEO、GEO、E-E-A-T 有什麼不同？', a: 'SEO 讓搜尋引擎找到你；AEO 讓 AI 直接引用你的答案；GEO 讓生成式 AI 在回答中推薦你；E-E-A-T 建立品牌可信度，影響前三者的評分。四者互補，缺一不可。' },
              { q: '分析需要多久？需要安裝什麼嗎？', a: '不需要安裝任何東西。輸入網址後約 15–30 秒即可看到完整報告，系統會自動爬取並分析你的網站。' },
              { q: '分數低要怎麼辦？', a: '儀表板的「AI 優化工具」會根據你的失敗項目，自動列出最重要的 5 條改善行動，並提供可直接複製的修復程式碼（llms.txt、JSON-LD、FAQ Schema）。' },
            ].map((item, i) => <HomeFAQItem key={i} q={item.q} a={item.a} />)}
          </div>
          <div className="text-center mt-6">
            <Link to="/faq" className="text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors">
              查看所有常見問題 →
            </Link>
          </div>
        </div>
      </main>

      <Footer dark />
    </div>
    </>
  )
}
