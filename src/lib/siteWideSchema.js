/**
 * 站台層 schema 偵測 —— 解「單頁掃首頁 → 誤會全站沒有」的信任落差。
 *
 * 首頁掃描報「缺 FAQ / 麵包屑」時，去站台其他頁（FAQ 頁、內頁）實際驗證是不是其實有，
 * 找到就明白告訴用戶「你的 /faq/ 有 FAQ Schema，這一頁沒有是正常的」，不再冤枉人。
 *
 * ⚠️ 延續性（AGENTS.md 硬需求）：現行產品與改版共用這支邏輯，改版、大改版都要沿用。
 * 走 /api/fetch-url（與全站同一條 CORS 規則）；沿用 sitemap.js 的 fetchSitemapUrls / pageLabel。
 * 誠實：只回「我們檢查的這幾頁」，絕不宣稱「全站」都有／都沒有（我們只抓有限頁數）。
 */
import { fetchSitemapUrls, pageLabel } from './sitemap'

const API_BASE = '/api/fetch-url'

// 各 schema 的 HTML 指紋 + 候選頁優先序（用 URL 關鍵字挑，省 fetch 次數）
const SCHEMA_PROBES = {
  faq_schema: {
    label: 'FAQ Schema',
    test: html => /"@type"\s*:\s*"(FAQPage|QAPage)"/i.test(html),
    // FAQ schema 多在 FAQ 頁 → 優先 URL 含 faq／常見問題（含 URL-encoded）／問答 的頁
    rank: url => /faq|questions?|q-?and-?a|%E5%B8%B8%E8%A6%8B%E5%95%8F%E9%A1%8C|常見問題|問答/i.test(url) ? 0 : 1,
  },
  breadcrumbs: {
    label: '麵包屑',
    test: html => /"@type"\s*:\s*"BreadcrumbList"/i.test(html),
    // 麵包屑在任何內頁都可能有 → 不特別挑，照 sitemap 順序
    rank: () => 0,
  },
}

// 抓一頁 HTML（失敗回 null）
async function fetchHtml(url) {
  try {
    const res = await fetch(`${API_BASE}?url=${encodeURIComponent(url)}`)
    const data = await res.json().catch(() => null)
    return (res.ok && data?.success && data.content) ? data.content : null
  } catch {
    return null
  }
}

/**
 * 在站台其他頁找指定 schema。
 * @returns {Promise<{status:'found'|'absent'|'unknown', url?, label?, schemaLabel, checked?}>}
 *   - found：某頁有 → 回 url / label（好讀路徑）
 *   - absent：檢查的頁都沒有 → 回 checked（檢查了幾頁）
 *   - unknown：抓不到 sitemap，無法判斷 → 不下結論（誠實）
 * maxPages：最多抓幾頁（預設 5，控制 fetch 次數與等待時間）。
 */
export async function detectSchemaAcrossSite(pageUrl, schemaId, { maxPages = 5 } = {}) {
  const probe = SCHEMA_PROBES[schemaId]
  if (!probe) return { status: 'unknown', schemaLabel: schemaId }

  const others = await fetchSitemapUrls(pageUrl, 12)
  if (!others.length) return { status: 'unknown', schemaLabel: probe.label }

  // 依 rank 排序（相關頁優先），只取前 maxPages 頁去抓
  const candidates = others
    .map(url => ({ url, r: probe.rank(url) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, maxPages)
    .map(c => c.url)

  for (const url of candidates) {
    const html = await fetchHtml(url)
    if (html && probe.test(html)) {
      return { status: 'found', url, label: pageLabel(url), schemaLabel: probe.label }
    }
  }
  return { status: 'absent', schemaLabel: probe.label, checked: candidates.length }
}
