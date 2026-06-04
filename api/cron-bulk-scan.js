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
  // (a) Stale recovery：把 status='scanning' 超過 3 分鐘的 row 重設為 pending
  //     避免前一個 worker timeout 沒寫回 → row 永遠卡 'scanning' 拿不下去
  //     3 分鐘是「正常 8 並行 fetch 12s timeout × 安全係數 15」估算
  const staleCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString()
  await supabase
    .from('bulk_scan_results')
    .update({ status: 'pending', error_message: 'recovered from stale scanning' })
    .eq('job_id', job.id)
    .eq('status', 'scanning')
    .lt('scanned_at', staleCutoff)   // scanned_at = null 不會 match，沒問題的 row 不會被誤改

  // (b) 領 pending
  const { data: pending, error: pendErr } = await supabase
    .from('bulk_scan_results')
    .select('id, url')
    .eq('job_id', job.id)
    .eq('status', 'pending')
    .limit(URLS_PER_TICK)
  if (pendErr) return { jobId: job.id, error: pendErr.message }

  // 沒 pending 不代表可以 finalize — 還可能有 'scanning' row 還在跑
  // 只有「所有 row 都 done/failed」才該 finalize（檢查 scanning 數量）
  if (!pending || pending.length === 0) {
    const { count: stillScanning } = await supabase
      .from('bulk_scan_results')
      .select('id', { count: 'exact', head: true })
      .eq('job_id', job.id)
      .eq('status', 'scanning')
    if ((stillScanning || 0) === 0) {
      await finalizeJob(supabase, job.id)
      return { jobId: job.id, finalized: true }
    }
    // 還有 scanning row 在跑 → 下次再來看
    return { jobId: job.id, waitingForScanning: stillScanning }
  }

  const ids = pending.map(p => p.id)
  // 同時設 scanned_at = now 用來給 stale recovery 判斷「卡多久」
  await supabase.from('bulk_scan_results').update({
    status: 'scanning',
    scanned_at: new Date().toISOString(),
  }).in('id', ids)

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

// 跟 sitemap discovery 同款 Chrome headers — 對付 mod_security / Cloudflare / WAF
// 之前用簡單 'AIRadarBot/1.0' UA 會被部分主機（如 kimbo3899 Apache + mod_security）擋 406
const ARTICLE_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

