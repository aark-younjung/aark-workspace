/**
 * 嵌入版報告的項目字典。
 *
 * 四個分析器回傳的是代碼與布林值，這裡把它翻成客戶看得懂的話。
 * `why` 是「沒過的時候要顯示什麼」——只講事實與該動哪裡，不寫行銷話術。
 * 分數與判定一律來自分析器本身，這支檔案不做任何計算。
 */

import { isHomepage } from '../lib/pageAudit'

export const GROUPS = [
  { key: 'seo',  name: 'SEO 搜尋基礎', desc: 'Google 讀不讀得完你的網站' },
  { key: 'aeo',  name: 'AEO 答案結構', desc: '答案能不能被整段抓走' },
  { key: 'geo',  name: 'GEO 生成式引擎', desc: 'AI 爬蟲拿不拿得到內容' },
  { key: 'eeat', name: 'E-E-A-T 信任訊號', desc: '你是誰、憑什麼被引用' },
]

export const ITEMS = {
  seo: [
    ['meta_tags', 'Meta 標籤（標題與描述）', '缺少 title 或 description，搜尋結果與 AI 摘要會自己亂抓一段當說明。'],
    ['h1_structure', 'H1 標題結構', '沒有 H1，或同一頁出現多個 H1，機器判斷不出這一頁的主題是什麼。'],
    ['alt_tags', '圖片 alt 文字', '圖片沒有文字說明，對爬蟲來說那塊是空白的。'],
    ['mobile_compatible', '行動版相容性', '沒有 viewport 設定或版面不適應手機，行動搜尋會被降權。'],
    ['page_speed', '載入速度', '首頁回應偏慢。速度是少數立刻量得到、也立刻改得動的項目。'],
    ['ssl_chain', 'SSL 憑證鏈完整', '憑證鏈不完整。人用瀏覽器看不出來，但嚴格的爬蟲會直接放棄抓取。'],
    ['bot_accessibility', '爬蟲可達性', '防護設定把爬蟲擋掉了。這種情況網站對 AI 等於不存在。'],
    ['content_volume', '首頁內容份量', '首頁文字太少。技術設定再完整，沒有內容 Google 與 AI 也沒東西可以引用。'],
  ],
  aeo: [
    ['json_ld', 'JSON-LD 結構化資料', '沒有結構化資料，機器只能用猜的判斷這一頁在講什麼。'],
    ['faq_schema', 'FAQ 結構化資料', '常見問題沒有標記成 FAQ，搜尋引擎與 AI 不會把它當成可直接引用的問答。'],
    ['faq_visual', '頁面上有可見的問答區', '頁面本身看不到問答區塊。標記與內容要一起有，不能只有標記。'],
    ['canonical', 'canonical 標記', '沒有指定正式網址，同一份內容有多個網址時會互相稀釋。'],
    ['breadcrumbs', '麵包屑結構化資料', '沒有麵包屑，機器看不出這一頁在網站結構裡的位置。'],
    ['open_graph', 'Open Graph 標籤', '分享到社群或被引用時，標題與縮圖會抓錯。'],
    ['question_headings', '問句式標題', '標題都是名詞短語。客戶是用問句在問 AI 的，標題用問句比較容易被對上。'],
    ['meta_desc_length', '描述長度適當', '描述太短或太長，會被截斷或被判定資訊不足。'],
    ['structured_answer', '答案寫在問題正下方', '答案鋪陳太久才進重點，不好被整段拿走引用。'],
  ],
  geo: [
    ['robots_ai', 'robots.txt 沒有擋掉 AI 爬蟲', 'robots.txt 擋住了 GPTBot／ClaudeBot 這類爬蟲，等於主動退出 AI 的名單。'],
    ['llms_txt', 'llms.txt', '沒有 llms.txt。這不是 Google 的規範，屬於加分項，不是必要項。'],
    ['sitemap', 'sitemap.xml', '沒有網站地圖，爬蟲要自己摸索有哪些頁面。'],
    ['lastmod_passed', 'sitemap 有更新時間', '網站地圖沒有 lastmod，判斷不出內容是不是還在維護。'],
    ['json_ld_citation', '可被引用的結構化資料', '結構化資料缺少可用來引用的欄位（作者、日期、組織）。'],
    ['ai_snippet_passed', '沒有阻擋摘要的指令', '頁面上有 nosnippet 之類的指令，等於叫搜尋引擎與 AI 不要引用你。'],
    ['open_graph', 'Open Graph 標籤', '被引用時的標題與縮圖會抓錯。'],
    ['twitter_card', 'Twitter Card 標籤', '在部分平台上的預覽會缺圖或缺標題。'],
    ['canonical', 'canonical 標記', '沒有指定正式網址。'],
    ['https', 'HTTPS', '網站沒有全面使用 HTTPS。'],
  ],
  eeat: [
    ['author_info', '作者或負責人資訊', '看不出內容是誰寫的。AI 在判斷要不要引用時，會看有沒有具名的人。'],
    ['about_page', '關於我們', '找不到公司介紹頁，機器組不出「這是一家什麼公司」。'],
    ['contact_page', '聯絡方式', '找不到聯絡頁。這是基本的可信度訊號。'],
    ['privacy_policy', '隱私權政策', '沒有隱私權政策頁。'],
    ['organization_schema', 'Organization 結構化資料', '沒有用結構化資料寫明公司名稱、地址、聯絡方式。'],
    ['date_published', '發佈或更新日期', '內容沒有日期，判斷不出是不是還有效。'],
    ['social_links', '社群連結', '沒有連到官方社群帳號，少一組可以互相佐證的身分訊號。'],
    ['outbound_links', '對外引用連結', '完全沒有引用外部來源，內容看起來是封閉的。'],
  ],
}

