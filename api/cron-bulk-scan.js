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

  // 法律/功能頁面 — 不適用 SEO 標題優化規則（短標題本來就 OK）
  // 例：/privacy-policy/、/terms/、/cookie-policy/、/refund/、/disclaimer/
  // 也涵蓋 WooCommerce 結帳/帳號 functional 頁面
  if (/\/(privacy[-_]?policy|privacy|terms|terms[-_]?of[-_]?service|cookie[-_]?policy|refund[-_]?policy|disclaimer|gdpr|legal)\/?$/i.test(urlLower)) return 'legal'
  if (/\/(隱私|服務條款|退款|免責)/i.test(urlLower)) return 'legal'
  if (/\/(cart|checkout|my-account|account|wishlist|lost-password)\/?/i.test(urlLower)) return 'functional'

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

// 在 HTML 內找指定 byte 位置之前最近的 class="..." 屬性
// 用於 H1 父容器 class 偵測（heuristic、不需 100% 準、抓到視覺上最接近的就好）
// 看前 2000 字、回傳最後一個 class 屬性值（最接近的 class）
function findNearestParentClass(html, position) {
  if (typeof position !== 'number' || position < 0) return null
  const before = html.substring(Math.max(0, position - 2000), position)
  const matches = [...before.matchAll(/class="([^"]+)"/gi)]
  if (matches.length === 0) return null
  return matches[matches.length - 1][1].trim()
}

// 給 agency 用：每個 finding 標「誰能修」、讓代理商一眼看出哪些自己能解、哪些要請客戶幫忙
// - 'seo_plugin' = Rank Math / Yoast 後台可改、agency 通常有這個帳號
// - 'wp_admin'   = 要進 WordPress 編輯器改文章 / 商品 / 頁面、可能需要客戶權限
// - 'content_writer' = 需要實際撰寫內容（不是設定問題）
function getFixOwner(findingId) {
  const map = {
    // H1 結構 — 要編輯文章 body
    missing_h1: 'wp_admin', multiple_h1: 'wp_admin',
    // Meta title / desc — SEO 外掛欄位
    missing_meta_title: 'seo_plugin', short_meta_title: 'seo_plugin', long_meta_title: 'seo_plugin',
    missing_meta_desc: 'seo_plugin', short_meta_desc: 'seo_plugin', long_meta_desc: 'seo_plugin',
    // Open Graph — Rank Math 自動帶 + 個別覆寫
    missing_og: 'seo_plugin', incomplete_og: 'seo_plugin',
    // Schema — Rank Math 自帶 Organization/WebSite/Article/Product schema 設定
    no_json_ld: 'seo_plugin', no_article_schema: 'seo_plugin', no_product_schema: 'seo_plugin',
    // Canonical — Rank Math 自動處理
    missing_canonical: 'seo_plugin',
    // 內容字數 — 真的要寫東西
    thin_content: 'content_writer', short_content: 'content_writer',
  }
  return map[findingId] || 'wp_admin'  // 未知 finding 預設 wp_admin（保守、提醒要小心）
}

// helper：給 problems push 後統一塞 fix_owner（保持下面 push 邏輯乾淨）
function tagFixOwners(problems) {
  problems.forEach(p => { p.fix_owner = getFixOwner(p.id) })
  return problems
}

