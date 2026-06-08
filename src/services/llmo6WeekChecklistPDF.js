/**
 * LLMO 6 週執行清單 PDF 匯出（2026-06-08 重寫為 pdfmake / 真文字版）
 *
 * 設計動機：原本用 html2canvas 把整頁變成圖片、不能選取/搜尋/複製、
 *   客戶想複製 robots.txt / Schema 程式碼也得手打。
 *   改用 pdfmake JSON DSL 渲染為真文字 PDF：
 *     - Ctrl+F 可搜尋
 *     - 選取 + 複製可正常用（特別是 robots.txt / llms.txt / Schema 範本）
 *     - 檔案大幅縮小（從 ~500 KB 降至 ~50 KB；不含字體 11 MB lazy load）
 *
 * 字體：Noto Sans TC（lazy load、見 pdfMakeLoader.js）
 * 視覺：保留 Aark 品牌色（綠 #18c590）+ 訊號層配色、漸層改為純色或 canvas 模擬
 *
 * 結構：10 section（cover / intro / week 1-6 / appendix A / B）
 */
import { getPdfMake } from './pdfMakeLoader'

// ─── 品牌色 ───
const COL_GREEN = '#18c590'  // Aark 主品牌綠
const COL_DARK = '#1e293b'  // 主文字色
const COL_MID = '#475569'  // 次要文字色
const COL_LIGHT = '#64748b'  // 提示文字色
const COL_BORDER = '#e2e8f0'  // 分隔線色
const COL_BG_GRAY = '#f8fafc'  // 區塊淺底色
const COL_BG_CODE = '#0f172a'  // 程式碼區塊深底
const COL_TEXT_CODE = '#e2e8f0'  // 程式碼文字色
const COL_BG_WARNING = '#fef3c7'  // 警告框底色
const COL_TEXT_WARNING = '#78350f'  // 警告框文字色
const COL_BG_VERIFY = '#ecfdf5'  // 驗收框底色
const COL_TEXT_VERIFY = '#065f46'  // 驗收框文字色

// 4 大訊號層代表色
const LAYER_COLOR = {
  SEO: '#3b82f6', AEO: '#8b5cf6', GEO: '#10b981', 'E-E-A-T': '#f59e0b',
}

