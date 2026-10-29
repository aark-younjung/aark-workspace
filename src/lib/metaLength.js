/**
 * Meta 標題／描述長度判斷（中英文分開）
 *
 * 2026-07-27：舊版一律用英文門檻（title 30–60、desc 70–155）。但中文字是全形、
 * 佔的顯示寬度約英文兩倍，Google 早在 ~30 個中文字（標題）、~80 個中文字（描述）
 * 就截斷。用英文門檻量中文會兩頭誤判：
 *   - 27 字的中文標題被判「過短」（其實剛好）
 *   - 100 字的中文描述被判「OK」（其實 Google 已截斷）
 * 這裡依「中文佔比」切換門檻，讓台灣客群量得準、講得也準。
 */

// 全形字（中文、全形標點如「｜」「，」）在 SERP 的佔寬約半形兩倍
const WIDE = /[㐀-鿿豈-﫿　-〿＀-￯]/

// 全形字佔「顯示寬度」≥ 40% 視為「中文為主」
// 2026-10-29：舊版逐字算（字母、中文各算 1），「WordPress RWD 網站｜優勢方舟」中文只佔 29% → 誤套英文門檻、
// 21 字被判「過短（建議 30–60 字元）」。改成按寬度算（全形 2、半形 1），同一句變 50%、正確套中文門檻
function cjkRatio(text) {
  let wide = 0, total = 0
  for (const c of text) {
    const w = WIDE.test(c) ? 2 : 1
    total += w
    if (w === 2) wide += w
  }
  return total === 0 ? 0 : wide / total
}

// 2026-10-15：中文標題上限 40 → 30。Google 標題顯示寬度約 600px，中文字約 20px 寬 → 實際約 30 字就截斷，
// 40 字的上限會讓「已被截斷」的標題還判合格。改這裡會連動所有體檢（SEO／AEO／文章分析／批次掃描）的計分。
const RANGES = {
  cjk:   { title: [15, 30], desc: [40, 80] },   // 中文：字寬、Google 早截斷
  latin: { title: [30, 60], desc: [70, 155] },  // 英文
}

// 單字寬度：中文模式下全形 1、半形 0.5（中文字寬）；英文模式下半形 1、全形 2（字元寬）
const charWidth = (c, isCJK) => WIDE.test(c) ? (isCJK ? 1 : 2) : (isCJK ? 0.5 : 1)

/**
 * 2026-10-29：長度改按顯示寬度算（跟 cjkRatio 同一套）。Google 截斷看的是畫面寬度，
 * 舊版逐字算、英數字跟中文字一樣算 1：「GPT-6 Astra 企業應用實測：月付600元，一天只做2支影片」
 * 34 個字元被判過長，實際只有 26 個中文字寬、放得下。回傳的 chars 就是寬度（畫面顯示的「N 字」跟判定一致）
 * @param {string} text  標題或描述文字
 * @param {'title'|'desc'} kind
 * @returns {{ chars, min, max, isCJK, verdict }}  verdict: 'empty'|'short'|'long'|'ok'；chars 可能是 x.5
 */
export function metaLengthVerdict(text, kind) {
  const t = (text || '').trim()
  if (!t) return { chars: 0, min: 0, max: 0, isCJK: false, verdict: 'empty' }
  const isCJK = cjkRatio(t) >= 0.4
  let chars = 0
  for (const c of t) chars += charWidth(c, isCJK)
  const [min, max] = (isCJK ? RANGES.cjk : RANGES.latin)[kind]
  const verdict = chars < min ? 'short' : chars > max ? 'long' : 'ok'
  return { chars, min, max, isCJK, verdict }
}

// 寬度上限換算成字串長度：開頭最多幾個 code unit 放得進 maxWidth（給自動截短用，避免截完還是過長）
export function fitLength(text, maxWidth) {
  const isCJK = cjkRatio(text) >= 0.4
  let w = 0, len = 0
  for (const c of text) {
    w += charWidth(c, isCJK)
    if (w > maxWidth) break
    len += c.length
  }
  return len
}
