/**
 * Google OAuth 2.0 認證服務
 * 處理 Google 帳戶登入和權杖管理
 * 
 * 注意：由於瀏覽器 CORS 限制，直接調用 Google API 需要後端代理
 * 支援兩種模式：
 * 1. n8n 代理模式（推薦）
 * 2. 直接 API 模式（需要後端伺服器）
 */

// n8n Webhook URL（需要在 n8n 中建立對應的 workflow）
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook'

// Google OAuth 2.0 配置
const GOOGLE_CONFIG = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
  redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin + '/auth/callback',
  scopes: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly'
  ]
}

// Token 儲存鍵名
const TOKEN_KEYS = {
  accessToken: 'google_access_token',
  refreshToken: 'google_refresh_token',
  expiresAt: 'google_token_expires_at',
  propertyId: 'ga4_property_id',
  siteUrl: 'gsc_site_url'
}

/**
 * 初始化 Google OAuth 流程
 * @returns {string} - 授權 URL
 */
export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CONFIG.clientId,
    redirect_uri: GOOGLE_CONFIG.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CONFIG.scopes.join(' '),
    access_type: 'offline',  // 允許取得 refresh token
    prompt: 'consent'        // 強制顯示授權畫面
  })
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * 處理 OAuth 回調
 * @param {string} code - 授權碼
 * @returns {Promise<Object>} - Token 資訊
 */
export async function handleAuthCallback(code) {
  try {
    // 實際應該發送到後端伺服器處理 token 交換
    // 這裡模擬響應
    const response = await fetch(`${N8N_WEBHOOK_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: GOOGLE_CONFIG.redirectUri })
    })
    
    if (!response.ok) {
      throw new Error('Token exchange failed')
    }
    
    const tokens = await response.json()
    saveTokens(tokens)
    
    return tokens
  } catch (error) {
    console.error('Auth callback error:', error)
    throw error
  }
}

/**
 * 儲存認證 Token
 * @param {Object} tokens - Token 物件
 */
export function saveTokens(tokens) {
  if (tokens.access_token) {
    localStorage.setItem(TOKEN_KEYS.accessToken, tokens.access_token)
  }
  if (tokens.refresh_token) {
    localStorage.setItem(TOKEN_KEYS.refreshToken, tokens.refresh_token)
  }
  if (tokens.expires_in) {
    const expiresAt = Date.now() + (tokens.expires_in * 1000)
    localStorage.setItem(TOKEN_KEYS.expiresAt, expiresAt.toString())
  }
}

/**
 * 獲取儲存的 Access Token
 * @returns {string|null}
 */
export function getAccessToken() {
  const token = localStorage.getItem(TOKEN_KEYS.accessToken)
  const expiresAt = localStorage.getItem(TOKEN_KEYS.expiresAt)
  
  // 檢查 token 是否過期
  if (token && expiresAt && Date.now() > parseInt(expiresAt)) {
    // Token 過期，嘗試刷新
    refreshToken()
    return null
  }
  
  return token
}

/**
 * 刷新 Access Token
 * @returns {Promise<Object>}
 */
export async function refreshToken() {
  const refreshToken_ = localStorage.getItem(TOKEN_KEYS.refreshToken)
  
  if (!refreshToken_) {
    throw new Error('No refresh token available')
  }
  
  try {
    const response = await fetch(`${N8N_WEBHOOK_URL}/auth/google/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken_ })
    })
    
    if (!response.ok) {
      throw new Error('Token refresh failed')
    }
    
    const tokens = await response.json()
    saveTokens(tokens)
    
    return tokens
  } catch (error) {
    console.error('Token refresh error:', error)
    // 清除無效的 token
    logout()
    throw error
  }
}

/**
 * 清除所有認證資料
 */
export function logout() {
  Object.values(TOKEN_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}

/**
 * 檢查是否已登入
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getAccessToken()
}

/**
 * 設定 GA4 Property ID
 * @param {string} propertyId - GA4 屬性 ID
 */
export function setPropertyId(propertyId) {
  localStorage.setItem(TOKEN_KEYS.propertyId, propertyId)
}

/**
 * 獲取 GA4 Property ID
 * @returns {string|null}
 */
export function getPropertyId() {
  return localStorage.getItem(TOKEN_KEYS.propertyId)
}

/**
 * 設定 GSC 網站網址
 * @param {string} siteUrl - GSC 驗證的網站網址
 */
export function setSiteUrl(siteUrl) {
  localStorage.setItem(TOKEN_KEYS.siteUrl, siteUrl)
}

/**
 * 獲取 GSC 網站網址
 * @returns {string|null}
 */
export function getSiteUrl() {
  return localStorage.getItem(TOKEN_KEYS.siteUrl)
}

/**
 * 獲取認證狀態
 * @returns {Object}
 */
export function getAuthStatus() {
  return {
    isAuthenticated: isAuthenticated(),
    hasPropertyId: !!getPropertyId(),
    hasSiteUrl: !!getSiteUrl(),
    propertyId: getPropertyId(),
    siteUrl: getSiteUrl()
  }
}

export default {
  getAuthUrl,
  handleAuthCallback,
  saveTokens,
  getAccessToken,
  refreshToken,
  logout,
  isAuthenticated,
  setPropertyId,
  getPropertyId,
  setSiteUrl,
  getSiteUrl,
  getAuthStatus
}
