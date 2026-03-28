/**
 * E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) 分析服務
 * 檢測 8 項可信度與權威度技術指標（從 HTML 直接檢測，不需付費 API）
 */

import { fetchPageContent, parseHTML } from './seoAnalyzer'

/**
 * 1. 作者資訊 - 頁面是否有可識別的作者
 */
function checkAuthorInfo(doc) {
  // rel="author" 或 itemprop="author"
  if (doc.querySelectorAll('[rel="author"], [itemprop="author"]').length > 0) return { passed: true }
  // 常見作者 class
  if (doc.querySelector('.author, .byline, .post-author, .article-author')) return { passed: true }
  // JSON-LD 中的 author 欄位
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const schemas = [].concat(JSON.parse(script.textContent))
      if (schemas.some(s => s.author || s['@type'] === 'Person')) return { passed: true }
    } catch {}
  }
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
  const orgTypes = ['Organization', 'LocalBusiness', 'Corporation', 'NGO',
    'EducationalOrganization', 'MedicalOrganization', 'Store', 'Restaurant', 'Hotel']
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const schemas = [].concat(JSON.parse(script.textContent))
      if (schemas.some(s => {
        const types = [].concat(s['@type'] || [])
        return types.some(t => orgTypes.includes(t))
      })) return { passed: true }
    } catch {}
  }
  return { passed: false }
}

/**
 * 6. 發布/更新日期 - 是否標示內容時間
 */
function checkDatePublished(doc) {
  // Meta 標籤
  if (doc.querySelector('meta[property="article:published_time"], meta[property="article:modified_time"], meta[name="date"], meta[name="last-modified"]')) return { passed: true }
  // <time> 元素
  if (doc.querySelector('time[datetime]')) return { passed: true }
  // JSON-LD
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const schemas = [].concat(JSON.parse(script.textContent))
      if (schemas.some(s => s.datePublished || s.dateModified)) return { passed: true }
    } catch {}
  }
  return { passed: false }
}

/**
 * 7. 社群媒體連結 - 是否有社群帳號連結
 */
function checkSocialLinks(doc) {
  const socialDomains = [
    'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com',
    'x.com', 'youtube.com', 'line.me', 'tiktok.com', 'threads.net',
    'pinterest.com', 'weibo.com'
  ]
  for (const link of doc.querySelectorAll('a[href]')) {
    const href = (link.getAttribute('href') || '').toLowerCase()
    if (socialDomains.some(d => href.includes(d))) return { passed: true }
  }
  return { passed: false }
}

/**
 * 8. 外部權威連結 - 是否連結到外部可信來源（至少 2 個）
 */
function checkOutboundLinks(doc, pageUrl) {
  let pageHostname = ''
  try { pageHostname = new URL(pageUrl).hostname } catch {}

  const outbound = Array.from(doc.querySelectorAll('a[href]')).filter(link => {
    const href = link.getAttribute('href') || ''
    if (!href.startsWith('http')) return false
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
    const html = await fetchPageContent(url)
    const doc = parseHTML(html)

    const results = {
      author_info:          checkAuthorInfo(doc),
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
