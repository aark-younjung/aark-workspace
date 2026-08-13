import { metaLengthVerdict } from '../../lib/metaLength.js'
import { HOMEPAGE_NOTES, metaDescFindingDetail } from '../../lib/pageAudit.js'

// ponytail: 四個舊 audit 頁尚未匯出 check metadata；此 adapter 僅鏡射既有欄位 id／優先級，
// 不執行或改寫 analyzer。日後若舊頁抽成共用 check registry，這裡應直接改為 import。

export const HEALTH_TABS = [
  { key: 'seo', label: 'SEO', auditKey: 'seo' },
  { key: 'aeo', label: 'AEO', auditKey: 'aeo' },
  { key: 'geo', label: 'GEO', auditKey: 'geo' },
  { key: 'eeat', label: 'E-E-A-T', auditKey: 'eeat' },
  { key: 'crawl', label: '爬蟲可達性' },
  { key: 'schema', label: 'Schema' },
]

const SEO_META = [
  { id: 'meta_title', name: 'Meta 標題', icon: '🏷️', priority: 'P1', recommendation: '在頁面的 SEO 設定填寫清楚且包含主要關鍵字的標題。' },
  { id: 'meta_desc', name: 'Meta 描述', icon: '📝', priority: 'P1', recommendation: '在頁面的 SEO 設定補上摘要，清楚說明內容並加入行動呼籲。' },
  { id: 'h1_structure', name: 'H1 標題結構', icon: '📖', priority: 'P2', recommendation: '每頁保留一個 H1，清楚說明頁面核心主題。' },
  { id: 'alt_tags', name: '圖片 Alt 屬性', icon: '🖼️', priority: 'P2', recommendation: '替每張有資訊意義的圖片加入描述性 alt 文字。' },
  { id: 'mobile_compatible', name: '行動裝置相容', icon: '📱', priority: 'P1', recommendation: '加入 viewport meta，並確認版面能在手機寬度正常閱讀。' },
  { id: 'page_speed', name: '頁面載入速度', icon: '⚡', priority: 'P3', recommendation: '壓縮圖片、啟用快取與 CDN，移除不必要的 JavaScript。' },
  { id: 'ssl_chain', name: 'SSL 憑證鏈完整性', icon: '🔒', priority: 'P2', recommendation: '確認伺服器送出完整憑證鏈；Nginx 應指向 fullchain 憑證。' },
  { id: 'bot_accessibility', name: '爬蟲可達性', icon: '🛡️', priority: 'P1', recommendation: '檢查 Cloudflare／WAF，放行 GPTBot、ClaudeBot、PerplexityBot 等爬蟲 User-Agent。' },
]

const AEO_META = [
  { id: 'json_ld', name: 'JSON-LD 結構化資料', icon: '📋', priority: 'P1', description: '頁面是否含 Organization／WebSite 等基本 schema。', recommendation: '至少加入 WebSite 或 Organization schema。' },
  { id: 'faq_schema', name: 'FAQ Schema', icon: '❓', priority: 'P1', description: '頁面是否含 FAQPage 或 QAPage 結構化資料。', recommendation: '把常見問題區塊標記為 FAQPage schema。' },
  { id: 'canonical', name: 'Canonical 標籤', icon: '📌', priority: 'P1', description: '頁面是否正確指定主要引用 URL。', recommendation: '在 head 設置正確 canonical 標籤。' },
  { id: 'breadcrumbs', name: '麵包屑導航', icon: '🍞', priority: 'P3', description: '頁面是否含 BreadcrumbList schema。', recommendation: '用 BreadcrumbList 標記網站層級。' },
  { id: 'open_graph', name: 'Open Graph', icon: '🔗', priority: 'P2', description: '是否有完整的 Open Graph 預覽標籤。', recommendation: '補齊 og:title、og:description、og:image、og:url。' },
  { id: 'question_headings', name: 'H2/H3 問句式標題', icon: '💬', priority: 'P2', description: 'H2／H3 是否包含清楚的問句格式。', recommendation: '把適合的段落標題改成使用者會直接詢問的問題。' },
  { id: 'meta_desc_length', name: 'Meta 描述長度', icon: '📝', priority: 'P2', description: 'Meta 描述長度是否適合（門檻依語言自動判斷：中文 40–80 字、英文 70–155 字元）。', recommendation: '控制 Meta 描述長度——中文 40–80 字、英文 70–155 字元；實際字數與過長/過短見「SEO」分頁的「Meta 描述」檢查。' },
  { id: 'structured_answer', name: '結構化答案段落', icon: '📖', priority: 'P3', description: '頁面是否有 FAQ、問答段落或 details／summary。', recommendation: '加入可直接回答問題的短段落或 FAQ。' },
]

