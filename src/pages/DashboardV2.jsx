/**
 * DashboardV2 — prototype-2b 設計實作（B1 phase）
 *
 * 結構（對齊 _prototypes/prototype-2b-dashboard-monitor-centric.html）：
 *   1. SiteHeader（共用）
 *   2. TopBar：返回 + 網站名 + 重新檢測 / 匯出 PDF
 *   3. ✨ aivis Hero（左大主視覺 + 右 gamify rail 三張卡）
 *   4. Notice strip（取代走馬燈、Dashboard 一格通知欄）
 *   5. Quest Section（今日任務 = 遊戲化 Action Center）
 *   6. 站點體檢 5 Tab wrapper（SEO / AEO / GEO / EEAT / 內容品質）
 *   7. 30 天進步曲線
 *   8. Footer
 *
 * B1 phase 範圍：
 *   - UI 骨架完整、樣式對齊 prototype-2b
 *   - gamification 用 mock 資料（level 5 青銅 / streak 5 / 3 個解鎖徽章）
 *   - 5 Tab 內容簡化（顯示分數 + drill-down link、完整 prototype-4 在 B3 補）
 *   - 砍永久早鳥 banner、砍走馬燈（這頁不引入）
 *   - 路由：/dashboard-v2/:id（舊版 /dashboard/:id 不影響）
 */
import { useState, useEffect } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import { analyzeContent } from '../services/contentAnalyzer'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'

// ─── 5 大面向色 token ───────────────────────────────────
const FACE_COLORS = {
  seo: '#3b82f6',
  aeo: '#8b5cf6',
  geo: '#10b981',
  eeat: '#f59e0b',
  content: '#ec4899',
}
const FACE_BG = {
  seo: 'rgba(59,130,246,0.18)',
  aeo: 'rgba(139,92,246,0.18)',
  geo: 'rgba(16,185,129,0.18)',
  eeat: 'rgba(245,158,11,0.18)',
  content: 'rgba(236,72,153,0.18)',
}
const FACE_BORDER = {
  seo: 'rgba(59,130,246,0.4)',
  aeo: 'rgba(139,92,246,0.4)',
  geo: 'rgba(16,185,129,0.4)',
  eeat: 'rgba(245,158,11,0.4)',
  content: 'rgba(236,72,153,0.4)',
}

// ─── B1 假資料：gamification（B2 phase 會接 Supabase 真資料）───
const MOCK_GAMIFY = {
  level: 5,
  levelName: '青銅',
  emoji: '🥉',
  // xp = 距離下一級還差的進度（0-100）
  xp: 65, xpToNext: 35, totalXp: 100,
  streak: 5,
  // 4 解鎖 / 4 鎖定（先用 emoji + label 表達）
  badges: [
    { emoji: '🚀', label: '首次掃描', unlocked: true },
    { emoji: '🔥', label: '7 日連續登入', unlocked: true },
    { emoji: '🩺', label: '完成站點體檢', unlocked: true },
    { emoji: '🔧', label: '初次修復', unlocked: true },
    { emoji: '✨', label: '改進 +10 分', unlocked: false },
    { emoji: '🎯', label: '所有 5 面向 ≥80', unlocked: false },
    { emoji: '📈', label: '連續 30 天進步', unlocked: false },
    { emoji: '💎', label: '達到鑽石級', unlocked: false },
  ],
}

// ─── B1 假資料：今日任務（B2 phase 會接修復建議引擎產出真實 quest）───
const MOCK_QUESTS = [
  { id: 'q1', face: 'aeo', icon: '🤖', title: '補 FAQ Schema', desc: '14 篇文章缺 FAQ Schema、AI 引用率會提升 ~15%', est: 8, mins: 25, done: false },
  { id: 'q2', face: 'content', icon: '📝', title: '解鎖 2 篇句子型 H1', desc: '改 <h1> 為 <h2>、避免 SEO 標題權重稀釋', est: 4, mins: 10, done: false },
  { id: 'q3', face: 'eeat', icon: '⭐', title: '加作者署名', desc: '8 篇文章缺作者資訊、E-E-A-T 分數會 +6', est: 6, mins: 15, done: true },
]

