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
// Free 用戶 sample 模式可掃幾篇 — 數字夠小才有「升級就能解鎖全部」的鉤子
// 3 篇足以讓用戶看到真實 problem 列表 + 跟 487 篇對比有強烈落差感
const FREE_SAMPLE_SIZE = 3

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
  /\.(kml|xml|json|rss|atom)$/i,         // 外掛自動產出的非 HTML 檔（Rank Math Local SEO 的 locations.kml 等）
  // ↓ 2026-06-12 首頁連結後備路線實測補的（52jcdesign.com / Joomla 案例）
  /\/cdn-cgi\//i,                        // Cloudflare 內部連結（email-protection 等）
  /\/component\/users\//i,               // Joomla 使用者頁（login / profile）
  /\/(login|logout|register|signin|sign-in|cart|checkout|my-account)\/?$/i,  // 各平台登入/購物車類功能頁
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

  // 模式：'sample'（Free 試掃 3 篇）/ 'full'（Pro 完整 200 篇）
  // Free 強制 sample；Pro 預設 full、但也可指定 sample（沒意義但不擋）
  const requestedMode = req.body?.mode === 'sample' ? 'sample' : 'full'

  const { data: profile } = await supabase
    .from('profiles').select('is_pro, is_trial').eq('id', userId).maybeSingle()
  const isProOrTrial = !!profile?.is_pro || !!profile?.is_trial

  // Free → 強制 sample；Pro 用 requested
  const kind = isProOrTrial ? requestedMode : 'sample'

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

  // Free 用戶限制：同一網站只能跑 1 次 sample（防刷 + 想試更多就升級）
  // Pro 跳過此檢查（已 Pro 之後可以無限次 full scan）
  if (kind === 'sample' && !isProOrTrial) {
    const { data: prevSample } = await supabase
      .from('bulk_scan_jobs').select('id').eq('website_id', websiteId).eq('kind', 'sample').limit(1).maybeSingle()
    if (prevSample) {
      return res.status(403).json({
        error: 'sample_quota_exhausted',
        message: '此網站的免費試掃已用過。想看更多文章 → 升級 Pro 解鎖全部',
        previousJobId: prevSample.id,
      })
    }
  }

  // 建 job — 帶 kind 標記
  const { data: job, error: jobErr } = await supabase
    .from('bulk_scan_jobs')
    .insert({ user_id: userId, website_id: websiteId, status: 'discovering', kind })
    .select('id').single()
  if (jobErr) return res.status(500).json({ error: 'Failed to create job', detail: jobErr.message })

  let urls
  let discoveryMethod = 'sitemap'
  try {
    const discovery = await discoverSitemapUrls(website.url)
    urls = discovery.urls
    discoveryMethod = discovery.method
  } catch (e) {
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: `Sitemap 發現失敗：${e.message}`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(502).json({ error: 'Sitemap discovery failed', detail: e.message, jobId: job.id })
  }

  if (urls.length === 0) {
    // 走到這裡代表 sitemap 或首頁連結「有抓到」、但過濾掉封存頁/附件後一篇可掃的都不剩
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: 'sitemap／首頁連結有抓到、但過濾掉分類頁／標籤頁／附件後沒有可掃的文章 URL — 網站可能還沒有發布任何文章',
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(404).json({
      error: 'No scannable URLs found',
      hint: 'sitemap／首頁連結有抓到、但過濾後沒有可掃的文章 URL — 確認網站已發布文章',
      jobId: job.id,
    })
  }

  // 依模式決定要 queue 幾篇
  // sample：取 3 篇（先依 lastmod 倒序的前 3，這 3 篇通常是最近更新的、最值得修）
  // full：取最多 200 篇
  const cap = kind === 'sample' ? FREE_SAMPLE_SIZE : MAX_URLS_PER_JOB
  const discoveredCount = urls.length
  const queuedUrls = urls.slice(0, cap)
  const capped = discoveredCount - queuedUrls.length

  const rows = queuedUrls.map(u => ({ job_id: job.id, url: u, status: 'pending' }))
  const { error: insertErr } = await supabase.from('bulk_scan_results').insert(rows)
  if (insertErr) {
    await supabase.from('bulk_scan_jobs').update({
      status: 'failed',
      error_message: `Queue 寫入失敗：${insertErr.message}`,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id)
    return res.status(500).json({ error: 'Failed to queue URLs', detail: insertErr.message })
  }

  await supabase.from('bulk_scan_jobs').update({
    status: 'scanning',
    total_urls: queuedUrls.length,
    discovered_count: discoveredCount,
    capped,
  }).eq('id', job.id)

  return res.status(200).json({
    success: true,
    jobId: job.id,
    kind,
    discoveredCount,
    totalUrls: queuedUrls.length,
    capped,
    // 'sitemap' | 'homepage_links' — 後者代表網站沒 sitemap、是用首頁連結湊的清單（前端提示補 sitemap）
    discoveryMethod,
    estimatedMinutes: Math.max(1, Math.ceil(queuedUrls.length / 8)),
  })
}

