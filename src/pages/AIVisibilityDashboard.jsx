import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HeartbeatTrend from '../components/HeartbeatTrend'
// 2026-06-06：公告改成 SiteHeader 右上角 NotificationBell、AIVisibilityDashboard 不再放卡片
// 注意：本頁沒用 SiteHeader（自有頁首），鈴鐺要的話得另外加

/**
 * AI 曝光監測 — 單一品牌儀表板（Phase 2c v2 版型）
 *
 * 資料來源：
 *   aivis_brands     — 品牌資料（Phase 1）
 *   aivis_prompts    — 每個品牌的監測 prompts（最多 10 條啟用）
 *   aivis_responses  — Claude 對 prompt 的單次回應（含 cost_usd、brand_mentioned）
 *   aivis_mentions   — 萃取出的品牌提及（含 position、context）
 *
 * 觸發 API：
 *   POST /api/aivis/generate-prompts?brand_id=...   重新產生 5 條 prompts
 *   POST /api/aivis/fetch?prompt_id=...&runs=3      對單一 prompt 跑 N 次掃描
 */

// =====================================================
// 設計 Token（沿用 Claude Design v2 的 inline-style 系統，避免動到 Tailwind）
// =====================================================
const T = {
  // Semantic colors
  seo: '#3b82f6',
  aeo: '#8b5cf6',
  geo: '#10b981',
  eeat: '#f59e0b',
  content: '#ec4899',
  orange: '#f97316',
  // Text
  text: 'rgba(255,255,255,0.93)',
  textMid: 'rgba(255,255,255,0.58)',
  textLow: 'rgba(255,255,255,0.32)',
  // Surfaces
  cardBg: 'rgba(1,8,14,0.55)',
  cardBorder: 'rgba(13,122,88,0.22)',
  cardBorderHover: 'rgba(24,197,144,0.45)',
  // Status
  pass: '#10b981',
  fail: '#ef4444',
  warn: '#f59e0b',
  // Type
  font: "'Plus Jakarta Sans','Noto Sans TC',sans-serif",
  mono: "'JetBrains Mono',monospace",
  // Radius
  r: 8, rM: 12, rL: 16, rXL: 24,
}

// aivis 主題色：青綠（與 HomeDark 紅色主題區隔）
const AIVIS_TEAL = '#18c590'
const AIVIS_TEAL_DEEP = '#0d7a58'
const PROMPT_CAP = 10
const SCAN_RUNS = 3 // 每條 prompt 跑幾次取平均

// ─── 多引擎顯示（2026-06-10 路線 B：engine_results JSONB） ───
// 顯示名稱 + 配色。之後加 ChatGPT / Perplexity / Grok 只要在這加一行、其餘自動長出來。
const ENGINE_META = {
  claude:     { label: 'Claude',     color: '#d97757' },  // Anthropic 橘
  gemini:     { label: 'Gemini',     color: '#4285f4' },  // Google 藍
  chatgpt:    { label: 'ChatGPT',    color: '#10a37f' },  // OpenAI 綠（預留）
  perplexity: { label: 'Perplexity', color: '#20b8cd' },  // 預留
  grok:       { label: 'Grok',       color: '#888888' },  // 預留
}
function engineLabel(key) { return ENGINE_META[key]?.label || key }
function engineColor(key) { return ENGINE_META[key]?.color || T.textMid }

// 把一筆 response 正規化成 engine_results 形狀（含舊資料相容）。
//   有 engine_results JSONB → 直接用。
//   舊資料（engine_results 為 null）→ 用主欄合成 claude-only（mentioned 取 brand_mentioned、position 取 mentions 表）。
// 回傳 { claude: { mentioned, position, cost_usd, raw }, gemini?: {...}, ... }
function normEngineResults(r, mentionByRespId) {
  if (r.engine_results && typeof r.engine_results === 'object' && Object.keys(r.engine_results).length > 0) {
    return r.engine_results
  }
  return {
    claude: {
      mentioned: !!r.brand_mentioned,
      position: mentionByRespId?.[r.id]?.position ?? null,
      cost_usd: r.cost_usd ?? null,
      raw: r.raw_response ?? null,
    },
  }
}

// 月查詢額度（與 Pricing.jsx aivisIncludedPerMonth=150 / Top-up hard cap 1000 同步）
// - AIVIS_QUOTA_PER_MONTH：Pro 訂閱每月內含 150 次（每月 1 號歸零）
// - AIVIS_HARD_CAP：內含 + Top-up 合計每月硬上限 1,000 次（避免毛利血崩）
// - AIVIS_WARN_RATIO：用量達 80%（120 次）時提示加購，避免用滿才驚慌
const AIVIS_QUOTA_PER_MONTH = 150
const AIVIS_HARD_CAP = 1000
const AIVIS_WARN_RATIO = 0.8

// Top-up 包規格 — 必須與後端 api/aivis/checkout-topup-newebpay.js PACK_SPEC 一致
// 2026-06-13 改價：三引擎即時搜尋版掃描成本 ~NT$5/次，舊量（300/800）會虧本。大包單價對齊 Pro 隱含單價 NT$9.9。
const TOPUP_PACKS = [
  { id: 'small', label: '小包', price: 490, quota: 40, perCall: 12.25, hint: '補檔用，月底用量緊張時補一包' },
  { id: 'large', label: '大包', price: 990, quota: 100, perCall: 9.9, hint: '多品牌或競品矩陣，每次最划算' },
]

// =====================================================
// 工具函式
// =====================================================