export default function DashboardV2() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPro, isTrial, trialDaysRemaining } = useAuth()

  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [eeatAudit, setEeatAudit] = useState(null)
  const [seoHistory, setSeoHistory] = useState([])
  const [aeoHistory, setAeoHistory] = useState([])
  const [geoHistory, setGeoHistory] = useState([])
  const [eeatHistory, setEeatHistory] = useState([])
  const [contentScore, setContentScore] = useState(null)
  const [loading, setLoading] = useState(true)

  // 5 Tab nav active
  const [activeFace, setActiveFace] = useState('seo')

  // 載資料 — 同舊 Dashboard.jsx 的 fetchData 但更精簡
  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: w } = await supabase.from('websites').select('*').eq('id', id).single()
        if (cancelled) return
        if (!w) { setLoading(false); return }
        setWebsite(w)

        // 4 大 audit + history 平行抓
        const [seo, aeo, geo, eeat] = await Promise.all([
          supabase.from('seo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(20),
          supabase.from('aeo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(20),
          supabase.from('geo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(10),
          supabase.from('eeat_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(10),
        ])
        if (cancelled) return
        if (seo.data?.length) { setSeoAudit(seo.data[0]); setSeoHistory(seo.data.slice(0, 10).reverse()) }
        if (aeo.data?.length) { setAeoAudit(aeo.data[0]); setAeoHistory(aeo.data.slice(0, 10).reverse()) }
        if (geo.data?.length) { setGeoAudit(geo.data[0]); setGeoHistory(geo.data.slice(0, 10).reverse()) }
        if (eeat.data?.length){ setEeatAudit(eeat.data[0]); setEeatHistory(eeat.data.slice(0, 10).reverse()) }

        // 內容分數 — 跟舊 Dashboard 一樣讀 cached
        const { data: cached } = await supabase
          .from('content_audits').select('score').eq('website_id', id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (!cancelled) {
          if (cached?.score != null) setContentScore(cached.score)
          else {
            // 沒 cached 就跑一次 + 寫進去
            try {
              const r = await analyzeContent(w.url)
              if (r?.score != null && !cancelled) {
                await supabase.from('content_audits').insert([{ website_id: id, score: r.score }])
                setContentScore(r.score)
              }
            } catch { /* swallow */ }
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // 5 個分數彙整（從 audit 各自的 score 欄位 / contentScore state）
  const scores = {
    seo: seoAudit?.score || 0,
    aeo: aeoAudit?.score || 0,
    geo: geoAudit?.score || 0,
    eeat: eeatAudit?.score || 0,
    content: contentScore || 0,
  }
  // 加權平均（5 面向等權）
  const overallScore = Math.round((scores.seo + scores.aeo + scores.geo + scores.eeat + scores.content) / 5)

  // 趨勢資料 — SEO/AEO/GEO/EEAT 4 條線
  const trendData = seoHistory.map((s, i) => {
    const offset = seoHistory.length - 1 - i
    const aeo = aeoHistory[aeoHistory.length - 1 - offset]?.score || 0
    const geo = geoHistory[geoHistory.length - 1 - offset]?.score || 0
    const eeat = eeatHistory[eeatHistory.length - 1 - offset]?.score || 0
    return {
      name: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      SEO: s.score,
      AEO: aeo,
      GEO: geo,
      'E-E-A-T': eeat,
    }
  })

  // Loading state
  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mb-4"></div>
            <p className="text-white/60">載入儀表板中...</p>
          </div>
        </main>
      </PageBg>
    )
  }

  if (!website) {
    return (
      <PageBg>
        <SiteHeader />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">找不到網站</h2>
            <Link to="/" className="text-teal-400 hover:text-teal-300 hover:underline">返回首頁</Link>
          </div>
        </main>
      </PageBg>
    )
  }

  return (
    <PageBg>
      <SiteHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">

        {/* ─── 試用倒數 banner（保留有用的） ─── */}
        {isTrial && trialDaysRemaining != null && trialDaysRemaining > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/30 rounded-xl flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-white">
              ⏰ <span className="font-bold">Pro 試用</span> 還剩 <span className="font-mono text-amber-300 font-bold">{trialDaysRemaining}</span> 天
            </div>
            <Link to="/pricing" className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-lg hover:opacity-90">
              升級正式版
            </Link>
          </div>
        )}

        {/* ─── 頁面 TopBar：返回 + 網站名 + 動作按鈕 ─── */}
        <TopBar website={website} navigate={navigate} />

        {/* ─── ✨ aivis Hero + Gamify Rail（grid 8:4） ─── */}
        <section className="grid lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-8">
            <AivisHero isPro={isPro} websiteName={website.name} overallScore={overallScore} />
          </div>
          <div className="lg:col-span-4">
            <GamifyRail gamify={MOCK_GAMIFY} />
          </div>
        </section>

        {/* ─── Notice strip（取代走馬燈、一格通知欄） ─── */}
        <NoticeStrip />

        {/* ─── Quest Section（今日任務 = Action Center） ─── */}
        <QuestSection quests={MOCK_QUESTS} />

        {/* ─── 站點體檢（5 Tab wrapper） ─── */}
        <AuditSection
          scores={scores}
          activeFace={activeFace}
          setActiveFace={setActiveFace}
          website={website}
          seoAudit={seoAudit}
          aeoAudit={aeoAudit}
          geoAudit={geoAudit}
          eeatAudit={eeatAudit}
          isPro={isPro}
        />

        {/* ─── 修復工具箱（合併版單一入口） ─── */}
        <ToolBox websiteId={website.id} />

        {/* ─── 30 天進步曲線 ─── */}
        {trendData.length > 1 && <TrendChart trendData={trendData} />}

      </main>

      <Footer dark />
    </PageBg>
  )
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

// 共用暗色背景 — 對齊 HomeDark / BulkScan 的青綠雙漸層 + 雜訊
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 下方青綠漸層 */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒雜訊疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.14,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}

// 頁面 TopBar — 返回 + 網站名 + 重新檢測 / 匯出 PDF
function TopBar({ website, navigate }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-white/60 hover:text-white"
        >
          ← 回首頁
        </button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-white truncate">{website.name || website.url}</h1>
          <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white/70 truncate font-mono">
            {website.url}
          </a>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate(`/dashboard/${website.id}`)}
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
          title="切回舊版 Dashboard"
        >
          ← v1
        </button>
        <button
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
        >
          🔄 重新檢測
        </button>
        <button
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
        >
          📄 匯出 PDF
        </button>
      </div>
    </div>
  )
}

// aivis Hero — 主視覺左大區（B1：mock 本月引用次數 + 30 天 sparkline、真資料 B2 補）
// 對齊 prototype-2b 第 1300-1340 行 aivis-spotlight 設計
function AivisHero({ isPro, websiteName, overallScore }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7" style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(0,0,0,0.5))',
      border: '1px solid rgba(249,115,22,0.3)',
      minHeight: 280,
    }}>
      {/* 角落光暈 */}
      <div className="absolute -top-20 -right-12 w-72 h-72 pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(249,115,22,0.25), transparent 60%)',
      }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h2 className="text-2xl font-bold text-white">AI 曝光監測 <span className="text-orange-300 text-lg font-normal">(aivis)</span></h2>
          <span className="ml-auto text-sm uppercase tracking-wider px-3 py-1 rounded-full bg-orange-500/25 border border-orange-400/50 text-orange-200 font-bold">
            Pro 核心
          </span>
        </div>
        <p className="text-base text-white/65 mb-5">{websiteName} 在 5 個 AI 引擎的真實提及率</p>

        {/* ─── 本月引用次數 + 30 天 sparkline（aivis-spotlight from prototype-2b） ─── */}
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          {/* 大數字 */}
          <div className="rounded-xl p-4" style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(249,115,22,0.18)',
          }}>
            <div className="text-sm text-white/55 mb-1">本月引用次數</div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-5xl font-black font-mono text-white leading-none">{isPro ? '47' : '?'}</span>
              {isPro && <span className="text-sm font-bold text-emerald-300">▲ +12 次 vs 上月</span>}
            </div>
            <div className="text-sm text-white/45">{isPro ? '勝過 73% 同行品牌' : '升 Pro 看完整數據'}</div>
          </div>

          {/* 30 天 sparkline */}
          <div className="rounded-xl p-4" style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(249,115,22,0.18)',
          }}>
            <div className="text-sm text-white/55 mb-2">📈 30 天引用曲線</div>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="w-full" style={{ height: 60 }}>
              <defs>
                <linearGradient id="aivisGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              {/* Area */}
              <path d="M 0,68 L 12,66 L 24,62 L 36,60 L 48,58 L 60,55 L 72,52 L 84,48 L 96,46 L 108,43 L 120,40 L 132,38 L 144,35 L 156,32 L 168,30 L 180,28 L 192,26 L 204,22 L 216,20 L 228,16 L 240,14 L 252,12 L 264,10 L 276,8 L 288,6 L 300,4 L 300,80 L 0,80 Z" fill="url(#aivisGrad)"/>
              {/* Line */}
              <path d="M 0,68 L 12,66 L 24,62 L 36,60 L 48,58 L 60,55 L 72,52 L 84,48 L 96,46 L 108,43 L 120,40 L 132,38 L 144,35 L 156,32 L 168,30 L 180,28 L 192,26 L 204,22 L 216,20 L 228,16 L 240,14 L 252,12 L 264,10 L 276,8 L 288,6 L 300,4" fill="none" stroke="#f97316" strokeWidth="2.5"/>
              {/* End point glow */}
              <circle cx="300" cy="4" r="4" fill="#f97316">
                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
              </circle>
            </svg>
            <div className="flex justify-between text-sm text-white/40 mt-1">
              <span>30 天前 · 3 次</span>
              <span>本週 · 14 次</span>
              <span>今天</span>
            </div>
          </div>
        </div>

        {/* 5 AI 引擎 chips */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {[
            { name: 'ChatGPT',     emoji: '💬', pct: 12 },
            { name: 'Claude',      emoji: '🟣', pct: 18 },
            { name: 'Perplexity',  emoji: '🔎', pct: 8 },
            { name: 'Gemini',      emoji: '✨', pct: 14 },
            { name: 'GLM',         emoji: '🧠', pct: 6 },
          ].map((e, i) => (
            <div key={i} className="text-center p-2 rounded-lg" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div className="text-2xl mb-1">{e.emoji}</div>
              <div className="text-sm text-white/55">{e.name}</div>
              <div className="text-sm font-bold text-orange-300 font-mono">{isPro ? `${e.pct}%` : '🔒'}</div>
            </div>
          ))}
        </div>

        {/* 平均提及率 + CTA */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/55 mb-1">平均提及率（30 天）</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white font-mono">{isPro ? '11.6' : '?'}</span>
              <span className="text-xl text-white/40 font-mono">%</span>
              {isPro && <span className="text-sm font-bold text-emerald-300">▲ +2.3</span>}
            </div>
          </div>
          <Link
            to="/ai-visibility"
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-xl hover:opacity-90 shadow-lg shadow-orange-500/30"
          >
            {isPro ? '看完整監測 →' : '升 Pro 解鎖 →'}
          </Link>
        </div>
      </div>
    </div>
  )
}

