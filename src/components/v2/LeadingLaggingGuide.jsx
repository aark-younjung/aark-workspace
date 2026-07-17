/**
 * LeadingLaggingGuide — Audit 達標 next step 引導卡（2026-06-10）
 *
 * 設計動機：客戶把「audit 100 分」誤解為「業績滿分」、做到滿分後問「為什麼 AI 還是不提我」。
 *   不降分數天花板（會有更糟副作用）、改在達標時用引導卡明確說明：
 *   「audit 完美 = 地基蓋好、不等於觀眾入場、下一步是真實市場結果指標」。
 *
 * 顯示條件：4 個 audit 平均 ≥ 85 分（接近滿分時觸發、不用等到全 100）
 *
 * 設計：左右兩欄、Leading（你做了什麼）vs Lagging（市場給你什麼）對照
 *   左：你完成的 audit 訊號層 + 完成度
 *   右：實際市場結果（aivis 引用率 + 媒體提及待開放）+ CTA
 */
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LeadingLaggingGuide({ scores, websiteName }) {
  const { isPro } = useAuth()

  // 顯示門檻：4 audit 平均 ≥ 85（content 不算、它是內容品質、跟 LLMO 訊號鏈不同）
  const auditAvg = (scores.seo + scores.aeo + scores.geo + scores.eeat) / 4
  if (auditAvg < 85) return null

  // 算「各層達標度」(≥ 90 算達標)
  const maxedOut = [
    scores.seo >= 90,
    scores.aeo >= 90,
    scores.geo >= 90,
    scores.eeat >= 90,
  ].filter(Boolean).length

  return (
    <section
      className="mb-6 rounded-2xl border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(24,197,144,0.08) 0%, rgba(245,158,11,0.06) 50%, rgba(239,68,68,0.04) 100%)',
        borderColor: 'rgba(24,197,144,0.30)',
      }}
    >
      {/* Header banner */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            你的網站 audit 已接近滿分
          </h2>
          <span
            className="px-2.5 py-0.5 text-sm font-mono rounded-full"
            style={{ background: 'rgba(24,197,144,0.15)', color: '#86efac', border: '1px solid rgba(24,197,144,0.4)' }}
          >
            {maxedOut}/4 訊號層達標
          </span>
        </div>
        <p className="text-sm text-white/70 mt-2 leading-relaxed">
          但 audit 完美 ≠ 業績滿分。
          <strong className="text-white"> 接下來要追的不是「我做了什麼」、是「市場給我什麼」</strong>。
        </p>
      </div>

      {/* 左右對照：Leading vs Lagging */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左：Leading（你做了什麼） */}
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">✅</span>
            <span className="text-sm font-bold text-white">Leading 指標（你做了什麼）</span>
          </div>
          <p className="text-sm text-white/55 mb-3 leading-relaxed">
            5 訊號層 audit — 等於「具備被 AI 引用的條件」
          </p>
          <ul className="text-sm text-white/70 space-y-1.5">
            <li>• SEO：{scoreStatus(scores.seo)}</li>
            <li>• AEO：{scoreStatus(scores.aeo)}</li>
            <li>• GEO：{scoreStatus(scores.geo)}</li>
            <li>• E-E-A-T：{scoreStatus(scores.eeat)}</li>
          </ul>
          <p className="text-sm text-white/40 mt-3 italic">
            🏗 「舞台搭好了」
          </p>
        </div>

        {/* 右：Lagging（市場給你什麼） + CTA */}
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(24,197,144,0.06)', borderColor: 'rgba(24,197,144,0.25)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📡</span>
            <span className="text-sm font-bold text-white">Lagging 指標（市場給你什麼）</span>
          </div>
          <p className="text-sm text-white/55 mb-3 leading-relaxed">
            真實市場結果 — 等於「實際被 AI 推薦了沒」
          </p>
          <ul className="text-sm text-white/70 space-y-1.5">
            <li>
              <span className="text-emerald-300">•</span>{' '}
              <strong className="text-white">aivis 跨 LLM 引用率</strong>：監測 ChatGPT / Claude / Gemini 實際提你品牌的次數
            </li>
            <li>
              <span className="text-white/45">•</span>{' '}
              <span className="text-white/50">媒體提及（即將推出）：Mobile01 / PTT / 新聞被提次數</span>
            </li>
          </ul>

          {/* CTA */}
          <Link
            to="/ai-visibility"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/20 transition"
          >
            {isPro ? '設定 aivis 監測 →' : '升級 Pro 解鎖 aivis →'}
          </Link>

          <p className="text-sm text-white/45 mt-3 italic">
            🎬 「等觀眾入場」
          </p>
        </div>
      </div>

      {/* 底部 tip */}
      <div className="px-6 py-3 border-t flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.20)' }}>
        <span className="text-base">💡</span>
        <p className="text-sm text-white/55 leading-relaxed">
          {websiteName ? <strong className="text-white/75">{websiteName} </strong> : ''}
          的 audit 已穩定、之後 audit 分數小幅波動是正常的。
          注意力轉移到：<strong className="text-white">產更多權威內容 + 外部曝光（媒體 / 論壇 / KOL）+ aivis 監測引用率</strong>。
        </p>
      </div>
    </section>
  )
}

// 把單一分數轉成「已達標 / 接近 / 待加強」標籤
function scoreStatus(score) {
  if (score >= 95) return <span><span className="text-emerald-300 font-mono font-bold">{score}</span> <span className="text-white/50">滿分</span></span>
  if (score >= 90) return <span><span className="text-emerald-300 font-mono font-bold">{score}</span> <span className="text-white/50">已達標</span></span>
  if (score >= 80) return <span><span className="text-yellow-300 font-mono font-bold">{score}</span> <span className="text-white/50">接近達標</span></span>
  return <span><span className="text-orange-300 font-mono font-bold">{score}</span> <span className="text-white/50">待加強</span></span>
}
