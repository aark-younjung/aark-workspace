/**
 * GEO (Generative Engine Optimization) 分析服務
 * 檢測 8 項生成式 AI 引用優化技術指標
 */

// Vercel Serverless API endpoint
const API_BASE = '/api/fetch-url'

/**
 * 子資源探測的節流參數（2026-08-27）
 *
 * 起因：用戶實測兩個日本企業網站（其中一個是信用金庫＝有 WAF 的金融機構），
 * 連續掃幾次之後全部回 "All fetch rounds timed out"；事後單獨測同樣兩個網址，
 * 每次 0.6–1.8 秒就回來、離 8 秒單輪逾時很遠 —— 不是對方慢，是被暫時擋。
 *
 * 一次掃描原本會對同一台主機同時開四槍（主頁 + llms/robots/sitemap 三個探測平行），
 * 每槍後端又各有最多 4 輪 fallback。對有速率限制的主機來說這個節奏很像攻擊。
 * 改成三個探測「錯開序列」跑：總時間多約 1 秒（掃描本來就 30–60 秒，可忽略），
 * 但瞬時併發從 3 降到 1。
 */
const PROBE_GAP_MS = 400   // 探測之間的間隔
const PROBE_RETRY_MS = 800 // 重試前的退避（原本失敗後立刻再打一次，等於補拳）

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 1. llms.txt 檢測 (AI 爬蟲說明文件)
 */
/**
 * 探測子資源（llms.txt / robots.txt / sitemap.xml）
 *
 * 2026-07-21：把「確定沒有這個檔案（目標回 404/410）」跟「這次沒查到（逾時／網路錯誤／5xx）」分開。
 * 舊版兩者都回 passed:false —— 網路抖一下就會被記成「這個站沒有 sitemap」，分數莫名其妙掉，
 * 客戶連掃兩次拿到不同分數會直接不信任產品（跟先前「逾時 ≠ 被擋」是同一類錯誤）。
 * 現在：逾時會重試一次；仍失敗回 unknown，計分時從分母剔除（不因為量不到就扣分）。
 *
 * @returns {{found:true,data:object}|{found:false}|{unknown:true}}
 */
async function probeResource(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}?url=${encodeURIComponent(url)}`)
      const data = await response.json().catch(() => null)
      if (response.ok && data?.success) return { found: true, data }
      // 目標明確回 404/410 → 確定沒有這個檔案（這是真的「不通過」，不重試）
      if (response.status === 404 || response.status === 410) return { found: false }
      // 其他（504 逾時 / 5xx / 空回應）→ 落到重試
    } catch { /* 網路層失敗 → 落到重試 */ }
    // 退避後再重試：逾時的常見成因就是對方限流，立刻再打一次只會讓封鎖更確定
    if (attempt < retries) await sleep(PROBE_RETRY_MS)
  }
  return { unknown: true }
}

async function checkLLMsTxt(baseUrl) {
  const r = await probeResource(baseUrl + '/llms.txt')
  if (r.unknown) return { passed: false, unknown: true }
  return { passed: !!r.found }
}

/**
 * 2. robots.txt AI 開放性檢測 (是否允許 GPTBot、PerplexityBot、Google-Extended)
 */
async function checkRobotsAI(baseUrl) {
  const probe = await probeResource(baseUrl + '/robots.txt')
  if (probe.unknown) return { passed: false, unknown: true, blocked: [], allowed: [], hasRobotsTxt: false }
  if (!probe.found) return { passed: false, blocked: [], allowed: [], hasRobotsTxt: false }
  try {
    const data = probe.data
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
  const r = await probeResource(baseUrl + '/sitemap.xml')
  if (r.unknown) return { passed: false, unknown: true }
  return { passed: !!r.found }
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
export async function analyzeGEO(url, providedDoc = null) {
  console.log('Starting GEO analysis for:', url)

  let cleanUrl = url.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }

  const baseUrl = new URL(cleanUrl).origin

  // 三個子資源探測：錯開序列跑，不平行（原因見檔頭 PROBE_GAP_MS 註解）
  const llmsTxt = await checkLLMsTxt(baseUrl)
  await sleep(PROBE_GAP_MS)
  const robotsAI = await checkRobotsAI(baseUrl)
  await sleep(PROBE_GAP_MS)
  const sitemap = await checkSitemap(baseUrl)

  // 優先用呼叫端已經抓好的 doc（HomeDark 掃描時本來就抓過一次頁面）。
  // 2026-07-21：舊版一律自己再抓一次 —— (1) 多一趟沒必要的請求
  // (2) 抓到的可能跟 AEO/EEAT 讀的不是同一份 HTML（網站/CDN 交替供版時，同一次掃描的各面向會互相打架）
  // (3) 那次重抓只要失敗，openGraph/twitterCard/jsonLdCitation/canonical 4 項同時歸零、GEO 直接掉 50 分。
  let doc = providedDoc
  if (!doc) {
    try {
      const { fetchPageContent, parseHTML } = await import('./seoAnalyzer')
      const { html } = await fetchPageContent(cleanUrl)
      if (html) doc = parseHTML(html)
    } catch (error) {
      console.warn('Could not fetch page for GEO analysis:', error)
    }
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
  // unknown（這次量不到）從分母剔除 —— 量不到就不該扣分。
  // 否則網路抖一下分數就掉，客戶連掃兩次拿到不同數字，整個產品的可信度就沒了。
  const measured = checks.filter(c => !c.unknown)
  const passedCount = measured.filter(c => c.passed).length
  const score = measured.length > 0 ? Math.round((passedCount / measured.length) * 100) : 0

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
