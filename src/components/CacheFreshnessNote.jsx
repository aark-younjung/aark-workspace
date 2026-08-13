import { useEffect, useState } from 'react'
import { detectCacheInfo, describeCacheAge } from '../lib/cacheDetect'

/**
 * 快取新鮮度提示 —— 頁面由快取外掛供應且已放置一段時間時，提醒「剛改過內容請先清快取再掃」。
 * 解「改了卻沒變」的誤會（實案：Meta 84→72 字改成功，但 LiteSpeed 供舊快取，重掃仍 84）。
 *
 * 即時抓當下頁面（不是掃描存檔）——用戶清完快取重整本頁，提示會自己消失，形成正確回饋。
 * 現行產品（深色）與改版（亮色）共用；快取齡 < 60 分鐘視為新鮮、不顯示（避免對正常快取狼來了）。
 */

// 同一 URL 一個 session 只抓一次（四個 audit 詳情頁共用結果，省 fetch）
const probeCache = new Map()
function probeUrl(url) {
  if (!probeCache.has(url)) {
    probeCache.set(url, fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => (data?.success && data.content) ? detectCacheInfo(data.content) : null)
      .catch(() => null))
  }
  return probeCache.get(url)
}

export default function CacheFreshnessNote({ pageUrl, dark = false }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!pageUrl) return undefined
    probeUrl(pageUrl).then(result => { if (!cancelled) setInfo(result) })
    return () => { cancelled = true }
  }, [pageUrl])

  // 只在「有快取註記、且已放 ≥60 分鐘（或抓不到時間）」時顯示；新鮮快取不打擾
  if (!info) return null
  if (info.ageMinutes != null && info.ageMinutes < 60) return null

  const age = describeCacheAge(info.ageMinutes)
  // 主題色板（深色沿用頁面深底、亮色沿用 .appshell 卡片；amber 系＝提醒而非錯誤）
  const c = dark
    ? { bg: 'rgba(30,20,2,.55)', border: 'rgba(240,184,102,.35)', head: '#f0b866', text: '#c9b18a' }
    : { bg: '#fffaf0', border: '#f0d9ae', head: '#b45309', text: '#8a6d3b' }

  return (
    <div
      role="note"
      aria-live="polite"
      style={{
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
        padding: '12px 18px', marginBottom: 20, fontSize: 13.5, lineHeight: 1.7, color: c.text,
      }}
    >
      <b style={{ color: c.head }}>⏱ 這一頁目前由 <span translate="no">{info.plugin}</span> 供應快取版</b>
      {age && <>（{age}生成）</>}
      。如果你剛改過網站內容，掃描測到的可能還是舊版——請先到 WordPress 後台
      <b style={{ color: c.head }}>清除快取</b>（頂部管理列的快取圖示 → 清除全部），再重新掃描。
      <span style={{ opacity: .8 }}>　快取本身不是問題：AI 爬蟲平常讀到的也是這份快取。</span>
    </div>
  )
}
