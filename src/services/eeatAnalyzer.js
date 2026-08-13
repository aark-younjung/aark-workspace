/**
 * E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) 分析服務
 * 檢測 8 項可信度與權威度技術指標（從 HTML 直接檢測，不需付費 API）
 */

import { fetchPageContent, parseHTML } from './seoAnalyzer'
import { isHomepage } from '../lib/pageAudit'

// 社群平台網域 —— checkSocialLinks 用來「加分」（有社群＝可信度訊號）、
// checkOutboundLinks 用來「排除」（自家社群連結不能冒充「外部權威引用」重複計分）
const SOCIAL_DOMAINS = [
  'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com',
  'x.com', 'youtube.com', 'line.me', 'tiktok.com', 'threads.net',
  'pinterest.com', 'weibo.com'
]

/**
 * 把頁面裡所有 JSON-LD 攤平成「節點陣列」——關鍵是要展開 @graph。
 *
 * 2026-07-27 修：Rank Math / Yoast 等現代 WordPress SEO 外掛，會把 Organization、
 * Person、WebSite… 全部包進一個 { "@graph": [...] } 裡。舊版用 [].concat(JSON.parse())
 * 只拿到最外層那顆（@type=undefined），@graph 內的節點全看不到 → Organization/作者/日期
 * 在大量 WP 網站被誤判成「沒有」、E-E-A-T 分數被系統性壓低。這裡遞迴展開 @graph 修掉它。
 */
function collectJsonLdNodes(doc) {
  const nodes = []
  const push = (o) => {
    if (!o || typeof o !== 'object') return
    if (Array.isArray(o)) { o.forEach(push); return }
    nodes.push(o)
    if (Array.isArray(o['@graph'])) o['@graph'].forEach(push)   // 展開 @graph
  }
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { push(JSON.parse(script.textContent)) } catch { /* 壞掉的 JSON-LD 跳過 */ }
  }
  return nodes
}

// 節點的 @type 可能是字串或陣列（如 ["LegalService","Organization"]）→ 一律轉成陣列比對
const typesOf = (node) => [].concat(node?.['@type'] || [])

/**
 * 1. 作者資訊 - 頁面是否有可識別的作者（2026-08-13 校正：分頁型）
 * - 首頁：schema 有 Person／擁有者節點即可（店家首頁沒有「文章署名」概念，擁有者訊號就夠）
 * - 內頁（文章）：要有真的署名訊號（rel/itemprop=author、作者 class、JSON-LD author 欄位）；
 *   不再接受「頁面某處剛好有 Person 節點」——Rank Math 會把擁有者 Person 塞進全站 @graph，
 *   拿它當文章署名是假陽性（新站沒署名也全過，分數失真）
 */
function checkAuthorInfo(doc, onHome) {
  // rel="author" 或 itemprop="author"
  if (doc.querySelectorAll('[rel="author"], [itemprop="author"]').length > 0) return { passed: true }
  // 常見作者 class
  if (doc.querySelector('.author, .byline, .post-author, .article-author')) return { passed: true }
  // JSON-LD（含 @graph）中的 author 欄位（文章的 author 屬性，任何頁型都算）
  if (collectJsonLdNodes(doc).some(s => s.author)) return { passed: true }
  // 只有首頁接受「有 Person 節點」當擁有者訊號
  if (onHome && collectJsonLdNodes(doc).some(s => typesOf(s).includes('Person'))) return { passed: true }
  return { passed: false }
}

/**
 * 2. About 頁面 - 是否有「關於我們」連結
 */
function checkAboutPage(doc) {
  const keywords = ['about', '關於', 'about-us', 'aboutus', 'company', '公司', '我們', '品牌']
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    const text = (link.textContent || '').toLowerCase()
    if (keywords.some(k => href.includes(k) || text.includes(k))) return { passed: true }
  }
  return { passed: false }
}

/**
 * 3. Contact 頁面 - 是否有聯絡方式連結
 */
function checkContactPage(doc) {
  const keywords = ['contact', '聯絡', '联络', 'contact-us', 'contactus', '聯系', '联系', '聯繫']
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    const text = (link.textContent || '').toLowerCase()
    if (keywords.some(k => href.includes(k) || text.includes(k))) return { passed: true }
  }
  // 備選：是否有 mailto: 或 tel: 連結
  if (doc.querySelector('a[href^="mailto:"], a[href^="tel:"]')) return { passed: true }
  // 2026-08-13 校正：LINE 官方帳號連結也算聯絡管道——台灣中小店家的主要聯絡方式就是 LINE，
  // 只認「聯絡」字樣/tel/mailto 會漏掉這類真實可聯絡的店家（假陰性）
  for (const link of doc.querySelectorAll('a[href]')) {
    if ((link.getAttribute('href') || '').toLowerCase().includes('line.me')) return { passed: true }
  }
  return { passed: false }
}

