/**
 * Meta Pixel 工具（2026-06-13 FB 廣告落地頁上線時加）
 *
 * - Pixel ID 走環境變數 VITE_META_PIXEL_ID（Vercel 後台設定；本地 .env.local）
 * - 沒設 ID = 全部靜默 no-op：不影響開發環境、也不影響未投放期的正式站
 * - 事件對應：
 *     PageView             — initPixel() 時自動送（SPA 首次載入）
 *     Lead                 — 落地頁（/lp/*）用戶送出掃描意圖 / 點代理商候補
 *     CompleteRegistration — 註冊成功（Register.jsx）
 */

export function initPixel() {
  const id = import.meta.env.VITE_META_PIXEL_ID
  if (!id || typeof window === 'undefined' || window.fbq) return
  // Meta 官方 loader（標準壓縮版）
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []
    t = b.createElement(e); t.async = !0; t.src = v
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', id)
  window.fbq('track', 'PageView')
}

// 安全觸發事件 — Pixel 沒初始化（沒設 ID）時靜默略過
export function trackPixel(event, params) {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('track', event, params)
}

// 自訂事件（非 FB 標準事件名）— 用 trackCustom，Ads Manager 會列為自訂轉換
export function trackPixelCustom(event, params) {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('trackCustom', event, params)
}
