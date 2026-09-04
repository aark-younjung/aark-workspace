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
 * 1. llms.txt 檢測（偵測並回報，但**不計入分數**）
 *
 * 2026-09-04 降級為不計分。原因是 primary source 站不住腳：
 *   - Google 官方 AI optimization guide（2026-05-15 發布、06-15 澄清）明文指出
 *     llms.txt 這類 AI 文字檔對 Google Search 不需要，不幫助也不傷害排名或能見度。
 *   - SE Ranking 30 萬網域研究、OtterlyAI 的 server log 稽核都顯示主流 AI 搜尋
 *     系統實務上沒有去讀這個檔案。
 *
 * 我們原本把它當 8 項等權檢查之一，等於整個 GEO 分數有 12.5% 押在一個沒有證據的訊號上。
 * 品牌承諾是「寧可少講不誇大」（見 lib/renderMode.js 檔頭），這一項違背了它 ——
 * 而且客戶只要 Google 一下就查得到官方說法，反噬的是整份報告的可信度。
 *
 * 保留偵測與 llms_txt 欄位（部分非 Google 系統仍可能參考，我們也有代管功能），
 * 只是不再用它加減客戶的分數、也不再宣稱它會讓 AI 更容易引用你。
 *
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
 * 2. robots.txt AI 開放性檢測
 *
 * 2026-09-04 重寫。舊版用「找到 `user-agent: <bot>` 後取 200 字視窗、看裡面有沒有
 * `disallow: /`」判斷，有兩個會直接誤導客戶的錯：
 *
 *   (1) 假陽性（說你擋了、其實沒擋）：`Disallow: /wp-admin/` 這個字串裡面就含有
 *       `disallow: /`。只要站方擋了任何一個子目錄，我們就回報「你封鎖了 GPTBot」。
 *       客戶會跑去改一個根本沒壞的設定，而且會開始懷疑報告其他部分。
 *
 *   (2) 假陰性（說你沒擋、其實整站都擋）：舊版只找具名的 `User-agent: <bot>` 區塊，
 *       完全沒讀 `User-agent: *`。一個 `User-agent: *` + `Disallow: /` 的站（整站
 *       拒絕爬蟲）在舊版判定為「通過」—— 但那正是我們最該抓出來的情況。
 *
 * 解析依 RFC 9309：具名 group 優先於萬用 group（具名存在時完全忽略 `*`）；
 * 同一 group 內以最長前綴匹配決勝、同長度時 Allow 勝過 Disallow。
 * 我們只問一個問題：這隻爬蟲能不能抓 `/`。因此只有能匹配到根路徑的規則
 * （`/`、`/*`、`/$`）參與判定，`Disallow: /private/` 不算封鎖整站。
 *
 * 計分口徑刻意跟全站文案的三引擎對齊（ChatGPT / Claude / Gemini）：
 * 只有這三家背後的爬蟲被擋才算不通過。PerplexityBot、CCBot 等仍然偵測並列在
 * details 裡給客戶看全貌，但不扣分 —— 我們沒有在賣 Perplexity 的能見度，
 * 就不該拿它扣客戶的分。
 */

/**
 * 偵測範圍（回報用）。userTriggered 的爬蟲依設計就不遵守 robots.txt，
 * 擋不擋得到是另一回事，所以永遠不列入「被封鎖」。
 */
export const AI_CRAWLERS = [
  { id: 'gptbot', owner: 'OpenAI', note: 'ChatGPT 檢索與訓練' },
  { id: 'oai-searchbot', owner: 'OpenAI', note: 'ChatGPT 搜尋的引用來源' },
  { id: 'chatgpt-user', owner: 'OpenAI', note: '使用者在 ChatGPT 內觸發的瀏覽', userTriggered: true },
  { id: 'claudebot', owner: 'Anthropic', note: 'Claude 網頁檢索' },
  { id: 'anthropic-ai', owner: 'Anthropic', note: 'Claude 訓練' },
  { id: 'google-extended', owner: 'Google', note: 'Gemini 檢索與訓練' },
  { id: 'perplexitybot', owner: 'Perplexity', note: 'Perplexity 檢索（不計分）' },
  { id: 'bytespider', owner: 'ByteDance', note: '豆包／TikTok 系 AI（不計分）' },
  { id: 'ccbot', owner: 'Common Crawl', note: '訓練語料（擋掉不影響 AI 搜尋引用，不計分）' },
]

/** 會影響分數的爬蟲＝我們對外宣稱監測的三個引擎背後的那幾隻 */
export const SCORED_CRAWLERS = ['gptbot', 'oai-searchbot', 'claudebot', 'google-extended']

/**
 * 把 robots.txt 拆成 group：連續的 User-agent 行共用後面那組規則，
 * 規則出現之後再遇到 User-agent 就是新的 group 開始。
 * @returns {Array<{agents:string[], rules:Array<{allow:boolean, path:string}>}>}
 */
