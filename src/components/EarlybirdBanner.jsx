/**
 * EarlybirdBanner — 早鳥限時優惠橫幅
 *
 * 為什麼獨立成元件（不塞進 AnnouncementBanner）：
 *   AnnouncementBanner 是 admin 手動發佈、靜態內容；早鳥計數要「即時數字 + 進度條 + 售完自動隱藏」，
 *   動態程度高、需要每次都打 API，獨立元件較乾淨且效能可控（每頁 mount 才打一次 API）。
 *
 * 顯示規則：
 *   - 從 /api/public?action=stats 拉 earlybird_taken
 *   - 已售 < 100 → 顯示 banner
 *   - 已售 >= 100 → 自動隱藏（售完）
 *   - 用戶按 ✕ 關閉 → localStorage 記住、不再出現直到清快取
 *
 * 視覺：橘金漸層 + 進度條 + 緊迫感文案 + CTA 連 /pricing
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TOTAL_SLOTS = 100   // 早鳥總名額（CLAUDE.md 規格）
const PRICE_EARLYBIRD = 11880  // 早鳥首年 NT$ (NT$990/月 × 12)
const PRICE_REGULAR = 13900    // 一般年繳 NT$
const STORAGE_KEY = 'dismissed_earlybird_banner'

export default function EarlybirdBanner() {
  const { isPro, loading: authLoading } = useAuth()
  const [taken, setTaken] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    // Pro 用戶不顯示早鳥 banner（他們已經買了 / 不適用）
    if (authLoading || isPro) return
    let cancelled = false
    fetch('/api/public?action=stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setTaken(d.earlybird_taken ?? 0) })
      .catch(() => { /* 失敗就不顯示 banner */ })
    return () => { cancelled = true }
  }, [isPro, authLoading])

  // 各種隱藏條件 — 一律 return null
  if (authLoading || isPro || dismissed || taken === null) return null
  const remaining = TOTAL_SLOTS - taken
  if (remaining <= 0) return null   // 售完自動藏

  const progressPct = Math.min(100, Math.round((taken / TOTAL_SLOTS) * 100))
  const urgent = remaining <= 20   // 剩 20 名以下用更急迫的紅色

  function handleDismiss() {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* localStorage 不可用就算 */ }
    setDismissed(true)
  }

  return (
    <div className="px-4 py-2">
      <div
        className={`relative max-w-7xl mx-auto rounded-xl border backdrop-blur-md overflow-hidden ${
          urgent
            ? 'bg-gradient-to-r from-red-500/15 via-orange-500/15 to-amber-500/15 border-red-500/40'
            : 'bg-gradient-to-r from-orange-500/15 to-amber-500/15 border-orange-500/40'
        }`}
        style={{
          boxShadow: urgent
            ? '0 0 30px rgba(239,68,68,0.15)'
            : '0 0 20px rgba(249,115,22,0.12)',
        }}
      >
        {/* 進度條背景 — 直接畫在 banner 底部，視覺帶緊迫感 */}
        <div
          className="absolute bottom-0 left-0 h-1"
          style={{
            width: `${progressPct}%`,
            background: urgent
              ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
              : 'linear-gradient(90deg, #f97316, #f59e0b)',
            transition: 'width 0.6s ease',
          }}
        />

        <div className="px-4 py-3 pr-10">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Icon + tagline */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-2xl leading-tight flex-shrink-0">
                {urgent ? '🔥' : '🎁'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                  <span>早鳥優惠</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${urgent ? 'bg-red-500/30 text-red-100' : 'bg-orange-500/30 text-orange-100'}`}>
                    限前 {TOTAL_SLOTS} 名
                  </span>
                </div>
                <div className="text-xs text-white/80 mt-0.5 leading-relaxed">
                  Pro 首年 <strong className="text-amber-200">NT$ {PRICE_EARLYBIRD.toLocaleString()}</strong>
                  <span className="text-white/40 line-through ml-1.5">NT$ {PRICE_REGULAR.toLocaleString()}</span>
                  <span className="ml-2">·</span>
                  <span className={`ml-1.5 font-semibold ${urgent ? 'text-red-200' : 'text-amber-200'}`}>
                    剩 {remaining} 名（已售 {taken} / {TOTAL_SLOTS}）
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <Link
              to="/pricing"
              className={`flex-shrink-0 inline-flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                urgent
                  ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
              }`}
            >
              立即升級 Pro →
            </Link>
          </div>
        </div>

        {/* 關閉按鈕 */}
        <button
          onClick={handleDismiss}
          aria-label="關閉早鳥優惠提示"
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white/90 text-sm"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
