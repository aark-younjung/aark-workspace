import { normalizeUrl } from '../../lib/url.js'

const DIMENSIONS = ['seo', 'aeo', 'geo', 'eeat']

// 「我的網站」資料整理：查詢留在 React 元件，這裡只做可測試的純資料轉換。
function normalizedHost(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function latestForWebsiteIds(rows, websiteIds) {
  return (rows || [])
    .filter(row => websiteIds.has(row.website_id))
    .reduce((latest, row) => {
      if (!latest) return row
      return new Date(row.created_at).getTime() > new Date(latest.created_at).getTime() ? row : latest
    }, null)
}

function shortestWebsite(rows) {
  return [...rows].sort((a, b) => {
    const lengthDiff = normalizeUrl(a.url).length - normalizeUrl(b.url).length
    if (lengthDiff !== 0) return lengthDiff
    return String(a.id).localeCompare(String(b.id))
  })[0]
}

// 頁面標籤：websites.name 存的是 hostname（建立時就這樣寫死，跟頁面無關），
// 分不出「這是首頁還是品牌頁」，改從 url 的 path 現拆。中文網址通常是
// percent-encode 存的（%E5%93%81...），decode 回可讀字才有意義。
function pageLabel(url) {
  try {
    const u = new URL(url)
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, '')
    return path || '首頁'
  } catch {
    return url || '（網址待修正）'
  }
}

export function buildSiteCards({ websites = [], brands = [], audits = {} } = {}) {
  const groups = new Map()

  for (const website of websites) {
    const host = normalizedHost(website.url)
    // ponytail: 歷史資料若有無法解析的 URL，不讓它消失；只獨立成卡、不跨 row 猜網域。
    const key = host || `invalid:${website.id}`
    if (!groups.has(key)) groups.set(key, { host: host || website.url || '網址待修正', websites: [] })
    groups.get(key).websites.push(website)
  }

  const brandByWebsiteId = new Map(brands.filter(brand => brand.website_id).map(brand => [brand.website_id, brand]))

  return [...groups.values()].map(group => {
    const linkedWebsite = group.websites.find(website => brandByWebsiteId.has(website.id))
    const representative = linkedWebsite || shortestWebsite(group.websites)
    const brand = linkedWebsite ? brandByWebsiteId.get(linkedWebsite.id) : null
    const websiteIds = new Set(group.websites.map(website => website.id))
    const latestByDimension = Object.fromEntries(
      DIMENSIONS.map(dimension => [dimension, latestForWebsiteIds(audits[dimension], websiteIds)])
    )
    const readyScores = DIMENSIONS
      .map(dimension => latestByDimension[dimension]?.score)
      .filter(score => Number.isFinite(Number(score)))
      .map(Number)
    const auditDates = DIMENSIONS
      .map(dimension => latestByDimension[dimension]?.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

    // 每一頁各自的入口：card 主連結只導向代表頁，同網域其他頁掃完資料進得去、
    // 沒有這份清單就出不來（2026-08-19 用戶實測發現：品牌頁掃完看得到，
    // 離開後在「我的網站」再也點不回去）。代表頁排最前，其餘依網址長度排序。
    const orderedPages = [...group.websites].sort((a, b) => {
      if (a.id === representative.id) return -1
      if (b.id === representative.id) return 1
      return normalizeUrl(a.url).length - normalizeUrl(b.url).length
    }).map(website => ({ id: website.id, label: pageLabel(website.url) }))

    return {
      host: group.host,
      websiteId: representative.id,
      // 整組網域底下所有 websites row 的 id——刪除要整組刪，只刪代表列會讓卡片「刪了卻還在」
      websiteIds: group.websites.map(website => website.id),
      // 每一頁各自可點進去的入口（代表頁排最前）；只有一頁時 UI 端不用顯示這份清單
      pages: orderedPages,
      name: brand?.name || representative.name || group.host,
      pageCount: group.websites.length,
      aivisState: brand ? 'linked' : 'unlinked',
      brandId: brand?.id || null,
      // 四面向齊全才顯示合成分數，避免把缺資料誤當 0 分或用部分樣本誤導。
      technicalScore: readyScores.length === DIMENSIONS.length
        ? Math.round(readyScores.reduce((sum, score) => sum + score, 0) / DIMENSIONS.length)
        : null,
      technicalReadyCount: readyScores.length,
      lastScannedAt: auditDates[0] || null,
    }
  }).sort((a, b) => {
    const dateDiff = new Date(b.lastScannedAt || 0).getTime() - new Date(a.lastScannedAt || 0).getTime()
    return dateDiff || a.host.localeCompare(b.host)
  })
}

export function formatLastScan(value, now = new Date()) {
  if (!value) return '尚未掃描'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '時間待確認'
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return '剛剛'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分鐘前`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小時前`
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(date)
}
