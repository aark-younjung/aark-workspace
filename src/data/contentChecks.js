/**
 * 文章分析的檢測項定義與 DB 轉換（2026-09-08 從 pages/ContentAudit.jsx 抽出）
 *
 * 為什麼要抽出來：同一份判定標準有兩個使用端——
 *   - pages/ContentAudit.jsx        公開的 ad-hoc 任意網址分析（深色）
 *   - components/appshell/AppContent.jsx  綁定網站的 app-shell 版（亮色）
 * 留在頁面檔裡兩邊都要 import 一個「元件檔」，eslint 的 react-refresh 規則也會擋
 * （元件檔只該匯出元件）。更重要的是：這份標準複製成兩份，遲早會不一致。
 */

export const CONTENT_CHECKS = [
  {
    id: 'h1', category: '內容結構', icon: '📖',
    label: '單一 H1 標題', priority: 'P1',
    desc: '每篇文章應只有一個 H1，清楚說明主題',
    get: r => r.heading.hasProperH1,
    detail: r => r.heading.h1Count === 0 ? '找不到 H1 標題' : r.heading.h1Count > 1 ? `有 ${r.heading.h1Count} 個 H1（應只有 1 個）` : `「${r.heading.h1Content?.slice(0, 40)}${r.heading.h1Content?.length > 40 ? '...' : ''}」`,
    fix: '確保文章只有一個主標題 <h1>，其他層級用 <h2>、<h3>',
  },
  {
    id: 'h2', category: '內容結構', icon: '🗂️',
    label: 'H2 段落結構', priority: 'P2',
    desc: '至少 2 個 H2 子標題，幫助 AI 理解文章架構',
    get: r => r.heading.hasH2Structure,
    detail: r => `目前有 ${r.heading.h2Count} 個 H2 標題`,
    fix: '將文章分成多個段落，每段用 <h2> 標題，建議至少 2 個',
  },
  {
    id: 'question', category: '內容結構', icon: '❓',
    label: '問句式標題', priority: 'P2',
    desc: '「什麼是...？」「如何...？」格式的標題最容易被 AI 引用為答案',
    get: r => r.heading.hasQuestionHeadings,
    detail: r => `目前有 ${r.heading.questionHeadings} 個問句式 H2/H3`,
    fix: '將部分子標題改為問句，例如「什麼是 SEO？」「如何提升排名？」',
  },
  {
    id: 'wordcount', category: '字數與深度', icon: '📝',
    label: '字數達 800 字以上', priority: 'P1',
    desc: 'AI 傾向引用有足夠深度的長篇內容',
    get: r => r.wordCount.isLongForm,
    detail: r => `目前約 ${r.wordCount.totalWords.toLocaleString()} 字${r.wordCount.isDeep ? '（優秀！超過 1500 字）' : ''}`,
    fix: '擴充文章內容，加入具體案例、數據或步驟說明，目標 800 字以上',
  },
  {
    id: 'directanswer', category: '字數與深度', icon: '💡',
    label: '首段直接給出答案', priority: 'P1',
    desc: 'AI 偏好在文章開頭就直接回答問題的寫法',
    get: r => r.aeo.hasDirectAnswer,
    detail: r => r.aeo.hasDirectAnswer ? '首段結構良好，適合被 AI 擷取' : '首段過長或過短，不易被 AI 擷取為直接答案',
    fix: '文章第一段（30–200 字）直接說明核心答案，之後再展開細節',
  },
  {
    id: 'title', category: 'Meta 標籤', icon: '🏷️',
    label: 'Meta 標題（中文 15–30 字）', priority: 'P1',
    desc: '搜尋結果的第一印象，長度符合規範才不會被截斷',
    get: r => r.meta.hasTitleOptimal,
    detail: r => r.meta.title ? `「${r.meta.title.slice(0, 35)}${r.meta.title.length > 35 ? '...' : ''}」（${r.meta.titleLength} 字）` : '未設置 Meta 標題',
    fix: '設置 <title> 標籤，長度中文 15–30 字（英文 30–60 字元），將主要關鍵字放在前半段',
  },
  {
    id: 'desc', category: 'Meta 標籤', icon: '📄',
    label: 'Meta 描述（中文 40–80 字）', priority: 'P1',
    desc: '搜尋結果摘要，好的描述能提升點擊率',
    get: r => r.meta.hasDescOptimal,
    detail: r => r.meta.description ? `${r.meta.descLength} 字` : '未設置 Meta 描述',
    fix: '在 <head> 加入 <meta name="description" content="..."，中文 40–80 字（英文 70–155 字元），自然帶入關鍵字並加入行動呼籲',
  },
  {
    id: 'ogimage', category: 'Meta 標籤', icon: '🖼️',
    label: 'OG 圖片', priority: 'P3',
    desc: '社群分享時顯示的預覽圖，影響點擊意願',
    get: r => r.meta.hasOgImage,
    detail: r => r.meta.hasOgImage ? 'og:image 已設置' : '未設置 og:image',
    fix: '在 <head> 加入 <meta property="og:image" content="圖片網址">，建議尺寸 1200×630px',
  },
  {
    id: 'articleschema', category: 'AEO 結構化資料', icon: '📋',
    label: 'Article Schema', priority: 'P1',
    desc: '讓 Google 和 AI 明確知道這是一篇文章，並了解作者與發布時間',
    get: r => r.aeo.hasArticleSchema,
    detail: r => r.aeo.hasArticleSchema ? `已有 Article Schema${r.aeo.hasAuthorInSchema ? '（含作者資訊）' : '（缺少作者欄位）'}` : '未找到 Article / BlogPosting Schema',
    fix: '在 <head> 加入 JSON-LD Article schema，包含 headline、author、datePublished、image 欄位',
  },
  {
    id: 'faqschema', category: 'AEO 結構化資料', icon: '❔',
    label: 'FAQ Schema', priority: 'P2',
    desc: '讓 Google 在搜尋結果展開問答，AI 也更容易引用',
    get: r => r.aeo.hasFaqSchema,
    detail: r => r.aeo.hasFaqSchema ? 'FAQPage Schema 已存在' : '未找到 FAQPage Schema',
    fix: '在文章底部加入 FAQ 區塊，並以 FAQPage JSON-LD 標記，每個問答都包含 Question 和 Answer',
  },
  {
    id: 'author', category: '可信度（E-E-A-T）', icon: '👤',
    label: '作者資訊', priority: 'P2',
    desc: '顯示作者姓名或署名，增強 Google 對內容可信度的判斷',
    get: r => r.author.hasAuthorElement,
    detail: r => r.author.hasAuthorElement ? '找到作者資訊元素' : '找不到作者署名',
    fix: '在文章標題下方加入作者姓名，使用 <span class="author"> 或 <a rel="author">',
  },
  {
    id: 'date', category: '可信度（E-E-A-T）', icon: '📅',
    label: '發布日期', priority: 'P2',
    desc: '讓讀者和 AI 知道內容的時效性',
    get: r => r.author.hasPublishDate,
    detail: r => r.author.hasPublishDate ? '找到發布日期元素' : '找不到發布日期',
    fix: '在文章加入 <time datetime="2024-01-01"> 標籤標記發布日期',
  },
  {
    id: 'alttext', category: '可信度（E-E-A-T）', icon: '🖼️',
    label: '圖片 Alt 覆蓋率 ≥ 80%', priority: 'P2',
    desc: 'Alt 文字幫助 AI 理解圖片內容，也提升無障礙性',
    get: r => r.images.passed,
    detail: r => r.images.total === 0 ? '頁面沒有圖片' : `${r.images.withAlt}/${r.images.total} 張有 Alt（${r.images.coverage}%）`,
    fix: '為每張圖片加入描述性的 alt 屬性，例如 alt="2024年台北辦公室外觀"',
  },
  {
    id: 'internallinks', category: '可信度（E-E-A-T）', icon: '🔗',
    label: '內部連結（≥ 2 個）', priority: 'P3',
    desc: '連結到站內其他相關文章，幫助 AI 理解你網站的主題深度',
    get: r => r.links.hasInternalLinks,
    detail: r => `找到 ${r.links.internal} 個內部連結`,
    fix: '在文章內自然地連結到其他相關文章或頁面，建議至少 2–3 個',
  },
  {
    id: 'readability', category: '可讀性', icon: '✍️',
    label: '段落易讀（平均 ≤ 200 字）', priority: 'P2',
    desc: '段落過長不易閱讀，也不利於 AI 擷取重點',
    get: r => r.readability.hasGoodReadability,
    detail: r => r.readability.paragraphCount > 0 ? `平均段落長度 ${r.readability.avgLength} 字（${r.readability.paragraphCount} 個段落）` : '無法分析段落',
    fix: '每個段落控制在 150 字以內，一個段落只講一個重點',
  },
]

// DB row → analyzeContent() return shape（給 ScoreHero / IssueBoard / ContentSignature 共用）
// 欄位對應 content_audits.sql + analyzeContent() output
export function dbRowToResult(row, websiteUrl) {
  if (!row) return null
  return {
    url: websiteUrl,
    score: row.score,
    heading: row.heading,
    wordCount: row.word_count,
    meta: row.meta,
    aeo: row.aeo,
    author: row.author,
    images: row.images,
    links: row.links,
    outbound: row.outbound,
    multimedia: row.multimedia,
    readability: row.readability,
    readingMinutes: row.reading_minutes,
  }
}