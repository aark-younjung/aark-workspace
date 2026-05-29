/**
 * 批次文章掃描 API（Pro 限定）
 *
 * 單一 endpoint 用 ?action= 路由，避免吃掉 Vercel Hobby 12 函數上限
 *
 * Actions：
 *   POST ?action=start    {websiteId}                → 建 job + 抓 sitemap + queue URLs，回 {jobId, totalUrls, capped}
 *   GET  ?action=status   ?jobId=xxx                 → job 進度（給前端 poll）
 *   GET  ?action=results  ?jobId=xxx                 → 完成後拉全部 results + aggregate
 *   POST ?action=cancel   {jobId}                    → 用戶取消還在跑的 job
 *
 * Auth：Headers `Authorization: Bearer <supabase_access_token>`，且必須是 is_pro 或 is_trial
 *
 * Env：
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *
 * Worker：本檔只負責 discover + queue。實際 per-URL fetch + check 由 api/cron-bulk-scan.js 每分鐘跑一次
 */

import { createClient } from '@supabase/supabase-js'

// Pro 單次掃描上限（避免單一用戶長時間佔 cron + Vercel function 配額）
const MAX_URLS_PER_JOB = 200

// 過濾 sitemap 抓到的 URL — 這些路徑通常不是「文章」而是 archive / admin / feed，掃了浪費
const URL_BLACKLIST_PATTERNS = [
  /\/wp-admin\//i,
  /\/wp-login/i,
  /\/wp-json\//i,
  /\/wp-content\/uploads\//i,    // 直接連附件圖
  /\/tag\//i,                    // 標籤封存頁
  /\/category\//i,               // 分類封存頁
  /\/author\//i,                 // 作者封存頁
  /\/feed\/?$/i,                 // RSS feed
  /\/comments\/feed/i,
  /\/page\/\d+\/?$/i,            // 分頁（/page/2/, /page/3/ ...）
  /\.(jpg|jpeg|png|gif|webp|pdf|zip|mp4)$/i,
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server missing Supabase env vars' })
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 守衛：必須帶 Supabase Bearer token，否則任何人都能戳 API 燒 fetch + DB 配額
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' })
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authUser) return res.status(401).json({ error: 'Invalid or expired token' })

  const action = req.query.action || req.body?.action
  if (!action) return res.status(400).json({ error: 'action is required' })

  try {
    if (action === 'start') return await handleStart(req, res, supabase, authUser.id)
    if (action === 'status') return await handleStatus(req, res, supabase, authUser.id)
    if (action === 'results') return await handleResults(req, res, supabase, authUser.id)
    if (action === 'cancel') return await handleCancel(req, res, supabase, authUser.id)
    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('bulk-scan error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ─────────────── start: discover sitemap + queue URLs ───────────────

async function handleStart(req, res, supabase, userId) {
  const websiteId = req.body?.websiteId
  if (!websiteId) return res.status(400).json({ error: 'websiteId is required' })

  // Pro / Trial 守衛 — 批次掃描是 Pro 殺手鐧、不開放免費用戶
  const { data: profile } = await supabase
    .from('profiles').select('is_pro, is_trial').eq('id', userId).maybeSingle()
  if (!profile?.is_pro && !profile?.is_trial) {
    return res.status(403).json({ error: '批次文章掃描為 Pro 功能，請升級或啟用 7 天免費試用' })
  }

  // 用戶只能掃自己的網站
  const { data: website, error: webErr } = await supabase
    .from('websites').select('id, url, user_id').eq('id', websiteId).eq('user_id', userId).maybeSingle()
  if (webErr || !website) return res.status(404).json({ error: 'Website not found or not owned by user' })

  // 同一網站只允許 1 個 active job（避免重複觸發）
  const { data: existing } = await supabase
    .from('bulk_scan_jobs').select('id, status')
    .eq('website_id', websiteId)
    .in('status', ['pending', 'discovering', 'scanning'])
    .maybeSingle()
  if (existing) {
    return res.status(409).json({ error: '此網站已有進行中的批次掃描', jobId: existing.id, status: existing.status })
  }

  // 建 job（先標 discovering，discover 失敗就改 failed）
  const { data: job, error: jobErr } = await supabase
    .from('bulk_scan_jobs')
    .insert({ user_id: userId, website_id: websiteId, status: 'discovering' })
    .select('id').single()
  if (jobErr) return res.status(500).json({ error: 'Failed to create job', detail: jobErr.message })

  // sitemap discovery（同步跑，因為 user 等著看結果；通常 < 5 秒）
  let urls
  try {
    urls = await discoverSitemapUrls(website.url)
  } catch (e) {
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: `Sitemap 發現失敗：${e.message}`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(502).json({ error: 'Sitemap discovery failed', detail: e.message, jobId: job.id })
  }

  if (urls.length === 0) {
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: '在你的網站找不到 sitemap.xml — 請先確認 SEO 外掛（Yoast / Rank Math）有開啟產生 sitemap',
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(404).json({
      error: 'No sitemap URLs found',
      hint: '請確認網站根目錄有 sitemap.xml、或 Yoast/Rank Math 已啟用 sitemap',
      jobId: job.id,
    })
  }

  // 截掉 Pro 上限以上的、記下截掉幾筆
  const totalUrls = urls.length
  const cappedUrls = urls.slice(0, MAX_URLS_PER_JOB)
  const capped = totalUrls - cappedUrls.length

  // queue 進 bulk_scan_results — 用 upsert + ignoreDuplicates 防 sitemap 重複 URL 撞 unique 索引
  const rows = cappedUrls.map(u => ({ job_id: job.id, url: u, status: 'pending' }))
  // Supabase 一次 insert 上限 1000，200 在範圍內
  const { error: insertErr } = await supabase.from('bulk_scan_results').insert(rows)
  if (insertErr) {
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: `Queue 寫入失敗：${insertErr.message}`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(500).json({ error: 'Failed to queue URLs', detail: insertErr.message })
  }

  // 切到 scanning，cron worker 下次觸發就會領 pending 來跑
  await supabase.from('bulk_scan_jobs').update({
    status: 'scanning',
    total_urls: cappedUrls.length,
    capped,
  }).eq('id', job.id)

  return res.status(200).json({
    success: true,
    jobId: job.id,
    totalUrls: cappedUrls.length,
    capped,                                  // 截掉幾筆（> 0 代表你網站文章超過 200，這次只掃前 200）
    estimatedMinutes: Math.ceil(cappedUrls.length / 8),  // 每分鐘 8 篇
  })
}

// ─────────────── status: 給前端 polling 進度 ───────────────

async function handleStatus(req, res, supabase, userId) {
  const jobId = req.query.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId is required' })

  const { data: job, error } = await supabase
    .from('bulk_scan_jobs')
    .select('id, status, total_urls, scanned_count, failed_count, capped, started_at, finished_at, error_message')
    .eq('id', jobId).eq('user_id', userId).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!job) return res.status(404).json({ error: 'Job not found' })

  return res.status(200).json(job)
}

// ─────────────── results: 完成後拉全部 results + aggregate ───────────────

async function handleResults(req, res, supabase, userId) {
  const jobId = req.query.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId is required' })

  // 先確認 job 是這個用戶的（避免別人猜 jobId 拉資料）
  const { data: job, error: jobErr } = await supabase
    .from('bulk_scan_jobs').select('id, status, aggregate').eq('id', jobId).eq('user_id', userId).maybeSingle()
  if (jobErr) return res.status(500).json({ error: jobErr.message })
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const { data: results, error: resErr } = await supabase
    .from('bulk_scan_results')
    .select('url, status, findings, http_status, error_message, scanned_at')
    .eq('job_id', jobId)
    .order('scanned_at', { ascending: true, nullsFirst: false })
    .limit(500)
  if (resErr) return res.status(500).json({ error: resErr.message })

  return res.status(200).json({ job, results })
}

// ─────────────── cancel: 用戶手動取消 ───────────────

async function handleCancel(req, res, supabase, userId) {
  const jobId = req.body?.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId is required' })

  const { error } = await supabase
    .from('bulk_scan_jobs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('id', jobId).eq('user_id', userId).in('status', ['pending', 'discovering', 'scanning'])
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ success: true })
}