// 右側 Gamify Rail — Level 卡 + Streak 卡 + Badges 卡
function GamifyRail({ gamify }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Level 卡 */}
      <div className="relative overflow-hidden rounded-2xl p-4" style={{
        background: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(0,0,0,0.4))',
        border: '1px solid rgba(205,127,50,0.35)',
      }}>
        <div className="absolute -top-16 -right-10 w-48 h-48 pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(205,127,50,0.2), transparent 60%)',
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl drop-shadow-lg">{gamify.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{gamify.levelName}</span>
                <span className="text-sm px-2 py-0.5 rounded-full font-mono font-bold" style={{
                  background: 'rgba(205,127,50,0.2)',
                  color: '#e0a16a',
                }}>Lv.{gamify.level}</span>
              </div>
              <div className="text-sm text-white/45 mt-0.5">下一級還差 {gamify.xpToNext} 分</div>
            </div>
          </div>
          {/* 進度條 */}
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${gamify.xp}%`,
                background: 'linear-gradient(90deg, #cd7f32, #e0a16a)',
                boxShadow: '0 0 8px rgba(205,127,50,0.4)',
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/45 font-mono">
            <span>{gamify.xp}/{gamify.totalXp}</span>
            <span className="text-white font-bold">{gamify.xp}%</span>
          </div>
        </div>
      </div>

      {/* Streak 卡 */}
      <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.12), rgba(0,0,0,0.4))',
        border: '1px solid rgba(251,146,60,0.25)',
      }}>
        <span className="text-3xl drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.6))' }}>🔥</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-orange-400 leading-none">{gamify.streak}</span>
            <span className="text-sm text-white/55">天</span>
          </div>
          <div className="text-sm text-white/55">連續進步</div>
        </div>
      </div>

      {/* Badges 卡 */}
      <div className="rounded-2xl p-3.5" style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm uppercase tracking-widest text-white/45 font-bold">徽章</span>
          <span className="text-sm text-white/55 font-mono">
            {gamify.badges.filter(b => b.unlocked).length} / {gamify.badges.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {gamify.badges.map((b, i) => (
            <div
              key={i}
              title={b.label}
              className="aspect-square rounded-lg flex items-center justify-center text-xl transition relative"
              style={{
                background: b.unlocked ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${b.unlocked ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
                opacity: b.unlocked ? 1 : 0.3,
                filter: b.unlocked ? 'none' : 'grayscale(1)',
              }}
            >
              {b.emoji}
              {!b.unlocked && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-white/25 bg-black/30 rounded-lg">🔒</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Notice strip — 一格通知欄、取代走馬燈
function NoticeStrip() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm" style={{
      background: 'rgba(24,197,144,0.1)',
      border: '1px solid rgba(24,197,144,0.3)',
    }}>
      <span className="text-base">📡</span>
      <div className="flex-1 text-white/75">
        <strong className="text-white">aivis 升級到 5 引擎</strong> · 新增 Gemini 監測。對所有 Pro 用戶自動生效、Top-up 餘額不變
      </div>
      <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white/70 text-lg leading-none w-6 h-6 flex items-center justify-center">×</button>
    </div>
  )
}

// Quest Section — 今日任務（遊戲化 Action Center）
function QuestSection({ quests }) {
  const totalEst = quests.filter(q => !q.done).reduce((sum, q) => sum + q.est, 0)
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          ⚡ 今日任務
        </h3>
        <div className="text-sm text-white/50">
          完成可拿 <strong className="text-emerald-300 font-mono">+{totalEst} 分</strong>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quests.map(q => (
          <div key={q.id} className="rounded-xl p-3.5" style={{
            background: q.done ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${q.done ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
            opacity: q.done ? 0.7 : 1,
          }}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{q.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-base font-bold text-white">{q.done ? '✅ ' : ''}{q.title}</span>
                </div>
                <p className="text-sm text-white/55 leading-relaxed">{q.desc}</p>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-300 font-bold font-mono">+{q.est}分</span>
                    <span className="text-white/40">~{q.mins} 分鐘</span>
                  </div>
                  {!q.done && (
                    <button className="px-2 py-1 rounded text-sm font-bold transition" style={{
                      background: `${FACE_BG[q.face]}`,
                      color: FACE_COLORS[q.face],
                      border: `1px solid ${FACE_BORDER[q.face]}`,
                    }}>
                      去修 →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// 站點體檢 5 Tab wrapper — 對齊 prototype-2b 第 1493 行 audit-unified 設計
// 含：站點體檢總分（大數字）+ 五角雷達 mini + 5 Tab nav + Tab body
function AuditSection({ scores, activeFace, setActiveFace, website, seoAudit, aeoAudit, geoAudit, eeatAudit, isPro }) {
  const tabs = [
    { key: 'seo',     label: 'SEO',     score: scores.seo },
    { key: 'aeo',     label: 'AEO',     score: scores.aeo },
    { key: 'geo',     label: 'GEO',     score: scores.geo },
    { key: 'eeat',    label: 'E-E-A-T', score: scores.eeat },
    { key: 'content', label: '內容品質', score: scores.content },
  ]
  // 站點體檢總分 = 5 個 face 平均
  const overallScore = Math.round((scores.seo + scores.aeo + scores.geo + scores.eeat + scores.content) / 5)
  return (
    <section className="mb-6 relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="absolute -top-32 -right-12 w-80 h-80 pointer-events-none" style={{
        background: `radial-gradient(circle, ${FACE_BG[activeFace] || 'rgba(255,255,255,0.05)'}, transparent 60%)`,
      }} />

      <div className="relative z-10">
        {/* Section head */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">📊 站點體檢</h2>
          <span className="text-sm text-white/45 font-mono">{website.url}</span>
        </div>

        {/* ─── 站點體檢總分 + 五角雷達 mini（對齊 prototype-2b 1493-1521） ─── */}
        <div className="flex items-center gap-5 mb-6 flex-wrap p-5 rounded-xl" style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* 左：大數字 + 副標 */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="text-6xl font-black font-mono text-white leading-none" style={{
              background: 'linear-gradient(135deg, #18c590, #10b981)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
              {overallScore}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">站點體檢總分</h3>
              <div className="text-sm text-white/55 mb-1">5 大面向綜合 · 站點層級</div>
              <div className="text-sm text-emerald-300 font-bold">↑ 比上週 +5 分</div>
            </div>
          </div>
          {/* 右：五角雷達 mini SVG */}
          <PentaRadar scores={scores} size={220} />
        </div>

        {/* Tab nav — 5 個 face 切換 */}
        <div className="flex gap-1 p-1 mb-5 rounded-xl overflow-x-auto" style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFace(tab.key)}
              className="flex-1 min-w-[120px] py-3 px-4 rounded-lg transition flex flex-col items-center gap-1"
              style={{
                background: activeFace === tab.key ? FACE_BG[tab.key] : 'transparent',
                color: activeFace === tab.key ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeFace === tab.key ? `0 0 0 1px ${FACE_BORDER[tab.key]}` : 'none',
              }}
            >
              <span className="text-sm font-semibold whitespace-nowrap">{tab.label}</span>
              <span className="text-sm font-mono font-bold" style={{
                color: activeFace === tab.key ? FACE_COLORS[tab.key] : 'rgba(255,255,255,0.4)',
              }}>{tab.score || 0}</span>
            </button>
          ))}
        </div>

        {/* Tab body — B1 簡化版：分數圓 + 結論 + drill-down */}
        <AuditTabBody
          face={activeFace}
          scores={scores}
          website={website}
          seoAudit={seoAudit}
          aeoAudit={aeoAudit}
          geoAudit={geoAudit}
          eeatAudit={eeatAudit}
          isPro={isPro}
        />
      </div>
    </section>
  )
}

// 5 軸雷達 — 對齊正式版 Dashboard.jsx 1023-1095 的 Recharts RadarChart 設定
// 含三層：100 分滿分外框 / 80 分合格虛線基準 / 本站表現實心翠綠
function PentaRadar({ scores, size = 220 }) {
  const radarData = [
    { subject: 'SEO',     score: scores.seo,     target: 80, fullMark: 100 },
    { subject: 'AEO',     score: scores.aeo,     target: 80, fullMark: 100 },
    { subject: 'GEO',     score: scores.geo,     target: 80, fullMark: 100 },
    { subject: 'E-E-A-T', score: scores.eeat,    target: 80, fullMark: 100 },
    { subject: '內容',     score: scores.content, target: 80, fullMark: 100 },
  ]
  // 軸標籤的顏色 lookup（中文 subject → face color）
  const subjectColor = {
    'SEO': FACE_COLORS.seo, 'AEO': FACE_COLORS.aeo, 'GEO': FACE_COLORS.geo,
    'E-E-A-T': FACE_COLORS.eeat, '內容': FACE_COLORS.content,
  }
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => {
              const { payload, x, y, textAnchor } = props
              const color = subjectColor[payload.value] || '#fff'
              return (
                <text x={x} y={y} textAnchor={textAnchor} fill={color} fontSize={12} fontWeight={700}>
                  {payload.value}
                </text>
              )
            }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
          {/* 100 分外框 — 顯式外圈、把雷達圖視覺框起來 */}
          <Radar name="100 分滿分線" dataKey="fullMark"
            stroke="rgba(255,255,255,0.5)" fill="none" strokeWidth={1} dot={false} isAnimationActive={false}
          />
          {/* 80 分合格基準虛線 */}
          <Radar name="合格基準（80 分）" dataKey="target"
            stroke="rgba(255,255,255,0.55)" fill="rgba(255,255,255,0.04)"
            strokeDasharray="5 4" strokeWidth={1.25} dot={false} isAnimationActive={false}
          />
          {/* 本站表現 — 翠綠實心 + 5 個 face 色點 */}
          <Radar name="本站表現" dataKey="score"
            stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              const color = subjectColor[payload.subject] || '#10b981'
              return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0a0e14" strokeWidth={2} />
            }}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12, color: '#fff' }}
            formatter={(v) => [`${v} 分`, '得分']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Tab body — B1 簡化版（B3 phase 會把內容品質 Tab 換成 prototype-4 完整內容）
function AuditTabBody({ face, scores, website, seoAudit, aeoAudit, geoAudit, eeatAudit, isPro }) {
  const score = scores[face] || 0
  const faceColor = FACE_COLORS[face]

  // 各 face 的 drill-down 路徑
  const drillPath = {
    seo: `/seo-audit/${website.id}`,
    aeo: `/aeo-audit/${website.id}`,
    geo: `/geo-audit/${website.id}`,
    eeat: `/eeat-audit/${website.id}`,
    content: `/content-audit/${website.id}`,
  }[face]

  // 各 face 的標題與描述
  const faceMeta = {
    seo:     { name: 'SEO 搜尋優化',     desc: '讓 Google 搜尋找到你',          icon: '🔍' },
    aeo:     { name: 'AEO 答案引擎優化',  desc: '讓 AI 直接回答關於你',          icon: '🤖' },
    geo:     { name: 'GEO 生成式引擎優化', desc: '讓 AI 生成式搜尋引用你',       icon: '🌐' },
    eeat:    { name: 'E-E-A-T 可信度',    desc: '建立品牌專業度與可信度',         icon: '🏆' },
    content: { name: '內容品質',         desc: '文章結構與 AI 引用適合度',       icon: '📝' },
  }[face]

  // 判定文字（簡化版、B3 phase 補完整）
  const verdict = score >= 80 ? '優異' : score >= 60 ? '良好' : score >= 40 ? '尚可' : '需改善'
  const verdictColor = score >= 80 ? '#86efac' : score >= 60 ? '#a7f3d0' : score >= 40 ? '#fcd34d' : '#fca5a5'

  // 內容品質 Tab — B3 phase 會接 prototype-4 完整 panel；B1 phase 簡化版
  return (
    <div className="grid sm:grid-cols-3 gap-5 items-center">
      {/* 左：分數圓環 */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className="relative w-32 h-32 mb-3">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={faceColor} strokeWidth="8"
              strokeDasharray={`${(score / 100) * 264} 264`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${faceColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white font-mono leading-none">{score}</span>
            <span className="text-sm text-white/45 mt-1">/ 100</span>
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color: verdictColor }}>{verdict}</span>
      </div>

      {/* 中：說明 + 主要指標 */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <span>{faceMeta.icon}</span>
          {faceMeta.name}
        </h3>
        <p className="text-sm text-white/55 mb-3 leading-relaxed">{faceMeta.desc}</p>
        <div className="text-sm text-white/45 space-y-1">
          <p>📅 上次掃描：{(seoAudit || aeoAudit || geoAudit || eeatAudit)?.created_at ? new Date((seoAudit || aeoAudit || geoAudit || eeatAudit).created_at).toLocaleDateString('zh-TW') : '尚無資料'}</p>
          <p>📊 主要拖分項：請進詳細頁看完整 14 項檢測</p>
        </div>
      </div>

      {/* 右：drill-down CTA */}
      <div className="flex flex-col gap-2">
        <Link
          to={drillPath}
          className="block rounded-xl p-4 text-center transition hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${FACE_BG[face]}, rgba(0,0,0,0.4))`,
            border: `1px solid ${FACE_BORDER[face]}`,
          }}
        >
          <div className="text-sm text-white/55 mb-1">點開查看</div>
          <div className="text-base font-bold text-white">完整 {faceMeta.name} 報告 →</div>
        </Link>
        {face === 'content' && (
          <Link
            to={`/bulk-scan/${website.id}`}
            className="block rounded-xl p-3 text-center transition hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(0,0,0,0.4))',
              border: '1px solid rgba(249,115,22,0.3)',
            }}
          >
            <div className="text-sm text-orange-200">
              📂 {isPro ? '批次掃描全站 200 篇' : 'Pro 解鎖批次掃描'}
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

