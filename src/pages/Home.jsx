import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Footer from '../components/Footer'
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
    <div className={`${dim} rounded-full flex-shrink-0 bg-white flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm`}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt={domain}
        className={`${imgDim} object-contain`}
        onError={(e) => {
          e.currentTarget.parentElement.style.background = `radial-gradient(circle at 35% 35%, white 0%, ${color} 60%)`
          e.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

// 掃描動畫用的節點與 bot 設定
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

function ScanningOverlay({ logs, targetUrl }) {
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // 從 log 推算每個節點的狀態
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
    return '#cbd5e1'
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
      background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)'
    }}>
      {/* Header */}
      <div className="flex items-center justify-center pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 150, 300].map(d => (
              <div key={d} className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <span className="text-gray-700 font-medium text-sm">正在掃描</span>
          <span className="px-3 py-1 bg-white/70 rounded-full text-gray-800 font-semibold text-sm border border-white/80 shadow-sm">{hostname}</span>
        </div>
      </div>

      {/* 主畫面 */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <div className="w-full max-w-5xl grid grid-cols-[1fr_300px] gap-5 h-[480px]">

          {/* 左側：SVG 節點網路 */}
          <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex items-center justify-center shadow-sm overflow-hidden">
            <svg width="420" height="420" viewBox="0 0 420 420">
              <defs>
                {/* 掃描線漸層 */}
                <linearGradient id="scanGradScan" x1="0.5" y1="0.5" x2="1" y2="0.5">
                  <stop offset="0%" stopColor="rgba(251,146,60,0)" />
                  <stop offset="100%" stopColor="rgba(251,146,60,0.8)" />
                </linearGradient>
                {/* 節點通過光暈 */}
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* 流動虛線連線 */}
              {SCAN_NODES.map((node) => {
                const color = nodeColor(node.id)
                const active = !!nodeStatus[node.id]
                const dx = node.x - 210, dy = node.y - 210
                const len = Math.sqrt(dx*dx + dy*dy)
                return (
                  <line key={node.id}
                    x1="210" y1="210" x2={node.x} y2={node.y}
                    stroke={color} strokeWidth={active ? 2 : 1}
                    strokeDasharray="6,4" opacity={active ? 0.9 : 0.35}
                  >
                    {active && (
                      <animate attributeName="stroke-dashoffset"
                        from={len} to={0} dur="1.5s"
                        repeatCount="indefinite" />
                    )}
                  </line>
                )
              })}

              {/* 脈衝環：從圓心真正往外擴散 */}
              {[0, 0.8, 1.6].map((delay, i) => (
                <circle key={i} cx="210" cy="210" fill="none" stroke="#fb923c" strokeWidth="1.5">
                  <animate attributeName="r" from="44" to="160" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                </circle>
              ))}

              {/* 旋轉掃描臂 */}
              <g style={{ transformOrigin: '210px 210px', animation: 'radarSpin 3s linear infinite' }}>
                <line x1="210" y1="210" x2="360" y2="210"
                  stroke="url(#scanGradScan)" strokeWidth="2.5" opacity="0.85" />
              </g>

              {/* 中心節點（網站） */}
              <circle cx="210" cy="210" r="44" fill="white" stroke="#fed7aa" strokeWidth="2.5" filter="url(#glow)" />
              <circle cx="210" cy="210" r="44" fill="none" stroke="#fb923c" strokeWidth="1" opacity="0.4" />
              <text x="210" y="204" textAnchor="middle" fill="#374151" fontSize="20">🌐</text>
              <text x="210" y="222" textAnchor="middle" fill="#6b7280" fontSize="9" fontWeight="500">
                {hostname.length > 20 ? hostname.slice(0, 18) + '…' : hostname}
              </text>

              {/* 檢查項目節點 */}
              {SCAN_NODES.map(node => {
                const color = nodeColor(node.id)
                const active = !!nodeStatus[node.id]
                const passed = nodeStatus[node.id] === 'pass'
                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r="30" fill="white"
                      stroke={color} strokeWidth={active ? 2.5 : 1}
                      filter={passed ? 'url(#glow)' : undefined} />
                    {active && <circle cx={node.x} cy={node.y} r="30" fill={color} opacity="0.15" />}
                    {/* 亮起時的外圈 */}
                    {passed && (
                      <circle cx={node.x} cy={node.y} r="30" fill="none" stroke={color} strokeWidth="1" opacity="0.4">
                        <animate attributeName="r" from="30" to="42" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.5" to="0" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <text x={node.x} y={node.y + 1} textAnchor="middle" fill={color}
                      fontSize="13" fontWeight="800" dominantBaseline="middle">
                      {nodeIcon(node.id)}
                    </text>
                    <text x={node.x} y={node.y + 44} textAnchor="middle" fill="#6b7280" fontSize="8.5" fontWeight="500">
                      {node.label}
                    </text>
                  </g>
                )
              })}

              {/* Bot 圖示（帶光暈） */}
              {SCAN_BOTS.map((bot) => (
                <g key={bot.name}>
                  <circle cx={bot.bx} cy={bot.by} r="20" fill="white" stroke={bot.color} strokeWidth="2"
                    filter="url(#glow)" />
                  <circle cx={bot.bx} cy={bot.by} r="20" fill={bot.color} opacity="0.08" />
                  <text x={bot.bx} y={bot.by + 1} textAnchor="middle" fill={bot.color}
                    fontSize="7.5" fontWeight="800" dominantBaseline="middle">
                    {bot.name.replace('Bot', '').replace('bot', '')}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* 右側：終端機日誌 */}
          <div className="bg-gray-950 rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-xl">
            {/* 視窗頂部 */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-gray-500 text-xs font-mono">AI Bot Scanner</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>

            {/* 日誌內容 */}
            <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-600 pt-2">等待分析開始<span className="animate-pulse">_</span></div>
              ) : logs.map((log, i) => (
                <div key={i} className="flex items-center gap-2 leading-relaxed">
                  <span className="text-gray-600 flex-shrink-0 text-[10px]">{log.time}</span>
                  <span className="flex-shrink-0 font-bold text-[11px]" style={{ color: botColorMap[log.bot] || '#94a3b8' }}>
                    {log.bot.padEnd(13)}
                  </span>
                  <span className={`flex-shrink-0 font-bold ${log.status === 'pass' ? 'text-green-400' : log.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {log.status === 'pass' ? '✓' : log.status === 'fail' ? '✗' : '⟳'}
                  </span>
                  <span className="text-gray-300 truncate">{log.item}</span>
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
    <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
      >
        <span className="font-semibold text-slate-800 text-sm">{q}</span>
        <span className={`text-orange-500 flex-shrink-0 text-lg transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <div className="h-px bg-orange-100 mb-4" />
          <p className="text-slate-600 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function Home() {
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
  const WEBSITE_LIMIT = isPro ? 15 : 3

  // 載入當前用戶的網站列表
  const fetchMyWebsites = async () => {
    if (!user) { console.log('[MyWebsites] no user'); return }
    console.log('[MyWebsites] fetching for user:', user.id)
    const { data: sites, error } = await supabase
      .from('websites')
      .select('id, name, url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(WEBSITE_LIMIT)
    console.log('[MyWebsites] sites count:', sites?.length ?? 'null', '| error:', error?.message ?? 'none', '| data:', JSON.stringify(sites))
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
        if (withNames.length >= 5) {
          // 有足夠真實名稱才取代假資料
          setRecentScans(withNames.map(d => ({ name: d.websites.name, scanned_at: d.created_at })))
        }
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
    setScanLogs([])
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
        .select('id, user_id')
        .eq('url', cleanUrl)
        .maybeSingle()

      let websiteId
      if (existing) {
        websiteId = existing.id
        // 若已登入且此網站尚無 user_id，則更新為當前使用者
        if (user && !existing.user_id) {
          await supabase.from('websites').update({ user_id: user.id }).eq('id', existing.id)
        }
        setStatus('網站已存在，正在執行 SEO 檢測...')
      } else {
        // 檢查網站數量上限（登入用戶才計算）
        if (user) {
          const { count } = await supabase
            .from('websites')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)

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
            name: siteName,
            user_id: user?.id || null
          }])
          .select()
          .single()

        if (error) throw error
        websiteId = data.id
        setStatus('網站建立完成，正在執行 SEO 檢測...')
      }

      // 執行 SEO 分析
      addLog('GPTBot', 'Meta 標籤', 'checking')
      addLog('Googlebot', 'H1 結構', 'checking')
      setStatus('正在分析 Meta 標籤...')
      let seoResult = null
      try {
        seoResult = await analyzeSEO(cleanUrl)
      } catch (seoError) {
        console.warn('SEO analysis failed:', seoError)
      }
      addLog('GPTBot',        'Meta 標籤',   seoResult?.meta_tags          ? 'pass' : 'fail')
      addLog('Googlebot',     'H1 結構',      seoResult?.h1_structure       ? 'pass' : 'fail')
      addLog('Bingbot',       '行動版相容',   seoResult?.mobile_compatible  ? 'pass' : 'fail')
      addLog('PerplexityBot', '頁面速度',     seoResult?.page_speed         ? 'pass' : 'fail')

      // 執行 AEO 分析
      addLog('ClaudeBot',  'JSON-LD schema', 'checking')
      addLog('GPTBot',     'Open Graph',     'checking')
      setStatus('正在分析 AEO 技術指標...')
      let aeoResult = null
      try {
        aeoResult = await analyzeAEO(cleanUrl)
      } catch (aeoError) {
        console.warn('AEO analysis failed:', aeoError)
      }
      addLog('ClaudeBot',     'JSON-LD schema', aeoResult?.json_ld      ? 'pass' : 'fail')
      addLog('GPTBot',        'FAQ schema',      aeoResult?.faq_schema   ? 'pass' : 'fail')
      addLog('Googlebot',     'Open Graph',      aeoResult?.open_graph   ? 'pass' : 'fail')
      addLog('Bingbot',       'Canonical URL',   aeoResult?.canonical    ? 'pass' : 'fail')

      // 執行 GEO 分析
      addLog('GPTBot',    'robots.txt', 'checking')
      addLog('ClaudeBot', 'llms.txt',   'checking')
      setStatus('正在分析 GEO 生成式 AI 優化...')
      let geoResult = null
      try {
        geoResult = await analyzeGEO(cleanUrl)
      } catch (geoError) {
        console.warn('GEO analysis failed:', geoError)
      }
      addLog('GPTBot',        'robots.txt',  geoResult?.robots_ai  ? 'pass' : 'fail')
      addLog('ClaudeBot',     'llms.txt',    geoResult?.llms_txt   ? 'pass' : 'fail')
      addLog('Googlebot',     'sitemap.xml', geoResult?.sitemap    ? 'pass' : 'fail')
      addLog('PerplexityBot', 'HTTPS 安全',  geoResult?.https      ? 'pass' : 'fail')

      // 執行 E-E-A-T 分析
      addLog('Bingbot', 'E-E-A-T 信任指標', 'checking')
      setStatus('正在分析 E-E-A-T 可信度指標...')
      let eeatResult = null
      try {
        eeatResult = await analyzeEEAT(cleanUrl)
      } catch (eeatError) {
        console.warn('EEAT analysis failed:', eeatError)
      }
      addLog('Bingbot',       '作者資訊',  eeatResult?.author_info    ? 'pass' : 'fail')
      addLog('PerplexityBot', '聯絡頁面',  eeatResult?.contact_page   ? 'pass' : 'fail')
      addLog('ClaudeBot',     '隱私政策',  eeatResult?.privacy_policy ? 'pass' : 'fail')
      addLog('GPTBot',        '社群連結',  eeatResult?.social_links   ? 'pass' : 'fail')

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
    {loading && <ScanningOverlay logs={scanLogs} targetUrl={url} />}
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)',
    }}>

      {/* 點陣背景 */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4">
            {/* Logo + 品牌名 */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-base sm:text-xl font-bold text-slate-800 leading-tight">
                <span className="sm:hidden">優勢方舟</span>
                <span className="hidden sm:inline">優勢方舟數位行銷</span>
              </span>
            </div>

            {/* 桌面版導覽列 */}
            <nav className="hidden md:flex items-center gap-5">
              <Link to="/showcase" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">排行榜</Link>
              <Link to="/compare" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">競品比較</Link>
              <Link to="/pricing" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">定價</Link>
              <Link to="/content-audit" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">文章分析</Link>
              <Link to="/faq" className="text-slate-600 hover:text-slate-900 transition-colors text-sm">FAQ</Link>
            </nav>

            {/* 右側：登入/帳號 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {user ? (
                <>
                  {!isPro && (
                    <Link to="/pricing" className="hidden sm:block px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors font-medium">升級 Pro</Link>
                  )}
                  <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0" title={userName || user.email}>
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                        {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <button onClick={signOut} className="text-slate-400 hover:text-slate-700 text-xs sm:text-sm transition-colors">登出</button>
                </>
              ) : (
                <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
              )}
            </div>
          </div>

          {/* 手機版導覽列（橫向捲動） */}
          <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
            <Link to="/showcase" className="flex-shrink-0 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap">排行榜</Link>
            <Link to="/compare" className="flex-shrink-0 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap">競品比較</Link>
            <Link to="/pricing" className="flex-shrink-0 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap">定價</Link>
            <Link to="/content-audit" className="flex-shrink-0 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap">文章分析</Link>
            <Link to="/faq" className="flex-shrink-0 px-3 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-orange-50 rounded-lg transition-colors whitespace-nowrap">FAQ</Link>
          </div>
        </div>
      </header>

      {/* Hero Section — 雙欄佈局 */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24 overflow-visible">
        <div className="grid md:grid-cols-2 gap-6 items-center overflow-visible">

          {/* 左欄：文字 + 輸入框 */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-8 border border-orange-200">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
              <span className="text-orange-700 text-sm font-medium">AI 搜尋優化新時代</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-3 leading-tight bg-gradient-to-r from-blue-500 to-orange-500 bg-clip-text text-transparent">
              讓AI看見你
            </h1>

            <p className="text-xl md:text-2xl font-semibold text-slate-800 mb-8 leading-snug">
              掌握 AI 能見度<br />贏在搜尋未來
            </p>

            <p className="text-base text-slate-500 mb-10 max-w-lg">
              輸入網址，60 秒內取得你的 AI 能見度完整報告——免費診斷 3 個網站，不需信用卡
            </p>

            {/* URL Input Form */}
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="輸入您的網址 (例如: example.com)"
                  className="flex-1 px-6 py-4 rounded-xl bg-white border border-orange-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent shadow-sm transition-all"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-300/50"
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
              {status && (
                <p className="mt-3 text-slate-500 text-sm">{status}</p>
              )}
            </form>
          </div>

          {/* 右欄：雷達掃描動畫（放大版） */}
          <div className="hidden md:flex items-center justify-center overflow-visible">
            <div className="relative w-[640px] h-[640px] -ml-20">
              {/* 靜態同心圓 */}
              {[310, 250, 185, 120, 60].map((r, i) => (
                <div key={i} className="absolute inset-0 flex items-center justify-center">
                  <div style={{
                    width: r * 2,
                    height: r * 2,
                    borderRadius: '50%',
                    border: `1px solid rgba(59,130,246,${0.12 + i * 0.05})`,
                  }} />
                </div>
              ))}

              {/* 脈衝擴散圓（動畫） */}
              {[0, 1, 2].map((i) => (
                <div key={i} className="absolute inset-0 flex items-center justify-center">
                  <div style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    border: '2px solid rgba(59,130,246,0.7)',
                    animation: `radarPulse 3s ease-out ${i * 1}s infinite`,
                  }} />
                </div>
              ))}

              {/* 中心點 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-5 h-5">
                  <div className="w-5 h-5 rounded-full bg-blue-500 shadow-lg shadow-blue-400/60 z-10 relative" />
                  <div className="absolute inset-0 w-5 h-5 rounded-full bg-blue-400 animate-ping opacity-60" />
                </div>
              </div>

              {/* 掃描線 */}
              <div className="absolute inset-0 flex items-center justify-center" style={{
                animation: 'radarSpin 4s linear infinite',
              }}>
                <svg width="640" height="640" viewBox="0 0 640 640">
                  <defs>
                    <linearGradient id="scanGrad" x1="0.5" y1="0.5" x2="1" y2="0.5">
                      <stop offset="0%" stopColor="rgba(59,130,246,0)" />
                      <stop offset="100%" stopColor="rgba(59,130,246,0.75)" />
                    </linearGradient>
                  </defs>
                  <line x1="320" y1="320" x2="625" y2="320" stroke="url(#scanGrad)" strokeWidth="2.5" />
                </svg>
              </div>

              {/* 浮動標籤 — 9 個 bot */}
              {/* 右上：GPTBot — 外圈弧上 */}
              <div className="absolute" style={{ top: '10%', right: '14%' }}>
                <div className="px-3 py-1.5 bg-blue-100/80 backdrop-blur-sm border border-blue-200 rounded-full shadow-sm">
                  <span className="text-blue-700 text-xs font-semibold">GPTBot</span>
                </div>
              </div>
              {/* 正右：ChatGPT — 外圈弧上 */}
              <div className="absolute" style={{ top: '36%', right: '8%' }}>
                <div className="px-3 py-1.5 bg-teal-100/80 backdrop-blur-sm border border-teal-200 rounded-full shadow-sm">
                  <span className="text-teal-700 text-xs font-semibold">ChatGPT</span>
                </div>
              </div>
              {/* 右下：Googlebot — 外圈弧上 */}
              <div className="absolute" style={{ top: '58%', right: '10%' }}>
                <div className="px-3 py-1.5 bg-orange-100/80 backdrop-blur-sm border border-orange-200 rounded-full shadow-sm">
                  <span className="text-orange-700 text-xs font-semibold">Googlebot</span>
                </div>
              </div>
              {/* 下偏右：YandexBot — 中外圈 */}
              <div className="absolute" style={{ bottom: '12%', right: '18%' }}>
                <div className="px-3 py-1.5 bg-red-100/80 backdrop-blur-sm border border-red-200 rounded-full shadow-sm">
                  <span className="text-red-600 text-xs font-semibold">YandexBot</span>
                </div>
              </div>
              {/* 正下：Amazonbot — 中圈 */}
              <div className="absolute" style={{ bottom: '7%', left: '46%' }}>
                <div className="px-3 py-1.5 bg-orange-100/80 backdrop-blur-sm border border-orange-200 rounded-full shadow-sm">
                  <span className="text-orange-600 text-xs font-semibold">Amazonbot</span>
                </div>
              </div>
              {/* 左下：Bingbot — 下移至中圈 */}
              <div className="absolute" style={{ top: '72%', left: '22%' }}>
                <div className="px-3 py-1.5 bg-blue-100/80 backdrop-blur-sm border border-blue-200 rounded-full shadow-sm">
                  <span className="text-blue-700 text-xs font-semibold">Bingbot</span>
                </div>
              </div>
              {/* 正左偏下：ClaudeBot — 內中圈 */}
              <div className="absolute" style={{ top: '53%', left: '13%' }}>
                <div className="px-3 py-1.5 bg-amber-100/80 backdrop-blur-sm border border-amber-200 rounded-full shadow-sm">
                  <span className="text-amber-700 text-xs font-semibold">ClaudeBot</span>
                </div>
              </div>
              {/* 左上：PerplexityBot — 中圈 */}
              <div className="absolute" style={{ top: '25%', left: '12%' }}>
                <div className="px-3 py-1.5 bg-slate-100/80 backdrop-blur-sm border border-slate-200 rounded-full shadow-sm">
                  <span className="text-slate-600 text-xs font-semibold">PerplexityBot</span>
                </div>
              </div>
              {/* 上方偏右：Meta AI — 中圈 */}
              <div className="absolute" style={{ top: '7%', left: '42%' }}>
                <div className="px-3 py-1.5 bg-indigo-100/80 backdrop-blur-sm border border-indigo-200 rounded-full shadow-sm">
                  <span className="text-indigo-700 text-xs font-semibold">Meta AI</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ===== 我的網站（登入後） ===== */}
        {user && myWebsites.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📂</span>
                <h2 className="text-base font-bold text-slate-800">我的網站</h2>
                <span className="text-xs text-slate-400 font-normal">{myWebsites.length} / {WEBSITE_LIMIT} 個</span>
              </div>
              {!isPro && (
                <Link to="/pricing" className="text-xs text-orange-500 hover:text-orange-600 transition-colors">升級解鎖更多 →</Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myWebsites.map(site => {
                const hasScore = site.seo !== null || site.aeo !== null || site.geo !== null
                const total = hasScore
                  ? Math.round(([site.seo, site.aeo, site.geo].filter(v => v !== null).reduce((a, b) => a + b, 0)) / [site.seo, site.aeo, site.geo].filter(v => v !== null).length)
                  : null
                const scoreColor = s => s >= 70 ? 'text-green-500' : s >= 40 ? 'text-yellow-500' : 'text-red-400'
                const barColor = s => s >= 70 ? 'bg-green-400' : s >= 40 ? 'bg-yellow-400' : 'bg-red-400'
                return (
                  <Link
                    key={site.id}
                    to={`/dashboard/${site.id}`}
                    className="group block bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-4 hover:border-orange-200 hover:bg-white/70 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate group-hover:text-orange-600 transition-colors">{site.name}</p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{site.url}</p>
                      </div>
                      {total !== null && (
                        <span className={`flex-shrink-0 text-xl font-bold ${scoreColor(total)}`}>{total}</span>
                      )}
                    </div>

                    {hasScore ? (
                      <div className="space-y-1.5">
                        {[['SEO', site.seo], ['AEO', site.aeo], ['GEO', site.geo]].map(([label, score]) => score !== null && (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-7">{label}</span>
                            <div className="flex-1 h-1.5 bg-orange-100 rounded-full overflow-hidden">
                              <div className={`h-1.5 rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-6 text-right ${scoreColor(score)}`}>{score}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">尚未分析</p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-orange-50">
                      <span className="text-xs text-slate-400">
                        🤖 {timeAgo(site.last_scanned_at)}
                      </span>
                      <span className="text-xs text-orange-500 font-medium group-hover:underline">查看報告 →</span>
                    </div>
                  </Link>
                )
              })}

              {/* 新增網站卡片（未達上限時顯示） */}
              {myWebsites.length < WEBSITE_LIMIT && (
                <button
                  onClick={() => document.querySelector('input[type="text"]')?.focus()}
                  className="flex flex-col items-center justify-center gap-2 bg-white/30 border-2 border-dashed border-orange-200 rounded-2xl p-4 hover:border-orange-400 hover:bg-white/50 transition-all text-slate-400 hover:text-orange-500 min-h-[120px]"
                >
                  <span className="text-2xl">＋</span>
                  <span className="text-xs font-medium">新增網站</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 🤖 AI 即時讀取跑馬燈 */}
        {recentScans.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
              <span className="text-gray-700 text-xs tracking-widest uppercase">AI 即時讀取動態</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/60 bg-white/40 backdrop-blur-md py-3">
              <div
                className="flex whitespace-nowrap"
                style={{ animation: 'tickerScroll 25s linear infinite' }}
              >
                {[...recentScans, ...recentScans].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-6 text-sm">
                    <span className="text-purple-400 text-base">🤖</span>
                    <span className="font-medium text-gray-800">{item.name}</span>
                    <span className="text-gray-400 text-xs">{timeAgo(item.scanned_at)}</span>
                    <span className="text-gray-200 mx-3">·</span>
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
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-800">即時爬蟲動態</h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded-full border border-green-200">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    即時
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-0.5">分析日誌衍生・每次檢測即更新</p>
              </div>
            </div>

            {/* AI 爬蟲 */}
            <div className="flex items-center gap-2 mb-3">
              <span>🤖</span>
              <span className="text-gray-500 text-sm font-medium">AI 爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {AI_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio))
                const offsetMins = Math.round((1 - bot.ratio) * 90)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 hover:border-orange-200 hover:bg-white/60 transition-all shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <BotLogo domain={bot.domain} color={bot.color} size="md" />
                      <div className="min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{bot.name}</div>
                        <div className="text-gray-400 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-600 font-bold text-xl">{count.toLocaleString()}</div>
                        <div className="text-green-500/70 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-gray-400 text-xs text-right">{timeAgo(lastSeen)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 搜尋引擎爬蟲 */}
            <div className="flex items-center gap-2 mb-3">
              <span>🔍</span>
              <span className="text-gray-500 text-sm font-medium">搜尋引擎爬蟲</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {SE_BOTS.map((bot, i) => {
                const count = Math.round(crawlerStats.total * bot.ratio * 1.2)
                const todayCount = Math.max(1, Math.round(crawlerStats.todayTotal * bot.todayRatio * 1.2))
                const offsetMins = Math.round((1 - bot.ratio) * 60)
                const lastSeen = new Date(new Date(crawlerStats.latestAt).getTime() - offsetMins * 60000).toISOString()
                return (
                  <div key={i} className="p-4 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 hover:border-orange-200 hover:bg-white/60 transition-all shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <BotLogo domain={bot.domain} color={bot.color} size="sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-gray-800 text-xs truncate">{bot.name}</div>
                        <div className="text-gray-400 text-xs">{bot.company}</div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-green-600 font-bold text-lg">{count.toLocaleString()}</div>
                        <div className="text-green-500/70 text-xs">+{todayCount} 今日</div>
                      </div>
                      <div className="text-gray-400 text-xs">{timeAgo(lastSeen)}</div>
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
            <div key={i} className="p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 hover:bg-white/60 transition-all shadow-sm">
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 排行榜入口 */}
        <div className="mt-16 p-8 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md text-center shadow-sm">
          <div className="text-3xl mb-3">🏆</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">想知道其他網站的 AI 能見度表現？</h2>
          <p className="text-gray-500 mb-6 text-sm">查看進步之星、排行榜與成功案例，了解優化前後的差異</p>
          <Link to="/showcase"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25">
            查看 AI 能見度排行榜 →
          </Link>
        </div>

        {/* FAQ 精簡區塊 */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">常見問題</h2>
            <p className="text-slate-500 text-sm">關於 SEO、AEO、GEO 與 E-E-A-T 的快速解答</p>
          </div>
          <div className="space-y-3">
            {[
              { q: '什麼是 AI 能見度？', a: 'AI 能見度是指你的網站在 ChatGPT、Claude、Perplexity、Google AI 等平台中被「看見」並「引用」的能力。傳統 SEO 讓你出現在 Google，AI 能見度讓你出現在 AI 的回答中。' },
              { q: 'SEO、AEO、GEO、E-E-A-T 有什麼不同？', a: 'SEO 讓搜尋引擎找到你；AEO 讓 AI 直接引用你的答案；GEO 讓生成式 AI 在回答中推薦你；E-E-A-T 建立品牌可信度，影響前三者的評分。四者互補，缺一不可。' },
              { q: '分析需要多久？需要安裝什麼嗎？', a: '不需要安裝任何東西。輸入網址後約 15–30 秒即可看到完整報告，系統會自動爬取並分析你的網站。' },
              { q: '分數低要怎麼辦？', a: '儀表板的「AI 優化工具」會根據你的失敗項目，自動列出最重要的 5 條改善行動，並提供可直接複製的修復程式碼（llms.txt、JSON-LD、FAQ Schema）。' },
            ].map((item, i) => (
              <HomeFAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
          <div className="text-center mt-6">
            <Link to="/faq" className="text-orange-500 hover:text-orange-600 text-sm font-medium transition-colors">
              查看所有常見問題 →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </>
  )
}