// ─────────────── sitemap 發現邏輯 ───────────────

/**
 * 嘗試從以下順序抓 sitemap：
 *   1. /sitemap_index.xml  (Yoast / Rank Math 通常用這個)
 *   2. /wp-sitemap.xml     (WordPress core)
 *   3. /sitemap.xml        (通用 / 單一 sitemap)
 *
 * 如果抓到的是「sitemap index」（含 <sitemapindex>），遞迴抓所有子 sitemap
 * 最後過濾雜訊 URL + 依 <lastmod> 倒序排（沒 lastmod 就維持 sitemap 順序）
 */
async function discoverSitemapUrls(siteUrl) {
  const origin = new URL(siteUrl).origin   // e.g. https://kimbo3899.com.tw
  const candidates = ['/sitemap_index.xml', '/wp-sitemap.xml', '/sitemap.xml']

  let xml = null
  let foundAt = null
  for (const path of candidates) {
    try {
      const r = await fetch(origin + path, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIRadarBot/1.0; +https://aark-workspace.vercel.app)' },
        signal: AbortSignal.timeout(15000),
      })
      if (r.ok) {
        const text = await r.text()
        // 簡易驗證確實是 XML 而非 404 HTML（有些主機 404 也回 200）
        if (text.includes('<urlset') || text.includes('<sitemapindex')) {
          xml = text
          foundAt = path
          break
        }
      }
    } catch { /* 試下一個 */ }
  }

  if (!xml) {
    throw new Error('在 /sitemap_index.xml、/wp-sitemap.xml、/sitemap.xml 都找不到有效 sitemap')
  }

  // 如果是 sitemap index → 抓所有子 sitemap 的 URL 集合 union
  if (xml.includes('<sitemapindex')) {
    const childSitemaps = extractLocs(xml)
    const allEntries = []
    // 最多並行抓 8 個子 sitemap 避免阻塞
    const batches = []
    for (let i = 0; i < childSitemaps.length; i += 8) {
      batches.push(childSitemaps.slice(i, i + 8))
    }
    for (const batch of batches) {
      const results = await Promise.allSettled(batch.map(async (url) => {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIRadarBot/1.0)' },
          signal: AbortSignal.timeout(15000),
        })
        if (!r.ok) return []
        const sub = await r.text()
        return extractUrlsWithMeta(sub)
      }))
      for (const r of results) {
        if (r.status === 'fulfilled') allEntries.push(...r.value)
      }
    }
    return filterAndSort(allEntries)
  }

  // 單一 sitemap → 直接解析
  return filterAndSort(extractUrlsWithMeta(xml))
}