// 修復工具箱 — 合併單一入口（對齊 prototype-2b 第 1613-1641）
// 4 個產生器：Organization Schema / FAQ Schema / llms.txt / Article Schema
// B1 用靜態卡片、B2 phase 接真的「點開 → 模態 → 填表 → 產出 code」流程
function ToolBox({ websiteId }) {
  const tools = [
    { emoji: '🪪', name: 'Organization Schema', desc: '品牌報名表、永久儲存',     to: '/schema-check' },
    { emoji: '📋', name: 'FAQ Schema',          desc: '問答結構化資料',           to: '/schema-check' },
    { emoji: '📄', name: 'llms.txt',            desc: 'AI 爬蟲索引引導',          to: '/crawl-check' },
    { emoji: '📰', name: 'Article Schema',      desc: '文章結構化',               to: `/bulk-scan/${websiteId}` },
  ]
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          🛠 修復工具箱 <span className="text-sm font-normal text-white/55">· 合併單一入口</span>
        </h3>
        <Link to={`/bulk-scan/${websiteId}`} className="text-sm text-white/55 hover:text-white">
          查看所有工具 →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tools.map((t, i) => (
          <Link
            key={i}
            to={t.to}
            className="rounded-xl p-4 transition hover:scale-[1.02] block"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-3xl mb-2">{t.emoji}</div>
            <div className="text-base font-bold text-white mb-1">{t.name}</div>
            <div className="text-sm text-white/55 leading-relaxed">{t.desc}</div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// 30 天進步曲線
function TrendChart({ trendData }) {
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        📈 過去 30 天進步軌跡
      </h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={trendData}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#fff' }}
            />
            <Line type="monotone" dataKey="SEO"     stroke={FACE_COLORS.seo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="AEO"     stroke={FACE_COLORS.aeo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="GEO"     stroke={FACE_COLORS.geo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="E-E-A-T" stroke={FACE_COLORS.eeat} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
