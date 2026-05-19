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
//
// NewebPay notify TradeInfo padding 規範實測（2026-05-18 debug-decrypt-variants V0 utf8Tail 確認）：
// **PKCS7-style 但 N 可以 > block_size（16）**。例：487-byte JSON plaintext 補 25 個 0x19 = 512 bytes。
// 標準 PKCS7 規範 N ≤ block_size，所以 Node `setAutoPadding(true)` 看到 0x19=25 > 16 認定非法 →
// 丟 bad_decrypt。改為 noPadding + 自己 strip — 不限制 N 上限，只要末尾 N bytes 都等於 N 就剝。
// JSON 結尾固定是 `}` (0x7D=125)，要碰巧 plaintext 末尾真有 125 個連續 `}` 才會誤剝，實務上不可能。
export function aesDecrypt(ciphertext, hashKey, hashIV) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', hashKey, hashIV)
  decipher.setAutoPadding(false)
  const buf = Buffer.concat([decipher.update(ciphertext, 'hex'), decipher.final()])
  // 1. NewebPay 風格 padding：末尾 N bytes 都等於 N（N 可大於 16，兼容標準 PKCS7 + NewebPay 變體）
  const lastByte = buf[buf.length - 1]
  if (lastByte >= 1 && lastByte <= buf.length) {
    let isPad = true
    for (let i = buf.length - lastByte; i < buf.length; i++) {
      if (buf[i] !== lastByte) { isPad = false; break }
    }
    if (isPad) return buf.slice(0, buf.length - lastByte).toString('utf8')
  }
  // 2. 否則剝末尾連續 0x00 — zero padding 或無 padding 都安全（JSON 結尾不會是 0x00）
  let end = buf.length
  while (end > 0 && buf[end - 1] === 0) end--
  return buf.slice(0, end).toString('utf8')
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

// NewebPay 信用卡退款 API endpoint（沙盒 / 正式 base URL 與 MPG 不同，用 NEWEBPAY_REFUND_API_URL 覆寫）
// 預設沙盒 https://ccore.newebpay.com/API/CreditCard/Close
// 正式   https://core.newebpay.com/API/CreditCard/Close
// CloseType=2 表示退款（=1 為請款，非本案使用情境）
//
// 退款流程：
// 1. 組 PostData_ 內容（form string）— Amt + MerchantOrderNo + TimeStamp + IndexType=1 + CloseType=2
// 2. AES 加密成 hex → 命名為 PostData_（注意末尾底線是 NewebPay 規範，不是 typo）
// 3. POST form-urlencoded 給 NewebPay：MerchantID_ + PostData_
// 4. NewebPay 回 JSON：{ Status: 'SUCCESS' | 'XXX', Message: '...', Result: { ... } }
//
// 一站式 helper：傳入 { merchantOrderNo, amount } → 回 NewebPay 解析後的 { ok, status, message, raw }
export async function requestCreditCardRefund({ merchantOrderNo, amount }) {
  const {
    NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV,
    NEWEBPAY_REFUND_API_URL,
  } = process.env
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    throw new Error('NewebPay env vars not configured: NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV')
  }
  const apiUrl = NEWEBPAY_REFUND_API_URL || 'https://ccore.newebpay.com/API/CreditCard/Close'
  // NewebPay 退款 PostData 規範參數
  const refundParams = {
    RespondType: 'JSON',
    Version: '1.0',
    Amt: amount,
    MerchantOrderNo: merchantOrderNo,
    TimeStamp: Math.floor(Date.now() / 1000),
    IndexType: 1,           // 1 = 用商家訂單編號（MerchantOrderNo）查；2 = NewebPay TradeNo
    CloseType: 2,           // 2 = 退款（1 = 請款，不適用）
  }
  const formString = buildFormString(refundParams)
  const encrypted = aesEncrypt(formString, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  // POST body 規範（注意 key 都帶底線）
  const body = new URLSearchParams({
    MerchantID_: NEWEBPAY_MERCHANT_ID,
    PostData_: encrypted,
  })
  let response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    return { ok: false, status: 'NETWORK_ERROR', message: err.message, raw: null }
  }
  // NewebPay 退款 API 即使業務失敗（如訂單不存在）也會回 HTTP 200，狀態看 body.Status
  let parsed
  try {
    parsed = await response.json()
  } catch {
    const text = await response.text().catch(() => '')
    return { ok: false, status: 'INVALID_RESPONSE', message: `Non-JSON response: ${text.slice(0, 200)}`, raw: text }
  }
  // 成功狀態：Status === 'SUCCESS'
  const ok = parsed?.Status === 'SUCCESS'
  return {
    ok,
    status: parsed?.Status || 'UNKNOWN',
    message: parsed?.Message || '',
    raw: parsed,
  }
}

