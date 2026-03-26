/**
 * GEO (Generative Engine Optimization) 分析服務
 * 檢測 8 項生成式 AI 引用優化技術指標
 */

// Vercel Serverless API endpoint
const API_BASE = '/api/fetch-url'

/**
 * 1. llms.txt 檢測 (AI 爬蟲說明文件)
 */
async function checkLLMsTxt(baseUrl) {
  try {
    const response = await fetch(`${API_BASE}?url=${encodeURIComponent(baseUrl + '/llms.txt')}`)
    if (response.ok) {
      const data = await response.json()
      return { passed: data.success === true }
    }
  } catch {}
  return { passed: false }
}

/**
 * 2. robots.txt AI 開放性檢測 (是否允許 GPTBot、PerplexityBot、Google-Extended)
 */
async function checkRobotsAI(baseUrl) {
  try {
    const response = await fetch(`${API_BASE}?url=${encodeURIComponent(baseUrl + '/robots.txt')}`)
    if (!response.ok) return { passed: false, blocked: [], allowed: [] }

    const data = await response.json()
    if (!data.success) return { passed: false, blocked: [], allowed: [] }

    const text = (data.content || '').toLowerCase()
    const aiBots = ['gptbot', 'perplexitybot', 'google-extended', 'claudebot', 'anthropic-ai']

    // 解析 robots.txt：找出明確 Disallow 或 Allow 的 AI bots
    const blocked = []
    const allowed = []

    aiBots.forEach(bot => {
      // 簡單判斷：找到 User-agent: <bot> + Disallow: / 視為封鎖
      const userAgentIdx = text.indexOf(`user-agent: ${bot}`)
      if (userAgentIdx !== -1) {
        const section = text.substring(userAgentIdx, userAgentIdx + 200)
        if (section.includes('disallow: /') && !section.includes('disallow: \n')) {
          blocked.push(bot)
        } else {
          allowed.push(bot)
        }
      }
    })

    // 沒有明確封鎖主要 AI bot 視為通過
    const majorBots = ['gptbot', 'google-extended']
    const majorBlocked = blocked.filter(b => majorBots.includes(b))
    return {
      passed: majorBlocked.length === 0,
      blocked,
      allowed,
      hasRobotsTxt: true
    }
  } catch {}
  return { passed: false, blocked: [], allowed: [], hasRobotsTxt: false }
}

/**
 * 3. Sitemap 檢測 (幫助 AI 爬蟲探索頁面)
 */
async function checkSitemap(baseUrl) {
  try {
    const response = await fetch(`${API_BASE}?url=${encodeURIComponent(baseUrl + '/sitemap.xml')}`)
    if (response.ok) {
      const data = await response.json()
      return { passed: data.success === true }
    }
  } catch {}
  return { passed: false }
}

/**
 * 4. Open Graph 標籤檢測 (AI 引用時的社群標籤信號)
 */
function checkOpenGraph(doc) {
  const ogTitle = doc.querySelector('meta[property="og:title"]')
  const ogDesc = doc.querySelector('meta[property="og:description"]')
  const ogImage = doc.querySelector('meta[property="og:image"]')
  const ogUrl = doc.querySelector('meta[property="og:url"]')

  return {
    passed: !!(ogTitle && ogDesc && ogImage && ogUrl),
    hasTitle: !!ogTitle,
    hasDescription: !!ogDesc,
    hasImage: !!ogImage,
    hasUrl: !!ogUrl
  }
}

/**
 * 5. Twitter Card 標籤檢測 (AI 摘要中的社群信號)
 */
function checkTwitterCard(doc) {
  const twitterCard = doc.querySelector('meta[name="twitter:card"]')
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')

  return {
    passed: !!(twitterCard && twitterTitle && twitterImage),
    hasCard: !!twitterCard,
    hasTitle: !!twitterTitle,
    hasImage: !!twitterImage
  }
}

/**
 * 6. JSON-LD 引用信號檢測 (author、publisher、datePublished 等可信度資訊)
 */
function checkJsonLdCitation(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  let hasAuthor = false
  let hasPublisher = false
  let hasDatePublished = false

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent)
      const checkObj = (obj) => {
        if (!obj || typeof obj !== 'object') return
        if (obj.author) hasAuthor = true
        if (obj.publisher) hasPublisher = true
        if (obj.datePublished) hasDatePublished = true
        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(checkObj)
      }
      checkObj(data)
    } catch {}
  })

  const signalCount = [hasAuthor, hasPublisher, hasDatePublished].filter(Boolean).length
  return {
    passed: signalCount >= 2,
    hasAuthor,
    hasPublisher,
    hasDatePublished,
    signalCount
  }
}

/**
 * 7. Canonical 標籤檢測 (告訴 AI 正確的引用來源 URL)
 */
function checkCanonical(doc) {
  const canonical = doc.querySelector('link[rel="canonical"]')
  return {
    passed: !!canonical,
    href: canonical?.getAttribute('href') || null
  }
}

/**
 * 8. HTTPS 檢測 (安全連線，AI 偏好可信來源)
 */
function checkHttps(url) {
  return { passed: url.startsWith('https://') }
}

/**
 * 完整的 GEO 分析
 */
export async function analyzeGEO(url) {
  console.log('Starting GEO analysis for:', url)

  let cleanUrl = url.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }

  const baseUrl = new URL(cleanUrl).origin

  // 平行執行非同步檢測
  const [llmsTxt, robotsAI, sitemap] = await Promise.all([
    checkLLMsTxt(baseUrl),
    checkRobotsAI(baseUrl),
    checkSitemap(baseUrl)
  ])

  // 取得頁面 HTML 做同步檢測
  let doc = null
  try {
    const { fetchPageContent, parseHTML } = await import('./seoAnalyzer')
    const html = await fetchPageContent(cleanUrl)
    if (html) doc = parseHTML(html)
  } catch (error) {
    console.warn('Could not fetch page for GEO analysis:', error)
  }

  const openGraph = doc ? checkOpenGraph(doc) : { passed: false }
  const twitterCard = doc ? checkTwitterCard(doc) : { passed: false }
  const jsonLdCitation = doc ? checkJsonLdCitation(doc) : { passed: false }
  const canonical = doc ? checkCanonical(doc) : { passed: false }
  const https = checkHttps(cleanUrl)

  const checks = [llmsTxt, robotsAI, sitemap, openGraph, twitterCard, jsonLdCitation, canonical, https]
  const passedCount = checks.filter(c => c.passed).length
  const score = Math.round((passedCount / 8) * 100)

  const result = {
    url: cleanUrl,
    score,
    llms_txt: llmsTxt.passed,
    robots_ai: robotsAI.passed,
    sitemap: sitemap.passed,
    open_graph: openGraph.passed,
    twitter_card: twitterCard.passed,
    json_ld_citation: jsonLdCitation.passed,
    canonical: canonical.passed,
    https: https.passed,
    details: {
      llmsTxt,
      robotsAI,
      sitemap,
      openGraph,
      twitterCard,
      jsonLdCitation,
      canonical,
      https
    },
    analyzed_at: new Date().toISOString()
  }

  console.log('GEO Analysis complete:', result)
  return result
}

export default { analyzeGEO }
