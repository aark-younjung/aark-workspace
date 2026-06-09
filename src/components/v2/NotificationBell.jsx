/**
 * NotificationBell — 公告鈴鐺（2026-06-06）
 *
 * 取代之前 hero / dashboard 上的 BriefingCard 卡片堆疊。
 * 設計理念：公告 = inbox 概念、不是 banner 概念。
 *   Banner 占畫面、用戶會盲視；inbox 縮在角落、有未讀數提示、用戶主動打開。
 *
 * UX 流程：
 *   1. 右上角 🔔 + 紅點 badge（未讀數）— 0 條時鈴鐺隱藏
 *   2. 點鈴鐺 → 下拉 panel 列所有公告（admin DB + hardcoded fallback）
 *   3. 每張公告可單獨 × 關閉、localStorage 記住 dismissed
 *   4. 點 panel 外 / ESC → 關閉 panel
 *   5. 「全部清除」一鍵清掉所有公告
 *
 * 跟 SaaS 業界對齊：GitHub / Notion / Slack 都是這個 pattern。
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// 開發端 hardcoded 公告（產品變更紀錄）— admin DB 沒推時 fallback 用
// 越前面越優先顯示
const HARDCODED_BRIEFINGS = [
  {
    id: 'hc-launch-2026-06-09',
    type: 'promo',
    title: '🎉 方舟 AI 雷達正式上線、早鳥 100 名首年 NT$990／月',
    body: '台灣第一個完整覆蓋 LLMO（5 訊號層）的監測平台正式對外開放。前 100 名付費用戶享早鳥首年 NT$990／月（年繳 NT$11,880、現省 22%）、4 週內或額滿截止。Pro 全功能 7 天免費試用 + 14 天無條件退款。',
  },
  {
    id: 'hc-agency-waitlist-2026-06-09',
    type: 'notice',
    title: '🤝 Agency 方案候補名單開放登記',
    body: '50 站追蹤 + 多客戶工作區 + 完整白標 + 優先客服。預計 1-2 個月內推出、候補名單享早期優惠。代理商 / 設計工作室可到 Pricing 頁登記、把你的需求告訴我們、幫我們把方案設計成你想要的樣子。',
  },
  {
    id: 'hc-bell-launch',
    type: 'feature',
    title: '公告改成鈴鐺通知',
    body: '從跑馬燈 + 卡片堆疊改成這個鈴鐺、跟 GitHub / Notion 一致 — 不打擾主畫面、有未讀數提醒。',
  },
  {
    id: 'hc-dashboard-v2-launch',
    type: 'feature',
    title: 'Dashboard v2 正式上線',
    body: '5 Tab 站點體檢、徽章 hover 看達標、修復工具箱「我已修好 +5 XP」— 不適應的話 TopBar 還有「← 切回舊版」按鈕。',
  },
  {
    id: 'hc-sitemap-fix',
    type: 'fix',
    title: 'BulkScan 抓 sitemap 成功率提升',
    body: '改讀 robots.txt + 路徑擴充 + 重試機制、之前 60-70% 成功率拉到 90%+。',
  },
  {
    id: 'hc-lastmod-signal',
    type: 'feature',
    title: '新增 lastmod 內容新鮮度訊號',
    body: 'GEO Audit 加入 article:modified_time 自動偵測、LLM 偏好引用 ≤ 365 天內容。',
  },
]

const TYPE_STYLE = {
  feature: { dot: '#86efac', emoji: '🆕', label: '功能更新' },
  fix:     { dot: '#93c5fd', emoji: '🔧', label: '修復改善' },
  notice:  { dot: '#fcd34d', emoji: '⚠️', label: '系統通知' },
  promo:   { dot: '#fdba74', emoji: '🎉', label: '限時優惠' },
}

const KIND_TO_TYPE = {
  info:    'fix',
  warn:    'notice',
  promo:   'promo',
  success: 'feature',
}

const STORAGE_KEY = 'aark_notif_dismissed'

function getDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveDismissed(set) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) } catch {}
}

export default function NotificationBell() {
  const { isPro, loading: authLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [adminItems, setAdminItems] = useState([])
  const [dismissed, setDismissed] = useState(getDismissed)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)

  // 從 supabase 拉 admin announcements
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

  // 合併 admin + hardcoded
  const allItems = [
    ...adminItems,
    ...HARDCODED_BRIEFINGS.map(b => ({ ...b, dismissKey: `hc:${b.id}` })),
  ]
  const visible = allItems.filter(b => !dismissed.has(b.dismissKey))
  const unreadCount = visible.length

  // 點 panel 外 / ESC 關 panel
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)
          && buttonRef.current && !buttonRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function handleDismiss(key) {
    const next = new Set(dismissed)
    next.add(key)
    setDismissed(next)
    saveDismissed(next)
  }

  function handleClearAll() {
    const next = new Set(dismissed)
    visible.forEach(v => next.add(v.dismissKey))
    setDismissed(next)
    saveDismissed(next)
  }

  // 0 條未讀 → 鈴鐺隱藏（避免空鈴鐺占位）
  if (unreadCount === 0) return null

  return (
    <div className="relative">
      {/* 鈴鐺按鈕 */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
        aria-label={`公告 ${unreadCount} 條未讀`}
        title={`${unreadCount} 條未讀公告`}
      >
        <svg className="w-5 h-5 text-white/85" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {/* 紅點 badge */}
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-sm font-bold flex items-center justify-center border-2 border-black/60">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      </button>

      {/* 下拉 panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, #0a0c10 0%, #050608 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            maxHeight: 'min(560px, calc(100vh - 100px))',
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">📰</span>
              <h3 className="text-sm font-bold text-white">本週通報</h3>
              <span className="text-sm font-mono text-white/45">· {unreadCount} 條</span>
            </div>
            <button
              onClick={handleClearAll}
              className="text-sm text-white/45 hover:text-white transition-colors"
            >
              全部清除
            </button>
          </div>

          {/* Panel body */}
          <div className="flex-1 overflow-y-auto p-2">
            {visible.map(b => {
              const style = TYPE_STYLE[b.type] || TYPE_STYLE.notice
              return (
                <div
                  key={b.dismissKey}
                  className="relative px-3 py-3 rounded-lg hover:bg-white/3 group transition-colors"
                >
                  {/* 左側 type 色點 */}
                  <span
                    className="absolute left-0 top-3.5 w-1 h-1.5 rounded-full"
                    style={{ background: style.dot, boxShadow: `0 0 6px ${style.dot}` }}
                  />
                  <div className="flex items-start gap-2.5 pl-2">
                    <span className="text-base flex-shrink-0 mt-0.5">{style.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white truncate">{b.title}</span>
                        <span className="text-sm font-mono whitespace-nowrap flex-shrink-0" style={{ color: style.dot }}>
                          {style.label}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{b.body}</p>
                      {b.link && <BriefingLink link={b.link} text={b.linkText || '看詳細'} />}
                    </div>
                    <button
                      onClick={() => handleDismiss(b.dismissKey)}
                      className="flex-shrink-0 w-6 h-6 rounded text-white/30 hover:text-white hover:bg-white/5 flex items-center justify-center text-base opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="關閉這則通報"
                      title="關閉這則通報"
                    >×</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Panel footer — 未來可接 /changelog 完整紀錄頁 */}
          <div className="px-4 py-2.5 border-t border-white/8 text-center flex-shrink-0">
            <span className="text-sm text-white/35">
              更新由 <span className="text-white/50 font-mono">Aark</span> 團隊發布
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// link 內部 / 外部判斷
function BriefingLink({ link, text }) {
  const className = 'inline-block mt-1.5 text-sm font-bold text-orange-300 hover:text-orange-200 hover:underline'
  if (/^https?:\/\//i.test(link)) {
    return <a href={link} target="_blank" rel="noopener noreferrer" className={className}>{text} →</a>
  }
  return <Link to={link} className={className}>{text} →</Link>
}
