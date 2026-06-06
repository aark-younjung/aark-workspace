/**
 * GET /api/public?action=stats           — Pricing 頁社會證明 KPI（取代 /api/public-stats）
 * GET /api/public?action=llms&id={uuid}  — llms.txt 代管 endpoint（取代 /api/llms-txt）
 * GET /api/public?action=aivis-trends    — Dashboard「本週 AI 趨勢」widget（2026-06-06 加）
 *
 * 為什麼合併：Vercel Hobby plan 一個 deployment 最多 12 個 serverless functions。
 *   加 llms-txt 後超過上限導致 4 個 commit 連續 deploy fail。合併 public-stats + llms-txt
 *   為同一 endpoint（兩者都是公開讀 + service role + 無 auth），讓 function 數退回 12。
 *
 * 路由分流以 ?action= query param 為準。預設 / 未知 action → 400
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ───────────────────────────────────────────────────────────
// llms.txt 用：AI bot UA 識別表
// ───────────────────────────────────────────────────────────
const AI_BOT_UA_MAP = {
  'gptbot': 'GPTBot (OpenAI)',
  'chatgpt-user': 'ChatGPT-User (OpenAI)',
  'oai-searchbot': 'OAI-SearchBot (OpenAI)',
  'claudebot': 'ClaudeBot (Anthropic)',
  'claude-web': 'Claude-Web (Anthropic)',
  'anthropic-ai': 'anthropic-ai (Anthropic)',
  'perplexitybot': 'PerplexityBot (Perplexity)',
  'perplexity-user': 'Perplexity-User (Perplexity)',
  'google-extended': 'Google-Extended (Google AI)',
  'applebot-extended': 'Applebot-Extended (Apple Intelligence)',
  'bytespider': 'Bytespider (ByteDance/Doubao)',
  'ccbot': 'CCBot (Common Crawl)',
  'amazonbot': 'Amazonbot (Amazon AI)',
  'meta-externalagent': 'Meta-ExternalAgent (Meta AI)',
  'youbot': 'YouBot (You.com)',
}

function detectAiBot(ua) {
  if (!ua) return { isAiBot: false, botName: null }
  const lower = ua.toLowerCase()
  for (const [needle, name] of Object.entries(AI_BOT_UA_MAP)) {
    if (lower.includes(needle)) return { isAiBot: true, botName: name }
  }
  return { isAiBot: false, botName: null }
}

function hashIp(ip) {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

// ───────────────────────────────────────────────────────────
// Main handler — 依 action 分流
// ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Service unavailable' })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const action = (req.query.action || '').toString()
  if (action === 'stats') return handleStats(req, res, supabase)
  if (action === 'llms') return handleLlms(req, res, supabase)
  if (action === 'aivis-trends') return handleAivisTrends(req, res, supabase)
  return res.status(400).json({ error: 'Missing or invalid action (expected: stats | llms | aivis-trends)' })
}

// ───────────────────────────────────────────────────────────
// action=stats — Pricing 頁 KPI 聚合
// ───────────────────────────────────────────────────────────
async function handleStats(req, res, supabase) {
  try {
    // 並行 8 查（4 個 audit 表 + 3 個 aivis 表 + 1 個早鳥已售名額），head:true 只回 count 不抓 row 資料
    const [brandsRes, seoRes, aeoRes, geoRes, eeatRes, mentionsRes, scansRes, earlybirdRes] = await Promise.all([
      supabase.from('aivis_brands').select('*', { count: 'exact', head: true }),
      supabase.from('seo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('aeo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('geo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('eeat_audits').select('*', { count: 'exact', head: true }),
      supabase.from('aivis_mentions').select('*', { count: 'exact', head: true }).eq('brand_mentioned', true),
      supabase.from('aivis_responses').select('*', { count: 'exact', head: true }),
      supabase.from('aivis_newebpay_pending').select('*', { count: 'exact', head: true })
        .eq('pack', 'earlybird').eq('status', 'paid').neq('refund_status', 'completed'),
    ])

    const brands = brandsRes.count || 0
    const reports = (seoRes.count || 0) + (aeoRes.count || 0) + (geoRes.count || 0) + (eeatRes.count || 0)
    const mentions = mentionsRes.count || 0
    const scans = scansRes.count || 0
    const earlybird_taken = earlybirdRes.count || 0

    // 5 分鐘 CDN cache + 10 分鐘 stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ brands, reports, mentions, scans, earlybird_taken })
  } catch (err) {
    console.error('[public/stats] query failed:', err)
    return res.status(500).json({ error: 'Failed to load stats' })
  }
}

// ───────────────────────────────────────────────────────────
// action=aivis-trends — Dashboard「本週 AI 趨勢」widget（2026-06-06 加）
//
// 用 aivis 累積資料反推「本週 AI 引擎在推薦什麼品牌」 — 跨用戶匿名聚合
// 用戶看了會想「我的品牌有沒有在榜上 / 排第幾」→ 創造每週回訪動機
//
// 回傳：
//   {
//     range: { from: ISO, to: ISO },
//     topMentions: [{ name, count, change_pct }, ...]    本週提及次數 Top 5、含對比上週
//     engineBreakdown: { ChatGPT: N, Claude: N, ... }    本週各引擎呼叫總量（規模感）
//     totalMentions: N                                    本週總提及次數
//     totalResponses: N                                   本週總 AI 回應數
//   }
// ───────────────────────────────────────────────────────────
async function handleAivisTrends(req, res, supabase) {
  try {
    const now = new Date()
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // 行業 filter（2026-06-07 Phase A 加）— industries query param: 'beauty-spa,restaurant'
    // 空 → 不 filter、全平台聚合；有值 → 找該行業品牌的 mentions
    const industriesRaw = (req.query.industries || '').toString().trim()
    const industries = industriesRaw ? industriesRaw.split(',').map(s => s.trim()).filter(Boolean) : []

    // 如果有 industries filter、先查出符合的 brand_ids
    let allowedBrandIds = null
    if (industries.length > 0) {
      const { data: brands } = await supabase
        .from('aivis_brands')
        .select('id')
        .overlaps('industries', industries) // PostgreSQL && 運算子
      allowedBrandIds = (brands || []).map(b => b.id)
      // 如果該行業沒任何品牌、直接回空（避免下面 query .in([]) 出問題）
      if (allowedBrandIds.length === 0) {
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
        return res.status(200).json({
          range: { from: thisWeekStart.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
          industries,
          topMentions: [], engineBreakdown: {}, totalMentions: 0, totalResponses: 0,
        })
      }
    }

    // build queries — 視 industries filter 決定要不要加 .in()
    const filterByBrand = q => allowedBrandIds ? q.in('brand_id', allowedBrandIds) : q

    // 本週 + 上週 mentions（拿 mentioned_name + created_at 計算 top 與 change）
    const [thisWeek, lastWeek, engines, totalResp] = await Promise.all([
      filterByBrand(supabase.from('aivis_mentions')
        .select('mentioned_name')
        .gte('created_at', thisWeekStart.toISOString())),
      filterByBrand(supabase.from('aivis_mentions')
        .select('mentioned_name')
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', thisWeekStart.toISOString())),
      filterByBrand(supabase.from('aivis_responses')
        .select('model')
        .gte('created_at', thisWeekStart.toISOString())),
      filterByBrand(supabase.from('aivis_responses')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thisWeekStart.toISOString())),
    ])

    // 計算本週 Top mentions（按 mentioned_name 計數）
    const thisWeekCounts = {}
    ;(thisWeek.data || []).forEach(r => {
      const name = (r.mentioned_name || '').trim()
      if (!name) return
      thisWeekCounts[name] = (thisWeekCounts[name] || 0) + 1
    })
    const lastWeekCounts = {}
    ;(lastWeek.data || []).forEach(r => {
      const name = (r.mentioned_name || '').trim()
      if (!name) return
      lastWeekCounts[name] = (lastWeekCounts[name] || 0) + 1
    })

    const topMentions = Object.entries(thisWeekCounts)
      .map(([name, count]) => {
        const prev = lastWeekCounts[name] || 0
        let change_pct = null
        if (prev > 0) change_pct = Math.round(((count - prev) / prev) * 100)
        else if (count > 0) change_pct = 100 // 上週 0 → 本週 N，新進榜
        return { name, count, change_pct }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Engine breakdown — 把 model 名稱對應到友善 label
    const MODEL_LABEL = {
      'claude-sonnet': 'Claude',
      'claude': 'Claude',
      'anthropic': 'Claude',
      'gpt': 'ChatGPT',
      'openai': 'ChatGPT',
      'gemini': 'Gemini',
      'perplexity': 'Perplexity',
      'glm': 'GLM',
    }
    const engineBreakdown = {}
    ;(engines.data || []).forEach(r => {
      const m = (r.model || '').toLowerCase()
      let label = '其他'
      for (const [key, value] of Object.entries(MODEL_LABEL)) {
        if (m.includes(key)) { label = value; break }
      }
      engineBreakdown[label] = (engineBreakdown[label] || 0) + 1
    })

    const totalMentions = (thisWeek.data || []).length
    const totalResponses = totalResp.count || 0

    // 5 分鐘 CDN cache（cron 跑 aivis 也是大時段、5 分鐘足夠新鮮）
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      range: {
        from: thisWeekStart.toISOString().slice(0, 10),
        to: now.toISOString().slice(0, 10),
      },
      industries,
      topMentions,
      engineBreakdown,
      totalMentions,
      totalResponses,
    })
  } catch (err) {
    console.error('[public/aivis-trends] query failed:', err)
    return res.status(500).json({ error: 'Failed to load aivis trends' })
  }
}

// ───────────────────────────────────────────────────────────
// action=llms — llms.txt 代管 + visit logging
// ───────────────────────────────────────────────────────────
async function handleLlms(req, res, supabase) {
  const rawId = (req.query.id || '').toString().replace(/\.txt$/i, '')
  if (!rawId) return res.status(400).send('Missing website id')

  // 並行拉 website + 4 種 audit 的最新一筆
  const [websiteRes, seoRes, aeoRes, eeatRes] = await Promise.all([
    supabase.from('websites').select('id, url, name, is_public_optout').eq('id', rawId).maybeSingle(),
    supabase.from('seo_audits').select('meta_tags, h1_structure, created_at').eq('website_id', rawId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('aeo_audits').select('open_graph, json_ld, created_at').eq('website_id', rawId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('eeat_audits').select('organization_schema, about_page, contact_page, created_at').eq('website_id', rawId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const website = websiteRes.data
  if (!website) return res.status(404).send('Website not found')
  if (website.is_public_optout) return res.status(403).send('This llms.txt is not publicly available')

  const llmsTxt = generateLlmsTxt({
    website,
    seoAudit: seoRes.data,
    aeoAudit: aeoRes.data,
    eeatAudit: eeatRes.data,
  })

  // 記錄訪問日誌 — 排除我們自己內部 fetch（GEO 詳情頁 preview）
  const isInternal = req.headers['x-aark-internal'] === 'true'
  if (!isInternal) {
    const ua = req.headers['user-agent'] || ''
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    const { isAiBot, botName } = detectAiBot(ua)
    try {
      await supabase.from('crawler_visits').insert({
        website_id: rawId,
        user_agent: ua.slice(0, 500),
        ip_hash: hashIp(ip),
        is_ai_bot: isAiBot,
        bot_name: botName,
        source: 'llms_txt',
      })
    } catch (logErr) {
      console.warn('[public/llms] visit log insert failed:', logErr?.message)
    }
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  // 60s CDN cache — 太短沒意義、太長會錯過 visit 記錄
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
  return res.status(200).send(llmsTxt)
}

/**
 * 從 audit 資料生成 llms.txt 標準格式（llmstxt.org）
 */