// 從 raw HTML 跑 7 項文章層級檢測（regex 為主，避免裝 cheerio 拖慢冷啟動）
function analyzeArticleHtml(html, url) {
  const problems = []

  const h1Matches = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const h1Count = h1Matches.length
  // 為了偵測「主題級重複渲染」（不同 container class 但內容相同）— 紀錄每個 H1 的 byte 位置 + 最近的父容器 class
  const h1Positions = []
  const re = /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi
  let m
  while ((m = re.exec(html)) !== null) h1Positions.push(m.index)

  // 每個 H1 拆出純文字內文，做分類（empty / sentence / short）+ 給建議動作（keep / change_to_p / change_to_h2 / delete）
  // 排序規則：第 1 個 H1 預設保留（多半是主題模板渲染的主標題或文章首個標題），後續才標建議修法
  const h1Details = h1Matches.map((tag, idx) => {
    const inner = tag.replace(/<h1\b[^>]*>/i, '').replace(/<\/h1>/i, '')
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')).trim()
    const len = text.length
    // 找這個 H1 最近的父容器 class（往前 2000 字找最後一個 class="..." 屬性）
    const parentClass = findNearestParentClass(html, h1Positions[idx])
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
    return {
      index: idx + 1,
      text: text.slice(0, 200),
      full_length: len,
      kind,
      suggested_action: suggestedAction,
      reason,
      parent_class: parentClass,
    }
  })
  const emptyH1Count = h1Details.filter(d => d.kind === 'empty').length

  // 偵測「重複 H1」— 兩個或以上 H1 的純文字內容完全相同
  // 多半是 WPBakery 響應式雙版本（手機/桌面各一份、CSS hide 但 DOM 還在）、或主題模板把 heading 嵌兩次
  // 用 text → indices map 抓出每組重複
  const textGroups = {}
  h1Details.forEach(d => {
    if (!d.text) return  // 空的不算
    const key = d.text
    if (!textGroups[key]) textGroups[key] = []
    textGroups[key].push(d.index)
  })
  const duplicateH1Groups = Object.entries(textGroups)
    .filter(([, indices]) => indices.length >= 2)
    .map(([text, indices]) => ({ text: text.slice(0, 80), indices, count: indices.length }))

  // 標記每個 detail 是否為「重複組」的成員、供前端顯示重複 chip + 給對應的建議
  if (duplicateH1Groups.length > 0) {
    const dupIndices = new Set(duplicateH1Groups.flatMap(g => g.indices))

    // 進一步偵測：每組重複 H1 的 parent_class 是否「跨容器」（不同 container 渲染同內容 → 主題級雙渲染問題）
    // 這跟「同一 container 內重複」（如 page builder 響應式變體）是不同根因、修法也不同
    duplicateH1Groups.forEach(g => {
      const classes = g.indices.map(idx => h1Details[idx - 1]?.parent_class).filter(Boolean)
      const uniqClasses = [...new Set(classes)]
      // 標準 WooCommerce 描述容器、表示其中一份是合法位置
      const STD_WC_CLASSES = ['woocommerce-Tabs-panel--description', 'entry-content', 'wc-tab', 'tab-content']
      const hasStdWc = uniqClasses.some(c => STD_WC_CLASSES.some(s => c.includes(s)))
      // 不同 parent class → 主題級多處渲染（最難解）
      g.cross_container = uniqClasses.length > 1
      g.parent_classes = uniqClasses
      g.has_standard_wc = hasStdWc
    })

    h1Details.forEach(d => {
      if (dupIndices.has(d.index)) {
        d.is_duplicate = true
        // 標記是否屬於跨容器重複（給前端顯示更精準的 reason）
        const group = duplicateH1Groups.find(g => g.indices.includes(d.index))
        d.cross_container_duplicate = !!group?.cross_container
        // 重複的 H1 第一個保留、其他改 <p> 或刪（不要保留多份相同文字）
        if (d.index !== group.indices[0]) {
          d.suggested_action = 'change_to_p'
          // 三層 reason：跨容器（主題級、最棘手）/ 商品頁雙描述 / 一般頁響應式
          if (group.cross_container) {
            // 找出非標準 WC 的那個 class 名 — 多半就是「主題自訂渲染區塊」的元兇
            const STD_WC = ['woocommerce-Tabs-panel--description', 'entry-content', 'wc-tab', 'tab-content']
            const customClass = group.parent_classes.find(c => !STD_WC.some(s => c.includes(s)))
            // 給一般人讀的 plain-language 說明（不講 class、不講 PHP）
            d.reason = '你的網站把同一段商品描述「顯示了兩次」— 不是你寫了兩份、而是網站主題本身在頁面上方又自動塞了一份'
            // 給工程師看的技術細節 + 可複製訊息
            d.fix_guide = {
              symptom_human: '同一段內容（含 H1 + YouTube + 段落）在商品頁出現兩次。第一次在商品圖下方某個自訂區塊、第二次在「描述」分頁。',
              how_to_verify: [
                '用無痕視窗打開商品頁（避開瀏覽器 cache）',
                '滑到商品圖下方、看是不是出現一段含 YouTube 跟你寫的描述',
                '繼續往下滑到「描述」分頁、看是不是同一份內容再出現一次',
                '兩處都看到 = 確認是主題在重複渲染',
              ],
              fix_options: [
                {
                  option: 'A. 不修（接受）',
                  effort: '0 分鐘',
                  detail: 'SEO 影響輕微（不是致命因素）。商業判斷：如果這個客戶 SEO 沒卡死、可以暫不處理',
                },
                {
                  option: 'B. 請主題開發者調整（推薦）',
                  effort: '~30 分鐘工時',
                  detail: '找原本做這個 WordPress 主題的工程師、請他「移除商品摘要區塊（pr-content）的重複渲染」。如果是用付費主題、聯絡主題官方客服',
                },
                {
                  option: 'C. 自己裝 Code Snippets 外掛 + 貼 PHP',
                  effort: '~10 分鐘（需要對 PHP 不害怕）',
                  detail: '裝免費外掛「Code Snippets」→ 加新 snippet → 貼下面這段：\n\nadd_action(\'init\', function() {\n  remove_action(\'woocommerce_after_single_product_summary\', \'pr_render_content\', 10);\n}); \n\n注意：第 2 行的「pr_render_content」是猜的、實際 hook 名要靠開發者確認。建議搭配 B 比較保險',
                },
              ],
              // 給技術員 / 客服一段可直接複製貼上的訊息
              ticket_for_tech: `網站 ${url || '[URL]'} 的商品頁有「主題層描述重複渲染」問題。\n\n症狀：商品描述在頁面上出現兩次 — 一次在商品圖下方主題自訂區塊（CSS class: ${customClass || '未知'}）、一次在標準 WooCommerce 描述 tab。\n\n影響：SEO 上同一份 H1 被輸出兩次、Google 偵測為重複內容、不利搜尋排名。\n\n請協助：移除主題自訂區塊那次描述渲染、保留標準 WooCommerce 描述 tab 即可。如果不確定如何下手、應該是 \`woocommerce_after_single_product_summary\` 這個 hook 上掛了重複的 callback。`,
            }
          } else if (url && /\/product\//i.test(url)) {
            d.reason = '跟其他 H1 內容相同 → 通常是 WooCommerce「商品簡述」+「商品說明」兩個欄位都貼了同內容、清空商品簡述即可'
          } else {
            d.reason = '跟其他 H1 內容相同 → 可能是 WPBakery 響應式雙版本、或主題模板把同份內容渲染兩次'
          }
        }
      }
    })
  }

  const hasH1 = h1Count > 0
  if (h1Count === 0) problems.push({ id: 'missing_h1', severity: 'high', label: '頁面沒有 H1 標題' })
  else if (h1Count > 1) {
    // 多 H1 時補上「其中 N 個是空 H1」與「N 個內容重複」雙提示
    const suffixes = []
    if (emptyH1Count > 0) suffixes.push(`${emptyH1Count} 個是空 H1（page builder 殘留）`)
    if (duplicateH1Groups.length > 0) {
      const dupCount = duplicateH1Groups.reduce((sum, g) => sum + g.count, 0)
      suffixes.push(`${dupCount} 個內容相同（多半是響應式雙版本）`)
    }
    const suffix = suffixes.length > 0 ? `，其中 ${suffixes.join('、')}` : ''
    problems.push({
      id: 'multiple_h1',
      severity: 'medium',
      label: `頁面有 ${h1Count} 個 H1（應只有 1 個）${suffix}`,
      empty_h1_count: emptyH1Count,
      duplicate_h1_groups: duplicateH1Groups,    // 給前端顯示「H1 #2 跟 H1 #3 相同」這種訊息
      h1_details: h1Details,                      // 前端展開時顯示每個 H1 的內容卡片（內含 is_duplicate flag）
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
    // 重要：補完品牌名後可能還是 < 30 字、要主動告訴用戶仍需手動延伸（不能讓用戶以為「照建議改了就解決」）
    const containsBrand = brandName && metaTitle.includes(brandName)
    const suggested = brandName && !containsBrand ? `${metaTitle}｜${brandName}` : null
    const suggestedLen = suggested ? suggested.length : null
    const stillTooShort = suggestedLen != null && suggestedLen < 30
    let note
    if (suggested && !stillTooShort) {
      note = `偵測到品牌「${brandName}」，建議在標題後加「｜${brandName}」拉到 ${suggestedLen} 字`
    } else if (suggested && stillTooShort) {
      // 補完品牌名仍 < 30 字、要明確告訴用戶這不夠、需要手動延伸主關鍵字 / 描述
      const need = 30 - suggestedLen
      note = `自動補品牌名只拉到 ${suggestedLen} 字、還差 ${need} 字才到建議下限 30。請手動延伸：在標題前段加主關鍵字描述（例如「2025 最新 」「實測 」「指南：」等定語）、或加副標再接品牌`
    } else {
      note = '建議補主關鍵字 + 品牌名拉到 30-60 字（系統未偵測到品牌名、需手動補）'
    }
    problems.push({
      id: 'short_meta_title',
      severity: 'medium',
      label: `標題只有 ${metaTitleLen} 字（建議 30-60）`,
      suggestion: {
        kind: 'text',
        current: metaTitle, current_len: metaTitleLen,
        suggested, suggested_len: suggestedLen,
        code_snippet: suggested ? `<title>${suggested}</title>` : null,
        still_too_short: stillTooShort,   // 前端可用這個 flag 顯示警告 chip
        note,
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

  // 法律/功能性頁面（隱私政策、服務條款、結帳頁等）不適用 SEO 內容優化規則
  // 「標題只有 13 字」對「隱私權政策」這種頁面是合理的、不該被報為問題
  let filteredProblems = problems
  if (pageType === 'legal' || pageType === 'functional') {
    const SKIP_FOR_LEGAL_FUNCTIONAL = new Set([
      'short_meta_title', 'long_meta_title',
      'short_meta_desc', 'missing_meta_desc', 'long_meta_desc',
      'thin_content', 'short_content',
      'no_article_schema', 'no_product_schema',
    ])
    filteredProblems = problems.filter(p => !SKIP_FOR_LEGAL_FUNCTIONAL.has(p.id))
  }

  return {
    has_h1: hasH1, h1_count: h1Count, empty_h1_count: emptyH1Count,
    has_meta_title: hasMetaTitle, meta_title_len: metaTitleLen,
    has_meta_desc: hasMetaDesc, meta_desc_len: metaDescLen,
    has_og: !!(ogTitle || ogImage || ogDesc), og_complete: ogComplete,
    schema_types: schemaTypes,
    has_article_schema: hasArticleSchema,
    has_product_schema: hasProductSchema,
    page_type: pageType,    // article / product / service / local-business / homepage / legal / functional / unknown
    word_count: wordCount,
    has_canonical: hasCanonical,
    // 給用戶「這個 URL 在 WP 後台哪裡編輯」的具體指引（如 /shop/ vs /product/ vs /locations.kml 不同）
    wp_admin_hint: detectWpAdminHint(url, pageType),
    problems: tagFixOwners(filteredProblems),  // 每個 problem 標 fix_owner（給 agency 區分權限）
  }
}

// 根據 URL pattern 推 WordPress 後台編輯路徑提示
// 用戶常常找不到「這個 URL 對應的編輯位置」（特別是 /shop/、/locations.kml 這種非普通 page）
// 回傳結構：{ where: string, plugin?: string, steps: string[], note?: string }
function detectWpAdminHint(url, pageType) {
  let pathname = ''
  try { pathname = new URL(url).pathname.toLowerCase() } catch { return null }

  // 0. 法律/功能頁面 — 隱私權、條款、結帳等、不適用 SEO 內容規則
  if (pageType === 'legal' || pageType === 'functional') {
    return {
      where: pageType === 'legal' ? '法律頁面（隱私權政策、服務條款等）' : '功能性頁面（結帳、購物車、帳號等 WooCommerce 系統頁）',
      plugin: 'Rank Math SEO',
      steps: [
        'WordPress 後台 → 頁面（Pages）→ 找這個頁面 → 編輯',
        '法律 / 功能性頁面不需要 SEO 標題優化、短標題（如「隱私權政策」）反而清楚明確',
        '我們已自動跳過不適用的 finding（標題太短、描述不夠、內容過少等）',
      ],
      note: '這類頁面的目的是法律宣示 / 系統功能、不是吸引搜尋流量。Google 不會懲罰法律頁標題短',
    }
  }

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

  // 2. WooCommerce 商店列表頁 /shop/ — 其實是 WP page、只是被 WooCommerce 用來當商店首頁
  if (pathname === '/shop/' || pathname === '/shop' || pathname.startsWith('/product-category/')) {
    const isCategory = pathname.startsWith('/product-category/')
    return {
      where: isCategory ? 'WooCommerce 商品分類頁' : 'WooCommerce 商店列表頁（其實對應 WP 一個 page）',
      plugin: 'Rank Math SEO',
      steps: isCategory ? [
        '🔥 最快：先登入 WP、再開這個 URL → 螢幕上方黑色 admin bar 有「編輯分類」連結、點下去',
        '備案：WordPress 後台 → 商品 → 分類 → 找到對應的分類 → 編輯 → 滑下去找 Rank Math 區塊',
        '改 SEO 標題 / 描述',
      ] : [
        '🔥 最快：先登入 WP、再開 https://你的網域/shop/ → 螢幕上方 admin bar 會出現「編輯頁面」、點下去直達',
        '備案 A：WordPress 後台 → 商品（Products） → 設定 → 進階（Advanced） → 頁面設定 → 看「商店頁面」設成哪一個 WP page',
        '備案 B：WordPress 後台 → 頁面（Pages）→ 全部頁面 → 搜尋「shop」或「商店」→ 編輯那個頁面',
        '進到編輯頁後 → 滑到下方 Rank Math 區塊 → 改 SEO 標題 / 描述',
        '備案 C（外掛模板層）：WP 後台 → Rank Math → 控制台（Dashboard）→ 確認 WooCommerce 模組已啟用 → 回 Titles & Meta、可能會多出 "Products" 或 "Misc Pages" 子分頁，shop page 設定可能在裡面（不同版本位置不一）',
      ],
      note: '/shop/ 本質是一個 WP page（WooCommerce 指定它當商店首頁）。最直接的方法 = 用 admin bar 或在「頁面」內找它、直接編輯。Rank Math 的 Titles & Meta 進去後位置因版本而異、走 page 編輯路徑最穩',
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
    const slug = pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || ''
    return {
      where: 'WordPress 文章（Post）',
      plugin: 'Rank Math SEO',
      steps: [
        '🔥 最快：先登入 WP、再開這篇文章前台網址 → 螢幕上方黑色 admin bar 會出現「編輯文章」連結、點下去直達編輯頁',
        '備案 A：WordPress 後台 → 文章 → 全部文章 → 右上「搜尋」框貼這篇的 slug 「' + slug + '」',
        '備案 B：在 WP 後台網址列直接打：你的網域/wp-admin/edit.php?post_type=post&s=' + slug,
        '進到編輯頁後 → 滑到下方 Rank Math 區塊（在內容編輯器底下）→ 改 SEO 標題 / 描述 / Schema',
      ],
      note: '如果文章列表也搜尋不到、可能這篇其實是「頁面（Page）」而不是「文章（Post）」— 改到「頁面 → 全部頁面」一樣搜 slug',
    }
  }

  // 6. 預設：普通 page
  const slug = pathname.replace(/\/$/, '').split('/').filter(Boolean).pop() || ''
  return {
    where: 'WordPress 頁面（Page）或文章',
    plugin: 'Rank Math SEO',
    steps: [
      '🔥 最快：先登入 WP、再開這個 URL 前台網址 → 螢幕上方黑色 admin bar 會出現「編輯文章 / 編輯頁面」連結、點下去直達',
      '備案 A：WordPress 後台 → 頁面 → 全部頁面 → 搜「' + slug + '」slug；找不到再到文章搜',
      '備案 B：在 WP 後台網址列直接打：你的網域/wp-admin/edit.php?post_type=page&s=' + slug,
      '進到編輯頁後 → 滑到下方 Rank Math 區塊 → 改 SEO 標題 / 描述',
    ],
    note: 'admin bar 是「黑色長條、登入後出現在頁面最上方」— 如果沒看到、確認你 WP 後台「個人資料」設定有打開「顯示工具列」',
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
