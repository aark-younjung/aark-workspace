/**
 * SEO ?箇?瑼Ｘ葫??
 * 瑼Ｘ葫?嚗? * 1. Meta 璅惜摰?扳炎皜? * 2. H1 璅?蝯?瑼Ｘ葫
 * 3. ?? Alt 撅祆扳炎皜? * 4. 銵??摰寞扳炎皜? * 5. ?頛?漲瑼Ｘ葫
 */

// 雿輻 CORS 隞??隡箸??其?蝜?頝典??
const CORS_PROXY = 'https://api.allorigins.win/raw?url='

/**
 * ?脣?蝬脤??批捆
 * @param {string} url - ?格?蝬脣?
 * @returns {Promise<string>} - HTML ?批捆
 */
export async function fetchPageContent(url) {
  try {
    // ?岫?湔 fetch
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (response.ok) {
      return await response.text()
    }
  } catch (error) {
    console.log('Direct fetch failed, trying CORS proxy...')
  }
  
  // 雿輻 CORS 隞??
  try {
    const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url)
    const response = await fetch(proxyUrl)
    if (response.ok) {
      const data = await response.json()
      return data.contents
    }
  } catch (error) {
    console.error('CORS proxy also failed:', error)
  }
  
  throw new Error('?⊥??脣?蝬脤??批捆')
}

/**
 * 閫?? HTML ??DOM
 * @param {string} html - HTML ?批捆
 * @returns {Document} - DOM ?辣
 */
export function parseHTML(html) {
  const parser = new DOMParser()
  return parser.parseFromString(html, 'text/html')
}

/**
 * 1. Meta 璅惜摰?扳炎皜? * @param {Document} doc - DOM ??
 * @returns {Object} - 瑼Ｘ葫蝯?
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
  
  // 閮?? (瘥? 33.33 ??
  let score = 0
  if (hasTitle) score += 33.33
  if (hasDescription) score += 33.33
  if (hasKeywords) score += 33.34
  
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
 * 2. H1 璅?蝯?瑼Ｘ葫
 * @param {Document} doc - DOM ??
 * @returns {Object} - 瑼Ｘ葫蝯?
 */
function checkH1Structure(doc) {
  const h1Elements = doc.querySelectorAll('h1')
  const h1Count = h1Elements.length
  
  const hasH1 = h1Count > 0
  const hasOnlyOneH1 = h1Count === 1
  const h1Content = h1Elements[0]?.textContent?.trim() || ''
  
  // 閮??
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
 * 3. ?? Alt 撅祆扳炎皜? * @param {Document} doc - DOM ??
 * @returns {Object} - 瑼Ｘ葫蝯?
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
  
  // 閮??
  let score = 0
  if (totalImages === 0) {
    score = 100 // 瘝???銋???
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
 * 4. 銵??摰寞扳炎皜? * @param {Document} doc - DOM ??
 * @returns {Object} - 瑼Ｘ葫蝯?
 */
function checkMobileCompatibility(doc) {
  const viewport = doc.querySelector('meta[name="viewport"]')
  const hasViewport = viewport !== null
  
  // 瑼Ｘ touch-friendly ??
  const touchElements = doc.querySelectorAll('a[href], button, [role="button"], [onclick], [ontouchstart]')
  const hasTouchFriendly = touchElements.length > 0
  
  // 瑼Ｘ?臬??CSS 慦??亥岷
  const styleSheets = doc.querySelectorAll('style')
  let hasMediaQueries = false
  styleSheets.forEach(style => {
    if (style.textContent && style.textContent.includes('@media')) {
      hasMediaQueries = true
    }
  })
  
  // 瑼Ｘ link[media]
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
 * 5. ?頛?漲瑼Ｘ葫
 * @param {string} url - 蝬脣?
 * @returns {Promise<Object>} - 瑼Ｘ葫蝯?
 */
async function checkPageSpeed(url) {
  const startTime = performance.now()
  
  try {
    // ?岫 fetch 鞈?靘葫????
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store'
    })
    
    const endTime = performance.now()
    const loadTime = Math.round(endTime - startTime)
    
    // 閰摯?漲
    let speedGrade = '?臬末'
    if (loadTime > 3000) {
      speedGrade = '??孵?'
    } else if (loadTime > 1500) {
      speedGrade = '?桅?'
    }
    
    // 閮?? (3蝘 100?? 3-5蝘?60?? 5蝘誑銝?30??
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
      speedGrade: '?⊥?瑼Ｘ葫',
      score: 50,
      passed: false,
      error: error.message
    }
  }
}

/**
 * 摰??SEO ??
 * @param {string} url - ?格?蝬脣?
 * @returns {Promise<Object>} - 摰??蝯?
 */
export async function analyzeSEO(url) {
  console.log('Starting SEO analysis for:', url)
  
  // 撽? URL
  let cleanUrl = url.trim()
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl
  }
  
  try {
    // ?脣???批捆
    const html = await fetchPageContent(cleanUrl)
    const doc = parseHTML(html)
    
    // ?瑁???瑼Ｘ葫
    const metaTags = checkMetaTags(doc)
    const h1Structure = checkH1Structure(doc)
    const altTags = checkAltTags(doc)
    const mobileCompatible = checkMobileCompatibility(doc)
    const pageSpeed = await checkPageSpeed(cleanUrl)
    
    // 閮?蝮賢???
    const totalScore = Math.round(
      (metaTags.score + h1Structure.score + altTags.score + mobileCompatible.score + pageSpeed.score) / 5
    )
    
    // 瑽遣蝯??拐辣
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
 * ?脣?瑼Ｘ葫?隤芣?
 * @returns {Array} - 瑼Ｘ葫??”
 */
export function getAuditItems() {
  return [
    {
      id: 'meta_tags',
      name: 'Meta 璅惜',
      description: '瑼Ｘ title?escription?eywords 璅惜?臬摰',
      icon: '?儭?'
    },
    {
      id: 'h1_structure',
      name: 'H1 璅?蝯?',
      description: '瑼Ｘ??臬????銝??H1 璅?',
      icon: '??'
    },
    {
      id: 'alt_tags',
      name: '?? Alt 撅祆?',
      description: '瑼Ｘ???臬??嗥? alt ?膩??',
      icon: '?儭?'
    },
    {
      id: 'mobile_compatible',
      name: '銵??摰?',
      description: '瑼Ｘ?臬?舀銵?鋆蔭?汗',
      icon: '?'
    },
    {
      id: 'page_speed',
      name: '?頛?漲',
      description: '皜祇??頛??',
      icon: '??'
    }
  ]
}

export default { analyzeSEO, getAuditItems, fetchPageContent, parseHTML }