function generateLlmsTxt({ website, seoAudit, aeoAudit, eeatAudit }) {
  const hostname = safeHostname(website.url)
  const title = website.name || hostname
  const metaDesc = seoAudit?.meta_tags?.description?.trim()
  const ogDesc = aeoAudit?.open_graph?.description?.trim()
  const description = metaDesc || ogDesc || `${title} — AI 能見度檢測網站`
  const today = new Date().toISOString().split('T')[0]
  const baseUrl = website.url.replace(/\/$/, '')
  const hasOrgSchema = !!eeatAudit?.organization_schema
  const hasAboutPage = !!eeatAudit?.about_page
  const hasContactPage = !!eeatAudit?.contact_page

  const lines = []
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`> ${description}`)
  lines.push('')
  lines.push(`This file describes ${title} for Large Language Models and AI crawlers.`)
  lines.push(`Generated by AI Radar (aark-workspace.vercel.app) on ${today}.`)
  lines.push('')
  lines.push('## Site information')
  lines.push('')
  lines.push(`- [Homepage](${baseUrl}): ${title}`)
  lines.push(`- [Sitemap](${baseUrl}/sitemap.xml): XML sitemap with all site URLs`)
  if (hasAboutPage) lines.push(`- [About](${baseUrl}/about): Organization information`)
  if (hasContactPage) lines.push(`- [Contact](${baseUrl}/contact): Contact information`)
  lines.push('')
  lines.push('## AI crawler policy')
  lines.push('')
  lines.push('This site welcomes the following AI crawlers:')
  lines.push('')
  lines.push('- GPTBot (OpenAI)')
  lines.push('- ChatGPT-User (OpenAI)')
  lines.push('- OAI-SearchBot (OpenAI)')
  lines.push('- ClaudeBot (Anthropic)')
  lines.push('- anthropic-ai (Anthropic)')
  lines.push('- Claude-Web (Anthropic)')
  lines.push('- PerplexityBot (Perplexity)')
  lines.push('- Perplexity-User (Perplexity)')
  lines.push('- Google-Extended (Google AI)')
  lines.push('- Applebot-Extended (Apple Intelligence)')
  lines.push('')
  lines.push('Content from this site may be cited in AI-generated answers.')
  lines.push('')

  const signals = []
  if (aeoAudit?.json_ld) signals.push('JSON-LD structured data is available across pages')
  if (hasOrgSchema) signals.push('Organization schema is present (provides entity context)')
  if (aeoAudit?.open_graph) signals.push('Open Graph metadata is available for social previews')
  if (signals.length > 0) {
    lines.push('## Structured data signals')
    lines.push('')
    for (const s of signals) lines.push(`- ${s}`)
    lines.push('')
  }

  lines.push('## Optional')
  lines.push('')
  lines.push(`- [AI visibility report](https://aark-workspace.vercel.app/website-summary/${website.id}): public summary of this site's AI visibility scores`)
  lines.push(`- [llms.txt specification](https://llmstxt.org/): about this file format`)
  lines.push('')
  lines.push('---')
  lines.push(`This llms.txt is auto-generated and refreshed when new AI Radar audits run.`)
  lines.push(`To regenerate: rescan ${baseUrl} at https://aark-workspace.vercel.app`)

  return lines.join('\n')
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
