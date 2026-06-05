import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Footer from '../components/Footer'
// 2026-06-06：公告改成右上角 NotificationBell — HomeDark 用自己內嵌 header（不是 SiteHeader）、要單獨 import
import NotificationBell from '../components/v2/NotificationBell'
// 2026-06-06：上 C 方向 logo mark
import AarkMark from '../components/v2/AarkMark'
// 2026-06-06：本週 AI 趨勢卡 — 訪客也看得到、促進每日 / 每週回訪
import WeeklyAITrendsCard from '../components/v2/WeeklyAITrendsCard'
import EarlybirdBanner from '../components/EarlybirdBanner'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { supabase } from '../lib/supabase'
import { normalizeUrl } from '../lib/url'
import { analyzeSEO, fetchPageContent, parseHTML, checkBotAccessibility } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
// v2 設計系統共用 tokens 與元件（與後續其他頁面同一份視覺語言）
// Hero 排版維持原有橘紅 Tailwind 按鈕,所以暫不引入 Btn
import { T } from '../styles/v2-tokens'
import { GlassCard, PlatformLogoWall } from '../components/v2'
import HomeShowcaseSection from '../components/v2/HomeShowcaseSection'

const timeAgo = (d) => {
  if (!d) return ''
  const mins = Math.floor((Date.now() - new Date(d)) / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
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
      background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
    }}>
      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.18, mixBlendMode: 'soft-light',
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
                <div key={log.key} className="text-sm flex items-start gap-2">
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

