/**
 * 掃描失敗的人話分類（2026-08-27 抽出成共用模組）
 *
 * 這套分類原本只寫在 HomeDark.jsx 的 catch 裡（約 60 行 if/else）。硬切之後首頁換成
 * HomeLight，失敗時只剩一行「分析中斷：<原始英文訊息>」——廣告帶進來的陌生人看到的是
 * 「All fetch rounds timed out」這種字串，看不懂也不知道下一步，直接跳走。
 *
 * 抽出來的原因不是為了共用（HomeDark 遲早退役），是為了讓「失敗訊息」有單一來源可以維護：
 * 未來多一種失敗型態，只要改這裡，首頁／儀表板／落地頁都會跟著對。
 *
 * 回傳欄位：
 *   title / hint / action — 給使用者看的三段人話
 *   kind      — 'blocked' | 'timeout' | 'notfound' | 'invalid' | 'network' | 'unknown'
 *   retryable — 稍後重試有意義（逾時／503／網路）
 *   userFixable — 使用者自己改網址就能解（404／格式錯）；這種情況不該收 email 通知
 *   sellable  — 這個失敗本身就是產品要賣的 finding（被 WAF 擋＝AI 爬蟲大概率也讀不到）
 */
export function classifyScanError(error) {
  const detail = error?.message || String(error || '')
  const status = error?.status || error?.code
  const isNetwork = error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN'
    || error?.code === 'NETWORK_ERROR' || /network|fetch failed/i.test(detail)
  const isTimeout = error?.timedOut || error?.code === 'ETIMEDOUT'
    || /timeout|timed out/i.test(detail)
  const isInvalidUrl = error?.code === 'ERR_INVALID_URL' || /URL 格式/i.test(detail)

  const base = { code: error?.code || `HTTP_${status || 'UNKNOWN'}`, status: status || null, technical: detail }

  if (error?.antiBotBlocked) {
    return {
      ...base, kind: 'blocked', retryable: false, userFixable: false, sellable: true,
      title: '你的網站擋下了我們的爬蟲',
      hint: '我們換過 4 種爬蟲身份都被回絕（anti-bot／WAF 鎖得很嚴）。GPTBot、ClaudeBot、Google-Extended 這些 AI 引擎的爬蟲大概率也一樣被擋在門外——這正是品牌在 AI 答案裡隱形的頭號原因。',
      action: '請網站管理員把 anti-bot／WAF 嚴格度調低，並在防火牆白名單放行 AI 爬蟲。Cloudflare 的話：Security → Bots → Super Bot Fight Mode 降為 Standard，再到 WAF Custom Rules 放行 AI 爬蟲 UA。',
    }
  }
  if (status === 403 || /403/.test(detail)) {
    return {
      ...base, kind: 'blocked', retryable: false, userFixable: false, sellable: true,
      title: '網站回 403——防護設定偏嚴',
      hint: '我們試過多種爬蟲身份仍被擋。可能是 Cloudflare Bot Fight Mode、主機防火牆規則，或 robots.txt 直接拒絕。',
      action: '降低 anti-bot 嚴格度，或在 WAF 白名單放行 GPTBot / ChatGPT-User / ClaudeBot / anthropic-ai / Google-Extended 等 AI 爬蟲。',
    }
  }
  if (status === 404 || /404/.test(detail)) {
    return {
      ...base, kind: 'notfound', retryable: false, userFixable: true, sellable: false,
      title: '找不到這個網址',
      hint: '對方伺服器回 404——網址路徑可能拼錯，或這一頁已經下線。',
      action: '直接複製瀏覽器網址列的完整網址再貼一次，或改掃首頁。',
    }
  }
  if (status === 503 || /503/.test(detail)) {
    return {
      ...base, kind: 'timeout', retryable: true, userFixable: false, sellable: false,
      title: '網站暫時不可用',
      hint: '伺服器回 503——通常是過載、維護中，或防護服務（例如 Cloudflare 的 5 秒驗證）把我們擋下。',
      action: '過幾分鐘再掃一次通常就好。',
    }
  }
  if (isTimeout) {
    return {
      ...base, kind: 'timeout', retryable: true, userFixable: false, sellable: false,
      title: '這次沒連上，對方主機沒有在時限內回應',
      hint: '我們試了 4 種身份都沒收到回應。最常見的原因是「短時間內對同一個網站掃太多次」，被對方主機的速率限制暫時擋住——尤其金融、醫療這類防護嚴格的網站。這不代表你的網站有問題，也不代表你對 AI 隱形。',
      action: '等幾分鐘再掃一次通常就通了。如果你剛剛連續掃了好幾次，先休息一下再來。',
    }
  }
  if (isInvalidUrl) {
    return {
      ...base, kind: 'invalid', retryable: false, userFixable: true, sellable: false,
      title: '網址格式不對',
      hint: '這串網址沒辦法解析（可能多了字、少了 https://，或主機名稱不合法）。',
      action: '複製瀏覽器網址列的完整網址再貼上一次。',
    }
  }
  if (isNetwork) {
    return {
      ...base, kind: 'network', retryable: true, userFixable: false, sellable: false,
      title: '連不上這個網站',
      hint: 'DNS 查不到，或對方根本沒回應。可能是網址拼錯、網站已關閉，或我們的出口 IP 被對方擋掉。',
      action: '先在瀏覽器確認這個網址打得開，再回來重試。',
    }
  }
  return {
    ...base, kind: 'unknown', retryable: true, userFixable: false, sellable: false,
    title: '掃描沒能完成',
    hint: detail || '發生未預期的錯誤。',
    action: '稍後再試一次；如果一直失敗，把這個畫面截圖給我們，我們幫你查。',
  }
}

/**
 * 這次掃的是內頁的話，回傳同網域的首頁網址（給「改掃首頁」用）。
 *
 * 為什麼值得做：企業站常見的情況是內頁（招募、產品、部落格）掛在防護較嚴的路徑或另一台
 * 伺服器上，首頁反而開放。與其讓人在失敗畫面前呆住，不如直接遞給他一個大概率會成功的目標。
 * 已經是首頁（path 只有 '/'）就回 null，不顯示這顆按鈕。
 */
export function homepageOf(url) {
  try {
    const u = new URL(url)
    if (u.pathname === '/' && !u.search) return null
    return u.origin + '/'
  } catch { return null }
}
