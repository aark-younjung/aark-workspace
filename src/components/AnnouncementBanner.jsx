import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// 多則公告時的輪播間隔（毫秒）— 6 秒夠看完一則短內容、又不會太快讓人累
const ROTATE_INTERVAL_MS = 6000

// 公告類型 → banner 視覺（與 admin/AdminAnnouncements.jsx 的 KIND_META 同步）
const KIND_STYLE = {
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-200',
    titleText: 'text-blue-100',
    cta: 'bg-blue-500 hover:bg-blue-600 text-white',
    emoji: 'ℹ️',
  },
  warn: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-200',
    titleText: 'text-amber-100',
    cta: 'bg-amber-500 hover:bg-amber-600 text-white',
    emoji: '⚠️',
  },
  promo: {
    bg: 'bg-gradient-to-r from-orange-500/15 to-amber-500/15 border-orange-500/40',
    text: 'text-orange-100',
    titleText: 'text-white',
    cta: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white',
    emoji: '🎉',
  },
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-200',
    titleText: 'text-emerald-100',
    cta: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    emoji: '✅',
  },
}

const STORAGE_KEY = 'dismissed_announcements'

// dismiss key 用 `${id}:${updated_at}` 組合 — admin 編輯後 updated_at 變新值，
// 等於「新公告」，原本被 dismiss 過的也會重新顯示，解決「編輯後前台看不到」問題
function dismissKey(id, updatedAt) {
  return `${id}:${updatedAt || ''}`
}
function getDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(raw.split(',').filter(Boolean)) : new Set()
  } catch { return new Set() }
}
function addDismissed(key) {
  try {
    const set = getDismissed()
    set.add(key)
    localStorage.setItem(STORAGE_KEY, [...set].join(','))
  } catch { /* localStorage 不可用就算了 — 重整後 banner 會再出現 */ }
}

// 單筆 banner 渲染。CTA 連結:站內路徑用 <Link>,外部 http(s) 用 <a target="_blank">
function CTA({ url, text, kindStyle }) {
  if (!url) return null
  const label = text || '了解更多'
  const className = `inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${kindStyle.cta}`
  if (/^https?:\/\//i.test(url)) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className={className}>{label} →</a>
  }
  return <Link to={url} className={className}>{label} →</Link>
}

export default function AnnouncementBanner() {
  const { isPro, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [dismissed, setDismissed] = useState(getDismissed())
  const [currentIndex, setCurrentIndex] = useState(0)
  // 是否暫停輪播（hover 時為 true）
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // 等 auth 確定再撈,避免 isPro 從 undefined→true 切換時誤過濾
    if (authLoading) return
    let cancelled = false
    supabase
      .from('announcements')
      .select('id, title, content, kind, target, link_url, link_text, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return
        // 期間過濾走 RLS（DB 端已篩過 is_active + 時間窗口）;只剩 target 在 client filter
        const filtered = data.filter(a => {
          if (a.target === 'all') return true
          if (a.target === 'pro') return isPro
          if (a.target === 'free') return !isPro
          return true
        })
        setItems(filtered)
      })
    return () => { cancelled = true }
  }, [isPro, authLoading])

  function handleDismiss(id, updatedAt) {
    const key = dismissKey(id, updatedAt)
    addDismissed(key)
    setDismissed(prev => new Set([...prev, key]))
  }

  // 用 `${id}:${updated_at}` 比對 dismissed — 編輯後 updated_at 變新值 → 不在 set 內 → 重新顯示
  const visible = items.filter(a => !dismissed.has(dismissKey(a.id, a.updated_at)))

  // 輪播：visible.length > 1 時每 6 秒切下一則（hover 暫停 + 尊重用戶 reduced-motion 偏好）
  useEffect(() => {
    if (visible.length <= 1 || paused) return
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (prefersReducedMotion) return   // 系統設「減少動畫」就不輪播、直接全部 stack（fallback 渲染）

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visible.length)
    }, ROTATE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible.length, paused])

  // 公告被 dismiss 後可能讓 currentIndex 越界 → 重設到 0
  useEffect(() => {
    if (currentIndex >= visible.length && visible.length > 0) setCurrentIndex(0)
  }, [visible.length, currentIndex])

  if (visible.length === 0) return null

  // reduced-motion fallback：直接堆疊全部（不輪播、無動畫）
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (prefersReducedMotion && visible.length > 1) {
    return (
      <div className="space-y-2 px-4 py-2">
        {visible.map(a => <AnnouncementCard key={a.id} a={a} onDismiss={handleDismiss} />)}
      </div>
    )
  }

  // 主要渲染：單則直接顯示、多則用 absolute 疊放 + opacity 切換（簡單可靠）
  const current = visible[currentIndex] || visible[0]

  return (
    <div
      className="px-4 py-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        key={current.id}
        className="announcement-rotate-enter"
        style={{ animation: 'announcementRotateIn 500ms ease-out' }}
      >
        <AnnouncementCard a={current} onDismiss={handleDismiss} />
      </div>

      {/* 多則時顯示小指示點（哪一則 / 共幾則 + 暫停提示） */}
      {visible.length > 1 && (
        <div className="max-w-7xl mx-auto mt-1.5 flex items-center justify-center gap-1.5">
          {visible.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setCurrentIndex(i)}
              aria-label={`切到第 ${i + 1} 則公告`}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'w-6 bg-white/60'
                  : 'w-1.5 bg-white/20 hover:bg-white/35'
              }`}
            />
          ))}
          <span className="ml-2 text-[10px] text-white/30">
            {paused ? '已暫停 · 移開繼續' : `${currentIndex + 1} / ${visible.length}`}
          </span>
        </div>
      )}

      {/* 輪播淡入動畫（inline 避免污染全域 CSS） */}
      <style>{`
        @keyframes announcementRotateIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// 單則公告卡（抽出來給輪播 + reduced-motion fallback 兩個地方共用）
function AnnouncementCard({ a, onDismiss }) {
  const style = KIND_STYLE[a.kind] || KIND_STYLE.info
  return (
    <div className={`relative max-w-7xl mx-auto rounded-xl border backdrop-blur-md ${style.bg} px-4 py-3 pr-10`}>
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-lg leading-tight pt-0.5">{style.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${style.titleText}`}>{a.title}</p>
          {/* 改 whitespace-normal — admin 打的換行不會被當斷行，只在容器寬度滿時自然 wrap。
              要強制換行讓 admin 在文案裡打 "\n"（後續若要支援可改 dangerouslySetInnerHTML + safe replace） */}
          <p className={`text-xs mt-0.5 whitespace-normal ${style.text}`}>{a.content}</p>
        </div>
        {a.link_url && (
          <div className="flex-shrink-0">
            <CTA url={a.link_url} text={a.link_text} kindStyle={style} />
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(a.id, a.updated_at)}
        aria-label="關閉公告"
        className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ${style.text}`}
      >
        ✕
      </button>
    </div>
  )
}