// FAQ 折疊項目 — 用 v2 GlassCard 包,hover 時邊框轉橘
function HomeFAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <GlassCard color={T.orange} hover onClick={() => setOpen(v => !v)} style={{ padding: 20 }}>
      <div className="flex items-center justify-between gap-3">
        <span style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{q}</span>
        <span
          className={`text-lg flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: T.textMid }}
        >↓</span>
      </div>
      {open && (
        <p style={{
          color: T.textMid, fontSize: 14, lineHeight: 1.7,
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>{a}</p>
      )}
    </GlassCard>
  )
}

// 網址欄位 placeholder 打字動畫的範例網址（循環播放）
const TYPEWRITER_DOMAINS = ['example.com', 'yourbrand.tw', 'shop.com.tw']

// TOP 8 排行榜的樣本資料(僅在真實掃描資料不足 8 筆時用來補位、避免空版面)
// 分數設定為偏高(74–92)以呈現「優等生」榜單視覺
const SAMPLE_TOP = [
  { id: 'top-s1', name: '優勢方舟數位行銷',  url: 'aark.com.tw',         total: 92, seo: 95, aeo: 91, geo: 90, isSample: true },
  { id: 'top-s2', name: 'Lifong 立勛資訊',   url: 'lifong.com.hk',       total: 88, seo: 90, aeo: 87, geo: 87, isSample: true },
  { id: 'top-s3', name: 'Notion 設計工作室', url: 'notion-design.tw',    total: 85, seo: 88, aeo: 83, geo: 84, isSample: true },
  { id: 'top-s4', name: '青山空間設計',       url: 'qingshan-design.tw',  total: 82, seo: 86, aeo: 80, geo: 80, isSample: true },
  { id: 'top-s5', name: 'Greenwave 行銷',    url: 'greenwave.com.tw',    total: 80, seo: 85, aeo: 78, geo: 77, isSample: true },
  { id: 'top-s6', name: 'Lumen Creative',    url: 'lumencreative.co',    total: 78, seo: 82, aeo: 76, geo: 76, isSample: true },
  { id: 'top-s7', name: 'Peak Studio',       url: 'peakstudio.io',       total: 76, seo: 78, aeo: 75, geo: 75, isSample: true },
  { id: 'top-s8', name: 'Mint Leaf 品牌顧問',url: 'mintleaf.com.tw',     total: 74, seo: 76, aeo: 73, geo: 73, isSample: true },
]

export default function HomeDark() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  // 掃描失敗時的結構化錯誤資訊（title / hint / action / technical）
  // 取代原本黑箱 alert，讓用戶看到具體原因 + 可行動的下一步
  const [errorInfo, setErrorInfo] = useState(null)
  // anti-bot 鎖極嚴的聳動 modal — 取代瀏覽器原生 alert，用紅色警示 + 強烈衝擊文案
  // 4 輪爬蟲全擋 → 用戶網站對 AI 完全隱形，這是核心商業價值「AI 看不見你」最有衝擊力的展示瞬間
  const [antiBotModal, setAntiBotModal] = useState({ open: false, websiteId: null, url: '' })
  // 打字動畫:當前 placeholder 顯示的範例網址片段（循環打/刪）
  const [typedDomain, setTypedDomain] = useState('')
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
  const [scanLogs, setScanLogs] = useState([])
  const [myWebsites, setMyWebsites] = useState([])
  // TOP 8 排行榜:預設用 SAMPLE_TOP,真實資料載入後若有 ≥1 筆會混合或覆蓋
  const [topSites, setTopSites] = useState(SAMPLE_TOP)
  // 公開 KPI（2026-06-06 加）— Hero 下方社會證明 + 早鳥剩餘名額 bar 用
  // /api/public?action=stats 回 { brands, reports, mentions, scans, earlybird_taken }
  const [publicStats, setPublicStats] = useState(null)
  const navigate = useNavigate()
  const { user, isPro, userName, signOut } = useAuth()
  const { setDark } = useTheme()
  useEffect(() => { setDark(true) }, [])

  // 抓社會證明 KPI（2026-06-06）— Hero thin bar 用
  useEffect(() => {
    fetch('/api/public?action=stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPublicStats(data) })
      .catch(() => {})
  }, [])

  // 打字動畫:循環打/刪範例網址,只在已登入且 input 為空時跑
  useEffect(() => {
    if (!user || url) { setTypedDomain(''); return }
    let wordIdx = 0
    let charIdx = 0
    let phase = 'typing' // typing → holding → deleting → empty → 下一個字
    let timer
    const tick = () => {
      const word = TYPEWRITER_DOMAINS[wordIdx]
      if (phase === 'typing') {
        charIdx++
        setTypedDomain(word.slice(0, charIdx))
        if (charIdx === word.length) { phase = 'holding'; timer = setTimeout(tick, 1500); return }
        timer = setTimeout(tick, 85)
      } else if (phase === 'holding') {
        phase = 'deleting'
        timer = setTimeout(tick, 50)
      } else if (phase === 'deleting') {
        charIdx--
        setTypedDomain(word.slice(0, charIdx))
        if (charIdx === 0) { phase = 'empty'; timer = setTimeout(tick, 400); return }
        timer = setTimeout(tick, 45)
      } else if (phase === 'empty') {
        wordIdx = (wordIdx + 1) % TYPEWRITER_DOMAINS.length
        phase = 'typing'
        tick()
      }
    }
    timer = setTimeout(tick, 800) // 進站後先停 800ms 再開始打
    return () => clearTimeout(timer)
  }, [user, url])

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
      // 跑馬燈 + TOP 8 排行榜的資料來源:websites 與三大面向 audits
      // websites query 過濾 is_test_site=true（管理員/QA 測試）+ is_public_optout=true（用戶 opt-out 不入榜）
      const [scansRes, wRes, sRes, aRes, gRes] = await Promise.all([
        supabase.from('seo_audits').select('created_at, websites!inner(name, is_test_site, is_public_optout)').eq('websites.is_test_site', false).eq('websites.is_public_optout', false).order('created_at', { ascending: false }).limit(15),
        supabase.from('websites').select('id, name, url').eq('is_test_site', false).eq('is_public_optout', false),
        supabase.from('seo_audits').select('website_id, score, created_at').order('created_at', { ascending: false }),
        supabase.from('aeo_audits').select('website_id, score, created_at').order('created_at', { ascending: false }),
        supabase.from('geo_audits').select('website_id, score, created_at').order('created_at', { ascending: false }),
      ])
      if (scansRes.data) {
        const withNames = scansRes.data.filter(d => d.websites?.name)
        if (withNames.length >= 5) setRecentScans(withNames.map(d => ({ name: d.websites.name, scanned_at: d.created_at })))
      }

      // TOP 8 排行榜:撈所有 websites + 三大面向最新分數,計算總分排序
      // 真實資料 < 8 筆時用 SAMPLE_TOP 補位,確保版面不會空白
      const latestPerSite = (rows) => {
        const m = {}
        rows?.forEach(r => { if (!(r.website_id in m)) m[r.website_id] = r.score })
        return m
      }
      const seoMap = latestPerSite(sRes.data)
      const aeoMap = latestPerSite(aRes.data)
      const geoMap = latestPerSite(gRes.data)
      const realRanked = (wRes.data || []).map(w => {
        const seo = seoMap[w.id], aeo = aeoMap[w.id], geo = geoMap[w.id]
        const scores = [seo, aeo, geo].filter(v => v != null)
        if (scores.length === 0) return null
        const total = Math.round(scores.reduce((x,y) => x + y, 0) / scores.length)
        return { id: w.id, name: w.name, url: w.url, total, seo: seo ?? 0, aeo: aeo ?? 0, geo: geo ?? 0, isSample: false }
      }).filter(Boolean).sort((a, b) => b.total - a.total)
      // 真實 ≥ 8 → 全用真實;不足 → 真實在前、樣本補後面 8 位
      const merged = realRanked.length >= 8
        ? realRanked.slice(0, 8)
        : [...realRanked, ...SAMPLE_TOP].slice(0, 8)
      setTopSites(merged)
    }
    init()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) { navigate('/login', { state: { from: '/' } }); return }
    if (!url) return
    setLoading(true)
    setScanLogs([])
    setErrorInfo(null)   // 開新一輪掃描清掉前次錯誤 banner
    setStatus('正在建立網站記錄...')

    // websiteId 拉到 try 外，方便 catch 時也能用（anti-bot blocked 仍要寫 partial audit）
    let websiteId = null
    let cleanUrl = ''
    try {
      // 用 normalizeUrl helper 把 URL 變體統一（拿 www. / trailing slash / query string / hash 等）
      // 避免「同一網站不同變體」被當成不同網站，造成 dedup 失效（pilotoptical 案例 Leo 帳號被建 3 筆 row）
      cleanUrl = normalizeUrl(url)
      if (!cleanUrl) throw new Error('URL 格式錯誤')

      // 以「URL + user_id」為唯一鍵：同一網址不同用戶各有自己的紀錄，避免資料污染與後台漏抓
      const { data: existing } = await supabase
        .from('websites')
        .select('id')
        .eq('url', cleanUrl)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        websiteId = existing.id
      } else {
        const { data: newSite, error: siteError } = await supabase
          .from('websites').insert([{ url: cleanUrl, name: new URL(cleanUrl).hostname, user_id: user.id }]).select().single()
        if (siteError) throw siteError
        websiteId = newSite.id
      }

      setStatus('正在分析網站...')
      // fetchPageContent 回傳 { html, sslFallback, uaFallback, antiBotBlocked } — 旗標供下方 analyzers 用
      const { html } = await fetchPageContent(cleanUrl)
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
          alt_tags: seoResult.alt_tags, mobile_compatible: seoResult.mobile_compatible,
          page_speed: seoResult.page_speed,
          ssl_chain: seoResult.ssl_chain,                       // 第 6 項 SSL 憑證鏈檢測（2026-05-22 新增）
          bot_accessibility: seoResult.bot_accessibility,       // 第 7 項 爬蟲可達性 / Cloudflare 擋 AI 爬蟲（2026-05-22 新增）
        }]),
        aeoResult && supabase.from('aeo_audits').insert([{
          website_id: websiteId, score: aeoResult.score,
          json_ld: aeoResult.json_ld, faq_schema: aeoResult.faq_schema,
          faq_visual: aeoResult.faq_visual,    // 2026-05-25：頁面有視覺 FAQ 但缺 schema 的訊號
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
      const detail = error?.message || error?.error?.message || JSON.stringify(error).slice(0, 200)
      // 寫 scan_error_logs 給 admin 後台稽核
      try {
        await supabase.from('scan_error_logs').insert({
          user_id: user?.id || null,
          url: url,
          step: error?.step || 'unknown',
          error_code: error?.code || error?.cause?.code || null,
          error_message: detail.slice(0, 1000),
          http_status: error?.status || null,
        })
      } catch (logErr) {
        console.warn('Failed to write scan_error_logs:', logErr?.message)
      }

      // ───── 特殊路徑：anti-bot 鎖極嚴（3 輪 UA 全擋）─────
      // 雖然抓不到 HTML 做完整 7 項檢測，但「網站擋下所有爬蟲」本身就是最高優先的 finding
      // 寫一筆 partial seo_audit 只標 bot_accessibility=blocked，讓用戶到 SEO 詳情頁看完整修復建議
      if (error?.antiBotBlocked && websiteId) {
        const blockedBotResult = checkBotAccessibility(false, true)  // uaFallback=false, antiBotBlocked=true
        try {
          await supabase.from('seo_audits').insert([{
            website_id: websiteId,
            score: 0,                                   // 因為其他 6 項全 0（未檢測）+ 第 7 項 0（blocked）= 0/7
            bot_accessibility: blockedBotResult,
          }])
          fetchMyWebsites()
          // 用聳動 modal 取代原生 alert — anti-bot 全擋是最有衝擊力的 finding，要視覺強化
          setAntiBotModal({ open: true, websiteId, url: cleanUrl })
          setLoading(false)
          setStatus('')
          return
        } catch (insertErr) {
          console.error('Partial audit insert failed:', insertErr)
          // 落回一般 errorInfo 路徑
        }
      }

      // 從 error 物件衍生結構化錯誤資訊（取代原本黑箱 alert）
      // 規則：先看 status / code 分類，再從 error.message（含 fetch-url 回傳的 hint）萃取人話
      const status = error?.status || error?.code
      const isNetwork = error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN' || /network|fetch failed/i.test(detail)
      const isTimeout = error?.code === 'ETIMEDOUT' || /timeout/i.test(detail)
      const isInvalidUrl = error?.code === 'ERR_INVALID_URL' || /URL 格式/i.test(detail)
      let info
      if (error?.antiBotBlocked) {
        // 走到這代表 partial audit insert 也失敗 — 退而求其次給文字訊息
        info = {
          title: '網站擋下我們的爬蟲',
          hint: '你的網站對所有爬蟲身份都回 403（Cloudflare / WAF anti-bot 鎖極嚴）。ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎大概率也抓不到 — 這正是你在 AI 答案中隱形的主因。',
          action: '請聯絡網站管理員調整 Cloudflare → Security → Bots → Super Bot Fight Mode 降為 Standard，並在 WAF Custom Rules 白名單 AI 爬蟲 User-Agent。',
        }
      } else if (status === 403 || /403/.test(detail)) {
        info = {
          title: '網站回 403 — anti-bot 設定偏嚴',
          hint: '我們嘗試多種爬蟲身份仍被擋。可能是 Cloudflare Bot Fight Mode、防火牆規則、或 robots.txt 拒絕。',
          action: '請降低 anti-bot 嚴格度，或在 WAF 白名單 GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot / anthropic-ai 等 AI 爬蟲 UA。',
        }
      } else if (status === 404 || /404/.test(detail)) {
        info = {
          title: '找不到這個網址',
          hint: '伺服器回 404 — 網址路徑可能拼錯、或頁面已下線。',
          action: '請確認網址完整且正確（可以直接複製瀏覽器網址列），然後重試。',
        }
      } else if (status === 503 || /503/.test(detail)) {
        info = {
          title: '網站暫時不可用',
          hint: '伺服器回 503 — 通常代表過載、維護中、或 anti-bot 服務（如 Cloudflare 5 秒驗證）擋下了我們。',
          action: '稍後再試一次。如果一直失敗，請檢查網站是否正常運作。',
        }
      } else if (isTimeout) {
        info = {
          title: '網站回應太慢',
          hint: '連線超過 30 秒沒回應 — 可能是伺服器負載過高、CDN 設定問題、或防火牆延遲。',
          action: '稍等幾分鐘再試。如果持續超時，建議檢查網站的伺服器效能。',
        }
      } else if (isInvalidUrl) {
        info = {
          title: '網址格式錯誤',
          hint: '輸入的網址無法解析（可能多了字、少了 https://、或主機名稱不合法）。',
          action: '請複製瀏覽器網址列的完整網址再貼上。',
        }
      } else if (isNetwork) {
        info = {
          title: '連不上這個網站',
          hint: 'DNS 解析失敗、或網站根本沒回應。可能是網址拼錯、網站已關閉、或我們所在的網路出口被擋。',
          action: '先在瀏覽器確認網址打得開，再回來重試。',
        }
      } else {
        info = {
          title: '掃描失敗',
          hint: error?.message || '發生未預期的錯誤。',
          action: '請截圖此訊息回報給客服，我們會協助排查。',
        }
      }
      setErrorInfo({ ...info, code: error?.code || `HTTP_${status || 'UNKNOWN'}`, status: status || null, technical: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    {loading && <DarkScanningOverlay logs={scanLogs} targetUrl={url} />}

    {/* Anti-bot 鎖極嚴的聳動 modal — 取代原生 alert，用衝擊式視覺強調「AI 看不見你」這個核心商業 finding */}
    {antiBotModal.open && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.85)' }}
        onClick={() => setAntiBotModal({ open: false, websiteId: null, url: '' })}
      >
        <div
          className="relative w-full max-w-xl rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(127,29,29,0.95) 0%, rgba(15,23,42,0.98) 60%, rgba(0,0,0,1) 100%)',
            border: '1px solid rgba(239,68,68,0.5)',
            boxShadow: '0 0 80px rgba(239,68,68,0.35), 0 0 200px rgba(239,68,68,0.15)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 頂部紅色警示條：跳動 pulse 動畫 */}
          <div style={{
            background: 'linear-gradient(90deg, #ef4444, #dc2626, #ef4444)',
            backgroundSize: '200% 100%',
            animation: 'antiBotPulse 2.5s ease-in-out infinite',
            padding: '6px 0',
            textAlign: 'center',
            fontSize: 11, fontWeight: 800, letterSpacing: '.15em',
            color: 'white', textTransform: 'uppercase',
          }}>
            🚨 CRITICAL · 爬蟲可達性 0 分 · AI 隱形警報
          </div>

          <div className="p-8 sm:p-10">
            {/* 大 icon — 紅色禁止符號疊在 AI bot 上 */}
            <div className="flex justify-center mb-5">
              <div className="relative" style={{ width: 88, height: 88 }}>
                <div className="absolute inset-0 rounded-full" style={{
                  background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)',
                  animation: 'antiBotPulse 2.5s ease-in-out infinite',
                }} />
                <div className="relative w-full h-full flex items-center justify-center text-6xl">
                  🚫
                </div>
              </div>
            </div>

            {/* 主標題 — 大、粗、紅 */}
            <h2 className="text-center mb-3" style={{
              fontSize: 26, fontWeight: 900, color: '#fff',
              textShadow: '0 0 30px rgba(239,68,68,0.4)',
              lineHeight: 1.3,
            }}>
              你的網站對 AI<br />
              <span style={{ color: '#fca5a5' }}>完全隱形</span>
            </h2>

            {/* URL chip */}
            <div className="text-center mb-6">
              <code style={{
                display: 'inline-block',
                padding: '4px 12px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6,
                fontSize: 12,
                color: '#fca5a5',
                fontFamily: 'JetBrains Mono, monospace',
              }}>{antiBotModal.url}</code>
            </div>

            {/* 衝擊文案 */}
            <div style={{
              padding: 16,
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 14, lineHeight: 1.75,
              color: 'rgba(255,255,255,0.85)',
              marginBottom: 20,
            }}>
              我們嘗試了 <strong style={{ color: '#fff' }}>4 種爬蟲身份</strong>（Googlebot / Chrome / Bingbot / 第三方 proxy）<strong style={{ color: '#fca5a5' }}>全部被擋下</strong>。
              <br /><br />
              代表 <strong style={{ color: '#fff' }}>ChatGPT、Claude、Perplexity</strong> 等 AI 引擎**也讀不到你的網站**。
              當用戶問 AI「推薦哪一家」時 — <strong style={{ color: '#fca5a5' }}>AI 根本看不見你的存在</strong>。
              <br /><br />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                這是 Cloudflare 等 anti-bot 設定太嚴造成的「AI 隱形殺手」，台灣很多中小企業中招而不自知。
              </span>
            </div>

            {/* CTA 兩顆按鈕 */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  const id = antiBotModal.websiteId
                  setAntiBotModal({ open: false, websiteId: null, url: '' })
                  if (id) navigate(`/seo-audit/${id}`)
                }}
                className="flex-1 px-6 py-3.5 rounded-xl font-bold text-white transition-all shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  boxShadow: '0 8px 24px rgba(239,68,68,0.4)',
                  fontSize: 15,
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(239,68,68,0.55)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 24px rgba(239,68,68,0.4)' }}
              >
                立即查看修復方案 →
              </button>
              <button
                onClick={() => setAntiBotModal({ open: false, websiteId: null, url: '' })}
                className="px-5 py-3.5 rounded-xl font-medium transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 14,
                }}
              >
                稍後處理
              </button>
            </div>

            {/* footer：小字社會證明 / 緊迫感 */}
            <div className="text-center mt-5" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
              💡 修復通常需要請工程師調 Cloudflare 設定或加 robots.txt 白名單，<br />
              詳情頁有完整的「平台別」修法指引（WordPress / Shopify / 自架 HTML）
            </div>
          </div>
        </div>

        <style>{`
          @keyframes antiBotPulse {
            0%, 100% { opacity: 1; background-position: 0% 0%; }
            50% { opacity: 0.85; background-position: 100% 0%; }
          }
        `}</style>
      </div>
    )}
    <div className="min-h-screen relative overflow-hidden" style={{
      background: '#000',
    }}>

      {/* 上方青綠漸層光暈 — 從頁首左上往中央漸隱至純黑（範圍比照原本 full-page 設定）
         使用 mix-blend-mode: lighten 確保和下方漸層重疊時亮色不會被蓋掉 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />

      {/* 下方青綠漸層光暈 — 從頁尾右下往左上擴散（335deg = 155deg 雙軸鏡像，亮角落到對側）
         同樣使用 lighten 混合，避免其黑色區覆蓋上方漸層的亮色 */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />

      {/* 顆粒感疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />

      {/* Header */}
      <header className="relative z-50 border-b border-white/8 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-3 sm:py-4">
            {/* Logo 區（2026-06-06 v3）— 補上 C 方向 radar dial mark + Aark wordmark + AI 雷達 中文副標 */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0 no-underline">
              <AarkMark size={36} className="flex-shrink-0" />
              <span className="text-xl sm:text-2xl font-bold text-white leading-none"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  letterSpacing: '-0.04em',
                }}>
                Aark
              </span>
              <span className="hidden sm:inline text-sm sm:text-base text-white/55 leading-none">
                · AI 雷達
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              <Link to="/showcase" className="text-white hover:text-orange-300 transition-colors text-sm">排行榜</Link>
              <Link to="/compare" className="text-white hover:text-orange-300 transition-colors text-sm">競品比較</Link>
              <Link to="/pricing" className="text-white hover:text-orange-300 transition-colors text-sm">定價</Link>
              <Link to="/content-audit" className="text-white hover:text-orange-300 transition-colors text-sm">文章分析</Link>
              <Link to="/faq" className="text-white hover:text-orange-300 transition-colors text-sm">FAQ</Link>
            </nav>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 公告鈴鐺（2026-06-06）— 跟 SiteHeader 同步、0 條未讀時自動隱藏 */}
              <NotificationBell />
              {user ? (
                <>
                  {!isPro && (
                    <Link to="/pricing" className="hidden sm:block px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors font-medium">升級 Pro</Link>
                  )}
                  <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0">
                    {user?.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold">
                        {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <button onClick={signOut} className="text-white/70 hover:text-white text-sm sm:text-sm transition-colors">登出</button>
                </>
              ) : (
                <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
              )}
            </div>
          </div>

          {/* 手機版導覽 */}
          <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-hide">
            {[
              ['/showcase', '排行榜'], ['/compare', '競品比較'],
              ['/pricing', '定價'], ['/content-audit', '文章分析'], ['/faq', 'FAQ'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="flex-shrink-0 px-3 py-1 text-sm text-white hover:text-orange-300 hover:bg-white/10 rounded-lg transition-colors whitespace-nowrap">{label}</Link>
            ))}
          </div>
        </div>
      </header>

      {/* 公告改成 SiteHeader 右上角鈴鐺、不再放在 hero 上方占空間（2026-06-06）
          只保留早鳥優惠 banner — 自動依 earlybird_taken 顯示剩餘名額，售完自動藏 */}
      <div className="relative z-10">
        <EarlybirdBanner />
      </div>

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
              <span className="text-orange-300 text-sm font-medium">涵蓋 ChatGPT · Claude · Perplexity · Google</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-3 leading-tight text-white">
              ChatGPT 推不<br />推薦你的品牌?
            </h1>

            {/* Hero 進一步瘦身（2026-06-06）— 拿掉 3 樣搬去更適合的脈絡：
                - 副標第二句小字「延續而非取代 SEO」 → 搬到「五大訊號層」section subtitle
                - LLMO chip 列 → 升級成「五大訊號層」5 卡片 section
                - social proof bar → 搬到 PlatformLogoWall 下方獨立 strip */}
            <p className="text-xl md:text-2xl font-semibold text-white mb-6 leading-snug">
              你過去花在 SEO 的努力，<br />
              不會 1:1 自動轉成 <span className="whitespace-nowrap">AI 曝光</span>。
            </p>

            <p className="text-base text-white/80 mb-4 max-w-lg">
              輸入網址，60 秒給你完整 AI 能見度報告 — 免費診斷 + 平台別修法步驟手把手帶你修
            </p>

            {/* 差異化賣點 chip — v2 改動（2026-06-05）：
                - 第 1 個 chip 從「7 大檢測項一次到位」換成「代理商必備：多站追蹤 + PDF 報告」
                  → 5 AI 共識：必須在 Hero 暗示「給代理商用」、不然品牌主 vs 代理商混淆
                - 「不懂程式碼也能照著步驟修」保留、給 P1 品牌主友善訊號 */}
            <div className="flex flex-wrap gap-2 mb-10 max-w-lg">
              <span className="text-sm px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-medium">
                ✓ 代理商：拿這份報告賣給你客戶
              </span>
              <span className="text-sm px-3 py-1.5 rounded-full bg-orange-500/15 border border-orange-400/30 text-orange-300 font-medium">
                ✓ 連 Cloudflare 擋 ChatGPT 都檢得出
              </span>
              <span className="text-sm px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 font-medium">
                ✓ Ahrefs / SEMrush 不做這個
              </span>
              <span className="text-sm px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-purple-300 font-medium">
                ✓ 不懂程式碼也能照著步驟修
              </span>
              {/* 對標業界 push「Organization Schema 必要」趨勢（91app/awoo/YouTube 那批人都在講）
                  — 我們的 OrgSchemaGenerator Pro 工具一鍵解、用戶搜「Organization Schema」會找到我們 */}
              <span className="text-sm px-3 py-1.5 rounded-full bg-pink-500/15 border border-pink-400/30 text-pink-300 font-medium">
                ✓ Organization Schema 一鍵自動產生
              </span>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onFocus={() => { if (!user) navigate('/login', { state: { from: '/' } }) }}
                  placeholder={
                    user
                      ? (typedDomain ? `輸入網址,例如 ${typedDomain}` : '輸入您的網址')
                      : '請先登入以開始分析'
                  }
                  className="home-url-input flex-1 px-6 py-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-400/60 focus:border-transparent transition-all"
                  disabled={loading}
                  style={{
                    animation: 'urlInputGlow 2.6s ease-in-out infinite',
                  }}
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
                <p className="mt-3 text-white/50 text-sm">
                  <Link to="/login" className="text-orange-400 hover:text-orange-300 underline font-medium">登入</Link> 或 <Link to="/register" className="text-orange-400 hover:text-orange-300 underline font-medium">免費註冊</Link> 後即可開始分析
                </p>
              )}

              {/* social proof + 早鳥 strip 已搬到 PlatformLogoWall 下方（2026-06-06）— 跟「覆蓋哪些 AI」緊接更連貫 */}

              {/* 結構化錯誤 banner — 取代原本 alert，給用戶可行動的下一步 */}
              {errorInfo && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm" role="alert">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-red-200 mb-1.5">{errorInfo.title}</div>
                      <div className="text-white/80 leading-relaxed mb-2">{errorInfo.hint}</div>
                      <div className="text-white/70 leading-relaxed">
                        <span className="text-amber-300 font-medium">建議行動：</span>{errorInfo.action}
                      </div>
                      <details className="mt-3 text-white/45 text-sm">
                        <summary className="cursor-pointer hover:text-white/70 select-none">技術細節（給客服用）</summary>
                        <div className="mt-1.5 font-mono break-all">
                          {errorInfo.code}{errorInfo.status ? ` · ${errorInfo.status}` : ''}
                          <br />{errorInfo.technical?.slice(0, 300)}
                        </div>
                      </details>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorInfo(null)}
                      className="text-white/40 hover:text-white/80 text-lg leading-none px-1"
                      aria-label="關閉錯誤訊息"
                    >×</button>
                  </div>
                </div>
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
                /* angle=162° r=200 */ { label: 'Meta AI',       color: '#a5b4fc', style: { top:  '58px', left: '115px' } },
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
                    <span className="text-sm font-semibold" style={{ color }}>{label}</span>
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
                <span className="text-sm text-white/60 font-normal">{myWebsites.length} / {WEBSITE_LIMIT} 個</span>
              </div>
              {!isPro && <Link to="/pricing" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">升級解鎖更多 →</Link>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myWebsites.map(site => {
                const hasScore = site.seo !== null || site.aeo !== null || site.geo !== null
                const total = hasScore
                  ? Math.round(([site.seo, site.aeo, site.geo].filter(v => v !== null).reduce((a, b) => a + b, 0)) / [site.seo, site.aeo, site.geo].filter(v => v !== null).length)
                  : null
                // 分數對應顏色:綠（>=70）/ 黃（>=40）/ 紅
                const scoreColor = s => s >= 70 ? T.pass : s >= 40 ? T.warn : T.fail
                return (
                  <Link key={site.id} to={`/dashboard/${site.id}`} className="block group">
                    <GlassCard color={T.orange} hover style={{ padding: 16 }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate group-hover:text-orange-400 transition-colors" style={{ color: T.text }}>{site.name}</p>
                          <p className="text-sm truncate mt-0.5" style={{ color: T.textMid }}>{site.url}</p>
                        </div>
                        {total !== null && <span className="flex-shrink-0 text-xl font-bold" style={{ color: scoreColor(total) }}>{total}</span>}
                      </div>
                      {hasScore ? (
                        <div className="space-y-1.5">
                          {[['SEO', site.seo], ['AEO', site.aeo], ['GEO', site.geo]].map(([label, score]) => score !== null && (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-sm w-7" style={{ color: T.textMid }}>{label}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                <div className="h-1.5 rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} />
                              </div>
                              <span className="text-sm font-bold w-6 text-right" style={{ color: scoreColor(score) }}>{score}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm" style={{ color: T.textMid }}>尚未分析</p>}
                      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="text-sm" style={{ color: T.textMid }}>🤖 {timeAgo(site.last_scanned_at)}</span>
                        <span className="text-sm font-medium group-hover:underline" style={{ color: T.orange }}>查看報告 →</span>
                      </div>
                    </GlassCard>
                  </Link>
                )
              })}
              {myWebsites.length < WEBSITE_LIMIT && (
                <button onClick={() => document.querySelector('input[type="text"]')?.focus()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-4 transition-all min-h-[120px]"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', color: T.textMid }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange + '66'; e.currentTarget.style.color = T.orange }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = T.textMid }}
                >
                  <span className="text-2xl">＋</span>
                  <span className="text-sm font-medium">新增網站</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 跑馬燈 — 強調色從紫色改為 aivis 青綠（與 v2 設計系統一致） */}
        {recentScans.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-2 justify-center">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.aivis }}></span>
              <span className="text-sm tracking-widest uppercase" style={{ color: T.textMid }}>AI 即時讀取動態</span>
            </div>
            <GlassCard style={{ padding: '12px 0', overflow: 'hidden' }}>
              <div className="flex whitespace-nowrap" style={{ animation: 'tickerScroll 25s linear infinite' }}>
                {[...recentScans, ...recentScans].map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-2 px-6 text-sm">
                    <span className="text-base" style={{ color: T.aivis }}>🤖</span>
                    <span className="font-medium" style={{ color: T.text }}>{item.name}</span>
                    <span className="text-sm" style={{ color: T.textLow }}>{timeAgo(item.scanned_at)}</span>
                    <span className="mx-3" style={{ color: T.textLow }}>·</span>
                  </span>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {/* 平台 logo wall — 信任訊號 + 對標 GetAutoSEO/Surfer/Ahrefs 等首頁標準操作 */}
        <PlatformLogoWall />

        {/* Social proof + 早鳥 strip（2026-06-06 從 Hero 搬到這裡）— 緊接 PlatformLogoWall：
            「我們覆蓋這 5 個 AI 引擎 → 已協助 X 個品牌跑了 Y 次檢測」的連貫敘事 */}
        {publicStats && (
          <div className="mt-8 max-w-3xl mx-auto rounded-2xl p-4 sm:p-5" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/65">
              <span className="flex items-center gap-2">
                <span className="text-emerald-400 text-base">✓</span>
                已協助
                <strong className="text-white font-mono text-base">{publicStats.brands.toLocaleString()}</strong>
                個品牌完成
                <strong className="text-white font-mono text-base">{publicStats.reports.toLocaleString()}</strong>
                次 AI 能見度檢測
              </span>
              {publicStats.earlybird_taken < 100 && (
                <>
                  <span className="text-white/15">·</span>
                  <span className="flex items-center gap-2">
                    <span className="text-amber-300 text-base">⏰</span>
                    早鳥
                    <strong className="text-amber-300 font-mono text-base">NT$990</strong>
                    / 月 剩
                    <strong className="text-amber-300 font-mono text-base">{100 - publicStats.earlybird_taken}</strong>
                    名
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 本週 AI 趨勢卡（2026-06-06）— 訪客也看得到、創造每週回訪動機 */}
        <div className="mt-12">
          <WeeklyAITrendsCard />
        </div>

        {/* 本週 AI 能見度 TOP 8 — 真實掃描分數排名(不足時樣本補位) */}
        {topSites.length > 0 && (
          <div className="mt-16">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3" style={{
                  background: T.aivis + '1f',
                  border: `1px solid ${T.aivis}55`,
                }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.aivis }} />
                  <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: T.aivis }}>本週榜單</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: T.text, letterSpacing: '-0.02em' }}>
                  AI 能見度 TOP 8
                </h2>
                <p className="text-sm mt-1" style={{ color: T.textMid }}>
                  所有掃描網站的最新總分排名 · 你也可以上榜
                </p>
              </div>
              <Link to="/showcase" className="text-sm font-medium" style={{ color: T.orange }}>
                查看完整排行榜 →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topSites.slice(0, 8).map((site, i) => {
                const rank = i + 1
                // 前三名給金/銀/銅獎牌與專屬色,4–8 名顯示 #N
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
                const rankColor = rank === 1 ? '#fbbf24' : rank === 2 ? '#cbd5e1' : rank === 3 ? '#fb923c' : T.textMid
                const scoreColor = (s) => s >= 70 ? T.pass : s >= 40 ? T.warn : T.fail
                // 樣本資料無 dashboard 連結,真實資料才包 Link
                const Inner = (
                  <GlassCard color={rank <= 3 ? T.orange : null} hover style={{ padding: 14 }}>
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 text-center font-bold" style={{
                        color: rankColor,
                        fontSize: rank <= 3 ? 22 : 16,
                      }}>{medal}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate flex items-center gap-2" style={{ color: T.text }}>
                          {site.name}
                          {site.isSample && (
                            <span className="text-sm px-1.5 py-0.5 rounded font-normal" style={{
                              color: T.textLow,
                              background: 'rgba(255,255,255,0.06)',
                            }}>樣本</span>
                          )}
                        </div>
                        <div className="text-sm truncate" style={{ color: T.textMid }}>{site.url}</div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-2xl font-bold leading-none" style={{ color: scoreColor(site.total) }}>{site.total}</div>
                        <div className="text-sm mt-1" style={{ color: T.textLow }}>
                          SEO {site.seo} · AEO {site.aeo} · GEO {site.geo}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                )
                // 真實網站點擊跳「公開摘要頁」(/website-summary/:id)，只看分數不看具體缺陷
                // 樣本資料無真實 id 不可點
                return site.isSample
                  ? <div key={site.id || i}>{Inner}</div>
                  : <Link key={site.id || i} to={`/website-summary/${site.id}`} className="block">{Inner}</Link>
              })}
            </div>
          </div>
        )}

        {/* How it Works — 五大 LLMO 訊號層（2026-06-06 從「三大」升級到「五大」、補進 E-E-A-T 跟 aivis）
            為什麼從 3 → 5：跟產品實際做的事一致（5 大訊號層）、跟 Dashboard 5 Tab 視覺一致、把 LLMO 完整架構在首頁呈現 */}
        <div className="mt-24">
          {/* Section header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4" style={{
              background: T.aivis + '1f',
              border: `1px solid ${T.aivis}55`,
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.aivis }} />
              <span className="text-sm font-semibold tracking-widest uppercase" style={{ color: T.aivis }}>LLMO Signal Stack</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: T.text, letterSpacing: '-0.02em' }}>
              五大 LLMO 訊號層
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: T.textMid, lineHeight: 1.7 }}>
              方舟 AI 雷達把 LLMO 拆成 5 個可量化訊號 — 把你過去花在 SEO 的成果，
              <span style={{ color: T.aivis }}>再轉成 ChatGPT、Perplexity 看得懂的訊號</span>。
              <br />
              <span className="text-sm" style={{ color: T.textLow }}>延續而非取代 SEO。</span>
            </p>
          </div>

          {/* 5 張卡（3+2 響應式：桌面 5 欄、平板 3 欄、手機 1 欄） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                stage: '01',
                icon: '🎯',
                title: 'SEO',
                fullName: '搜尋引擎優化',
                tag: '地基',
                desc: '讓 Google / Bing 能正確讀懂你的內容架構。',
                items: ['Meta 標籤', 'H1 / Hn 結構', '圖片 Alt', '行動版相容', '載入速度'],
                color: T.seo,
              },
              {
                stage: '02',
                icon: '💬',
                title: 'AEO',
                fullName: '問答引擎優化',
                tag: '答案層',
                desc: '讓 AI 直接把你當答案、引用你的內容。',
                items: ['FAQ Schema', 'JSON-LD', '問句式標題', 'Open Graph', '麵包屑'],
                color: T.aeo,
              },
              {
                stage: '03',
                icon: '🤖',
                title: 'GEO',
                fullName: '生成引擎優化',
                tag: '推薦層',
                desc: '讓 ChatGPT / Claude / Perplexity 主動推薦你。',
                items: ['llms.txt', 'AI 爬蟲開放', 'Sitemap', 'JSON-LD Citation', '內容新鮮度'],
                color: T.geo,
              },
              {
                stage: '04',
                icon: '🏆',
                title: 'E-E-A-T',
                fullName: '可信度框架',
                tag: '信任層',
                desc: '讓 AI 判斷你可信、值得引用的訊號。',
                items: ['作者署名', '關於我們', '聯絡方式', '隱私權政策', 'Organization Schema'],
                color: T.eeat,
              },
              {
                stage: '05',
                icon: '📡',
                title: 'aivis',
                fullName: '跨 LLM 引用追蹤',
                tag: '結果驗證',
                desc: '量化你在 5 個 AI 引擎的真實提及率。',
                items: ['ChatGPT 引用率', 'Claude 引用率', 'Perplexity 引用率', 'Gemini 引用率', 'GLM 引用率'],
                color: '#f97316',
              },
            ].map((item) => (
              <GlassCard key={item.stage} color={item.color} hover style={{ padding: 20 }}>
                {/* 階段編號 + tag */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-2xl font-bold" style={{ color: item.color, opacity: 0.85 }}>{item.stage}</span>
                  <span className="text-sm font-medium px-2 py-0.5 rounded-full" style={{
                    color: item.color,
                    background: item.color + '1a',
                    border: `1px solid ${item.color}40`,
                  }}>{item.tag}</span>
                </div>
                <div className="text-3xl mb-2">{item.icon}</div>
                <h3 className="text-lg font-bold mb-0.5" style={{ color: T.text, letterSpacing: '-0.01em' }}>{item.title}</h3>
                <div className="text-sm mb-2" style={{ color: T.textMid }}>{item.fullName}</div>
                <p className="text-sm mb-3" style={{ color: T.textMid, lineHeight: 1.6 }}>{item.desc}</p>
                {/* 檢測項目清單 */}
                <ul className="space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {item.items.map((it, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: T.textMid }}>
                      <span className="flex-shrink-0 mt-0.5" style={{ color: item.color }}>✓</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* B4: 首頁內嵌 Showcase 區塊（Top 5 排行 + 進步之星 + 完整 showcase CTA）
            取代原本「排行榜入口」薄按鈕、降低用戶探索門檻、直接看到社會證明 */}
        <HomeShowcaseSection />

        {/* FAQ */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: T.text }}>常見問題</h2>
            <p className="text-sm" style={{ color: T.textMid }}>關於 SEO、AEO、GEO 與 E-E-A-T 的快速解答</p>
          </div>
          <div className="space-y-3">
            {[
              { q: '什麼是 AI 能見度?', a: 'AI 能見度是指你的網站在 ChatGPT、Claude、Perplexity、Google AI 等平台中被「看見」並「引用」的能力。傳統 SEO 讓你出現在 Google,AI 能見度讓你出現在 AI 的回答中。' },
              { q: 'SEO、AEO、GEO、E-E-A-T 有什麼不同?', a: 'SEO 讓搜尋引擎找到你;AEO 讓 AI 直接引用你的答案;GEO 讓生成式 AI 在回答中推薦你;E-E-A-T 建立品牌可信度,影響前三者的評分。四者互補,缺一不可。' },
              { q: '分析需要多久?需要安裝什麼嗎?', a: '不需要安裝任何東西。輸入網址後約 15–30 秒即可看到完整報告,系統會自動爬取並分析你的網站。' },
              { q: '分數低要怎麼辦?', a: '儀表板的「AI 優化工具」會根據你的失敗項目,自動列出最重要的 5 條改善行動,並提供可直接複製的修復程式碼(llms.txt、JSON-LD、FAQ Schema)。' },
            ].map((item, i) => <HomeFAQItem key={i} q={item.q} a={item.a} />)}
          </div>
          <div className="text-center mt-6">
            <Link to="/faq" className="text-sm font-medium transition-colors" style={{ color: T.orange }}>
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