export function parseRobotsGroups(text) {
  const groups = []
  let current = null
  let lastWasAgent = false

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim()  // 去掉行內註解
    if (!line) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    if (field === 'allow' || field === 'disallow') {
      if (!current) continue  // 規則出現在任何 User-agent 之前 → 沒有歸屬、忽略
      current.rules.push({ allow: field === 'allow', path: value })
      lastWasAgent = false
    }
  }
  return groups
}

/** 這條規則管不管得到根路徑 `/`（子目錄規則管不到） */
function rulePathHitsRoot(path) {
  return path === '/' || path === '/*' || path === '/$'
}

/**
 * 某隻爬蟲能不能抓根路徑。
 * @returns {{blocked:boolean, matchedBy:'named'|'wildcard'|'none'}}
 *          matchedBy 給 UI 講人話用：named＝站方指名擋你，wildcard＝被 `*` 通擋掃到
 */
export function rootAccessFor(groups, bot) {
  const named = groups.find(g => g.agents.includes(bot))
  const group = named || groups.find(g => g.agents.includes('*'))
  if (!group) return { blocked: false, matchedBy: 'none' }

  // `Disallow:`（空值）依規範等於「不限制」，不會匹配到任何路徑，交給 rulePathHitsRoot 濾掉
  const rootRules = group.rules.filter(r => rulePathHitsRoot(r.path))
  const hasAllow = rootRules.some(r => r.allow)
  const hasDisallow = rootRules.some(r => !r.allow)
  return {
    blocked: hasDisallow && !hasAllow,  // 同長度 Allow 勝 Disallow
    matchedBy: named ? 'named' : 'wildcard',
  }
}

/**
 * 純函式：吃 robots.txt 原文、吐出每隻 AI 爬蟲的通行狀態。
 * 抽出來是為了可單測（見 geoAnalyzer.robots.test.js）——這段邏輯錯了會直接對客戶說錯話。
 */
export function evaluateAiCrawlers(robotsText) {
  const groups = parseRobotsGroups(robotsText)
  const crawlers = AI_CRAWLERS.map(crawler => {
    const access = rootAccessFor(groups, crawler.id)
    // 使用者觸發型爬蟲不遵守 robots.txt，寫了也擋不住 → 不算被封鎖
    const blocked = crawler.userTriggered ? false : access.blocked
    return { ...crawler, blocked, matchedBy: access.matchedBy }
  })

  const blocked = crawlers.filter(c => c.blocked).map(c => c.id)
  const allowed = crawlers.filter(c => !c.blocked).map(c => c.id)
  const scoredBlocked = blocked.filter(id => SCORED_CRAWLERS.includes(id))

  return {
    passed: scoredBlocked.length === 0,
    blocked,
    allowed,
    scoredBlocked,
    crawlers,
    hasRobotsTxt: true,
  }
}

