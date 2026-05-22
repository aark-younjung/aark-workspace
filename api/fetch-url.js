/**
 * Serverless Function - 網站內容抓取
 * 直接從 Vercel 後端 fetch，不依賴第三方 CORS proxy
 *
 * SSL 容錯（2026-05-22 加）：台灣很多小網站 SSL 憑證鏈不完整（少送中間憑證），
 * 瀏覽器有寬容機制能自動補，但 Node.js 嚴格驗證直接拒連線。
 * 我們的工具讀網站「公開 HTML」做分析，不傳憑證/不收 cookie，
 * SSL 失敗時 fallback 用放寬驗證重試是合理且安全的。
 */

// Vercel function timeout（Hobby 預設 10s 太短；Akamai 等 anti-bot 會「拖時間」造成 Chrome round
// 卡 20s，多輪累加就超過。設 60s 讓 4 輪都能在預算內跑完並回 antiBotBlocked 旗標）
export const maxDuration = 60

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

    // 每輪 timeout 縮短：Akamai 等 anti-bot 會拖時間，要果斷砍才不會 4 輪累加爆 maxDuration
    // - UA 三輪各 6s（壞掉的會快速回 403，正常的網站 1-3s 就回）
    // - AllOrigins proxy 給 15s（要過第三方 hop，正常需時較久）
    const buildOptions = (userAgent, useChromeHeaders = false, timeoutMs = 6000) => ({
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
      signal: AbortSignal.timeout(timeoutMs),
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
      console.warn(`[fetch-url] Chrome UA still blocked (HTTP ${response.status}) with ${hostname}, fallback round 3: Bingbot UA`)
      try {
        response = await fetch(targetUrl.toString(), buildOptions(UA_BINGBOT))
        uaFallback = true
      } catch (botErr) {
        console.error(`[fetch-url] Bingbot UA fallback failed for ${hostname}:`, botErr.message)
      }
    }

    // 第四輪：AllOrigins 免費 CORS proxy（不同 IP 出口繞過 Cloudflare）
    // 對 Vercel 而言 AllOrigins 是不同 IP 段，Cloudflare 規則可能放它過、不放我們過
    // 注意：AllOrigins 回的 JSON 格式不同（contents 欄位包 HTML），要 unwrap
    let proxyFallback = false
    if ([403, 503, 429].includes(response.status)) {
      console.warn(`[fetch-url] All 3 UA rounds blocked, last resort: AllOrigins proxy for ${hostname}`)
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl.toString())}`
        const proxyResp = await fetch(proxyUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(30000),   // proxy 多一層 hop，給 30 秒
        })
        if (proxyResp.ok) {
          const proxyData = await proxyResp.json()
          // AllOrigins 回應結構：{ contents: "<html>...", status: { http_code: 200, ... } }
          if (proxyData?.contents && (proxyData?.status?.http_code === 200 || !proxyData?.status?.http_code)) {
            // 偽造一個成功的 response 物件給後續流程用
            response = {
              ok: true,
              status: 200,
              text: async () => proxyData.contents,
            }
            proxyFallback = true
            uaFallback = true   // 視為 UA fallback 成功
            console.log(`[fetch-url] AllOrigins proxy succeeded for ${hostname}`)
          }
        }
      } catch (proxyErr) {
        console.error(`[fetch-url] AllOrigins proxy fallback failed for ${hostname}:`, proxyErr.message)
      }
      // 4 輪全失敗 → 真的鎖很嚴
      if (!response.ok) {
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
        proxyFallback,
        antiBotBlocked,
        hint: antiBotBlocked
            ? '目標網站 anti-bot 鎖極嚴 — 已嘗試 Googlebot / Chrome+瀏覽器指紋頭 / Bingbot / AllOrigins proxy 四種途徑全被擋。這意味著 ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎爬蟲很可能也抓不到此站，AI 引用率會嚴重受影響。請聯絡網站管理員調整 Cloudflare / WAF 設定。'
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
      uaFallback,       // true 代表 Googlebot UA 被擋，後續輪才成功
      proxyFallback,    // true 代表 3 輪 UA 全擋、靠 AllOrigins proxy 才抓到（站對 AI 鎖很嚴的訊號）
      antiBotBlocked,   // true 代表 4 輪全擋（最嚴重的「對 AI 隱形」狀態）
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
