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

// 中文佔比 ≥ 40% 視為「中文為主」
function cjkRatio(text) {
  const chars = [...text]
  if (chars.length === 0) return 0
  const cjk = chars.filter(c => /[㐀-鿿豈-﫿]/.test(c)).length
  return cjk / chars.length
}

const RANGES = {
  cjk:   { title: [15, 40], desc: [40, 80] },   // 中文：字寬、Google 早截斷
  latin: { title: [30, 60], desc: [70, 155] },  // 英文
}

/**
 * @param {string} text  標題或描述文字
 * @param {'title'|'desc'} kind
 * @returns {{ chars, min, max, isCJK, verdict }}  verdict: 'empty'|'short'|'long'|'ok'
 */
export function metaLengthVerdict(text, kind) {
  const t = (text || '').trim()
  const chars = [...t].length
  if (chars === 0) return { chars: 0, min: 0, max: 0, isCJK: false, verdict: 'empty' }
  const isCJK = cjkRatio(t) >= 0.4
  const [min, max] = (isCJK ? RANGES.cjk : RANGES.latin)[kind]
  const verdict = chars < min ? 'short' : chars > max ? 'long' : 'ok'
  return { chars, min, max, isCJK, verdict }
}