const GEO_META = [
  { id: 'llms_txt', name: 'llms.txt', icon: '🤖', priority: 'P1', description: '網站根目錄是否有 llms.txt，提供品牌與服務摘要。', recommendation: '在根目錄建立 llms.txt，描述品牌、服務與聯絡方式。' },
  { id: 'robots_ai', name: 'AI 爬蟲開放性', icon: '🚦', priority: 'P1', description: 'robots.txt 是否封鎖 GPTBot、PerplexityBot、Google-Extended 等爬蟲。', recommendation: '確認 robots.txt 沒有封鎖需要放行的 AI 爬蟲。' },
  { id: 'sitemap', name: 'Sitemap.xml', icon: '🗺️', priority: 'P2', description: '站台層是否提供 sitemap.xml。', recommendation: '建立 sitemap.xml 並收錄重要頁面。' },
  { id: 'open_graph', name: 'Open Graph', icon: '🔗', priority: 'P2', description: '頁面是否提供完整 Open Graph 摘要。', recommendation: '替頁面補齊 Open Graph 標籤。' },
  { id: 'twitter_card', name: 'Twitter Card', icon: '🐦', priority: 'P3', description: '頁面是否提供 Twitter Card 標籤。', recommendation: '補上 twitter:card、twitter:title、twitter:image。' },
  { id: 'json_ld_citation', name: 'JSON-LD 引用信號', icon: '📜', priority: 'P2', description: 'JSON-LD 是否包含 author、publisher、datePublished 等引用信號。', recommendation: '在 JSON-LD 補上作者、發布者與發布日期。' },
  { id: 'canonical', name: 'Canonical 標籤', icon: '🔒', priority: 'P1', description: '是否指定正確引用來源 URL。', recommendation: '在每頁 head 設置 canonical URL。' },
  { id: 'https', name: 'HTTPS 安全連線', icon: '🔐', priority: 'P1', description: '頁面是否使用 HTTPS。', recommendation: '確保網站全站使用有效 HTTPS。' },
  { id: 'lastmod_passed', name: '內容新鮮度（lastmod）', icon: '🕒', priority: 'P1', description: '頁面是否提供近期更新時間；此訊號目前不計入 GEO 主分數。', recommendation: '加入 dateModified 或 article:modified_time，並定期更新內容。' },
]

const EEAT_META = [
  { id: 'author_info', name: '作者資訊', icon: '✍️', priority: 'P1', description: '頁面是否有可識別作者或署名。', recommendation: '加入作者姓名與可驗證的專業資訊。' },
  { id: 'about_page', name: '關於我們頁面', icon: '🏢', priority: 'P1', description: '網站是否有清楚的品牌或組織介紹。', recommendation: '建立關於頁並說明公司背景與核心服務。' },
  { id: 'contact_page', name: '聯絡方式', icon: '📞', priority: 'P1', description: '網站是否提供可見的電話、Email 或聯絡頁。', recommendation: '建立聯絡頁，提供可驗證的聯絡資訊。' },
  { id: 'privacy_policy', name: '隱私權政策', icon: '🔏', priority: 'P2', description: '網站是否有隱私權政策頁面。', recommendation: '建立隱私權政策並從頁尾連結。' },
  { id: 'organization_schema', name: 'Organization Schema', icon: '🏷️', priority: 'P2', description: '是否有 Organization 或 LocalBusiness 結構化資料。', recommendation: '加入包含 name、url、logo、contactPoint 的 Organization schema。' },
  { id: 'date_published', name: '內容發布日期', icon: '📅', priority: 'P2', description: '是否標示發布或更新日期。', recommendation: '加入 datePublished、dateModified 或 time 元素。' },
  { id: 'social_links', name: '社群媒體連結', icon: '📱', priority: 'P3', description: '是否連結品牌的官方社群帳號。', recommendation: '從網站連到官方社群並保持品牌名稱一致。' },
  { id: 'outbound_links', name: '外部權威連結', icon: '🔗', priority: 'P3', description: '內容是否引用外部可信來源。', recommendation: '引用官方資料、研究或可信媒體並附連結。' },
]

