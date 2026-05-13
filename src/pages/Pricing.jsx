import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

const FEATURES_FREE = [
  '追蹤最多 3 個網站',
  'SEO / AEO / GEO / E-E-A-T 5 大面向分數',
  '通過 / 不通過項目清單',
  'AI 優化建議（3 條通用方向）',
  '文章內容分析（基本版）',
  '競品比較（2 個網站）',
  '公開排行榜',
]

const FEATURES_PRO = [
  '追蹤最多 15 個網站',
  '修復碼產生器（llms.txt / JSON-LD / FAQ Schema）',
  '歷史趨勢圖（追蹤每次優化成效）',
  '平台別修復指南（WordPress / Shopify / Wix / HTML）',
  'AEO 每項檢測逐項修復建議',
  'SEO 詳情頁 3 階段優化路線圖',
  '文章內容分析（完整修復建議）',
  '競品比較（最多 4 個網站）',
  'PDF 報告匯出 + Email 週報',
  'AI 曝光監測（aivis）每月 150 次查詢額度',
  '所有免費版功能',
]

const FEATURES_AGENCY = [
  '追蹤最多 50 個網站',
  '白標 PDF 報告（附你的品牌）',
  '多客戶工作區管理',
  '客戶報表獨立分享連結',
  '優先客服支援',
  '所有 Pro 版功能',
]