async function scanSingleUrl({ url }) {
  try {
    const r = await fetch(url, {
      headers: ARTICLE_FETCH_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })

    if (!r.ok) {
      return { success: false, httpStatus: r.status, error: `HTTP ${r.status}`, findings: null }
    }

    // Content-type 檢查：跳過 XML / KML / JSON / RSS 等非 HTML — sitemap 偶爾會混入這類 URL（如 Rank Math Local SEO 的 /locations.kml）
    // 對它們跑 HTML 分析會產出垃圾 finding（缺 H1 / 缺 title 等、實際無意義）
    const ct = (r.headers.get('content-type') || '').toLowerCase()
    if (ct && !ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return {
        success: true,
        httpStatus: r.status,
        error: null,
        findings: {
          page_type: 'non-html',
          content_type: ct,
          problems: [],
          wp_admin_hint: detectWpAdminHint(url, 'non-html'),
        },
      }
    }

    const html = await r.text()
    if (!html || html.length < 100) {
      return { success: false, httpStatus: r.status, error: '回應內容過短', findings: null }
    }

    const findings = analyzeArticleHtml(html, url)
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

// 偵測頁面類型 — 用 schema + URL 兩種訊號交叉判斷
// 'product' / 'article' / 'service' / 'local-business' / 'homepage' / 'unknown'
// 為了避免「商品頁被報缺 Article schema」這種誤判
function detectPageType(schemaTypes, url) {
  const urlLower = (url || '').toLowerCase()

  // URL pattern matching（最強訊號）
  if (/\/(product|products|shop|store|item|goods)\//i.test(urlLower)) return 'product'
  if (/\/(blog|article|news|post|posts)\//i.test(urlLower)) return 'article'
  // 首頁判斷：URL 路徑空或只有 /
  try {
    const u = new URL(url)
    if (u.pathname === '/' || u.pathname === '') return 'homepage'
  } catch { /* invalid url */ }

  // Schema-based fallback（URL 沒線索時）
  if (schemaTypes.includes('Product') || schemaTypes.includes('ProductGroup')) return 'product'
  if (schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting') || schemaTypes.includes('NewsArticle')) return 'article'
  if (schemaTypes.includes('Service')) return 'service'
  // LocalBusiness 在「沒其他內容類 schema」時才當主要類型
  // （很多店家在所有頁面都掛 LocalBusiness、不能當判斷依據）
  const hasContentSchema = schemaTypes.some(t => ['Product', 'Article', 'BlogPosting', 'NewsArticle', 'Service', 'Event', 'Course', 'JobPosting', 'Recipe'].includes(t))
  if (!hasContentSchema && (schemaTypes.includes('LocalBusiness') || schemaTypes.includes('AutomotiveBusiness'))) return 'local-business'

  return 'unknown'
}

// 從 raw HTML 跑 7 項文章層級檢測（regex 為主，避免裝 cheerio 拖慢冷啟動）
function analyzeArticleHtml(html, url) {
  const problems = []

  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const h1Count = h1Matches.length
  // 每個 H1 拆出純文字內文，做分類（empty / sentence / short）+ 給建議動作（keep / change_to_p / change_to_h2 / delete）
  // 排序規則：第 1 個 H1 預設保留（多半是主題模板渲染的主標題或文章首個標題），後續才標建議修法
  const h1Details = h1Matches.map((tag, idx) => {
    const inner = tag.replace(/<h1\b[^>]*>/i, '').replace(/<\/h1>/i, '')
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')).trim()
    const len = text.length
    let kind, suggestedAction, reason
    if (len === 0) {
      kind = 'empty'
      suggestedAction = 'delete'
      reason = '空 H1，多半是 page builder 殘留，直接整行刪'
    } else if (len > 30) {
      kind = 'sentence'
      suggestedAction = idx === 0 ? 'keep' : 'change_to_p'
      reason = idx === 0 ? '主要 H1（保留）' : '句子型內容，不是標題 → 改 <p>'
    } else {
      kind = 'short'
      suggestedAction = idx === 0 ? 'keep' : 'change_to_h2'
      reason = idx === 0 ? '主要 H1（保留）' : '短副標題 → 改 <h2>'
    }
    return { index: idx + 1, text: text.slice(0, 200), full_length: len, kind, suggested_action: suggestedAction, reason }
  })
  const emptyH1Count = h1Details.filter(d => d.kind === 'empty').length
  const hasH1 = h1Count > 0
  if (h1Count === 0) problems.push({ id: 'missing_h1', severity: 'high', label: '頁面沒有 H1 標題' })
  else if (h1Count > 1) {
    // 多 H1 時補上「其中 N 個是空 H1（page builder 殘留）」提示
    const suffix = emptyH1Count > 0 ? `，其中 ${emptyH1Count} 個是空 H1（page builder 殘留）` : ''
    problems.push({
      id: 'multiple_h1',
      severity: 'medium',
      label: `頁面有 ${h1Count} 個 H1（應只有 1 個）${suffix}`,
      empty_h1_count: emptyH1Count,
      h1_details: h1Details,  // 前端展開時顯示每個 H1 的內容卡片
    })
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const metaTitle = titleMatch ? decodeEntities(titleMatch[1]).trim() : ''
  const metaTitleLen = metaTitle.length
  const hasMetaTitle = metaTitleLen > 0
  // Stage 2: 抽品牌名（給 title / desc 建議用）— og:site_name 優先、否則從 title 末段倒推
  const brandName = extractBrandName(html, metaTitle)
  if (!hasMetaTitle) {
    problems.push({
      id: 'missing_meta_title',
      severity: 'high',
      label: '缺 <title> 標題',
      suggestion: brandName ? {
        kind: 'code',
        note: `加在 <head> 區、品牌名「${brandName}」自動帶入`,
        code_snippet: `<title>主關鍵字｜${brandName}</title>`,
      } : null,
    })
  }
  else if (metaTitleLen < 20) {
    // 短標題建議：如果有品牌名、補成「{current}｜{brand}」；如果連品牌都沒有、純粹提示
    const containsBrand = brandName && metaTitle.includes(brandName)
    const suggested = brandName && !containsBrand ? `${metaTitle}｜${brandName}` : null
    problems.push({
      id: 'short_meta_title',
      severity: 'medium',
      label: `標題只有 ${metaTitleLen} 字（建議 30-60）`,
      suggestion: {
        kind: 'text',
        current: metaTitle, current_len: metaTitleLen,
        suggested, suggested_len: suggested ? suggested.length : null,
        code_snippet: suggested ? `<title>${suggested}</title>` : null,
        note: suggested
          ? `偵測到品牌「${brandName}」，建議在標題後加「｜${brandName}」拉到 ${suggested.length} 字`
          : '建議補主關鍵字 + 品牌名拉到 30-60 字（系統未偵測到品牌名、需手動補）',
      },
    })
  }
  else if (metaTitleLen > 70) {
    // 過長截斷：智能在分隔符切，保留品牌名
    const truncated = smartTruncate(metaTitle, 60)
    problems.push({
      id: 'long_meta_title',
      severity: 'low',
      label: `標題 ${metaTitleLen} 字過長（建議 30-60，Google SERP 會截斷）`,
      suggestion: {
        kind: 'text',
        current: metaTitle, current_len: metaTitleLen,
        suggested: truncated, suggested_len: truncated.length,
        code_snippet: `<title>${truncated}</title>`,
        note: 'Google SERP 顯示上限約 60 字，超過會被「...」截掉',
      },
    })
  }

  const metaDescMatch = html.match(/<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i)
                     || html.match(/<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["']/i)
  const metaDesc = metaDescMatch ? decodeEntities(metaDescMatch[1]).trim() : ''
  const metaDescLen = metaDesc.length
  const hasMetaDesc = metaDescLen > 0
  // Stage 2: 抽內文摘要、給缺 / 短 desc 建議
  const bodyExcerpt = extractBodyExcerpt(html, 155)
  if (!hasMetaDesc) {
    problems.push({
      id: 'missing_meta_desc',
      severity: 'high',
      label: '缺 Meta 描述',
      suggestion: bodyExcerpt ? {
        kind: 'text',
        suggested: bodyExcerpt, suggested_len: bodyExcerpt.length,
        code_snippet: metaDescCode(bodyExcerpt),
        note: '系統從文章內文自動抓的開頭摘要、可直接複製或微調後使用',
      } : {
        kind: 'text',
        note: '文章內文太短抓不到摘要、請手動寫 70-155 字描述',
      },
    })
  }
  else if (metaDescLen < 50) {
    // 短描述：建議用內文摘要取代或補長
    const replacement = bodyExcerpt && bodyExcerpt.length > metaDescLen ? bodyExcerpt : null
    problems.push({
      id: 'short_meta_desc',
      severity: 'medium',
      label: `Meta 描述只有 ${metaDescLen} 字（建議 70-155）`,
      suggestion: {
        kind: 'text',
        current: metaDesc, current_len: metaDescLen,
        suggested: replacement, suggested_len: replacement ? replacement.length : null,
        code_snippet: replacement ? metaDescCode(replacement) : null,
        note: replacement
          ? '系統從內文抓的較長版本、可取代或合併'
          : '建議擴充到 70-155 字、含主關鍵字 + 賣點',
      },
    })
  }
  else if (metaDescLen > 200) {
    const truncated = smartTruncate(metaDesc, 155)
    problems.push({
      id: 'long_meta_desc',
      severity: 'low',
      label: `Meta 描述 ${metaDescLen} 字過長（建議 70-155）`,
      suggestion: {
        kind: 'text',
        current: metaDesc, current_len: metaDescLen,
        suggested: truncated, suggested_len: truncated.length,
        code_snippet: metaDescCode(truncated),
        note: 'Google SERP 描述顯示上限約 155 字，超過會被截掉',
      },
    })
  }

  const ogTitle = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:title["'][^>]*>/i)
  const ogImage = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*>/i)
  const ogDesc = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:description["'][^>]*>/i)
  const ogComplete = !!(ogTitle && ogImage && ogDesc)
  // Stage 3: 抽首圖 + 品牌名給 OG 模板用（前面 metaTitle / metaDesc / bodyExcerpt / brandName 已算好）
  const articleImage = extractFirstArticleImage(html, url)
  if (!ogTitle && !ogImage && !ogDesc) {
    // 完全沒 OG → 給完整 6 行模板
    const ogTemplate = buildOgBlock({
      title: metaTitle || null,
      desc: metaDesc || bodyExcerpt || null,
      image: articleImage,
      url,
      siteName: brandName,
    })
    problems.push({
      id: 'missing_og',
      severity: 'medium',
      label: '完全沒有 Open Graph 標籤',
      suggestion: {
        kind: 'code',
        code_snippet: ogTemplate,
        note: `加在 <head> 區。OG 是 Facebook / LINE / Slack 分享預覽用的、沒設定的話分享連結會抓不到圖跟標題${articleImage ? '' : '（系統沒抓到文章首圖、image 行請手動補）'}`,
      },
    })
  }
  else if (!ogComplete) {
    // 只缺其中幾個 → 只給缺的那幾行
    const missing = []
    if (!ogTitle) missing.push(buildOgMissingTag('og:title', metaTitle || '【請填頁面標題】'))
    if (!ogDesc) missing.push(buildOgMissingTag('og:description', metaDesc || bodyExcerpt || '【請填頁面描述】'))
    if (!ogImage) missing.push(buildOgMissingTag('og:image', articleImage || 'https://example.com/featured-image.jpg'))
    const missingNames = []
    if (!ogTitle) missingNames.push('title')
    if (!ogDesc) missingNames.push('description')
    if (!ogImage) missingNames.push('image')
    problems.push({
      id: 'incomplete_og',
      severity: 'low',
      label: `OG 標籤不完整（缺 ${missingNames.join(' / ')}）`,
      suggestion: {
        kind: 'code',
        code_snippet: missing.join('\n'),
        note: `補進 <head>。${!ogImage && !articleImage ? 'image 系統沒抓到首圖、請手動補圖片網址。' : ''}`,
      },
    })
  }

  const schemaTypes = extractSchemaTypes(html)
  const hasArticleSchema = schemaTypes.includes('Article') || schemaTypes.includes('NewsArticle') || schemaTypes.includes('BlogPosting')
  const hasProductSchema = schemaTypes.includes('Product') || schemaTypes.includes('ProductGroup')
  const pageType = detectPageType(schemaTypes, url)

  // Stage 3: 抓發佈日（給 Article schema 用）
  const datePublished = extractDatePublished(html)
  // 完全沒任何 JSON-LD → 一律報（任何頁面都需要至少基本 Organization / WebSite schema）
  if (schemaTypes.length === 0) {
    problems.push({
      id: 'no_json_ld',
      severity: 'high',
      label: '完全沒有 JSON-LD 結構化資料',
      suggestion: {
        kind: 'code',
        code_snippet: buildBaseSchema({ url, siteName: brandName }),
        note: '加在 <head> 區。最基本的 Organization + WebSite schema、Google 認識你是哪家公司、是 SEO/AEO 的入場券',
      },
    })
  }
  // 有 schema 但缺主要內容類 schema — 按頁面類型給不同建議
  // 商品頁不該被報「缺 Article schema」(2026-06-02 修)
  else if (pageType === 'article' && !hasArticleSchema) {
    problems.push({
      id: 'no_article_schema',
      severity: 'medium',
      label: `文章頁缺 Article schema（已有：${schemaTypes.join(', ')}）`,
      suggestion: {
        kind: 'code',
        code_snippet: buildArticleSchema({
          title: metaTitle, desc: metaDesc || bodyExcerpt,
          image: articleImage, url, siteName: brandName, datePublished,
        }),
        note: `加在 <head> 區。${datePublished ? '系統有抓到發佈日、' : ''}${articleImage ? '首圖抓到了、' : '首圖沒抓到請手動補、'}author / publisher.logo 需要手動填`,
      },
    })
  }
  else if (pageType === 'product' && !hasProductSchema) {
    problems.push({
      id: 'no_product_schema',
      severity: 'medium',
      label: `商品頁缺 Product schema（已有：${schemaTypes.join(', ')}）`,
      suggestion: {
        kind: 'code',
        code_snippet: buildProductSchema({
          title: metaTitle, desc: metaDesc || bodyExcerpt,
          image: articleImage, url, siteName: brandName,
        }),
        note: '加在 <head> 區。價格 / 庫存狀態請從你的商店系統手動填 — 不填的話 Google Merchant 不收',
      },
    })
  }
  // pageType 是 product/service/local-business/homepage 且有對應 schema → 不報
  // pageType === 'unknown' 也不報「缺 Article schema」(免得誤判)

  const wordCount = roughWordCount(html)
  // 文章類頁面才嚴格要求字數；商品頁/首頁字數短是正常的
  if (pageType === 'article' || pageType === 'unknown') {
    if (wordCount < 200) problems.push({ id: 'thin_content', severity: 'high', label: `文章內容過少（約 ${wordCount} 字，建議 >300）` })
    else if (wordCount < 300) problems.push({ id: 'short_content', severity: 'low', label: `文章較短（約 ${wordCount} 字，建議 >300）` })
  }

  const canonical = matchAttr(html, /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>/i, 'href')
  const hasCanonical = !!canonical
  if (!hasCanonical) {
    problems.push({
      id: 'missing_canonical',
      severity: 'low',
      label: '缺 canonical 標籤',
      suggestion: {
        kind: 'code',
        note: '加在 <head> 區、告訴 Google 這頁的「正版」網址，避免被當重複內容',
        code_snippet: `<link rel="canonical" href="${url}" />`,
      },
    })
  }

  return {
    has_h1: hasH1, h1_count: h1Count, empty_h1_count: emptyH1Count,
    has_meta_title: hasMetaTitle, meta_title_len: metaTitleLen,
    has_meta_desc: hasMetaDesc, meta_desc_len: metaDescLen,
    has_og: !!(ogTitle || ogImage || ogDesc), og_complete: ogComplete,
    schema_types: schemaTypes,
    has_article_schema: hasArticleSchema,
    has_product_schema: hasProductSchema,
    page_type: pageType,    // article / product / service / local-business / homepage / unknown
    word_count: wordCount,
    has_canonical: hasCanonical,
    // 給用戶「這個 URL 在 WP 後台哪裡編輯」的具體指引（如 /shop/ vs /product/ vs /locations.kml 不同）
    wp_admin_hint: detectWpAdminHint(url, pageType),
    problems,
  }
}

// 根據 URL pattern 推 WordPress 後台編輯路徑提示
// 用戶常常找不到「這個 URL 對應的編輯位置」（特別是 /shop/、/locations.kml 這種非普通 page）
// 回傳結構：{ where: string, plugin?: string, steps: string[], note?: string }
function detectWpAdminHint(url, pageType) {
  let pathname = ''
  try { pathname = new URL(url).pathname.toLowerCase() } catch { return null }

  // 1. 外掛產出的 XML / KML — Rank Math Local SEO、不是給用戶編輯的
  if (/\.(kml|xml|json|rss)$/i.test(pathname) || pathname.includes('sitemap')) {
    return {
      where: '外掛自動產出的非 HTML 檔（不是給編輯的）',
      plugin: 'Rank Math SEO',
      steps: [
        '這個 URL 是 SEO 外掛（很可能是 Rank Math Local SEO）自動產生',
        '上面 finding 對 XML/KML 檔大多無意義（不是 HTML）',
        '想關掉：WordPress 後台 → Rank Math → Local SEO 設定 → 關閉「KML 輸出」/「XML sitemap」',
      ],
      note: '一般中小品牌沒在用 KML（給 Google My Business 整合用）、可以關掉',
    }
  }

  // 2. WooCommerce 商店列表頁 /shop/ — 沒有對應 WP page 可編輯
  if (pathname === '/shop/' || pathname === '/shop' || pathname.startsWith('/product-category/')) {
    return {
      where: 'WooCommerce 商店列表頁（archive page、不是普通 WP page）',
      plugin: 'Rank Math SEO',
      steps: [
        'WordPress 後台 → Rank Math SEO',
        '→ 標題與中繼資料（Titles & Meta）',
        '→ WooCommerce',
        '→ Product Archive（商品歸檔頁）',
        '→ 改 SEO 標題 / 描述 / 其他 meta 設定',
      ],
      note: '/shop/ 跟個別商品（/product/xxx/）是不同設定區、別搞混',
    }
  }

  // 3. 個別商品頁 /product/xxx/
  if (pathname.startsWith('/product/') || pathname.match(/\/[^/]+\/$/) && pageType === 'product') {
    return {
      where: 'WooCommerce 商品頁',
      plugin: 'Rank Math SEO（每個商品有獨立 meta box）',
      steps: [
        'WordPress 後台 → 商品 (Products) → 找到這個商品 → 編輯',
        '滑到下方 Rank Math 區塊（在內容編輯器底下）',
        '改 SEO 標題 / 描述 / Schema',
      ],
    }
  }

  // 4. 首頁 — 整個網站根
  if (pathname === '/' || pathname === '') {
    return {
      where: '網站首頁',
      plugin: 'Rank Math SEO',
      steps: [
        'WordPress 後台 → 設定 → 閱讀 → 看「首頁顯示」設成什麼',
        'A) 如果是「最新文章」：到 Rank Math → 標題與中繼資料 → 首頁（Homepage） 改設定',
        'B) 如果是「靜態頁面」：到 頁面 → 編輯那個指定的首頁、用該頁面的 Rank Math meta box 改',
      ],
    }
  }

  // 5. 文章頁 / blog post
  if (pathname.includes('/blog/') || pathname.includes('/news/') || pageType === 'article') {
    return {
      where: 'WordPress 文章（Post）',
      plugin: 'Rank Math SEO',
      steps: [
        'WordPress 後台 → 文章 → 全部文章 → 找到這篇 → 編輯',
        '滑到下方 Rank Math 區塊（在內容編輯器底下）',
        '改 SEO 標題 / 描述 / Schema',
      ],
    }
  }

  // 6. 預設：普通 page
  return {
    where: 'WordPress 頁面（Page）或文章',
    plugin: 'Rank Math SEO',
    steps: [
      'WordPress 後台 → 頁面（或文章）→ 找到對應這個 URL 的項目 → 編輯',
      '滑到下方 Rank Math 區塊',
      '改 SEO 標題 / 描述',
    ],
    note: '找不到的話、看 WP 後台網址列；複製這個 URL 的最後一段 slug 去搜尋',
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

// 從 HTML 抽品牌名 — 用來建議「{title}｜{brand}」這種 SEO 標題模板
// 優先序：og:site_name > 從 <title> 末段「｜brand」或「| brand」或「- brand」抓
function extractBrandName(html, metaTitle) {
  const siteName = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']og:site_name["'][^>]*>/i)
  if (siteName && siteName.length <= 30) return siteName
  // 從現有 title 倒推：「主標題｜品牌」「主標題 - 品牌」抓最後一段
  if (metaTitle) {
    const m = metaTitle.match(/[｜|\-–—]\s*([^｜|\-–—]{2,30})\s*$/)
    if (m) return m[1].trim()
  }
  return null
}

// 抽文章內文摘要 — 用來建議 meta description
// 策略：找 <article>/<main>/.entry-content/.post-content 區塊 → 抽 <p> → strip tag + 正規化空白
// 找不到專屬區塊就 fallback 整頁所有 <p>（會混到 footer 但總比沒有好）
function extractBodyExcerpt(html, maxLen = 155) {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]*class\s*=\s*["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\b[^>]*class\s*=\s*["'][^"']*post-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ]
  let section = null
  for (const re of candidates) {
    const m = html.match(re)
    if (m) { section = m[1]; break }
  }
  if (!section) section = html
  // 抽 <p> 內文（跳過 nav/footer/script/style）
  const cleaned = section
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
  const paragraphs = cleaned.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi) || []
  let text = ''
  for (const p of paragraphs) {
    const inner = decodeEntities(p.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    if (inner.length < 10) continue
    text += (text ? ' ' : '') + inner
    if (text.length >= maxLen + 50) break
  }
  if (!text) return null
  return smartTruncate(text, maxLen)
}

// 智能截斷：優先在句尾（。！？.!?）切，其次空白，最後硬切 + 加 …
function smartTruncate(text, maxLen) {
  if (text.length <= maxLen) return text
  const window = text.slice(0, maxLen + 10)
  // 先找句尾
  const sentEnd = window.search(/[。！？.!?]\s*$/m)
  if (sentEnd > maxLen * 0.6) return text.slice(0, sentEnd + 1).trim()
  const lastSent = window.match(/[。！？.!?]/g)
  if (lastSent) {
    const idx = window.lastIndexOf(lastSent[lastSent.length - 1])
    if (idx > maxLen * 0.6) return text.slice(0, idx + 1).trim()
  }
  // 找空白
  const space = window.lastIndexOf(' ', maxLen)
  if (space > maxLen * 0.6) return text.slice(0, space).trim() + '…'
  return text.slice(0, maxLen).trim() + '…'
}

// 把 description 文字包成完整 meta tag code 供用戶複製
function metaDescCode(desc) {
  // 跳脫 " 避免 attribute 提前結束
  const safe = desc.replace(/"/g, '&quot;')
  return `<meta name="description" content="${safe}" />`
}

// 抽文章首圖 — 給 og:image / Article schema image 用
// 策略：先找 <article>/<main>/.entry-content 區塊內第一張 <img>、否則整頁第一張非 logo/icon 的 <img>
// 回傳絕對網址（相對路徑會用 baseUrl 補上）
function extractFirstArticleImage(html, baseUrl) {
  const sections = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<div\b[^>]*class\s*=\s*["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ]
  let scope = null
  for (const re of sections) {
    const m = html.match(re)
    if (m) { scope = m[1]; break }
  }
  if (!scope) scope = html
  const imgs = scope.match(/<img\b[^>]*>/gi) || []
  for (const tag of imgs) {
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1]
    if (!src) continue
    // 跳過明顯不是文章主圖的：logo / icon / avatar / 1x1 tracker / data-uri
    if (/logo|icon|avatar|spacer|tracking|pixel\.gif|1x1/i.test(src)) continue
    if (src.startsWith('data:')) continue
    // 轉絕對路徑
    try {
      return new URL(src, baseUrl).href
    } catch { continue }
  }
  return null
}

// 從 HTML 抽發佈日期 — 給 Article schema datePublished 用
// 來源優先：article:published_time meta > time[datetime] > 既有 JSON-LD 的 datePublished
function extractDatePublished(html) {
  const ogTime = matchAttr(html, /<meta\s+[^>]*property\s*=\s*["']article:published_time["'][^>]*>/i)
  if (ogTime) return ogTime
  const timeTag = html.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i)
  if (timeTag) return timeTag[1]
  // 從現有 JSON-LD 找
  const dateMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/i)
  if (dateMatch) return dateMatch[1]
  return null
}

// 建 OG block 模板 — 給 missing_og 完整補齊用
// 傳入既有資料（metaTitle / metaDesc / imageUrl / url / siteName），缺的部分留 placeholder
function buildOgBlock({ title, desc, image, url, siteName }) {
  const lines = []
  if (title)    lines.push(`<meta property="og:title" content="${esc(title)}" />`)
  if (desc)     lines.push(`<meta property="og:description" content="${esc(desc)}" />`)
  if (image)    lines.push(`<meta property="og:image" content="${esc(image)}" />`)
  if (url)      lines.push(`<meta property="og:url" content="${esc(url)}" />`)
  lines.push(`<meta property="og:type" content="article" />`)
  if (siteName) lines.push(`<meta property="og:site_name" content="${esc(siteName)}" />`)
  return lines.join('\n')
}

// 建單一缺少的 OG meta tag — 給 incomplete_og 用
function buildOgMissingTag(prop, value) {
  return `<meta property="${prop}" content="${esc(value)}" />`
}

// 建 Article JSON-LD schema 模板 — 給 no_article_schema 用
// title / desc / image / url 自動帶入；author / datePublished 抓不到就放 placeholder
function buildArticleSchema({ title, desc, image, url, siteName, datePublished }) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title || '【請填文章標題】',
    description: desc || '【請填文章描述】',
    image: image || 'https://example.com/featured-image.jpg',
    url: url || 'https://example.com/article-url/',
    datePublished: datePublished || '2026-01-01T00:00:00+08:00',
    author: { '@type': 'Person', name: '【請填作者名】' },
    publisher: {
      '@type': 'Organization',
      name: siteName || '【請填網站名】',
      logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
    },
  }
  return `<script type="application/ld+json">\n${JSON.stringify(node, null, 2)}\n</script>`
}

// 建 Product JSON-LD schema 模板 — 給 no_product_schema 用
function buildProductSchema({ title, desc, image, url, siteName }) {
  const node = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title || '【請填商品名】',
    description: desc || '【請填商品描述】',
    image: image || 'https://example.com/product-image.jpg',
    url: url || 'https://example.com/product/',
    brand: { '@type': 'Brand', name: siteName || '【請填品牌名】' },
    offers: {
      '@type': 'Offer',
      url: url || 'https://example.com/product/',
      priceCurrency: 'TWD',
      price: '0',
      availability: 'https://schema.org/InStock',
    },
  }
  return `<script type="application/ld+json">\n${JSON.stringify(node, null, 2)}\n</script>`
}

// 建基本 Organization + WebSite schema — 給 no_json_ld（完全沒 schema）用
function buildBaseSchema({ url, siteName }) {
  const origin = (() => { try { return new URL(url).origin } catch { return 'https://example.com' } })()
  const nodes = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName || '【請填網站名】',
      url: origin,
      logo: `${origin}/logo.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName || '【請填網站名】',
      url: origin,
    },
  ]
  return nodes.map(n => `<script type="application/ld+json">\n${JSON.stringify(n, null, 2)}\n</script>`).join('\n')
}

// HTML attribute 值的跳脫 — 避免 " & < > 把 tag 打斷
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
    top_offenders: offenders.slice(0, 20),
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
