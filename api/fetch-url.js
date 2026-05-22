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
    // 三輪 User-Agent fallback — 應對不同 anti-bot 策略：
    //   Round 1: Googlebot — 多數 SEO-friendly 站歡迎，但 Cloudflare 會驗 IP 範圍直接擋
    //   Round 2: Chrome desktop + 完整 Sec-Ch-Ua 等瀏覽器指紋頭 — 模擬真人瀏覽器
    //   Round 3: Bingbot — 部分 Cloudflare 設定白名單 Bingbot 但不白名單 Googlebot
    const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const UA_BINGBOT = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'

    // 通用瀏覽器 headers — 跟 UA 一起送讓 fingerprint 更像真人
    const CHROME_HEADERS = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }

    const buildOptions = (userAgent, useChromeHeaders = false) => ({
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        ...(useChromeHeaders ? CHROME_HEADERS : {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        }),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000), // 20 秒超時
    })

    let response
    let sslFallback = false
    let uaFallback = false       // true 代表用了第二或第三輪 UA
    let antiBotBlocked = false   // true 代表 3 輪都被擋 = 真的鎖很嚴

    // 第一輪：Googlebot UA
    try {
      response = await fetch(targetUrl.toString(), buildOptions(UA_GOOGLEBOT))
    } catch (err) {
      // SSL 憑證鏈不完整 → fallback 用放寬驗證重試（讀公開 HTML 不傳憑證安全可接受）
      if (isSSLError(err)) {
        const code = err?.cause?.code || err?.code
        console.warn(`[fetch-url] SSL cert issue (${code}) with ${hostname}, retrying with relaxed verification`)
        try {
          const { Agent, fetch: undiciFetch } = await import('undici')
          const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } })
          response = await undiciFetch(targetUrl.toString(), {
            ...buildOptions(UA_GOOGLEBOT),
            dispatcher: insecureDispatcher,
          })
          sslFallback = true
        } catch (retryErr) {
          console.error(`[fetch-url] SSL fallback failed for ${hostname}:`, retryErr.message)
          throw err
        }
      } else {
        throw err
      }
    }

    // 第二輪：Chrome UA + 完整 Sec-Ch-Ua 瀏覽器指紋頭（模擬真人）
    if ([403, 503, 429].includes(response.status)) {
      console.warn(`[fetch-url] Anti-bot suspected (HTTP ${response.status}) with ${hostname}, retrying with Chrome UA + browser fingerprint headers`)
      try {
        response = await fetch(targetUrl.toString(), buildOptions(UA_CHROME, true))
        uaFallback = true
      } catch (uaErr) {
        console.error(`[fetch-url] Chrome UA fallback failed for ${hostname}:`, uaErr.message)
      }
    }

    // 第三輪：Bingbot UA（部分 Cloudflare 白名單只放 Bingbot 不放 Googlebot）
    if ([403, 503, 429].includes(response.status)) {
      console.warn(`[fetch-url] Chrome UA still blocked (HTTP ${response.status}) with ${hostname}, last resort: Bingbot UA`)
      try {
        response = await fetch(targetUrl.toString(), buildOptions(UA_BINGBOT))
        uaFallback = true
      } catch (botErr) {
        console.error(`[fetch-url] Bingbot UA fallback failed for ${hostname}:`, botErr.message)
      }
      // 仍 403 → 真的鎖很嚴，標記給前端 surface 提示
      if ([403, 503, 429].includes(response.status)) {
        antiBotBlocked = true
      }
    }

    const fetchTime = Date.now() - startTime

    if (!response.ok) {
      return res.status(response.status).json({
        error: `HTTP ${response.status}`,
        fetchTime,
        sslFallback,
        uaFallback,
        antiBotBlocked,
        hint: antiBotBlocked
            ? '目標網站 anti-bot 鎖極嚴 — 已嘗試 Googlebot / Chrome+瀏覽器指紋頭 / Bingbot 三種 UA 全被擋。這意味著 ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎爬蟲很可能也抓不到此站，AI 引用率會嚴重受影響。請聯絡網站管理員調整 Cloudflare / WAF 設定。'
            : response.status === 403 ? '目標網站擋下我們的爬蟲（可能是 Cloudflare 等 anti-bot 設定嚴格）'
            : response.status === 503 ? '目標網站暫時不可用（過載 / 維護中）'
            : null,
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
      sslFallback,      // true 代表 SSL 憑證鏈有問題（用 relaxed verify 才抓到）
      uaFallback,       // true 代表 Googlebot UA 被擋，換 Chrome 或 Bingbot UA 才成功
      antiBotBlocked,   // true 代表 3 輪 UA 全擋（產品可包裝成「你站對 AI 不友善」的 finding）
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