// NewebPay 取消授權 API endpoint（信用卡剛授權成功、尚未請款時用）
// 沙盒 https://ccore.newebpay.com/API/CreditCard/Cancel
// 正式 https://core.newebpay.com/API/CreditCard/Cancel
//
// 為什麼需要這支：
//   信用卡兩階段金流 — 授權 (Authorize) → NewebPay D+1 自動請款 (Capture)。
//   Close API (CloseType=2) 退款只接受「已請款」狀態，剛付款的交易仍在「已授權未請款」會回
//   TRA10035「該交易非授權成功或已請款完成狀態」。此時必須改打 Cancel API 取消授權，
//   讓銀行端釋放預留額度（用戶看不到「退款」交易，因為錢從未真正扣下）。
//
// 用法與 requestCreditCardRefund 一致 — 傳入 { merchantOrderNo, amount } → 回 { ok, status, message, raw }
export async function cancelCreditCardAuthorization({ merchantOrderNo, amount }) {
  const {
    NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV,
    NEWEBPAY_CANCEL_API_URL,
  } = process.env
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    throw new Error('NewebPay env vars not configured: NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV')
  }
  const apiUrl = NEWEBPAY_CANCEL_API_URL || 'https://ccore.newebpay.com/API/CreditCard/Cancel'
  // CancelTrans PostData 規範參數（與 Close 類似但無 CloseType）
  const cancelParams = {
    RespondType: 'JSON',
    Version: '1.0',
    Amt: amount,
    MerchantOrderNo: merchantOrderNo,
    TimeStamp: Math.floor(Date.now() / 1000),
    IndexType: 1,           // 1 = 用商家訂單編號
  }
  const formString = buildFormString(cancelParams)
  const encrypted = aesEncrypt(formString, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  const body = new URLSearchParams({
    MerchantID_: NEWEBPAY_MERCHANT_ID,
    PostData_: encrypted,
  })
  let response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    return { ok: false, status: 'NETWORK_ERROR', message: err.message, raw: null }
  }
  let parsed
  try {
    parsed = await response.json()
  } catch {
    const text = await response.text().catch(() => '')
    return { ok: false, status: 'INVALID_RESPONSE', message: `Non-JSON response: ${text.slice(0, 200)}`, raw: text }
  }
  const ok = parsed?.Status === 'SUCCESS'
  return {
    ok,
    status: parsed?.Status || 'UNKNOWN',
    message: parsed?.Message || '',
    raw: parsed,
  }
}

// ─────────────────── NPA 信用卡定期定額 (Period) ───────────────────
// NPA endpoint：
//   建立委託：POST /MPG/period      （form-urlencoded，body 只有 MerchantID_ + PostData_）
//   取消委託：POST /MPG/period/AlterStatus
//   通知：    NewebPay 每期扣款後 server-to-server POST 設定的 NotifyURL
//             共用 newebpay-notify endpoint，靠 Result.PeriodNo 是否存在分辨 MPG vs NPA
//
// NPA 與 MPG 主要差異：
//   - 欄位命名：NPA 用 MerOrderNo（MPG 用 MerchantOrderNo）/ ProdDesc（MPG 用 ItemDesc）
//   - Form 欄位：NPA 只送 MerchantID_ + PostData_（MPG 還有 TradeInfo + TradeSha + Version + EncryptType）
//   - Version: NPA = '1.5'（MPG = '2.0'）
//   - PostData_ 加密內容含所有 period 參數（不像 MPG TradeInfo 額外用 TradeSha 校驗）
//
// 一站式：建立 NPA 委託 form fields
// 回傳 { MerchantID_, PostData_, apiUrl } — 前端組 form POST 跳 NewebPay 付款頁
export function buildPeriodForm(periodParams) {
  const {
    NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV,
    NEWEBPAY_PERIOD_API_URL,
  } = process.env
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    throw new Error('NewebPay env vars not configured: NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV')
  }
  const apiUrl = NEWEBPAY_PERIOD_API_URL || 'https://ccore.newebpay.com/MPG/period'  // 預設沙盒
  // NPA postData 不含 MerchantID（MerchantID 走 MerchantID_ 明文欄位，加密內容不重複）
  const formString = buildFormString(periodParams)
  const postData = aesEncrypt(formString, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  return {
    MerchantID_: NEWEBPAY_MERCHANT_ID,
    PostData_: postData,
    apiUrl,
  }
}

