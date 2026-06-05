/**
 * BriefingCard — 統一公告卡片（2026-06-06）
 *
 * 取代之前的 AnnouncementBanner（6 秒輪播 marquee 風格）。
 * 設計理念：登入用戶 / 訪客每天看到的公告應該是「卡片堆疊」、不是輪播 —
 *   輪播會錯過、卡片堆疊一次看完。每張可單獨關閉、localStorage 記住 dismissed。
 *
 * 資料來源（優先級高→低）：
 *   1. supabase.from('announcements')  ← admin 管理的動態公告（最高優先）
 *   2. HARDCODED_BRIEFINGS             ← 開發端 hardcoded 的產品更新（fallback）
 *
 * Admin announcement kind → BriefingCard type mapping：
 *   info    → fix      （藍）
 *   warn    → notice   （黃）
 *   promo   → promo    （橘）
 *   success → feature  （綠）
 *
 * 用法：
 *   import BriefingCard from '../components/v2/BriefingCard'
 *   <BriefingCard maxItems={3} />
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// 開發端 hardcoded 公告（產品變更紀錄）— 當 admin 還沒 push 公告時 fallback 用
// 之後 admin DB 有就會優先顯示這些 hardcoded 排在後面
const HARDCODED_BRIEFINGS = [
  {
    id: 'hc-dashboard-v2-launch',
    type: 'feature',
    title: 'Dashboard v2 正式上線',
    body: '5 Tab 站點體檢、徽章 hover 看達標、修復工具箱「我已修好 +5 XP」— 不適應的話 TopBar 還有「← 切回舊版」按鈕。',
    link: null,
    linkText: null,
  },
  {
    id: 'hc-sitemap-fix',
    type: 'fix',
    title: 'BulkScan 抓 sitemap 成功率大幅提升',
    body: '改讀 robots.txt + 路徑擴充 + 重試機制、之前 60-70% 成功率拉到 90%+，重掃看看吧。',
    link: null,
    linkText: null,
  },
  {
    id: 'hc-lastmod-signal',
    type: 'feature',
    title: '新增 lastmod 訊號',
    body: 'GEO Audit 加入「內容新鮮度」檢測 — LLM 偏好引用 ≤ 365 天的內容、現在會自動偵測你的 article:modified_time。',
    link: null,
    linkText: null,
  },
]

// 4 種類型 → 色彩 + 預設 emoji
const TYPE_STYLE = {
  feature: { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  accent: '#86efac', emoji: '🆕' },
  fix:     { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', accent: '#93c5fd', emoji: '🔧' },
  notice:  { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', accent: '#fcd34d', emoji: '⚠️' },
  promo:   { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', accent: '#fdba74', emoji: '🎉' },
}

// Admin DB 用的 kind 對應到本元件的 type
const KIND_TO_TYPE = {
  info:    'fix',
  warn:    'notice',
  promo:   'promo',
  success: 'feature',
}

const STORAGE_KEY = 'aark_briefing_dismissed'

function getDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch { /* localStorage 不可用就算了、重整後會再出現 */ }
}

export default function BriefingCard({ maxItems = 3, showTitle = true, className = '' }) {
  const { isPro, loading: authLoading } = useAuth()
  const [adminItems, setAdminItems] = useState([])
  const [dismissed, setDismissed] = useState(getDismissed)

  // 從 supabase 拉 admin-managed announcements、按 target (all/pro/free) 過濾
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    supabase
      .from('announcements')
      .select('id, title, content, kind, target, link_url, link_text, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return
        const filtered = data
          .filter(a => {
            if (a.target === 'all') return true
            if (a.target === 'pro') return isPro
            if (a.target === 'free') return !isPro
            return true
          })
          .map(a => ({
            id: 'adm-' + a.id,
            // dismissKey 用 `${id}:${updated_at}` — admin 編輯後 updated_at 變新、dismissed users 會重看
            dismissKey: `adm:${a.id}:${a.updated_at || ''}`,
            type: KIND_TO_TYPE[a.kind] || 'notice',
            title: a.title,
            body: a.content,
            link: a.link_url,
            linkText: a.link_text,
          }))
        setAdminItems(filtered)
      })
    return () => { cancelled = true }
  }, [isPro, authLoading])

  // 合併：admin 公告優先、hardcoded 排在後面
  const allItems = [
    ...adminItems,
    ...HARDCODED_BRIEFINGS.map(b => ({ ...b, dismissKey: `hc:${b.id}` })),
  ]

  const visible = allItems
    .filter(b => !dismissed.has(b.dismissKey))
    .slice(0, maxItems)

  function handleDismiss(key) {
    const next = new Set(dismissed)
    next.add(key)
    setDismissed(next)
    saveDismissed(next)
  }

  if (visible.length === 0) return null

  return (
    <section className={`mb-6 rounded-2xl p-4 sm:p-5 ${className}`} style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {showTitle && (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            📰 本週通報 <span className="text-sm font-normal text-white/40">· {visible.length} 條未讀</span>
          </h3>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {visible.map(b => {
          const style = TYPE_STYLE[b.type] || TYPE_STYLE.notice
          const emoji = b.emoji || style.emoji
          return (
            <div key={b.dismissKey} className="rounded-xl p-3 flex items-start gap-3" style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
            }}>
              <span className="text-xl flex-shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold mb-0.5" style={{ color: style.accent }}>
                  {b.title}
                </div>
                <p className="text-sm text-white/65 leading-relaxed">{b.body}</p>
                {b.link && (
                  <BriefingLink link={b.link} text={b.linkText || '看詳細'} color={style.accent} />
                )}
              </div>
              <button
                onClick={() => handleDismiss(b.dismissKey)}
                className="flex-shrink-0 w-6 h-6 rounded text-white/35 hover:text-white hover:bg-white/5 flex items-center justify-center text-base"
                aria-label="關閉這則通報"
                title="關閉這則通報"
              >×</button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// link 內部 / 外部判斷
function BriefingLink({ link, text, color }) {
  const className = 'inline-block mt-1.5 text-sm font-bold hover:underline'
  if (/^https?:\/\//i.test(link)) {
    return <a href={link} target="_blank" rel="noopener noreferrer" className={className} style={{ color }}>{text} →</a>
  }
  return <Link to={link} className={className} style={{ color }}>{text} →</Link>
}
