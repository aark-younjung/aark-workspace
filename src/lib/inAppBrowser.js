/**
 * 偵測 In-App Browser（FB / LINE / IG / WeChat / TikTok 等社群 App 的內建瀏覽器）
 * Google OAuth 從 2021 起禁止在 embedded webview 進行登入，
 * 否則會回 403 disallowed_useragent。
 * 客戶從 LINE / FB 點連結進來時必須先引導他們改用系統瀏覽器（Chrome / Safari）。
 */

// 偵測常見社群 App 內建瀏覽器
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''

  // Facebook（FBAN = Facebook App Name, FBAV = Facebook App Version, FB_IAB = Facebook In-App Browser）
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return true
  // Instagram
  if (/Instagram/i.test(ua)) return true
  // LINE
  if (/Line\//i.test(ua)) return true
  // WeChat / 微信
  if (/MicroMessenger/i.test(ua)) return true
  // TikTok / 抖音
  if (/Bytedance|musical_ly|TikTok|aweme/i.test(ua)) return true
  // Twitter / X
  if (/Twitter/i.test(ua)) return true
  // KakaoTalk（南韓常用）
  if (/KAKAOTALK/i.test(ua)) return true
  // 通用 Android WebView（;wv 標記，多數 Android 內建瀏覽器都有）
  if (/Android.*; wv\)/i.test(ua)) return true

  return false
}

// 回傳當前 in-app browser 的名稱，用於顯示給使用者（如「LINE」「Facebook」）
export function getInAppBrowserName() {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent || ''

  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return 'Facebook'
  if (/Instagram/i.test(ua)) return 'Instagram'
  if (/Line\//i.test(ua)) return 'LINE'
  if (/MicroMessenger/i.test(ua)) return '微信'
  if (/Bytedance|musical_ly|TikTok|aweme/i.test(ua)) return 'TikTok'
  if (/Twitter/i.test(ua)) return 'Twitter'
  if (/KAKAOTALK/i.test(ua)) return 'KakaoTalk'
  if (/Android.*; wv\)/i.test(ua)) return 'App 內建瀏覽器'
  return ''
}

// 偵測作業系統，用於顯示對應的瀏覽器名稱（iOS → Safari, Android → Chrome）
export function getDeviceOS() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

// 取目前登入頁的完整網址，給使用者複製
export function getCurrentUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

// 試圖直接跳出到系統瀏覽器（Android 用 intent://，多數 in-app browser 會處理）
// 不一定每個 webview 都認，所以仍需保留複製網址的 fallback
export function tryOpenInSystemBrowser() {
  if (typeof window === 'undefined') return false
  const url = window.location.href
  const os = getDeviceOS()

  if (os === 'android') {
    // Android intent:// scheme — 多數 webview 會跳出到 Chrome
    const cleanUrl = url.replace(/^https?:\/\//, '')
    const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`
    window.location.href = intentUrl
    return true
  }
  if (os === 'ios') {
    // iOS 沒有可靠的 intent scheme（x-safari-https:// 已被多數 App 封鎖）
    // 直接 fallback 到複製網址提示
    return false
  }
  return false
}