// useCountUp：數字從 0 動畫到 target（給 KPI 卡用）
function useCountUp(target, duration = 1500, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf
    const t = setTimeout(() => {
      let start = null
      const step = ts => {
        if (!start) start = ts
        const p = Math.min((ts - start) / duration, 1)
        setVal(Math.round((1 - Math.pow(1 - p, 3)) * target))
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [target, duration, delay])
  return val
}

// 把品牌名 highlight 成青綠色（用於最近結果的 snippet）
function highlightBrandAuto(text, brand) {
  if (!brand || !text) return text
  const re = new RegExp(`(${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) => {
    if (p.toLowerCase() === brand.toLowerCase()) {
      return (
        <mark key={i} style={{
          background: AIVIS_TEAL + '32', color: AIVIS_TEAL,
          padding: '1px 5px', borderRadius: 4, fontWeight: 700,
          textShadow: `0 0 14px ${AIVIS_TEAL}88`,
        }}>{p}</mark>
      )
    }
    return <Fragment key={i}>{p}</Fragment>
  })
}

// 相對時間（剛剛 / X 分鐘前 / X 小時前 / X 天前）
function relativeTime(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '剛剛'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd} ${hh}:${mm}`
}

// 把 ISO date string 取「日期部分」（YYYY-MM-DD），用來 group by day
function dayKey(iso) {
  return iso.slice(0, 10)
}

// =====================================================
// Page Wrapper：青綠漸層 + 全域 keyframes（v2 用到 shimmer / pulse / fadeUp / spin）
// =====================================================
const PAGE_KEYFRAMES = `
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(.92)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
`

// =====================================================
// 主頁面元件
// =====================================================
export default function AIVisibilityDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // 資料 state
  const [brand, setBrand] = useState(null)
  const [allBrands, setAllBrands] = useState([])
  const [prompts, setPrompts] = useState([])
  const [responses, setResponses] = useState([]) // 30 天內所有 responses
  const [mentions, setMentions] = useState([])   // 30 天內所有 mentions
  const [pageState, setPageState] = useState('loading') // loading | normal | empty | error
  const [errorMsg, setErrorMsg] = useState('')

  // UI state
  const [brandOpen, setBrandOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanPhase, setScanPhase] = useState(0) // 0..N
  const [scanTotal, setScanTotal] = useState(0)
  const [toast, setToast] = useState(null)
  const [expandedPrompt, setExpandedPrompt] = useState(null)
  const [expandedRun, setExpandedRun] = useState({})
  const [trendError, setTrendError] = useState(false)
  const [activeHistoryDay, setActiveHistoryDay] = useState(null) // YYYY-MM-DD

  // 月查詢額度（user-scope：跨所有品牌的本月查詢總數）
  // 注意：與 responses state（brand-scope 30 天）不同 — 額度是 per-user per-calendar-month
  const [userMonthQueries, setUserMonthQueries] = useState(0)
  // Top-up modal：null | 'soft'（達月內含上限）| 'hard'（達 1000 硬上限）
  const [showTopupModal, setShowTopupModal] = useState(null)

  // ---------- 資料載入 ----------
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { state: { from: `/ai-visibility/${id}` } })
      return
    }
    loadAll()
  }, [id, user, authLoading])

  async function loadAll() {
    setPageState('loading')
    setErrorMsg('')
    try {
      // 1. 抓當前品牌
      const { data: bRow, error: bErr } = await supabase
        .from('aivis_brands').select('*').eq('id', id).maybeSingle()
      if (bErr) throw bErr
      if (!bRow) { setPageState('error'); setErrorMsg('找不到這個品牌'); return }

      // 2. 抓所有品牌（給 BrandSwitcher 用）
      const { data: brandsList } = await supabase
        .from('aivis_brands').select('id, name, industry').order('created_at')

      // 3. 抓 prompts（含停用的，要算 active 數）
      const { data: pRows } = await supabase
        .from('aivis_prompts').select('*')
        .eq('brand_id', id).order('created_at')

      // 4. 抓 30 天內的 responses + mentions（brand-scope）+ 本月 user-scope 查詢計數（額度判斷用）
      const since = new Date(Date.now() - 30 * 86400_000).toISOString()
      // 2026-06-10：月初用 UTC 算、對齊後端 fetch.js（setUTCDate(1)+setUTCHours(0)）。
      // 之前用本地時間建月初、台灣 UTC+8 會差 8 小時、每月交界顯示用量與後端權威數字短暫不一致。
      const _ms = new Date(); _ms.setUTCDate(1); _ms.setUTCHours(0, 0, 0, 0)
      const monthStartIso = _ms.toISOString()
      const [respRes, mentRes, userMonthRes] = await Promise.all([
        // 2026-06-10 路線 B：抓 engine_results JSONB、算各引擎（Claude / Gemini / …）提及率
        supabase.from('aivis_responses')
          .select('id, prompt_id, run_index, raw_response, brand_mentioned, cost_usd, created_at, engine_results')
          .eq('brand_id', id).gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('aivis_mentions')
          .select('response_id, position, context, created_at')
          .eq('brand_id', id).gte('created_at', since),
        // user-scope 本月查詢數（跨所有品牌，head: true 只回 count 不抓資料省流量）
        supabase.from('aivis_responses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('created_at', monthStartIso),
      ])

      setBrand(bRow)
      setAllBrands(brandsList || [])
      setPrompts(pRows || [])
      setResponses(respRes.data || [])
      setMentions(mentRes.data || [])
      setUserMonthQueries(userMonthRes.count || 0)

      // 預設展開最新 prompt
      const firstActive = (pRows || []).find(p => p.is_active)
      if (firstActive) setExpandedPrompt(firstActive.id)

      setPageState((respRes.data || []).length === 0 ? 'empty' : 'normal')
    } catch (err) {
      console.error('aivis dashboard load error:', err)
      setPageState('error')
      setErrorMsg(err.message || '資料載入失敗')
    }
  }

  // ---------- 衍生資料（聚合）----------
  const activePrompts = useMemo(() => prompts.filter(p => p.is_active), [prompts])
  const activeCount = activePrompts.length
  const atCap = activeCount >= PROMPT_CAP

  // 測試帳號（email 在 VITE_TEST_EMAILS 名單）→ 前端跳過額度攔截，與後端 TEST_EMAILS 對齊。
  // 後端 fetch.js 已對測試帳號放行（hardCap=Infinity），這裡同步讓前端不要先擋下來。
  const isTestAccount = useMemo(() => {
    const list = (import.meta.env.VITE_TEST_EMAILS || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    return !!user?.email && list.includes(user.email.toLowerCase())
  }, [user])

  // ---------- 月查詢額度狀態 ----------
  // 給 banner / modal / runScan 攔截用，全部以 user-scope 計算（跨所有品牌）
  const remainingMonthly = Math.max(0, AIVIS_QUOTA_PER_MONTH - userMonthQueries)     // 還剩幾次內含
  const remainingHard = Math.max(0, AIVIS_HARD_CAP - userMonthQueries)               // 距硬上限剩幾次
  const atWarn = userMonthQueries >= AIVIS_QUOTA_PER_MONTH * AIVIS_WARN_RATIO        // ≥120 顯示 banner
  const atSoftLimit = userMonthQueries >= AIVIS_QUOTA_PER_MONTH                      // ≥150 月內含已用完
  const atHardCap = userMonthQueries >= AIVIS_HARD_CAP                               // ≥1000 完全擋住
  const plannedRuns = activeCount * SCAN_RUNS                                        // 本次掃描預計花幾次
  const wouldExceedHard = userMonthQueries + plannedRuns > AIVIS_HARD_CAP            // 掃下去會破 1000

  // mentions 表 by response_id（給舊資料合成 position + 給 byPrompt 用）
  const mentionByRespId = useMemo(() => {
    const m = {}
    for (const x of mentions) { if (!(x.response_id in m)) m[x.response_id] = x }
    return m
  }, [mentions])

  // 30 天內 mention rate 概況。主指標改為「接地引擎 Gemini」（最貼近用戶真實看到的）；
  // 實際統計在下方 monthStart 之後的 primary 區塊。totalRuns = 全部 response 列數（= 掃描次數）。
  const totalRuns = responses.length

  // 2026-06-10 路線 B：動態 per-engine 聚合 — 自動列出所有出現過的引擎（claude / gemini / 未來更多）
  //   每個引擎只在「有跑過該引擎」的筆數內算提及率（分母 = 該引擎實際有結果的次數）
  const perEngine = useMemo(() => {
    const acc = {} // { engine: { total, mentioned } }
    for (const r of responses) {
      const er = normEngineResults(r, mentionByRespId)
      for (const [key, val] of Object.entries(er)) {
        if (!val) continue
        if (!acc[key]) acc[key] = { total: 0, mentioned: 0 }
        acc[key].total += 1
        if (val.mentioned) acc[key].mentioned += 1
      }
    }
    // 算 rate + 排序（claude 優先、其餘按出現順序）
    const order = ['claude', 'gemini', 'chatgpt', 'perplexity', 'grok']
    return Object.entries(acc)
      .map(([key, v]) => ({ key, ...v, rate: v.total > 0 ? Math.round(v.mentioned / v.total * 100) : 0 }))
      .sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99))
  }, [responses, mentionByRespId])

  // 是否多引擎（>1 個引擎有資料）→ 決定要不要顯示分引擎對照
  const multiEngine = perEngine.length > 1

  // 平均出現位置改用主引擎（見下方 primary 區塊）

  // 累積掃描次數（responses 行數）
  const scanCount = totalRuns

  // 本月起始（UTC 月初、對齊後端）
  const _monthStart = new Date(); _monthStart.setUTCDate(1); _monthStart.setUTCHours(0, 0, 0, 0)
  const monthStart = _monthStart.toISOString()

  // ── 主要訊號 = 接地引擎 Gemini（最貼近用戶真實看到的）；無 Gemini 資料時 fallback Claude ──
  // headline 三卡（曝光率 / 平均位置 / 本月提及）都改用主引擎；分母 = 該引擎實際有跑過的筆數。
  const primaryKey = responses.some(r => r.engine_results?.gemini) ? 'gemini' : 'claude'
  const primaryLabel = primaryKey === 'gemini' ? 'Gemini' : 'Claude'
  let _pTotal = 0, _pMent = 0, _pMonth = 0, _pPosSum = 0, _pPosN = 0
  for (const r of responses) {
    const v = normEngineResults(r, mentionByRespId)[primaryKey]
    if (!v) continue
    _pTotal += 1
    if (v.mentioned) {
      _pMent += 1
      if (r.created_at >= monthStart) _pMonth += 1
      if (v.position != null) { _pPosSum += v.position; _pPosN += 1 }
    }
  }
  const exposureRate = _pTotal > 0 ? Math.round(_pMent / _pTotal * 100) : 0
  const avgPos = _pPosN > 0 ? Math.round(_pPosSum / _pPosN) : 0
  const monthMentions = _pMonth

  // 30 天趨勢資料（每日 mention rate）
  const trendData = useMemo(() => {
    const byDay = {} // { 'YYYY-MM-DD': { total, mentioned } }
    for (const r of responses) {
      const k = dayKey(r.created_at)
      if (!byDay[k]) byDay[k] = { total: 0, mentioned: 0 }
      byDay[k].total += 1
      if (r.brand_mentioned) byDay[k].mentioned += 1
    }
    const days = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const k = d.toISOString().slice(0, 10)
      const stat = byDay[k] || { total: 0, mentioned: 0 }
      const val = stat.total > 0 ? Math.round(stat.mentioned / stat.total * 100) : 0
      days.push({ day: d.getDate(), month: d.getMonth() + 1, val, total: stat.total })
    }
    return days
  }, [responses])

  // 有掃描資料的「天數」（不是次數）。<3 天畫不出有意義的趨勢 → 用共用 HeartbeatTrend 心跳脈動圖勾住新客戶。
  const daysWithData = useMemo(() => trendData.filter(d => d.total > 0).length, [trendData])

  // 歷史掃描日期 chips（distinct days，最近 7 天）
  const historyDays = useMemo(() => {
    const map = {} // { 'YYYY-MM-DD': { count, latest } }
    for (const r of responses) {
      const k = dayKey(r.created_at)
      if (!map[k]) map[k] = { count: 0, latest: r.created_at, runs: SCAN_RUNS }
      map[k].count += 1
      if (r.created_at > map[k].latest) map[k].latest = r.created_at
    }
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7)
      .map(([k, v]) => ({
        id: k, day: k, label: k.slice(5).replace('-', '/') + ' ' + new Date(v.latest).toTimeString().slice(0, 5),
        ts: new Date(v.latest), activeCount: Math.ceil(v.count / SCAN_RUNS), runs: SCAN_RUNS, totalRuns: v.count,
      }))
  }, [responses])

  // 預設選擇最新一天的 history chip
  useEffect(() => {
    if (historyDays.length > 0 && !activeHistoryDay) {
      setActiveHistoryDay(historyDays[0].id)
    }
  }, [historyDays, activeHistoryDay])

  // 當前選中的歷史日期的「最近結果」(group by prompt)
  // 2026-06-11：只顯示「該日最新一次掃描」、不再把同一天多次掃描混在一起。
  //   原本同一天掃 8 次 = 24 筆全列出、最新的 Gemini 資料被埋在舊資料裡看不到。
  //   做法：取該日最大 created_at、只留下其前 5 分鐘內的筆（= 同一批掃描）。
  const recentResults = useMemo(() => {
    if (!activeHistoryDay || responses.length === 0) return []
    const dayResponses = responses.filter(r => dayKey(r.created_at) === activeHistoryDay)
    if (dayResponses.length === 0) return []
    // 找該日最新時間、只留 5 分鐘窗口內的（一次掃描約 40 秒、5 分鐘窗口很安全）
    const latestTs = Math.max(...dayResponses.map(r => new Date(r.created_at).getTime()))
    const WINDOW_MS = 5 * 60 * 1000
    const latestScan = dayResponses.filter(r => latestTs - new Date(r.created_at).getTime() <= WINDOW_MS)

    const byPrompt = {} // { prompt_id: { promptText, runs[] } }
    for (const r of latestScan) {
      const p = prompts.find(x => x.id === r.prompt_id)
      if (!p) continue
      if (!byPrompt[r.prompt_id]) {
        byPrompt[r.prompt_id] = { promptId: r.prompt_id, promptText: p.text, runs: [] }
      }
      const m = mentions.find(x => x.response_id === r.id)
      byPrompt[r.prompt_id].runs.push({
        run_index: r.run_index,
        mentioned: r.brand_mentioned,           // Claude 主（向下相容）
        position: m?.position ?? null,
        snippet: r.raw_response,                // Claude 原文（向下相容）
        engines: normEngineResults(r, mentionByRespId),  // 2026-06-10：per-engine 明細
      })
    }
    return Object.values(byPrompt).map(o => ({
      ...o,
      runs: o.runs.sort((a, b) => a.run_index - b.run_index),
    }))
  }, [activeHistoryDay, responses, mentions, prompts, mentionByRespId])

  // 引用來源彙整（主打）：把「最近一次掃描」所有引擎的接地來源去重 + 計數（被幾題 prompt 引用）。
  // 目前只有 Gemini 有 sources；之後 Claude 接地後自動一起算。
  const citedSources = useMemo(() => {
    const map = {} // uri -> { uri, title, count }
    for (const r of recentResults) {
      for (const run of r.runs) {
        for (const eng of Object.values(run.engines || {})) {
          for (const s of (eng?.sources || [])) {
            if (!s?.uri) continue
            if (!map[s.uri]) map[s.uri] = { uri: s.uri, title: s.title || s.uri, count: 0 }
            map[s.uri].count += 1
          }
        }
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [recentResults])

  // 近 7 天提及率「區間」（顯示範圍而非單一數字，把日常波動框成預期內、不讓客戶誤會成不準）
  const recentRange = useMemo(() => {
    const recent = trendData.slice(-7).filter(d => d.total > 0).map(d => d.val)
    if (recent.length < 2) return null
    const min = Math.min(...recent), max = Math.max(...recent)
    return min === max ? null : { min, max }
  }, [trendData])

  // ---------- 操作：Prompt CRUD ----------
  async function togglePrompt(p) {
    // 啟用前先檢查上限
    if (!p.is_active && atCap) {
      setToast({ kind: 'warn', msg: `已達啟用上限（${PROMPT_CAP} 條），請先停用其他 prompts` })
      setTimeout(() => setToast(null), 2800)
      return
    }
    const next = !p.is_active
    setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: next } : x))
    const { error } = await supabase.from('aivis_prompts')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) {
      setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !next } : x))
      setToast({ kind: 'warn', msg: `切換失敗：${error.message}` })
      setTimeout(() => setToast(null), 2800)
    }
  }

  function startEdit(p) { setEditingId(p.id); setEditText(p.text) }

  async function saveEdit() {
    if (!editingId || !editText.trim()) { setEditingId(null); return }
    const text = editText.trim()
    setPrompts(prev => prev.map(x => x.id === editingId ? { ...x, text, generated_by: 'user' } : x))
    setEditingId(null)
    const { error } = await supabase.from('aivis_prompts')
      .update({ text, generated_by: 'user', updated_at: new Date().toISOString() })
      .eq('id', editingId)
    if (error) {
      setToast({ kind: 'warn', msg: `儲存失敗：${error.message}` })
      setTimeout(() => setToast(null), 2800)
      loadAll() // rollback：重抓
    }
  }

  async function addPrompt() {
    if (atCap) return
    const { data, error } = await supabase.from('aivis_prompts').insert({
      user_id: user.id, brand_id: id, text: '（請輸入 prompt）',
      generated_by: 'user', is_active: true,
    }).select().single()
    if (error) {
      setToast({ kind: 'warn', msg: `新增失敗：${error.message}` })
      setTimeout(() => setToast(null), 2800)
      return
    }
    setPrompts(prev => [...prev, data])
    setEditingId(data.id); setEditText('')
  }

  async function regeneratePrompts() {
    setToast({ kind: 'ai', msg: '✨ Claude 正在分析品牌、重新產生 5 條 prompt…' })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('請先登入')
      const r = await fetch(`/api/aivis/generate-prompts?brand_id=${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await r.json()
      if (!r.ok || !json.success) throw new Error(json.error || json.detail || '產生失敗')
      setToast({ kind: 'success', msg: `✅ 已重新產生 ${json.generated_count} 條 prompt` })
      setTimeout(() => setToast(null), 3500)
      loadAll()
    } catch (err) {
      setToast({ kind: 'warn', msg: `產生失敗：${err.message}` })
      setTimeout(() => setToast(null), 4000)
    }
  }

  async function runScan() {
    if (activePrompts.length === 0) {
      setToast({ kind: 'warn', msg: '請先啟用至少一條 prompt' })
      setTimeout(() => setToast(null), 2800)
      return
    }
    // 額度攔截：硬上限優先（連 Top-up 都救不了）→ 月內含上限（可加購）
    // 測試帳號（VITE_TEST_EMAILS）豁免，後端也已放行
    if (!isTestAccount && (atHardCap || wouldExceedHard)) {
      setShowTopupModal('hard')
      return
    }
    if (!isTestAccount && atSoftLimit) {
      setShowTopupModal('soft')
      return
    }
    setScanning(true); setScanPhase(0); setScanTotal(activePrompts.length)
    let totalMentioned = 0, totalRunsCount = 0, totalTopupConsumed = 0
    // 2026-06-10：累計 Gemini 分項、掃描完 toast 直接顯示雙引擎結果
    let geminiMentioned = 0, geminiRunsCount = 0, geminiActive = false
    let geminiStatus = null  // 後端診斷：key_present / attempts / ok / last_error
    try {
      for (let i = 0; i < activePrompts.length; i++) {
        const p = activePrompts[i]
        setScanPhase(i + 1)
        const r = await fetch(`/api/aivis/fetch?prompt_id=${p.id}&runs=${SCAN_RUNS}`, { method: 'POST' })
        const json = await r.json()
        if (!r.ok || !json.success) {
          throw new Error(json.error || json.detail || '掃描失敗')
        }
        totalMentioned += json.mentioned_count
        totalRunsCount += json.runs
        if (json.gemini_status) geminiStatus = json.gemini_status  // 後端 Gemini 診斷（取最後一條）
        // Gemini 分項 — 累計成功次數；geminiActive 改成「真的有成功」才算（修：by_engine.gemini
        // 在全失敗時也存在、會誤判成功顯示 0%、把真正的失敗錯誤吞掉）
        if (json.by_engine?.gemini) {
          geminiMentioned += json.by_engine.gemini.mentioned_count || 0
          geminiRunsCount += json.by_engine.gemini.success_runs || 0
        }
        // 即時用 fetch.js 回傳的 quota meta 更新 banner — 不等 loadAll() 完成才 refresh
        // 好處：跑多條 prompt 時 banner / 進度條會逐條前進，視覺即時感更強
        if (json.quota?.used_after !== undefined) {
          setUserMonthQueries(json.quota.used_after)
        }
        totalTopupConsumed += json.quota?.topup_consumed_this_call || 0
      }
      const rate = totalRunsCount > 0 ? Math.round(totalMentioned / totalRunsCount * 100) : 0
      const geminiRate = geminiRunsCount > 0 ? Math.round(geminiMentioned / geminiRunsCount * 100) : 0
      geminiActive = geminiRunsCount > 0  // 真的有成功才算雙引擎、全失敗走診斷分支
      setScanning(false)
      const topupNote = totalTopupConsumed > 0 ? `（含 ${totalTopupConsumed} 次 Top-up）` : ''
      // 有成功跑 Gemini → 顯示雙引擎對照；否則顯示 Claude + 診斷原因（為什麼 Gemini 沒成功）
      let engineNote, toastKind = 'success'
      if (geminiActive) {
        engineNote = `Claude 提及率 ${rate}% · Gemini 提及率 ${geminiRate}%`
      } else {
        // Gemini 沒成功 — 用後端診斷說明原因
        let reason = ''
        if (geminiStatus && !geminiStatus.key_present) {
          reason = '（⚠️ Gemini 未啟用：後端讀不到 GEMINI_API_KEY）'
          toastKind = 'warn'
        } else if (geminiStatus && geminiStatus.quota_exhausted) {
          reason = '（⚠️ Gemini 配額用完：今日免費額度已用盡，明日 0 點（太平洋時間）重置，或開通 Google billing 解除）'
          toastKind = 'warn'
        } else if (geminiStatus && geminiStatus.last_error) {
          reason = `（⚠️ Gemini 呼叫失敗：${String(geminiStatus.last_error).slice(0, 120)}）`
          toastKind = 'warn'
        } else if (geminiStatus && geminiStatus.key_present && geminiStatus.ok === 0) {
          reason = '（⚠️ Gemini 全部失敗、無錯誤訊息、請查 Network）'
          toastKind = 'warn'
        }
        engineNote = `平均提及率 ${rate}%${reason}`
      }
      setToast({
        kind: toastKind,
        msg: `✅ 掃描完成 — ${activePrompts.length} prompt × ${SCAN_RUNS} 次 = ${totalRunsCount} 次呼叫${topupNote}，${engineNote}`,
      })
      setTimeout(() => setToast(null), 7000)
      loadAll()
    } catch (err) {
      setScanning(false)
      setToast({ kind: 'warn', msg: `掃描失敗：${err.message}` })
      setTimeout(() => setToast(null), 4500)
      // 失敗仍 reload 一次：可能跑了一半才炸（前 N 條成功寫進 DB），banner 數字要對齊
      loadAll()
    }
  }

  function toggleRunExpand(promptId, runIdx) {
    const k = `${promptId}-${runIdx}`
    setExpandedRun(r => ({ ...r, [k]: !r[k] }))
  }

  // ---------- 渲染：錯誤狀態 ----------
  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-white mb-2">{errorMsg || '載入失敗'}</h2>
          <p className="text-white/60 text-sm mb-6">可能已被刪除，或你沒有權限檢視。</p>
          <Link to="/ai-visibility"
            className="inline-block px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors">
            返回品牌列表
          </Link>
        </div>
      </div>
    )
  }

  const isLoading = pageState === 'loading'
  const isEmpty = pageState === 'empty'

  return (
    <>
      <style>{PAGE_KEYFRAMES}</style>

      {/* 青綠漸層背景：覆蓋在原 HomeDark 紅色背景之上，僅作用於 aivis 頁面 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: `linear-gradient(155deg, ${AIVIS_TEAL} 0%, ${AIVIS_TEAL_DEEP} 18%, #084773 32%, #011520 52%, #000000 72%)`,
      }} />

      {/* 公告改成 SiteHeader 右上角鈴鐺、本頁不再放卡片（2026-06-06） */}

      {/* 返回連結 */}
      <header style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 0' }}>
        <Link to="/ai-visibility" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 14, color: T.textMid, textDecoration: 'none', fontFamily: T.font,
        }}>
          ← 返回品牌列表
        </Link>
      </header>

      <div className="page-wrap" style={{
        maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font,
      }}>

        {/* ── Header + Brand Switcher ─────────────────────── */}
        <div style={{
          marginBottom: 28, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 18, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                fontSize: 14, fontWeight: 700, letterSpacing: '.12em',
                color: AIVIS_TEAL, textTransform: 'uppercase',
              }}>aivis · phase 2</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: T.textLow }}></span>
              <span style={{ fontSize: 14, color: T.textLow }}>每日定時 02:00 自動掃描</span>
            </div>
            <h1 style={{
              fontSize: 34, fontWeight: 800, color: T.text, letterSpacing: '-.02em',
              marginBottom: 8, lineHeight: 1.15,
            }}>AI 曝光監測</h1>
            <p style={{ fontSize: 15, color: T.textMid, lineHeight: 1.7, maxWidth: 680 }}>
              當有人問 AI「我這個產業有哪些值得推薦的公司？」<strong style={{ color: T.text }}>{brand?.name || '…'}</strong> 會不會被提到、排第幾個 — 這個模組會用一組中性的產業 prompt，定期問 Claude + Gemini，幫你追蹤答案。
            </p>
          </div>

          {brand && allBrands.length > 0 && (
            <BrandSwitcher
              brands={allBrands}
              activeId={brand.id}
              open={brandOpen}
              setOpen={setBrandOpen}
              onSelect={bid => { setBrandOpen(false); navigate(`/ai-visibility/${bid}`) }}
              onAddNew={() => navigate('/ai-visibility')}
            />
          )}
        </div>

        {/* ── 區塊 1：概況卡 ────────────────────────────── */}
        <div className="four-col" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 32,
        }}>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <OverviewSkeleton key={i} />)
          ) : isEmpty ? (
            ['品牌曝光率', '平均出現位置', '已掃描次數', '本月新增提及'].map((label, i) => (
              <OverviewEmpty key={i} label={label} />
            ))
          ) : (
            <>
              {/* 2026-06-11：主數字改用主引擎（接地 Gemini，最貼近真實）；多引擎時 sub 標出（主）+ 列各引擎 */}
              <OverviewCard icon="📊" label="品牌曝光率" value={exposureRate} suffix="%"
                sub={recentRange
                  ? `近 7 天 ${recentRange.min}–${recentRange.max}%・主要看 ${primaryLabel}（即時上網）`
                  : (multiEngine
                    ? perEngine.map(e => `${engineLabel(e.key)}${e.key === primaryKey ? '（主）' : ''} ${e.rate}%`).join(' · ')
                    : `主要引擎 ${primaryLabel}・即時上網的答案`)}
                color={AIVIS_TEAL} highlight />
              <OverviewCard icon="🥇" label="平均出現位置" value={avgPos > 0 ? avgPos : '—'}
                prefix={avgPos > 0 ? '第 ' : ''} suffix={avgPos > 0 ? ' 名' : ''}
                sub={`${primaryLabel} 提到你時通常的排名`} color={AIVIS_TEAL} />
              <OverviewCard icon="🔄" label="已掃描次數" value={scanCount} suffix=" 次"
                sub={multiEngine ? `跨 ${perEngine.length} 個 AI 引擎監測` : '累積掃描次數'} color={T.textMid} />
              <OverviewCard icon="✨" label="本月新增提及" value={monthMentions} suffix=" 次"
                sub={`${primaryLabel} 在本月回答提到品牌的次數`} color={T.orange} />
            </>
          )}
        </div>

        {/* ── 趨勢線（主角）：全寬。AI 即時上網、答案天天在變 → 看趨勢不看單次數字 ── */}
        <div style={{ marginBottom: 18 }}>
          {isLoading ? <TrendSkeleton /> :
            trendError ? <ErrorCard title="30 天提及率趨勢" message="Supabase 連線逾時，無法載入歷史資料。"
              onRetry={() => { setTrendError(false); loadAll() }} /> :
              isEmpty ? <TrendGhostRadar onStart={runScan} scanning={scanning} disabled={activeCount === 0} /> :
                daysWithData < 3 ? (
                  <HeartbeatTrend
                    title="30 天提及率趨勢"
                    subtitle="AI 即時上網、答案天天在變 — 看趨勢，別看單次數字"
                    cardStyle={{ background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`, borderRadius: T.rL, marginBottom: 0 }}
                    action={
                      <button onClick={runScan} disabled={scanning}
                        style={{ border: '1px solid #FF9D2E66', borderRadius: 10, padding: '6px 14px', background: '#FF9D2E14', color: '#FFC24B', fontFamily: T.font, fontWeight: 700, fontSize: 13, cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.55 : 1, whiteSpace: 'nowrap' }}>
                        {scanning ? '⏳ 監測中' : '📡 再次掃描'}
                      </button>
                    }
                    footer={
                      <div style={{ fontSize: 13, color: T.textMid }}>
                        {daysWithData <= 1
                          ? <>已完成首次掃描 🎉 · 持續監測 <span style={{ color: '#FFC24B', fontWeight: 700 }}>3-5 天</span>，真實的提及率趨勢就會在這裡浮現</>
                          : <>已監測 <span style={{ color: '#FFC24B', fontWeight: 700 }}>{daysWithData}</span> 天 · 再過幾天，完整 30 天走勢就會浮現</>}
                      </div>
                    }
                  />
                ) :
                  <TrendChart data={trendData} />
          }
        </div>

        {/* ── Prompts 管理（全寬） ── */}
        <div style={{ marginBottom: 32 }}>
          {isLoading ? <PromptsSkeleton /> :
            prompts.length === 0 ? <PromptsEmpty onGenerate={regeneratePrompts} /> :
              <PromptsPanel
                prompts={prompts} editingId={editingId} editText={editText}
                setEditText={setEditText} onToggle={togglePrompt}
                onStartEdit={startEdit} onSave={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onAdd={addPrompt} onRegenerate={regeneratePrompts}
                activeCount={activeCount} atCap={atCap}
              />
          }
        </div>

        {/* ── 月內含額度提示 banner ─────────────────────────
            觸發條件：用量 ≥80%（120 次）才顯示，避免一進來就被「快用完」嚇到
            兩階段：
              - 80%~99%：黃色提醒 + 「了解加購」按鈕（軟性 upsell）
              - 100%+：紅色警示 + 「立即加購」按鈕（硬性 upsell，掃描已被 runScan 攔住）
        ── */}
        {!isLoading && atWarn && !isTestAccount && (
          <UsageBanner
            used={userMonthQueries}
            quota={AIVIS_QUOTA_PER_MONTH}
            remaining={remainingMonthly}
            atSoftLimit={atSoftLimit}
            atHardCap={atHardCap}
            hardCap={AIVIS_HARD_CAP}
            remainingHard={remainingHard}
            onTopupClick={() => setShowTopupModal(atHardCap ? 'hard' : 'soft')}
          />
        )}

        {/* ── 區塊 3：手動掃描 CTA ──────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18,
          background: `linear-gradient(135deg, ${AIVIS_TEAL}1c, ${AIVIS_TEAL_DEEP}10)`,
          border: `1px solid ${AIVIS_TEAL}3a`,
          borderRadius: T.rL, padding: '20px 26px', marginBottom: 32, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 280 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 14,
              background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: `0 6px 20px ${AIVIS_TEAL}55`,
            }}>
              <span style={{ fontSize: 26 }}>🔍</span>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                立即執行掃描
              </div>
              <div style={{ fontSize: 14, color: T.textMid }}>
                手動觸發 {activeCount} prompt：Claude 各問 {SCAN_RUNS} 次 + Gemini 各問 1 次（省免費額度）· 約耗時 {activeCount * 8} 秒
              </div>
            </div>
          </div>
          <button onClick={runScan} disabled={scanning || activeCount === 0}
            style={{
              fontSize: 14, padding: '12px 24px', whiteSpace: 'nowrap',
              border: 'none', borderRadius: 10, fontWeight: 700, fontFamily: T.font,
              background: 'linear-gradient(135deg,#f97316,#c2031c)', color: '#fff',
              boxShadow: '0 2px 16px rgba(249,115,22,.32)',
              cursor: (scanning || activeCount === 0) ? 'not-allowed' : 'pointer',
              opacity: (scanning || activeCount === 0) ? 0.5 : 1,
            }}>
            🚀 立即執行掃描
          </button>
        </div>

        {/* ── 區塊 4：最近掃描結果 ─────────────────────── */}
        {isLoading ? <RecentSkeleton /> :
          isEmpty || historyDays.length === 0 ? <RecentEmpty /> :
            <RecentResults
              results={recentResults}
              brandHighlight={brand?.name || ''}
              expandedPrompt={expandedPrompt}
              setExpandedPrompt={setExpandedPrompt}
              expandedRun={expandedRun}
              toggleRunExpand={toggleRunExpand}
              history={historyDays}
              activeHistoryId={activeHistoryDay}
              setActiveHistoryId={setActiveHistoryDay}
            />
        }

        {/* ── 引用來源（放最下面、預設只顯示 10 個、其餘展開才看） ── */}
        {!isLoading && !isEmpty && (
          <div style={{ marginTop: 18 }}>
            <CitedSourcesCard sources={citedSources} brandName={brand?.name || ''} />
          </div>
        )}

        {scanning && <ScanOverlay phase={scanPhase} total={scanTotal} prompts={activePrompts} />}
        {showTopupModal && (
          <TopupModal
            kind={showTopupModal}
            used={userMonthQueries}
            quota={AIVIS_QUOTA_PER_MONTH}
            hardCap={AIVIS_HARD_CAP}
            user={user}
            onClose={() => setShowTopupModal(null)}
          />
        )}
        {toast && <Toast {...toast} />}
      </div>
    </>
  )
}

// =====================================================
// BrandSwitcher（右上：切換監測中的品牌）
// =====================================================
function BrandSwitcher({ brands, activeId, open, setOpen, onSelect, onAddNew }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, setOpen])
  const active = brands.find(b => b.id === activeId) || brands[0]
  if (!active) return null
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.textLow, letterSpacing: '.14em',
        marginBottom: 6, textTransform: 'uppercase',
      }}>監測中的品牌</div>
      <button onClick={() => setOpen(!open)} style={{
        background: 'rgba(0,6,10,.7)',
        border: `1px solid ${open ? AIVIS_TEAL + '66' : 'rgba(255,255,255,.12)'}`,
        borderRadius: 10, padding: '10px 14px', minWidth: 240,
        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: T.font,
        boxShadow: open ? `0 0 0 3px ${AIVIS_TEAL}1f` : 'none', transition: 'all .2s',
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8,
          background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
          color: '#011520', fontSize: 14, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{active.name.slice(0, 1)}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{active.name}</div>
          <div style={{ fontSize: 14, color: T.textLow, marginTop: 2 }}>{active.industry || '未指定產業'}</div>
        </div>
        <svg width="11" height="11" viewBox="0 0 11 11" style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s',
        }}>
          <path d="M2 4L5.5 7L9 4" stroke={T.textMid} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 280,
          background: 'rgba(0,6,10,.96)', backdropFilter: 'blur(12px)',
          border: `1px solid ${AIVIS_TEAL}33`, borderRadius: 10,
          boxShadow: `0 12px 40px rgba(0,0,0,.6), 0 0 0 1px ${AIVIS_TEAL}1c`,
          padding: 6, zIndex: 50, animation: 'fadeUp .18s ease',
        }}>
          {brands.map(b => {
            const isActive = b.id === activeId
            return (
              <button key={b.id} onClick={() => onSelect(b.id)} style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? AIVIS_TEAL + '14' : 'transparent',
                border: isActive ? `1px solid ${AIVIS_TEAL}40` : '1px solid transparent',
                borderRadius: 7, padding: '10px 12px', cursor: 'pointer',
                color: T.text, fontFamily: T.font, marginBottom: 2,
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
                  color: '#011520', fontSize: 14, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{b.name.slice(0, 1)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{b.name}</div>
                  <div style={{ fontSize: 14, color: T.textLow, marginTop: 1 }}>{b.industry || '未指定產業'}</div>
                </div>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M2 6L5 9L10 3" stroke={AIVIS_TEAL} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
              </button>
            )
          })}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,.08)', marginTop: 4, paddingTop: 6 }}>
            <button onClick={onAddNew} style={{
              width: '100%', background: 'transparent', border: 'none',
              color: AIVIS_TEAL, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              padding: '8px', fontFamily: T.font,
            }}>＋ 新增品牌</button>
          </div>
        </div>
      )}
    </div>
  )
}

// =====================================================
// OverviewCard（KPI 卡）
// =====================================================
function OverviewCard({ icon, label, value, sub, color, prefix = '', suffix = '', highlight }) {
  return (
    <div style={{
      background: highlight
        ? `linear-gradient(155deg, ${AIVIS_TEAL}1c 0%, rgba(1,8,14,.65) 70%)`
        : 'rgba(1,8,14,.6)',
      border: highlight ? `1px solid ${AIVIS_TEAL}55` : `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: '18px 18px 16px', position: 'relative',
      boxShadow: highlight ? `0 8px 24px ${AIVIS_TEAL}18` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, color: T.textMid, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {prefix && <span style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>{prefix}</span>}
        <span style={{
          fontSize: 30, fontWeight: 800, color, letterSpacing: '-.02em',
          textShadow: highlight ? `0 0 24px ${color}55` : 'none', fontFamily: T.font,
        }}>{value}</span>
        {suffix && <span style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 14, color: T.textLow, marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </div>
  )
}

// =====================================================
// Skeletons（載入中骨架）
// =====================================================
const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.04) 100%)',
  backgroundSize: '400% 100%', animation: 'shimmer 1.6s linear infinite', borderRadius: 6,
}

function OverviewSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: '18px 18px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ ...shimmerStyle, width: 18, height: 18, borderRadius: 4 }} />
        <div style={{ ...shimmerStyle, width: 80, height: 11 }} />
      </div>
      <div style={{ ...shimmerStyle, width: '70%', height: 30, marginBottom: 10 }} />
      <div style={{ ...shimmerStyle, width: '90%', height: 11 }} />
    </div>
  )
}

function PromptsSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22,
    }}>
      <div style={{ ...shimmerStyle, width: 200, height: 15, marginBottom: 8 }} />
      <div style={{ ...shimmerStyle, width: 280, height: 11, marginBottom: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
            borderRadius: 8, padding: '12px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ ...shimmerStyle, width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...shimmerStyle, flex: 1, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', minHeight: 280,
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: AIVIS_TEAL,
            animation: `pulse 1.2s ease-in-out infinite ${i * .18}s`,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 14, color: T.textMid, fontWeight: 500 }}>載入中…</div>
      <div style={{ fontSize: 14, color: T.textLow, marginTop: 6 }}>正在從 Supabase 取回 30 天資料</div>
    </div>
  )
}

function RecentSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22,
    }}>
      <div style={{ ...shimmerStyle, width: 160, height: 15, marginBottom: 8 }} />
      <div style={{ ...shimmerStyle, width: 280, height: 11, marginBottom: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{
            border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ ...shimmerStyle, width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
            <div style={{ ...shimmerStyle, flex: 1, height: 13 }} />
            <div style={{ ...shimmerStyle, width: 60, height: 18, borderRadius: 5, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================
// Empty States（空狀態）
// =====================================================
function OverviewEmpty({ label }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.4)', border: '1px dashed rgba(255,255,255,.1)',
      borderRadius: T.rL, padding: '18px 18px 16px',
    }}>
      <div style={{ fontSize: 14, color: T.textLow, fontWeight: 500, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: T.textLow, letterSpacing: '-.02em', fontFamily: T.font, lineHeight: 1 }}>— —</div>
      <div style={{ fontSize: 14, color: T.textLow, marginTop: 8, lineHeight: 1.45 }}>
        需要先產生 prompt 並執行掃描
      </div>
    </div>
  )
}

function PromptsEmpty({ onGenerate }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px dashed ${AIVIS_TEAL}40`,
      borderRadius: T.rL, padding: 38,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', minHeight: 280, justifyContent: 'center',
    }}>
      <div style={{ fontSize: 38, marginBottom: 14 }}>✨</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>還沒有 prompt</div>
      <div style={{ fontSize: 14, color: T.textMid, marginBottom: 22, maxWidth: 340, lineHeight: 1.7 }}>
        Claude 會根據品牌的產業與定位，自動產生 5 條中性的 prompt 用來追蹤 AI 曝光。
      </div>
      <button onClick={onGenerate} style={{
        background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
        border: 'none', color: '#011520', fontWeight: 700, fontSize: 14,
        padding: '12px 22px', borderRadius: 9, cursor: 'pointer',
        boxShadow: `0 6px 18px ${AIVIS_TEAL}44`, fontFamily: T.font,
      }}>✨ 用 AI 自動產生 5 條 prompt</button>
    </div>
  )
}

function RecentEmpty() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: '1px dashed rgba(255,255,255,.1)',
      borderRadius: T.rL, padding: '40px 22px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 6 }}>還沒有掃描紀錄</div>
      <div style={{ fontSize: 14, color: T.textMid, marginBottom: 18 }}>
        建立 prompts 後，點擊上方「立即執行掃描」即可開始追蹤。
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
        color: AIVIS_TEAL, fontWeight: 600,
      }}>
        <span style={{ animation: 'pulse 1.4s infinite' }}>↑</span>
        指向「立即執行掃描」按鈕
      </div>
    </div>
  )
}

function ErrorCard({ title, message, onRetry }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.fail}66`,
      borderRadius: T.rL, padding: 22,
      boxShadow: `0 0 0 1px ${T.fail}22, 0 8px 24px ${T.fail}14`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: T.fail + '1f', border: `1px solid ${T.fail}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: T.fail, fontSize: 16, fontWeight: 700,
        }}>!</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
      </div>
      <div style={{
        background: T.fail + '10', border: `1px solid ${T.fail}30`, borderRadius: 8,
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.fail, marginBottom: 4 }}>載入失敗</div>
        <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.6 }}>{message}</div>
      </div>
      <button onClick={onRetry} style={{
        alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${T.fail}66`,
        color: T.fail, fontSize: 14, fontWeight: 600,
        padding: '8px 16px', borderRadius: 7, cursor: 'pointer', fontFamily: T.font,
      }}>↻ 重試</button>
    </div>
  )
}

