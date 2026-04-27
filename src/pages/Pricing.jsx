import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

const FEATURES_FREE = [
  '追蹤最多 3 個網站',
  'SEO / AEO / GEO / E-E-A-T 基本分析',
  'GA4 流量摘要（6 個數字）',
  'GSC 搜尋成效摘要（4 個數字）',
  'AI 優化建議（5 條通用方向）',
  '修復碼產生器（llms.txt / JSON-LD / FAQ Schema）',
  '文章內容分析（基本版）',
  '競品比較（2 個網站）',
  '公開排行榜',
]

const FEATURES_PRO = [
  '追蹤最多 15 個網站',
  'AEO 每項檢測逐項修復建議',
  'SEO 詳情頁 3 階段優化路線圖',
  '歷史趨勢圖（追蹤每次優化成效）',
  'GA4 進階：趨勢圖 + 智能洞察',
  'GSC 進階：趨勢圖 + 關鍵字排名表 + 建議',
  '文章內容分析（完整修復建議）',
  'PDF 報告匯出',
  '競品比較（最多 4 個網站）',
  'LINE 推播通知（即將推出）',
  '所有免費版功能',
]

const FEATURES_AGENCY = [
  '追蹤最多 50 個網站',
  '白標 PDF 報告（附你的品牌）',
  '多帳號協作管理',
  '客戶報表獨立分享連結',
  '所有 Pro 版功能',
]