const NOT_CHECKED = { passed: true, detail: '此次未檢測（爬蟲被擋導致無法分析頁面內容）' }

export function resolveHealthTab(value) {
  return HEALTH_TABS.some(tab => tab.key === value) ? value : 'seo'
}

export function healthAuditKeys(tab) {
  if (tab === 'crawl') return ['seo', 'geo']
  if (tab === 'schema') return ['aeo', 'geo', 'eeat']
  return HEALTH_TABS.some(item => item.key === tab && item.auditKey) ? [tab] : ['seo']
}

function booleanChecks(meta, audit) {
  if (!audit) return []
  return meta.map(check => ({
    ...check,
    passed: !!audit[check.id],
    detail: check.description,
  }))
}

function buildSeoChecks(audit) {
  if (!audit) return []
  const partial = audit?.bot_accessibility?.blocked === true && !audit?.meta_tags
  const values = {
    meta_title() {
      if (partial) return NOT_CHECKED
      const content = audit?.meta_tags?.titleContent
      if (!content) return { passed: false, detail: '未設置 Meta 標題' }
      const verdict = metaLengthVerdict(content, 'title')
      if (verdict.verdict === 'short') return { passed: false, detail: `標題過短（${verdict.chars} 字），建議至少 ${verdict.min} 字` }
      if (verdict.verdict === 'long') return { passed: false, detail: `標題過長（${verdict.chars} 字），建議縮短至 ${verdict.max} 字以內` }
      return { passed: true, detail: `「${content.length > 35 ? content.substring(0, 35) + '…' : content}」（${verdict.chars} 字）` }
    },
    meta_desc() {
      if (partial) return NOT_CHECKED
      // 明確分語言 + 字數 + 判定（中 40–80 字／英 70–155 字元），與 AEO 分頁同一支
      return metaDescFindingDetail(audit?.meta_tags?.descriptionContent)
    },
    h1_structure() {
      if (partial) return NOT_CHECKED
      const count = audit?.h1_structure?.h1Count ?? 0
      if (count === 0) return { passed: false, scenario: 'missing', detail: '頁面沒有 H1 標題（page builder 預設常用 div 代替）' }
      if (count > 1) return { passed: false, scenario: 'too_many', detail: `頁面有 ${count} 個 H1 標題，應只有 1 個` }
      return { passed: true, detail: `頁面有 1 個 H1：「${audit?.h1_structure?.h1Content || '內容未回傳'}」` }
    },
    alt_tags() {
      if (partial) return NOT_CHECKED
      const total = audit?.alt_tags?.totalImages ?? 0
      const coverage = audit?.alt_tags?.altCoverage ?? 100
      const missing = audit?.alt_tags?.imagesWithoutAlt ?? 0
      if (total === 0) return { passed: true, detail: '頁面無圖片，無需設置' }
      return coverage < 80
        ? { passed: false, detail: `${total} 張圖片中 ${missing} 張缺少 Alt（覆蓋率 ${coverage}%）` }
        : { passed: true, detail: `${total} 張圖片，覆蓋率 ${coverage}%` }
    },
    mobile_compatible() {
      if (partial) return NOT_CHECKED
      const mobile = audit?.mobile_compatible
      const labels = [mobile?.hasViewport && 'viewport', mobile?.hasMediaQueries && '@media query', mobile?.hasRwdFramework && 'RWD 框架'].filter(Boolean)
      if (labels.length === 0) return { passed: false, detail: '未偵測到 viewport、media query 或 RWD 框架' }
      return { passed: true, warning: !mobile?.hasViewport, detail: `偵測到 ${labels.join(' + ')}${mobile?.hasViewport ? '，支援行動裝置' : '，但建議補上 viewport meta'}` }
    },
    page_speed() {
      if (partial) return NOT_CHECKED
      const loadTime = audit?.page_speed?.loadTime
      const grade = audit?.page_speed?.speedGrade
      if (!loadTime) return { passed: false, detail: '無法測量載入速度' }
      return loadTime > 3000
        ? { passed: false, detail: `${loadTime}ms（${grade || '未分級'}），超過 3 秒建議值` }
        : { passed: true, detail: `${loadTime}ms（${grade || '未分級'}）` }
    },
    ssl_chain() {
      if (partial) return NOT_CHECKED
      const ssl = audit?.ssl_chain
      if (!ssl) return { passed: true, detail: '此次掃描未檢測（請重新檢測）' }
      return ssl.passed
        ? { passed: true, detail: 'SSL 憑證鏈完整，爬蟲可正常連線' }
        : { passed: false, detail: 'SSL 憑證鏈不完整，嚴格爬蟲可能拒絕連線' }
    },
    bot_accessibility() {
      const bot = audit?.bot_accessibility
      if (!bot) return { passed: true, detail: '此次掃描未檢測（請重新檢測）' }
      if (bot.blocked) return { passed: false, detail: '三種爬蟲身份都被擋，AI 爬蟲可能無法讀取這一頁' }
      if (bot.fallback) return { passed: true, warning: true, detail: '部分爬蟲身份被擋，anti-bot 設定可能偏嚴' }
      return { passed: true, detail: '爬蟲可正常存取這一頁' }
    },
  }

  return SEO_META.map(check => ({ ...check, ...values[check.id]() }))
}

