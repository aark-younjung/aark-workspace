import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * 首頁早鳥優惠 banner（亮色版）— 邏輯照抄暗色版 EarlybirdBanner
 * （即時名額／進度條／售完自動藏／關閉記憶），只換視覺外殼。
 * STORAGE_KEY 跟暗色版共用同一把 key：使用者關過一次，兩邊都記得，
 * 不會硬切後又跳出來一次讓人以為沒關掉。
 */
const TOTAL_SLOTS = 100
const PRICE_EARLYBIRD = 11880
const PRICE_REGULAR = 13900
const STORAGE_KEY = 'dismissed_earlybird_banner'
const COUNTER_REVEAL_THRESHOLD = 20

export default function HomeLightEarlybird() {
  const { isPro, loading: authLoading } = useAuth()
  const [taken, setTaken] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    if (authLoading || isPro) return
    let cancelled = false
    fetch('/api/public?action=stats')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setTaken(d.earlybird_taken ?? 0) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isPro, authLoading])

  if (authLoading || isPro || dismissed || taken === null) return null
  const remaining = TOTAL_SLOTS - taken
  if (remaining <= 0) return null

  const progressPct = Math.min(100, Math.round((taken / TOTAL_SLOTS) * 100))
  const urgent = remaining <= 20
  const showCounter = taken >= COUNTER_REVEAL_THRESHOLD

  function handleDismiss() {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* localStorage 不可用就算 */ }
    setDismissed(true)
  }

  return (
    <div className="hl-early">
      <div className={`card${urgent ? ' is-urgent' : ''}`}>
        {showCounter && <div className="bar" style={{ width: `${progressPct}%` }} />}
        <div className="in">
          <span className="ic">{urgent ? '🔥' : '🎁'}</span>
          <div className="tx">
            <div className="t">早鳥優惠 <span className="tag">限前 {TOTAL_SLOTS} 名</span></div>
            <div className="d">
              Pro 首年 <b>NT$ {PRICE_EARLYBIRD.toLocaleString()}</b>
              <span className="was">NT$ {PRICE_REGULAR.toLocaleString()}</span>
              {showCounter && <span className="left">・剩 {remaining} 名（已售 {taken} / {TOTAL_SLOTS}）</span>}
            </div>
          </div>
          <Link to="/pricing" className="cta">立即升級 Pro →</Link>
        </div>
        <button type="button" className="x" onClick={handleDismiss} aria-label="關閉早鳥優惠提示">✕</button>
      </div>
    </div>
  )
}
