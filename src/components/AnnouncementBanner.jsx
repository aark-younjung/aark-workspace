import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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

function getDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(raw.split(',').filter(Boolean)) : new Set()
  } catch { return new Set() }
}
function addDismissed(id) {
  try {
    const set = getDismissed()
    set.add(id)
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

  useEffect(() => {
    // 等 auth 確定再撈,避免 isPro 從 undefined→true 切換時誤過濾
    if (authLoading) return
    let cancelled = false
    supabase
      .from('announcements')
      .select('id, title, content, kind, target, link_url, link_text')
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

  function handleDismiss(id) {
    addDismissed(id)
    setDismissed(prev => new Set([...prev, id]))
  }

  const visible = items.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 px-4 py-2">
      {visible.map(a => {
        const style = KIND_STYLE[a.kind] || KIND_STYLE.info
        return (
          <div
            key={a.id}
            className={`relative max-w-7xl mx-auto rounded-xl border backdrop-blur-md ${style.bg} px-4 py-3 pr-10`}
          >
            <div className="flex items-start gap-3 flex-wrap">
              <span className="text-lg leading-tight pt-0.5">{style.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${style.titleText}`}>{a.title}</p>
                <p className={`text-xs mt-0.5 whitespace-pre-wrap ${style.text}`}>{a.content}</p>
              </div>
              {a.link_url && (
                <div className="flex-shrink-0">
                  <CTA url={a.link_url} text={a.link_text} kindStyle={style} />
                </div>
              )}
            </div>
            <button
              onClick={() => handleDismiss(a.id)}
              aria-label="關閉公告"
              className={`absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors ${style.text}`}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