// 分數對應顏色
function scoreColor(score) {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

// ─── pdfmake DSL helper：產生用 canvas 畫的矩形（背景塊用） ───
function rect(x, y, w, h, color) {
  return { type: 'rect', x, y, w, h, color }
}

// ─── helper：週次標題列（左 badge + 右標題 + 副標） ───
function weekHeader(num, title, subtitle, accent) {
  return {
    stack: [
      {
        columns: [
          {
            // 數字 badge — 用 canvas 畫底色方塊 + 疊文字
            width: 60,
            stack: [
              {
                canvas: [{ type: 'rect', x: 0, y: 0, w: 60, h: 60, color: accent, r: 10 }],
              },
              {
                text: `WEEK\n${num}`,
                alignment: 'center',
                color: '#ffffff',
                fontSize: 18,
                bold: true,
                lineHeight: 1.1,
                margin: [0, -50, 0, 0],
              },
            ],
          },
          {
            width: '*',
            stack: [
              { text: title, fontSize: 22, bold: true, color: COL_DARK, margin: [12, 4, 0, 4] },
              { text: subtitle, fontSize: 11, color: COL_LIGHT, margin: [12, 0, 0, 0] },
            ],
          },
        ],
      },
      // 下底彩色分隔線
      {
        canvas: [{ type: 'line', x1: 0, y1: 8, x2: 482, y2: 8, lineWidth: 2, lineColor: accent }],
        margin: [0, 6, 0, 14],
      },
    ],
  }
}

// ─── helper：任務表格 ───
function taskTable(rows) {
  return {
    table: {
      headerRows: 1,
      widths: ['*', 70, 220],
      body: [
        [
          { text: '任務', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          { text: '預估時間', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          { text: '怎麼做', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
        ],
        ...rows.map(r => [
          { text: r.task, color: COL_DARK, fontSize: 10.5, bold: true, margin: [6, 8, 6, 8] },
          { text: r.time, color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
          { text: r.how, color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
        ]),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => COL_BORDER,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 10, 0, 10],
  }
}

// ─── helper：程式碼區塊（深底白字、保留換行） ───
function codeBlock(content, label = '') {
  return {
    stack: [
      label ? { text: label, fontSize: 9, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 4] } : null,
      {
        table: {
          widths: ['*'],
          body: [[
            {
              text: content,
              color: COL_TEXT_CODE,
              fontSize: 9.5,
              lineHeight: 1.5,
              fillColor: COL_BG_CODE,
              margin: [14, 12, 14, 12],
              preserveLeadingSpaces: true,
            },
          ]],
        },
        layout: 'noBorders',
      },
    ].filter(Boolean),
    margin: [0, 4, 0, 10],
  }
}

// ─── helper：驗收 checklist 框 ───
function verifyBox(items) {
  return {
    table: {
      widths: ['*'],
      body: [[
        {
          stack: [
            { text: '本週驗收', fontSize: 10, bold: true, color: COL_TEXT_VERIFY, characterSpacing: 1, margin: [0, 0, 0, 6] },
            ...items.map(it => ({
              columns: [
                { width: 14, text: '✓', color: COL_GREEN, bold: true, fontSize: 11 },
                { width: '*', text: it, color: COL_DARK, fontSize: 10.5, lineHeight: 1.5 },
              ],
              margin: [0, 2, 0, 2],
            })),
          ],
          fillColor: COL_BG_VERIFY,
          margin: [16, 14, 16, 14],
          // 左邊綠色粗線靠 canvas 模擬
        },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  }
}

// ─── helper：警告框（淺黃底 + 警告色文字） ───
function warningBox(title, content) {
  return {
    table: {
      widths: ['*'],
      body: [[
        {
          stack: [
            { text: title, fontSize: 10.5, bold: true, color: '#92400e', margin: [0, 0, 0, 6] },
            { text: content, fontSize: 10.5, color: COL_TEXT_WARNING, lineHeight: 1.7 },
          ],
          fillColor: COL_BG_WARNING,
          margin: [16, 14, 16, 14],
        },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 12],
  }
}

// ═══════════════════════════════════════════════════════════════
// Section 1：封面
// ═══════════════════════════════════════════════════════════════
function buildCoverContent(clientInfo, baselineScores) {
  const { clientName = '', agencyName = '', agencyContact = '', startDate } = clientInfo || {}
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

  const hasBaseline = baselineScores && (baselineScores.seo || baselineScores.aeo || baselineScores.geo || baselineScores.eeat)
  const overall = hasBaseline
    ? Math.round(((baselineScores.seo || 0) + (baselineScores.aeo || 0) + (baselineScores.geo || 0) + (baselineScores.eeat || 0)) / 4)
    : null

  // 封面用白底（pdfmake 不好搞深底全頁渲染、改用內容區塊呈現品牌感）
  // 透過 Aark 綠色粗線 + 大字體 + 訊號層色塊建立視覺
  return [
    // 上：品牌 wordmark 列
    {
      columns: [
        { width: 60, canvas: [{ type: 'rect', x: 0, y: 0, w: 50, h: 50, color: COL_GREEN, r: 10 }] },
        {
          width: '*',
          stack: [
            { text: 'Aark', fontSize: 32, bold: true, color: COL_DARK, margin: [10, -2, 0, 0] },
            { text: 'AI 雷達 · LLMO 監測平台', fontSize: 11, color: COL_LIGHT, margin: [10, 0, 0, 0] },
          ],
        },
      ],
      margin: [0, 0, 0, 50],
    },

    // 報告類型 badge
    {
      table: {
        widths: ['auto'],
        body: [[{
          text: 'EXECUTION ROADMAP',
          fontSize: 9,
          color: COL_GREEN,
          characterSpacing: 1.5,
          bold: true,
          fillColor: '#ecfdf5',
          margin: [12, 5, 12, 5],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 24],
    },

    // 主標題
    { text: 'LLMO 6 週執行清單', fontSize: 42, bold: true, color: COL_DARK, lineHeight: 1.1, margin: [0, 0, 0, 8] },
    { text: 'Make Your Brand Visible to AI · 6-Week Roadmap', fontSize: 16, color: COL_LIGHT, margin: [0, 0, 0, 40] },

    // 客戶資訊區
    clientName ? {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: '為您製作 · Prepared For', fontSize: 9, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 4] },
            { text: clientName, fontSize: 24, bold: true, color: COL_DARK },
          ],
          fillColor: COL_BG_GRAY,
          margin: [18, 16, 18, 16],
        }]],
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: (i) => i === 0 ? 4 : 0,
        vLineColor: () => COL_GREEN,
      },
      margin: [0, 0, 0, 24],
    } : null,

    // Week 0 起跑分數
    hasBaseline ? {
      stack: [
        { text: 'WEEK 0 · 起跑點分數', fontSize: 9, color: COL_LIGHT, characterSpacing: 1.5, bold: true, margin: [0, 0, 0, 10] },
        {
          columns: [
            { width: 80, alignment: 'center', stack: [
              { text: String(overall), fontSize: 44, bold: true, color: scoreColor(overall), lineHeight: 1 },
              { text: '綜合分數', fontSize: 9, color: COL_LIGHT, margin: [0, 4, 0, 0] },
            ]},
            { width: '*', columns: [
              { width: '*', alignment: 'center', stack: [
                { text: String(baselineScores.seo || 0), fontSize: 22, bold: true, color: scoreColor(baselineScores.seo || 0) },
                { text: 'SEO', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 2, 0, 0] },
              ]},
              { width: '*', alignment: 'center', stack: [
                { text: String(baselineScores.aeo || 0), fontSize: 22, bold: true, color: scoreColor(baselineScores.aeo || 0) },
                { text: 'AEO', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 2, 0, 0] },
              ]},
              { width: '*', alignment: 'center', stack: [
                { text: String(baselineScores.geo || 0), fontSize: 22, bold: true, color: scoreColor(baselineScores.geo || 0) },
                { text: 'GEO', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 2, 0, 0] },
              ]},
              { width: '*', alignment: 'center', stack: [
                { text: String(baselineScores.eeat || 0), fontSize: 22, bold: true, color: scoreColor(baselineScores.eeat || 0) },
                { text: 'E-E-A-T', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 2, 0, 0] },
              ]},
            ]},
          ],
          margin: [0, 4, 0, 0],
        },
      ],
      margin: [0, 0, 0, 0],
    } : null,

    // 占位、把 footer 推到底
    { text: '', margin: [0, 60, 0, 0] },

    // Footer 區
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 482, y2: 0, lineWidth: 0.5, lineColor: COL_BORDER }],
      margin: [0, 0, 0, 12],
    },
    {
      columns: [
        { width: '*', stack: [
          agencyName ? { text: '提交者 · Prepared By', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 3] } : null,
          agencyName ? { text: agencyName, fontSize: 13, bold: true, color: COL_DARK } : null,
          agencyContact ? { text: agencyContact, fontSize: 10, color: COL_LIGHT, margin: [0, 2, 0, 0] } : null,
        ].filter(Boolean) },
        { width: 'auto', alignment: 'right', stack: [
          { text: '起跑日 · Kickoff', fontSize: 8, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 3] },
          { text: dateStr, fontSize: 11, color: COL_DARK },
        ]},
      ],
    },
  ].filter(Boolean)
}

