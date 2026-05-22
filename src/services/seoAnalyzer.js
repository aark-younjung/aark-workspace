/**
 * SEO Analyzer Service
 * 檢測項目：
 * 1. Meta 標籤完整性檢測
 * 2. H1 標題結構檢測
 * 3. 圖片 Alt 屬性檢測
 * 4. 行動版相容性檢測
 * 5. 頁面載入速度檢測
 */

// Vercel Serverless API endpoint
const API_BASE = '/api/fetch-url'

/**
 * 取得網頁內容（使用 Serverless API 解決 CORS 問題）
 * @param {string} url - 目標網址
 * @returns {Promise<{html: string, sslFallback: boolean, uaFallback: boolean, antiBotBlocked: boolean}>}
 *   - html: HTML 內容
 *   - sslFallback: true 代表 SSL 憑證鏈不完整（用 relaxed verify 才抓到）
 *   - uaFallback: true 代表 Googlebot UA 被擋，後端換 Chrome 或 Bingbot UA 才成功
 *   - antiBotBlocked: true 代表 3 輪 UA 全擋 = 站對所有爬蟲都鎖死（fetch-url 會回非 200，這欄位主要用於 throw 分支）
 */
export async function fetchPageContent(url) {
  // 使用 Vercel Serverless Function API
  const proxyUrl = `${API_BASE}?url=${encodeURIComponent(url)}`

  try {
    const response = await fetch(proxyUrl)
    // 不論 HTTP 200 還是非 200，都嘗試 parse JSON body 拿錯誤細節（fetch-url 在 4xx/5xx 也會回 JSON）
    let data = null
    try { data = await response.json() } catch { /* 非 JSON 回應 */ }

    if (response.ok && data?.success) {
      return {
        html: data.content,
        sslFallback: !!data.sslFallback,
        uaFallback: !!data.uaFallback,
        antiBotBlocked: false,   // 成功取得 = 沒被擋
      }
    }

    // 組合更完整的錯誤訊息 — 包含 hint 提示與 http status
    const httpStatus = data?.status || response.status
    const errPart = data?.error || `HTTP ${response.status}`
    const hintPart = data?.hint ? `（${data.hint}）` : ''
    const msgPart = data?.message ? ` — ${data.message}` : ''
    const err = new Error(`${errPart}${hintPart}${msgPart}`)
    err.code = data?.error || `HTTP_${response.status}`
    err.status = httpStatus
    err.step = 'fetch_url'
    // 把 anti-bot 旗標掛在 err 上，供上層 catch 寫 scan_error_logs 用
    err.antiBotBlocked = !!data?.antiBotBlocked
    err.sslFallback = !!data?.sslFallback
    err.uaFallback = !!data?.uaFallback
    throw err
  } catch (error) {
    // 已是我們自己 throw 的就直接 rethrow，原 message 保留
    if (error?.step === 'fetch_url') throw error
    // network-level 錯誤（CORS、proxy 連不上等）— 包裝成易讀訊息
    console.error('Serverless fetch failed:', error)
    const wrapped = new Error(`無法抓取網頁內容：${error.message || '網路連線失敗'}`)
    wrapped.code = 'NETWORK_ERROR'
    wrapped.step = 'fetch_url'
    throw wrapped
  }
}

/**
 * 爬蟲可達性檢測 — AI 雷達核心 finding
 *
 * 從 fetch-url 三輪 UA fallback 結果推斷：
 *   - 第一輪 Googlebot 直接成功（uaFallback=false）→ 滿分
 *   - Googlebot 被擋、Chrome/Bingbot 通過（uaFallback=true）→ 部分扣分
 *   - 三輪全擋（antiBotBlocked=true）→ 0 分
 *
 * 對應「AI 雷達」品牌價值：
 * Cloudflare / WAF 鎖嚴格 → 大概率連 ChatGPTBot / PerplexityBot / ClaudeBot
 * 等 AI 引擎都抓不到 → 你的網站在 AI 答案中完全隱形
 *
 * @param {boolean} uaFallback - Googlebot 被擋換 UA 才成功
 * @param {boolean} antiBotBlocked - 三輪 UA 全擋
 * @returns {Object} - 檢測結果（傳給 SEO_CHECKS getValue 與 DB JSONB）
 */
