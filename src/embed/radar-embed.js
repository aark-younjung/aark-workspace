/**
 * AI 雷達 — 嵌入版掃描核心
 *
 * 給優勢方舟官網（www.a-ark.com.tw）在自己的頁面上跑初步檢測用。
 * 這支**只負責跑分析、回傳資料**，畫面完全由呼叫端自己畫，
 * 所以官網那邊可以維持自己的視覺，而判定邏輯仍然只有雷達這一份。
 *
 * 用法：
 *   <script>window.__AARK_FETCH_API__='https://aark-workspace.vercel.app/api/fetch-url'</script>
 *   <script src="https://aark-workspace.vercel.app/embed/aark-radar-embed.js"></script>
 *   AarkRadar.scan('example.com.tw', { onPhase: (k, r) => ... }).then(report => ...)
 *
 * 跟登入版的差別：不寫 Supabase、不留紀錄、不做進階的「實際去問四大 AI」那一段。
 * 那一段要花 LLM 的錢，留在雷達本站與人工報告。
 */

import { fetchPageContent, parseHTML, analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { detectRenderMode, renderModeNotice } from '../lib/renderMode'
import { normalizeUrl } from '../lib/url'
import { classifyScanError } from '../lib/scanError'
import { GROUPS, normalize } from './items'

export const VERSION = '1.0.0'

/**
 * 跑一次初步檢測。
 * @param {string} rawUrl 使用者輸入的網址，可以不帶 https://
 * @param {{onPhase?: (key: string, result: object|null) => void}} opts
 *   onPhase 會在每一個面向完成（或失敗）時被呼叫一次，讓呼叫端可以逐格翻開，
 *   不必讓使用者盯著 30 秒的空畫面。
 * @returns {Promise<object>} 報告物件
 */
export async function scan(rawUrl, opts = {}) {
  const { onPhase } = opts
  const cleanUrl = normalizeUrl(String(rawUrl || '').trim())
  if (!cleanUrl) {
    const err = new Error('URL 格式錯誤，請確認網址（例：yourbrand.com）')
    err.code = 'BAD_URL'
    throw err
  }

  const startedAt = Date.now()

  try {
    // 四個分析器共用同一份 doc，省一次抓取。
    // analyzeSEO 仍會自己抓一次 —— 它要的是抓取當下的 SSL 與 UA 旗標，
    // 那兩個旗標不在 DOM 裡，拿現成的 doc 是問不出來的。
    const { html } = await fetchPageContent(cleanUrl)
    const doc = parseHTML(html)
    const render = detectRenderMode(doc)

    const flip = (key, promise) => promise.then(
      r => { try { onPhase?.(key, r) } catch { /* 呼叫端自己的錯不該中斷掃描 */ } return r },
      () => { try { onPhase?.(key, null) } catch { /* 同上 */ } return null },
    )

    const [seo, aeo, geo, eeat] = await Promise.all([
      flip('seo', analyzeSEO(cleanUrl)),
      flip('aeo', analyzeAEO(cleanUrl, doc)),
      flip('geo', analyzeGEO(cleanUrl, doc)),
      flip('eeat', analyzeEEAT(cleanUrl, doc)),
    ])

    const raw = { seo, aeo, geo, eeat }
    const groups = normalize(raw, { url: cleanUrl })

    const scored = groups.filter(g => typeof g.score === 'number')
    const average = scored.length
      ? Math.round(scored.reduce((s, g) => s + g.score, 0) / scored.length)
      : null

    const allItems = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.key, groupName: g.name })))
    const applicable = allItems.filter(i => !i.na)
    const failed = allItems.filter(i => !i.pass && !i.na)

    return {
      ok: true,
      url: cleanUrl,
      name: new URL(cleanUrl).hostname,
      average,
      groups,
      itemCount: applicable.length,
      passedCount: applicable.length - failed.length,
      // 依面向順序排，SEO 的問題排最前面 —— 地基沒過，後面修了也接不住
      failed,
      // CSR／SPA 判定：內容要跑完 JS 才出現的話，多數 AI 爬蟲讀到的是空白
      render,
      renderNotice: renderModeNotice ? renderModeNotice(render) : null,
      elapsedMs: Date.now() - startedAt,
      version: VERSION,
    }
  } catch (error) {
    // 把英文的技術錯誤轉成人話，跟雷達本站用同一支規則
    const info = classifyScanError(error)
    const err = new Error(info?.title || error?.message || '檢測失敗')
    err.info = info
    err.url = cleanUrl
    err.original = error
    throw err
  }
}

export { GROUPS }
