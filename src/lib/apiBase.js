/**
 * fetch-url proxy 的位置。
 *
 * 在雷達自己的網站上跑時是同源的相對路徑，行為跟以前一模一樣。
 * 被嵌到別的網域（例如 www.a-ark.com.tw 的官網頁面）時，那邊會在載入 embed 之前
 * 先設 window.__AARK_FETCH_API__ = 'https://aark-workspace.vercel.app/api/fetch-url'，
 * 這支就會改打絕對網址。/api/fetch-url 本來就回 Access-Control-Allow-Origin: *，
 * 所以跨網域呼叫不需要後端再改。
 */
export const FETCH_API_BASE =
  (typeof window !== 'undefined' && window.__AARK_FETCH_API__) || '/api/fetch-url'
