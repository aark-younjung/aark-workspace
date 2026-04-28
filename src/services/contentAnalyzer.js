/**
 * Content Analyzer Service
 * 針對單篇文章 / 頁面進行內容品質分析
 * 檢測項目：
 * 1. 內容結構（H 標題層級、問句式標題）
 * 2. 字數與深度
 * 3. Meta 標籤（此頁專屬）
 * 4. AEO 友善度（直接回答段落、FAQ Schema）
 * 5. Article Schema 結構化資料
 * 6. 作者資訊
 * 7. 圖片 Alt 覆蓋率
 * 8. 內部連結
 * 9. 可讀性（段落長度）
 */

const API_BASE = '/api/fetch-url'

export async function fetchArticleContent(url) {
  const proxyUrl = `${API_BASE}?url=${encodeURIComponent(url)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  if (!data.success) throw new Error(data.error || '無法抓取頁面')
  return data.content
}

function parseHTML(html) {
  return new DOMParser().parseFromString(html, 'text/html')
}

// ── 1. 標題結構 ────────────────────────────────────────────────
function checkHeadingStructure(doc) {
  const h1s = [...doc.querySelectorAll('h1')]
  const h2s = [...doc.querySelectorAll('h2')]
  const h3s = [...doc.querySelectorAll('h3')]

  const questionPattern = /什麼|為什麼|如何|怎麼|哪些|是否|可以|嗎\?|？|what|why|how|which|when|where|is |are |can /i
  const questionH2 = h2s.filter(h => questionPattern.test(h.textContent))
  const questionH3 = h3s.filter(h => questionPattern.test(h.textContent))
  const totalQuestion = questionH2.length + questionH3.length

  return {
    h1Count: h1s.length,
    h1Content: h1s[0]?.textContent?.trim() || '',
    h2Count: h2s.length,
    h3Count: h3s.length,
    questionHeadings: totalQuestion,
    hasProperH1: h1s.length === 1,
    hasH2Structure: h2s.length >= 2,
    hasQuestionHeadings: totalQuestion >= 1,
  }
}

// ── 2. 字數與深度 ─────────────────────────────────────────────
function checkWordCount(doc) {
  // 移除 nav、header、footer、script、style
  const clone = doc.cloneNode(true)
  ;['nav', 'header', 'footer', 'script', 'style', 'aside'].forEach(tag => {
    clone.querySelectorAll(tag).forEach(el => el.remove())
  })
  const text = clone.body?.innerText || clone.body?.textContent || ''
  // 中文以字數計，英文以詞數計
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (text.match(/\b[a-zA-Z]+\b/g) || []).length
  const totalWords = chineseChars + englishWords

  return {
    totalWords,
    chineseChars,
    englishWords,
    isLongForm: totalWords >= 800,
    isDeep: totalWords >= 1500,
  }
}

// ── 3. Meta 標籤 ──────────────────────────────────────────────
function checkMetaTags(doc) {
  const title = doc.querySelector('title')?.textContent?.trim() || ''
  const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || ''
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() || ''
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() || ''
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''

  return {
    title,
    titleLength: title.length,
    hasTitleOptimal: title.length >= 30 && title.length <= 60,
    description: desc,
    descLength: desc.length,
    hasDescOptimal: desc.length >= 70 && desc.length <= 155,
    hasOgTitle: !!ogTitle,
    hasOgDesc: !!ogDesc,
    hasOgImage: !!ogImage,
  }
}

// ── 4. AEO 友善度 ─────────────────────────────────────────────
function checkAEO(doc) {
  // FAQ Schema
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')]
  let hasFaqSchema = false
  let hasArticleSchema = false
  let hasAuthorInSchema = false
  scripts.forEach(s => {
    try {
      const json = JSON.parse(s.textContent)
      const types = Array.isArray(json) ? json.map(j => j['@type']) : [json['@type']]
      if (types.some(t => t === 'FAQPage')) hasFaqSchema = true
      if (types.some(t => ['Article', 'BlogPosting', 'NewsArticle'].includes(t))) {
        hasArticleSchema = true
        const item = Array.isArray(json) ? json.find(j => ['Article','BlogPosting','NewsArticle'].includes(j['@type'])) : json
        if (item?.author) hasAuthorInSchema = true
      }
    } catch {}
  })

  // 直接回答段落：首段是否在 100 字內直接給出答案
  const firstP = doc.querySelector('article p, main p, .content p, #content p, p')
  const firstPText = firstP?.textContent?.trim() || ''
  const hasDirectAnswer = firstPText.length >= 30 && firstPText.length <= 200

  return {
    hasFaqSchema,
    hasArticleSchema,
    hasAuthorInSchema,
    hasDirectAnswer,
  }
}

// ── 5. 作者資訊 ───────────────────────────────────────────────
function checkAuthor(doc) {
  const authorSelectors = [
    '[rel="author"]', '.author', '.byline', '[itemprop="author"]',
    '.post-author', '.article-author', '.writer'
  ]
  const hasAuthorElement = authorSelectors.some(sel => doc.querySelector(sel))
  const dateSelectors = ['time', '[itemprop="datePublished"]', '.published', '.post-date', '.date']
  const hasPublishDate = dateSelectors.some(sel => doc.querySelector(sel))

  return { hasAuthorElement, hasPublishDate }
}

// ── 6. 圖片 Alt ───────────────────────────────────────────────
function checkImages(doc) {
  const imgs = [...doc.querySelectorAll('img')]
  if (imgs.length === 0) return { total: 0, withAlt: 0, coverage: 100, passed: true }
  const withAlt = imgs.filter(img => img.getAttribute('alt')?.trim()).length
  const coverage = Math.round((withAlt / imgs.length) * 100)
  return { total: imgs.length, withAlt, coverage, passed: coverage >= 80 }
}

// ── 7. 內部連結 ───────────────────────────────────────────────
function checkInternalLinks(doc, url) {
  let domain = ''
  try { domain = new URL(url).hostname } catch {}
  const links = [...doc.querySelectorAll('a[href]')]
  const internal = links.filter(a => {
    const href = a.getAttribute('href') || ''
    return href.startsWith('/') || (domain && href.includes(domain))
  })
  return {
    total: links.length,
    internal: internal.length,
    hasInternalLinks: internal.length >= 2,
  }
}

// ── 7b. 外部引用 ──────────────────────────────────────────────
// 連結到外站的 anchor 數量；AI 引用偏好「有引用權威來源」的內容
function checkOutboundLinks(doc, url) {
  let domain = ''
  try { domain = new URL(url).hostname } catch {}
  const outbound = [...doc.querySelectorAll('a[href]')].filter(a => {
    const href = a.getAttribute('href') || ''
    if (!href.startsWith('http')) return false
    try {
      return new URL(href).hostname !== domain
    } catch { return false }
  })
  return { count: outbound.length, hasEnough: outbound.length >= 3 }
}

// ── 7c. 多媒體輔助 ────────────────────────────────────────────
// 圖片 / 影片 / iframe 數量；AI 引用偏好有視覺輔助的長文
function checkMultimedia(doc) {
  const imgs = doc.querySelectorAll('img').length
  const videos = doc.querySelectorAll('video').length
  const pictures = doc.querySelectorAll('picture').length
  const iframes = doc.querySelectorAll('iframe').length
  const total = imgs + videos + pictures + iframes
  return { count: total, imgs, videos, pictures, iframes }
}

// ── 8. 可讀性（段落長度）─────────────────────────────────────
function checkReadability(doc) {
  const paragraphs = [...doc.querySelectorAll('article p, main p, .content p, p')]
    .filter(p => p.textContent.trim().length > 20)
  if (paragraphs.length === 0) return { avgLength: 0, hasGoodReadability: false }
  const avg = paragraphs.reduce((sum, p) => sum + p.textContent.trim().length, 0) / paragraphs.length
  return {
    avgLength: Math.round(avg),
    paragraphCount: paragraphs.length,
    hasGoodReadability: avg <= 200, // 段落平均不超過 200 字為易讀
  }
}

// ── 計分 ──────────────────────────────────────────────────────
function calcScore(checks) {
  const { heading, wordCount, meta, aeo, author, images, links, readability } = checks
  let score = 0
  const max = 100

  // 結構 (25 分)
  if (heading.hasProperH1) score += 8
  if (heading.hasH2Structure) score += 10
  if (heading.hasQuestionHeadings) score += 7

  // 字數 (20 分)
  if (wordCount.totalWords >= 300) score += 5
  if (wordCount.isLongForm) score += 10
  if (wordCount.isDeep) score += 5

  // Meta (15 分)
  if (meta.hasTitleOptimal) score += 5
  if (meta.hasDescOptimal) score += 5
  if (meta.hasOgImage) score += 5

  // AEO (20 分)
  if (aeo.hasDirectAnswer) score += 5
  if (aeo.hasFaqSchema) score += 8
  if (aeo.hasArticleSchema) score += 7

  // 作者 (10 分)
  if (author.hasAuthorElement) score += 5
  if (author.hasPublishDate) score += 5

  // 圖片 Alt (5 分)
  if (images.passed) score += 5

  // 內部連結 (5 分)
  if (links.hasInternalLinks) score += 5

  return Math.min(score, max)
}

// ── 主函式 ────────────────────────────────────────────────────
export async function analyzeContent(url) {
  const html = await fetchArticleContent(url)
  const doc = parseHTML(html)

  const heading = checkHeadingStructure(doc)
  const wordCount = checkWordCount(doc)
  const meta = checkMetaTags(doc)
  const aeo = checkAEO(doc)
  const author = checkAuthor(doc)
  const images = checkImages(doc)
  const links = checkInternalLinks(doc, url)
  const outbound = checkOutboundLinks(doc, url)
  const multimedia = checkMultimedia(doc)
  const readability = checkReadability(doc)
  // 估算閱讀分鐘數：中文 ≈ 400 字/分、英文 ≈ 200 字/分，混和取 250 字/分
  const readingMinutes = Math.round((wordCount.totalWords / 250) * 10) / 10

  const checks = { heading, wordCount, meta, aeo, author, images, links, outbound, multimedia, readability, readingMinutes }
  const score = calcScore(checks)

  return { url, score, ...checks }
}
