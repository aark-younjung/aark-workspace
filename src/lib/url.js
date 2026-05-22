/**
 * URL 正規化 — 把用戶輸入的各種 URL 變體統一成一致形式，方便 (url, user_id) dedup
 *
 * 處理項目：
 * - 補 protocol（缺 https:// 自動補）
 * - hostname 全小寫
 * - 拿掉 www.
 * - 拿掉 trailing slash
 * - 拿掉 query string（?utm_source=fb&gad_source=1 之類追蹤參數）
 * - 拿掉 hash（#section1）
 * - 拿掉預設 port（:80 / :443）
 *
 * 為什麼需要：
 * 用戶從不同管道（直接輸入 / Google Ads 連結 / Email 連結 / 分享連結）
 * 拿到的同一網站 URL 可能長得很不一樣：
 *   - example.com
 *   - https://example.com/
 *   - www.Example.com:443/?utm_source=fb#top
 *   - https://example.com/?gad_source=1&gad_campaignid=2276477
 * 沒有正規化的話 HomeDark.jsx dedup 會把上面每一個都當成不同網站，
 * 同一個用戶測同一個網站就會建出多筆 websites row。
 *
 * @example
 *   normalizeUrl('example.com')                           // 'https://example.com'
 *   normalizeUrl('https://www.Example.com/?utm=fb')       // 'https://example.com'
 *   normalizeUrl('https://example.com/about/')            // 'https://example.com/about'
 *   normalizeUrl('https://example.com/?gad_source=1')     // 'https://example.com'
 *
 * @param {string} input 用戶輸入字串
 * @returns {string} 正規化後 URL，例：https://example.com/about
 */
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return ''
  let s = input.trim()
  if (!s) return ''

  // 補 protocol（缺 https:// 自動補）
  if (!s.startsWith('http://') && !s.startsWith('https://')) {
    s = 'https://' + s
  }

  try {
    const u = new URL(s)
    // hostname 拿掉 www. 且全小寫
    const host = u.hostname.toLowerCase().replace(/^www\./, '')

    // 防呆 1：所有公開網域至少要有一個點（domain.tld）
    // 例：'https://ihttps//seeu.tw' → hostname='ihttps' (無點) → 拒絕
    // 例：'https://localhost' → 拒絕（雖然上層 fetch-url 也擋，這裡早攔早好）
    if (!host.includes('.')) {
      return ''
    }

    // 防呆 2：hostname 內含 / 是非法（URL parser 應該不允許但保險擋一次）
    if (host.includes('/')) {
      return ''
    }

    // path 拿掉 trailing slash（保留中間結構），首頁 '/' 直接變成空字串
    const path = u.pathname.replace(/\/+$/, '')
    // 一律強制 https（http 也升為 https，現代網站幾乎都支援，方便 dedup）
    return `https://${host}${path}`
  } catch {
    // URL 解析失敗（用戶輸入亂碼），退回到全小寫 + trim
    return s.toLowerCase()
  }
}