function buildAeoChecks(audit, isHomepage = false, seoDescText = null) {
  const checks = booleanChecks(AEO_META, audit)
  // meta_desc_length：用實際描述文字算出「分語言 + 字數 + 判定」明確說明；有文字才覆蓋（連 passed，讓顯示自洽）
  const metaCheck = checks.find(check => check.id === 'meta_desc_length')
  if (metaCheck && seoDescText != null) {
    const d = metaDescFindingDetail(seoDescText)
    metaCheck.passed = d.passed
    metaCheck.detail = d.detail
  }
  const faq = checks.find(check => check.id === 'faq_schema')
  if (faq && !faq.passed && audit?.faq_visual) {
    faq.detail = '偵測到頁面有 FAQ 區塊，但缺 FAQPage schema；人看得到，機器不一定能正確理解。'
  }
  // 頁型判斷：首頁本來就不該有麵包屑/FAQ schema（那是內頁／FAQ 頁的事）。
  // 現階段只改「說明文字」正常化，不動 passed / 分數 —— 因為分數用的是掃描存好的 audit.score，
  // 若這裡把 passed 翻成 true 會與分數脫鉤（board 全綠、分數卻被扣）。
  // 讓首頁不因缺這兩項被扣分，屬 analyzer 層改動（見 AGENTS.md 頁型判斷第 2 步），另做。
  // 例外：首頁若真的有 FAQ 區塊（faq_visual），那是「該補 schema」的真問題，不套正常化說明。
  if (isHomepage) {
    for (const check of checks) {
      if (!HOMEPAGE_NOTES[check.id] || check.passed) continue
      if (check.id === 'faq_schema' && audit?.faq_visual) continue
      check.detail = HOMEPAGE_NOTES[check.id]
    }
  }
  return checks
}

export function buildHealthChecks(tab, audits = {}, isHomepage = false) {
  // AEO 的 meta 描述字數要靠 SEO audit 存的實際描述文字來算（aeo_audits 只存 boolean）
  const seoDescText = audits.seo?.meta_tags?.descriptionContent ?? null
  if (tab === 'seo') return buildSeoChecks(audits.seo)
  if (tab === 'aeo') return buildAeoChecks(audits.aeo, isHomepage, seoDescText)
  if (tab === 'geo') return booleanChecks(GEO_META, audits.geo)
  if (tab === 'eeat') return booleanChecks(EEAT_META, audits.eeat)
  if (tab === 'crawl') {
    const seo = buildSeoChecks(audits.seo)
    const geo = booleanChecks(GEO_META, audits.geo)
    const byId = new Map([...seo, ...geo].map(check => [check.id, check]))
    return ['bot_accessibility', 'ssl_chain', 'robots_ai', 'sitemap', 'llms_txt'].map(id => byId.get(id)).filter(Boolean)
  }
  if (tab === 'schema') {
    const aeo = buildAeoChecks(audits.aeo, isHomepage, seoDescText)
    const geo = booleanChecks(GEO_META, audits.geo)
    const eeat = booleanChecks(EEAT_META, audits.eeat)
    const byId = new Map([...aeo, ...geo, ...eeat].map(check => [check.id, check]))
    return ['json_ld', 'faq_schema', 'canonical', 'breadcrumbs', 'open_graph', 'json_ld_citation', 'organization_schema'].map(id => byId.get(id)).filter(Boolean)
  }
  return buildSeoChecks(audits.seo)
}