/**
 * 哪些項目在這個頁型下「不適用」。
 *
 * analyzeAEO 計分時對首頁是豁免麵包屑與 FAQ schema 的（首頁在最上層、FAQ 在 FAQ 頁），
 * 但原始布林值照實回傳。如果報告直接把那些照實的 false 畫成「沒過」，
 * 就會出現「100 分，但 6/9 通過」這種自相矛盾的畫面。
 * 這裡把它們標成 N/A：不算通過、也不算失敗、不進「該修哪幾項」。
 */
function naKeys(groupKey, src, onHome) {
  if (groupKey !== 'aeo' || !onHome) return []
  const na = ['breadcrumbs']
  // 首頁真的有可見的問答區卻沒標記 schema ＝ 真問題，照算
  if (!src?.faq_visual) na.push('faq_schema', 'faq_visual')
  return na
}

/**
 * 每一項「實際量到什麼」。
 *
 * 只講事實（目前幾個字、幾張圖有 alt、幾天前更新），不重複 label、不寫建議。
 * 這件事很重要：光看一個 ✓ 沒有說服力，看到「標題 25 字元」才知道我們真的讀過。
 * 取不到就回 null，畫面上那一行就不出現 —— 寧可少一行，不要編一個數字。
 */
function detailOf(groupKey, src, key) {
  if (!src) return null
  const n = v => (typeof v === 'number' && isFinite(v) ? v : null)

  if (groupKey === 'seo') {
    const o = src[key]
    if (!o || typeof o !== 'object') return null
    switch (key) {
      case 'meta_tags': {
        const t = (o.titleContent || '').length
        const d = (o.descriptionContent || '').length
        if (!t && !d) return null
        return `標題 ${t} 字元 · 描述 ${d} 字元`
      }
      case 'h1_structure':
        return n(o.h1Count) === null ? null : `目前 ${o.h1Count} 個`
      case 'alt_tags':
        return n(o.totalImages) === null || o.totalImages === 0
          ? null
          : `${o.imagesWithAlt} / ${o.totalImages} 張圖有 alt`
      case 'mobile_compatible':
        return o.hasViewport ? '有 viewport 設定' : '沒有 viewport 設定'
      case 'page_speed':
        return n(o.loadTime) === null ? null : `回應 ${(o.loadTime / 1000).toFixed(1)} 秒`
      case 'content_volume':
        return n(o.wordCount) === null ? null : `約 ${o.wordCount} 字`
      default:
        return null
    }
  }

  if (groupKey === 'aeo') {
    const d = src.details || {}
    if (key === 'json_ld' && d.jsonLd && d.jsonLd.schemaType) return `偵測到 ${d.jsonLd.schemaType}`
    if (key === 'meta_desc_length' && d.metaDescLength && n(d.metaDescLength.length) !== null) {
      return `目前 ${d.metaDescLength.length} 字元`
    }
    if (key === 'question_headings' && d.questionHeadings && n(d.questionHeadings.questionCount) !== null) {
      return `${d.questionHeadings.questionCount} 個問句標題`
    }
    return null
  }

  if (groupKey === 'geo') {
    if (key === 'lastmod_passed' && n(src.lastmod_days_since) !== null) {
      return `最近一次更新在 ${src.lastmod_days_since} 天前`
    }
    if (key === 'ai_snippet_passed' && Array.isArray(src.ai_snippet_directives) && src.ai_snippet_directives.length) {
      return `偵測到：${src.ai_snippet_directives.join('、')}`
    }
    return null
  }

  return null
}

/** 分析器回傳的值可能是布林，也可能是 { passed } 物件 —— 統一成布林。 */
function readPass(raw) {
  if (raw === undefined || raw === null) return null
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'object' && 'passed' in raw) return !!raw.passed
  return null
}

/**
 * 把四個分析器的原始結果攤平成報告用的清單。
 * 取不到值的項目會被略過（不會當成「沒過」，那是兩件事）。
 */
export function normalize(results, { url = '' } = {}) {
  const onHome = url ? isHomepage(url) : false
  return GROUPS.map(g => {
    const src = results[g.key]
    const items = []
    if (src) {
      const na = naKeys(g.key, src, onHome)
      for (const [key, label, why] of ITEMS[g.key]) {
        const pass = readPass(src[key])
        if (pass === null) continue
        items.push({ key, label, why, pass, na: na.includes(key), detail: detailOf(g.key, src, key) })
      }
    }
    const scored = items.filter(i => !i.na)
    const passed = scored.filter(i => i.pass).length
    return {
      ...g,
      available: !!src,
      score: src && typeof src.score === 'number' ? src.score : null,
      items,
      passed,
      total: scored.length,
    }
  })
}
