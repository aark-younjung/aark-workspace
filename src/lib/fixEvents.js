/**
 * fixEvents helper — 用戶顯式宣告「我已修好」事件
 *
 * 觸發點：
 *   - BulkScan SuggestionBlock 的「✓ 我已修好」按鈕
 *   - Dashboard 修復工具箱的工具 modal「✓ 我已修好」按鈕（B5b 之後）
 *   - 各 audit 詳情頁的單項「修復」按鈕（之後）
 *
 * 每個 fix_event 入帳 5 XP（在 useGamification 算進總 XP），對 first_fix 徽章解鎖也有貢獻。
 *
 * 反作弊：不在這層阻擋（用戶可以連點 +XP 刷分），靠後端 audit 重跑驗證
 *        分數真的變高才實質有意義。短期內就信任用戶誠實打卡。
 */
import { supabase } from './supabase'

/**
 * 寫一筆 fix_event
 * @param {object} params
 * @param {string} params.userId        Supabase auth.users.id
 * @param {string} [params.websiteId]   對應 website（可空，例如工具箱通用工具）
 * @param {string} params.findingId     finding 類型 id（如 'missing_canonical'）
 * @param {string} [params.url]         修復的單篇 URL（BulkScan 用）
 * @param {string} params.source        'bulk_scan' | 'toolbox' | 'audit_detail'
 */
export async function recordFixEvent({ userId, websiteId, findingId, url, source }) {
  if (!userId || !findingId || !source) {
    throw new Error('recordFixEvent: 缺少必要參數 userId / findingId / source')
  }
  const { data, error } = await supabase
    .from('fix_events')
    .insert([{
      user_id: userId,
      website_id: websiteId || null,
      finding_id: findingId,
      url: url || null,
      source,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * 查某用戶的所有 fix_events（給 useGamification 用）
 */
export async function listFixEvents(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('fix_events')
    .select('id, finding_id, source, created_at')
    .eq('user_id', userId)
  if (error) {
    console.error('listFixEvents error:', error)
    return []
  }
  return data || []
}
