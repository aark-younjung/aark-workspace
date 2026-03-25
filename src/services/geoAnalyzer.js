/**
 * GEO (Google Business Profile) 在地化檢測服務
 * 檢測項目：
 * 1. 商家名稱一致性
 * 2. 地址正確性
 * 3. 電話號碼一致性
 * 4. 星星評分
 * 5. 評論數量
 * 6. 正面/負面評論比率
 * 
 * API 文件：https://developers.google.com/my-business
 * 認證：OAuth 2.0 with scope: https://www.googleapis.com/auth/business.manage
 */

// Google Business Profile API 端點
const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_REVIEWS_API_BASE = 'https://mybusinessnotifications.googleapis.com/v1'

/**
 * 從 Google Business Profile 取得商家資訊
 * @param {string} accessToken - OAuth 2.0 access token
 * @param {string} accountId - Google Business Account ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} - 商家資訊
 */
export async function fetchBusinessProfile(accessToken, accountId, locationId) {
  const url = `${GBP_API_BASE}/accounts/${accountId}/locations/${locationId}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to fetch business profile: ${error.error?.message || response.statusText}`)
  }
  
  return await response.json()
}

/**
 * 取得商家評論
 * @param {string} accessToken - OAuth 2.0 access token
 * @param {string} accountId - Google Business Account ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Array>} - 評論列表
 */
