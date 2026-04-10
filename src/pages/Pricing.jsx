import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES_FREE = [
  '追蹤最多 3 個網站',
  'SEO / AEO / GEO / E-E-A-T 基本分析',
  'GA4 流量摘要（6 個數字）',
  'GSC 搜尋成效摘要（4 個數字）',
  'AI 優化建議（5 條通用方向）',
  '文章內容分析（基本版）',
  '競品比較（2 個網站）',
  '公開排行榜',
]

const FEATURES_PRO = [
  '追蹤最多 15 個網站',
  'AEO 每項檢測逐項修復建議',
  'SEO 詳情頁 3 階段優化路線圖',
  '修復碼產生器（llms.txt / JSON-LD / FAQ Schema）',
  '歷史趨勢圖（追蹤每次優化成效）',
  'GA4 進階：趨勢圖 + 智能洞察',
  'GSC 進階：趨勢圖 + 關鍵字排名表 + 建議',
  '文章內容分析（完整修復建議）',
  'PDF 報告匯出',
  'Email 週報訂閱',
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

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false)
  const { user, isPro } = useAuth()
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
    <div className="min-h-screen relative" style={{ background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-200 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-800">優勢方舟數位行銷</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/showcase" className="text-slate-600 hover:text-slate-900 text-sm transition-colors">排行榜</Link>
            <Link to="/" className="text-slate-600 hover:text-slate-900 text-sm transition-colors">免費檢測 →</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">

        {/* 標題 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 border border-orange-200 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-gray-500 text-sm">早鳥優惠進行中・前 100 名永久 NT$990／月</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            簡單透明的定價
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            SEO 顧問每月收費 NT$15,000 起，優勢方舟數位行銷讓你用
            <span className="text-gray-800 font-semibold"> 1/10 的費用</span>
            ，24 小時自動監測 AI 能見度
          </p>

          {/* 月繳 / 年繳切換 */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-400'}`}>月繳</span>
            <button
              onClick={() => setIsYearly(v => !v)}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${isYearly ? 'bg-purple-600' : 'bg-orange-400'}`}
            >
              <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${isYearly ? 'translate-x-7' : 'translate-x-0'}`}></span>
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-400'}`}>
              年繳
              <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">省 NT${savedAmount.toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* 方案卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">

          {/* 免費版 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span className="px-4 py-1 bg-orange-100 text-gray-500 text-xs font-bold rounded-full border border-orange-200">立即體驗</span>
            </div>
          <div className="p-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex flex-col flex-1">
            <div className="mb-6">
              <div className="text-gray-500 text-sm font-medium mb-2">免費版</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-bold text-gray-800">NT$0</span>
              </div>
              <p className="text-gray-400 text-sm">永久免費，無需信用卡</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_FREE.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-500">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <Link to="/"
              className="w-full py-3 text-center bg-orange-100 border border-orange-200 text-gray-800 rounded-xl hover:bg-orange-200 transition-colors font-medium block">
              免費開始使用
            </Link>
          </div>
          </div>

          {/* Pro 版 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span className="px-4 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold rounded-full">最多人選擇</span>
            </div>
          <div className="p-8 bg-gradient-to-b from-purple-100 to-blue-50 rounded-2xl border border-purple-300 flex flex-col flex-1">

            <div className="mb-6">
              <div className="text-purple-600 text-sm font-medium mb-2">Pro 方案</div>
              {isYearly ? (
                <>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-bold text-gray-800">NT${proYearlyPerMonth.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm mb-1">／月</span>
                  </div>
                  <p className="text-gray-400 text-sm">年繳 NT${proYearly.toLocaleString()}（省 NT${savedAmount.toLocaleString()}）</p>
                </>
              ) : (
                <>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-4xl font-bold text-gray-800">NT${proMonthly.toLocaleString()}</span>
                    <span className="text-gray-500 text-sm mb-1">／月</span>
                  </div>
                  <p className="text-gray-400 text-sm">隨時取消，無綁約</p>
                </>
              )}
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_PRO.map((f, i) => (
                <li key={i} className={`flex items-start gap-2.5 text-sm ${i === FEATURES_PRO.length - 1 ? 'text-gray-400' : 'text-gray-800'}`}>
                  <span className={`mt-0.5 flex-shrink-0 ${i === FEATURES_PRO.length - 1 ? 'text-gray-400' : 'text-purple-500'}`}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {isPro ? (
              <div className="space-y-2">
                <div className="w-full py-3 text-center bg-green-500/20 text-green-600 rounded-xl font-semibold border border-green-500/30">
                  ✓ 目前方案
                </div>
                <Link to="/account" className="block w-full py-2 text-center text-gray-400 hover:text-gray-600 text-xs transition-colors">
                  管理訂閱 →
                </Link>
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade(isYearly ? 'yearly' : 'monthly')}
                disabled={upgrading}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all font-semibold shadow-lg shadow-purple-500/25 disabled:opacity-50">
                {upgrading ? '處理中...' : '立即升級 Pro'}
              </button>
            )}
          </div>
          </div>

          {/* Agency 版 */}
          <div className="flex flex-col">
            <div className="flex justify-center mb-2">
              <span className="px-4 py-1 bg-orange-100 text-gray-500 text-xs font-bold rounded-full border border-orange-200">即將推出</span>
            </div>
          <div className="p-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex flex-col flex-1">

            <div className="mb-6">
              <div className="text-gray-500 text-sm font-medium mb-2">Agency 方案</div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-bold text-gray-400">NT$3,990</span>
                <span className="text-gray-400 text-sm mb-1">／月起</span>
              </div>
              <p className="text-gray-400 text-sm">適合行銷公司、設計工作室</p>
            </div>

            <ul className="space-y-3 flex-1 mb-8">
              {FEATURES_AGENCY.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-400">
                  <span className="text-gray-300 mt-0.5 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button disabled
              className="w-full py-3 bg-orange-100 text-gray-400 rounded-xl cursor-not-allowed font-medium border border-orange-200">
              候補通知（即將推出）
            </button>
          </div>
          </div>
        </div>

        {/* 早鳥方案 */}
        <div className="mb-16 p-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🐣</span>
                <span className="text-yellow-600 font-bold text-lg">早鳥優惠 — 前 100 名</span>
                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 text-xs rounded-full border border-yellow-500/30">限量</span>
              </div>
              <p className="text-gray-500 text-sm max-w-xl">
                前 100 位付費用戶享 <span className="text-gray-800 font-semibold">NT$990／月永久鎖定</span>，即使未來漲價也不受影響。
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
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">常見問題</h2>
          <div className="space-y-4">
            {[
              {
                q: '免費版和 Pro 版最大的差別是什麼？',
                a: '免費版讓你看到「哪裡有問題」，Pro 版告訴你「怎麼修」。包含逐項修復建議、修復碼產生器（可直接複製 llms.txt / JSON-LD / FAQ Schema）、歷史趨勢圖、GA4/GSC 進階圖表，以及每週自動寄送 Email 週報。',
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
            ].map((item, i) => (
              <details key={i} className="group p-6 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 cursor-pointer">
                <summary className="flex items-center justify-between text-gray-800 font-medium list-none">
                  {item.q}
                  <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg flex-shrink-0 ml-4">↓</span>
                </summary>
                <p className="mt-4 text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* CTA 底部 */}
        <div className="mt-20 text-center p-12 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60">
          <h2 className="text-3xl font-bold text-gray-800 mb-3">現在就開始免費使用</h2>
          <p className="text-gray-500 mb-8">輸入網址，60 秒內取得 AI 能見度完整分析報告</p>
          <Link to="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-200 text-lg">
            免費檢測我的網站 →
          </Link>
        </div>

      </main>
      </div>
    </div>
  )
}
