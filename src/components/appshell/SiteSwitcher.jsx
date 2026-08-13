import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { buildSiteCards } from './siteData'

/**
 * 全域網站切換器（2026-08-13 第一批 · Codex IA 案）：
 * 原本每頁頂部只是靜態顯示網站名，要換站得跑回「我的網站」。改成原生 <select>
 * 直接切換，且**停留在同一個區塊**（在體檢頁切站 → 到新站的體檢頁）。
 * ponytail: 用原生 select（鍵盤/無障礙免費拿到），不做自訂下拉；站數大了再升級。
 */

// 站台清單 session 快取：四個分頁共用、切頁不重抓（資料變動重整頁面即可）
let sitesCache = { userId: null, promise: null }
function loadSites(userId) {
  if (sitesCache.userId === userId && sitesCache.promise) return sitesCache.promise
  sitesCache = {
    userId,
    promise: (async () => {
      const { data: websites } = await supabase
        .from('websites').select('id, name, url, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false })
      const ids = (websites || []).map(website => website.id)
      const { data: brands } = ids.length
        ? await supabase.from('aivis_brands').select('id, name, website_id').in('website_id', ids)
        : { data: [] }
      // 沿用「我的網站」同一套 host 分組（一站一選項，不會 96 個頁面 row 洗版）
      return buildSiteCards({ websites: websites || [], brands: brands || [], audits: {} })
    })(),
  }
  return sitesCache.promise
}

export default function SiteSwitcher({ websiteId, currentTitle }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cards, setCards] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!user?.id) return undefined
    loadSites(user.id).then(result => { if (!cancelled) setCards(result) }).catch(() => { if (!cancelled) setCards([]) })
    return () => { cancelled = true }
  }, [user?.id])

  // 目前所在區塊（/app/:id/<section>/...）；切站後停留在同區塊
  const section = location.pathname.split('/')[3] || 'overview'

  // 載入中或只有一站：維持靜態顯示（不放沒得選的下拉）
  if (!cards || cards.length < 2) {
    return (
      <div className="as-switcher">
        <span className="lab">網站</span>
        <span className="val">{currentTitle}</span>
      </div>
    )
  }

  // 目前網站可能是「非代表 row」（同站其他頁的 id）→ 不在選項裡就補一個目前項，讓 select 顯示正確
  const hasCurrent = cards.some(card => card.websiteId === websiteId)

  return (
    <div className="as-switcher as-switcher-select">
      <label className="lab" htmlFor="site-switcher">網站</label>
      <select
        id="site-switcher"
        value={websiteId}
        onChange={event => navigate(`/app/${event.target.value}/${section}`)}
      >
        {!hasCurrent && <option value={websiteId}>{currentTitle}</option>}
        {cards.map(card => (
          <option key={card.websiteId} value={card.websiteId}>{card.name}</option>
        ))}
      </select>
    </div>
  )
}
