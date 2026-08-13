/**
 * 品牌 AI 能見度等級（2026-08-13 第一批 #6 · 用戶定案：里程碑事件制＋雷達隱喻）。
 * 取代「使用者積分」思維：等級掛在**品牌/網站**上，慶祝「品牌在 AI 眼中變強」而非「用工具打卡」。
 * 誠實原則：每一級都是**可驗證的真實事件**（掃描存在／品牌連結／真的被 AI 提及／真實曝光率門檻），
 * 嚴格逐級解鎖、不跳級、無虛構分數。
 */
export const BRAND_LEVELS = [
  { lv: 0, name: '雷達外',     icon: '🌫️', condition: '網站已加入、尚未掃描' },
  { lv: 1, name: '已上雷達',   icon: '📡', condition: '完成首次網站掃描' },
  { lv: 2, name: '開始監測',   icon: '🛰️', condition: '連結品牌並完成首次 AI 掃描' },
  { lv: 3, name: '被 AI 看見', icon: '👁️', condition: '品類題被 AI 提及（近 90 天）' },
  { lv: 4, name: '進入推薦名單', icon: '⭐', condition: '近 90 天品類推薦曝光率達 30%' },
  { lv: 5, name: '同類領先',   icon: '🏆', condition: '曝光率達 50%，或領先整個觀察名單' },
]

/**
 * @returns {{ current, next }} current＝目前等級物件；next＝下一級（滿級時 null）
 * 嚴格逐級：前一級沒達成就不看後面（里程碑語意——事件是接續發生的）
 */
export function computeBrandLevel({ hasAudit = false, hasBrand = false, hasAivisScan = false, rate90 = null, leadsWatchlist = false }) {
  let lv = 0
  if (hasAudit) lv = 1
  if (lv === 1 && hasBrand && hasAivisScan) lv = 2
  if (lv === 2 && (rate90 ?? 0) > 0) lv = 3                                  // 近 90 天真的被提及過
  if (lv === 3 && rate90 >= 30) lv = 4
  if (lv === 4 && (rate90 >= 50 || leadsWatchlist)) lv = 5
  return { current: BRAND_LEVELS[lv], next: BRAND_LEVELS[lv + 1] || null }
}
