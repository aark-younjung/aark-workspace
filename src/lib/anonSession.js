/**
 * 匿名訪客識別（value-first 快掃用）
 *
 * 為什麼需要：免登入快掃只存 url + 分數，後台看到同一站被掃 7 次時，
 * 完全分不出「一個人回訪 7 次」還是「7 個不同的人」——判斷需求熱度時等於瞎子。
 * 這裡給每個瀏覽器一組隨機碼，只用來把紀錄歸戶 + 決定要不要顯示軟提示。
 *
 * 隱私：純隨機值、存在使用者自己的 localStorage，不含任何個資、不碰 IP，
 * 清 cookie/換裝置就是新的一組。這是刻意選擇 —— 比記錄 IP 單純也沒有 PDPA 爭議。
 *
 * 註：不是「牆」。掃描永遠不因為沒有這組 id 而失敗（隱私模式回 null 照跑）。
 */

const SID_KEY = 'aark_sid'
const COUNT_KEY = 'aark_anon_scans'

/** 取得（必要時建立）此瀏覽器的匿名識別碼；storage 不可用時回 null，功能照常 */
export function getAnonSessionId() {
  try {
    let sid = localStorage.getItem(SID_KEY)
    if (!sid) {
      sid = (crypto?.randomUUID?.() || `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
      localStorage.setItem(SID_KEY, sid)
    }
    return sid
  } catch {
    return null   // 無痕模式 / 停用 storage
  }
}

/** 累加並回傳「這個瀏覽器累計掃過幾次」；storage 不可用時回 0（＝不會觸發軟提示） */
export function bumpAnonScanCount() {
  try {
    const n = (parseInt(localStorage.getItem(COUNT_KEY), 10) || 0) + 1
    localStorage.setItem(COUNT_KEY, String(n))
    return n
  } catch {
    return 0
  }
}