// ─────────────── status: 給前端 polling 進度 ───────────────

async function handleStatus(req, res, supabase, userId) {
  const jobId = req.query.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId is required' })

  const { data: job, error } = await supabase
    .from('bulk_scan_jobs')
    .select('id, status, kind, total_urls, discovered_count, scanned_count, failed_count, capped, started_at, finished_at, error_message')
    .eq('id', jobId).eq('user_id', userId).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!job) return res.status(404).json({ error: 'Job not found' })

  return res.status(200).json(job)
}

// ─────────────── results: 完成後拉全部 results + aggregate ───────────────

async function handleResults(req, res, supabase, userId) {
  const jobId = req.query.jobId
  if (!jobId) return res.status(400).json({ error: 'jobId is required' })

  const { data: job, error: jobErr } = await supabase
    .from('bulk_scan_jobs').select('id, status, kind, aggregate, capped, total_urls, discovered_count, scanned_count, failed_count, started_at, finished_at').eq('id', jobId).eq('user_id', userId).maybeSingle()
  if (jobErr) return res.status(500).json({ error: jobErr.message })
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const { data: results, error: resErr } = await supabase
    .from('bulk_scan_results')
    .select('url, status, findings, http_status, error_message, scanned_at')
    .eq('job_id', jobId)
    .order('scanned_at', { ascending: true, nullsFirst: false })
    .limit(500)
  if (resErr) return res.status(500).json({ error: resErr.message })

  // ⚠️ 不要相信 job.aggregate（可能 finalize 時還有 row 在 'scanning' → 統計不準）
  // 每次 results 請求都用「當前所有 done/failed row 即時重算」— 永遠跟畫面一致
  const freshAggregate = computeAggregateFresh(results || [])
  return res.status(200).json({
    job: { ...job, aggregate: freshAggregate },
    results,
  })
}

// 重算 aggregate — 邏輯跟 cron-bulk-scan.js 的 computeAggregate 一致
// 重複實作而非 import：避免 api/ 跨檔 import 麻煩，也讓 fix 可以 hot-reload
function computeAggregateFresh(results) {
  const byType = {}
  const offenders = []
  let doneCount = 0

  for (const r of results) {
    if (!r.findings) continue
    doneCount++
    const probs = r.findings.problems || []
    for (const p of probs) {
      byType[p.id] = (byType[p.id] || 0) + 1
    }
    if (probs.length > 0) {
      const sevOrder = { high: 0, medium: 1, low: 2 }
      const maxSev = probs.map(p => p.severity).sort((a, b) => sevOrder[a] - sevOrder[b])[0] || 'low'
      offenders.push({ url: r.url, problemCount: probs.length, severity: maxSev })
    }
  }

  offenders.sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 }
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
    return b.problemCount - a.problemCount
  })

  return {
    problems_by_type: byType,
    top_offenders: offenders.slice(0, 20),
    total_results: doneCount,
    total_with_problems: offenders.length,
  }
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
// 模擬完整 Chrome 瀏覽器 headers — 對付 mod_security / Cloudflare / WAF
// 之前用 'AIRadarBot/1.0' 簡單 UA 會被 kimbo3899 那類 mod_security 站擋 406
// 同款設定參考 api/fetch-url.js 的 CHROME_HEADERS
const SITEMAP_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/xml,application/xml,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
}

