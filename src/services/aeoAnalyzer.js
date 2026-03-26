/**
 * AEO (Answer Engine Optimization) 分析服務
 * 檢測 8 項傳統 Google 問答優化技術指標
 */

import { fetchPageContent, parseHTML } from './seoAnalyzer'

/**
 * 1. JSON-LD 結構化資料檢測 (schema.org，特別是 FAQ/HowTo)
 */
function checkJsonLd(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  let hasValidSchema = false
  let schemaType = null

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent)
      if (data['@type']) {
        hasValidSchema = true
        schemaType = data['@type']
      }
      if (Array.isArray(data['@graph'])) {
        hasValidSchema = true
      }
    } catch (e) {
      // Invalid JSON-LD
    }
  })

  return { passed: hasValidSchema, schemaType }
}

/**
 * 2. FAQ Schema 檢測 (FAQPage 或 QAPage)
 */
function checkFaqSchema(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  let hasFaqSchema = false

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent)
      const types = Array.isArray(data['@graph'])
        ? data['@graph'].map(i => i['@type'])
        : [data['@type']]
      if (types.some(t => t === 'FAQPage' || t === 'QAPage')) {
        hasFaqSchema = true
      }
    } catch (e) {}
  })

  return { passed: hasFaqSchema }
}

/**
 * 3. Canonical 標籤檢測
 */
function checkCanonical(doc) {
  const canonical = doc.querySelector('link[rel="canonical"]')
  return {
    passed: !!canonical,
    href: canonical?.getAttribute('href') || null
  }
}

/**
 * 4. 麵包屑導航檢測 (BreadcrumbList schema)
 */
function checkBreadcrumbs(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  let hasSchema = false
  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent)
      if (
        data['@type'] === 'BreadcrumbList' ||
        (Array.isArray(data['@graph']) &&
          data['@graph'].some(i => i['@type'] === 'BreadcrumbList'))
      ) {
        hasSchema = true
      }
    } catch {}
  })

  const navElements = doc.querySelectorAll('nav')
  let hasNavBreadcrumb = false
  navElements.forEach(nav => {
    const text = nav.textContent.toLowerCase()
    if (text.includes('home') || text.includes('首頁') || text.includes('breadcrumb')) {
      hasNavBreadcrumb = true
    }
  })

  return {
    passed: hasSchema || hasNavBreadcrumb,
    hasSchema,
    hasNavBreadcrumb
  }
}

/**
 * 5. Open Graph 標籤檢測 (影響 Google 搜尋預覽)
 */
function checkOpenGraph(doc) {
  const ogTitle = doc.querySelector('meta[property="og:title"]')
  const ogDesc = doc.querySelector('meta[property="og:description"]')
  const ogImage = doc.querySelector('meta[property="og:image"]')
  const ogUrl = doc.querySelector('meta[property="og:url"]')

  const hasAll = !!(ogTitle && ogDesc && ogImage && ogUrl)
  const hasPartial = !!(ogTitle || ogDesc || ogImage || ogUrl)

  return {
    passed: hasAll,
    hasPartial,
    hasTitle: !!ogTitle,
    hasDescription: !!ogDesc,
    hasImage: !!ogImage,
    hasUrl: !!ogUrl
  }
}

/**
 * 6. H2/H3 問句式標題檢測 (標題是否以問句呈現)
 */
function checkQuestionHeadings(doc) {
  const headings = doc.querySelectorAll('h2, h3')
  let questionCount = 0
  let totalCount = 0

  // 問句特徵：以「？」「?」結尾，或以疑問詞開頭
  const questionWords = ['什麼', '怎麼', '如何', '為什麼', '哪些', '哪裡', '誰', '何時', 'what', 'how', 'why', 'when', 'where', 'who', 'which']

  headings.forEach(h => {
    const text = h.textContent.trim()
    if (!text) return
    totalCount++
    const lower = text.toLowerCase()
    const isQuestion =
      text.endsWith('？') ||
      text.endsWith('?') ||
      questionWords.some(w => lower.includes(w))
    if (isQuestion) questionCount++
  })

  return {
    passed: questionCount > 0,
    questionCount,
    totalCount
  }
}