async function checkRobotsAI(baseUrl) {
  const probe = await probeResource(baseUrl + '/robots.txt')
  if (probe.unknown) return { passed: false, unknown: true, blocked: [], allowed: [], scoredBlocked: [], crawlers: [], hasRobotsTxt: false }
  // 沒有 robots.txt ＝ 沒有任何限制 ＝ 所有爬蟲都能抓。
  // 舊版這裡回 passed:false（沒檔案就扣分），但那跟事實相反：對 AI 爬蟲的開放性來說，
  // 「沒有 robots.txt」是最開放的狀態。要提醒客戶建立 robots.txt 是 SEO 面向的事，
  // 不該在「AI 爬蟲開放性」這一項扣分。
  if (!probe.found) {
    return {
      passed: true,
      blocked: [],
      allowed: AI_CRAWLERS.map(c => c.id),
      scoredBlocked: [],
      crawlers: AI_CRAWLERS.map(c => ({ ...c, blocked: false, matchedBy: 'none' })),
      hasRobotsTxt: false,
    }
  }
  try {
    return { ...evaluateAiCrawlers(probe.data.content || ''), hasRobotsTxt: true }
  } catch {
    // 解析炸掉 → 當作這次量不到，不扣分（同 probeResource 的 unknown 口徑）
    return { passed: false, unknown: true, blocked: [], allowed: [], scoredBlocked: [], crawlers: [], hasRobotsTxt: true }
  }
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
/**
 * 10. AI 摘要抑制指令檢測（2026-09-04 新增，偵測但暫不計分）
 *
 * 為什麼要查：Google 說得很明白——**沒有 AI 專屬的 opt-out 檔案**。
 * 頁面會不會出現在 AI Overviews / AI Mode，是由一般的 preview 指令決定的：
 * `nosnippet`、`max-snippet:0`、`data-nosnippet`、`noindex`。
 * 這跟 robots.txt 擋第三方 AI 爬蟲是兩件完全不同的事，我們原本只查了後者。
 *
 * 實務上這是很常見的自傷：SEO 外掛的預設值、開發時留下的 noindex、
 * 或是為了「防抄襲」加上 nosnippet —— 客戶完全不知道自己親手關掉了 AI 引用。
 * 這一項不是要扣分羞辱誰，是要把「你以為的問題不在這裡」指出來。
 *
 * @param {string[]} metaContents  robots / googlebot meta 的 content 值
 * @param {number} dataNosnippetCount  帶 data-nosnippet 屬性的元素數量
 */
export function evaluateSnippetDirectives(metaContents = [], dataNosnippetCount = 0) {
  const tokens = metaContents
    .filter(Boolean)
    .flatMap(content => String(content).toLowerCase().split(','))
    .map(token => token.trim())
    .filter(Boolean)

  const has = name => tokens.includes(name)
  // max-snippet:0 等於完全不給摘要；負數（-1）代表不限制，是好事
  const maxSnippetZero = tokens.some(token => {
    const match = token.match(/^max-snippet\s*:\s*(-?\d+)$/)
    return !!match && Number(match[1]) === 0
  })

  const noindex = has('noindex') || has('none')
  const nosnippet = has('nosnippet') || has('none')
  const blocksSnippet = nosnippet || maxSnippetZero

  const directives = []
  if (noindex) directives.push('noindex')
  if (nosnippet) directives.push('nosnippet')
  if (maxSnippetZero) directives.push('max-snippet:0')
  if (dataNosnippetCount > 0) directives.push(`data-nosnippet ×${dataNosnippetCount}`)

  return {
    // 通過＝沒有任何會讓這一頁拿不到 AI 摘要的指令。
    // data-nosnippet 只遮部分區塊、不影響整頁資格，因此不列入不通過。
    passed: !blocksSnippet && !noindex,
    noindex,
    nosnippet,
    maxSnippetZero,
    blocksSnippet,
    dataNosnippetCount,
    directives,
  }
}

/** 從 DOM 撈出上面那個純函式需要的兩個輸入 */
function checkAiSnippetControls(doc) {
  const metaContents = ['robots', 'googlebot']
    .flatMap(name => Array.from(doc.querySelectorAll(`meta[name="${name}"]`)))
    .map(meta => meta.getAttribute('content'))
  const dataNosnippetCount = doc.querySelectorAll('[data-nosnippet]').length
  return evaluateSnippetDirectives(metaContents, dataNosnippetCount)
}

/**
 * 內容新鮮度分級。fresh / recent 是 AI 引用的甜蜜區，aging 以後要排進翻新清單。
 * @returns {'fresh'|'recent'|'aging'|'stale'|'unknown'}
 */
export function freshnessTier(daysSince) {
  if (daysSince === null || daysSince === undefined || daysSince < 0) return 'unknown'
  if (daysSince <= 90) return 'fresh'     // 3 個月內 —— 被引用機率最高
  if (daysSince <= 180) return 'recent'   // 半年內 —— 仍在合理範圍
  if (daysSince <= 365) return 'aging'    // 一年內 —— 建議排入翻新
  return 'stale'                          // 超過一年 —— 引用資格幾乎流失
}

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
    // 分級依 SE Ranking 130 萬筆引用研究：3 個月內的內容被 AI 引用的機率約 3 倍，
    // 放到 6 個月以上則幾乎失去引用資格。單純的「有／沒有 lastmod」講不出這件事，
    // 分級才能變成可執行的建議（哪幾頁該先翻新），也才是月費監測服務的理由。
    freshness: freshnessTier(daysSince),
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
  // AI 摘要抑制指令（nosnippet / max-snippet:0 / noindex / data-nosnippet）。
  // 同樣暫不計分：geo_audits 還沒有欄位可存，硬加進分母會讓分數存得下、細項卻讀不回來。
  const aiSnippet = doc ? checkAiSnippetControls(doc) : { passed: true, directives: [], dataNosnippetCount: 0 }

  // 計分項（2026-09-04 兩段調整，同一天完成）：
  //   (1) llmsTxt 移出計分（理由見 checkLLMsTxt 上方註解）
  //   (2) lastmod 與 aiSnippet 在 geo_audits 補上欄位後升為計分項
  // 分母 8 → 7 → 9。llms.txt 那一步會讓多數網站分數上跳，新增的兩項則會讓
  // 「內容很久沒更新」或「有 nosnippet／noindex」的網站往下掉。
  // 趨勢圖上這一天是改版斷點，不是網站本身變好或變差。
  const checks = [robotsAI, sitemap, openGraph, twitterCard, jsonLdCitation, canonical, https, lastmod, aiSnippet]
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
      lastmod,   // 2026-09-04 起計分（geo_audits.lastmod_passed）
      aiSnippet, // 2026-09-04 起計分（geo_audits.ai_snippet_passed）
    },
    // 給 UI 快速判斷用、不入 DB（geo_audits 表沒這欄）
    lastmod_passed: lastmod.passed,
    lastmod_days_since: lastmod.daysSince,
    lastmod_freshness: lastmod.freshness || 'unknown',
    ai_snippet_passed: aiSnippet.passed,
    ai_snippet_directives: aiSnippet.directives,
    analyzed_at: new Date().toISOString()
  }

  console.log('GEO Analysis complete:', result)
  return result
}

export default { analyzeGEO }