// 多輪 UA fallback — 對付 Vercel function 連續打多次後被 mod_security rate-limit
// 第一輪被擋就換 Googlebot（多數 SEO-friendly 站歡迎）、再不行換 Bingbot
const UA_FALLBACK_CHAIN = [
  { name: 'Chrome',    ua: SITEMAP_FETCH_HEADERS['User-Agent'], headers: SITEMAP_FETCH_HEADERS },
  { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/xml,application/xml,*/*' } },
  { name: 'Bingbot',   ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',  'Accept': 'text/xml,application/xml,*/*' } },
]

// 抓 URL、若被擋（4xx/5xx）自動換下一個 UA 重試、最多 3 輪
async function fetchWithUaFallback(url, signal) {
  let lastError = null
  for (const { name, headers } of UA_FALLBACK_CHAIN) {
    try {
      const r = await fetch(url, { headers, signal })
      if (r.ok) return r
      // anti-bot 常見回應：406 / 403 / 429 → 換下一個 UA
      if ([406, 403, 429, 503].includes(r.status)) {
        lastError = `${name}: HTTP ${r.status}`
        continue
      }
      // 其他 status code（如 404 真的沒檔案）直接返回、不重試
      return r
    } catch (err) {
      lastError = `${name}: ${err.message}`
      // network error / timeout、繼續試下一個 UA
    }
  }
  throw new Error(`All UA attempts failed: ${lastError}`)
}

// Timeout 從 15s 拉到 25s（2026-06-05）— 慢主機友善、跟 article fetch 一致
const SITEMAP_FETCH_TIMEOUT_MS = 25000

// 從 robots.txt 抽出 `Sitemap: <url>` 指令的所有 URL（SEO 業界標準路徑、2026-06-05 加）
// kimbo3899 / 一般 WP+Yoast/Rank Math 站幾乎都會在 robots.txt 寫 Sitemap 指令
async function discoverSitemapsFromRobotsTxt(origin) {
  try {
    const r = await fetchWithUaFallback(origin + '/robots.txt', AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS))
    if (!r.ok) return []
    const text = await r.text()
    const sitemapUrls = []
    // robots.txt 規格：`Sitemap: <url>` 一行一個、大小寫不敏感
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i)
      if (m && m[1]) sitemapUrls.push(m[1].trim())
    }
    return sitemapUrls
  } catch {
    return []
  }
}