/**
 * 4. Privacy Policy - 是否有隱私權政策連結
 */
function checkPrivacyPolicy(doc) {
  const keywords = ['privacy', '隱私', '隐私', 'privacy-policy', 'privacypolicy', '個人資料', '资料保护']
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    const text = (link.textContent || '').toLowerCase()
    if (keywords.some(k => href.includes(k) || text.includes(k))) return { passed: true }
  }
  return { passed: false }
}

/**
 * 5. Organization Schema - 是否有機構/品牌結構化資料
 */
function checkOrganizationSchema(doc) {
  // LegalService/Dentist 等各種 *Business 子型別都算「機構 schema」；用 endsWith 兜住沒列到的
  const orgTypes = ['Organization', 'LocalBusiness', 'Corporation', 'NGO', 'LegalService',
    'EducationalOrganization', 'MedicalOrganization', 'Store', 'Restaurant', 'Hotel']
  const isOrg = t => orgTypes.includes(t) || t.endsWith('Business') || t.endsWith('Organization')
  const hit = collectJsonLdNodes(doc).some(s => typesOf(s).some(isOrg))
  return { passed: hit }
}

/**
 * 6. 發布/更新日期 - 是否標示內容時間
 */
function checkDatePublished(doc) {
  // Meta 標籤
  if (doc.querySelector('meta[property="article:published_time"], meta[property="article:modified_time"], meta[name="date"], meta[name="last-modified"]')) return { passed: true }
  // <time> 元素
  if (doc.querySelector('time[datetime]')) return { passed: true }
  // JSON-LD（含 @graph）
  if (collectJsonLdNodes(doc).some(s => s.datePublished || s.dateModified)) return { passed: true }
  return { passed: false }
}

/**
 * 7. 社群媒體連結 - 是否有社群帳號連結
 */
function checkSocialLinks(doc) {
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    if (SOCIAL_DOMAINS.some(d => href.includes(d))) return { passed: true }
  }
  return { passed: false }
}

/**
 * 8. 外部權威連結 - 是否連結到外部可信來源（至少 2 個）
 * 2026-08-13 校正：排除社群平台網域——自家 FB/IG/YT/LINE 連結已在第 7 項「社群連結」計分，
 * 再算進「外部權威引用」是重複計分＋灌水（新站掛滿自家社群就 20 個「權威外連」，失真）
 */
function checkOutboundLinks(doc, pageUrl) {
  let pageHostname = ''
  try { pageHostname = new URL(pageUrl).hostname } catch {}

  const outbound = Array.from(doc.querySelectorAll('a[href]')).filter(link => {
    const href = link.getAttribute('href') || ''
    if (!href.startsWith('http')) return false
    if (SOCIAL_DOMAINS.some(d => href.toLowerCase().includes(d))) return false   // 社群不算權威引用
    try {
      return new URL(href).hostname !== pageHostname
    } catch { return false }
  })
  return { passed: outbound.length >= 2, count: outbound.length }
}

/**
 * 主分析函式
 */
export async function analyzeEEAT(url) {
  try {
    // fetchPageContent 自 2026-05-22 改回傳 { html, sslFallback }，這裡只用 html
    const { html } = await fetchPageContent(url)
    const doc = parseHTML(html)
    const onHome = isHomepage(url)   // 頁型判斷：作者訊號的門檻依首頁/內頁不同

    const results = {
      author_info:          checkAuthorInfo(doc, onHome),
      about_page:           checkAboutPage(doc),
      contact_page:         checkContactPage(doc),
      privacy_policy:       checkPrivacyPolicy(doc),
      organization_schema:  checkOrganizationSchema(doc),
      date_published:       checkDatePublished(doc),
      social_links:         checkSocialLinks(doc),
      outbound_links:       checkOutboundLinks(doc, url),
    }

    const passed = Object.values(results).filter(r => r.passed).length
    const score = Math.round((passed / 8) * 100)

    return {
      score,
      author_info:          results.author_info.passed,
      about_page:           results.about_page.passed,
      contact_page:         results.contact_page.passed,
      privacy_policy:       results.privacy_policy.passed,
      organization_schema:  results.organization_schema.passed,
      date_published:       results.date_published.passed,
      social_links:         results.social_links.passed,
      outbound_links:       results.outbound_links.passed,
    }
  } catch (error) {
    console.error('EEAT analysis failed:', error)
    return {
      score: 0,
      author_info: false, about_page: false, contact_page: false,
      privacy_policy: false, organization_schema: false, date_published: false,
      social_links: false, outbound_links: false,
    }
  }
}