// ═══════════════════════════════════════════════════════════════
// Section 2：為什麼是 6 週 + 排除誤會
// ═══════════════════════════════════════════════════════════════
function buildIntroContent() {
  return [
    { text: '00 · INTRODUCTION', fontSize: 9, color: COL_LIGHT, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
    { text: '為什麼是 6 週？', fontSize: 24, bold: true, color: COL_DARK, margin: [0, 0, 0, 14] },

    { text: 'LLM 對網站的重新評估有滯後性：', fontSize: 11.5, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 6] },
    {
      ul: [
        { text: [
          { text: '搜尋型 AI', bold: true, color: COL_DARK },
          { text: '（Perplexity / ChatGPT Search / Gemini）：2-4 週看到效果' },
        ], fontSize: 11, color: COL_MID, lineHeight: 1.7 },
        { text: [
          { text: '模型型 AI', bold: true, color: COL_DARK },
          { text: '（純 ChatGPT 對話）：2-8 週甚至更久（要等下一輪訓練）' },
        ], fontSize: 11, color: COL_MID, lineHeight: 1.7 },
      ],
      margin: [0, 0, 0, 14],
    },
    {
      text: '6 週剛好涵蓋第一輪 AI 重新檢索的完整週期、是評估「方向對不對」的最短可信窗口。',
      fontSize: 11.5, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 20],
    },

    warningBox('⚠️ 開工前先排除一個常見誤會', [
      '跟 AI 對話「教它認識你品牌」、',
      { text: '只會影響你自己帳號的對話', bold: true },
      '、對其他用戶 0 影響。AI 不是學生、是檢索員 — 它每次答題重新去網路撿資料。要被別人問到時被推薦、必須改變網路上關於你的',
      { text: '「證據總量」', bold: true },
      '、不是改變 AI 本身。',
    ]),

    { text: '本清單怎麼用', fontSize: 15, bold: true, color: COL_DARK, margin: [0, 10, 0, 10] },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: '每週', fontSize: 9, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 4] },
            { text: '跟清單做完當週任務、不貪快', fontSize: 11, color: COL_DARK },
          ],
          margin: [0, 0, 6, 0],
          // 視覺：淺灰邊框圍住
        },
        {
          width: '*',
          stack: [
            { text: '驗收', fontSize: 9, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 4] },
            { text: '每週末用 Aark 重新檢測、對照「本週驗收」欄', fontSize: 11, color: COL_DARK },
          ],
          margin: [3, 0, 3, 0],
        },
        {
          width: '*',
          stack: [
            { text: '第 6 週', fontSize: 9, color: COL_LIGHT, characterSpacing: 1, margin: [0, 0, 0, 4] },
            { text: 'aivis 啟用、對照 Week 0 起跑分數驗收成果', fontSize: 11, color: COL_DARK },
          ],
          margin: [6, 0, 0, 0],
        },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 3：Week 1
