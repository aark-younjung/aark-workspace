/**
 * GET /api/brand-mentions?brand=&excludeDomain=&num=10
 *   — 品牌外部提及搜尋（Google Custom Search API、2026-06-10）
 *
 * 設計動機：LLMO 訊號鏈缺一塊「外部曝光」— audit 100 分但網路沒人提你、
 *   AI 還是不會推薦你。這個 endpoint 給「你品牌名」搜尋網路、回傳：
 *   提及次數 + Top 10 來源 + domain 分類（新聞 / 論壇 / 社群 / 部落格）。
 *
 * 環境變數（Vercel）：
 *   GOOGLE_CSE_API_KEY  — Google Cloud API key、啟用 Custom Search API
 *   GOOGLE_CSE_ID       — Programmable Search Engine ID（要設「搜尋整個網路」）
 *
 * 配額：免費 100 query/天、超過 $5/1000、預估 1000 用戶才會超過免費額度。
 *
 * 設計判斷：
 *   - 排除自家網域（excludeDomain）：避免自家頁面被算進「外部提及」
 *   - 用 exact phrase（雙引號包品牌名）：精準匹配、避免「金鉑」誤撈到別的東西
 *   - 不存 DB：MVP 階段、每次搜尋都即時打 API；之後再加 cache + 歷史趨勢
 */

const ALLOWED_NUM = [5, 10, 20]  // num 參數允許的值（避免亂打配額）

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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
  const num = ALLOWED_NUM.includes(parseInt(req.query.num)) ? parseInt(req.query.num) : 10

  if (!brand || brand.length < 2) {
    return res.status(400).json({ error: 'Brand name required (≥ 2 chars)' })
  }
  if (brand.length > 50) {
    return res.status(400).json({ error: 'Brand name too long (max 50 chars)' })
  }

  // 組 query：exact phrase + 排除自家網域、避免抓到自家頁面
  // 例：`"金鉑先生" -site:kimbo3899.com.tw`
  let query = `"${brand}"`
  if (excludeDomain) {
    // 把 https:// www. trailing slash 等清掉、只留 hostname
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
    url.searchParams.set('hl', 'zh-TW')  // 在地化

    const resp = await fetch(url.toString())
    if (!resp.ok) {
      const text = await resp.text()
      console.error('Google CSE API error:', resp.status, text)
      return res.status(502).json({
        error: 'upstream_error',
        message: 'Google 搜尋 API 暫時無法使用',
        upstream_status: resp.status,
      })
    }

    const data = await resp.json()
    const totalResults = parseInt(data?.searchInformation?.totalResults || '0')
    const items = (data?.items || []).map(it => ({
      title: it.title,
      link: it.link,
      snippet: it.snippet,
      displayLink: it.displayLink,
      // 分類 domain 類型（簡單啟發式、之後可改成 domain DB）
      category: categorizeSource(it.displayLink),
    }))

    return res.status(200).json({
      brand,
      excludeDomain: excludeDomain || null,
      query,
      totalResults,
      items,
      // 來源分類聚合
      categoryCounts: countByCategory(items),
      // 建議行動（根據結果數）
      recommendation: recommend(totalResults, items),
    })
  } catch (err) {
    console.error('brand-mentions error:', err)
    return res.status(500).json({ error: 'internal_error', message: String(err.message || err) })
  }
}

// ─── 把 domain 分類成 news / forum / social / blog / other ───
// 簡單啟發式、未來可換 domain DB（DataForSEO domain rank 之類）
function categorizeSource(displayLink) {
  if (!displayLink) return 'other'
  const d = displayLink.toLowerCase()
  // 台灣主要新聞媒體
  if (/(udn|ltn|cna|chinatimes|tvbs|ettoday|setn|nownews|storm|cw|bnext|inside|techorange|digitimes|ithome|appledaily|nextapple|epochtimes|epoch|cnabc|cnyes|moneydj)/i.test(d)) return 'news'
  // 台灣主要論壇 / 社群
  if (/(mobile01|ptt|dcard|gamer\.com\.tw|bahamut|techbang|kocpc|toy-people|niusnews)/i.test(d)) return 'forum'
  // 國際社群
  if (/(facebook|instagram|twitter|x\.com|threads|tiktok|linkedin|youtube|reddit|medium)/i.test(d)) return 'social'
  // 部落格 / 自媒體
  if (/(blogspot|wordpress\.com|pixnet|blog\b|substack)/i.test(d)) return 'blog'
  // Wikipedia / 知識庫
  if (/(wikipedia|wikidata|wiktionary)/i.test(d)) return 'wiki'
  return 'other'
}

function countByCategory(items) {
  const counts = { news: 0, forum: 0, social: 0, blog: 0, wiki: 0, other: 0 }
  for (const it of items) counts[it.category] = (counts[it.category] || 0) + 1
  return counts
}

// 根據結果數量給操作建議
function recommend(totalResults, items) {
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
