/**
 * 從 sitemap.xml 抓「網站還有哪些頁」——解「只掃一頁」造成的信任落差。
 *
 * 2026-07-27：用戶在別頁做了 FAQ、首頁沒有，我們卻用全站口氣說「你沒有 FAQ」。
 * 掃完首頁後把 sitemap 的其他頁列出來、讓用戶一鍵改掃那頁，就不會冤枉人。
 *
 * 刻意保守：只抓「一般內容頁」、砍掉系統路徑；最多回 8 筆；失敗回空陣列（不影響掃描）。
 */

import { normalizeUrl } from './url'

const API_BASE = '/api/fetch-url'

// 系統/非內容路徑（wp-json、feed、附件、標籤頁…）不列給用戶掃
const SKIP = /\/(wp-json|wp-content|wp-admin|feed|comments|xmlrpc|\?|tag\/|category\/|author\/|page\/\d)/i
const ASSET = /\.(xml|json|jpg|jpeg|png|gif|webp|svg|pdf|css|js)(\?|$)/i

// 抓一個網址、回 XML 內容字串（失敗回 null）
async function fetchXml(url) {
  try {
    const res = await fetch(`${API_BASE}?url=${encodeURIComponent(url)}`)
    const data = await res.json().catch(() => null)
    return (res.ok && data?.success && data.content) ? data.content : null
  } catch {
    return null
  }
}

// 找得到的第一個 sitemap XML：先讀 robots.txt 的 Sitemap: 宣告，再退回常見路徑。
// WordPress 慣例很分歧：Rank Math/Yoast=/sitemap_index.xml、WP 核心=/wp-sitemap.xml、其他=/sitemap.xml
async function locateSitemap(origin) {
  const robots = await fetchXml(origin + '/robots.txt')
  const declared = robots ? [...robots.matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1]) : []
  const candidates = [...declared, origin + '/sitemap_index.xml', origin + '/sitemap.xml', origin + '/wp-sitemap.xml']
  for (const url of candidates) {
    const xml = await fetchXml(url)
    if (xml && xml.includes('<loc>')) return xml
  }
  return null
}

/** 回傳 sitemap 裡的其他頁面網址（已正規化、去重、排除目前這頁），最多 limit 筆 */
export async function fetchSitemapUrls(pageUrl, limit = 8) {
  let origin
  try { origin = new URL(pageUrl).origin } catch { return [] }
  const current = normalizeUrl(pageUrl)

  let xml = await locateSitemap(origin)
  if (!xml) return []

  let locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])

  // sitemap index（<loc> 指向的還是 .xml）→ 展開第一個「內容型」子 sitemap（跳過 image/author 等）
  if (locs.length && locs.every(l => /\.xml(\?|$)/i.test(l))) {
    const sub = locs.find(l => !/(image|video|author|category|tag)/i.test(l)) || locs[0]
    const subXml = await fetchXml(sub)
    locs = subXml ? [...subXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]) : []
  }

  const seen = new Set([current])
  const out = []
  for (const raw of locs) {
    if (ASSET.test(raw) || SKIP.test(raw) || /\.xml(\?|$)/i.test(raw)) continue
    const u = normalizeUrl(raw)
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
    if (out.length >= limit) break
  }
  return out
}

/** 把網址縮成好讀的路徑標籤：/、/about、/常見問題 */
export function pageLabel(url) {
  try {
    const p = decodeURIComponent(new URL(url).pathname).replace(/\/$/, '')
    return p === '' ? '首頁 /' : p
  } catch {
    return url
  }
}