// FAQ 折疊項 — dark 用 GlassCard + T.orange, light 用 details/summary 維持原樣
// C4: 每題加上「恐懼標籤」chip（用戶看標題就能找到自己的疑慮）
function PricingFAQ({ items, isDark }) {
  if (isDark) {
    // ⚠ 重要：<summary> 必須是 <details> 的「直接」子元素，不可被 GlassCard 等 div 包住
    //   否則瀏覽器會把整個 details 視為無 summary、預設 collapsed、只渲染預設「Details」黑字
    //   把 GlassCard 樣式內聯到 <details> 本體，summary 才能正確點開展開
    return (
      <div className="space-y-4">
        {items.map((item, i) => (
          <details
            key={i}
            className="group cursor-pointer"
            style={{
              background: T.cardBg,                              // 玻璃擬態深底
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: `1px solid ${T.orange}28`,                 // 橘色透明邊框（與其他 GlassCard 一致）
              borderRadius: T.rL,                                // 16px 圓角
              padding: 24,
              boxShadow: '0 2px 20px rgba(0,0,0,.45)',           // 與 GlassCard 預設投影一致
            }}
          >
            <summary className="flex items-start justify-between font-medium list-none gap-4" style={{ color: T.text }}>
              <div className="flex-1">
                {item.tag && (
                  <span
                    className="inline-block mb-2 px-2 py-0.5 text-xs rounded-full font-medium"
                    style={{ background: item.tagColor + '26', color: item.tagColor, border: `1px solid ${item.tagColor}40` }}
                  >
                    {item.tag}
                  </span>
                )}
                <div>{item.q}</div>
              </div>
              <span className="text-lg flex-shrink-0 mt-1 group-open:rotate-180 transition-transform" style={{ color: T.textLow }}>↓</span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: T.textMid }}>{item.a}</p>
          </details>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <details key={i} className="group p-6 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 cursor-pointer">
          <summary className="flex items-start justify-between text-gray-800 font-medium list-none gap-4">
            <div className="flex-1">
              {item.tag && (
                <span
                  className="inline-block mb-2 px-2 py-0.5 text-xs rounded-full font-medium"
                  style={{ background: item.tagColor + '20', color: item.tagColor, border: `1px solid ${item.tagColor}40` }}
                >
                  {item.tag}
                </span>
              )}
              <div>{item.q}</div>
            </div>
            <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg flex-shrink-0 mt-1">↓</span>
          </summary>
          <p className="mt-4 text-gray-500 text-sm leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  )
}

// C4: FAQ 重排（依用戶恐懼優先級）+ 加恐懼標籤 + 加 Ahrefs 競品比較題
//     刪除「早鳥 NT$990 何時截止」題（與早鳥 block 重複，視覺已說清楚）
const FAQ_ITEMS = [
  {
    tag: '取消／退款焦慮',
    tagColor: '#ef4444',
    q: '可以隨時取消嗎？退款怎麼算？',
    a: '可以。月繳方案隨時取消、下個計費週期不再收費，月繳不提供退款。年繳方案享 14 天無條件退款保證，期限內取消可全額退費；超過 14 天則繼續使用至期滿後降為免費版。',
  },
  {
    tag: '試用流程焦慮',
    tagColor: '#10b981',
    q: '7 天免費試用是怎麼運作的？',
    a: 'Pro 全功能免費試用 7 天，aivis 試用期間上限 50 次（避免被刷）。試用結束前可隨時取消不收費；若決定續訂，年費方案再加 14 天無條件退款保證。不需信用卡綁定即可開始。',
  },
  {
    tag: '產品差異焦慮',
    tagColor: '#8b5cf6',
    q: '免費版和 Pro 版最大的差別是什麼？',
    a: '免費版讓你看到「哪裡有問題」，Pro 版告訴你「怎麼修」+「持續監測」。包含逐項修復建議、修復碼產生器（可直接複製 llms.txt / JSON-LD / FAQ Schema）、歷史趨勢圖、平台別修復指南，以及每月 150 次 AI 曝光監測（aivis）— 直接呼叫 ChatGPT / Perplexity / Claude 看你的品牌是否還在 AI 推薦名單裡。',
  },
  {
    tag: '競品焦慮',
    tagColor: '#f59e0b',
    q: '跟 Ahrefs / SEMrush 比，差別在哪裡？',
    a: 'Ahrefs 與 SEMrush 是 Google 時代的工具，回答的是「你在搜尋結果排第幾名」；優勢方舟回答的是「ChatGPT、Perplexity、Claude 推薦的是你還是對手」。我們直接呼叫 AI API 用真實使用者問法測試你的品牌曝光，並提供修復碼可直接複製、平台別指南（WordPress / Shopify / Wix / HTML），月費 NT$1,490 大約是 Ahrefs Lite 方案的 1/3，且原生繁中介面。',
  },
  {
    tag: '認知焦慮',
    tagColor: '#3b82f6',
    q: 'AEO / GEO 是什麼？跟一般 SEO 有什麼不同？',
    a: 'SEO 是讓 Google 搜尋找到你，AEO（Answer Engine Optimization）是讓 ChatGPT、Perplexity 等 AI 問答引擎引用你的內容，GEO（Generative Engine Optimization）是讓生成式 AI 在回答時主動提及你的品牌。這是 AI 搜尋時代必備的新指標。',
  },
  {
    tag: 'aivis 焦慮',
    tagColor: '#18c590',
    q: 'AI 曝光監測（aivis）是什麼？跟 AEO 有什麼差別？',
    a: 'AEO 是「靜態檢測」— 檢查網站結構是否適合被 AI 引用；aivis 是「動態監測」— 直接呼叫 Claude / ChatGPT / Perplexity API 用真實使用者的問法，看 AI 是否會推薦你的品牌。Pro 訂閱每月內含 150 次查詢額度（aivis 不單獨販售），這是 Pro 持續訂閱的核心價值 — SEO 改完是有限的事，但 AI 引用率天天在變、競爭對手也天天在優化。若用量接近上限，系統會在 dashboard 通知你，可選擇加購額外次數包繼續使用。',
  },
  {
    tag: 'Agency 等待焦慮',
    tagColor: '#ec4899',
    q: 'Agency 方案什麼時候推出？',
    a: '預計 2026 年中推出，月費 NT$4,990 起，含 50 站追蹤、完整白標、多客戶工作區、優先客服支援。如果你是行銷公司或設計工作室，歡迎先用 Pro 方案，Agency 推出時會優先通知。',
  },
]

export default function Pricing() {
  // A3: 預設 yearly（年繳更省，預設選中提高 AOV，符合 5 LLM 共識最佳實踐）
  const [isYearly, setIsYearly] = useState(true)
  const { user, isPro, isTrial, hasTrialedBefore, trialDaysRemaining, startTrial } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const proMonthly = 1490
  const proYearly = 13900
  const proYearlyPerMonth = Math.round(proYearly / 12)
  const savedAmount = proMonthly * 12 - proYearly
  const savedPercent = Math.round((savedAmount / (proMonthly * 12)) * 100)
  const savedMonths = (savedAmount / proMonthly).toFixed(1)
  const earlybirdYearly = 990 * 12
  const earlybirdSlotsTotal = 100

  // aivis 已整合進 Pro 核心（每月 150 次內含），超量 Top-up 不在定價頁陳列
  // 設計理由：(1) 避免「改完 SEO 就退訂」流失 → 用 aivis 持續性綁住 Pro 訂閱
  //          (2) Top-up 採 just-in-time 揭露 — 用戶到 aivis dashboard 接近上限時才彈出加購
  //              避免定價頁出現「還要再加錢嗎」的隱憂稀釋 Pro 卡訴求
  // Top-up 規格（後端 / dashboard 實作時參考）：
  //   - 小包：NT$490 / +300 次（每次 NT$1.63，補檔用）
  //   - 大包：NT$990 / +800 次（每次 NT$1.24，多品牌或競品矩陣）
  //   - 一次性購買、不過期、用完為止、不綁訂閱
  //   - 每月查詢硬上限 1,000 次（內含 + Top-up 合計），Agency 推出後解除
  const aivisIncludedPerMonth = 150

  // A5 社會證明 KPI：上線前必修項，從 /api/public-stats 拉真實聚合數字
  // 走後端 service role 而非前端直查 Supabase — 訪客 anon role 對 user-scoped 表的 RLS 會拿到 0
  // 載入中 / 失敗顯示 '—'，避免假數字外露被質疑
  // earlybird_taken 同源 — Pricing 早鳥進度條也吃這個（已售 N / 100 名動態顯示）
  const [stats, setStats] = useState({ brands: null, reports: null, mentions: null, scans: null, earlybird_taken: null })
  useEffect(() => {
    let cancelled = false
    fetch('/api/public-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setStats(d) })
      .catch(() => { /* 失敗就維持 null → 顯示 — */ })
    return () => { cancelled = true }
  }, [])
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—')
  // 早鳥已售名額：API 回 null 則 fallback 0（避免進度條跑掉），用於三處 UI（top bar 剩餘 / 進度條 / 文案）
  const earlybirdSlotsTaken = stats.earlybird_taken ?? 0

  // NewebPay 跳回 returnUrl 帶 ?pro_success={yearly|earlybird} — 顯示「✓ 升級成功」toast
  // 入帳是非同步走 notify URL 寫 DB（profile.is_pro 可能還沒刷到），toast 只是給用戶即時心理確認
  // 顯示後立刻清掉 query string 防重整再彈、6 秒後自動消失
  const [proSuccessPlan, setProSuccessPlan] = useState(null)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const plan = params.get('pro_success')
    if (plan === 'yearly' || plan === 'earlybird') {
      setProSuccessPlan(plan)
      navigate(location.pathname, { replace: true })
      const t = setTimeout(() => setProSuccessPlan(null), 6000)
      return () => clearTimeout(t)
    }
  }, [location.search, location.pathname, navigate])

  const [upgrading, setUpgrading] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)

  // 啟動 7 天免費試用 — 只給「已登入但從未試用過、也不是 Pro」的用戶
  // 其他情境：未登入 → /register、已試用過 → 走付款流程、已是 Pro → 回首頁
  const handleStartTrial = async () => {
    if (!user) { navigate('/register'); return }
    if (isPro) { navigate('/'); return }
    if (hasTrialedBefore) {
      // 試用次數用過了，引導去付費（依當前 toggle 決定年繳/月繳）
      return handleUpgrade(isYearly ? 'yearly' : 'monthly')
    }
    setStartingTrial(true)
    try {
      const result = await startTrial()
      if (result?.ok) {
        // 成功啟動 — 導向首頁讓他立刻試用 Pro 功能
        navigate('/')
      } else if (result?.error === 'already_trialed') {
        alert('您已經啟用過 7 天試用了，請選擇付費方案繼續使用 Pro 功能')
        await handleUpgrade(isYearly ? 'yearly' : 'monthly')
      } else if (result?.error === 'already_pro') {
        navigate('/')
      } else {
        alert('啟動試用失敗，請稍後再試或聯絡客服')
      }
    } finally {
      setStartingTrial(false)
    }
  }

  const handleUpgrade = async (priceType = 'monthly') => {
    if (!user) { navigate('/register'); return }
    if (isPro) { navigate('/'); return }
    setUpgrading(true)
    try {
      // 年繳 + 早鳥走 NewebPay 一次性付款（Phase 1 Step 2）— 拿到 form fields 後動態建表單整頁跳轉
      if (priceType === 'yearly' || priceType === 'earlybird') {
        const res = await fetch('/api/checkout-pro-yearly-newebpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            plan: priceType,
            returnUrl: window.location.href,
          }),
        })
        const data = await res.json()
        if (!res.ok || !data.apiUrl || !data.fields) {
          alert(data.error || '建立付款頁面失敗，請稍後再試')
          setUpgrading(false)
          return
        }
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = data.apiUrl
        Object.entries(data.fields).forEach(([name, value]) => {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = String(value)
          form.appendChild(input)
        })
        document.body.appendChild(form)
        form.submit()
        return
      }
      // 月繳暫時保留 Stripe 通道（Phase 1 Step 3 定期定額尚未串接 NewebPay）
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          returnUrl: window.location.href,
          priceType,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || '建立付款頁面失敗，請稍後再試')
    } catch {
      alert('連線失敗，請稍後再試')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={isDark
        ? { background: '#000' }
        : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }
      }
    >
      {/* dark 模式雙端漸層 — 與 HomeDark / FAQ 一致，上方左上亮 + 下方右下亮 */}
      {isDark && (
        <>
          <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
            height: '2400px',
            background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
            mixBlendMode: 'lighten',
          }} />
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
            height: '2400px',
            background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
            mixBlendMode: 'lighten',
          }} />
        </>
      )}

      {/* 雜訊疊層 — dark 用 0.12, light 用 0.25 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='${isDark ? 4 : 3}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: isDark ? 0.12 : 0.25,
        mixBlendMode: 'overlay',
      }} />

      {/* light 模式才有的橘色點陣紋路 */}
      {!isDark && (
        <div className="absolute inset-0 pointer-events-none z-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
      )}

      <div className="relative z-10">
      {/* NewebPay 付款完成跳回 — 綠色升級成功 toast（右上 fixed，6 秒後自動消失） */}
      {/* 入帳走非同步 notify，profile 可能 1-30 秒後才刷到 is_pro=true；toast 只給即時心理確認 */}
      {proSuccessPlan && (
        <div
          className="fixed top-16 right-4 z-50 max-w-sm rounded-xl shadow-2xl backdrop-blur-md"
          style={{
            background: `linear-gradient(135deg, ${T.pass}f0 0%, #0d9488f0 100%)`,
            border: `1px solid ${T.pass}66`,
            padding: '14px 18px',
            color: '#ffffff',
            animation: 'slideInRight 0.4s ease-out',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none flex-shrink-0" aria-hidden>✓</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">
                {proSuccessPlan === 'earlybird' ? '🐣 早鳥首年購買成功！' : '✨ Pro 年繳升級成功！'}
              </div>
              <div className="text-sm mt-1 opacity-90 leading-relaxed">
                付款已送出，系統入帳處理中。Pro 功能將於數十秒內全部解鎖，可重整頁面確認方案徽章。
              </div>
            </div>
            <button
              onClick={() => setProSuccessPlan(null)}
              className="text-white/80 hover:text-white text-lg leading-none flex-shrink-0"
              aria-label="關閉"
            >
              ×
            </button>
          </div>
          {/* 進場動畫 keyframes — 內聯定義避免污染全域 CSS */}
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(40px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* C3: Sticky 早鳥 bar — 滾動時始終可見，提醒名額限制 */}
      <div
        className="sticky top-0 z-30 backdrop-blur-md"
        style={isDark
          ? { background: 'linear-gradient(90deg, rgba(245,158,11,0.85), rgba(249,115,22,0.85))', borderBottom: `1px solid ${T.warn}55` }
          : { background: 'linear-gradient(90deg, rgba(245,158,11,0.95), rgba(249,115,22,0.95))', borderBottom: '1px solid rgba(245,158,11,0.3)' }
        }
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-white text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">🐣</span>
            <span className="font-semibold">早鳥首年 NT$990／月</span>
            <span className="hidden sm:inline opacity-90">・首 4 週限定 / 前 100 名</span>
            <span className="sm:hidden opacity-90 text-xs">・剩 {earlybirdSlotsTotal - earlybirdSlotsTaken} 名</span>
          </div>
          <button
            onClick={() => handleUpgrade('earlybird')}
            disabled={upgrading}
            className="flex-shrink-0 px-3 py-1 bg-white text-orange-600 font-semibold rounded-md hover:bg-orange-50 transition-all text-xs whitespace-nowrap disabled:opacity-50"
          >
            搶名額 →
          </button>
        </div>
      </div>

      {/* Header — dark 用 bg-black/50 + 白文字，light 維持 bg-white/60 */}
      <header className={`border-b backdrop-blur-xl ${
        isDark ? 'border-white/8 bg-black/50' : 'border-orange-100 bg-white/60'
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className={`w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md rounded-xl flex items-center justify-center ${
              isDark ? 'shadow-orange-900/50' : 'shadow-orange-200'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>優勢方舟數位行銷</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/showcase" className={`text-sm transition-colors ${
              isDark ? 'text-white/85 hover:text-orange-300' : 'text-slate-600 hover:text-slate-900'
            }`}>排行榜</Link>
            <Link to="/" className={`text-sm transition-colors ${
              isDark ? 'text-white/85 hover:text-orange-300' : 'text-slate-600 hover:text-slate-900'
            }`}>取得免費報告 →</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">

        {/* 標題 + 早鳥膠囊 */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={isDark
              ? { background: T.warn + '1f', border: `1px solid ${T.warn}55` }
              : { background: '#ffedd5', border: '1px solid #fed7aa' }
            }
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#10b981' }} />
            <span className="text-sm" style={isDark ? { color: T.warn } : { color: '#64748b' }}>
              早鳥優惠・首 4 週限定・前 100 名首年 NT$990／月
            </span>
          </div>
          {/* A1: 痛點問句 H1 取代「簡單透明的定價」 */}
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={isDark ? { color: T.text, letterSpacing: '-0.02em' } : { color: '#1e293b' }}
          >
            你的品牌，AI 推薦你嗎？
          </h1>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={isDark ? { color: T.textMid, lineHeight: 1.7 } : { color: '#64748b' }}
          >
            當客戶問
            <span className="font-semibold" style={{ color: '#10b981' }}> ChatGPT</span>、
            <span className="font-semibold" style={{ color: '#3b82f6' }}>Perplexity</span>、
            <span className="font-semibold" style={{ color: '#f59e0b' }}>Gemini</span>「該找哪一家」時，
            你的品牌名是否會被說出口？
            <br />
            <span className="text-base" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>
              優勢方舟用 1/10 顧問費用，24 小時自動監測你在 AI 答案中的曝光度
            </span>
          </p>

          {/* 月繳 / 年繳切換 */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span
              className="text-sm font-medium transition-colors"
              style={isDark
                ? { color: !isYearly ? T.text : T.textLow }
                : { color: !isYearly ? '#0f172a' : '#94a3b8' }
              }
            >月繳</span>
            <button
              onClick={() => setIsYearly(v => !v)}
              className="relative w-14 h-7 rounded-full transition-colors duration-300"
              style={{ background: isYearly ? T.aeo : T.orange }}
              aria-label="切換月繳/年繳"
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${
                  isYearly ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              className="text-sm font-medium transition-colors"
              style={isDark
                ? { color: isYearly ? T.text : T.textLow }
                : { color: isYearly ? '#0f172a' : '#94a3b8' }
              }
            >
              年繳
              <span
                className="ml-2 px-2 py-0.5 text-xs rounded-full"
                style={{ background: T.pass + '33', color: T.pass }}
              >省 {savedPercent}%・等於免費多用 {savedMonths} 個月</span>
            </span>
          </div>
        </div>

        {/* A5: 社會證明區 — 具體奇數提高可信度 */}
        <div className="mb-16">
          <div
            className="p-6 rounded-2xl border"
            style={isDark
              ? { background: 'rgba(255,255,255,0.02)', borderColor: T.cardBorder, backdropFilter: 'blur(12px)' }
              : { background: 'rgba(255,255,255,0.4)', borderColor: 'rgba(0,0,0,0.06)' }
            }
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: T.orange }}>{fmt(stats.brands)}</div>
                <div className="text-xs" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                  個品牌正在監測
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: T.aeo }}>{fmt(stats.reports)}</div>
                <div className="text-xs" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                  份 AI 能見度報告
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#18c590' }}>{fmt(stats.mentions)}</div>
                <div className="text-xs" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                  次品牌被 AI 主動提及
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: T.pass }}>{fmt(stats.scans)}</div>
                <div className="text-xs" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                  次累積 AI 掃描
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* A6+C2: 痛點教育區 — 破信念句 + 顧問價格錨點 + AI vs 傳統 SEO 命題對比 */}
        <div className="mb-16 grid md:grid-cols-3 gap-6">
          {/* 破信念句 */}
          <div
            className="p-6 rounded-2xl border"
            style={isDark
              ? { background: T.fail + '0d', borderColor: T.fail + '33', backdropFilter: 'blur(12px)' }
              : { background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.25)' }
            }
          >
            <div className="text-3xl mb-3">⚠️</div>
            <div className="font-bold text-lg mb-2" style={isDark ? { color: '#fca5a5' } : { color: '#dc2626' }}>
              你的 SEO 排名再好，AI 還是不認識你
            </div>
            <p className="text-sm leading-relaxed" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
              ChatGPT、Perplexity、Gemini 不看 Google 排名。它們有自己的「信任名單」——
              <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}>不在名單裡，再多廣告費也買不到推薦。</span>
            </p>
          </div>
          {/* 顧問價格錨點 */}
          <div
            className="p-6 rounded-2xl border"
            style={isDark
              ? { background: T.aeo + '0d', borderColor: T.aeo + '33', backdropFilter: 'blur(12px)' }
              : { background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.25)' }
            }
          >
            <div className="text-3xl mb-3">💰</div>
            <div className="font-bold text-lg mb-2" style={isDark ? { color: '#c4b5fd' } : { color: '#7c3aed' }}>
              SEO 顧問每月 NT$15,000–50,000
            </div>
            <p className="text-sm leading-relaxed" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
              傳統 SEO 顧問月費上看 NT$50,000，且只看 Google。優勢方舟用
              <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}> NT$1,490／月（1/10 價）</span>
              ，同時監測 SEO + AEO + GEO + AI 引用率。
            </p>
          </div>
          {/* 命題對比 */}
          <div
            className="p-6 rounded-2xl border"
            style={isDark
              ? { background: T.pass + '0d', borderColor: T.pass + '33', backdropFilter: 'blur(12px)' }
              : { background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.25)' }
            }
          >
            <div className="text-3xl mb-3">🎯</div>
            <div className="font-bold text-lg mb-2" style={isDark ? { color: '#86efac' } : { color: '#059669' }}>
              傳統 vs AI 時代問法
            </div>
            <ul className="text-sm space-y-2 leading-relaxed" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
              <li>
                <span className="text-xs" style={{ color: T.textLow }}>Ahrefs 回答：</span>
                <br />「你的網站排第幾名」
              </li>
              <li>
                <span className="text-xs" style={{ color: '#86efac' }}>優勢方舟回答：</span>
                <br /><span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}>「AI 推薦的是你，還是你的對手」</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 方案卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">

          {/* 免費版 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span
                className="px-4 py-1 text-xs font-bold rounded-full"
                style={isDark
                  ? { background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.cardBorder}`, color: T.textMid }
                  : { background: '#ffedd5', border: '1px solid #fed7aa', color: '#64748b' }
                }
              >免費取得 3 次分析</span>
            </div>
            {isDark ? (
              <GlassCard style={{ padding: 32, display: 'flex', flexDirection: 'column', flex: 1 }}>
                <FreeCardBody />
              </GlassCard>
            ) : (
              <div className="p-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex flex-col flex-1">
                <FreeCardBody />
              </div>
            )}
          </div>

          {/* Pro 版 — 主推, 用 T.aeo (#8b5cf6 紫) 邊框強調 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span className="px-4 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full shadow-lg shadow-purple-500/30">最多人選擇</span>
            </div>
            {isDark ? (
              <GlassCard color={T.aeo} hover style={{ padding: 32, display: 'flex', flexDirection: 'column', flex: 1, borderWidth: 2, borderColor: T.aeo + '55' }}>
                <ProCardBody
                  isYearly={isYearly}
                  proMonthly={proMonthly}
                  proYearly={proYearly}
                  proYearlyPerMonth={proYearlyPerMonth}
                  savedAmount={savedAmount}
                  savedMonths={savedMonths}
                  isPro={isPro}
                  isTrial={isTrial}
                  trialDaysRemaining={trialDaysRemaining}
                  hasTrialedBefore={hasTrialedBefore}
                  upgrading={upgrading}
                  startingTrial={startingTrial}
                  onUpgrade={handleUpgrade}
                  onStartTrial={handleStartTrial}
                  isDark
                />
              </GlassCard>
            ) : (
              <div className="p-8 bg-gradient-to-b from-purple-100 to-blue-50 rounded-2xl border border-purple-300 flex flex-col flex-1">
                <ProCardBody
                  isYearly={isYearly}
                  proMonthly={proMonthly}
                  proYearly={proYearly}
                  proYearlyPerMonth={proYearlyPerMonth}
                  savedAmount={savedAmount}
                  savedMonths={savedMonths}
                  isPro={isPro}
                  isTrial={isTrial}
                  trialDaysRemaining={trialDaysRemaining}
                  hasTrialedBefore={hasTrialedBefore}
                  upgrading={upgrading}
                  startingTrial={startingTrial}
                  onUpgrade={handleUpgrade}
                  onStartTrial={handleStartTrial}
                  isDark={false}
                />
              </div>
            )}
          </div>

          {/* Agency 版 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span
                className="px-4 py-1 text-xs font-bold rounded-full"
                style={isDark
                  ? { background: 'rgba(255,255,255,0.06)', border: `1px solid ${T.cardBorder}`, color: T.textLow }
                  : { background: '#ffedd5', border: '1px solid #fed7aa', color: '#64748b' }
                }
              >即將推出</span>
            </div>
            {isDark ? (
              <GlassCard style={{ padding: 32, display: 'flex', flexDirection: 'column', flex: 1, opacity: 0.7 }}>
                <AgencyCardBody isDark />
              </GlassCard>
            ) : (
              <div className="p-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex flex-col flex-1">
                <AgencyCardBody isDark={false} />
              </div>
            )}
          </div>
        </div>

        {/* aivis 已含在 Pro 核心 — 每月 150 次，超量才賣 Top-up（青綠色 #18c590 與 aivis 模組一致） */}
        <div
          className="mb-12 p-8 rounded-2xl border"
          style={isDark
            ? { background: 'rgba(24,197,144,0.06)', borderColor: 'rgba(24,197,144,0.35)', backdropFilter: 'blur(16px)' }
            : { background: 'rgba(24,197,144,0.05)', borderColor: 'rgba(24,197,144,0.3)' }
          }
        >
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-2xl">🎯</span>
                <span className="font-bold text-lg" style={{ color: '#18c590' }}>AI 曝光監測（aivis）已含在 Pro 中</span>
                <span
                  className="px-2 py-0.5 text-xs rounded-full border"
                  style={{ background: 'rgba(24,197,144,0.18)', color: '#86efac', borderColor: 'rgba(24,197,144,0.4)' }}
                >每月 {aivisIncludedPerMonth} 次</span>
              </div>
              {/* aivis 強化金句 */}
              <p
                className="text-base font-semibold mb-3"
                style={isDark ? { color: T.text, lineHeight: 1.6 } : { color: '#1e293b' }}
              >
                不是「你覺得你有曝光」，是 AI 親口說出你的名字
              </p>
              <p
                className="text-sm max-w-2xl"
                style={isDark ? { color: T.textMid, lineHeight: 1.7 } : { color: '#64748b' }}
              >
                Pro 訂閱每月內含 <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}>{aivisIncludedPerMonth} 次 AI 引用率實測</span>，足以追蹤單一品牌 10–15 個核心關鍵字。SEO 修復是一次性的，但 AI 在持續更新、競爭對手在持續優化—— aivis 每月幫你看 ChatGPT、Perplexity、Claude 是否還推薦你。
              </p>
            </div>

            {/* 真實 AI 結果展示（佔位） */}
            <div
              className="p-5 rounded-xl border"
              style={isDark
                ? { background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(24,197,144,0.25)' }
                : { background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(24,197,144,0.25)' }
              }
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className="px-2 py-0.5 text-xs rounded-full"
                  style={{ background: '#3b82f6' + '26', color: '#93c5fd', border: '1px solid ' + '#3b82f6' + '40' }}
                >Perplexity 實測</span>
                <span className="text-xs" style={{ color: T.textLow }}>查詢：「台北推薦的數位行銷公司」</span>
              </div>
              <div
                className="p-4 rounded-lg text-sm leading-relaxed"
                style={isDark
                  ? { background: 'rgba(255,255,255,0.03)', color: T.textMid, border: `1px solid ${T.cardBorder}` }
                  : { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }
                }
              >
                根據近期搜尋結果，台北幾家受推薦的數位行銷公司包含：
                <span
                  className="inline-block mx-1 px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: '#18c590' + '33', color: '#18c590' }}
                >優勢方舟數位行銷</span>
                （專注 AI 能見度監測）、A 公司、B 公司⋯⋯
                <span className="inline-block mt-2 text-xs" style={{ color: T.textLow }}>
                  — 這就是 aivis 每天幫你監測的「真實 AI 答案」
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* C2: 競品比較簡表 — Ahrefs/SEMrush vs 優勢方舟 */}
        <div
          className="mb-12 p-6 md:p-8 rounded-2xl border"
          style={isDark
            ? { background: 'rgba(255,255,255,0.02)', borderColor: T.cardBorder, backdropFilter: 'blur(12px)' }
            : { background: 'rgba(255,255,255,0.5)', borderColor: 'rgba(0,0,0,0.08)' }
          }
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2" style={isDark ? { color: T.text } : { color: '#1e293b' }}>
              為什麼不用 Ahrefs / SEMrush 就好？
            </h2>
            <p className="text-sm" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
              它們是 Google 時代的工具，回答的是「你的網站排第幾名」；AI 時代客戶問的是「該找哪一家」
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? T.cardBorder : 'rgba(0,0,0,0.08)'}` }}>
                  <th className="text-left py-3 px-3 font-semibold" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>比較項目</th>
                  <th className="text-center py-3 px-3 font-semibold" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>Ahrefs / SEMrush</th>
                  <th className="text-center py-3 px-3 font-semibold" style={{ color: T.orange }}>優勢方舟</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="py-3 px-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>主要回答的問題</td>
                  <td className="text-center py-3 px-3" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>你的網站排第幾名？</td>
                  <td className="text-center py-3 px-3 font-semibold" style={{ color: T.pass }}>AI 推薦的是你還是對手？</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="py-3 px-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>監測來源</td>
                  <td className="text-center py-3 px-3" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>Google 搜尋結果</td>
                  <td className="text-center py-3 px-3 font-semibold" style={{ color: T.pass }}>ChatGPT / Perplexity / Claude 真實答案</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="py-3 px-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>修復建議</td>
                  <td className="text-center py-3 px-3" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>關鍵字策略（需另請工程師）</td>
                  <td className="text-center py-3 px-3 font-semibold" style={{ color: T.pass }}>修復碼直接複製 + 平台別指南</td>
                </tr>
                <tr style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                  <td className="py-3 px-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>使用語言</td>
                  <td className="text-center py-3 px-3" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>英文介面</td>
                  <td className="text-center py-3 px-3 font-semibold" style={{ color: T.pass }}>繁中原生</td>
                </tr>
                <tr>
                  <td className="py-3 px-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>月費</td>
                  <td className="text-center py-3 px-3" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>USD $99–449（NT$3,000–14,000）</td>
                  <td className="text-center py-3 px-3 font-semibold" style={{ color: T.pass }}>NT$1,490／月</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 早鳥方案 — 4 週時限 + 100 名 progress bar + 首年 990 */}
        <div
          className="mb-16 p-8 rounded-2xl border"
          style={isDark
            ? { background: T.warn + '0d', borderColor: T.warn + '4d', backdropFilter: 'blur(16px)' }
            : { background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.3)' }
          }
        >
          <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-2xl">🐣</span>
                  <span className="font-bold text-lg" style={{ color: T.warn }}>早鳥優惠・首 4 週限定</span>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full border"
                    style={{ background: T.warn + '33', color: T.warn, borderColor: T.warn + '55' }}
                  >前 100 名</span>
                </div>
                <p
                  className="text-sm max-w-xl"
                  style={isDark ? { color: T.textMid, lineHeight: 1.7 } : { color: '#64748b' }}
                >
                  正式上線起 4 週內、前 100 名付費用戶享 <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}>首年 NT$990／月（年繳 NT${earlybirdYearly.toLocaleString()}）</span>，
                  次年續訂自動恢復一般年費 NT${proYearly.toLocaleString()}。
                </p>
              </div>
              <button
                onClick={() => handleUpgrade('earlybird')}
                disabled={upgrading}
                className="flex-shrink-0 px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/25 whitespace-nowrap disabled:opacity-50">
                {upgrading ? '處理中...' : '搶早鳥首年 NT$990'}
              </button>
            </div>

            {/* 100 名進度條 — earlybirdSlotsTaken 來自後端統計（目前先寫 0） */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2" style={{ color: isDark ? T.textMid : '#64748b' }}>
                <span>名額進度</span>
                <span style={{ fontWeight: 600 }}>{earlybirdSlotsTaken} / {earlybirdSlotsTotal} 名</span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(2, (earlybirdSlotsTaken / earlybirdSlotsTotal) * 100)}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl font-bold text-center mb-8"
            style={isDark ? { color: T.text } : { color: '#1e293b' }}
          >常見問題</h2>
          <PricingFAQ items={FAQ_ITEMS} isDark={isDark} />
        </div>

        {/* C5: 底部雙路 CTA — 品牌主 / 顧問代理商 兩條路徑 */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-3" style={isDark ? { color: T.text } : { color: '#1e293b' }}>
              準備好讓 AI 看見你了嗎？
            </h2>
            <p style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
              選擇最適合你的開始方式
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* 路徑一：品牌主 — 免費開始檢測 */}
            <div
              className="p-8 rounded-2xl border-2 text-center"
              style={isDark
                ? { background: T.orange + '0d', borderColor: T.orange + '4d', backdropFilter: 'blur(16px)' }
                : { background: 'rgba(249,115,22,0.05)', borderColor: 'rgba(249,115,22,0.3)' }
              }
            >
              <div className="text-3xl mb-3">🏢</div>
              <div className="text-xs font-semibold mb-2" style={{ color: T.orange, letterSpacing: '0.08em' }}>
                品牌主・自己經營
              </div>
              <h3 className="text-xl font-bold mb-2" style={isDark ? { color: T.text } : { color: '#1e293b' }}>
                免費開始檢測你的品牌
              </h3>
              <p className="text-sm mb-6" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                60 秒輸入網址，立刻看到 AI 引擎眼中的你。不需信用卡。
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/30"
              >
                立即免費檢測 →
              </Link>
            </div>
            {/* 路徑二：顧問／代理商 — 洽談 Agency */}
            <div
              className="p-8 rounded-2xl border-2 text-center"
              style={isDark
                ? { background: T.aeo + '0d', borderColor: T.aeo + '4d', backdropFilter: 'blur(16px)' }
                : { background: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.3)' }
              }
            >
              <div className="text-3xl mb-3">🤝</div>
              <div className="text-xs font-semibold mb-2" style={{ color: T.aeo, letterSpacing: '0.08em' }}>
                顧問／行銷代理商
              </div>
              <h3 className="text-xl font-bold mb-2" style={isDark ? { color: T.text } : { color: '#1e293b' }}>
                Agency 方案・即將推出
              </h3>
              <p className="text-sm mb-6" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
                白標報告 + 多客戶工作區 + 優先客服。預先洽談取得早期合作優惠。
              </p>
              <a
                href="mailto:hello@aark.com.tw?subject=Agency%20%E6%96%B9%E6%A1%88%E6%B4%BD%E8%AB%87"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all shadow-lg shadow-purple-500/30"
              >
                洽談 Agency 合作 →
              </a>
            </div>
          </div>
        </div>

      </main>
      </div>

      {/* C6: Sticky bottom CTA — mobile 漂浮按鈕（已是 Pro 用戶不顯示） */}
      {!isPro && (
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-md p-3"
          style={isDark
            ? { background: 'rgba(0,0,0,0.85)', borderTop: `1px solid ${T.cardBorder}` }
            : { background: 'rgba(255,255,255,0.95)', borderTop: '1px solid rgba(0,0,0,0.08)' }
          }
        >
          <button
            onClick={() => (hasTrialedBefore ? handleUpgrade(isYearly ? 'yearly' : 'monthly') : handleStartTrial())}
            disabled={upgrading || startingTrial}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50"
          >
            {(upgrading || startingTrial)
              ? '處理中...'
              : hasTrialedBefore
                ? `立即升級 · NT$${isYearly ? proYearlyPerMonth.toLocaleString() : proMonthly.toLocaleString()}／月`
                : `免費試用 7 天 · NT$${isYearly ? proYearlyPerMonth.toLocaleString() : proMonthly.toLocaleString()}／月`}
          </button>
          <p className="text-xs text-center mt-1" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>
            🔒 不收信用卡 · ↩ 隨時取消
          </p>
        </div>
      )}

      <Footer />
    </div>
  )

  // ──────────────────────────────────────────────
  // 卡片內部子元件 — 共用 dark/light 結構，靠 isDark 判斷顏色
  // ──────────────────────────────────────────────
  function FreeCardBody() {
    return (
      <>
        <div className="mb-6">
          <div
            className="text-sm font-medium mb-2"
            style={isDark ? { color: T.textMid } : { color: '#64748b' }}
          >免費版</div>
          <div className="flex items-end gap-2 mb-1">
            <span
              className="text-4xl font-bold"
              style={isDark ? { color: T.text } : { color: '#1e293b' }}
            >NT$0</span>
          </div>
          <p
            className="text-sm"
            style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}
          >永久免費，無需信用卡</p>
        </div>

        <ul className="space-y-3 flex-1 mb-8">
          {FEATURES_FREE.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm"
              style={isDark ? { color: T.textMid } : { color: '#64748b' }}
            >
              <span className="mt-0.5 flex-shrink-0" style={{ color: T.pass }}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        <Link
          to="/"
          className="w-full py-3 text-center rounded-xl font-medium block transition-all"
          style={isDark
            ? { background: T.orange + '1a', border: `1px solid ${T.orange}55`, color: T.orange }
            : { background: '#ffedd5', border: '1px solid #fed7aa', color: '#1e293b' }
          }
        >
          立即取得 3 個免費分析額度
        </Link>
      </>
    )
  }

  function AgencyCardBody({ isDark: dark }) {
    return (
      <>
        <div className="mb-6">
          <div
            className="text-sm font-medium mb-2"
            style={dark ? { color: T.textMid } : { color: '#64748b' }}
          >Agency 方案</div>
          <div className="flex items-end gap-2 mb-1">
            <span
              className="text-4xl font-bold"
              style={dark ? { color: T.textMid } : { color: '#94a3b8' }}
            >NT$4,990</span>
            <span
              className="text-sm mb-1"
              style={dark ? { color: T.textLow } : { color: '#94a3b8' }}
            >／月起</span>
          </div>
          <p
            className="text-sm"
            style={dark ? { color: T.textLow } : { color: '#94a3b8' }}
          >適合行銷公司、設計工作室・含完整白標</p>
        </div>

        <ul className="space-y-3 flex-1 mb-8">
          {FEATURES_AGENCY.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm"
              style={dark ? { color: T.textLow } : { color: '#94a3b8' }}
            >
              <span className="mt-0.5 flex-shrink-0" style={{ color: dark ? T.textLow : '#cbd5e1' }}>✓</span>
              {f}
            </li>
          ))}
        </ul>

        <button
          disabled
          className="w-full py-3 rounded-xl cursor-not-allowed font-medium border"
          style={dark
            ? { background: 'rgba(255,255,255,0.04)', borderColor: T.cardBorder, color: T.textLow }
            : { background: '#ffedd5', borderColor: '#fed7aa', color: '#94a3b8' }
          }
        >
          候補通知（即將推出）
        </button>
      </>
    )
  }
}

// Pro 卡片內部 — 拉到外層（避免 closures 在 render 中重新建立）
function ProCardBody({ isYearly, proMonthly, proYearly, proYearlyPerMonth, savedAmount, savedMonths, isPro, isTrial, trialDaysRemaining, hasTrialedBefore, upgrading, startingTrial, onUpgrade, onStartTrial, isDark }) {
  return (
    <>
      <div className="mb-6">
        <div className="text-sm font-medium mb-2" style={{ color: T.aeo }}>Pro 方案</div>
        {isYearly ? (
          <>
            <div className="flex items-end gap-2 mb-1">
              <span
                className="text-4xl font-bold"
                style={isDark ? { color: T.text } : { color: '#1e293b' }}
              >NT${proYearlyPerMonth.toLocaleString()}</span>
              <span
                className="text-sm mb-1"
                style={isDark ? { color: T.textMid } : { color: '#64748b' }}
              >／月</span>
            </div>
            <p
              className="text-sm"
              style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}
            >年繳 NT${proYearly.toLocaleString()}（省 NT${savedAmount.toLocaleString()}・等於免費多用 {savedMonths} 個月）</p>
          </>
        ) : (
          <>
            <div className="flex items-end gap-2 mb-1">
              <span
                className="text-4xl font-bold"
                style={isDark ? { color: T.text } : { color: '#1e293b' }}
              >NT${proMonthly.toLocaleString()}</span>
              <span
                className="text-sm mb-1"
                style={isDark ? { color: T.textMid } : { color: '#64748b' }}
              >／月</span>
            </div>
            <p
              className="text-sm"
              style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}
            >隨時取消，無綁約</p>
          </>
        )}

        {/* 7 天免費試用 + 退款保證 雙膠囊 */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span
            className="px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5"
            style={{ background: T.pass + '26', color: T.pass, border: `1px solid ${T.pass}40` }}
          >
            ✨ 7 天免費試用
          </span>
          {isYearly && (
            <span
              className="px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5"
              style={{ background: T.seo + '26', color: '#93c5fd', border: `1px solid ${T.seo}40` }}
            >
              🛡 14 天無條件退款
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-3 flex-1 mb-4">
        {FEATURES_PRO.map((f, i) => {
          const isLast = i === FEATURES_PRO.length - 1
          return (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm"
              style={isDark
                ? { color: isLast ? T.textLow : T.text }
                : { color: isLast ? '#94a3b8' : '#1e293b' }
              }
            >
              <span
                className="mt-0.5 flex-shrink-0"
                style={{ color: isLast ? (isDark ? T.textLow : '#94a3b8') : T.aeo }}
              >✓</span>
              {f}
            </li>
          )
        })}
      </ul>

      {/* C7: 平台支援現況 — 已上線 Claude，其他即將推出 */}
      <div
        className="mb-6 p-3 rounded-lg border"
        style={isDark
          ? { background: 'rgba(255,255,255,0.04)', borderColor: T.cardBorder }
          : { background: 'rgba(255,255,255,0.5)', borderColor: 'rgba(0,0,0,0.08)' }
        }
      >
        <div className="text-xs font-semibold mb-2" style={isDark ? { color: T.textMid } : { color: '#64748b' }}>
          AI 曝光監測支援平台
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className="px-2 py-0.5 text-xs rounded inline-flex items-center gap-1"
            style={{ background: T.pass + '26', color: T.pass, border: `1px solid ${T.pass}40` }}
          >✓ Claude</span>
          <span
            className="px-2 py-0.5 text-xs rounded inline-flex items-center gap-1"
            style={isDark
              ? { background: 'rgba(255,255,255,0.04)', color: T.textLow, border: `1px solid ${T.cardBorder}` }
              : { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
            }
          >ChatGPT・即將推出</span>
          <span
            className="px-2 py-0.5 text-xs rounded inline-flex items-center gap-1"
            style={isDark
              ? { background: 'rgba(255,255,255,0.04)', color: T.textLow, border: `1px solid ${T.cardBorder}` }
              : { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
            }
          >Perplexity・即將推出</span>
          <span
            className="px-2 py-0.5 text-xs rounded inline-flex items-center gap-1"
            style={isDark
              ? { background: 'rgba(255,255,255,0.04)', color: T.textLow, border: `1px solid ${T.cardBorder}` }
              : { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
            }
          >Gemini・即將推出</span>
        </div>
      </div>

      {isPro && isTrial ? (
        // 試用中 — 顯示倒數 + 引導到 Account 管理（轉訂閱）
        <div className="space-y-2">
          <div
            className="w-full py-3 text-center rounded-xl font-semibold border"
            style={{ background: T.pass + '33', color: T.pass, borderColor: T.pass + '4d' }}
          >
            ✨ 試用中・剩 {trialDaysRemaining ?? 0} 天
          </div>
          <Link
            to="/account"
            className="block w-full py-2 text-center text-xs transition-colors"
            style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}
          >
            管理訂閱 →
          </Link>
        </div>
      ) : isPro ? (
        <div className="space-y-2">
          <div
            className="w-full py-3 text-center rounded-xl font-semibold border"
            style={{ background: T.pass + '33', color: T.pass, borderColor: T.pass + '4d' }}
          >
            ✓ 目前方案
          </div>
          <Link
            to="/account"
            className="block w-full py-2 text-center text-xs transition-colors"
            style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}
          >
            管理訂閱 →
          </Link>
        </div>
      ) : (
        // 未試用過 → 顯示「免費試用 7 天」直接啟動試用；試用過 → 顯示「立即升級」走付款
        <div className="space-y-3">
          <button
            onClick={() => (hasTrialedBefore ? onUpgrade(isYearly ? 'yearly' : 'monthly') : onStartTrial())}
            disabled={upgrading || startingTrial}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all font-semibold shadow-lg shadow-purple-500/25 disabled:opacity-50">
            {(upgrading || startingTrial)
              ? '處理中...'
              : hasTrialedBefore
                ? `立即升級 Pro · NT$${(isYearly ? proYearlyPerMonth : proMonthly).toLocaleString()}／月`
                : '免費試用 7 天'}
          </button>
          {/* A7+C8: 信任三件組 + 退款情緒承諾 */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={isDark ? { color: T.textLow } : { color: '#94a3b8' }}>
            <span className="inline-flex items-center gap-1">🔒 不收信用卡</span>
            <span className="inline-flex items-center gap-1">⚡ 60 秒開通</span>
            <span className="inline-flex items-center gap-1">↩ 隨時取消</span>
          </div>
          <p
            className="text-xs text-center font-medium"
            style={{ color: T.pass }}
          >
            🛡 不滿意，一毛都不用付
          </p>
        </div>
      )}
    </>
  )
}
