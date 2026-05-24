/**
 * GET /api/llms/{id}（或經由 vercel.json rewrite 對外暴露為 /llms/{id}.txt）
 *
 * llms.txt 代管端點 — 從用戶 audit 資料自動生成 llms.txt，回 text/plain
 *
 * 為什麼用 path-based（非 subdomain）：
 *   - DNS 設定門檻高、新增功能要動 DNS 不靈活
 *   - 對 LLM 爬蟲而言 path vs subdomain 無差，只是視覺加分
 *   - 之後 user 接到自己網站時，會用 /llms.txt（他自己 root），這個 endpoint 是「正本來源」
 *
 * 標準參考：https://llmstxt.org/
 *
 * Cache：CDN cache 1 小時（audit 不會頻繁變、避免每次 hit 都打 Supabase）
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// 知名 AI bot UA 識別表 — 子字串 match
// key 是匹配的 substring（lowercase），value 是顯示用 bot name
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

// IP 去識別化 — SHA-256 hash 前 16 字
function hashIp(ip) {
  if (!ip) return null
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
}

export default async function handler(req, res) {
  // CORS — 公開資源、允許所有來源讀
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  // 從 URL 拿 website id（rewrite 後 .txt 後綴可能會被帶進來，過濾掉）
  const rawId = (req.query.id || '').toString().replace(/\.txt$/i, '')
  if (!rawId) return res.status(400).send('Missing website id')

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).send('Service unavailable')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
  // 尊重用戶 opt-out — 不對外暴露 llms.txt 內容
  if (website.is_public_optout) return res.status(403).send('This llms.txt is not publicly available')

  const llmsTxt = generateLlmsTxt({
    website,
    seoAudit: seoRes.data,
    aeoAudit: aeoRes.data,
    eeatAudit: eeatRes.data,
  })

  // 記錄訪問日誌 — 排除我們自己內部 fetch（GEO 詳情頁 preview）
  // 排除規則：X-AARK-Internal: true header（前端 fetch 時手動帶上）
  const isInternal = req.headers['x-aark-internal'] === 'true'
  if (!isInternal) {
    const ua = req.headers['user-agent'] || ''
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    const { isAiBot, botName } = detectAiBot(ua)
    // 不 await — fire-and-forget，避免拖慢 response
    // 但 Vercel function 在 response 後就會 terminate，要保險還是 await
    try {
      await supabase.from('crawler_visits').insert({
        website_id: rawId,
        user_agent: ua.slice(0, 500),     // 截 500 字防 abuse
        ip_hash: hashIp(ip),
        is_ai_bot: isAiBot,
        bot_name: botName,
        source: 'llms_txt',
      })
    } catch (logErr) {
      // 記錄失敗不該阻擋 llms.txt 回傳，吃掉 error
      console.warn('[llms] visit log insert failed:', logErr?.message)
    }
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  // ⚠️ Cache-Control 縮短到 60s — 否則 CDN cache hit 不會打到我們 endpoint、無法記 visit
  // 60s 已經足以扛大流量（多數 AI bot 訪問頻率 << 1/min per site），又不會錯過 visit
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
  return res.status(200).send(llmsTxt)
}

/**
 * 從 audit 資料生成 llms.txt 標準格式（llmstxt.org）
 *
 * 缺欄位時 graceful degrade：用 fallback 文案而非錯
 */
function generateLlmsTxt({ website, seoAudit, aeoAudit, eeatAudit }) {
  // 標題：優先用 website.name，沒有就從 URL 推 hostname
  const hostname = safeHostname(website.url)
  const title = website.name || hostname

  // 描述：優先用 SEO meta description → AEO og description → fallback
  const metaDesc = seoAudit?.meta_tags?.description?.trim()
  const ogDesc = aeoAudit?.open_graph?.description?.trim()
  const description = metaDesc || ogDesc || `${title} — AI 能見度檢測網站`

  const today = new Date().toISOString().split('T')[0]
  const baseUrl = website.url.replace(/\/$/, '')

  // Organization schema info（若有）
  const hasOrgSchema = !!eeatAudit?.organization_schema
  const hasAboutPage = !!eeatAudit?.about_page
  const hasContactPage = !!eeatAudit?.contact_page

  // 組 llms.txt — 依 llmstxt.org 標準（H1 標題、blockquote 描述、## sections、- bullet links）
  const lines = []
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(`> ${description}`)
  lines.push('')
  lines.push(`This file describes ${title} for Large Language Models and AI crawlers.`)
  lines.push(`Generated by AI Radar (aark-workspace.vercel.app) on ${today}.`)
  lines.push('')

  // Section: Site information
  lines.push('## Site information')
  lines.push('')
  lines.push(`- [Homepage](${baseUrl}): ${title}`)
  lines.push(`- [Sitemap](${baseUrl}/sitemap.xml): XML sitemap with all site URLs`)
  if (hasAboutPage) lines.push(`- [About](${baseUrl}/about): Organization information`)
  if (hasContactPage) lines.push(`- [Contact](${baseUrl}/contact): Contact information`)
  lines.push('')

  // Section: AI crawler policy（重要訊號 — 告訴 LLM 我們歡迎你抓）
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

  // Section: Structured data signals（讓 LLM 知道我們有哪些 schema 可解析）
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

  // Optional section — llmstxt.org 標準的「次要資訊」，AI 工具想精簡時可略過
  lines.push('## Optional')
  lines.push('')
  lines.push(`- [AI visibility report](https://aark-workspace.vercel.app/website-summary/${website.id}): public summary of this site's AI visibility scores`)
  lines.push(`- [llms.txt specification](https://llmstxt.org/): about this file format`)
  lines.push('')

  // Footer
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
