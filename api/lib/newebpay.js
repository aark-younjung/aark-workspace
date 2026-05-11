/**
 * NewebPay 藍新金流 加解密 helper
 *
 * NewebPay MPG 介接流程（一次性付款）：
 *   1. 商家後端把訂單資訊組成 query string（key1=val1&key2=val2）
 *   2. AES-256-CBC + PKCS7 padding 加密 → TradeInfo（hex string）
 *   3. SHA256(HashKey={key}&{TradeInfo}&HashIV={iv}) → TradeSha（uppercase hex）
 *   4. 把 MerchantID / TradeInfo / TradeSha / Version 用 form POST 給 NewebPay gateway
 *   5. 使用者付款後，NewebPay 同樣以 AES 加密 payload POST 回 NotifyURL（server）+ ReturnURL（browser redirect）
 *   6. 商家端用相同 HashKey / HashIV 解密 + 驗 TradeSha
 *
 * 環境變數：
 *   NEWEBPAY_MERCHANT_ID — 商家代號（MS 開頭，沙盒 & 正式各自一組）
 *   NEWEBPAY_HASH_KEY    — 32 字元 AES key（沙盒 & 正式各自一組）
 *   NEWEBPAY_HASH_IV     — 16 字元 AES IV（沙盒 & 正式各自一組）
 *   NEWEBPAY_API_URL     — 沙盒 https://ccore.newebpay.com/MPG/mpg_gateway
 *                          正式 https://core.newebpay.com/MPG/mpg_gateway
 */

import crypto from 'crypto'

// AES-256-CBC encrypt with PKCS7 padding（NewebPay 規範）
// 輸入 utf8 plaintext + 32-char hashKey + 16-char hashIV → 回 lowercase hex string
export function aesEncrypt(plaintext, hashKey, hashIV) {
  const cipher = crypto.createCipheriv('aes-256-cbc', hashKey, hashIV)
  cipher.setAutoPadding(true)  // Node crypto 預設就是 PKCS7 padding（同 PKCS5）
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

// AES-256-CBC decrypt（接收 NewebPay notify payload 用）
// 輸入 hex ciphertext → 回 utf8 plaintext
export function aesDecrypt(ciphertext, hashKey, hashIV) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV)
  decipher.setAutoPadding(true)
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// TradeSha = SHA256(HashKey={hashKey}&{aesEncrypted}&HashIV={hashIV}) → uppercase hex
// 給 client 送出 + notify 驗證用同一個 function
export function sha256Hash(aesEncrypted, hashKey, hashIV) {
  const raw = `HashKey=${hashKey}&${aesEncrypted}&HashIV=${hashIV}`
  return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase()
}

// 把 params object 串成 NewebPay 規格的 query string（k1=v1&k2=v2）
// 注意：NewebPay 規範 value 要 urlencoded（rawurlencode 等價於 encodeURIComponent）
export function buildFormString(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

// 解 NewebPay notify 解密後的 form string → object
export function parseFormString(str) {
  const result = {}
  for (const pair of str.split('&')) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const k = pair.slice(0, eq)
    const v = pair.slice(eq + 1)
    result[k] = decodeURIComponent(v)
  }
  return result
}

// 產生 MerchantOrderNo（NewebPay 規範：英數字 + 底線，1-30 字元，每筆唯一）
// 格式：{prefix}{ms_timestamp}{random4} — e.g. topup1715000000abcd
export function generateOrderNo(prefix = 'order') {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 6)
  const raw = `${prefix}${ts}${rand}`
  return raw.slice(0, 30).replace(/[^a-zA-Z0-9_]/g, '')
}

// 一站式：把 trade params 加密 + 算 hash，回傳給前端 form-submit 用的欄位
// 回傳 { MerchantID, TradeInfo, TradeSha, Version, EncryptType, apiUrl }
export function buildPaymentForm(tradeParams) {
  const {
    NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV,
    NEWEBPAY_API_URL,
  } = process.env
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    throw new Error('NewebPay env vars not configured: NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV')
  }
  const apiUrl = NEWEBPAY_API_URL || 'https://ccore.newebpay.com/MPG/mpg_gateway'  // 預設沙盒
  const formString = buildFormString({ MerchantID: NEWEBPAY_MERCHANT_ID, ...tradeParams })
  const tradeInfo = aesEncrypt(formString, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  const tradeSha = sha256Hash(tradeInfo, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  return {
    MerchantID: NEWEBPAY_MERCHANT_ID,
    TradeInfo: tradeInfo,
    TradeSha: tradeSha,
    Version: '2.0',
    EncryptType: '0',  // 0 = AES-256-CBC（預設）
    apiUrl,
  }
}

// 解 notify payload — 給 /api/newebpay-notify 用
// 回 { ok, data, error }，data 是 NewebPay 回傳的 JSON 物件（已解密）
export function parseNotifyPayload({ TradeInfo, TradeSha }) {
  const { NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV } = process.env
  if (!NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    return { ok: false, error: 'NewebPay env vars not configured' }
  }
  // 1. 驗 TradeSha（防偽造）
  const expectedSha = sha256Hash(TradeInfo, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  if (TradeSha !== expectedSha) {
    return { ok: false, error: 'TradeSha mismatch — payload may be forged' }
  }
  // 2. 解密 TradeInfo（NewebPay 回的是 JSON 字串，不是 form string）
  try {
    const decrypted = aesDecrypt(TradeInfo, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
    const data = JSON.parse(decrypted)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: `Failed to decrypt/parse: ${err.message}` }
  }
}
