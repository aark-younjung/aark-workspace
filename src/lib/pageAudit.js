// 頁型判斷 + 分語言 Meta 描述引導 —— 現行產品與改版共用。
// ⚠️ 延續性（AGENTS.md 硬需求）：這套規則在改版、大改版之後都要沿用，不可弄丟。
//    - 首頁不該被要求「麵包屑 / FAQ schema」（那是內頁 / FAQ 頁的事）。
//    - Meta 描述門檻分中英文，且要講明實際字數與是哪一頁。
import { metaLengthVerdict } from './metaLength.js'

// 掃描的是不是首頁？首頁本來就沒有麵包屑（你已在最上層）、FAQ 通常在 FAQ 頁 —— 這兩項在首頁「缺」是正常的。
export function isHomepage(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === ''
  } catch {
    return false
  }
}

// 首頁上「頁型不適用」的檢查 → 正常化說明（不是你的網站有問題，避免「我做了卻還跑出來」的誤會）。
export const HOMEPAGE_NOTES = {
  breadcrumbs: '這一頁是首頁，通常沒有麵包屑（你已在最上層）——麵包屑出現在內頁（服務、文章）。首頁沒有是正常的，不用擔心。',
  faq_schema: '這一頁是首頁，通常沒有 FAQ 結構化資料——它在你的 FAQ 頁（例如 /faq/）。首頁沒有是正常的。',
}

// 首頁不適用的檢查 id（頁型判斷用）
export const HOMEPAGE_NA_CHECKS = new Set(Object.keys(HOMEPAGE_NOTES))

// Meta 描述的「分語言、精確」引導：中英文門檻不同，回實際字數 + 判定 + 可讀的範圍標籤。
export function metaDescGuidance(text) {
  const v = metaLengthVerdict(text || '', 'desc')
  return { ...v, rangeLabel: v.isCJK ? `中文建議 ${v.min}–${v.max} 字` : `英文建議 ${v.min}–${v.max} 字元` }
}

// Meta 描述檢測的「明確標示」說明句（顯示層用）：偵測語言 + 實際字數 + 適用範圍 + 過長/過短判定。
// 有實際描述文字時才能算字數；沒有文字回 null → 交給呼叫端用泛用（列中英兩區間）文案。
export function metaDescFindingDetail(text) {
  if (text == null || !String(text).trim()) return { passed: false, detail: '未設置 Meta 描述' }
  const v = metaLengthVerdict(text, 'desc')
  const lang = v.isCJK ? '中文' : '英文'
  const unit = v.isCJK ? '字' : '字元'
  const range = `${lang}建議 ${v.min}–${v.max} ${unit}`
  if (v.verdict === 'long') return { passed: false, detail: `偵測為${lang}，這頁 ${v.chars} ${unit}（${range}）→ 過長，建議縮到 ${v.max} ${unit}以內` }
  if (v.verdict === 'short') return { passed: false, detail: `偵測為${lang}，這頁 ${v.chars} ${unit}（${range}）→ 過短，建議補到至少 ${v.min} ${unit}` }
  return { passed: true, detail: `偵測為${lang}，這頁 ${v.chars} ${unit}，符合${range}` }
}
