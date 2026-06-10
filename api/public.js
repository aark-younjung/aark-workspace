/**
 * GET /api/public?action=stats             — Pricing 頁社會證明 KPI（取代 /api/public-stats）
 * GET /api/public?action=llms&id={uuid}    — llms.txt 代管 endpoint（取代 /api/llms-txt）
 * GET /api/public?action=aivis-trends      — Dashboard「本週 AI 趨勢」widget（2026-06-06 加）
 * GET /api/public?action=brand-mentions    — 品牌外部提及搜尋（2026-06-10 加、原 /api/brand-mentions）
 *
 * 為什麼合併：Vercel Hobby plan 一個 deployment 最多 12 個 serverless functions。
 *   加 llms-txt 後超過上限導致 4 個 commit 連續 deploy fail。合併 public-stats + llms-txt
 *   為同一 endpoint（兩者都是公開讀 + service role + 無 auth），讓 function 數退回 12。
 *   2026-06-10：再把 brand-mentions 也合進來（一樣是無 auth 公開讀）、function 數退回 12。
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
  // 2026-06-10：indexnow-ping 用 POST、其餘 action 用 GET、所以放行兩者
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const action = (req.query.action || '').toString()

  // indexnow-ping（POST、不需 supabase）先處理 — 2026-06-10 從 /api/indexnow-ping 合併進來、省 1 個 function
  if (action === 'indexnow-ping') return handleIndexnowPing(req, res)

  // 其餘 action 一律 GET
  if (req.method !== 'GET') return res.status(405).send('Method not allowed')

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Service unavailable' })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  if (action === 'stats') return handleStats(req, res, supabase)
  if (action === 'llms') return handleLlms(req, res, supabase)
  if (action === 'aivis-trends') return handleAivisTrends(req, res, supabase)
  if (action === 'brand-mentions') return handleBrandMentions(req, res)  // 不需 supabase、不傳
  return res.status(400).json({ error: 'Missing or invalid action (expected: stats | llms | aivis-trends | brand-mentions | indexnow-ping)' })
}

// ───────────────────────────────────────────────────────────
// action=indexnow-ping — 通知 Google / Bing 重新抓 sitemap（2026-06-10 從 /api/indexnow-ping 合併進來）
//   POST body: { url }
// ───────────────────────────────────────────────────────────
async function handleIndexnowPing(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed (POST only)' })
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const baseUrl = url.replace(/\/$/, '')
    const sitemapUrl = encodeURIComponent(`${baseUrl}/sitemap.xml`)
    const [googleRes, bingRes] = await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' }),
      fetch(`https://www.bing.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' }),
    ])
    return res.json({
      success: true,
      google: googleRes.status === 'fulfilled' ? googleRes.value.status : 'error',
      bing: bingRes.status === 'fulfilled' ? bingRes.value.status : 'error',
      pingedAt: new Date().toISOString(),
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

// ───────────────────────────────────────────────────────────
// action=brand-mentions — 品牌外部提及（Google Custom Search、2026-06-10 從 /api/brand-mentions 合併進來）
//   Query: brand, excludeDomain, num
//   Env: GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID
// ───────────────────────────────────────────────────────────
const BRAND_MENTIONS_ALLOWED_NUM = [5, 10, 20]

async function handleBrandMentions(req, res) {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cseId = process.env.GOOGLE_CSE_ID
  if (!apiKey || !cseId) {
    return res.status(503).json({
      error: 'not_configured',
      message: 'Brand mentions 功能未啟用、請在 Vercel 設定 GOOGLE_CSE_API_KEY 與 GOOGLE_CSE_ID',
    })
  }

  const brand = (req.query.brand || '').trim()
  const excludeDomain = (req.query.excludeDomain || '').trim()
  const num = BRAND_MENTIONS_ALLOWED_NUM.includes(parseInt(req.query.num)) ? parseInt(req.query.num) : 10

  if (!brand || brand.length < 2) return res.status(400).json({ error: 'Brand name required (≥ 2 chars)' })
  if (brand.length > 50) return res.status(400).json({ error: 'Brand name too long (max 50 chars)' })

  // 組 query：exact phrase + 排除自家網域、避免抓到自家頁面
  // 例：`"金鉑先生" -site:kimbo3899.com.tw`
  let query = `"${brand}"`
  if (excludeDomain) {
    const cleanDomain = excludeDomain
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
    if (cleanDomain) query += ` -site:${cleanDomain}`
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cseId)
    url.searchParams.set('q', query)
    url.searchParams.set('num', String(num))
    url.searchParams.set('hl', 'zh-TW')

    const resp = await fetch(url.toString())
    if (!resp.ok) {
      const text = await resp.text()
      console.error('Google CSE API error:', resp.status, text)
      // 2026-06-10：把 Google 真實錯誤訊息吐回前端、方便診斷設定問題
      // 常見：API key 沒啟用 Custom Search API / cx(CSE ID) 錯 / key 限制錯 API
      let upstreamMessage = ''
      try { upstreamMessage = JSON.parse(text)?.error?.message || '' } catch { upstreamMessage = text.slice(0, 300) }
      // 2026-06-10 診斷：遮罩顯示 runtime 實際用的 key 前綴 + cx、確認 Vercel env 到底讀到哪把 key
      const keyPreview = apiKey ? `${apiKey.slice(0, 10)}…${apiKey.slice(-4)} (len ${apiKey.length})` : '(empty)'
      return res.status(502).json({
        error: 'upstream_error',
        message: `Google 搜尋 API 錯誤（${resp.status}）：${upstreamMessage || '未知原因'}`,
        upstream_status: resp.status,
        upstream_detail: upstreamMessage,
        debug_key_preview: keyPreview,
        debug_cx: cseId,
      })
    }

    const data = await resp.json()
    const totalResults = parseInt(data?.searchInformation?.totalResults || '0')
    const items = (data?.items || []).map(it => ({
      title: it.title,
      link: it.link,
      snippet: it.snippet,
      displayLink: it.displayLink,
      category: categorizeBrandSource(it.displayLink),
    }))

    return res.status(200).json({
      brand,
      excludeDomain: excludeDomain || null,
      query,
      totalResults,
      items,
      categoryCounts: countByBrandCategory(items),
      recommendation: recommendBrand(totalResults),
    })
  } catch (err) {
    console.error('brand-mentions error:', err)
    return res.status(500).json({ error: 'internal_error', message: String(err.message || err) })
  }
}

// 分類 domain 類型
function categorizeBrandSource(displayLink) {
  if (!displayLink) return 'other'
  const d = displayLink.toLowerCase()
  if (/(udn|ltn|cna|chinatimes|tvbs|ettoday|setn|nownews|storm|cw|bnext|inside|techorange|digitimes|ithome|appledaily|nextapple|epochtimes|epoch|cnabc|cnyes|moneydj)/i.test(d)) return 'news'
  if (/(mobile01|ptt|dcard|gamer\.com\.tw|bahamut|techbang|kocpc|toy-people|niusnews)/i.test(d)) return 'forum'
  if (/(facebook|instagram|twitter|x\.com|threads|tiktok|linkedin|youtube|reddit|medium)/i.test(d)) return 'social'
  if (/(blogspot|wordpress\.com|pixnet|blog\b|substack)/i.test(d)) return 'blog'
  if (/(wikipedia|wikidata|wiktionary)/i.test(d)) return 'wiki'
  return 'other'
}

function countByBrandCategory(items) {
  const counts = { news: 0, forum: 0, social: 0, blog: 0, wiki: 0, other: 0 }
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1
  return counts
}

function recommendBrand(totalResults) {
  if (totalResults === 0) {
    return {
      level: 'critical',
      message: '網路完全沒人提到你的品牌、這是 AI 不推薦你的最大原因。',
      actions: [
        '投新聞稿（中央社 / 聯合新聞網 / TVBS / 中時 / 自由）',
        '鋪論壇話題（Mobile01 / PTT 對應板 / Dcard）',
        '建立 Wikipedia 條目（如果品牌符合條件）',
        '找 KOL 開箱 / 評測',
      ],
    }
  }
  if (totalResults < 10) {
    return {
      level: 'warning',
      message: `只有 ${totalResults} 處提到、外部曝光偏低。`,
      actions: [
        '主動投放 1-2 篇產業媒體（INSIDE / TechOrange / 數位時代）',
        '社群定期發產品/案例分享',
        '經營公司 Wikipedia / Google 商家',
      ],
    }
  }
  if (totalResults < 50) {
    return {
      level: 'fair',
      message: `${totalResults} 處提及、已有起步、但還需要更多元的來源。`,
      actions: [
        '檢查來源是否多元（news / forum / social 都有）',
        '針對缺乏的來源類型補強（例：沒新聞就投稿）',
      ],
    }
  }
  return {
    level: 'good',
    message: `${totalResults} 處提及、外部曝光健康。`,
    actions: [
      '持續維護 — 新聞稿、論壇互動、社群經營',
      '可考慮監測競品提及次數做對比',
    ],
  }
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
