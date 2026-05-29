/**
 * 批次掃描 cron worker — 每 1 分鐘觸發
 *
 * 工作流程：
 *   1. 找所有 status='scanning' 的 jobs
 *   2. 每個 job 領下一批 8 個 pending URLs（標 'scanning' 防別的 tick 重複領）
 *   3. 平行抓 HTML、解析 7 項檢測、寫 findings + 改 status='done'
 *   4. 更新 job 的 scanned_count / failed_count
 *   5. 該 job 沒 pending 了 → 計算 aggregate + 標 status='done' + finished_at
 *
 * Timing：每 URL ~6 秒（fetch + parse），8 個並行 ~7-8 秒。60s timeout 內安全。
 * 200 URLs / 8 per tick = 25 ticks × 1 分鐘 = 25 分鐘掃完。
 *
 * 安全性：endpoint 公開（任何人戳都會跑 worker）— 但 worker 只處理已 queue 的工作，
 *        無法新建 job（只有認證 Pro 用戶能透過 /api/bulk-scan?action=start 建 job），
 *        所以開放沒風險，反而可以加速處理。
 *
 * Env：SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const URLS_PER_TICK = 8
const JOBS_PER_TICK = 3
const FETCH_TIMEOUT_MS = 12000

export const maxDuration = 60

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const startTime = Date.now()

  try {
    const { data: jobs, error: jobsErr } = await supabase
      .from('bulk_scan_jobs')
      .select('id, total_urls, scanned_count, failed_count')
      .eq('status', 'scanning')
      .order('started_at', { ascending: true })
      .limit(JOBS_PER_TICK)

    if (jobsErr) throw new Error(`Failed to list scanning jobs: ${jobsErr.message}`)
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ message: 'No scanning jobs', elapsedMs: Date.now() - startTime })
    }

    const stats = []
    for (const job of jobs) {
      const elapsed = Date.now() - startTime
      if (elapsed > 45000) break

      const result = await processJobTick(supabase, job)
      stats.push(result)
    }

    return res.status(200).json({
      processedJobs: stats.length,
      stats,
      elapsedMs: Date.now() - startTime,
    })

  } catch (err) {
    console.error('cron-bulk-scan error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function processJobTick(supabase, job) {
  const { data: pending, error: pendErr } = await supabase
    .from('bulk_scan_results')
    .select('id, url')
    .eq('job_id', job.id)
    .eq('status', 'pending')
    .limit(URLS_PER_TICK)
  if (pendErr) return { jobId: job.id, error: pendErr.message }

  if (!pending || pending.length === 0) {
    await finalizeJob(supabase, job.id)
    return { jobId: job.id, finalized: true }
  }

  const ids = pending.map(p => p.id)
  await supabase.from('bulk_scan_results').update({ status: 'scanning' }).in('id', ids)

  const settled = await Promise.allSettled(pending.map(p => scanSingleUrl(p)))

  let scanned = 0
  let failed = 0
  const updates = []
  for (let i = 0; i < settled.length; i++) {
    const p = pending[i]
    const s = settled[i]
    if (s.status === 'fulfilled') {
      const r = s.value
      updates.push({
        id: p.id,
        status: r.success ? 'done' : 'failed',
        findings: r.findings,
        http_status: r.httpStatus,
        error_message: r.error,
        scanned_at: new Date().toISOString(),
      })
      if (r.success) scanned++; else failed++
    } else {
      updates.push({
        id: p.id,
        status: 'failed',
        error_message: s.reason?.message || 'Unknown error',
        scanned_at: new Date().toISOString(),
      })
      failed++
    }
  }

  await Promise.all(updates.map(u => {
    const { id, ...fields } = u
    return supabase.from('bulk_scan_results').update(fields).eq('id', id)
  }))

  await supabase.from('bulk_scan_jobs').update({
    scanned_count: job.scanned_count + scanned,
    failed_count: job.failed_count + failed,
  }).eq('id', job.id)

  return { jobId: job.id, scanned, failed, batchSize: pending.length }
}

async function scanSingleUrl({ url }) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIRadarBot/1.0; +https://aark-workspace.vercel.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })

    if (!r.ok) {
      return { success: false, httpStatus: r.status, error: `HTTP ${r.status}`, findings: null }
    }

    const html = await r.text()
    if (!html || html.length < 100) {
      return { success: false, httpStatus: r.status, error: '回應內容過短', findings: null }
    }

    const findings = analyzeArticleHtml(html)
    return { success: true, httpStatus: r.status, error: null, findings }
  } catch (err) {
    return {
      success: false,
      httpStatus: null,
      error: err.name === 'TimeoutError' ? 'Timeout (>12s)' : (err.message || 'Fetch failed'),
      findings: null,
    }
  }
}

// 從 raw HTML 跑 7 項文章層級檢測（regex 為主，避免裝 cheerio 拖慢冷啟動）
function analyzeArticleHtml(html) {
  const problems = []

  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const h1Count = h1Matches.length
  const hasH1 = h1Count > 0
  if (h1Count === 0) problems.push({ id: 'missing_h1', severity: 'high', label: '頁面沒有 H1 標題' })
  else if (h1Count > 1) problems.push({ id: 'multiple_h1', severity: 'medium', label: `頁面有 ${h1Count} 個 H1（應只有 1 個）` })

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const metaTitle = titleMatch ? decodeEntities(titleMatch[1]).trim() : ''
  const metaTitleLen = metaTitle.length
  const hasMetaTitle = metaTitleLen > 0
  if (!hasMetaTitle) problems.push({ id: 'missing_meta_title', severity: 'high', label: '缺 <title> 標題' })
  else if (metaTitleLen < 20) problems.push({ id: 'short_meta_title', severity: 'medium', label: `標題只有 ${metaTitleLen} 字（建議 30-60）` })
  else if (metaTitleLen > 70) problems.push({ id: 'long_meta_title', severity: 'low', label: `標題 ${metaTitleLen} 字過長（建議 30-60，Google SERP 會截斷）` })

  const metaDescMatch = html.match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i)
                     || html.match(/<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i)
  const metaDesc = metaDescMatch ? decodeEntities(metaDescMatch[1]).trim() : ''
  const metaDescLen = metaDesc.length
  const hasMetaDesc = metaDescLen > 0
  if (!hasMetaDesc) problems.push({ id: 'missing_meta_desc', severity: 'high', label: '缺 Meta 描述' })
  else if (metaDescLen < 50) problems.push({ id: 'short_meta_desc', severity: 'medium', label: `Meta 描述只有 ${metaDescLen} 字（建議 70-155）` })
  else if (metaDescLen > 200) problems.push({ id: 'long_meta_desc', severity: 'low', label: `Meta 描述 ${metaDescLen} 字過長（建議 70-155）` })

  const ogTitle = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:title["'][^>]*>/i)
  const ogImage = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*>/i)
  const ogDesc = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:description["'][^>]*>/i)
  const ogComplete = !!(ogTitle && ogImage && ogDesc)
  if (!ogTitle && !ogImage && !ogDesc) problems.push({ id: 'missing_og', severity: 'medium', label: '完全沒有 Open Graph 標籤' })
  else if (!ogComplete) problems.push({ id: 'incomplete_og', severity: 'low', label: 'OG 標籤不完整（缺 title / image / description 其中一個）' })

  const schemaTypes = extractSchemaTypes(html)
  const hasArticleSchema = schemaTypes.includes('Article') || schemaTypes.includes('NewsArticle') || schemaTypes.includes('BlogPosting')
  if (schemaTypes.length === 0) problems.push({ id: 'no_json_ld', severity: 'high', label: '完全沒有 JSON-LD 結構化資料' })
  else if (!hasArticleSchema) problems.push({ id: 'no_article_schema', severity: 'medium', label: `有其他 schema (${schemaTypes.join(', ')}) 但缺 Article schema` })

  const wordCount = roughWordCount(html)
  if (wordCount < 200) problems.push({ id: 'thin_content', severity: 'high', label: `文章內容過少（約 ${wordCount} 字，建議 >300）` })
  else if (wordCount < 300) problems.push({ id: 'short_content', severity: 'low', label: `文章較短（約 ${wordCount} 字，建議 >300）` })

  const canonical = matchAttr(html, /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>/i, 'href')
  const hasCanonical = !!canonical
  if (!hasCanonical) problems.push({ id: 'missing_canonical', severity: 'low', label: '缺 canonical 標籤' })

  return {
    has_h1: hasH1, h1_count: h1Count,
    has_meta_title: hasMetaTitle, meta_title_len: metaTitleLen,
    has_meta_desc: hasMetaDesc, meta_desc_len: metaDescLen,
    has_og: !!(ogTitle || ogImage || ogDesc), og_complete: ogComplete,
    schema_types: schemaTypes,
    has_article_schema: hasArticleSchema,
    word_count: wordCount,
    has_canonical: hasCanonical,
    problems,
  }
}

function matchAttr(html, tagRe, attr = 'content') {
  const m = html.match(tagRe)
  if (!m) return null
  const inner = m[0]
  const ar = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i')
  const am = inner.match(ar)
  return am ? decodeEntities(am[1]).trim() : null
}

function extractSchemaTypes(html) {
  const scripts = html.match(/<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  const types = new Set()
  for (const s of scripts) {
    const inner = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '').trim()
    try {
      const parsed = JSON.parse(inner)
      collectTypes(parsed, types)
    } catch { /* 壞 JSON 跳過 */ }
  }
  return Array.from(types)
}

