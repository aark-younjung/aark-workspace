/**
 * 錯誤日誌（2026-08-14）—— 解「錯誤隱形」結構性問題。
 * 實案：AEO 寫入靜默失敗一個月沒人發現（只記 browser console＝沒人看得到）。
 * 這裡把關鍵失敗寫進 `error_logs` 表 → 後台系統監控頁可見。
 * 設計：fire-and-forget、絕不 throw（記錄失敗不能反過來弄壞主流程）；RLS：任何人可寫、admin 可讀。
 */
import { supabase } from './supabase'

/**
 * @param {object} entry
 * @param {string} entry.source   來源（例：'scan_insert' / 'rescan' / 'aivis_scan' / 'cron_auto_scan'）
 * @param {string} entry.message  錯誤訊息（原文）
 * @param {object} [entry.detail] 補充資訊（url、step 等，存 JSONB）
 * @param {string} [entry.userId] / [entry.websiteId] / [entry.brandId]
 */
export function logError({ source, message, detail = null, userId = null, websiteId = null, brandId = null }) {
  try {
    supabase.from('error_logs').insert({
      source,
      message: String(message || '').slice(0, 500),
      detail,
      user_id: userId,
      website_id: websiteId,
      brand_id: brandId,
    }).then(({ error }) => {
      if (error) console.warn('[errorLog] 寫入失敗（表未建或 RLS）：', error.message)
    })
  } catch (error) {
    console.warn('[errorLog] 例外：', error)
  }
}