async function discoverSitemapUrls(siteUrl) {
  const origin = new URL(siteUrl).origin   // e.g. https://kimbo3899.com.tw

  // 1. 先從 /robots.txt 抓 Sitemap 指令（SEO 業界標準、優先級最高）
  const robotsSitemaps = await discoverSitemapsFromRobotsTxt(origin)

  // 2. 候選路徑清單從 3 個擴充到 8 個（2026-06-05）— 涵蓋 WP / Yoast / Rank Math / 自訂變體
  const hardCodedCandidates = [
    '/sitemap_index.xml',          // Yoast / Rank Math 預設
    '/wp-sitemap.xml',             // WordPress core 5.5+
    '/sitemap.xml',                // 通用 / 單一 sitemap
    '/sitemap-index.xml',          // 變體（用 dash 不是底線）
    '/sitemaps.xml',               // 複數變體
    '/sitemap1.xml',               // 編號變體
    '/post-sitemap.xml',           // Yoast 文章 sitemap 直連
    '/wp-sitemap-posts-post-1.xml', // WP core 文章 sitemap 第 1 頁直連
  ]

  // robots.txt 找到的優先試、再試 hard-coded、去重
  const allCandidates = [
    ...robotsSitemaps,
    ...hardCodedCandidates.map(p => origin + p),
  ].filter((url, i, arr) => arr.indexOf(url) === i) // 去重

  // 嘗試找有效 sitemap、失敗一輪後等 3 秒重試一次（2026-06-05）
  // 應付 mod_security 暫時 throttle（通常 < 5 秒就過）
  let xml = null
  let foundAt = null

  for (let attempt = 0; attempt < 2 && !xml; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    for (const url of allCandidates) {
      try {
        const r = await fetchWithUaFallback(url, AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS))
        if (r.ok) {
          const text = await r.text()
          // 簡易驗證確實是 XML 而非 404 HTML（有些主機 404 也回 200）
          if (text.includes('<urlset') || text.includes('<sitemapindex')) {
            xml = text
            foundAt = url
            break
          }
        }
      } catch { /* 試下一個 */ }
    }
  }

  if (!xml) {
    // ─── 後備路線（2026-06-12）：sitemap 全滅 → 改爬首頁站內連結 ───
    // 適用：沒 sitemap 的 Joomla / 自架 / AI 生成靜態站（實案：52jcdesign.com，Joomla 無 OSMap）
    // 只爬首頁一層（function 時限內最安全），抓到的是導覽列 + 首頁列表連結 — 不如 sitemap 全
    // 但「能掃部分」遠勝「直接失敗」；UI 會提示用戶補 sitemap
    let fallbackUrls = []
    try {
      fallbackUrls = await discoverUrlsFromHomepage(siteUrl)
    } catch { /* fallback 失敗就走原本的 throw */ }
    if (fallbackUrls.length > 0) {
      return { urls: fallbackUrls, method: 'homepage_links' }
    }

    const robotsHint = robotsSitemaps.length > 0
      ? `（robots.txt 內找到 ${robotsSitemaps.length} 個 Sitemap 指令但都抓不到 — 可能被 anti-bot 擋）`
      : '（robots.txt 內也沒寫 Sitemap 指令）'
    // 修法提示分平台寫 — 不只 WordPress（2026-06-12：原文案太 WP 本位，Joomla/靜態站用戶看了沒用）
    throw new Error(
      `已試 ${allCandidates.length} 個 sitemap 路徑都找不到有效 XML${robotsHint}，改抓首頁連結也沒有收穫。` +
      `修法依平台：WordPress → 裝 Rank Math / Yoast 並開啟 sitemap（WP 5.5+ 內建 /wp-sitemap.xml）；` +
      `Joomla → 裝 OSMap 擴充套件；Shopify / Wix → 內建 /sitemap.xml、抓不到通常是被防火牆擋；` +
      `自架或 AI 生成的靜態站 → 手動產一份 sitemap.xml 上傳到網站根目錄。` +
      `完成後建議在 robots.txt 加一行「Sitemap: 你的sitemap網址」`
    )
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
        const r = await fetchWithUaFallback(url, AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS))
        if (!r.ok) return []
        const sub = await r.text()
        return extractUrlsWithMeta(sub)
      }))
      for (const r of results) {
        if (r.status === 'fulfilled') allEntries.push(...r.value)
      }
    }
    return { urls: filterAndSort(allEntries), method: 'sitemap' }
  }

  // 單一 sitemap → 直接解析
  return { urls: filterAndSort(extractUrlsWithMeta(xml)), method: 'sitemap' }
}

// ─── Sitemap 全滅時的後備探索（2026-06-12） ───
// 抓首頁 HTML、收集同網域的站內連結當掃描清單。
// 只爬一層：Vercel function 時限內最安全；深爬交給未來版本（若需求出現）。
// 雜訊過濾沿用 URL_BLACKLIST_PATTERNS（tag/category/feed/附件等），與 sitemap 路線同標準。
async function discoverUrlsFromHomepage(siteUrl) {
  const origin = new URL(siteUrl).origin
  const r = await fetchWithUaFallback(origin + '/', AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS))
  if (!r.ok) return []
  const html = await r.text()

  // 抓所有 <a href="...">；排除頁內錨點（#）、mailto/tel/javascript
  const tagMatches = html.match(/<a\s[^>]*href\s*=\s*["'][^"']+["']/gi) || []
  const entries = []
  const seen = new Set()
  for (const tag of tagMatches) {
    const m = tag.match(/href\s*=\s*["']([^"']+)["']/i)
    if (!m) continue
    const raw = m[1].trim()
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) continue
    let u
    try { u = new URL(raw, origin + '/') } catch { continue }
    if (u.origin !== origin) continue            // 只收站內連結
    if (!/^https?:$/.test(u.protocol)) continue
    u.hash = ''                                   // 去頁內錨點、其餘保留（含 query，照顧 ?p=123 型 permalink）
    const clean = u.toString()
    if (seen.has(clean)) continue
    seen.add(clean)
    entries.push({ url: clean, lastmod: null })   // 首頁連結沒有 lastmod、排序維持頁面出現順序
  }
  return filterAndSort(entries)
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
