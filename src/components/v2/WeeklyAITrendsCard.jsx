/**
 * WeeklyAITrendsCard — 本週 AI 趨勢卡（2026-06-06）
 *
 * 設計動機：朋友建議「加入夯關鍵字 / AI 搜尋口語、促進每日回訪」。
 *   用既有 aivis_mentions / aivis_responses 資料反推「跨用戶本週 AI 提及最多的品牌」。
 *
 * 內容：
 *   1. 本週引擎呼叫量（規模感）
 *   2. 本週提及 Top 5 品牌（含 vs 上週變化）
 *   3. 「看 aivis 完整監測」CTA
 *
 * 資料來源：/api/public?action=aivis-trends（5 分鐘 CDN cache）
 *
 * 空狀態：aivis 累積還不足、顯示「資料蒐集中」+「設定 aivis 加快蒐集」CTA
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function WeeklyAITrendsCard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/public?action=aivis-trends')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div className="text-sm text-white/40">📡 載入本週 AI 趨勢…</div>
      </section>
    )
  }

  // 完全無資料 → 顯示「資料蒐集中」空狀態（aivis 還沒累積）
  const hasData = data && (data.totalResponses > 0 || data.topMentions?.length > 0)
  if (!hasData) {
    return (
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(0,0,0,0.3))',
        border: '1px solid rgba(249,115,22,0.25)',
      }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">📡</span>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-1">本週 AI 趨勢資料蒐集中</h3>
            <p className="text-sm text-white/55 leading-relaxed mb-3">
              aivis 還在累積初期、暫時沒有跨用戶趨勢可顯示。
              設定追蹤品牌後、aivis 會每天問 5 個 AI 引擎、本週起就有數據。
            </p>
            <Link
              to="/ai-visibility"
              className="inline-block px-4 py-2 rounded-lg text-sm font-bold text-orange-300 hover:text-orange-200 border border-orange-400/40 hover:border-orange-400/70 transition"
            >
              設定追蹤 →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(0,0,0,0.3))',
      border: '1px solid rgba(249,115,22,0.22)',
    }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            🔥 本週 AI 趨勢
          </h3>
          <span className="text-xs font-mono text-white/40">
            {data.range.from} ~ {data.range.to}
          </span>
        </div>
        <Link to="/ai-visibility" className="text-xs text-orange-300 hover:text-orange-200 font-bold">
          看完整 aivis →
        </Link>
      </div>

      {/* 上方：本週引擎呼叫量規模 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-white/55">
        <span>本週 AI 引擎共回應</span>
        <strong className="text-white font-mono text-base">{data.totalResponses.toLocaleString()}</strong>
        <span>次 ·</span>
        <span>提及品牌</span>
        <strong className="text-white font-mono text-base">{data.totalMentions.toLocaleString()}</strong>
        <span>次</span>
      </div>

      {/* 中：Engine breakdown chips */}
      {Object.keys(data.engineBreakdown || {}).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {Object.entries(data.engineBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([engine, count]) => (
              <span key={engine} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 font-mono">
                {engine} · {count.toLocaleString()}
              </span>
            ))}
        </div>
      )}

      {/* 下：Top 5 提及品牌排行 */}
      {data.topMentions.length > 0 ? (
        <div className="rounded-xl p-4" style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(249,115,22,0.18)',
        }}>
          <div className="text-xs text-white/50 mb-3 font-bold uppercase tracking-widest">
            本週 AI 最常提及的品牌
          </div>
          <ol className="space-y-2">
            {data.topMentions.map((m, i) => {
              const rank = i + 1
              const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
              const change = m.change_pct
              return (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 text-center text-base font-bold" style={{
                    color: rank <= 3 ? '#fdba74' : 'rgba(255,255,255,0.55)',
                  }}>{medal}</span>
                  <span className="flex-1 text-sm text-white font-bold truncate">{m.name}</span>
                  <span className="text-xs text-white/55 font-mono whitespace-nowrap">
                    {m.count.toLocaleString()} 次
                  </span>
                  {change != null && (
                    <span
                      className="text-xs font-bold font-mono whitespace-nowrap min-w-[3rem] text-right"
                      style={{ color: change > 0 ? '#86efac' : change < 0 ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}
                    >
                      {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change)}%
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <div className="text-xs text-white/40 py-2">本週還沒有品牌提及紀錄</div>
      )}

      {/* Footer 小字 — 解釋資料來源 + 排名邏輯 */}
      <p className="mt-3 text-[11px] text-white/35 leading-relaxed">
        💡 統計來自 Aark 全平台 aivis 監測累積（跨用戶匿名）— 顯示 ChatGPT / Claude / Perplexity / Gemini / GLM 5 引擎本週提及次數。每 5 分鐘更新一次。
      </p>
    </section>
  )
}