// 注意：export 出來給 HomeDark catch block 在 fetch 直接被擋時（HTML 拿不到）
// 仍能寫一筆 partial audit 給用戶看 bot_accessibility 紅色 finding
export function checkBotAccessibility(uaFallback, antiBotBlocked) {
  if (antiBotBlocked) {
    return {
      passed: false,
      score: 0,
      blocked: true,
      fallback: false,
      message: '你的網站擋下我們的爬蟲（嘗試 Googlebot / Chrome+完整瀏覽器指紋頭 / Bingbot 三種身份全失敗）。這幾乎等同 ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎爬蟲也會被擋 — 你的網站在 AI 答案中可能完全隱形。',
      recommendation: '1. 用 https://www.cloudflare.com/learning/bots/ 確認你網站是否啟用了 Cloudflare 高等級防護 2. 進 Cloudflare 後台 Security → Bots → 把 Super Bot Fight Mode 從 Aggressive 降為 Standard 或 Off 3. 在 WAF Custom Rules 白名單以下 AI 引擎 User-Agent：GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot / anthropic-ai 4. 如果你用其他 anti-bot 服務（Imperva / DataDome 等）同理放寬 5. 修完後重新檢測，這項分數會回到 100',
    }
  }
  if (uaFallback) {
    return {
      passed: true,
      score: 60,
      blocked: false,
      fallback: true,
      message: '你的網站擋下了 Googlebot UA，我們改用 Chrome 或 Bingbot 才抓到。代表 anti-bot 設定偏嚴，部分嚴格驗證的 AI 引擎爬蟲（特別是新興 LLM bot 還沒被白名單）可能仍抓不到你的網站。',
      recommendation: '建議放寬 Cloudflare / WAF 設定，特別是 Super Bot Fight Mode 的「假冒 Googlebot」攔截規則。考慮在 WAF Custom Rules 加白名單常見 AI 引擎 UA（GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot）確保 AI 引用率最大化。',
    }
  }
  return {
    passed: true,
    score: 100,
    blocked: false,
    fallback: false,
    message: '所有爬蟲都能順利存取你的網站，AI 引擎抓取無障礙',
    recommendation: '無需處理',
  }
}

/**
 * SSL 憑證鏈完整性檢測
 * 用 fetch-url 回傳的 sslFallback 旗標判斷
 * @param {boolean} sslFallback - 是否用 relaxed verify fallback 才抓到
 * @returns {Object} - 檢測結果
 */
function checkSSLChain(sslFallback) {
  const passed = !sslFallback
  return {
    passed,
    score: passed ? 100 : 0,
    fallback: !!sslFallback,
    message: passed
      ? 'SSL 憑證鏈完整，所有爬蟲都能順利連線'
      : 'SSL 憑證鏈不完整（少送中間憑證）— 主流瀏覽器會自動補抓所以使用者看不出問題，但 Node.js 爬蟲、curl、部分監控服務、舊版 Android、企業內網代理會直接拒絕連線。含 AI 引擎在內的部分爬蟲會抓不到你的網站，影響 AI 引用率。',
    recommendation: passed
      ? '無需處理'
      : '步驟：(1) 去 https://www.ssllabs.com/ssltest/ 測你的網站，確認 "Chain issues: Incomplete" (2) 找你的網管 / 主機商，把 SSL 設定改成「完整鏈 fullchain」而非單張終端憑證 (3) Let\'s Encrypt 用戶：證書路徑改用 fullchain.pem (4) Nginx 用戶：ssl_certificate 指向 fullchain (5) Cloudflare 免費版預設就有完整鏈，無需處理',
  }
}

