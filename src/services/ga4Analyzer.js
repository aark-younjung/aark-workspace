/**
 * GA4 數據分析服務
 * 串接 Google Analytics 4 Data API
 * 
 * 數據指標：
 * - sessions: 工作階段
 * - activeUsers: 活躍使用者
 * - bounceRate: 跳出率
 * - pageViews: 網頁瀏覽量
 */

// n8n Webhook URL
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'

// API 配置
const API_CONFIG = {
  useN8n: true,  // 使用 n8n 作為代理
  ga4Endpoint: 'https://analyticsdata.googleapis.com/v1beta'
}

/**
 * 透過 n8n 獲取 GA4 數據（推薦方式）
 * @param {string} propertyId - GA4 屬性 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - GA4 數據
 */
async function fetchGA4ViaN8n(propertyId, options = {}) {
  const {
    startDate = '30daysAgo',
    endDate = 'today',
    dimensions = ['date']
  } = options
  
  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}/ga4/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyId,
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map(d => ({ name: d })),
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' },
          { name: 'newUsers' },
          { name: 'engagedSessions' }
        ]
      })
    })
    
    if (!response.ok) {
      throw new Error(`GA4 API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('GA4 n8n fetch error:', error)
    throw error
  }
}

/**
 * 直接調用 GA4 Data API（需要後端代理）
 * @param {string} accessToken - OAuth Access Token
 * @param {string} propertyId - GA4 屬性 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - GA4 數據
 */
async function fetchGA4Direct(accessToken, propertyId, options = {}) {
  const {
    startDate = '30daysAgo',
    endDate = 'today'
  } = options
  
  const requestBody = {
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate,
        endDate
      }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
      { name: 'screenPageViews' },
      { name: 'newUsers' },
      { name: 'engagedSessions' }
    ],
    dimensions: [
      { name: 'date' }
    ]
  }
  
  const response = await fetch(
    `${API_CONFIG.ga4Endpoint}/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }
  )
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'GA4 API request failed')
  }
  
  return await response.json()
}

/**
 * 解析 GA4 API 響應
 * @param {Object} response - API 響應
 * @returns {Object} - 格式化後的數據
 */
function parseGA4Response(response) {
  if (!response.rows || response.rows.length === 0) {
    return {
      summary: {
        sessions: 0,
        activeUsers: 0,
        bounceRate: 0,
        pageViews: 0,
        newUsers: 0,
        engagedSessions: 0
      },
      timeline: []
    }
  }
  
  // 計算總計
  const summary = {
    sessions: 0,
    activeUsers: 0,
    bounceRate: 0,
    pageViews: 0,
    newUsers: 0,
    engagedSessions: 0
  }
  
  // 解析時間序列數據
  const timeline = response.rows.map(row => {
    const dateStr = row.dimensionValues[0].value
    // 格式化日期 YYYYMMDD -> YYYY-MM-DD
    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
    
    const metrics = {
      sessions: parseInt(row.metricValues[0].value) || 0,
      activeUsers: parseInt(row.metricValues[1].value) || 0,
      bounceRate: parseFloat(row.metricValues[2].value) || 0,
      pageViews: parseInt(row.metricValues[3].value) || 0,
      newUsers: parseInt(row.metricValues[4].value) || 0,
      engagedSessions: parseInt(row.metricValues[5].value) || 0
    }
    
    // 累加到總計
    summary.sessions += metrics.sessions
    summary.activeUsers += metrics.activeUsers
    summary.pageViews += metrics.pageViews
    summary.newUsers += metrics.newUsers
    summary.engagedSessions += metrics.engagedSessions
    
    return {
      date: formattedDate,
      ...metrics
    }
  })
  
  // 計算平均跳出率
  if (timeline.length > 0) {
    summary.bounceRate = timeline.reduce((sum, d) => sum + d.bounceRate, 0) / timeline.length
  }
  
  return { summary, timeline }
}

/**
 * 獲取 GA4 摘要數據
 * @param {string} propertyId - GA4 屬性 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 摘要數據
 */
export async function getGA4Summary(propertyId, options = {}) {
  if (!propertyId) {
    throw new Error('GA4 Property ID is required')
  }
  
  const response = API_CONFIG.useN8n 
    ? await fetchGA4ViaN8n(propertyId, options)
    : await fetchGA4Direct(null, propertyId, options)
  
  const { summary, timeline } = parseGA4Response(response)
  
  return {
    propertyId,
    period: {
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today'
    },
    sessions: summary.sessions,
    activeUsers: summary.activeUsers,
    bounceRate: Math.round(summary.bounceRate * 100) / 100,
    pageViews: summary.pageViews,
    newUsers: summary.newUsers,
    engagedSessions: summary.engagedSessions,
    // 計算衍生指標
    avgSessionDuration: summary.sessions > 0 
      ? Math.round((summary.engagedSessions / summary.sessions) * 100) 
      : 0,
    timeline,
    fetchedAt: new Date().toISOString()
  }
}

/**
 * 獲取流量來源數據
 * @param {string} propertyId - GA4 屬性 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 流量來源數據
 */
export async function getTrafficSources(propertyId, options = {}) {
  if (!propertyId) {
    throw new Error('GA4 Property ID is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today' } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/ga4/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' }
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' }
      ],
      limit: 10
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch traffic sources')
  }
  
  const data = await response.json()
  
  if (!data.rows) {
    return { sources: [] }
  }
  
  const sources = data.rows.map(row => ({
    source: row.dimensionValues[0].value,
    medium: row.dimensionValues[1].value,
    sessions: parseInt(row.metricValues[0].value),
    users: parseInt(row.metricValues[1].value)
  }))
  
  return { sources }
}

/**
 * 獲取熱門頁面數據
 * @param {string} propertyId - GA4 屬性 ID
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 熱門頁面數據
 */
export async function getTopPages(propertyId, options = {}) {
  if (!propertyId) {
    throw new Error('GA4 Property ID is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today', limit = 10 } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/ga4/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      propertyId,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'averageSessionDuration' }
      ],
      limit
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch top pages')
  }
  
  const data = await response.json()
  
  if (!data.rows) {
    return { pages: [] }
  }
  
  const pages = data.rows.map(row => ({
    path: row.dimensionValues[0].value,
    views: parseInt(row.metricValues[0].value),
    sessions: parseInt(row.metricValues[1].value),
    avgDuration: parseFloat(row.metricValues[2].value) || 0
  }))
  
  return { pages }
}

/**
 * 獲取可用的 GA4 屬性列表
 * @returns {Promise<Array>} - 屬性列表
 */
export async function getGA4Properties() {
  const response = await fetch(`${N8N_WEBHOOK_URL}/ga4/properties`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch GA4 properties')
  }
  
  const data = await response.json()
  return data.properties || []
}

export default {
  getGA4Summary,
  getTrafficSources,
  getTopPages,
  getGA4Properties
}