// ═══════════════════════════════════════════════════════════════
function buildWeek1Content() {
  return [
    weekHeader(1, '健檢 + 紅燈快修', '把 Aark 5 訊號層的所有「紅燈項目」清掉、拿到一個乾淨的起跑點', LAYER_COLOR.SEO),

    taskTable([
      { task: '跑一次 Aark 完整檢測', time: '5 分鐘', how: 'Dashboard 點「🔄 重新檢測」' },
      { task: '修 SEO 紅燈（Meta / H1 / Alt）', time: '1-3 小時', how: '跟著「修復指南」逐項做' },
      { task: '修 robots.txt（不擋 AI 爬蟲）', time: '10 分鐘', how: '在 /robots.txt 加 allow 規則（詳見 Week 2）' },
      { task: '修 sitemap.xml（涵蓋所有重要頁）', time: '30 分鐘', how: 'WordPress 用 Rank Math / Yoast 自動產' },
      { task: '修完後點「我已修好」', time: '隨手', how: '記錄修復事件、+5 XP、可追蹤趨勢' },
    ]),

    { text: '為什麼從這裡開始', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 18, 0, 6] },
    {
      text: '90% 的台灣中小企業網站在「基礎結構」就已經漏分。在做任何進階優化之前、先把這些一定要修的紅燈處理掉、後面才有意義。這週通常只需要 4-6 小時、但分數可以從 50 跳到 70+。',
      fontSize: 11, color: COL_MID, lineHeight: 1.7,
    },

    verifyBox([
      'Aark 綜合分數 ≥ 70',
      '所有紅燈項目轉黃或綠',
      '至少觸發 5 筆「我已修好」記錄',
    ]),
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 4：Week 2 — AI 爬蟲開放 + llms.txt
// ═══════════════════════════════════════════════════════════════
function buildWeek2Content() {
  return [
    weekHeader(2, 'AI 爬蟲開放 + llms.txt', '明確告訴所有 AI「你可以來抓我、這是我的主題地圖」', LAYER_COLOR.GEO),

    { text: '任務 2.1：robots.txt 開放 AI 爬蟲', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 4] },
    { text: '把這段加到 /robots.txt：', fontSize: 11, color: COL_MID, margin: [0, 0, 0, 6] },

    codeBlock(
      `User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: anthropic-ai\nAllow: /`,
      'ROBOTS.TXT'
    ),

    { text: 'ⓘ 如果只想被 AI 搜尋引用但不想被當訓練資料、可擇優開放 PerplexityBot 但擋 GPTBot。一般中小企業建議全開、這時段曝光 > 擔心被「免費訓練」。', fontSize: 9.5, color: COL_LIGHT, lineHeight: 1.6, italics: true, margin: [0, 4, 0, 18] },

    { text: '任務 2.2：建 llms.txt', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 4] },
    { text: '在根目錄放純文字檔（不是 HTML）：', fontSize: 11, color: COL_MID, margin: [0, 0, 0, 6] },

    codeBlock(
      `# {公司名稱}\n\n> {一句話描述你在做什麼、賣什麼、給誰}\n\n## 核心產品/服務\n\n- [產品 A 名稱]({URL}) — 一句話描述\n- [產品 B 名稱]({URL}) — 一句話描述\n\n## 重要內容\n\n- [服務據點]({URL})\n- [常見問題]({URL})\n- [關於我們]({URL})\n\n## 聯絡方式\n\n- Email: ...\n- 電話: ...`,
      'LLMS.TXT'
    ),

    { text: 'ⓘ 這檔給 AI 看的「網站索引」、跟 sitemap.xml 互補。部分 AI（特別是 Perplexity）會優先抓這個檔來理解你。', fontSize: 9.5, color: COL_LIGHT, lineHeight: 1.6, italics: true, margin: [0, 4, 0, 0] },

    verifyBox([
      'yourdomain.com/robots.txt 開瀏覽器看得到 AI 爬蟲規則',
      'yourdomain.com/llms.txt 開瀏覽器看得到內容',
      'Aark 的 GEO 分數至少上升 15 分',
    ]),
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 5：Week 3 — Schema 三件套
// ═══════════════════════════════════════════════════════════════
function buildWeek3Content() {
  return [
    weekHeader(3, 'Schema 三件套', '讓 AI 不只看到你、還能直接抓你的答案來回應用戶', LAYER_COLOR.AEO),

    {
      text: [
        '技術含量最高的一週、但完成後 AEO 分數通常會跳 30+ 分。三件套：',
        { text: 'Organization / Product / FAQ', bold: true, color: COL_DARK },
        '。',
      ],
      fontSize: 11.5, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 16],
    },

    { text: 'A. Organization Schema（首頁放一次就夠）', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 4] },
    { text: '告訴 AI「你是誰、做什麼的、可信度怎樣」：', fontSize: 11, color: COL_MID, margin: [0, 0, 0, 6] },
    codeBlock(`<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{公司名稱}",
  "url": "{首頁 URL}",
  "logo": "{Logo URL}",
  "description": "{一句話描述}",
  "sameAs": [
    "{Facebook URL}",
    "{Instagram URL}",
    "{LINE 官方帳號 URL}"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "{電話}",
    "contactType": "customer service",
    "areaServed": "TW"
  }
}
</script>`),

    { text: 'B. Product Schema（每個商品頁一份）', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 12, 0, 6] },
    {
      text: [
        '電商必加。重點欄位：',
        { text: ' name / image / description / brand / offers.price / offers.priceCurrency / aggregateRating', color: COL_DARK, bold: true },
        '。WordPress + WooCommerce 通常自動產、但要檢查是否完整。',
      ],
      fontSize: 11, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 0],
    },

    { text: 'C. FAQ Schema（核心內容頁加上）', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 12, 0, 4] },
    {
      text: [
        { text: '這是 AI 引用率最高的 schema 類型', color: '#dc2626', bold: true },
        ' — AI 答題時直接把 FAQ 條目當答案塞進回應：',
      ],
      fontSize: 11, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 6],
    },
    codeBlock(`<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "{問題：用客戶會問的語氣寫}",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "{答案：直接、具體、含關鍵字}"
    }
  }]
}
</script>`),

    verifyBox([
      '用 Google Rich Results Test 確認 3 種 schema 都通過',
      'Aark 的 AEO 分數 ≥ 75',
      '至少 5 個核心頁、每頁至少有 1 種 schema',
    ]),
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 6：Week 4 — 內容權威化
// ═══════════════════════════════════════════════════════════════
function buildWeek4Content() {
  return [
    weekHeader(4, '內容權威化（E-E-A-T）', '讓 AI 認為你「值得引用」、而不是隨便一個賣家', LAYER_COLOR['E-E-A-T']),

    {
      text: [
        { text: 'E-E-A-T', bold: true, color: COL_DARK },
        ' = Experience（經驗）/ Expertise（專業）/ Authoritativeness（權威）/ Trustworthiness（信任）。AI 在選引用來源時會偷偷比這個。',
      ],
      fontSize: 11.5, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 16],
    },

    { text: '任務 4.1：作者 / 公司資訊頁', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    {
      ul: [
        { text: 'About 頁：「為什麼是我們、做多久了、服務多少人、創辦故事」', fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: 'Contact 頁：實體地址、電話、Email、Google Maps 嵌入', fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: '隱私權政策 + 服務條款（trust signal）', fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: '部落格文章每篇都要有作者 bio + 大頭照', fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
      ],
      margin: [0, 0, 0, 16],
    },

    { text: '任務 4.2：內容深度升級', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    { text: '挑 3 篇核心頁面、用「回答客戶會搜的問題」的思路改寫：', fontSize: 11, color: COL_MID, margin: [0, 0, 0, 8] },

    {
      table: {
        headerRows: 1,
        widths: ['*', '*'],
        body: [
          [
            { text: '❌ 改寫前', fillColor: '#fef2f2', color: '#991b1b', bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: '✅ 改寫後', fillColor: '#ecfdf5', color: '#065f46', bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          ],
          [
            { text: '精選車用 Android 安卓主機', color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: 'Honda HRV 環景安卓主機推薦 — 2026 版本完整安裝指南 + 價格', color: COL_DARK, fontSize: 10, margin: [6, 8, 6, 8] },
          ],
          [
            { text: '最新優惠', color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: '車用安卓盒子怎麼選？5 個避雷重點 + 安裝店家推薦', color: COL_DARK, fontSize: 10, margin: [6, 8, 6, 8] },
          ],
          [
            { text: '商品介紹', color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: 'Toyota 安卓機升級必看：4 種主流主機規格比較', color: COL_DARK, fontSize: 10, margin: [6, 8, 6, 8] },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => COL_BORDER,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
    },

    {
      text: [
        { text: '判斷標準', bold: true },
        '：標題裡有沒有「具體車型 + 問題 / 比較 / 推薦」這類關鍵字組合。',
      ],
      fontSize: 10.5, color: COL_LIGHT, lineHeight: 1.7, margin: [0, 12, 0, 0],
    },

    verifyBox([
      'Aark 的 E-E-A-T 分數 ≥ 70',
      '至少 3 篇權威長文（≥ 1500 字、附作者 bio、附 FAQ schema）',
      'About / Contact / Privacy 三頁都完整',
    ]),
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 7：Week 5 — 外部訊號 + 修正 AI 錯誤認知
// ═══════════════════════════════════════════════════════════════
function buildWeek5Content() {
  return [
    weekHeader(5, '外部訊號 + 修正 AI 錯誤認知', '讓「不在你網站上」的 AI 也能找到你的對的資訊', '#dc2626'),

    {
      text: [
        'AI 訓練/檢索時會抓很多第三方平台。要被 AI 引用、單靠自己網站不夠、得在 ',
        { text: 'AI 會去的地方', bold: true, color: COL_DARK },
        ' 也有你的對的資訊。',
      ],
      fontSize: 11.5, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 16],
    },

    { text: '任務 5.1：第三方平台鋪設', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: [110, '*'],
        body: [
          [
            { text: '產業', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: '主要平台', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          ],
          [{ text: '消費品 / 3C', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 6, 6, 6] }, { text: 'Mobile01、PTT、Dcard、Threads', color: COL_MID, fontSize: 10, margin: [6, 6, 6, 6] }],
          [{ text: '美食 / 餐飲', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 6, 6, 6] }, { text: 'Google Maps、IG、Threads、Yelp', color: COL_MID, fontSize: 10, margin: [6, 6, 6, 6] }],
          [{ text: '美業 / 健身', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 6, 6, 6] }, { text: 'IG、Threads、Google Maps', color: COL_MID, fontSize: 10, margin: [6, 6, 6, 6] }],
          [{ text: 'B2B 服務', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 6, 6, 6] }, { text: 'LinkedIn、Medium、自家部落格 + SEO', color: COL_MID, fontSize: 10, margin: [6, 6, 6, 6] }],
          [{ text: '旅遊 / 製造', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 6, 6, 6] }, { text: 'Tripadvisor / KKday / 行業協會目錄 / LinkedIn', color: COL_MID, fontSize: 10, margin: [6, 6, 6, 6] }],
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => COL_BORDER,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 16],
    },

    { text: '任務 5.2：Google 商家檔案', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    {
      text: [
        '實體店家必做：名稱/地址/電話/官網正確、營業時間填完整、≥ 10 張照片、鼓勵客戶留評論。',
        { text: '這份資料 Google 直接餵給 Gemini / Google AI Overviews、命中率非常高。', bold: true, color: COL_DARK },
      ],
      fontSize: 11, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 16],
    },

    { text: '任務 5.3：修正 AI 對你品牌的錯誤認知', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    { text: '如果 aivis 監測到 AI 對你品牌有錯誤資訊（地址錯、產品錯、把競品當你）、按這順序處理：', fontSize: 11, color: COL_MID, lineHeight: 1.7, margin: [0, 0, 0, 8] },

    warningBox('Step 1：找到 AI 引用的來源', [
      '打開 Perplexity、問同樣的問題、看右側列出的「Sources」是哪些網頁。',
      { text: '那些就是錯誤的源頭。', bold: true },
    ]),

    warningBox('Step 2：對應修法', [
      '• Wikipedia：直接編輯（帳號免費註冊）\n',
      '• PTT / Mobile01：在原帖回覆糾正（或聯絡版主）\n',
      '• 新聞 / 媒體：寫信給編輯要求更正\n',
      '• 你自己的網站：立刻改 + 加上正確版 Schema\n',
      '• Google 商家檔案：「建議編輯」或後台直接改',
    ]),

    warningBox('Step 3：用「對的訊號」蓋過「錯的訊號」',
      '在自己網站建「品牌事實」頁（含 Organization + FAQ Schema）、持續輸出正確版內容、6-8 週後 AI 會慢慢轉向。'
    ),

    warningBox('Step 4：回報給 AI 廠商（重大錯誤時）',
      'ChatGPT 對話框 👎 / Perplexity 點 source 旁 Report / Gemini「提供意見回饋」→「不正確」。命中率不高但免費、有時間順手做。'
    ),

    verifyBox([
      '至少 3 個第三方平台有你品牌的正確內容',
      'Google 商家檔案完整度 100%',
      '如有 AI 錯誤、至少修到 1 個源頭',
    ]),
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 8：Week 6 — aivis 啟用 + 驗收
// ═══════════════════════════════════════════════════════════════
function buildWeek6Content(baselineScores) {
  const hasBaseline = baselineScores && (baselineScores.seo || baselineScores.aeo || baselineScores.geo || baselineScores.eeat)
  const overall = hasBaseline
    ? Math.round(((baselineScores.seo || 0) + (baselineScores.aeo || 0) + (baselineScores.geo || 0) + (baselineScores.eeat || 0)) / 4)
    : null
  const targetOverall = hasBaseline ? Math.min(100, overall + 20) : '+20 以上'

  return [
    weekHeader(6, 'aivis 啟用 + 6 週驗收', '把「有沒有真的被 AI 推薦」這件事從感覺轉成數字', COL_GREEN),

    { text: '任務 6.1：開啟 aivis 監測', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    { text: '方舟 AI 雷達 Dashboard → AI 曝光監測：', fontSize: 11, color: COL_MID, margin: [0, 0, 0, 6] },
    {
      ol: [
        { text: '加入你的品牌名（中文 / 英文都加）', fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: [
          '加入 5-10 個你客戶會問 AI 的問題（不要塞品牌名、要塞',
          { text: '需求語句', bold: true, color: COL_DARK },
          '）',
        ], fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
      ],
      margin: [0, 0, 0, 12],
    },

    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: [{ text: '✅ 對：', bold: true, color: '#16a34a' }, '「最推薦的車用安卓機品牌？」'], fontSize: 10.5, color: COL_MID, margin: [0, 0, 0, 3] },
            { text: [{ text: '✅ 對：', bold: true, color: '#16a34a' }, '「FOC 馬達哪家品牌好？」'], fontSize: 10.5, color: COL_MID, margin: [0, 0, 0, 3] },
            { text: [{ text: '❌ 錯：', bold: true, color: '#dc2626' }, '「金鉑先生車機評價」（這只測自己曝光、不測競爭）'], fontSize: 10.5, color: COL_MID, margin: [0, 0, 0, 6] },
            { text: 'aivis 每 20 分鐘輪詢 5 個 LLM（ChatGPT / Gemini / Claude / Perplexity / Grok）、看你品牌被提到的次數。', fontSize: 10, color: COL_LIGHT, italics: true, lineHeight: 1.6 },
          ],
          fillColor: COL_BG_GRAY,
          margin: [14, 12, 14, 12],
        }]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 18],
    },

    { text: '任務 6.2：6 週成果驗收表', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 0, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 90, 90],
        body: [
          [
            { text: '指標', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: 'Week 0 起跑', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, alignment: 'center', margin: [6, 6, 6, 6] },
            { text: 'Week 6 目標', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, alignment: 'center', margin: [6, 6, 6, 6] },
          ],
          [
            { text: 'Aark 綜合分數', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: String(overall ?? '—'), color: overall ? scoreColor(overall) : COL_LIGHT, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: String(targetOverall), color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
          [
            { text: 'AEO 分數', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: String(baselineScores?.aeo ?? '—'), color: baselineScores?.aeo ? scoreColor(baselineScores.aeo) : COL_LIGHT, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: '≥ 75', color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
          [
            { text: 'GEO 分數', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: String(baselineScores?.geo ?? '—'), color: baselineScores?.geo ? scoreColor(baselineScores.geo) : COL_LIGHT, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: '≥ 75', color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
          [
            { text: '自然搜尋流量', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: '_____', color: COL_LIGHT, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: '+20%', color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
          [
            { text: 'AI 引用率（aivis）', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: '0 / 10', color: COL_LIGHT, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: '≥ 3 / 10', color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
          [
            { text: '至少 1 個 AI 主動引用你網站', color: COL_DARK, bold: true, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: '❌', color: COL_LIGHT, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
            { text: '✅', color: COL_GREEN, bold: true, fontSize: 11, alignment: 'center', margin: [6, 8, 6, 8] },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => COL_BORDER,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
    },

    { text: '下一個 6 週的規劃', fontSize: 13, bold: true, color: COL_DARK, margin: [0, 18, 0, 6] },
    {
      ul: [
        { text: [{ text: '超過目標', bold: true, color: '#16a34a' }, ' → 把策略複製到第二、三個產品線 / 服務線'], fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: [{ text: '接近目標', bold: true, color: '#d97706' }, ' → 同一套再跑 6 週、深化'], fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
        { text: [{ text: '遠低於目標', bold: true, color: '#dc2626' }, ' → 回 Week 1 檢查紅燈、可能有結構性問題'], fontSize: 10.5, color: COL_MID, lineHeight: 1.8 },
      ],
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 9：附錄 A — 工具清單
// ═══════════════════════════════════════════════════════════════
function buildAppendixAContent() {
  const tools = [
    { name: '方舟 AI 雷達', highlight: true, use: '5 訊號層即時健檢 + aivis 引用率監測', cost: 'Pro NT$1,490/月' },
    { name: 'Google Search Console', use: '看 Google 實際排名與流量', cost: '免費' },
    { name: 'Google Rich Results Test', use: '驗證 Schema 正確性', cost: '免費' },
    { name: 'Perplexity', use: '看 AI 引用來源、模擬潛在客戶體驗', cost: '免費版即可' },
    { name: 'Schema.org Validator', use: 'Schema 完整性檢查', cost: '免費' },
    { name: 'Wikipedia', use: '修正 AI 錯誤認知的核心戰場', cost: '免費' },
  ]

  return [
    { text: 'APPENDIX A · TOOLS', fontSize: 9, color: COL_LIGHT, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
    { text: '必用工具清單', fontSize: 22, bold: true, color: COL_DARK, margin: [0, 0, 0, 14] },

    {
      table: {
        headerRows: 1,
        widths: [165, '*', 95],
        body: [
          [
            { text: '工具', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: '用途', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: '費用', fillColor: '#f1f5f9', color: COL_MID, bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          ],
          ...tools.map(t => [
            { text: t.name, color: COL_DARK, bold: true, fontSize: 10.5, margin: [6, 8, 6, 8] },
            { text: t.use, color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: t.cost, color: t.cost === '免費' || t.cost.startsWith('免費') ? '#16a34a' : COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => COL_BORDER,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// Section 10：附錄 B — 常見錯覺與真相
// ═══════════════════════════════════════════════════════════════
function buildAppendixBContent(clientInfo) {
  const { agencyName = '' } = clientInfo || {}
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

  const myths = [
    { wrong: '我跟 AI 講 100 次它就會記住', right: '只記在你個人帳號、對其他用戶 0 影響' },
    { wrong: 'AI 會自己找到我', right: 'AI 只找到「Google 找得到 + Schema 結構化好 + 第三方提到」的網站' },
    { wrong: 'LLMO 跟 SEO 是兩件事', right: 'LLMO 包含 SEO、SEO 是地基層、不是替代關係' },
    { wrong: 'Schema 是給開發者玩的', right: 'Schema 是 AI 抓答案的主要來源、是 AEO 命脈' },
    { wrong: '6 週應該夠看到效果', right: '搜尋型 AI 是、模型型 AI 要 2-8 週甚至更久、要分開看' },
    { wrong: '不開放 AI 爬蟲才不會被免費訓練', right: '對中小企業是錯誤平衡、擋掉的曝光 > 避免被訓練的好處' },
  ]

  return [
    { text: 'APPENDIX B · MYTHS VS TRUTH', fontSize: 9, color: COL_LIGHT, characterSpacing: 1.5, margin: [0, 0, 0, 4] },
    { text: '常見錯覺與真相', fontSize: 22, bold: true, color: COL_DARK, margin: [0, 0, 0, 14] },

    {
      table: {
        headerRows: 1,
        widths: ['*', '*'],
        body: [
          [
            { text: '❌ 直覺以為', fillColor: '#fef2f2', color: '#991b1b', bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
            { text: '✅ 實際真相', fillColor: '#ecfdf5', color: '#065f46', bold: true, fontSize: 10, margin: [6, 6, 6, 6] },
          ],
          ...myths.map(m => [
            { text: m.wrong, color: COL_MID, fontSize: 10, margin: [6, 8, 6, 8] },
            { text: m.right, color: COL_DARK, fontSize: 10, margin: [6, 8, 6, 8] },
          ]),
        ],
      },
      layout: {
        hLineWidth: () => 0.5, vLineWidth: () => 0,
        hLineColor: () => COL_BORDER,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
      margin: [0, 0, 0, 40],
    },

    // 結語 footer
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            {
              text: [
                agencyName ? { text: `本清單由 ${agencyName} 提供 · ` } : null,
                '技術監測 · ',
                { text: 'Aark', bold: true, color: COL_GREEN },
                ' AI 雷達（LLMO 監測平台）\n',
                'Powered by AARK · 由優勢方舟數位行銷研發 · ',
                date,
              ].filter(Boolean),
              fontSize: 10.5, color: COL_MID, lineHeight: 1.7, alignment: 'center',
            },
            { text: '本清單為通用 LLMO 執行框架、實際效果受網站體質 / 產業競爭 / AI 演算法變動等多重因素影響、不保證具體成效。', fontSize: 9, color: COL_LIGHT, lineHeight: 1.6, alignment: 'center', margin: [0, 10, 0, 0] },
          ],
          fillColor: COL_BG_GRAY,
          margin: [16, 20, 16, 20],
        }]],
      },
      layout: 'noBorders',
    },
  ]
}

// ═══════════════════════════════════════════════════════════════
// 主匯出函式
// ═══════════════════════════════════════════════════════════════
export async function exportLLMO6WeekChecklistPDF(clientInfo, baselineScores = null) {
  const pdfMake = await getPdfMake()

  // 把 10 個 section 用 pageBreak 串起來
  const content = [
    ...buildCoverContent(clientInfo, baselineScores),
    { text: '', pageBreak: 'after' },
    ...buildIntroContent(),
    { text: '', pageBreak: 'after' },
    ...buildWeek1Content(),
    { text: '', pageBreak: 'after' },
    ...buildWeek2Content(),
    { text: '', pageBreak: 'after' },
    ...buildWeek3Content(),
    { text: '', pageBreak: 'after' },
    ...buildWeek4Content(),
    { text: '', pageBreak: 'after' },
    ...buildWeek5Content(),
    { text: '', pageBreak: 'after' },
    ...buildWeek6Content(baselineScores),
    { text: '', pageBreak: 'after' },
    ...buildAppendixAContent(),
    { text: '', pageBreak: 'after' },
    ...buildAppendixBContent(clientInfo),
  ]

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 56],  // [left, top, right, bottom]
    defaultStyle: {
      font: 'NotoSansTC',
      fontSize: 11,
      color: COL_DARK,
      lineHeight: 1.5,
    },
    content,
    info: {
      title: `LLMO 6 週執行清單 — ${clientInfo?.clientName || ''}`,
      author: clientInfo?.agencyName || 'Aark · AI 雷達',
      subject: 'LLMO Execution Roadmap',
    },
  }

  const clientSlug = (clientInfo?.clientName || 'client')
    .replace(/[^a-zA-Z0-9一-龥]/g, '_').slice(0, 30)
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = `LLMO_6週執行清單_${clientSlug}_${dateStr}.pdf`

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).download(filename, () => resolve())
    } catch (err) {
      reject(err)
    }
  })
}