/**
 * 解析 HTML 為 DOM
 * @param {string} html - HTML 內容
 * @returns {Document} - DOM 物件
 */
export function parseHTML(html) {
  const parser = new DOMParser()
  return parser.parseFromString(html, 'text/html')
}

/**
 * 1. Meta 標籤完整性檢測
 * @param {Document} doc - DOM 物件
 * @returns {Object} - 檢測結果
 */
function checkMetaTags(doc) {
  const title = doc.querySelector('title')
  const metaDescription = doc.querySelector('meta[name="description"]')
  const metaKeywords = doc.querySelector('meta[name="keywords"]')
  
  const titleContent = title?.textContent?.trim() || ''
  const descriptionContent = metaDescription?.getAttribute('content')?.trim() || ''
  const keywordsContent = metaKeywords?.getAttribute('content')?.trim() || ''
  
  const hasTitle = titleContent.length > 0
  const hasDescription = descriptionContent.length > 0
  const hasKeywords = keywordsContent.length > 0
  
  // 評分標準 (滿分 33.33 分)
  let score = 0
  if (hasTitle) score += 33.33
  if (hasDescription) score += 33.33
  if (hasKeywords) score += 34
  
  return {
    hasTitle,
    hasDescription,
    hasKeywords,
    titleContent,
    descriptionContent,
    keywordsContent,
    score: Math.round(score),
    passed: hasTitle && hasDescription
  }
}

/**
 * 2. H1 標題結構檢測
 * @param {Document} doc - DOM 物件
 * @returns {Object} - 檢測結果
 */
function checkH1Structure(doc) {
  const h1Elements = doc.querySelectorAll('h1')
  const h1Count = h1Elements.length
  
  const hasH1 = h1Count > 0
  const hasOnlyOneH1 = h1Count === 1
  const h1Content = h1Elements[0]?.textContent?.trim() || ''
  
  // 評分標準
  let score = 0
  if (hasH1) score += 50
  if (hasOnlyOneH1) score += 50
  
  return {
    hasH1,
    hasOnlyOneH1,
    h1Count,
    h1Content,
    score,
    passed: hasOnlyOneH1
  }
}

/**
 * 3. 圖片 Alt 屬性檢測
 * @param {Document} doc - DOM 物件
 * @returns {Object} - 檢測結果
 */
function checkAltTags(doc) {
  const images = doc.querySelectorAll('img')
  const totalImages = images.length
  
  let imagesWithAlt = 0
  let imagesWithEmptyAlt = 0
  let imagesWithoutAlt = 0
  
  images.forEach(img => {
    const alt = img.getAttribute('alt')
    if (alt !== null) {
      if (alt.trim() === '') {
        imagesWithEmptyAlt++
      } else {
        imagesWithAlt++
      }
    } else {
      imagesWithoutAlt++
    }
  })
  
  const altCoverage = totalImages > 0 ? Math.round((imagesWithAlt / totalImages) * 100) : 100
  const hasIssues = imagesWithoutAlt > 0 || imagesWithEmptyAlt > 0
  
  // 評分標準
  let score = 0
  if (totalImages === 0) {
    score = 100
  } else {
    score = Math.round((imagesWithAlt / totalImages) * 100)
  }
  
  return {
    totalImages,
    imagesWithAlt,
    imagesWithEmptyAlt,
    imagesWithoutAlt,
    altCoverage,
    score,
    passed: !hasIssues
  }
}

/**
 * 4. 行動版相容性檢測
 * @param {Document} doc - DOM 物件
 * @returns {Object} - 檢測結果
 */
