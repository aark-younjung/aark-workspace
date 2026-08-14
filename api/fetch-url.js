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
  'ERR_TLS_CERT_ALTNAME_INVALID',           // 憑證 hostname 不符（如 scalebar.co、taishinbank.com.tw）
  'ERR_TLS_CERT_ALTNAME_FORMAT',            // altname 格式異常
  'HOSTNAME_MISMATCH',                      // 老版 Node hostname mismatch code
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

    // 每輪 timeout：8s（Vercel 在美國、客戶網站可能在 Asia/EU、TLS handshake + slow CDN 容易突破 6s）
    // 4 輪 worst case：8 + 8 + 8 + 30 = 54s，maxDuration 60s 留 6s 緩衝
    // - UA 三輪各 8s（正常網站 1-3s 就回，慢的給到 8s）
    // - AllOrigins proxy 給 30s（要過第三方 hop，正常需時較久）
    const buildOptions = (userAgent, useChromeHeaders = false, timeoutMs = 8000) => ({
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

    // helper：判斷該不該嘗試下一輪 — null response（前輪 timeout/throw）或 anti-bot status 都該繼續
    const shouldFallback = (r) => !r || [403, 503, 429].includes(r.status)

    // 第一輪：Googlebot UA — 即使 timeout / network error 也只設 response=null，不 throw（讓後續輪有機會）
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
          response = null   // SSL fallback 也失敗 → 讓後續輪有機會（雖然 SSL 是該 host 通病，但說不定 cdn IP 改了）
        }
      } else {
        // timeout / network error：不 throw，讓後續輪嘗試（Round 1 timeout 的網站 Round 2 可能成功）
        console.warn(`[fetch-url] Round 1 (Googlebot) failed for ${hostname}: ${err.message}`)
        response = null
      }
    }

    // 第二輪：Chrome UA + 完整 Sec-Ch-Ua 瀏覽器指紋頭（模擬真人）
    if (shouldFallback(response)) {
      const reason = response ? `HTTP ${response.status}` : 'Round 1 failed'
      console.warn(`[fetch-url] ${reason} with ${hostname}, retrying with Chrome UA + browser fingerprint headers`)
      try {
        const r2 = await fetch(targetUrl.toString(), buildOptions(UA_CHROME, true))
        response = r2
        uaFallback = true
      } catch (uaErr) {
        console.error(`[fetch-url] Chrome UA fallback failed for ${hostname}:`, uaErr.message)
        // 不更新 response — 維持 Round 1 結果（或 null）
      }
    }

    // 第三輪：Bingbot UA（部分 Cloudflare 白名單只放 Bingbot 不放 Googlebot）
    if (shouldFallback(response)) {
      const reason = response ? `Round 2 returned HTTP ${response.status}` : 'Round 2 also failed'
      console.warn(`[fetch-url] ${reason} with ${hostname}, fallback round 3: Bingbot UA`)
      try {
        const r3 = await fetch(targetUrl.toString(), buildOptions(UA_BINGBOT))
        response = r3
        uaFallback = true
      } catch (botErr) {
        console.error(`[fetch-url] Bingbot UA fallback failed for ${hostname}:`, botErr.message)
      }
    }

    // 第四輪：AllOrigins 免費 CORS proxy（不同 IP 出口繞過 Cloudflare）
    // 對 Vercel 而言 AllOrigins 是不同 IP 段，Cloudflare 規則可能放它過、不放我們過
    // 注意：AllOrigins 回的 JSON 格式不同（contents 欄位包 HTML），要 unwrap
    let proxyFallback = false
    if (shouldFallback(response)) {
      const reason = response ? `Round 3 returned HTTP ${response.status}` : '3 UA rounds all failed'
      console.warn(`[fetch-url] ${reason}, last resort: AllOrigins proxy for ${hostname}`)
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
      // 4 輪跑完仍失敗才判定 anti-bot：
      //   response 有回但 !ok（走到這只會是 403/503/429）＝ 伺服器真的擋掉我們 → antiBotBlocked
      //   response=null（4 輪連一個 HTTP 回應都沒拿到）＝ 逾時/連不上，「不是被擋」→ 不設 antiBotBlocked
      //   （2026-07-17 修：舊版把「連不上」也算 blocked，害可正常連的站被誤報 CRITICAL「對 AI 完全隱形」）
      if (response && !response.ok) {
        antiBotBlocked = true
      }
    }

    const fetchTime = Date.now() - startTime

    // response=null（4 輪連一個 HTTP 回應都沒拿到）＝ 逾時/連不上，不是被「擋」。
    // 我們的抓取器在美國機房，對「回應慢」或「擋機房 IP」的台灣小站可能連不上；
    // 但真正的 AI 引擎（ChatGPTBot 等）走自己的 IP —— 我們連不上 ≠ AI 連不上。
    // 所以這裡不謊報「對 AI 完全隱形」，回逾時、請重試（2026-07-17 修 false CRITICAL 警報）。
    if (!response) {
      return res.status(504).json({
        error: 'All fetch rounds timed out',
        fetchTime,
        sslFallback,
        uaFallback,
        proxyFallback,
        antiBotBlocked: false,   // 逾時 ≠ 封鎖，別誤報「對 AI 隱形」
        timedOut: true,
        hint: '4 輪嘗試都沒能連上目標網站。可能原因：①回應太慢或暫時性網路問題（稍後重試）②短時間內多次掃描後被對方主機的防禦機制自動封鎖——通常幾小時到幾天會自動解除，隔天再掃即可 ③主機防火牆長期擋「海外流量」——檢測伺服器與 GPTBot／ClaudeBot 等 AI 爬蟲都從海外連線，若網站從台灣開得很快、這裡卻長期逾時，AI 爬蟲可能也讀不到你的網站，建議向主機商確認。',
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `HTTP ${response.status}`,
        fetchTime,
        sslFallback,
        uaFallback,
        proxyFallback,
        antiBotBlocked,
        hint: antiBotBlocked
            ? '目標網站 anti-bot 鎖極嚴 — 已嘗試 Googlebot / Chrome+瀏覽器指紋頭 / Bingbot / AllOrigins proxy 四種途徑全被擋。這意味著 ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎爬蟲很可能也抓不到此站，AI 引用率會嚴重受影響。請聯絡網站管理員調整 anti-bot／WAF 設定（若用 Cloudflare 尤其檢查 Bot Fight Mode）。'
            : response.status === 403 ? '目標網站擋下我們的爬蟲（anti-bot／WAF 設定偏嚴，常見於 Cloudflare 等）'
            : response.status === 503 ? '目標網站暫時不可用（過載 / 維護中）'
            : null,
      })
    }

    const html = await response.text()

    // 200 但 body 為空 / 過短 → 網站本身壞掉（scalebar.co 案例：Apache 回 200 chunked 但 0 byte）
    // 給上層具體提示，不是讓 analyzer 全部回 0 分讓用戶以為自己網站很爛
    if (!html || html.trim().length < 50) {
      return res.status(502).json({
        error: 'Empty or near-empty response',
        fetchTime,
        sslFallback, uaFallback, proxyFallback,
        antiBotBlocked: false,
        responseSize: html?.length || 0,
        hint: `目標網站回應 200 但內容為空（${html?.length || 0} bytes）— 可能網站維護中、應用程式錯誤（WordPress white screen 等）、或對特定爬蟲只回殼。請用瀏覽器確認網站正常後重試。`,
      })
    }

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
