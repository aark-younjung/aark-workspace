/**
 * Google OAuth 2.0 Implicit Flow 工具函式
 * 用於取得 GA4 / GSC 存取權限
 *
 * 流程：
 *  1. initiateGoogleAuth() 開啟授權彈窗
 *  2. 彈窗重導向到 /auth/google/callback
 *  3. GoogleAuthCallback.jsx 解析 token 並呼叫 storeToken()
 *  4. postMessage 通知主視窗授權完成
 */

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
].join(' ')

const TOKEN_KEYS = {
  accessToken: 'google_access_token',
  expiresAt: 'google_token_expires_at',
}

/**
 * 開啟 Google OAuth 授權彈窗
 */
export function initiateGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    alert('尚未設定 VITE_GOOGLE_CLIENT_ID，請聯絡管理員')
    return
  }

  const redirectUri = `${window.location.origin}/auth/google/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SCOPES,
    include_granted_scopes: 'true',
  })

  const width = 500
  const height = 640
  const left = Math.round((window.screen.width - width) / 2)
  const top = Math.round((window.screen.height - height) / 2)

  window.open(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    'google_auth',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes`
  )
}

/**
 * 儲存 access token（由 callback 頁面呼叫）
 * @param {string} token
 * @param {number} expiresIn - 秒數
 */
export function storeToken(token, expiresIn) {
  localStorage.setItem(TOKEN_KEYS.accessToken, token)
  localStorage.setItem(TOKEN_KEYS.expiresAt, String(Date.now() + expiresIn * 1000))
}

/**
 * 取得有效的 access token（過期則回傳 null）
 */
export function getAccessToken() {
  const token = localStorage.getItem(TOKEN_KEYS.accessToken)
  const expiresAt = localStorage.getItem(TOKEN_KEYS.expiresAt)
  if (!token || !expiresAt) return null
  if (Date.now() > parseInt(expiresAt)) {
    localStorage.removeItem(TOKEN_KEYS.accessToken)
    localStorage.removeItem(TOKEN_KEYS.expiresAt)
    return null
  }
  return token
}

/**
 * 清除 token（中斷 Google 連接）
 */
export function clearGoogleToken() {
  localStorage.removeItem(TOKEN_KEYS.accessToken)
  localStorage.removeItem(TOKEN_KEYS.expiresAt)
}

/**
 * 是否已授權且 token 有效
 */
export function isAuthenticated() {
  return !!getAccessToken()
}

// GA4 Property ID 存取（per website）
export function setPropertyId(websiteId, propId) {
  localStorage.setItem(`ga4_property_id_${websiteId}`, propId)
}
export function getPropertyId(websiteId) {
  return localStorage.getItem(`ga4_property_id_${websiteId}`)
}

// GSC Site URL 存取（per website）
export function setSiteUrl(websiteId, url) {
  localStorage.setItem(`gsc_site_url_${websiteId}`, url)
}
export function getSiteUrl(websiteId) {
  return localStorage.getItem(`gsc_site_url_${websiteId}`)
}

export function getAuthStatus(websiteId) {
  return {
    isAuthenticated: isAuthenticated(),
    propertyId: getPropertyId(websiteId),
    siteUrl: getSiteUrl(websiteId),
  }
}