function checkMobileCompatibility(doc) {
  // viewport meta 標籤（最關鍵，沒有的話手機瀏覽器會用 980px 預設寬縮放）
  const viewport = doc.querySelector('meta[name="viewport"]')
  const hasViewport = viewport !== null

  // touch-friendly 元素（資訊用，不參與評分）
  const touchElements = doc.querySelectorAll('a[href], button, [role="button"], [onclick], [ontouchstart]')
  const hasTouchFriendly = touchElements.length > 0

  // CSS 媒體查詢（inline <style> 與 <link media="...">）
  // 注意：外部 .css 檔內的 @media 我們抓不到，只能用 inline 偵測 → 偽陰性無法完全避免
  const styleSheets = doc.querySelectorAll('style')
  let hasMediaQueries = false
  styleSheets.forEach(style => {
    if (style.textContent && style.textContent.includes('@media')) {
      hasMediaQueries = true
    }
  })
  const mediaLinks = doc.querySelectorAll('link[media]')
  if (mediaLinks.length > 0) {
    hasMediaQueries = true
  }

  // 常見 RWD 框架/CMS 指紋（class 名稱包含這些字串即視為「採用響應式框架」）
  // 解決偽陰性：很多網站 RWD 寫在外部 CSS、抓不到 @media，但 class 名會洩漏使用框架
  const bodyClass = (doc.body?.className || '').toLowerCase()
  const htmlClass = (doc.documentElement?.className || '').toLowerCase()
  const allClass = bodyClass + ' ' + htmlClass
  const rwdFrameworkHints = [
    'elementor', 'wp-', 'oceanwp', 'astra-', 'divi', 'avada',   // WordPress builders / themes
    'bootstrap', 'container-fluid', 'col-md-', 'col-lg-',         // Bootstrap
    'tailwind',                                                    // Tailwind
    'foundation-', 'uk-',                                          // Foundation / UIKit
  ]
  const hasRwdFramework = rwdFrameworkHints.some(h => allClass.includes(h))

  // 評分梯度（passed = 任何一個訊號為真就算通過）
  // viewport meta 是最關鍵的、單獨可拿 90；@media 或框架指紋只能拿 70（行動瀏覽器仍可能縮放異常）
  let score
  if (hasViewport && (hasMediaQueries || hasRwdFramework)) score = 100
  else if (hasViewport) score = 90
  else if (hasMediaQueries || hasRwdFramework) score = 70
  else score = 30

  const passed = hasViewport || hasMediaQueries || hasRwdFramework

  return {
    hasViewport,
    hasTouchFriendly,
    hasMediaQueries,
    hasRwdFramework,
    score,
    passed
  }
}

/**
 * 5. 頁面載入速度檢測
 * 透過 /api/fetch-url proxy 測量（避免瀏覽器 CORS 阻擋）
 * @param {string} url - 網址
 * @returns {Promise<Object>} - 檢測結果
 */
