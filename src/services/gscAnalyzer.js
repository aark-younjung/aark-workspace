/**
 * GSC (Google Search Console) 數據分析服務
 * 透過 /api/gsc-data Vercel proxy 串接 Google Search Console API
 */

import { getAccessToken } from './googleAuth'

/**
 * 透過 n8n 獲取 GSC 數據（推薦方式）
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - GSC 數據
 */
async function fetchGSCViaN8n(siteUrl, options = {}) {
  const {
    startDate = '30daysAgo',
    endDate = 'today',
    dimensions = ['date'],
    rowLimit = 1000
  } = options
  
  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}/gsc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        siteUrl,
        startDate,
        endDate,
        dimensions,
        rowLimit
      })
    })
    
    if (!response.ok) {
      throw new Error(`GSC API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('GSC n8n fetch error:', error)
    throw error
  }
}

/**
 * 直接調用 GSC API（需要後端代理）
 * @param {string} accessToken - OAuth Access Token
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - GSC 數據
 */
async function fetchGSCDirect(accessToken, siteUrl, options = {}) {
  const {
    startDate = '30daysAgo',
    endDate = 'today',
    dimensions = ['date'],
    rowLimit = 1000
  } = options
  
  // 轉換日期格式（n8n 風格 -> GSC 風格）
  const formattedStartDate = formatDateForGSC(startDate)
  const formattedEndDate = formatDateForGSC(endDate)
  
  const requestBody = {
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    dimensions,
    rowLimit
  }
  
  const encodedSiteUrl = encodeURIComponent(siteUrl)
  
  const response = await fetch(
    `${API_CONFIG.gscEndpoint}/sites/${encodedSiteUrl}/searchAnalytics/query`,
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
    throw new Error(error.error?.message || 'GSC API request failed')
  }
  
  return await response.json()
}

/**
 * 將相對日期轉換為 GSC 格式
 * @param {string} dateStr - 日期字串
 * @returns {string} - YYYY-MM-DD 格式
 */
function formatDateForGSC(dateStr) {
  const now = new Date()
  
  if (dateStr === 'today') {
    return now.toISOString().split('T')[0]
  }
  
  if (dateStr === 'yesterday') {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
  
  if (dateStr.includes('daysAgo')) {
    const days = parseInt(dateStr.replace('daysAgo', ''))
    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - days)
    return pastDate.toISOString().split('T')[0]
  }
  
  // 假設已經是 YYYY-MM-DD 格式
  return dateStr
}

/**
 * 解析 GSC API 響應
 * @param {Object} response - API 響應
 * @returns {Object} - 格式化後的數據
 */
function parseGSCResponse(response) {
  if (!response.rows || response.rows.length === 0) {
    return {
      summary: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0
      },
      timeline: [],
      topQueries: []
    }
  }
  
  // 計算總計
  const summary = {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0
  }
  
  // 按日期分組
  const dateMap = new Map()
  // 關鍵字數據
  const queryMap = new Map()
  
  response.rows.forEach(row => {
    const keys = row.keys || []
    const date = keys[0] || ''
    const query = keys[1] || ''
    const page = keys[1] || ''
    
    const clicks = row.clicks || 0
    const impressions = row.impressions || 0
    const ctr = row.ctr || 0
    const position = row.position || 0
    
    // 累加總計
    summary.clicks += clicks
    summary.impressions += impressions
    
    // 日期維度數據
    if (date) {
      if (!dateMap.has(date)) {
        dateMap.set(date, { clicks: 0, impressions: 0, ctrValues: [], positionValues: [] })
      }
      const dateData = dateMap.get(date)
      dateData.clicks += clicks
      dateData.impressions += impressions
      dateData.ctrValues.push(ctr)
      dateData.positionValues.push(position)
    }
    
    // 關鍵字維度數據
    if (query) {
      if (!queryMap.has(query)) {
        queryMap.set(query, { clicks: 0, impressions: 0, ctr: 0, position: 0 })
      }
      const queryData = queryMap.get(query)
      queryData.clicks += clicks
      queryData.impressions += impressions
    }
  })
  
  // 轉換時間序列
  const timeline = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => {
      const avgCtr = data.ctrValues.length > 0
        ? data.ctrValues.reduce((a, b) => a + b, 0) / data.ctrValues.length
        : 0
      const avgPosition = data.positionValues.length > 0
        ? data.positionValues.reduce((a, b) => a + b, 0) / data.positionValues.length
        : 0
      
      return {
        date,
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: Math.round(avgCtr * 10000) / 10000,
        position: Math.round(avgPosition * 100) / 100
      }
    })
  
  // 轉換熱門關鍵字
  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
      // 這裡需要更精確的 position 計算
      position: 0
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)
  
  // 計算平均 CTR 和排名
  if (summary.impressions > 0) {
    summary.ctr = summary.clicks / summary.impressions
  }
  if (timeline.length > 0) {
    summary.position = timeline.reduce((sum, d) => sum + d.position, 0) / timeline.length
  }
  
  return { summary, timeline, topQueries }
}

/**
 * 獲取 GSC 摘要數據
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 摘要數據
 */
export async function getGSCSummary(siteUrl, options = {}) {
  if (!siteUrl) throw new Error('GSC Site URL is required')

  const token = getAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const res = await fetch('/api/gsc-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      siteUrl,
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'GSC fetch failed')
  }

  const response = await res.json()
  const { summary, timeline, topQueries } = parseGSCResponse(response)
  
  return {
    siteUrl,
    period: {
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today'
    },
    clicks: summary.clicks,
    impressions: summary.impressions,
    ctr: Math.round(summary.ctr * 10000) / 10000,
    position: Math.round(summary.position * 100) / 100,
    timeline,
    topQueries,
    fetchedAt: new Date().toISOString()
  }
}

/**
 * 獲取熱門關鍵字數據
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 關鍵字數據
 */
export async function getTopQueries(siteUrl, options = {}) {
  if (!siteUrl) {
    throw new Error('GSC Site URL is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today', limit = 20 } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/gsc/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: limit
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch top queries')
  }
  
  const data = await response.json()
  
  if (!data.rows) {
    return { queries: [] }
  }
  
  const queries = data.rows.map(row => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }))
  
  return { queries }
}

/**
 * 獲取熱門頁面數據
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 頁面數據
 */
export async function getTopPages(siteUrl, options = {}) {
  if (!siteUrl) {
    throw new Error('GSC Site URL is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today', limit = 20 } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/gsc/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: limit
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
    page: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }))
  
  return { pages }
}

/**
 * 獲取裝置維度數據
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 裝置數據
 */
export async function getDeviceData(siteUrl, options = {}) {
  if (!siteUrl) {
    throw new Error('GSC Site URL is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today' } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/gsc/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['device']
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch device data')
  }
  
  const data = await response.json()
  
  if (!data.rows) {
    return { devices: [] }
  }
  
  const devices = data.rows.map(row => ({
    device: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }))
  
  return { devices }
}

/**
 * 獲取國家維度數據
 * @param {string} siteUrl - GSC 驗證的網站網址
 * @param {Object} options - 查詢選項
 * @returns {Promise<Object>} - 國家數據
 */
export async function getCountryData(siteUrl, options = {}) {
  if (!siteUrl) {
    throw new Error('GSC Site URL is required')
  }
  
  const { startDate = '30daysAgo', endDate = 'today', limit = 10 } = options
  
  const response = await fetch(`${N8N_WEBHOOK_URL}/gsc/countries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['country'],
      rowLimit: limit
    })
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch country data')
  }
  
  const data = await response.json()
  
  if (!data.rows) {
    return { countries: [] }
  }
  
  const countries = data.rows.map(row => ({
    country: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position
  }))
  
  return { countries }
}

export default {
  getGSCSummary,
  getTopQueries,
  getTopPages,
  getDeviceData,
  getCountryData
}
