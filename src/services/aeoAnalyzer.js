/**
 * AEO (AI-Enhanced Optimization) 分析服務
 * 檢測 8 項 AI 搜尋優化技術指標
 */

import { fetchPageContent, parseHTML } from './seoAnalyzer'

/**
 * 1. JSON-LD 結構化資料檢測
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
 * 2. LLMs.txt 檔案檢測
 */
async function checkLLMsTxt(url) {
  try {
    const baseUrl = new URL(url).origin
    const response = await fetch(`${baseUrl}/llms.txt`, {
      method: 'HEAD',
      cache: 'no-store'
    })
    return { passed: response.ok, status: response.status }
  } catch {
    return { passed: false, status: 0 }
  }
}

/**
 * 3. Open Graph 標籤檢測
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
 * 4. Twitter Card 標籤檢測
 */
function checkTwitterCard(doc) {
  const twitterCard = doc.querySelector('meta[name="twitter:card"]')
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')

  const hasAll = !!(twitterCard && twitterTitle && twitterImage)
  const hasPartial = !!(twitterCard || twitterTitle || twitterImage)

  return {
    passed: hasAll,
    hasPartial,
    hasCard: !!twitterCard,
    hasTitle: !!twitterTitle,
    hasImage: !!twitterImage
  }
}

/**
 * 5. Canonical 標籤檢測
 */
function checkCanonical(doc) {
  const canonical = doc.querySelector('link[rel="canonical"]')
  return {
    passed: !!canonical,
    href: canonical?.getAttribute('href') || null
  }
}

/**
 * 6. robots.txt 檢測
 */
async function checkRobotsTxt(url) {
  try {
    const baseUrl = new URL(url).origin
    const response = await fetch(`${baseUrl}/robots.txt`, {
      method: 'GET',
      cache: 'no-store'
    })
    const text = response.ok ? await response.text() : ''
    return {
      passed: response.ok,
      hasSitemap: text.toLowerCase().includes('sitemap'),
      content: text.substring(0, 500)
    }
  } catch {
    return { passed: false, hasSitemap: false }
  }
}

/**
 * 7. sitemap.xml 檢測
 */
async function checkSitemap(url) {
  try {
    const baseUrl = new URL(url).origin
    const response = await fetch(`${baseUrl}/sitemap.xml`, {
      method: 'HEAD',
      cache: 'no-store'
    })
    return { passed: response.ok, status: response.status }
  } catch {
    return { passed: false, status: 0 }
  }
}

/**
 * 8. 麵包屑導航檢測
 */
function checkBreadcrumbs(doc) {
  // 檢查 schema.org BreadcrumbList
  const breadcrumbSchema = doc.querySelector('script[type="application/ld+json"]')
  let hasSchema = false
  if (breadcrumbSchema) {
    try {
      const data = JSON.parse(breadcrumbSchema.textContent)
      if (data['@type'] === 'BreadcrumbList' || (Array.isArray(data['@graph']) && data['@graph'].some(i => i['@type'] === 'BreadcrumbList'))) {
        hasSchema = true
      }
    } catch {}
  }

  // 檢查 nav 元素中的麵包屑
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

  // 平行執行各項檢測
  const [llms, robots, sitemap] = await Promise.all([
    checkLLMsTxt(cleanUrl),
    checkRobotsTxt(cleanUrl),
    checkSitemap(cleanUrl)
  ])

  const jsonLd = doc ? checkJsonLd(doc) : { passed: false, schemaType: null }
  const openGraph = doc ? checkOpenGraph(doc) : { passed: false }
  const twitterCard = doc ? checkTwitterCard(doc) : { passed: false }
  const canonical = doc ? checkCanonical(doc) : { passed: false }
  const breadcrumbs = doc ? checkBreadcrumbs(doc) : { passed: false }

  // 計算分數
  const checks = [jsonLd, llms, openGraph, twitterCard, canonical, robots, sitemap, breadcrumbs]
  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / 8) * 100)

  const result = {
    url: cleanUrl,
    score,
    json_ld: jsonLd.passed,
    llms_txt: llms.passed,
    open_graph: openGraph.passed,
    twitter_card: twitterCard.passed,
    canonical: canonical.passed,
    robots_txt: robots.passed,
    sitemap: sitemap.passed,
    breadcrumbs: breadcrumbs.passed,
    // 詳細資訊
    details: {
      jsonLd,
      llmsTxt: llms,
      openGraph,
      twitterCard,
      canonical,
      robotsTxt: robots,
      sitemap,
      breadcrumbs
    },
    analyzed_at: new Date().toISOString()
  }

  console.log('AEO Analysis complete:', result)
  return result
}

export default { analyzeAEO }