// =====================================================
// PromptsPanel（CRUD + 上限提示）
// =====================================================
function PromptsPanel({
  prompts, editingId, editText, setEditText, onToggle, onStartEdit,
  onSave, onCancelEdit, onAdd, onRegenerate, activeCount, atCap,
}) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22, position: 'relative', minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 16, gap: 14, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 3 }}>
            Prompts 管理 <span style={{ fontSize: 14, color: T.textLow, fontWeight: 500 }}>
              · 啟用中 {activeCount}/{prompts.length}（上限 {PROMPT_CAP} 條）
            </span>
          </div>
          <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.6 }}>
            這些問題會送進 Claude（每條 {SCAN_RUNS} 次取平均）+ Gemini（每條 1 次、省免費額度）。
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button onClick={onRegenerate} style={{
            background: `linear-gradient(135deg, ${T.orange}, #b91c1c)`,
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 700,
            padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
            boxShadow: `0 4px 12px ${T.orange}55`, whiteSpace: 'nowrap', fontFamily: T.font,
          }}>✨ 重新產生 5 條</button>
          <span style={{
            fontSize: 14, color: T.textLow, lineHeight: 1.4, textAlign: 'right', maxWidth: 180,
          }}>會將原本 auto 產生的 prompts 設為停用</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {prompts.map((p, idx) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: editingId === p.id ? 'flex-start' : 'center', gap: 10,
            background: p.is_active ? 'rgba(13,122,88,.07)' : 'rgba(255,255,255,.02)',
            border: `1px solid ${p.is_active ? AIVIS_TEAL + '24' : 'rgba(255,255,255,.05)'}`,
            borderRadius: 8, padding: '10px 12px',
            opacity: p.is_active ? 1 : 0.55, transition: 'all .2s',
          }}>
            <button onClick={() => onToggle(p)} style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              marginTop: editingId === p.id ? 2 : 0,
              background: p.is_active ? AIVIS_TEAL : 'transparent',
              border: `1.5px solid ${p.is_active ? AIVIS_TEAL : 'rgba(255,255,255,.25)'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}>
              {p.is_active && <svg width="11" height="11" viewBox="0 0 11 11">
                <path d="M2 5.5L4.5 8L9 3" stroke="#011520" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>}
            </button>

            <span style={{
              fontSize: 14, fontWeight: 700, color: T.textLow, minWidth: 18,
              fontFamily: T.mono, marginTop: editingId === p.id ? 3 : 0,
            }}>{idx + 1}.</span>

            {editingId === p.id ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <textarea value={editText} onChange={e => setEditText(e.target.value)}
                  rows={2} autoFocus
                  placeholder="輸入產業 prompt（中性語氣、不直接點名你的品牌）"
                  style={{
                    width: '100%', background: 'rgba(0,6,10,.6)',
                    border: `1px solid ${AIVIS_TEAL}55`, borderRadius: 6, color: T.text,
                    padding: '8px 10px', fontSize: 14, fontFamily: T.font, resize: 'vertical',
                  }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={onSave} style={btnSm(AIVIS_TEAL)}>儲存</button>
                  <button onClick={onCancelEdit} style={btnSm('transparent', T.textMid)}>取消</button>
                </div>
              </div>
            ) : (
              <span style={{
                flex: 1, fontSize: 14, color: p.is_active ? T.text : T.textMid,
                lineHeight: 1.55, minWidth: 0, wordBreak: 'break-word',
              }}>
                {p.text}
                {p.generated_by === 'user' && <span style={{
                  fontSize: 14, fontWeight: 700, color: AIVIS_TEAL, letterSpacing: '.06em',
                  background: AIVIS_TEAL + '1c', padding: '1px 5px', borderRadius: 3,
                  marginLeft: 8, verticalAlign: 'middle',
                }}>USER</span>}
              </span>
            )}

            {editingId !== p.id && (
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button onClick={() => onStartEdit(p)} style={iconBtn()}>編輯</button>
                <button onClick={() => onToggle(p)} style={iconBtn()}>
                  {p.is_active ? '停用' : '啟用'}
                </button>
              </div>
            )}
          </div>
        ))}

        <AddPromptButton atCap={atCap} onAdd={onAdd} />
      </div>
    </div>
  )
}

function AddPromptButton({ atCap, onAdd }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <button onClick={atCap ? undefined : onAdd}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        disabled={atCap}
        style={{
          width: '100%', background: 'transparent',
          border: '1px dashed rgba(255,255,255,.2)',
          color: atCap ? T.textLow : T.textMid,
          padding: '10px 12px', borderRadius: 8,
          fontSize: 14, cursor: atCap ? 'not-allowed' : 'pointer',
          fontFamily: T.font, opacity: atCap ? 0.55 : 1,
        }}>
        ＋ 自己加一條 prompt {atCap && '（已達上限）'}
      </button>
      {atCap && hover && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,6,10,.96)', border: `1px solid ${T.fail}55`,
          color: T.text, fontSize: 14, fontWeight: 500,
          padding: '7px 11px', borderRadius: 6, whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,.5)', zIndex: 5, animation: 'fadeUp .18s ease',
        }}>
          已達上限，請先停用其他 prompts
        </div>
      )}
    </div>
  )
}

function btnSm(bg, color) {
  return {
    background: bg === 'transparent' ? 'transparent' : bg,
    border: `1px solid ${bg === 'transparent' ? 'rgba(255,255,255,.18)' : bg}`,
    color: color || (bg === 'transparent' ? T.textMid : '#011520'),
    fontSize: 14, fontWeight: 700, padding: '5px 12px', borderRadius: 5,
    cursor: 'pointer', fontFamily: T.font,
  }
}
function iconBtn() {
  return {
    background: 'transparent', border: '1px solid rgba(255,255,255,.1)',
    color: T.textMid, padding: '4px 9px', borderRadius: 5,
    fontSize: 14, cursor: 'pointer', fontFamily: T.font,
  }
}

// =====================================================
// TrendChart（30 天提及率折線圖 + hover tooltip）
// =====================================================
// 空狀態的趨勢區塊：雷達擴散 ghost + 中央「開始監測」按鈕（2026-06-18）
// 取代「空白扁平趨勢圖」——新用戶第一眼看到趨勢長什麼樣（標示意、脈動代表未啟動），按下才跑首掃。
// 雷達擴散用 SVG <animate>（r/opacity，不用 CSS scale——transform-origin 會跑位，見專案踩坑），與首頁雷達同語言、改用品牌青綠。
function TrendGhostRadar({ onStart, scanning, disabled }) {
  const W = 760, H = 200
  // 示意用的向上趨勢折線（dashed、低透明、整體緩慢脈動）
  const ghostPts = [[44, 150], [150, 142], [256, 120], [362, 126], [468, 96], [574, 82], [680, 56], [716, 48]]
  const ghostPath = ghostPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22, position: 'relative', minWidth: 0, overflow: 'hidden',
    }}>
      <style>{`@keyframes aivisGhostPulse{0%,100%{box-shadow:0 0 0 0 ${AIVIS_TEAL}66,0 6px 22px ${AIVIS_TEAL}44}50%{box-shadow:0 0 0 14px ${AIVIS_TEAL}00,0 6px 32px ${AIVIS_TEAL}88}}@keyframes aivisGhostLine{0%,100%{opacity:.16}50%{opacity:.42}}`}</style>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 3 }}>30 天提及率趨勢</div>
        <div style={{ fontSize: 14, color: T.textLow }}>AI 即時上網、答案天天在變 — 看趨勢，別看單次數字</div>
      </div>

      <div style={{ position: 'relative', height: 232, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* 背景 ghost 趨勢線（示意、整體脈動） */}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
          animation: 'aivisGhostLine 3.2s ease-in-out infinite',
        }}>
          <path d={ghostPath} fill="none" stroke={AIVIS_TEAL} strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
          {ghostPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={AIVIS_TEAL} opacity="0.55" />)}
        </svg>

        {/* 雷達擴散 + 中央按鈕 */}
        <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <svg viewBox="0 0 220 220" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <circle cx="110" cy="110" r="100" fill="none" stroke={`${AIVIS_TEAL}22`} strokeWidth="1" />
            <circle cx="110" cy="110" r="66" fill="none" stroke={`${AIVIS_TEAL}2e`} strokeWidth="1" />
            <circle cx="110" cy="110" r="34" fill="none" stroke={`${AIVIS_TEAL}3a`} strokeWidth="1" />
            {[0, 0.8, 1.6].map((delay, i) => (
              <circle key={i} cx="110" cy="110" fill="none" stroke={AIVIS_TEAL} strokeWidth="1.5">
                <animate attributeName="r" from="30" to="105" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.7" to="0" dur="2.4s" begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </svg>
          <button onClick={onStart} disabled={scanning || disabled}
            style={{
              position: 'relative', zIndex: 3, border: 'none', borderRadius: '50%', width: 120, height: 120,
              background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
              color: '#021b14', fontFamily: T.font, fontWeight: 900, fontSize: 17,
              cursor: (scanning || disabled) ? 'not-allowed' : 'pointer',
              opacity: (scanning || disabled) ? 0.55 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              animation: (scanning || disabled) ? 'none' : 'aivisGhostPulse 2.2s ease-in-out infinite',
            }}>
            <span style={{ fontSize: 26 }}>{scanning ? '⏳' : '📡'}</span>
            <span>{scanning ? '監測中' : '開始監測'}</span>
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 13, color: T.textMid, marginTop: 4 }}>
        {disabled
          ? '先在下方產生並啟用 prompt，再開始監測'
          : '按下開始第一次掃描 ChatGPT、Claude、Gemini —— 趨勢會隨每次掃描逐日累積'}
      </div>
    </div>
  )
}

function TrendChart({ data }) {
  // 全寬呈現：用寬扁 viewBox（760×200，~3.8:1），避免 SVG 依寬度等比放大導致高度過高、軸標籤過大
  const W = 760, H = 200, padL = 44, padR = 16, padT = 22, padB = 30
  const innerW = W - padL - padR, innerH = H - padT - padB
  const maxY = 100, minY = 0
  const xStep = innerW / Math.max(1, data.length - 1)
  const yScale = v => padT + innerH - ((v - minY) / (maxY - minY)) * innerH

  const points = data.map((d, i) => [padL + i * xStep, yScale(d.val)])
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = points.length > 0
    ? `${path} L${points[points.length - 1][0]},${padT + innerH} L${padL},${padT + innerH} Z`
    : ''
  const yTicks = [0, 50, 100]

  const last = data[data.length - 1] || { val: 0 }
  const first = data[0] || { val: 0 }
  const delta = last.val - first.val

  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  function onMove(e) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xPx = ((e.clientX - rect.left) / rect.width) * W
    if (xPx < padL || xPx > W - padR) { setHoverIdx(null); return }
    const idx = Math.round((xPx - padL) / xStep)
    setHoverIdx(Math.max(0, Math.min(data.length - 1, idx)))
  }

  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22, display: 'flex', flexDirection: 'column',
      position: 'relative', minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 14, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 3 }}>30 天提及率趨勢</div>
          <div style={{ fontSize: 14, color: T.textLow }}>AI 即時上網、答案天天在變 — 看趨勢，別看單次數字</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, color: T.textMid }}>近 30 日</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: delta >= 0 ? AIVIS_TEAL : T.fail }}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% {delta >= 0 ? '成長' : '下降'}
          </div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
          <defs>
            <linearGradient id="aivis-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AIVIS_TEAL} stopOpacity="0.45" />
              <stop offset="100%" stopColor={AIVIS_TEAL} stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map(t => (
            <g key={t}>
              <line x1={padL} y1={yScale(t)} x2={W - padR} y2={yScale(t)}
                stroke="rgba(255,255,255,.06)" strokeDasharray="2 4" />
              <text x={padL - 8} y={yScale(t) + 3} fontSize="10" fill={T.textLow}
                textAnchor="end" fontFamily={T.mono}>{t}%</text>
            </g>
          ))}

          {data.length > 0 && [0, 7, 14, 21, 29].filter(i => i < data.length).map(i => (
            <text key={i} x={padL + i * xStep} y={H - padB + 16} fontSize="9"
              fill={T.textLow} textAnchor="middle" fontFamily={T.mono}>
              {data[i].month}/{data[i].day}
            </text>
          ))}

          {areaPath && <path d={areaPath} fill="url(#aivis-area)" />}
          {path && <path d={path} fill="none" stroke={AIVIS_TEAL} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${AIVIS_TEAL}88)` }} />}

          {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill={AIVIS_TEAL}
              style={{ filter: `drop-shadow(0 0 4px ${AIVIS_TEAL})` }} />
          ))}

          {points.length > 0 && (
            <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]}
              r="6" fill="none" stroke={AIVIS_TEAL} strokeWidth="1.5" opacity="0.55">
              <animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.8s" repeatCount="indefinite" />
            </circle>
          )}

          {hoverIdx !== null && points[hoverIdx] && (
            <g>
              <line x1={points[hoverIdx][0]} y1={padT} x2={points[hoverIdx][0]} y2={padT + innerH}
                stroke={AIVIS_TEAL} strokeOpacity="0.4" strokeDasharray="3 3" />
              <circle cx={points[hoverIdx][0]} cy={points[hoverIdx][1]} r="5"
                fill="#011520" stroke={AIVIS_TEAL} strokeWidth="2" />
            </g>
          )}
        </svg>

        {hoverIdx !== null && data[hoverIdx] && (() => {
          const [px, py] = points[hoverIdx]
          const xPct = (px / W) * 100
          const yPct = (py / H) * 100
          const flipX = xPct > 70
          return (
            <div style={{
              position: 'absolute',
              left: `calc(${xPct}% + ${flipX ? -10 : 10}px)`,
              top: `calc(${yPct}% - 18px)`,
              transform: flipX ? 'translate(-100%, -100%)' : 'translate(0, -100%)',
              background: 'rgba(0,6,10,.92)', border: `1px solid ${AIVIS_TEAL}66`,
              borderRadius: 7, padding: '7px 10px',
              fontSize: 14, color: T.text, whiteSpace: 'nowrap',
              boxShadow: `0 4px 14px rgba(0,0,0,.5), 0 0 0 1px ${AIVIS_TEAL}22`,
              animation: 'fadeUp .18s ease', pointerEvents: 'none', zIndex: 5,
            }}>
              <div style={{ color: T.textMid, fontSize: 14, fontFamily: T.mono, marginBottom: 2 }}>
                {data[hoverIdx].month}/{data[hoverIdx].day}
              </div>
              <div style={{ fontWeight: 700, color: AIVIS_TEAL }}>提及率 {data[hoverIdx].val}%</div>
              <div style={{ fontSize: 14, color: T.textLow }}>{data[hoverIdx].total} 次掃描</div>
            </div>
          )
        })()}
      </div>

      <div style={{
        fontSize: 14, color: T.textLow, marginTop: 10, paddingTop: 10,
        borderTop: '1px dashed rgba(255,255,255,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span>💡 <span style={{ color: T.textMid }}>滑過折線可查看每日數據</span></span>
      </div>
    </div>
  )
}