function collectTypes(node, set) {
  if (!node) return
  if (Array.isArray(node)) { for (const n of node) collectTypes(n, set); return }
  if (typeof node === 'object') {
    if (node['@type']) {
      if (Array.isArray(node['@type'])) node['@type'].forEach(t => set.add(t))
      else set.add(node['@type'])
    }
    if (node['@graph']) collectTypes(node['@graph'], set)
  }
}

function roughWordCount(html) {
  const noScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  const noStyles = noScripts.replace(/<style[\s\S]*?<\/style>/gi, '')
  const text = noStyles.replace(/<[^>]+>/g, ' ')
  const chineseChars = (text.match(/[一-龥]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return chineseChars + englishWords
}

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

async function finalizeJob(supabase, jobId) {
  const { data: results } = await supabase
    .from('bulk_scan_results')
    .select('url, status, findings')
    .eq('job_id', jobId)
    .in('status', ['done', 'failed'])

  const aggregate = computeAggregate(results || [])

  await supabase.from('bulk_scan_jobs').update({
    status: 'done',
    finished_at: new Date().toISOString(),
    aggregate,
  }).eq('id', jobId)
}

function computeAggregate(results) {
  const byType = {}
  const offenders = []

  for (const r of results) {
    if (r.status === 'failed' || !r.findings) continue
    const probs = r.findings.problems || []
    for (const p of probs) {
      byType[p.id] = (byType[p.id] || 0) + 1
    }
    if (probs.length > 0) {
      offenders.push({ url: r.url, problemCount: probs.length, severity: maxSeverity(probs) })
    }
  }

  offenders.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 }
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
    return b.problemCount - a.problemCount
  })

  return {
    problems_by_type: byType,
    top_offenders: offenders.slice(0, 10),
    total_results: results.length,
    total_with_problems: offenders.length,
  }
}

function maxSeverity(problems) {
  const levels = problems.map(p => p.severity)
  if (levels.includes('high')) return 'high'
  if (levels.includes('medium')) return 'medium'
  return 'low'
}
