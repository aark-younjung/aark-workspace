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
 * 9. Content freshness (lastmod) 檢測（2026-06-05 P3 加，LLMO 業界共識訊號）
 *
 * LLM 引擎在 retrieve / cite 時會優先選擇「新鮮」內容（dateModified ≤ 365 天）。
 * 來源優先順序：
 *   (a) <meta property="article:modified_time">  ← Yoast / Rank Math 自動輸出
 *   (b) <meta itemprop="dateModified">           ← Schema.org microdata
 *   (c) JSON-LD 內 dateModified 欄位             ← 結構化資料
 *   (d) <time datetime="..."> 標籤                ← 文章內可見的修改時間
 *
 * 通過條件：找到任一來源、且距今 ≤ 365 天
 */
function checkLastmod(doc) {
  const sources = []

  // (a) OG meta — Yoast / Rank Math 預設輸出
  const ogModified = doc.querySelector('meta[property="article:modified_time"]')
  if (ogModified) sources.push({ source: 'og', value: ogModified.getAttribute('content') })

  // (b) Schema.org microdata
  const itempropModified = doc.querySelector('meta[itemprop="dateModified"]')
  if (itempropModified) sources.push({ source: 'microdata', value: itempropModified.getAttribute('content') })

  // (c) JSON-LD dateModified
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent)
      const findModified = (obj) => {
        if (!obj || typeof obj !== 'object') return
        if (obj.dateModified) sources.push({ source: 'jsonld', value: obj.dateModified })
        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(findModified)
      }
      findModified(data)
    } catch {}
  })

  // (d) <time datetime>
  const timeTags = doc.querySelectorAll('time[datetime]')
  timeTags.forEach(t => {
    const dt = t.getAttribute('datetime')
    if (dt) sources.push({ source: 'time', value: dt })
  })

  if (sources.length === 0) {
    return { passed: false, hasLastmod: false, daysSince: null, sources: [] }
  }

  // 解析日期、找最近的修改時間
  const parsedDates = sources
    .map(s => ({ ...s, parsed: new Date(s.value) }))
    .filter(s => !isNaN(s.parsed.getTime()))

  if (parsedDates.length === 0) {
    return { passed: false, hasLastmod: true, daysSince: null, sources, note: 'lastmod 標記存在但日期格式無法解析' }
  }

  // 取最近一筆
  const latest = parsedDates.reduce((a, b) => a.parsed > b.parsed ? a : b)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - latest.parsed.getTime()) / (1000 * 60 * 60 * 24))

  return {
    passed: daysSince >= 0 && daysSince <= 365,
    hasLastmod: true,
    daysSince,
    latestDate: latest.value,
    latestSource: latest.source,
    sources,
  }
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
    // fetchPageContent 自 2026-05-22 改回傳 { html, sslFallback }，這裡只用 html
    const { html } = await fetchPageContent(cleanUrl)
    if (html) doc = parseHTML(html)
  } catch (error) {
    console.warn('Could not fetch page for GEO analysis:', error)
  }

  const openGraph = doc ? checkOpenGraph(doc) : { passed: false }
  const twitterCard = doc ? checkTwitterCard(doc) : { passed: false }
  const jsonLdCitation = doc ? checkJsonLdCitation(doc) : { passed: false }
  const canonical = doc ? checkCanonical(doc) : { passed: false }
  const https = checkHttps(cleanUrl)
  // P3 LLMO 深化：加 content freshness 檢測（2026-06-05）
  // 設計選擇：lastmod 暫時不計入主分數（避免歷史分數突然 -11，也避免 schema migration 壓力）
  // 主分數仍維持 /8、lastmod 結果只放在 details 給 UI 當「LLMO 新訊號」展示
  // 未來要正式計入時、加 SQL: ALTER TABLE geo_audits ADD COLUMN lastmod_passed BOOLEAN DEFAULT NULL;
  // 然後把 lastmod 加進 checks 陣列、分母改 /9、insert sites 加 lastmod_passed 欄位
  const lastmod = doc ? checkLastmod(doc) : { passed: false, hasLastmod: false }

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
      https,
      lastmod, // ← 新增、給 UI 顯示「LLMO 新訊號」用（暫不計分）
    },
    // 給 UI 快速判斷用、不入 DB（geo_audits 表沒這欄）
    lastmod_passed: lastmod.passed,
    lastmod_days_since: lastmod.daysSince,
    analyzed_at: new Date().toISOString()
  }

  console.log('GEO Analysis complete:', result)
  return result
}

export default { analyzeGEO }
