/**
 * NewebPay 訂單測試標記偵測（is_test_order）
 *
 * 兩個條件 OR：
 * 1. 沙盒環境（NEWEBPAY_API_URL 含 ccore.newebpay.com）— 沙盒所有訂單一律標測試
 * 2. 下單者 email 在 TEST_EMAILS 名單內 — 正式環境下 admin/QA 用真卡買測試單也標
 *
 * 使用方式：在 INSERT 訂單時 `is_test_order: isTestOrder(email)`
 *
 * Env:
 *   NEWEBPAY_API_URL    沙盒為 https://ccore.newebpay.com/MPG/mpg_gateway / 正式為 https://core.newebpay.com/MPG/mpg_gateway
 *   TEST_EMAILS         逗號分隔的測試 email 名單，例：'aark6465@gmail.com,qa@example.com'
 */

/**
 * 純 email 白名單判斷（不含沙盒條件）。
 * 用於「測試帳號」相關判斷 — 例如 aivis 曝光監測額度無上限。
 * Env: TEST_EMAILS="email1,email2,..."（逗號分隔）
 * @param {string|null|undefined} email
 * @returns {boolean} true 表示此 email 在測試名單內
 */
export function isTestEmail(email) {
  if (!email) return false
  const testEmails = (process.env.TEST_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return testEmails.includes(email.toLowerCase())
}

/**
 * @param {string|null|undefined} email - 下單用戶 email（可選）
 * @returns {boolean} true 表示應該標記為測試訂單
 */
export function isTestOrder(email) {
  // 條件 1：沙盒環境（NEWEBPAY_API_URL 含 ccore.newebpay.com）
  const apiUrl = process.env.NEWEBPAY_API_URL || ''
  if (apiUrl.includes('ccore.newebpay.com')) return true

  // 條件 2：測試 email 名單（env: TEST_EMAILS）
  return isTestEmail(email)
}