// 從 sitemap XML 抽出所有 <loc>...</loc> 內容
function extractLocs(xml) {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) || []
  return matches.map(m => m.replace(/<\/?loc>/g, '').trim())
}

// 從 urlset XML 抽出 [{url, lastmod}] — 比上面多帶 lastmod 給排序用
function extractUrlsWithMeta(xml) {
  const entries = []
  // 切成 <url>...</url> 區塊，個別解析
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || []
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/)
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/)
    if (locMatch) {
      entries.push({
        url: locMatch[1].trim(),
        lastmod: lastmodMatch ? lastmodMatch[1].trim() : null,
      })
    }
  }
  return entries
}

// 過濾雜訊 URL + 依 lastmod 倒序排
function filterAndSort(entries) {
  const filtered = entries.filter(({ url }) => {
    if (!url) return false
    return !URL_BLACKLIST_PATTERNS.some(re => re.test(url))
  })

  // 依 lastmod 倒序（最新的文章先掃）— 沒 lastmod 的丟最後
  filtered.sort((a, b) => {
    if (!a.lastmod && !b.lastmod) return 0
    if (!a.lastmod) return 1
    if (!b.lastmod) return -1
    return b.lastmod.localeCompare(a.lastmod)
  })

  // 去重（不同 sitemap 可能列重複 URL）
  const seen = new Set()
  const unique = []
  for (const { url } of filtered) {
    if (!seen.has(url)) {
      seen.add(url)
      unique.push(url)
    }
  }
  return unique
}