// =====================================================
// CitedSourcesCard（主打）：AI 接地推薦時參考了哪些網站
// 核心洞察：AI 是讀這些地方才形成推薦的 → 想被推薦就去這些地方爭取曝光
// =====================================================
function CitedSourcesCard({ sources, brandName }) {
  const [showAll, setShowAll] = useState(false)
  const has = sources && sources.length > 0
  const visible = has ? (showAll ? sources : sources.slice(0, 10)) : []
  const hidden = has ? sources.length - visible.length : 0
  return (
    <div style={{
      background: `linear-gradient(155deg, ${AIVIS_TEAL}16 0%, rgba(1,8,14,.6) 70%)`,
      border: `1px solid ${AIVIS_TEAL}45`, borderRadius: T.rL, padding: 22, marginBottom: 18,
      boxShadow: `0 8px 24px ${AIVIS_TEAL}12`,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: T.text }}>🔗 AI 是參考這些地方在推薦的</span>
        {has && <span style={{
          fontSize: 13, fontWeight: 700, color: AIVIS_TEAL,
          background: AIVIS_TEAL + '18', border: `1px solid ${AIVIS_TEAL}40`,
          padding: '2px 10px', borderRadius: 20,
        }}>{sources.length} 個來源</span>}
      </div>
      <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.75, marginBottom: has ? 16 : 0, maxWidth: 760 }}>
        AI 回答「推薦哪些公司」時，是即時讀了下面這些網站才形成答案的。
        <strong style={{ color: T.text }}>想讓 AI 推薦{brandName ? `「${brandName}」` : '你'}，就要設法出現在這些地方</strong>
        —— 被榜單/目錄收錄、衝 Google 商家評論、在論壇有存在感。
      </div>
      {has ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {visible.map((s, i) => (
              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" title={s.uri}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                  background: 'rgba(0,6,10,.5)', border: '1px solid rgba(255,255,255,.07)',
                  borderRadius: 8, padding: '11px 13px',
                }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: AIVIS_TEAL, minWidth: 16 }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </span>
                {s.count > 1 && <span style={{ fontSize: 13, color: T.textLow, flexShrink: 0 }}>被 {s.count} 題引用</span>}
                <span style={{ fontSize: 13, color: T.textLow, flexShrink: 0 }}>↗</span>
              </a>
            ))}
          </div>
          {sources.length > 10 && (
            <button onClick={() => setShowAll(v => !v)} style={{
              marginTop: 10, width: '100%', background: 'transparent',
              border: `1px solid ${AIVIS_TEAL}40`, color: AIVIS_TEAL,
              fontSize: 14, fontWeight: 600, padding: '9px', borderRadius: 8,
              cursor: 'pointer', fontFamily: T.font,
            }}>
              {showAll ? '收合 ▴' : `顯示其餘 ${hidden} 個來源 ▾`}
            </button>
          )}
        </>
      ) : (
        <div style={{
          fontSize: 14, color: T.textLow, marginTop: 14, padding: '12px 14px',
          background: 'rgba(0,6,10,.4)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 8,
        }}>
          執行一次掃描後，這裡會列出 AI 形成推薦時參考的網站來源（目前 Gemini 已支援接地、會帶來源）。
        </div>
      )}
    </div>
  )
}