// FAQ 折疊項 — dark 用 GlassCard + T.orange, light 用 details/summary 維持原樣
function PricingFAQ({ items, isDark }) {
  if (isDark) {
    return (
      <div className="space-y-4">
        {items.map((item, i) => (
          <details key={i} className="group cursor-pointer">
            <GlassCard color={T.orange} style={{ padding: 24 }}>
              <summary className="flex items-center justify-between font-medium list-none" style={{ color: T.text }}>
                {item.q}
                <span className="text-lg flex-shrink-0 ml-4 group-open:rotate-180 transition-transform" style={{ color: T.textLow }}>↓</span>
              </summary>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: T.textMid }}>{item.a}</p>
            </GlassCard>
          </details>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <details key={i} className="group p-6 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 cursor-pointer">
          <summary className="flex items-center justify-between text-gray-800 font-medium list-none">
            {item.q}
            <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg flex-shrink-0 ml-4">↓</span>
          </summary>
          <p className="mt-4 text-gray-500 text-sm leading-relaxed">{item.a}</p>
        </details>
      ))}
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: '免費版和 Pro 版最大的差別是什麼？',
    a: '免費版讓你看到「哪裡有問題」，Pro 版告訴你「怎麼修」。包含逐項修復建議、修復碼產生器（可直接複製 llms.txt / JSON-LD / FAQ Schema）、歷史趨勢圖、GA4/GSC 進階圖表。',
  },
  {
    q: '可以隨時取消嗎？',
    a: '可以。月繳方案隨時取消，下個計費週期不再收費。年繳方案在期限內可繼續使用，不提供退款但可降回免費版。',
  },
  {
    q: 'AEO / GEO 是什麼？跟一般 SEO 有什麼不同？',
    a: 'SEO 是讓 Google 搜尋找到你，AEO（Answer Engine Optimization）是讓 ChatGPT、Perplexity 等 AI 問答引擎引用你的內容，GEO（Generative Engine Optimization）是讓生成式 AI 在回答時主動提及你的品牌。這是 AI 搜尋時代必備的新指標。',
  },
  {
    q: '早鳥價 NT$990 什麼時候截止？',
    a: '前 100 名付費用戶即可鎖定，名額用完即止。鎖定後永久維持 NT$990，不受未來漲價影響。',
  },
  {
    q: 'Agency 方案什麼時候推出？',
    a: '預計 2026 年中推出。如果你是行銷公司或設計工作室，歡迎先用 Pro 方案，Agency 推出時會優先通知。',
  },
]

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false)
  const { user, isPro } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const proMonthly = 1490
  const proYearly = 14900
  const proYearlyPerMonth = Math.round(proYearly / 12)
  const savedAmount = proMonthly * 12 - proYearly

  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = async (priceType = 'monthly') => {
    if (!user) { navigate('/register'); return }
    if (isPro) { navigate('/'); return }
    setUpgrading(true)
    try {
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
              早鳥優惠進行中・前 100 名永久 NT$990／月
            </span>
          </div>
          <h1
            className="text-4xl md:text-5xl font-bold mb-4"
            style={isDark ? { color: T.text, letterSpacing: '-0.02em' } : { color: '#1e293b' }}
          >
            簡單透明的定價
          </h1>
          <p
            className="text-lg max-w-2xl mx-auto"
            style={isDark ? { color: T.textMid, lineHeight: 1.7 } : { color: '#64748b' }}
          >
            SEO 顧問每月收費 NT$15,000 起，優勢方舟數位行銷讓你用
            <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}> 1/10 的費用</span>
            ，24 小時自動監測 AI 能見度
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
              >省 NT${savedAmount.toLocaleString()}</span>
            </span>
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
                  isPro={isPro}
                  upgrading={upgrading}
                  onUpgrade={handleUpgrade}
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
                  isPro={isPro}
                  upgrading={upgrading}
                  onUpgrade={handleUpgrade}
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

        {/* 早鳥方案 — 整段 wrapper 維持淡黃背景，dark 用 T.warn 半透明 */}
        <div
          className="mb-16 p-8 rounded-2xl border"
          style={isDark
            ? { background: T.warn + '0d', borderColor: T.warn + '4d', backdropFilter: 'blur(16px)' }
            : { background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.3)' }
          }
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🐣</span>
                <span className="font-bold text-lg" style={{ color: T.warn }}>早鳥優惠 — 前 100 名</span>
                <span
                  className="px-2 py-0.5 text-xs rounded-full border"
                  style={{ background: T.warn + '33', color: T.warn, borderColor: T.warn + '55' }}
                >限量</span>
              </div>
              <p
                className="text-sm max-w-xl"
                style={isDark ? { color: T.textMid, lineHeight: 1.7 } : { color: '#64748b' }}
              >
                前 100 位付費用戶享 <span className="font-semibold" style={isDark ? { color: T.text } : { color: '#1e293b' }}>NT$990／月永久鎖定</span>，即使未來漲價也不受影響。
                成為創始用戶，同時獲得優先新功能體驗與直接回饋管道。
              </p>
            </div>
            <button
              onClick={() => handleUpgrade('earlybird')}
              disabled={upgrading}
              className="flex-shrink-0 px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/25 whitespace-nowrap disabled:opacity-50">
              {upgrading ? '處理中...' : '搶早鳥優惠 NT$990'}
            </button>
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

        {/* CTA 底部 */}
        {isDark ? (
          <GlassCard color={T.orange} style={{ marginTop: 80, padding: 48, textAlign: 'center' }}>
            <h2 className="text-3xl font-bold mb-3" style={{ color: T.text }}>立即取得你的 AI 能見度報告</h2>
            <p className="mb-8" style={{ color: T.textMid }}>輸入網址，60 秒診斷你的網站被 AI 看見的程度，免費使用，不需信用卡</p>
            <Link to="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-900/60 text-lg">
              取得我的免費報告 →
            </Link>
          </GlassCard>
        ) : (
          <div className="mt-20 text-center p-12 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60">
            <h2 className="text-3xl font-bold text-gray-800 mb-3">立即取得你的 AI 能見度報告</h2>
            <p className="text-gray-500 mb-8">輸入網址，60 秒診斷你的網站被 AI 看見的程度，免費使用，不需信用卡</p>
            <Link to="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-200 text-lg">
              取得我的免費報告 →
            </Link>
          </div>
        )}

      </main>
      </div>
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
            >NT$3,990</span>
            <span
              className="text-sm mb-1"
              style={dark ? { color: T.textLow } : { color: '#94a3b8' }}
            >／月起</span>
          </div>
          <p
            className="text-sm"
            style={dark ? { color: T.textLow } : { color: '#94a3b8' }}
          >適合行銷公司、設計工作室</p>
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
function ProCardBody({ isYearly, proMonthly, proYearly, proYearlyPerMonth, savedAmount, isPro, upgrading, onUpgrade, isDark }) {
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
            >年繳 NT${proYearly.toLocaleString()}（省 NT${savedAmount.toLocaleString()}）</p>
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
      </div>

      <ul className="space-y-3 flex-1 mb-8">
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

      {isPro ? (
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
        <button
          onClick={() => onUpgrade(isYearly ? 'yearly' : 'monthly')}
          disabled={upgrading}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all font-semibold shadow-lg shadow-purple-500/25 disabled:opacity-50">
          {upgrading ? '處理中...' : '立即升級 Pro'}
        </button>
      )}
    </>
  )
}