export async function fetchBusinessReviews(accessToken, accountId, locationId) {
  const url = `${GBP_REVIEWS_API_BASE}/accounts/${accountId}/locations/${locationId}/reviews`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to fetch reviews: ${error.error?.message || response.statusText}`)
  }
  
  const data = await response.json()
  return data.reviews || []
}

/**
 * 1. 商家名稱一致性檢測
 * @param {string} gbpName - Google Business Profile 名稱
 * @param {string} expectedName - 預期商家名稱
 * @returns {Object} - 檢測結果
 */
export function checkBusinessName(gbpName, expectedName) {
  const gbp = gbpName?.trim() || ''
  const expected = expectedName?.trim() || ''
  
  // 完全匹配
  const exactMatch = gbp === expected
  
  // 忽略大小寫匹配
  const caseInsensitiveMatch = gbp.toLowerCase() === expected.toLowerCase()
  
  // 包含匹配
  const containsMatch = gbp.toLowerCase().includes(expected.toLowerCase()) || 
                       expected.toLowerCase().includes(gbp.toLowerCase())
  
  // 計算相似度
  let similarity = 0
  if (exactMatch) {
    similarity = 100
  } else if (caseInsensitiveMatch) {
    similarity = 95
  } else if (containsMatch) {
    similarity = 80
  } else {
    // 計算 Levenshtein 距離相似度
    similarity = calculateSimilarity(gbp, expected)
  }
  
  return {
    gbpName: gbp,
    expectedName: expected,
    exactMatch,
    caseInsensitiveMatch,
    containsMatch,
    similarity: Math.round(similarity),
    passed: similarity >= 80,
    score: Math.round(similarity)
  }
}

/**
 * 2. 地址正確性檢測
 * @param {Object} gbpAddress - Google Business Profile 地址物件
 * @param {string} expectedAddress - 預期地址
 * @returns {Object} - 檢測結果
 */
export function checkAddress(gbpAddress, expectedAddress) {
  const gbpAddressStr = formatGBPAddress(gbpAddress)
  const expected = expectedAddress?.trim() || ''
  
  // 清理地址以便比較
  const normalizedGbp = normalizeAddress(gbpAddressStr)
  const normalizedExpected = normalizeAddress(expected)
  
  const exactMatch = normalizedGbp === normalizedExpected
  const similarity = calculateSimilarity(normalizedGbp, normalizedExpected)
  
  // 檢查各個地址元件
  const hasStreetAddress = !!gbpAddress?.addressLines?.length
  const hasCity = !!gbpAddress?.locality
  const hasRegion = !!gbpAddress?.region
  const hasPostalCode = !!gbpAddress?.postalCode
  const hasCountry = !!gbpAddress?.countryCode
  
  const completenessScore = [
    hasStreetAddress,
    hasCity,
    hasRegion,
    hasPostalCode,
    hasCountry
  ].filter(Boolean).length * 20
  
  return {
    gbpAddress: gbpAddressStr,
    expectedAddress: expected,
    formattedAddress: gbpAddressStr,
    components: {
      streetAddress: gbpAddress?.addressLines?.[0] || '',
      city: gbpAddress?.locality || '',
      region: gbpAddress?.region || '',
      postalCode: gbpAddress?.postalCode || '',
      country: gbpAddress?.countryCode || ''
    },
    hasStreetAddress,
    hasCity,
    hasRegion,
    hasPostalCode,
    hasCountry,
    completenessScore,
    exactMatch,
    similarity: Math.round(similarity),
    passed: similarity >= 70 && completenessScore >= 60,
    score: Math.round((similarity + completenessScore) / 2)
  }
}

/**
 * 3. 電話號碼一致性檢測
 * @param {string} gbpPhone - Google Business Profile 電話
 * @param {string} expectedPhone - 預期電話
 * @returns {Object} - 檢測結果
 */
export function checkPhoneNumber(gbpPhone, expectedPhone) {
  const gbp = normalizePhone(gbpPhone)
  const expected = normalizePhone(expectedPhone)
  
  const exactMatch = gbp === expected
  
  // 檢查號碼是否只有微小差異（例如國家代碼）
  let similar = false
  if (gbp.length >= 9 && expected.length >= 9) {
    const gbpLocal = gbp.slice(-9)
    const expectedLocal = expected.slice(-9)
    similar = gbpLocal === expectedLocal
  }
  
  const similarity = exactMatch ? 100 : (similar ? 85 : calculateSimilarity(gbp, expected))
  
  return {
    gbpPhone: gbpPhone || '',
    expectedPhone: expectedPhone || '',
    exactMatch,
    similar,
    similarity: Math.round(similarity),
    passed: similarity >= 80,
    score: Math.round(similarity)
  }
}

/**
 * 4. 星星評分檢測
 * @param {number} rating - 評分 (0-5)
 * @returns {Object} - 檢測結果
 */
export function checkRating(rating) {
  const r = typeof rating === 'number' ? rating : parseFloat(rating) || 0
  
  // 評分標準：
  // 5星: 100分, 4.5+: 90分, 4+: 80分, 3.5+: 70分, 3+: 60分, <3: 40分
  let score = 0
  let grade = ''
  let passed = false
  
  if (r >= 4.5) {
    score = 100
    grade = '優秀'
    passed = true
  } else if (r >= 4.0) {
    score = 85
    grade = '良好'
    passed = true
  } else if (r >= 3.5) {
    score = 70
    grade = '普通'
    passed = true
  } else if (r >= 3.0) {
    score = 55
    grade = '偏低'
    passed = false
  } else {
    score = 30
    grade = '需改善'
    passed = false
  }
  
  return {
    rating: r,
    ratingDisplay: r.toFixed(1),
    grade,
    score,
    passed,
    recommendation: getRatingRecommendation(r)
  }
}

/**
 * 5. 評論數量檢測
 * @param {number} reviewCount - 評論數量
 * @returns {Object} - 檢測結果
 */
export function checkReviewCount(reviewCount) {
  const count = typeof reviewCount === 'number' ? reviewCount : parseInt(reviewCount) || 0
  
  // 評論數量標準：
  // >=50: 100分, >=20: 80分, >=10: 60分, >=5: 40分, <5: 20分
  let score = 0
  let grade = ''
  let passed = false
  
  if (count >= 50) {
    score = 100
    grade = '優秀'
    passed = true
  } else if (count >= 20) {
    score = 80
    grade = '良好'
    passed = true
  } else if (count >= 10) {
    score = 60
    grade = '普通'
    passed = true
  } else if (count >= 5) {
    score = 40
    grade: '偏少'
    passed = false
  } else {
    score = 20
    grade = '過少'
    passed = false
  }
  
  return {
    reviewCount: count,
    countDisplay: count.toLocaleString(),
    grade,
    score,
    passed,
    recommendation: getReviewCountRecommendation(count)
  }
}

/**
 * 6. 正面/負面評論比率分析
 * @param {Array} reviews - 評論陣列
 * @returns {Object} - 檢測結果
 */
export function analyzeReviewSentiment(reviews) {
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return {
      totalReviews: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      sentimentScore: 0,
      grade: '無評論',
      passed: false,
      score: 0
    }
  }
  
  let positiveCount = 0
  let negativeCount = 0
  let neutralCount = 0
  const recentReviews = reviews.slice(0, 20) // 只分析最近20則評論
  
  recentReviews.forEach(review => {
    const starRating = review?.starRating || review?.rating || 0
    if (starRating >= 4) {
      positiveCount++
    } else if (starRating <= 2) {
      negativeCount++
    } else {
      neutralCount++
    }
  })
  
  const total = positiveCount + negativeCount + neutralCount
  const positiveRatio = total > 0 ? (positiveCount / total) * 100 : 0
  const negativeRatio = total > 0 ? (negativeCount / total) * 100 : 0
  
  // 情感分數：正面評論比率 - 負面評論比率
  const sentimentScore = positiveRatio - negativeRatio
  
  // 評分標準
  let score = 0
  let grade = ''
  let passed = false
  
  if (sentimentScore >= 70) {
    score = 100
    grade = '極佳'
    passed = true
  } else if (sentimentScore >= 50) {
    score = 80
    grade = '良好'
    passed = true
  } else if (sentimentScore >= 30) {
    score = 60
    grade: '普通'
    passed = true
  } else if (sentimentScore >= 0) {
    score = 40
    grade = '偏差'
    passed = false
  } else {
    score = 20
    grade = '需改善'
    passed = false
  }
  
  // 找出最近的負面評論
  const recentNegativeReviews = recentReviews
    .filter(r => (r?.starRating || r?.rating || 0) <= 2)
    .slice(0, 3)
    .map(r => ({
      starRating: r.starRating || r.rating,
      comment: r.comment || r.text || '',
      reviewId: r.name || r.reviewId
    }))
  
  return {
    totalReviews: reviews.length,
    analyzedReviews: recentReviews.length,
    positiveCount,
    negativeCount,
    neutralCount,
    positiveRatio: Math.round(positiveRatio),
    negativeRatio: Math.round(negativeRatio),
    sentimentScore: Math.round(sentimentScore),
    grade,
    passed,
    score,
    recentNegativeReviews,
    recommendation: getSentimentRecommendation(sentimentScore)
  }
}

/**
 * 完整的 GEO 分析
 * @param {Object} params - 分析參數
 * @param {string} params.accessToken - OAuth 2.0 access token
 * @param {string} params.accountId - Google Business Account ID
 * @param {string} params.locationId - Location ID
 * @param {Object} params.expectedData - 預期資料（用於比對）
 * @returns {Promise<Object>} - 完整分析結果
 */
export async function analyzeGEO({ accessToken, accountId, locationId, expectedData = {} }) {
  console.log('Starting GEO analysis for location:', locationId)
  
  try {
    // 取得商家資訊
    const businessProfile = await fetchBusinessProfile(accessToken, accountId, locationId)
    
    // 取得評論
    const reviews = await fetchBusinessReviews(accessToken, accountId, locationId)
    
    // 執行各項檢測
    const nameCheck = checkBusinessName(
      businessProfile.name,
      expectedData.businessName
    )
    
    const addressCheck = checkAddress(
      businessProfile.address,
      expectedData.address
    )
    
    const phoneCheck = checkPhoneNumber(
      businessProfile.phoneNumber,
      expectedData.phone
    )
    
    const ratingCheck = checkRating(businessProfile.rating)
    
    const reviewCountCheck = checkReviewCount(businessProfile.userReviewsCount)
    
    const sentimentCheck = analyzeReviewSentiment(reviews)
    
    // 計算總分數
    const totalScore = Math.round(
      (nameCheck.score + 
       addressCheck.score + 
       phoneCheck.score + 
       ratingCheck.score + 
       reviewCountCheck.score + 
       sentimentCheck.score) / 6
    )
    
    // 構建結果物件
    const result = {
      locationId,
      locationName: businessProfile.name,
      storeCode: businessProfile.storeCode,
      score: totalScore,
      business_name: nameCheck,
      address: addressCheck,
      phone: phoneCheck,
      rating: ratingCheck,
      review_count: reviewCountCheck,
      sentiment: sentimentCheck,
      raw_data: {
        name: businessProfile.name,
        address: businessProfile.address,
        phoneNumber: businessProfile.phoneNumber,
        rating: businessProfile.rating,
        totalReviewCount: businessProfile.userReviewsCount,
        websiteUri: businessProfile.websiteUri,
        regularHours: businessProfile.regularHours
      },
      analyzed_at: new Date().toISOString()
    }
    
    console.log('GEO Analysis complete:', result)
    return result
    
  } catch (error) {
    console.error('GEO Analysis failed:', error)
    throw error
  }
}

/**
 * 離線模式：使用手動輸入的資料進行分析
 * @param {Object} params - 分析參數
 * @returns {Object} - 分析結果
 */
export function analyzeGEOManual({ 
  gbpData = {}, 
  expectedData = {} 
}) {
  console.log('Starting manual GEO analysis')
  
  const {
    name: gbpName = '',
    address: gbpAddress = {},
    phoneNumber: gbpPhone = '',
    rating: gbpRating = 0,
    userReviewsCount: reviewCount = 0,
    reviews = []
  } = gbpData
  
  // 執行各項檢測
  const nameCheck = checkBusinessName(gbpName, expectedData.businessName)
  const addressCheck = checkAddress(gbpAddress, expectedData.address)
  const phoneCheck = checkPhoneNumber(gbpPhone, expectedData.phone)
  const ratingCheck = checkRating(gbpRating)
  const reviewCountCheck = checkReviewCount(reviewCount)
  const sentimentCheck = analyzeReviewSentiment(reviews)
  
  // 計算總分數
  const totalScore = Math.round(
    (nameCheck.score + 
     addressCheck.score + 
     phoneCheck.score + 
     ratingCheck.score + 
     reviewCountCheck.score + 
     sentimentCheck.score) / 6
  )
  
  return {
    score: totalScore,
    business_name: nameCheck,
    address: addressCheck,
    phone: phoneCheck,
    rating: ratingCheck,
    review_count: reviewCountCheck,
    sentiment: sentimentCheck,
    analyzed_at: new Date().toISOString()
  }
}

/**
 * 獲取檢測項目說明
 * @returns {Array} - 檢測項目列表
 */
export function getAuditItems() {
  return [
    {
      id: 'business_name',
      name: '商家名稱一致性',
      description: '檢查 Google 商家名稱與官網是否一致',
      icon: '🏪'
    },
    {
      id: 'address',
      name: '地址正確性',
      description: '檢查地址資訊是否完整且正確',
      icon: '📍'
    },
    {
      id: 'phone',
      name: '電話號碼一致性',
      description: '檢查電話號碼與官網是否一致',
      icon: '📞'
    },
    {
      id: 'rating',
      name: '星星評分',
      description: '檢視 Google 商家評分',
      icon: '⭐'
    },
    {
      id: 'review_count',
      name: '評論數量',
      description: '檢查評論數量是否足夠',
      icon: '💬'
    },
    {
      id: 'sentiment',
      name: '評論情感分析',
      description: '分析正面/負面評論比率',
      icon: '😊'
    }
  ]
}

// ============ 輔助函數 ============

/**
 * 計算 Levenshtein 相似度
 */
function calculateSimilarity(str1, str2) {
  if (!str1 && !str2) return 100
  if (!str1 || !str2) return 0
  
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  if (s1 === s2) return 100
  
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  )
  
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j
  }
  
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      )
    }
  }
  
  const distance = track[s2.length][s1.length]
  const maxLength = Math.max(s1.length, s2.length)
  return ((maxLength - distance) / maxLength) * 100
}

/**
 * 格式化 Google Business Profile 地址
 */
function formatGBPAddress(address) {
  if (!address) return ''
  
  const parts = []
  if (address.addressLines?.length) {
    parts.push(...address.addressLines)
  }
  if (address.locality) parts.push(address.locality)
  if (address.region) parts.push(address.region)
  if (address.postalCode) parts.push(address.postalCode)
  if (address.countryCode) parts.push(address.countryCode)
  
  return parts.join(', ')
}

/**
 * 標準化地址（移除空白和標點）
 */
function normalizeAddress(address) {
  if (!address) return ''
  return address
    .toLowerCase()
    .replace(/[\s,\.]/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '')
}

/**
 * 標準化電話號碼
 */
function normalizePhone(phone) {
  if (!phone) return ''
  return phone
    .replace(/[\s\-\(\)\+]/g, '')
    .replace(/^886/, '0')
}

/**
 * 取得評分建議
 */
function getRatingRecommendation(rating) {
  if (rating >= 4.5) {
    return '評分非常優秀，維持良好的客戶服務品質'
  } else if (rating >= 4.0) {
    return '評分良好，建議持續優化客戶體驗'
  } else if (rating >= 3.5) {
    return '評分普通，建議改善服務品質以提升評分'
  } else {
    return '評分偏低，建議積極回應客戶評論並改善服務'
  }
}

/**
 * 取得評論數量建議
 */
function getReviewCountRecommendation(count) {
  if (count >= 50) {
    return '評論數量充足，已建立良好的在地影響力'
  } else if (count >= 20) {
    return '評論數量不錯，建議鼓勵滿意客戶留下評論'
  } else if (count >= 10) {
    return '評論數量適中，建議增加評論數量以提升信任度'
  } else {
    return '評論數量不足，建議積極邀請客戶留下 Google 評論'
  }
}

/**
 * 取得情感分析建議
 */
function getSentimentRecommendation(sentimentScore) {
  if (sentimentScore >= 70) {
    return '客戶滿意度極高，維持現有服務水準'
  } else if (sentimentScore >= 50) {
    return '客戶評價正面，持續關注並回應客戶意見'
  } else if (sentimentScore >= 30) {
    return '有部分負面評論，建議分析問題並改善'
  } else {
    return '負面評論較多，需要立即關注並改善客戶體驗'
  }
}

export default { analyzeGEO, analyzeGEOManual, getAuditItems }
