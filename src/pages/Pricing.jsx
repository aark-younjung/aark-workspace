import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AgencyWaitlistModal from '../components/v2/AgencyWaitlistModal'
import SiteHeader from '../components/lightsite/SiteHeader'
import SiteFooter from '../components/lightsite/SiteFooter'
import '../styles/lightsite.css'
import '../styles/pricing-light.css'

/**
 * 定價頁（亮色版）— 2026-08-26 全面重做，不再吃 isDark 分支（同 FAQ.jsx 手法）。
 * 業務邏輯（state / effect / handleUpgrade / handleStartTrial / NewebPay 表單送出）
 * 逐字保留，只換視覺層——這頁碰真金流，不冒險動邏輯。
 * 內容順手修正「Perplexity」三引擎政策違規措辭（5 處）。
 */
const FEATURES_FREE = [
  '追蹤最多 3 個網站',
  'SEO / AEO / GEO / E-E-A-T 5 大面向分數',
  '通過 / 不通過項目清單',
  'AI 優化建議（3 條優先處理項目）',
  '基礎修復碼產生器（llms.txt / JSON-LD / FAQ Schema 通用模板）',
  '文章內容分析（基本版）',
  '競品比較（2 個網站）',
  '公開排行榜',
]

const FEATURES_PRO = [
  '追蹤最多 15 個網站',
  'AI 優化建議完整版（5 條優先處理項目）',
  '平台別修復指南（WordPress / Shopify / Wix / HTML 各別整合教學）',
  '歷史趨勢圖（追蹤每次優化成效）',
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

const FAQ_ITEMS = [
  {
    tag: '取消／退款焦慮',
    tagColor: '#dc2626',
    q: '可以隨時取消嗎？退款怎麼算？',
    a: '可以。年繳方案享 14 天無條件退款保證，期限內取消可全額退費；超過 14 天則繼續使用至期滿後降為免費版。月繳定期定額方案正在串接中，預計上線後 1-2 週內開放。',
  },
  {
    tag: '試用流程焦慮',
    tagColor: '#059669',
    q: '7 天免費試用是怎麼運作的？',
    a: 'Pro 全功能免費試用 7 天，aivis 試用期間上限 50 次（避免被刷）。試用結束前可隨時取消不收費；若決定續訂，年費方案再加 14 天無條件退款保證。不需信用卡綁定即可開始。',
  },
  {
    tag: '產品差異焦慮',
    tagColor: '#7c3aed',
    q: '免費版和 Pro 版最大的差別是什麼？',
    a: '免費版讓你看到「哪裡有問題」，Pro 版告訴你「怎麼修」+「持續監測」。包含逐項修復建議、修復碼產生器（可直接複製 llms.txt / JSON-LD / FAQ Schema）、歷史趨勢圖、平台別修復指南，以及每月 150 次 AI 曝光監測（aivis）— 直接呼叫 ChatGPT / Claude / Gemini 看你的品牌是否還在 AI 推薦名單裡。',
  },
  {
    tag: '競品焦慮',
    tagColor: '#b45309',
    q: '跟 Ahrefs / SEMrush 比，差別在哪裡？',
    a: 'Ahrefs 與 SEMrush 是 Google 時代的工具，回答的是「你在搜尋結果排第幾名」；AI 雷達回答的是「ChatGPT、Claude、Gemini 推薦的是你還是對手」。我們直接呼叫 AI API 用真實使用者問法測試你的品牌曝光，並提供修復碼可直接複製、平台別指南（WordPress / Shopify / Wix / HTML），月費 NT$1,490 大約是 Ahrefs Lite 方案的 1/3，且原生繁中介面。',
  },
  {
    tag: '認知焦慮',
    tagColor: '#2563eb',
    q: 'AEO / GEO 是什麼？跟一般 SEO 有什麼不同？',
    a: 'SEO 是讓 Google 搜尋找到你，AEO（Answer Engine Optimization）是讓 ChatGPT、Claude、Gemini 等 AI 問答引擎引用你的內容，GEO（Generative Engine Optimization）是讓生成式 AI 在回答時主動提及你的品牌。這是 AI 搜尋時代必備的新指標。',
  },
  {
    tag: 'aivis 焦慮',
    tagColor: '#059669',
    q: 'AI 曝光監測（aivis）是什麼？跟 AEO 有什麼差別？',
    a: 'AEO 是「靜態檢測」— 檢查網站結構是否適合被 AI 引用；aivis 是「動態監測」— 直接呼叫 ChatGPT / Claude / Gemini API 用真實使用者的問法，看 AI 是否會推薦你的品牌。Pro 訂閱每月內含 150 次查詢額度（aivis 不單獨販售），這是 Pro 持續訂閱的核心價值 — SEO 改完是有限的事，但 AI 引用率天天在變、競爭對手也天天在優化。若用量接近上限，系統會在 dashboard 通知你，可選擇加購額外次數包繼續使用。',
  },
  {
    tag: 'Agency 等待焦慮',
    tagColor: '#db2777',
    q: 'Agency 方案什麼時候推出？',
    a: '預計 2026 年中推出，月費 NT$4,990 起，含 50 站追蹤、完整白標、多客戶工作區、優先客服支援。如果你是行銷公司或設計工作室，歡迎先用 Pro 方案，Agency 推出時會優先通知。',
  },
]

// FAQ 折疊項（原生 <details>，同 HomeLight/FAQ.jsx 手法）
function PricingFAQ({ items }) {
  return (
    <div className="pf-list">
      {items.map((item, i) => (
        <details className="pf-item" key={i}>
          <summary>
            <div>
              {item.tag && <span className="pf-tag" style={{ color: item.tagColor, background: item.tagColor + '1a', borderColor: item.tagColor + '40' }}>{item.tag}</span>}
              <div className="pf-q">{item.q}</div>
            </div>
            <span className="pf-arrow" aria-hidden="true">↓</span>
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  )
}

export default function Pricing() {
  // 預設年繳（CTA 主推年繳的省錢敘事）；NPA 串接完成後重開月繳分支供用戶切換
  const [isYearly, setIsYearly] = useState(true)
  const { user, isPro, isTrial, hasTrialedBefore, trialDaysRemaining, startTrial, fetchProfile } = useAuth()
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
  // Top-up 規格（後端 / dashboard 實作時參考）— 2026-06-13 改價（三引擎接地後成本 ~NT$5/次）：
  //   - 小包：NT$490 / +40 次（每次 NT$12.25，補檔用）
  //   - 大包：NT$990 / +100 次（每次 NT$9.9，對齊 Pro 隱含單價 1490/150）
  //   - 一次性購買、不過期、用完為止、不綁訂閱
  //   - 每月查詢硬上限 1,000 次（內含 + Top-up 合計），Agency 推出後解除
  const aivisIncludedPerMonth = 150

  // A5 社會證明 KPI：上線前必修項，從 /api/public?action=stats 拉真實聚合數字
  // 走後端 service role 而非前端直查 Supabase — 訪客 anon role 對 user-scoped 表的 RLS 會拿到 0
  // 載入中 / 失敗顯示 '—'，避免假數字外露被質疑
  // earlybird_taken 同源 — Pricing 早鳥進度條也吃這個（已售 N / 100 名動態顯示）
  // 2026-05-23：原 /api/public-stats 合併進 /api/public（Vercel Hobby 12 function 限制）
  const [stats, setStats] = useState({ brands: null, reports: null, mentions: null, scans: null, earlybird_taken: null })
  useEffect(() => {
    let cancelled = false
    fetch('/api/public?action=stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setStats(d) })
      .catch(() => { /* 失敗就維持 null → 顯示 — */ })
    return () => { cancelled = true }
  }, [])

  // Pricing mount 時主動 refetch profile — 避免用戶將刺小金流跛回後導航到 /pricing，
  // isPro 從 AuthContext cache 讀到舊値（false）導致按鈕狀態錯誤。
  // 只在 user 存在時執行一次，不會再觸發（進入頁面後 user.id 不會變）。
  useEffect(() => {
    if (user) fetchProfile(user.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—')
  // 早鳥已售名額：API 回 null 則 fallback 0（避免進度條跑掉），用於三處 UI（top bar 剩餘 / 進度條 / 文案）
  const earlybirdSlotsTaken = stats.earlybird_taken ?? 0
  // 早鳥仍有名額 → Pro 卡顯示劃線價 + 990 + 進度條，CTA 走 earlybird endpoint
  // 已售完 → Pro 卡顯示一般年繳 NT$1,158／月，CTA 走 yearly endpoint
  // 這個旗標讓三處 UI 一鍵切換（Sticky bar / Hero 膠囊 / Pro 卡 / Mobile CTA）
  const earlybirdAvailable = earlybirdSlotsTaken < earlybirdSlotsTotal

  // NewebPay 跳回 returnUrl 帶 ?pro_success={yearly|earlybird} — 顯示「✓ 升級成功」toast
  // 入帳是非同步走 notify URL 寫 DB（profile.is_pro 可能還沒刷到），toast 只是給用戶即時心理確認
  // 顯示後立刻清掉 query string 防重整再彈、6 秒後自動消失
  // 同步 refetch profile：notify 已把 is_pro 寫成 true，不主動 refetch 的話 isPro 不會更新、
  // Pro 卡按鈕還會卡在「升級」狀態（用戶要手動 reload 才看到「目前方案」）
  const [proSuccessPlan, setProSuccessPlan] = useState(null)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const plan = params.get('pro_success')
    if (plan === 'yearly' || plan === 'earlybird' || plan === 'monthly') {
      setProSuccessPlan(plan)
      navigate(location.pathname, { replace: true })
      if (user) fetchProfile(user.id)
      const t = setTimeout(() => setProSuccessPlan(null), 6000)
      return () => clearTimeout(t)
    }
  }, [location.search, location.pathname, navigate, user, fetchProfile])

  const [upgrading, setUpgrading] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)
  // 2026-06-09：Agency 方案籌備中、用 modal 收候補名單而非 disabled 按鈕（card button + 底部 CTA 都打開這個 modal）
  const [agencyWaitlistOpen, setAgencyWaitlistOpen] = useState(false)

  // 啟動 7 天免費試用 — 只給「已登入但從未試用過、也不是 Pro」的用戶
  // 其他情境：未登入 → /register、已試用過 → 走付款流程、已是 Pro → 回首頁
  const handleStartTrial = async () => {
    if (!user) { navigate('/register'); return }
    if (isPro) { navigate('/'); return }
    if (hasTrialedBefore) {
      // 試用次數用過了，引導去付費（Phase 1 上線只開放年繳，月繳定期定額待 NPA 串接後開放）
      return handleUpgrade('yearly')
    }
    setStartingTrial(true)
    try {
      const result = await startTrial()
      if (result?.ok) {
        // 成功啟動 — 導向首頁讓他立刻試用 Pro 功能
        navigate('/')
      } else if (result?.error === 'already_trialed') {
        alert('您已經啟用過 7 天試用了，請選擇付費方案繼續使用 Pro 功能')
        await handleUpgrade('yearly')
      } else if (result?.error === 'already_pro') {
        navigate('/')
      } else {
        alert('啟動試用失敗，請稍後再試或聯絡客服')
      }
    } finally {
      setStartingTrial(false)
    }
  }

  const handleUpgrade = async (priceType = 'yearly') => {
    if (!user) { navigate('/register'); return }
    // 2026-06-08 bugfix：原本 `if (isPro)` 連試用中用戶也擋掉（trial 也算 isPro）、
    // 導致想轉成付費 Pro 的試用用戶按按鈕就跳 /account、永遠拿不到早鳥價。
    // 改成只擋「已付費 Pro 且不在試用中」、試用中用戶可走付款流程把試用轉成早鳥年繳。
    if (isPro && !isTrial) { navigate('/account'); return }
    // earlybird/yearly = MPG 一次性；monthly = NPA 定期定額（後端走 /MPG/period）
    const plan = priceType === 'earlybird' ? 'earlybird' : (priceType === 'monthly' ? 'monthly' : 'yearly')
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout-pro-yearly-newebpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          plan,
          returnUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (res.status === 409 || data.error === 'already_subscribed') {
        // 後端守門捕到重複訂閱— 主動 refetch profile 再導向帳號頁
        if (user) await fetchProfile(user.id)
        navigate('/account')
        return
      }
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
    } catch {
      alert('連線失敗，請稍後再試')
      setUpgrading(false)
    }
  }

  const mobileCtaLabel = (upgrading || startingTrial)
    ? '處理中...'
    : !hasTrialedBefore
      ? `免費試用 7 天 · NT$${(isYearly && earlybirdAvailable ? 990 : (isYearly ? proYearlyPerMonth : proMonthly)).toLocaleString()}／月`
      : isYearly && earlybirdAvailable
        ? '搶早鳥首年 NT$990／月'
        : `立即升級 · NT$${isYearly ? proYearlyPerMonth.toLocaleString() : proMonthly.toLocaleString()}／月`

  return (
    <div className="ls-page pricing-light">
      {/* NewebPay 付款完成跳回 — 升級成功 toast（右上 fixed，6 秒後自動消失）
          入帳走非同步 notify，profile 可能 1-30 秒後才刷到 is_pro=true；toast 只給即時心理確認 */}
      {proSuccessPlan && (
        <div className="pr-toast" role="status">
          <span className="ic" aria-hidden="true">✓</span>
          <div>
            <div className="t">
              {proSuccessPlan === 'earlybird' ? '🐣 早鳥首年購買成功！'
                : proSuccessPlan === 'monthly' ? '✨ Pro 月繳訂閱成功！'
                : '✨ Pro 年繳升級成功！'}
            </div>
            <div className="d">付款已送出，系統入帳處理中。Pro 功能將於數十秒內全部解鎖，可重整頁面確認方案徽章。</div>
          </div>
          <button onClick={() => setProSuccessPlan(null)} aria-label="關閉">×</button>
        </div>
      )}

      {/* C3: Sticky 早鳥 bar — 滾動時始終可見，提醒名額限制 */}
      <div className="pr-early-bar">
        <div className="in">
          <div className="l">
            <span className="ic" aria-hidden="true">🐣</span>
            <span className="t">早鳥首年 NT$990／月</span>
            <span className="hint">・首 4 週限定 / 前 100 名</span>
          </div>
          <button onClick={() => handleUpgrade('earlybird')} disabled={upgrading}>搶名額 →</button>
        </div>
      </div>

      <SiteHeader />

      <main className="ls-wrap pr-main">
        {/* 標題 + 早鳥膠囊 */}
        <div className="pr-hero">
          <div className="pr-kick"><span className="dot" aria-hidden="true" />早鳥優惠・首 4 週限定・前 100 名首年 NT$990／月</div>
          <h1>你的品牌，AI 推薦你嗎？</h1>
          <p>
            當客戶問 <b className="c-seo">ChatGPT</b>、<b className="c-aeo">Claude</b>、<b className="c-eeat">Gemini</b>「該找哪一家」時，你的品牌名是否會被推薦？
            <br /><span className="sub">AI 雷達用 1/10 顧問費用，24 小時自動監測你在 AI 答案中的曝光度</span>
          </p>
        </div>

        {/* A5: 社會證明區 */}
        <div className="pr-stats">
          <div><div className="n" style={{ color: 'var(--accent)' }}>{fmt(stats.brands)}</div><div className="l">個品牌正在監測</div></div>
          <div><div className="n" style={{ color: 'var(--aeo)' }}>{fmt(stats.reports)}</div><div className="l">份 AI 能見度報告</div></div>
          <div><div className="n" style={{ color: 'var(--geo)' }}>{fmt(stats.mentions)}</div><div className="l">次品牌被 AI 主動提及</div></div>
          <div><div className="n" style={{ color: '#059669' }}>{fmt(stats.scans)}</div><div className="l">次累積 AI 掃描</div></div>
        </div>

        {/* A6+C2: 痛點教育區 */}
        <div className="pr-pain">
          <div className="card is-red">
            <div className="ic">⚠️</div>
            <div className="t">你的 SEO 排名再好，AI 還是不認識你</div>
            <p>ChatGPT、Claude、Gemini 不看 Google 排名。它們有自己的「信任名單」——<b>不在名單裡，再多廣告費也買不到推薦。</b></p>
          </div>
          <div className="card is-purple">
            <div className="ic">💰</div>
            <div className="t">SEO 顧問每月 NT$15,000–50,000</div>
            <p>傳統 SEO 顧問月費上看 NT$50,000，且只看 Google。AI 雷達用 <b>NT$1,490／月（1/10 價）</b>，同時監測 SEO + AEO + GEO + AI 引用率。</p>
          </div>
          <div className="card is-green">
            <div className="ic">🎯</div>
            <div className="t">傳統 vs AI 時代問法</div>
            <ul>
              <li><span className="lab">Ahrefs 回答：</span><br />「你的網站排第幾名」</li>
              <li><span className="lab is-good">AI 雷達回答：</span><br /><b>「AI 推薦的是你，還是你的對手」</b></li>
            </ul>
          </div>
        </div>

        {/* 年繳 / 月繳 切換 */}
        <div className="pr-toggle-wrap">
          <div className="pr-toggle" role="group" aria-label="計費週期切換">
            <button type="button" onClick={() => setIsYearly(true)} aria-pressed={isYearly} className={isYearly ? 'on' : ''}>
              年繳 <span className="badge">省 {savedPercent}%</span>
            </button>
            <button type="button" onClick={() => setIsYearly(false)} aria-pressed={!isYearly} className={!isYearly ? 'on' : ''}>月繳</button>
          </div>
        </div>

        {/* 方案卡片 */}
        <div className="pr-cards">
          <div className="pr-col">
            <span className="pr-flag">免費取得 3 次分析</span>
            <div className="pr-card">
              <FreeCardBody />
            </div>
          </div>

          <div className="pr-col">
            <span className="pr-flag is-main">最多人選擇</span>
            <div className="pr-card is-pro">
              <ProCardBody
                isYearly={isYearly}
                proMonthly={proMonthly}
                proYearly={proYearly}
                proYearlyPerMonth={proYearlyPerMonth}
                savedAmount={savedAmount}
                savedMonths={savedMonths}
                earlybirdAvailable={earlybirdAvailable}
                earlybirdYearly={earlybirdYearly}
                earlybirdSlotsTaken={earlybirdSlotsTaken}
                earlybirdSlotsTotal={earlybirdSlotsTotal}
                isPro={isPro}
                isTrial={isTrial}
                trialDaysRemaining={trialDaysRemaining}
                hasTrialedBefore={hasTrialedBefore}
                upgrading={upgrading}
                startingTrial={startingTrial}
                onUpgrade={handleUpgrade}
                onStartTrial={handleStartTrial}
              />
            </div>
          </div>

          <div className="pr-col">
            <span className="pr-flag">即將推出</span>
            <div className="pr-card is-muted">
              <AgencyCardBody onWaitlist={() => setAgencyWaitlistOpen(true)} />
            </div>
          </div>
        </div>

        {/* aivis 已含在 Pro 核心 */}
        <div className="pr-aivis">
          <div className="hd">
            <span className="ic" aria-hidden="true">🎯</span>
            <span className="t">AI 曝光監測（aivis）已含在 Pro 中</span>
            <span className="tag">每月 {aivisIncludedPerMonth} 次</span>
          </div>
          <p className="lead">不是「你覺得你有曝光」，是 AI 親口說出你的名字</p>
          <p className="body">
            Pro 訂閱每月內含 <b>{aivisIncludedPerMonth} 次 AI 引用率實測</b>，足以追蹤單一品牌 10–15 個核心關鍵字。
            SEO 修復是一次性的，但 AI 在持續更新、競爭對手在持續優化—— aivis 每月幫你看 ChatGPT、Claude、Gemini 是否還推薦你。
          </p>
          <div className="demo">
            <div className="q"><span className="src">ChatGPT 實測</span><span className="query">查詢：「台北推薦的數位行銷公司」</span></div>
            <p className="a">
              根據近期搜尋結果，台北幾家受推薦的數位行銷公司包含：
              <span className="hl">優勢方舟數位行銷</span>（專注 AI 能見度監測）、A 公司、B 公司⋯⋯
              <span className="note">— 這就是 aivis 每次幫你監測的「真實 AI 答案」</span>
            </p>
          </div>
        </div>

        {/* C2: 競品比較簡表 */}
        <div className="pr-compare">
          <div className="hd">
            <h2>為什麼不用 Ahrefs / SEMrush 就好？</h2>
            <p>它們是 Google 時代的工具，回答的是「你的網站排第幾名」；AI 時代客戶問的是「該找哪一家」</p>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>比較項目</th><th>Ahrefs / SEMrush</th><th className="hl">AI 雷達</th></tr>
              </thead>
              <tbody>
                <tr><td>主要回答的問題</td><td className="low">你的網站排第幾名？</td><td className="good">AI 推薦的是你還是對手？</td></tr>
                <tr><td>監測來源</td><td className="low">Google 搜尋結果</td><td className="good">ChatGPT / Claude / Gemini 真實答案</td></tr>
                <tr><td>修復建議</td><td className="low">關鍵字策略（需另請工程師）</td><td className="good">修復碼直接複製 + 平台別指南</td></tr>
                <tr><td>使用語言</td><td className="low">英文介面</td><td className="good">繁中原生</td></tr>
                <tr><td>月費</td><td className="low">USD $99–449（NT$3,000–14,000）</td><td className="good">NT$1,490／月</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="pr-faq">
          <h2>常見問題</h2>
          <PricingFAQ items={FAQ_ITEMS} />
        </div>

        {/* C5: 底部雙路 CTA */}
        <div className="pr-dual">
          <div className="hd"><h2>準備好讓 AI 看見你了嗎？</h2><p>選擇最適合你的開始方式</p></div>
          <div className="grid">
            <div className="path is-orange">
              <div className="ic">🏢</div>
              <div className="kick">品牌主・自己經營</div>
              <h3>免費開始檢測你的品牌</h3>
              <p>60 秒輸入網址，立刻看到 AI 引擎眼中的你。不需信用卡。</p>
              <Link to="/" className="ls-btn ls-cta">立即免費檢測 →</Link>
            </div>
            <div className="path is-purple">
              <div className="ic">🤝</div>
              <div className="kick">顧問／行銷代理商</div>
              <h3>Agency 方案・即將推出</h3>
              <p>白標報告 + 多客戶工作區 + 優先客服。預先洽談取得早期合作優惠。</p>
              <button onClick={() => setAgencyWaitlistOpen(true)} className="ls-btn pr-purple-btn">🤝 加入 Agency 候補名單 →</button>
            </div>
          </div>
        </div>
      </main>

      {/* C6: Sticky bottom CTA — mobile 漂浮按鈕（已是 Pro 用戶不顯示） */}
      {!isPro && (
        <div className="pr-mobile-cta">
          <button
            onClick={() => {
              if (!hasTrialedBefore) return handleStartTrial()
              return handleUpgrade(isYearly ? (earlybirdAvailable ? 'earlybird' : 'yearly') : 'monthly')
            }}
            disabled={upgrading || startingTrial}
            className={hasTrialedBefore && isYearly && earlybirdAvailable ? 'is-early' : 'is-main'}
          >
            {mobileCtaLabel}
          </button>
          <p>↩ 隨時取消</p>
        </div>
      )}

      <SiteFooter />

      {/* Agency 候補名單 modal — 2026-06-09 取代「即將推出」disabled 按鈕、收集需求數據 */}
      <AgencyWaitlistModal open={agencyWaitlistOpen} onClose={() => setAgencyWaitlistOpen(false)} />
    </div>
  )

  // ──────────────────────────────────────────────
  // 卡片內部子元件（免費版／Agency 版）— 拉在這裡直接吃外層 closure（FEATURES_* 常數）
  // ──────────────────────────────────────────────
  function FreeCardBody() {
    return (
      <>
        <div className="pc-head">
          <div className="pc-label">免費版</div>
          <div className="pc-price"><span className="n">NT$0</span></div>
          <p className="pc-note">永久免費，無需信用卡</p>
        </div>
        <ul className="pc-features">
          {FEATURES_FREE.map((f, i) => <li key={i}><span className="ck">✓</span>{f}</li>)}
        </ul>
        <Link to="/" className="pc-cta is-ghost">立即取得 3 個免費分析額度</Link>
      </>
    )
  }

  function AgencyCardBody({ onWaitlist }) {
    return (
      <>
        <div className="pc-head">
          <div className="pc-label">Agency 方案</div>
          <div className="pc-price"><span className="n is-muted">NT$4,990</span><span className="unit">／月起</span></div>
          <p className="pc-note">適合行銷公司、設計工作室・含完整白標</p>
        </div>
        <ul className="pc-features is-muted">
          {FEATURES_AGENCY.map((f, i) => <li key={i}><span className="ck">✓</span>{f}</li>)}
        </ul>
        <button onClick={onWaitlist} className="pc-cta is-purple">🤝 加入候補名單（即將推出）</button>
      </>
    )
  }
}

// Pro 卡片內部 — 拉到外層（避免 closures 在 render 中重新建立）
function ProCardBody({ isYearly, proMonthly, proYearly, proYearlyPerMonth, savedAmount, savedMonths, earlybirdAvailable, earlybirdYearly, earlybirdSlotsTaken, earlybirdSlotsTotal, isPro, isTrial, trialDaysRemaining, hasTrialedBefore, upgrading, startingTrial, onUpgrade, onStartTrial }) {
  // 早鳥仍有名額 → 顯示劃線原價 + 早鳥價 + 進度條，按鈕走 earlybird endpoint
  // 已售完   → 顯示一般年繳 NT$1,158／月（13900/12），按鈕走 yearly endpoint
  // 設計理由：把早鳥與 Pro 整合在同一張卡，避免兩顆按鈕讓客戶猶豫該按哪個
  const earlybirdMonthly = 990
  return (
    <>
      <div className="pc-head">
        <div className="pc-label-row">
          <span className="pc-label is-aeo">Pro 方案</span>
          {isYearly && earlybirdAvailable && <span className="pc-badge is-warn">🐣 早鳥首年限定・前 {earlybirdSlotsTotal} 名</span>}
        </div>

        {isYearly && earlybirdAvailable ? (
          <>
            <div className="pc-price"><span className="n is-warn">NT${earlybirdMonthly.toLocaleString()}</span><span className="unit">／月</span></div>
            <p className="pc-note">年繳 <b className="is-warn">NT${earlybirdYearly.toLocaleString()}</b> <s>原價 NT${proYearly.toLocaleString()}</s></p>
            <p className="pc-note">首年限定，次年續訂自動恢復一般年費 NT${proYearlyPerMonth.toLocaleString()}／月</p>
          </>
        ) : isYearly ? (
          <>
            <div className="pc-price"><span className="n">NT${proYearlyPerMonth.toLocaleString()}</span><span className="unit">／月</span></div>
            <p className="pc-note">年繳 NT${proYearly.toLocaleString()}（省 NT${savedAmount.toLocaleString()}・等於免費多用 {savedMonths} 個月）</p>
          </>
        ) : (
          <>
            <div className="pc-price"><span className="n">NT${proMonthly.toLocaleString()}</span><span className="unit">／月</span></div>
            <p className="pc-note">隨時取消，無綁約</p>
          </>
        )}

        {/* 7 天免費試用 + 退款保證 雙膠囊 */}
        <div className="pc-pills">
          <span className="pill is-green">✨ 7 天免費試用</span>
          {isYearly && <span className="pill is-blue">🛡 14 天無條件退款</span>}
        </div>

        {/* 早鳥進度條 — 100 名 progress bar；月繳切換時隱藏（早鳥僅限年繳） */}
        {isYearly && earlybirdAvailable && (
          <div className="pc-progress">
            <div className="row"><span>早鳥名額</span><span className="n">{earlybirdSlotsTaken} / {earlybirdSlotsTotal} 名</span></div>
            <div className="track"><div className="fill" style={{ width: `${Math.max(2, (earlybirdSlotsTaken / earlybirdSlotsTotal) * 100)}%` }} /></div>
          </div>
        )}
      </div>

      <ul className="pc-features">
        {FEATURES_PRO.map((f, i) => {
          const isLast = i === FEATURES_PRO.length - 1
          return <li key={i} className={isLast ? 'is-muted' : ''}><span className={`ck${isLast ? ' is-muted' : ''}`}>✓</span>{f}</li>
        })}
      </ul>

      {/* C7: 平台支援現況 — 已上線 ChatGPT / Claude / Gemini（2026-07-17：三家皆已上線；不上 Perplexity / Grok）*/}
      <div className="pc-platforms">
        <div className="lab">AI 曝光監測支援平台</div>
        <div className="chips">
          {['ChatGPT', 'Claude', 'Gemini'].map(name => <span key={name} className="chip">✓ {name}</span>)}
        </div>
      </div>

      {isPro && isTrial ? (
        // 試用中 — 倒數膠囊 + 主要付款 CTA + 管理訂閱 link
        <div className="pc-actions">
          <div className="pc-status">✨ 試用中・剩 {trialDaysRemaining ?? 0} 天</div>
          <button
            onClick={() => onUpgrade(isYearly ? (earlybirdAvailable ? 'earlybird' : 'yearly') : 'monthly')}
            disabled={upgrading}
            className={`pc-main-btn${isYearly && earlybirdAvailable ? ' is-early' : ''}`}
          >
            {upgrading ? '處理中...' : isYearly && earlybirdAvailable ? '🐣 立即升級鎖定早鳥 NT$990／月' : `立即升級 Pro · NT$${(isYearly ? proYearlyPerMonth : proMonthly).toLocaleString()}／月`}
          </button>
          <Link to="/account" className="pc-manage">管理訂閱 →</Link>
        </div>
      ) : isPro ? (
        <div className="pc-actions">
          <div className="pc-status">✓ 目前方案</div>
          <Link to="/account" className="pc-manage">管理訂閱 →</Link>
        </div>
      ) : (
        // 未試用過 → 顯示「免費試用 7 天」直接啟動試用；試用過 → 顯示「立即升級」走付款
        <div className="pc-actions">
          <button
            onClick={() => {
              if (!hasTrialedBefore) return onStartTrial()
              return onUpgrade(isYearly ? (earlybirdAvailable ? 'earlybird' : 'yearly') : 'monthly')
            }}
            disabled={upgrading || startingTrial}
            className={`pc-main-btn${hasTrialedBefore && isYearly && earlybirdAvailable ? ' is-early' : ''}`}
          >
            {(upgrading || startingTrial) ? '處理中...' : !hasTrialedBefore ? '免費試用 7 天' : isYearly && earlybirdAvailable ? '搶早鳥首年 NT$990／月' : `立即升級 Pro · NT$${(isYearly ? proYearlyPerMonth : proMonthly).toLocaleString()}／月`}
          </button>
          {/* 2026-06-08：未試用過用戶也給「跳過試用、直接付費」入口，等高同色彩權重雙按鈕（目標客戶購買意圖明確） */}
          {!hasTrialedBefore && (
            <button
              onClick={() => onUpgrade(isYearly ? (earlybirdAvailable ? 'earlybird' : 'yearly') : 'monthly')}
              disabled={upgrading || startingTrial}
              className="pc-main-btn is-early"
            >
              {upgrading ? '處理中...' : isYearly && earlybirdAvailable ? '🐣 直接鎖定早鳥 NT$990／月' : `直接付費 Pro · NT$${(isYearly ? proYearlyPerMonth : proMonthly).toLocaleString()}／月`}
            </button>
          )}
          <div className="pc-trust"><span>⚡ 60 秒開通</span><span>↩ 隨時取消</span></div>
          <p className="pc-guarantee">🛡 不滿意，一毛都不用付</p>
        </div>
      )}
    </>
  )
}