// NPA AlterStatus — 取消委託（AlterType=terminate，不可恢復）
// 用法：傳入 { merOrderNo, periodNo } → 回 { ok, status, message, raw }
// merOrderNo 是建立委託時送的訂單編號，periodNo 是 NewebPay 首期 notify 回的委託書編號
export async function requestPeriodTerminate({ merOrderNo, periodNo }) {
  const {
    NEWEBPAY_MERCHANT_ID, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV,
    NEWEBPAY_PERIOD_ALTER_API_URL,
  } = process.env
  if (!NEWEBPAY_MERCHANT_ID || !NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    throw new Error('NewebPay env vars not configured: NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV')
  }
  const apiUrl = NEWEBPAY_PERIOD_ALTER_API_URL || 'https://ccore.newebpay.com/MPG/period/AlterStatus'
  // AlterStatus PostData 規範參數
  const alterParams = {
    RespondType: 'JSON',
    Version: '1.0',
    MerOrderNo: merOrderNo,
    PeriodNo: periodNo,
    AlterType: 'terminate',   // terminate=結束（不可復活）/ suspend=暫停（可 restart）— 取消都用 terminate
    TimeStamp: Math.floor(Date.now() / 1000),
  }
  const formString = buildFormString(alterParams)
  const encrypted = aesEncrypt(formString, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
  const body = new URLSearchParams({
    MerchantID_: NEWEBPAY_MERCHANT_ID,
    PostData_: encrypted,
  })
  let response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
  } catch (err) {
    return { ok: false, status: 'NETWORK_ERROR', message: err.message, raw: null }
  }
  // 先抓原始 text — NewebPay AlterStatus 偶有回非 JSON / 不同 envelope（沙盒實測 cancel_note=UNKNOWN: 線索）
  // 兩階段 parse：先 text、再嘗試 JSON，失敗時把 raw text 帶回診斷
  const rawText = await response.text().catch(() => '')
  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error('NPA AlterStatus non-JSON response:', rawText.slice(0, 500))
    return { ok: false, status: 'INVALID_RESPONSE', message: `Non-JSON response: ${rawText.slice(0, 200)}`, raw: rawText }
  }
  // 沙盒實測 NewebPay AlterStatus 回的 envelope 不一定有外層 Status — 也可能整包包在 Result 內或欄位用小寫
  // 失敗時把整個 parsed JSON dump 進 message 方便 SQL cancel_note 看到全貌
  const ok = parsed?.Status === 'SUCCESS' || parsed?.status === 'SUCCESS'
  const statusVal = parsed?.Status || parsed?.status || 'UNKNOWN'
  const messageVal = parsed?.Message || parsed?.message ||
    (ok ? '' : `raw: ${JSON.stringify(parsed).slice(0, 300)}`)
  if (!ok) {
    console.error('NPA AlterStatus failure response:', JSON.stringify(parsed))
  }
  return {
    ok,
    status: statusVal,
    message: messageVal,
    raw: parsed,
  }
}

// 解 NPA notify payload — 給 /api/newebpay-notify 用（信用卡定期定額專用）
// NPA notify 格式：multipart/form-data，body 只有 Status + Message + Period（沒有 TradeInfo/TradeSha）
// Period = AES 加密的 JSON 字串，**沒有 hash 校驗欄位**（NewebPay NPA 規範如此，僅靠 TLS + IP 白名單防偽）
// 回 { ok, data, error }，data 是 NewebPay 回傳的 JSON 物件（已解密）
export function parsePeriodNotifyPayload({ Period }) {
  const { NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV } = process.env
  if (!NEWEBPAY_HASH_KEY || !NEWEBPAY_HASH_IV) {
    return { ok: false, error: 'NewebPay env vars not configured' }
  }
  if (!Period) {
    return { ok: false, error: 'Period field is empty' }
  }
  try {
    const decrypted = aesDecrypt(Period, NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV)
    const data = JSON.parse(decrypted)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: `Failed to decrypt/parse Period: ${err.message}` }
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
