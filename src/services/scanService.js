/**
 * 共用單頁掃描 service（2026-08-13 硬切前置 #1）
 *
 * 為什麼抽出來：掃描「跑分析器＋寫入四張 audit 表」的邏輯原本有三份複本
 * （HomeDark / DashboardV2 / 舊 Dashboard），已實際發生過「其中一份漏存欄位 → 詳情頁誤判」
 * 的 bug（2026-08-13 structured_answer 假陰性）。此檔是唯一權威版本；
 * 欄位為完整清單（含 faq_visual / meta_desc_length / structured_answer），新增欄位只改這裡。
 */
import { supabase } from '../lib/supabase'
import { fetchPageContent, parseHTML, analyzeSEO } from './seoAnalyzer'
import { analyzeAEO } from './aeoAnalyzer'
import { analyzeGEO } from './geoAnalyzer'
import { analyzeEEAT } from './eeatAnalyzer'

/**
 * 跑完整單頁掃描（四大面向）並寫入 audit 表。
 * @returns {{ seo, aeo, geo, eeat }} 各分析結果（失敗的面向為 null；寫入用 allSettled、單面向失敗不擋全部）
 */
export async function runFullScan({ websiteId, url }) {
  // 頁面抓一次、四個分析器共用 doc（省 proxy 流量；個別分析器仍可自行補抓站台層檔案）
  const { html } = await fetchPageContent(url)
  const doc = parseHTML(html)

  const [seo, aeo, geo, eeat] = await Promise.all([
    analyzeSEO(url, doc).catch(() => null),
    analyzeAEO(url, doc).catch(() => null),
    analyzeGEO(url, doc).catch(() => null),
    analyzeEEAT(url, doc).catch(() => null),
  ])

  await Promise.allSettled([
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

  return { seo, aeo, geo, eeat }
}
