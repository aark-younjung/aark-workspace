/**
 * Serverless Function - 網站內容抓取
 * 直接從 Vercel 後端 fetch，不依賴第三方 CORS proxy
 *
 * SSL 容錯（2026-05-22 加）：台灣很多小網站 SSL 憑證鏈不完整（少送中間憑證），
 * 瀏覽器有寬容機制能自動補，但 Node.js 嚴格驗證直接拒連線。
 * 我們的工具讀網站「公開 HTML」做分析，不傳憑證/不收 cookie，
 * SSL 失敗時 fallback 用放寬驗證重試是合理且安全的。
 */

const SSL_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',        // 最常見：憑證鏈不完整
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',      // 找不到 issuer cert
  'CERT_HAS_EXPIRED',                       // 憑證過期
  'DEPTH_ZERO_SELF_SIGNED_CERT',            // 自簽憑證
  'SELF_SIGNED_CERT_IN_CHAIN',              // 鏈中有自簽憑證
  'CERT_UNTRUSTED',                         // 不受信任的 CA
])

function isSSLError(err) {
  const code = err?.cause?.code || err?.code
  return SSL_ERROR_CODES.has(code)
}

export default async function handler(req, res) {
  // 允許所有來源
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 處理預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: '缺少 URL 參數' })
    }

    // 驗證 URL
    let targetUrl
    try {
      targetUrl = new URL(url)
    } catch {
      return res.status(400).json({ error: '無效的 URL' })
    }

    // 允許 http 和 https，但禁止 localhost / private IP
    const hostname = targetUrl.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.')
    ) {
      return res.status(400).json({ error: '不允許存取本地或私有網路' })
    }

    const startTime = Date.now()
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000), // 20 秒超時
    }

    let response
    let sslFallback = false

    try {
      // 第一次嘗試：標準嚴格 SSL 驗證
      response = await fetch(targetUrl.toString(), fetchOptions)
    } catch (err) {
      // SSL 憑證鏈不完整 → fallback 用放寬驗證重試（讀公開 HTML 不傳憑證安全可接受）
      if (isSSLError(err)) {
        const code = err?.cause?.code || err?.code
        console.warn(`[fetch-url] SSL cert issue (${code}) with ${hostname}, retrying with relaxed verification`)
        try {
          const { Agent, fetch: undiciFetch } = await import('undici')
          const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } })
          response = await undiciFetch(targetUrl.toString(), {
            ...fetchOptions,
            dispatcher: insecureDispatcher,
          })
          sslFallback = true
        } catch (retryErr) {
          // undici 不可用或重試仍失敗 → 把原始 SSL 錯誤拋回去
          console.error(`[fetch-url] SSL fallback failed for ${hostname}:`, retryErr.message)
          throw err
        }
      } else {
        throw err
      }
    }

    const fetchTime = Date.now() - startTime

    if (!response.ok) {
      return res.status(response.status).json({
        error: `HTTP ${response.status}`,
        fetchTime,
      })
    }

    const html = await response.text()

    // 返回內容
    return res.status(200).json({
      success: true,
      url: targetUrl.toString(),
      content: html,
      status: response.status,
      fetchTime,
      sslFallback, // true 代表這個網站憑證鏈有問題，前端可選擇 surface 警告（目前不做）
    })

  } catch (error) {
    console.error('Fetch error:', error)

    // 區分 timeout / SSL / 其他錯誤
    const isTimeout = error.name === 'TimeoutError' || error.message?.includes('timeout')
    const ssl = isSSLError(error)
    return res.status(500).json({
      error: isTimeout ? '請求超時，目標網站回應太慢'
        : ssl ? `目標網站 SSL 憑證設定錯誤（${error?.cause?.code || error?.code}）`
        : '抓取失敗',
      message: error.message,
    })
  }
}