/**
 * 7. Meta 描述長度檢測 (150-160 字元)
 */
function checkMetaDescLength(doc) {
  const metaDesc = doc.querySelector('meta[name="description"]')
  if (!metaDesc) return { passed: false, length: 0, hasDescription: false }

  const content = metaDesc.getAttribute('content') || ''
  const length = content.length
  const passed = length >= 120 && length <= 160

  return {
    passed,
    length,
    hasDescription: true,
    content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
  }
}

/**
 * 8. 結構化答案段落檢測 (首段是否有清楚的問答格式)
 */
function checkStructuredAnswer(doc) {
  // 檢查是否有 FAQ 段落或明顯的問答格式
  const paragraphs = doc.querySelectorAll('p')
  let hasStructuredContent = false

  // 方法 1：找含有問號的段落後面接著答案
  let foundQuestionPara = false
  paragraphs.forEach(p => {
    const text = p.textContent.trim()
    if (text.endsWith('？') || text.endsWith('?')) {
      foundQuestionPara = true
    }
  })

  // 方法 2：頁面有明確的 FAQ 區塊 (含 FAQ/常見問題 字樣)
  const bodyText = doc.body?.textContent || ''
  const hasFaqSection =
    bodyText.includes('常見問題') ||
    bodyText.includes('FAQ') ||
    bodyText.toLowerCase().includes('frequently asked')

  // 方法 3：有 details/summary 元素 (Q&A 格式)
  const hasDetailsElement = doc.querySelectorAll('details').length > 0

  hasStructuredContent = foundQuestionPara || hasFaqSection || hasDetailsElement

  return {
    passed: hasStructuredContent,
    hasFaqSection,
    hasDetailsElement,
    foundQuestionPara
  }
}

/**
 * 完整的 AEO 分析
 */
export async function analyzeAEO(url) {
  console.log('Starting AEO analysis for:', url)

  let cleanUrl = url.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }

  let html = ''
  try {
    html = await fetchPageContent(cleanUrl)
  } catch (error) {
    console.warn('Could not fetch page for AEO analysis:', error)
  }

  let doc = null
  if (html) {
    doc = parseHTML(html)
  }

  const jsonLd = doc ? checkJsonLd(doc) : { passed: false }
  const faqSchema = doc ? checkFaqSchema(doc) : { passed: false }
  const canonical = doc ? checkCanonical(doc) : { passed: false }
  const breadcrumbs = doc ? checkBreadcrumbs(doc) : { passed: false }
  const openGraph = doc ? checkOpenGraph(doc) : { passed: false }
  const questionHeadings = doc ? checkQuestionHeadings(doc) : { passed: false }
  const metaDescLength = doc ? checkMetaDescLength(doc) : { passed: false }
  const structuredAnswer = doc ? checkStructuredAnswer(doc) : { passed: false }

  const checks = [jsonLd, faqSchema, canonical, breadcrumbs, openGraph, questionHeadings, metaDescLength, structuredAnswer]
  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / 8) * 100)

  const result = {
    url: cleanUrl,
    score,
    json_ld: jsonLd.passed,
    faq_schema: faqSchema.passed,
    canonical: canonical.passed,
    breadcrumbs: breadcrumbs.passed,
    open_graph: openGraph.passed,
    question_headings: questionHeadings.passed,
    meta_desc_length: metaDescLength.passed,
    structured_answer: structuredAnswer.passed,
    details: {
      jsonLd,
      faqSchema,
      canonical,
      breadcrumbs,
      openGraph,
      questionHeadings,
      metaDescLength,
      structuredAnswer
    },
    analyzed_at: new Date().toISOString()
  }

  console.log('AEO Analysis complete:', result)
  return result
}

export default { analyzeAEO }
