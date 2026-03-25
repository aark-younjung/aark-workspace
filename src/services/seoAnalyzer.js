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
 * @returns {Promise<string>} - HTML 內容
 */
export async function fetchPageContent(url) {
  // 使用 Vercel Serverless Function API
  const proxyUrl = `${API_BASE}?url=${encodeURIComponent(url)}`
  
  try {
    const response = await fetch(proxyUrl)
    if (response.ok) {
      const data = await response.json()
      if (data.success) {
        return data.content
      }
      throw new Error(data.error || 'Failed to fetch')
    }
    throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    console.error('Serverless fetch failed:', error)
    throw new Error('無法抓取網頁內容')
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
  const viewport = doc.querySelector('meta[name="viewport"]')
  const hasViewport = viewport !== null
  
  // 檢查 touch-friendly 元素
  const touchElements = doc.querySelectorAll('a[href], button, [role="button"], [onclick], [ontouchstart]')
  const hasTouchFriendly = touchElements.length > 0
  
  // 檢查 CSS 媒體查詢
  const styleSheets = doc.querySelectorAll('style')
  let hasMediaQueries = false
  styleSheets.forEach(style => {
    if (style.textContent && style.textContent.includes('@media')) {
      hasMediaQueries = true
    }
  })
  
  // 檢查 link[media]
  const mediaLinks = doc.querySelectorAll('link[media]')
  if (mediaLinks.length > 0) {
    hasMediaQueries = true
  }
  
  const score = hasViewport ? 100 : 50
  
  return {
    hasViewport,
    hasTouchFriendly,
    hasMediaQueries,
    score,
    passed: hasViewport
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
    // 取得網頁內容
    const html = await fetchPageContent(cleanUrl)
    const doc = parseHTML(html)
    
    // 執行各項檢測
    const metaTags = checkMetaTags(doc)
    const h1Structure = checkH1Structure(doc)
    const altTags = checkAltTags(doc)
    const mobileCompatible = checkMobileCompatibility(doc)
    const pageSpeed = await checkPageSpeed(cleanUrl)
    
    // 計算總分
    const totalScore = Math.round(
      (metaTags.score + h1Structure.score + altTags.score + mobileCompatible.score + pageSpeed.score) / 5
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
    }
  ]
}

export default { analyzeSEO, getAuditItems, fetchPageContent, parseHTML }