async function checkPageSpeed(url) {
  const clientStart = performance.now()

  try {
    const proxyUrl = `${API_BASE}?url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl, { cache: 'no-store' })
    const clientEnd = performance.now()

    // 優先使用伺服器端回傳的 fetchTime（較準確），否則用客戶端測量
    let loadTime
    if (response.ok) {
      const data = await response.json()
      loadTime = data.fetchTime ?? Math.round(clientEnd - clientStart)
    } else {
      loadTime = Math.round(clientEnd - clientStart)
    }

    // 評定速度等級
    let speedGrade = '快速'
    if (loadTime > 3000) {
      speedGrade = '緩慢'
    } else if (loadTime > 1500) {
      speedGrade = '一般'
    }

    // 評分標準 (>5秒 30分, 3-5秒 60分, 1.5-3秒 80分, <1.5秒 100分)
    let score = 100
    if (loadTime > 5000) {
      score = 30
    } else if (loadTime > 3000) {
      score = 60
    } else if (loadTime > 1500) {
      score = 80
    }

    return {
      loadTime,
      speedGrade,
      score,
      passed: loadTime < 3000
    }
  } catch (error) {
    return {
      loadTime: 0,
      speedGrade: '無法檢測',
      score: 50,
      passed: false,
      error: error.message
    }
  }
}

/**
 * 執行完整的 SEO 分析
 * @param {string} url - 目標網址
 * @returns {Promise<Object>} - 完整分析結果
 */
export async function analyzeSEO(url) {
  console.log('Starting SEO analysis for:', url)
  
  // 清理 URL
  let cleanUrl = url.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }
  
  try {
    // 取得網頁內容 + 旗標
    //   sslFallback: 憑證鏈不完整需 relaxed verify
    //   uaFallback: Googlebot 被擋換 UA 才成功
    //   antiBotBlocked: 不會在這條成功分支看到（會走 catch），但 destructure 防 undefined
    const { html, sslFallback, uaFallback, antiBotBlocked } = await fetchPageContent(cleanUrl)
    const doc = parseHTML(html)

    // 執行 7 項檢測（第 6/7 項從 fetch 旗標判定，不需 DOM）
    const metaTags = checkMetaTags(doc)
    const h1Structure = checkH1Structure(doc)
    const altTags = checkAltTags(doc)
    const mobileCompatible = checkMobileCompatibility(doc)
    const pageSpeed = await checkPageSpeed(cleanUrl)
    const sslChain = checkSSLChain(sslFallback)
    const botAccessibility = checkBotAccessibility(uaFallback, antiBotBlocked)

    // 計算總分（7 項平均）
    const totalScore = Math.round(
      (metaTags.score + h1Structure.score + altTags.score + mobileCompatible.score + pageSpeed.score + sslChain.score + botAccessibility.score) / 7
    )

    // 回傳結果
    const result = {
      url: cleanUrl,
      score: totalScore,
      meta_tags: metaTags,
      h1_structure: h1Structure,
      alt_tags: altTags,
      mobile_compatible: mobileCompatible,
      page_speed: pageSpeed,
      ssl_chain: sslChain,
      bot_accessibility: botAccessibility,
      analyzed_at: new Date().toISOString()
    }

    console.log('SEO Analysis complete:', result)
    return result

  } catch (error) {
    console.error('SEO Analysis failed:', error)
    throw error
  }
}

/**
 * 取得檢測項目列表
 * @returns {Array} - 檢測項目
 */
export function getAuditItems() {
  return [
    {
      id: 'meta_tags',
      name: 'Meta 標籤',
      description: '檢查 title、description、keywords 標籤是否完整',
      icon: '🔍'
    },
    {
      id: 'h1_structure',
      name: 'H1 標題結構',
      description: '檢查網頁是否有且僅有一個 H1 標題',
      icon: '📝'
    },
    {
      id: 'alt_tags',
      name: '圖片 Alt 標籤',
      description: '檢查圖片是否有設定 alt 屬性',
      icon: '🖼️'
    },
    {
      id: 'mobile_compatible',
      name: '行動版相容性',
      description: '檢查網站是否適合行動裝置瀏覽',
      icon: '📱'
    },
    {
      id: 'page_speed',
      name: '網頁載入速度',
      description: '檢測網頁載入時間',
      icon: '⚡'
    },
    {
      id: 'ssl_chain',
      name: 'SSL 憑證鏈完整性',
      description: '檢測 SSL 憑證是否包含中間憑證 — 不完整時嚴格爬蟲（含部分 AI 引擎）會抓不到網站',
      icon: '🔒'
    },
    {
      id: 'bot_accessibility',
      name: '爬蟲可達性',
      description: '檢測 Cloudflare / WAF 是否擋下 AI 引擎爬蟲 — anti-bot 鎖太嚴會讓你的網站在 ChatGPT/Claude/Gemini 答案中完全隱形',
      icon: '🛡️'
    }
  ]
}

export default { analyzeSEO, getAuditItems, fetchPageContent, parseHTML }
