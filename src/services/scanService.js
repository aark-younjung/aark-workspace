/**
 * 共用單頁掃描 service（2026-08-13 硬切前置 #1）
 *
 * 為什麼抽出來：掃描「跑分析器＋寫入四張 audit 表」的邏輯原本有三份複本
 * （HomeDark / DashboardV2 / 舊 Dashboard），已實際發生過「其中一份漏存欄位 → 詳情頁誤判」
 * 的 bug（2026-08-13 structured_answer 假陰性）。此檔是唯一權威版本；
 * 欄位為完整清單（含 faq_visual / meta_desc_length / structured_answer），新增欄位只改這裡。
 */
import { supabase } from '../lib/supabase'
import { logError } from '../lib/errorLog'
import { fetchPageContent, parseHTML, analyzeSEO } from './seoAnalyzer'
import { analyzeAEO } from './aeoAnalyzer'
import { analyzeGEO } from './geoAnalyzer'
import { analyzeEEAT } from './eeatAnalyzer'

/**
 * 跑完整單頁掃描（四大面向）並寫入 audit 表。
 * @param {(key:'seo'|'aeo'|'geo'|'eeat', result:object|null) => void} [onProgress]
 *        單一面向跑完就回報（失敗回報 null）。給等待畫面「先跑完先翻牌」用；不傳則行為與過去完全相同。
 * @returns {{ seo, aeo, geo, eeat }} 各分析結果（失敗的面向為 null；寫入用 allSettled、單面向失敗不擋全部）
 */
export async function runFullScan({ websiteId, url, onProgress }) {
  // 頁面抓一次、四個分析器共用 doc（省 proxy 流量；個別分析器仍可自行補抓站台層檔案）
  const { html } = await fetchPageContent(url)
  const doc = parseHTML(html)

  // 逐面向回報進度；仍等四個到齊才往下寫表（回報只是旁路，不改變流程）
  // callback 是呼叫端的 UI code——它壞掉不能拖垮跑了 30–60 秒的掃描，故獨立 try
  const tell = (key, r) => {
    try { onProgress?.(key, r) } catch (e) { console.warn('[scanService] onProgress 失敗：', e) }
  }
  const report = (key, promise) => promise.then(
    r => { tell(key, r); return r },
    () => { tell(key, null); return null },
  )
  const [seo, aeo, geo, eeat] = await Promise.all([
    report('seo', analyzeSEO(url, doc)),
    report('aeo', analyzeAEO(url, doc)),
    report('geo', analyzeGEO(url, doc)),
    report('eeat', analyzeEEAT(url, doc)),
  ])

  // ⚠️ supabase insert 不會 throw（錯誤在回傳值的 .error）——allSettled 全 fulfilled、失敗完全隱形。
  // 2026-08-13 實案：aeo_audits 缺兩欄 → AEO 寫入靜默失敗數日、分數永遠停在舊值。這裡逐筆檢查並記 log。
  const results = await Promise.allSettled([
    seo && supabase.from('seo_audits').insert([{
      website_id: websiteId, score: seo.score,
      meta_tags: seo.meta_tags, h1_structure: seo.h1_structure,
      alt_tags: seo.alt_tags, mobile_compatible: seo.mobile_compatible,
      page_speed: seo.page_speed,
      ssl_chain: seo.ssl_chain, bot_accessibility: seo.bot_accessibility,
    }]),
    aeo && supabase.from('aeo_audits').insert([{
      website_id: websiteId, score: aeo.score,
      json_ld: aeo.json_ld, faq_schema: aeo.faq_schema,
      faq_visual: aeo.faq_visual,
      canonical: aeo.canonical, breadcrumbs: aeo.breadcrumbs,
      open_graph: aeo.open_graph, question_headings: aeo.question_headings,
      meta_desc_length: aeo.meta_desc_length, structured_answer: aeo.structured_answer,
    }]),
    geo && supabase.from('geo_audits').insert([{
      website_id: websiteId, score: geo.score,
      llms_txt: !!geo.llms_txt, robots_ai: !!geo.robots_ai,
      sitemap: !!geo.sitemap, open_graph: !!geo.open_graph,
      twitter_card: !!geo.twitter_card, json_ld_citation: !!geo.json_ld_citation,
      canonical: !!geo.canonical, https: !!geo.https,
    }]),
    eeat && supabase.from('eeat_audits').insert([{
      website_id: websiteId, score: eeat.score,
      author_info: !!eeat.author_info, about_page: !!eeat.about_page,
      contact_page: !!eeat.contact_page, privacy_policy: !!eeat.privacy_policy,
      organization_schema: !!eeat.organization_schema, date_published: !!eeat.date_published,
      social_links: !!eeat.social_links, outbound_links: !!eeat.outbound_links,
    }]),
  ])

  // 寫入結果體檢：任何一面向 insert 失敗都記 console（未來接 error_logs 表時改寫入 DB）
  const tables = ['seo_audits', 'aeo_audits', 'geo_audits', 'eeat_audits']
  results.forEach((result, index) => {
    const insertError = result.status === 'fulfilled' ? result.value?.error : result.reason
    if (insertError) {
      console.error(`[scanService] ${tables[index]} 寫入失敗：`, insertError.message || insertError)
      // 進 error_logs：後台看得到，靜默失敗不再隱形（2026-08-13 AEO 藏一個月的教訓）
      logError({ source: 'scan_insert', message: `${tables[index]}: ${insertError.message || insertError}`, websiteId, detail: { url } })
    }
  })

  return { seo, aeo, geo, eeat }
}