// =====================================================
// RecentResults（歷史 chips + 展開 prompt → 展開原文）
// =====================================================
function RecentResults({
  results, brandHighlight, expandedPrompt, setExpandedPrompt,
  expandedRun, toggleRunExpand, history, activeHistoryId, setActiveHistoryId,
}) {
  const active = history.find(h => h.id === activeHistoryId) || history[0]
  const totalRuns = active?.totalRuns || 0
  const mentionsTotal = results.reduce((acc, r) => acc + r.runs.filter(x => x.mentioned).length, 0)
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 22,
    }}>
      {/* 歷史 chip 列 */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.textLow, letterSpacing: '.14em',
          marginBottom: 8, textTransform: 'uppercase',
        }}>最近 {history.length} 次掃描結果</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {history.map(h => {
            const isActive = h.id === activeHistoryId
            return (
              <button key={h.id} onClick={() => setActiveHistoryId(h.id)} style={{
                background: isActive ? AIVIS_TEAL + '14' : 'rgba(0,6,10,.5)',
                border: isActive ? `1px solid ${AIVIS_TEAL}80` : '1px solid rgba(255,255,255,.08)',
                borderRadius: 6, padding: '6px 11px',
                fontSize: 14, fontFamily: T.mono,
                color: isActive ? AIVIS_TEAL : T.textMid,
                fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                boxShadow: isActive ? `0 0 0 3px ${AIVIS_TEAL}10` : 'none', transition: 'all .2s',
              }}>{h.label}</button>
            )
          })}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 3 }}>掃描結果</div>
          <div style={{ fontSize: 14, color: T.textMid }}>
            最後一次掃描：<span style={{ color: T.text, fontWeight: 600 }}>{active ? relativeTime(active.ts) : '—'}</span>
            <span style={{ color: T.textLow }}> · </span>
            {active?.activeCount || 0} prompt × {active?.runs || 0} 次 = {totalRuns} 次回應
          </div>
        </div>
        {totalRuns > 0 && (
          <span style={{
            fontSize: 14, fontWeight: 600, color: AIVIS_TEAL,
            background: AIVIS_TEAL + '15', border: `1px solid ${AIVIS_TEAL}30`,
            padding: '4px 10px', borderRadius: 20,
          }}>提及率 {mentionsTotal}/{totalRuns} = {Math.round(mentionsTotal / totalRuns * 100)}%</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {results.map(r => {
          // 每引擎提及率（取代原本只看 Claude 的單一數字）—
          // Gemini 提到但 Claude 沒提到時，不再誤顯示 0
          const perEng = {}
          for (const run of r.runs) {
            for (const [k, v] of Object.entries(run.engines || {})) {
              if (!v) continue
              if (!perEng[k]) perEng[k] = { m: 0, t: 0 }
              perEng[k].t += 1
              if (v.mentioned) perEng[k].m += 1
            }
          }
          const perEngArr = Object.entries(perEng)
          const isOpen = expandedPrompt === r.promptId
          return (
            <div key={r.promptId} style={{
              border: `1px solid ${isOpen ? AIVIS_TEAL + '40' : 'rgba(255,255,255,.06)'}`,
              borderRadius: 10, overflow: 'hidden',
              background: isOpen ? 'rgba(13,122,88,.05)' : 'rgba(255,255,255,.015)',
              transition: 'all .25s',
            }}>
              <button onClick={() => setExpandedPrompt(isOpen ? null : r.promptId)}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  padding: '14px 16px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', gap: 12, color: T.text, fontFamily: T.font,
                }}>
                <span style={{ fontSize: 14 }}>📋</span>
                <span style={{ flex: 1, fontSize: 14, color: T.text, lineHeight: 1.5 }}>「{r.promptText}」</span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0 }}>
                  {perEngArr.map(([k, e]) => {
                    const hit = e.m > 0
                    const col = engineColor(k)
                    return (
                      <span key={k} title={`${engineLabel(k)} 提及 ${e.m}/${e.t} 次`} style={{
                        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                        color: hit ? col : T.textLow,
                        background: hit ? col + '20' : 'rgba(255,255,255,.04)',
                        border: `1px solid ${hit ? col + '45' : 'rgba(255,255,255,.10)'}`,
                        padding: '3px 9px', borderRadius: 5,
                      }}>{engineLabel(k)} {e.m}/{e.t}</span>
                    )
                  })}
                </span>
                <svg width="11" height="11" viewBox="0 0 11 11" style={{
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform .2s', flexShrink: 0,
                }}>
                  <path d="M2 4L5.5 7L9 4" stroke={T.textMid} strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ padding: '2px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {r.runs.map((run, i) => {
                    const k = `${r.promptId}-${i}`
                    const open = expandedRun[k]
                    // 2026-06-10 路線 B：逐次顯示各引擎 ✓/✗ chip + 展開看各引擎原文
                    const engineEntries = Object.entries(run.engines || {})
                    const anyMentioned = engineEntries.some(([, v]) => v?.mentioned)
                    return (
                      <div key={i} style={{
                        background: 'rgba(0,6,10,.55)',
                        border: `1px solid ${anyMentioned ? AIVIS_TEAL + '25' : 'rgba(255,255,255,.06)'}`,
                        borderRadius: 8, padding: '10px 12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>第 {run.run_index} 次</span>
                          {/* 每個引擎一顆 chip：底色用引擎色、✓ 提及 / ✕ 未提及 */}
                          {engineEntries.map(([key, v]) => {
                            const col = engineColor(key)
                            const hit = !!v?.mentioned
                            return (
                              <span key={key} style={{
                                fontSize: 13, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                                background: hit ? col + '22' : 'rgba(255,255,255,.04)',
                                border: `1px solid ${hit ? col + '55' : 'rgba(255,255,255,.10)'}`,
                                color: hit ? col : T.textLow,
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                              }}>
                                {engineLabel(key)} {hit ? '✓' : '✕'}
                                {hit && v.position ? <span style={{ opacity: .8 }}>#{v.position}</span> : null}
                              </span>
                            )
                          })}
                          <button onClick={() => toggleRunExpand(r.promptId, i)} style={{
                            marginLeft: 'auto', background: 'transparent',
                            border: '1px solid rgba(255,255,255,.12)', color: T.textMid,
                            fontSize: 14, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                            fontFamily: T.font,
                          }}>{open ? '收合 ▲' : '展開原文 ▼'}</button>
                        </div>
                        {open && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* 每個引擎各自一段原文 */}
                            {engineEntries.map(([key, v]) => (
                              <div key={key}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: engineColor(key), marginBottom: 4 }}>
                                  {engineLabel(key)} 原文
                                </div>
                                <div style={{
                                  padding: '10px 12px', background: 'rgba(0,0,0,.3)', borderRadius: 6,
                                  borderLeft: `2px solid ${v?.mentioned ? engineColor(key) : 'rgba(255,255,255,.15)'}`,
                                  fontSize: 14, color: T.textMid, lineHeight: 1.7,
                                  whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto',
                                }}>
                                  {v?.raw ? highlightBrandAuto(v.raw, brandHighlight) : '（無原文）'}
                                </div>
                                {/* 接地引用來源（目前只有 Gemini 有）：AI 即時上網查時引用了哪些網站 */}
                                {Array.isArray(v?.sources) && v.sources.length > 0 && (
                                  <div style={{ marginTop: 8 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: engineColor(key), marginBottom: 5 }}>
                                      🔗 AI 引用來源（{v.sources.length}）
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                      {v.sources.map((s, si) => (
                                        <a key={si} href={s.uri} target="_blank" rel="noopener noreferrer" title={s.uri}
                                          style={{
                                            fontSize: 13, color: T.textMid, textDecoration: 'none',
                                            display: 'flex', gap: 6, overflow: 'hidden',
                                          }}>
                                          <span style={{ color: engineColor(key), fontWeight: 700, flexShrink: 0 }}>{si + 1}.</span>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || s.uri}</span>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// ScanOverlay（掃描中全螢幕雷達動畫）
// =====================================================
function ScanOverlay({ phase, total, prompts }) {
  const phases = [
    { label: '正在連線 Claude API…', icon: '🔗' },
    ...(prompts || []).map((p, i) => ({
      label: `送出 prompt ${i + 1}/${total}：${p.text.slice(0, 32)}${p.text.length > 32 ? '…' : ''}`,
      icon: '📤',
    })),
    { label: '解析回應、寫入資料庫…', icon: '💾' },
  ]
  const currentIdx = Math.min(phase, phases.length - 1)
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,4,8,.86)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeUp .3s ease',
    }}>
      <div style={{ position: 'relative', width: 240, height: 240, marginBottom: 36 }}>
        {[0.3, 0.55, 0.8, 1].map((r, i) => (
          <div key={i} style={{
            position: 'absolute', inset: `${50 - r * 50}%`,
            borderRadius: '50%', border: `1px solid ${AIVIS_TEAL}${i === 3 ? '44' : '22'}`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
          animation: 'spin 2.4s linear infinite',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: '50%', height: 2,
            transformOrigin: '0 50%',
            background: `linear-gradient(90deg, transparent, ${AIVIS_TEAL})`,
            boxShadow: `0 0 18px ${AIVIS_TEAL}`,
          }} />
        </div>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: 14, height: 14,
          marginTop: -7, marginLeft: -7, borderRadius: '50%',
          background: AIVIS_TEAL, boxShadow: `0 0 20px ${AIVIS_TEAL}`,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      </div>

      <div style={{ width: 540, maxWidth: '92vw' }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: AIVIS_TEAL,
          letterSpacing: '.14em', textAlign: 'center', marginBottom: 6,
        }}>SCANNING</div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: T.text,
          textAlign: 'center', marginBottom: 18,
        }}>AI 曝光監測掃描中</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: T.mono, fontSize: 14 }}>
          {phases.map((ph, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              opacity: i <= currentIdx ? 1 : 0.25,
              color: i < currentIdx ? AIVIS_TEAL : (i === currentIdx ? T.text : T.textLow),
              transition: 'opacity .3s',
            }}>
              <span>{i < currentIdx ? '✓' : (i === currentIdx ? ph.icon : '·')}</span>
              <span style={{ flex: 1 }}>{ph.label}</span>
              {i === currentIdx && (
                <span style={{ color: AIVIS_TEAL, animation: 'pulse 1s infinite' }}>●●●</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Toast（短訊通知）
// =====================================================
function Toast({ kind, msg }) {
  const color = kind === 'success' ? AIVIS_TEAL : (kind === 'ai' ? T.aeo : T.orange)
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 280, background: 'rgba(0,6,10,.95)',
      border: `1px solid ${color}55`, borderRadius: 10,
      padding: '12px 18px', minWidth: 280, maxWidth: '90vw',
      boxShadow: `0 8px 32px ${color}33`,
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'fadeUp .3s ease',
    }}>
      <span style={{ fontSize: 14, color: T.text, fontWeight: 500, fontFamily: T.font }}>{msg}</span>
    </div>
  )
}

// =====================================================
// UsageBanner（月內含額度提示條）
// 觸發：用量 ≥80% 才出現（atWarn === true）
// 狀態：warn（120~149）/ soft（150~999）/ hard（1000+）— 3 段配色與文案
// =====================================================
function UsageBanner({ used, quota, remaining, atSoftLimit, atHardCap, hardCap, remainingHard, onTopupClick }) {
  // 進度條最大顯示百分比（可超過 100% 進入「Top-up 區段」，但視覺鎖在 100%）
  const pct = Math.min(100, Math.round((used / quota) * 100))
  const overUsed = Math.max(0, used - quota) // 已用了幾次 Top-up

  // 三段狀態決定主色 + 標題文案 + CTA 字
  let mainColor, bgGrad, title, hint, ctaText
  if (atHardCap) {
    mainColor = T.fail
    bgGrad = `linear-gradient(135deg, ${T.fail}1a, ${T.fail}08)`
    title = `本月查詢已達硬上限 1,000 次`
    hint = `為保護毛利結構，每位用戶每月最多 ${hardCap.toLocaleString()} 次。Agency 方案推出後將解除上限。`
    ctaText = '查看詳情'
  } else if (atSoftLimit) {
    mainColor = T.orange
    bgGrad = `linear-gradient(135deg, ${T.orange}1a, ${T.orange}08)`
    title = `本月內含 ${quota} 次已用完`
    hint = `已使用 ${used.toLocaleString()} 次（含 Top-up ${overUsed} 次）· 距硬上限還剩 ${remainingHard.toLocaleString()} 次 · 加購次數包繼續使用`
    ctaText = '加購次數包'
  } else {
    mainColor = T.warn
    bgGrad = `linear-gradient(135deg, ${T.warn}1a, ${T.warn}08)`
    title = `本月已使用 ${used} / ${quota} 次（${pct}%）`
    hint = `剩餘 ${remaining} 次內含額度 · 用完可加購 Top-up 次數包繼續監測，不會中斷`
    ctaText = '了解加購'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      background: bgGrad,
      border: `1px solid ${mainColor}55`,
      borderRadius: T.rL, padding: '16px 22px', marginBottom: 18, flexWrap: 'wrap',
    }}>
      {/* 左：圖示 + 標題 + 提示 + 進度條 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${mainColor}33`, border: `1px solid ${mainColor}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 20 }}>{atHardCap ? '🚫' : atSoftLimit ? '🔔' : '⚠️'}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 14, color: T.textMid, marginBottom: 8, lineHeight: 1.5 }}>
            {hint}
          </div>
          {/* 進度條 — 鎖在 100%，超量時尾端顯示橘色「+N Top-up」標記 */}
          <div style={{
            width: '100%', height: 6, borderRadius: 3,
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: `linear-gradient(90deg, ${mainColor}, ${mainColor}cc)`,
              transition: 'width .4s',
            }} />
          </div>
        </div>
      </div>
      {/* 右：CTA — 硬上限狀態下不引導加購（無解），其他兩段都導去 TopupModal */}
      <button onClick={onTopupClick}
        style={{
          fontSize: 14, padding: '10px 18px', whiteSpace: 'nowrap',
          border: `1px solid ${mainColor}88`, borderRadius: 8, fontWeight: 700,
          fontFamily: T.font, background: `${mainColor}1a`, color: mainColor,
          cursor: 'pointer', transition: 'all .2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = `${mainColor}33` }}
        onMouseLeave={e => { e.currentTarget.style.background = `${mainColor}1a` }}>
        {ctaText} →
      </button>
    </div>
  )
}

// =====================================================
// TopupModal（加購次數包 / 硬上限說明 — 視 kind 切換內容）
// kind === 'soft'：兩張 Top-up 卡（小/大），按鈕 POST /api/aivis/checkout-topup → 跳 Stripe Checkout
// kind === 'hard'：硬上限說明 + Agency 預告（無 Top-up 可救，走 Agency 預登記 mailto）
// =====================================================
// Top-up 同意書文案 v1 — 與 api/aivis/checkout-topup-newebpay.js TOPUP_DISCLAIMER_V1 必須完全一致
// 因為要把同字串寫進 aivis_topup_consents.consent_text 當法律證據（事後不能說「我沒看到這段」）
const TOPUP_CONSENT_V1 = '本人已閱讀並同意：Top-up 加購屬於「一經提供即完成之線上服務」（消保法第 19 條第 2 項第 5 款），credits 入帳後不適用 7 天無條件解除權、亦不退款。'

function TopupModal({ kind, used, quota, hardCap, user, onClose }) {
  const isHard = kind === 'hard'
  const [buying, setBuying] = useState(null)  // 'small' | 'large' | null（防連點 + loading state）
  const [buyError, setBuyError] = useState(null)
  const [agreed, setAgreed] = useState(false)  // 不退款同意 checkbox — 未勾不能下單（消保法 § 19-II-5「事先同意」要件）

  // 點 Top-up 卡的「立即加購」→ 打 /api/aivis/checkout-topup-newebpay → 拿到 NewebPay form 欄位
  // → 動態建 <form> 自動 submit 跳轉至 NewebPay 付款頁
  // Phase 1 走 NewebPay（TW/NT$）；Phase 2 Stripe Atlas 上線後會切回 Stripe（程式碼保留在 checkout-topup.js）
  async function handleBuy(packId) {
    if (!user?.id || !user?.email) {
      setBuyError('請先登入後再加購')
      return
    }
    if (!agreed) {
      setBuyError('請先勾選同意「不退款」條款後再加購')
      return
    }
    setBuying(packId)
    setBuyError(null)
    try {
      const r = await fetch('/api/aivis/checkout-topup-newebpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          pack: packId,
          returnUrl: window.location.href,
          agreed: true,                       // 法律證據：用戶在前端勾了 checkbox
          consentVersion: 'v1',               // 文案版本，未來改文案要 bump 到 v2
          consentText: TOPUP_CONSENT_V1,      // 把當下顯示給用戶看的字串原文也送回後端存
        }),
      })
      const data = await r.json()
      if (!r.ok || !data?.apiUrl || !data?.fields) {
        throw new Error(data?.error || '建立付款連結失敗')
      }
      // NewebPay 規範：把 fields 寫成 hidden inputs，form POST 整頁跳轉到金流頁
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = data.apiUrl
      form.style.display = 'none'
      Object.entries(data.fields).forEach(([key, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = value
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (err) {
      setBuyError(err.message || '無法啟動付款流程，請稍後再試')
      setBuying(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 290,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'fadeUp .25s ease',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: isHard ? 480 : 620, width: '100%', maxHeight: '92vh', overflowY: 'auto',
          background: 'rgba(8,12,18,0.96)', border: `1px solid ${isHard ? T.fail : AIVIS_TEAL}44`,
          borderRadius: T.rXL, padding: 28, fontFamily: T.font,
          boxShadow: `0 24px 80px ${isHard ? T.fail : AIVIS_TEAL}33`,
        }}>
        {/* 關閉按鈕（右上角，flex 定位避免 absolute 對齊問題） */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -8 }}>
          <button onClick={onClose} aria-label="關閉" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: T.textMid, fontSize: 20, padding: 4, lineHeight: 1,
          }}>
            ✕
          </button>
        </div>

        {/* 標題區 */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{isHard ? '🚫' : '🎯'}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 6 }}>
            {isHard ? '已達每月查詢硬上限' : `本月內含 ${quota} 次已用完`}
          </div>
          <div style={{ fontSize: 14, color: T.textMid }}>
            {isHard
              ? `本月已使用 ${used.toLocaleString()} / ${hardCap.toLocaleString()} 次 · 為保護毛利結構，已暫停查詢`
              : `本月已使用 ${used} 次 · 加購 Top-up 次數包，繼續監測 AI 對你的引用`}
          </div>
        </div>

        {isHard ? (
          // ── 硬上限版：直接停權說明 + Agency 預告 ──
          <div>
            <div style={{
              padding: 18, borderRadius: T.rM,
              background: `${T.fail}10`, border: `1px solid ${T.fail}33`,
              marginBottom: 20, fontSize: 14, color: T.text, lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>為什麼有 1,000 次硬上限？</div>
              每月查詢上限為內含 + Top-up 合計 {hardCap.toLocaleString()} 次。
              這是 Pro 訂閱在 0 真實用戶階段的保守設定，避免少數重度用戶吃光毛利後影響其他客戶體驗。
              <br /><br />
              <div style={{ fontWeight: 700, marginBottom: 8, color: T.aivis }}>Agency 方案推出後將解除上限</div>
              預計 2026 Q3 推出 Agency 方案（NT$4,990／月起），含 50 站、白標 PDF、多客戶工作區，
              查詢上限解除。如果你已是重度需求，歡迎先預登記。
            </div>
            <a href="mailto:hello@aark.com.tw?subject=Agency 方案預登記&body=我目前每月需要超過 1,000 次 aivis 查詢，希望優先取得 Agency 方案資訊。"
              style={{
                display: 'block', textAlign: 'center',
                padding: '14px 24px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                background: `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`,
                color: '#fff', textDecoration: 'none',
                boxShadow: `0 8px 24px ${AIVIS_TEAL}55`,
              }}>
              📧 寄信預登記 Agency 方案
            </a>
          </div>
        ) : (
          // ── 月內含上限版：兩張 Top-up 卡 + 即將開放 disclaimer ──
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 18,
            }}>
              {TOPUP_PACKS.map((pack, idx) => {
                const isBuying = buying === pack.id
                const isOtherBuying = buying && buying !== pack.id
                return (
                  <div key={pack.id} style={{
                    padding: 20, borderRadius: T.rM,
                    background: `${AIVIS_TEAL}0a`,
                    border: `1px solid ${AIVIS_TEAL}${idx === 1 ? '66' : '33'}`,  // 大包邊框較亮 = 推薦
                    position: 'relative',
                    opacity: isOtherBuying ? 0.5 : 1,
                  }}>
                    {idx === 1 && (
                      <div style={{
                        position: 'absolute', top: -10, right: 12,
                        padding: '3px 10px', borderRadius: 12,
                        background: AIVIS_TEAL, color: '#001b12',
                        fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                      }}>🔥 最划算</div>
                    )}
                    <div style={{ fontSize: 14, color: T.textMid, marginBottom: 6, fontWeight: 600 }}>
                      Top-up {pack.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: T.text }}>
                        NT${pack.price}
                      </span>
                      <span style={{ fontSize: 14, color: T.textMid }}>
                        / +{pack.quota} 次
                      </span>
                    </div>
                    <div style={{ fontSize: 14, color: AIVIS_TEAL, marginBottom: 10, fontWeight: 600 }}>
                      每次 NT${pack.perCall.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.5, marginBottom: 14 }}>
                      {pack.hint}
                    </div>
                    <button
                      onClick={() => handleBuy(pack.id)}
                      disabled={!!buying || !agreed}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        border: 'none',
                        cursor: buying ? 'wait' : (!agreed ? 'not-allowed' : 'pointer'),
                        background: !agreed
                          ? 'rgba(255,255,255,0.08)'
                          : (idx === 1
                            ? `linear-gradient(135deg, ${AIVIS_TEAL}, ${AIVIS_TEAL_DEEP})`
                            : `${AIVIS_TEAL}22`),
                        color: !agreed ? T.textMid : (idx === 1 ? '#fff' : AIVIS_TEAL),
                        fontWeight: 700, fontSize: 14,
                        boxShadow: (idx === 1 && agreed) ? `0 6px 18px ${AIVIS_TEAL}44` : 'none',
                        opacity: !agreed ? 0.6 : 1,
                      }}>
                      {isBuying ? '⏳ 跳轉中…' : (!agreed ? '請先勾選下方同意' : '立即加購')}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 規則說明 — 購買前法律強制揭露（消保法 § 19-II-5 不退款條款）*/}
            <div style={{
              padding: 14, borderRadius: T.rM,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 10, fontSize: 14, color: T.textMid, lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>規則說明 — 購買前請詳閱</div>
              · 一次性購買、不過期、用完為止、不綁訂閱<br />
              · 月內含 {quota} 次先扣 → 用完才扣 Top-up credits<br />
              · 每月查詢硬上限 {hardCap.toLocaleString()} 次（內含 + Top-up 合計）<br />
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                · ⚠️ Top-up 屬於「一經提供即完成之線上服務」（消保法第 19 條第 2 項第 5 款），
                  付款完成、credits 入帳後不適用 7 天無條件解除權、亦不退款。
              </span><br />
              · 如遇盜刷或交易爭議請聯繫客服 <a href="mailto:aark.younjung@gmail.com" style={{ color: AIVIS_TEAL, textDecoration: 'underline' }}>aark.younjung@gmail.com</a> 個案處理。
            </div>

            {/* 同意 checkbox — 未勾不能按「立即加購」（按鈕已用 disabled={!agreed} 鎖住）*/}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: T.rM,
              background: agreed ? `${AIVIS_TEAL}14` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${agreed ? AIVIS_TEAL + '55' : 'rgba(255,255,255,0.12)'}`,
              marginBottom: 14, cursor: 'pointer', userSelect: 'none',
              transition: 'all 0.2s ease',
            }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                style={{
                  width: 18, height: 18, marginTop: 1, flexShrink: 0,
                  accentColor: AIVIS_TEAL, cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 14, color: T.text, lineHeight: 1.6 }}>
                我已閱讀並同意：Top-up 加購屬於「一經提供即完成之線上服務」（消保法第 19 條第 2 項第 5 款），
                credits 入帳後 <strong style={{ color: '#fbbf24' }}>不適用 7 天無條件解除權、亦不退款</strong>。
              </span>
            </label>

            {buyError && (
              <div style={{
                padding: 12, borderRadius: T.rM,
                background: `${T.fail}14`, border: `1px solid ${T.fail}44`,
                fontSize: 14, color: '#fca5a5', lineHeight: 1.6,
              }}>
                ⚠️ {buyError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
