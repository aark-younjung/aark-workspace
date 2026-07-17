/**
 * LLMO 6 週執行清單 PDF 匯出（2026-06-08）
 *
 * 設計動機：代理商需要把抽象的 LLMO 概念轉成可交付客戶的具體 6 週執行清單。
 *   這份 PDF 是「平台級的代理商交付物」、所有 Aark Pro / Agency 用戶都可重用。
 *
 * 與 ClientReportModal 的差異：
 *   - ClientReportModal：客戶當下的「檢測結果報告」（snapshot）
 *   - 本檔案：客戶接下來 6 週的「執行清單」（forward-looking）
 *
 * 結構：分段渲染、每個 section 各自 1 canvas → 1 PDF page、不切字
 *   1. 封面
 *   2. 為什麼是 6 週 + 排除誤會
 *   3. Week 1：健檢 + 紅燈快修
 *   4. Week 2：AI 爬蟲開放 + llms.txt
 *   5. Week 3：Schema 三件套
 *   6. Week 4：內容權威化
 *   7. Week 5：外部訊號 + 修正 AI 錯誤認知
 *   8. Week 6：aivis 啟用 + 驗收
 *   9. 附錄 A：工具清單
 *   10. 附錄 B：常見錯覺與真相
 *   11. 結語 + 代理商 footer
 */
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { AARK_MARK_SVG, LAYER_COLOR, scoreColor } from './pdfExport'

// ─── 共用 style 變數（給整份 PDF 統一視覺） ───
const BG_WHITE = '#ffffff'  // 內容頁底色
const TEXT_DARK = '#1e293b'  // 主標題顏色
const TEXT_MID = '#475569'  // 次要文字顏色
const TEXT_LIGHT = '#64748b'  // 提示文字顏色
const BORDER_LIGHT = '#e2e8f0'  // 分隔線
const ACCENT_GREEN = '#18c590'  // Aark 主品牌綠
const BG_CODE = '#0f172a'  // 程式碼背景（深藍黑、配合語法高亮）
const TEXT_CODE = '#e2e8f0'  // 程式碼文字
const FONT_BODY = `'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif`  // 中文襯線
const FONT_MONO = `'JetBrains Mono','Menlo','Consolas',monospace`  // 程式碼字體

// ─── Helper：section 通用 wrapper（A4 寬度、白底） ───
function sectionWrap(innerHTML, padding = '48px 56px') {
  return `
    <div style="width:794px;background:${BG_WHITE};font-family:${FONT_BODY};color:${TEXT_DARK};padding:${padding};box-sizing:border-box;">
      ${innerHTML}
    </div>
  `
}

// ─── Helper：週次大標題（左 badge + 右標題 + 副標） ───
function weekHeader(weekNum, title, subtitle, accent = ACCENT_GREEN) {
  return `
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${accent};">
      <div style="flex-shrink:0;width:64px;height:64px;background:${accent};border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;">
        <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.85;">WEEK</div>
        <div style="font-size:28px;font-weight:bold;line-height:1;">${weekNum}</div>
      </div>
      <div style="flex:1;">
        <h2 style="font-size:24px;font-weight:bold;color:${TEXT_DARK};margin:0 0 4px;letter-spacing:-0.02em;">${title}</h2>
        <p style="font-size:13px;color:${TEXT_LIGHT};margin:0;line-height:1.5;">${subtitle}</p>
      </div>
    </div>
  `
}

// ─── Helper：任務表格 ───
function taskTable(rows) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:6px 0 0 0;">任務</th>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;letter-spacing:0.05em;width:90px;">預估時間</th>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:0 6px 0 0;">怎麼做</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">${r.task}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};font-size:12px;">${r.time}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">${r.how}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// ─── Helper：程式碼區塊 ───
function codeBlock(content, label = '') {
  return `
    <div style="margin:14px 0;">
      ${label ? `<div style="font-size:11px;color:${TEXT_LIGHT};margin-bottom:6px;letter-spacing:0.05em;text-transform:uppercase;font-family:${FONT_MONO};">${label}</div>` : ''}
      <pre style="background:${BG_CODE};color:${TEXT_CODE};padding:18px 22px;border-radius:10px;font-family:${FONT_MONO};font-size:11.5px;line-height:1.7;margin:0;white-space:pre-wrap;overflow-wrap:break-word;">${content}</pre>
    </div>
  `
}

// ─── Helper：驗收 checklist ───
function verifyList(items) {
  return `
    <div style="margin-top:20px;padding:18px 22px;background:#ecfdf5;border-left:4px solid ${ACCENT_GREEN};border-radius:0 8px 8px 0;">
      <div style="font-size:12px;font-weight:600;color:#065f46;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px;">本週驗收</div>
      ${items.map(it => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:13px;color:${TEXT_DARK};">
          <span style="color:${ACCENT_GREEN};font-weight:bold;flex-shrink:0;">✓</span>
          <span>${it}</span>
        </div>
      `).join('')}
    </div>
  `
}

// ═══════════════════════════════════════════════════════════════
// Section 1：封面
// ═══════════════════════════════════════════════════════════════
function buildCoverHTML(clientInfo, baselineScores) {
  const { clientName = '', agencyName = '', agencyContact = '', startDate } = clientInfo || {}
  const dateStr = startDate
    ? new Date(startDate).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

  // 計算 Week 0 起跑分數（顯示在封面下半部給客戶看到「起點」）
  const hasBaseline = baselineScores && (baselineScores.seo || baselineScores.aeo || baselineScores.geo || baselineScores.eeat)
  const overall = hasBaseline
    ? Math.round(((baselineScores.seo || 0) + (baselineScores.aeo || 0) + (baselineScores.geo || 0) + (baselineScores.eeat || 0)) / 4)
    : null

  return `
    <div style="width:794px;background:linear-gradient(155deg, #050608 0%, #04130f 30%, #052e2c 60%, ${ACCENT_GREEN} 130%);padding:80px 56px;color:white;min-height:1080px;display:flex;flex-direction:column;font-family:${FONT_BODY};box-sizing:border-box;">

      <!-- 上：Aark logo + wordmark -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:50px;">
        ${AARK_MARK_SVG}
        <div>
          <div style="font-size:32px;font-weight:bold;letter-spacing:-0.04em;font-family:'Inter','Microsoft JhengHei',sans-serif;">Aark</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px;">AI 雷達 · LLMO 監測平台</div>
        </div>
      </div>

      <!-- 報告類型 badge -->
      <div style="display:inline-block;width:auto;padding:6px 14px;background:rgba(24,197,144,0.18);border:1px solid rgba(24,197,144,0.5);border-radius:99px;font-size:11px;color:#86efac;font-family:${FONT_MONO};letter-spacing:0.1em;margin-bottom:30px;text-transform:uppercase;align-self:flex-start;">
        Execution Roadmap
      </div>

      <!-- 主標題 -->
      <div style="font-size:54px;font-weight:bold;letter-spacing:-0.025em;line-height:1.1;margin-bottom:10px;">
        LLMO 6 週執行清單
      </div>
      <div style="font-size:22px;color:rgba(255,255,255,0.75);margin-bottom:50px;letter-spacing:-0.01em;">
        Make Your Brand Visible to AI · 6-Week Roadmap
      </div>

      ${clientName ? `
      <!-- 客戶資訊區 -->
      <div style="padding:24px 28px;background:rgba(255,255,255,0.06);border-left:4px solid ${ACCENT_GREEN};border-radius:12px;margin-bottom:30px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">為您製作 · Prepared For</div>
        <div style="font-size:28px;font-weight:bold;color:white;letter-spacing:-0.01em;">${clientName}</div>
      </div>` : ''}

      ${hasBaseline ? `
      <!-- Week 0 起跑分數（讓客戶看到起點、6 週後對比） -->
      <div style="padding:24px 28px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;margin-bottom:30px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;">Week 0 · 起跑點分數</div>
        <div style="display:flex;align-items:center;gap:28px;">
          <div style="text-align:center;min-width:80px;">
            <div style="font-size:48px;font-weight:bold;color:${scoreColor(overall || 0)};line-height:1;">${overall}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;">綜合分數</div>
          </div>
          <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
            ${['seo', 'aeo', 'geo', 'eeat'].map(k => {
              const label = k === 'eeat' ? 'E-E-A-T' : k.toUpperCase()
              const colorKey = k === 'eeat' ? 'E-E-A-T' : label
              return `
              <div style="text-align:center;padding:10px 6px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid ${LAYER_COLOR[colorKey]}44;">
                <div style="font-size:22px;font-weight:bold;color:${scoreColor(baselineScores[k] || 0)};line-height:1;">${baselineScores[k] || 0}</div>
                <div style="font-size:9px;color:rgba(255,255,255,0.5);margin-top:3px;letter-spacing:0.05em;">${label}</div>
              </div>
              `
            }).join('')}
          </div>
        </div>
      </div>` : ''}

      <!-- Footer 區 -->
      <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-top:40px;border-top:1px solid rgba(255,255,255,0.1);">
        <div>
          ${agencyName ? `
            <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">提交者 · Prepared By</div>
            <div style="font-size:16px;font-weight:600;color:white;">${agencyName}</div>
            ${agencyContact ? `<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px;">${agencyContact}</div>` : ''}
          ` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">起跑日 · Kickoff</div>
          <div style="font-size:14px;color:white;font-family:${FONT_MONO};">${dateStr}</div>
        </div>
      </div>

    </div>
  `
}

// ═══════════════════════════════════════════════════════════════
// Section 2：為什麼是 6 週 + 排除常見誤會
// ═══════════════════════════════════════════════════════════════
function buildIntroHTML() {
  return sectionWrap(`
    <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">00 · Introduction</div>
    <h2 style="font-size:28px;font-weight:bold;color:${TEXT_DARK};margin:0 0 18px;letter-spacing:-0.02em;">為什麼是 6 週？</h2>

    <p style="font-size:14px;color:${TEXT_MID};line-height:1.8;margin:0 0 14px;">
      LLM 對網站的重新評估有滯後性：
    </p>
    <ul style="font-size:14px;color:${TEXT_MID};line-height:1.9;padding-left:22px;margin:0 0 18px;">
      <li><strong style="color:${TEXT_DARK};">搜尋型 AI</strong>（Perplexity / ChatGPT Search / Gemini）：2-4 週看到效果</li>
      <li><strong style="color:${TEXT_DARK};">模型型 AI</strong>（純 ChatGPT 對話）：2-8 週甚至更久（要等下一輪訓練）</li>
    </ul>
    <p style="font-size:14px;color:${TEXT_MID};line-height:1.8;margin:0 0 28px;">
      6 週剛好涵蓋第一輪 AI 重新檢索的完整週期、是評估「方向對不對」的最短可信窗口。
    </p>

    <!-- 常見誤會警告框 -->
    <div style="padding:20px 24px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:bold;color:#92400e;margin-bottom:8px;">⚠️ 開工前先排除一個常見誤會</div>
      <p style="font-size:13px;color:#78350f;line-height:1.8;margin:0;">
        跟 AI 對話「教它認識你品牌」、<strong>只會影響你自己帳號的對話</strong>、對其他用戶 0 影響。
        AI 不是學生、是檢索員 — 它每次答題重新去網路撿資料。要被別人問到時被推薦、必須改變網路上關於你的<strong>「證據總量」</strong>、不是改變 AI 本身。
      </p>
    </div>

    <!-- 本清單怎麼用 -->
    <h3 style="font-size:17px;font-weight:bold;color:${TEXT_DARK};margin:24px 0 12px;">本清單怎麼用</h3>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;font-size:13px;color:${TEXT_MID};line-height:1.7;">
      <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid ${BORDER_LIGHT};">
        <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">每週</div>
        <div>跟清單做完當週任務、不貪快</div>
      </div>
      <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid ${BORDER_LIGHT};">
        <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">驗收</div>
        <div>每週末用 Aark 重新檢測、對照「本週驗收」欄</div>
      </div>
      <div style="padding:14px 16px;background:#f8fafc;border-radius:10px;border:1px solid ${BORDER_LIGHT};">
        <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">第 6 週</div>
        <div>aivis 啟用、對照 Week 0 起跑分數驗收成果</div>
      </div>
    </div>
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 3：Week 1 — 健檢 + 紅燈快修
// ═══════════════════════════════════════════════════════════════
function buildWeek1HTML() {
  return sectionWrap(`
    ${weekHeader(1, '健檢 + 紅燈快修', '把 Aark 5 訊號層的所有「紅燈項目」清掉、拿到一個乾淨的起跑點', LAYER_COLOR.SEO)}

    ${taskTable([
      { task: '跑一次 Aark 完整檢測', time: '5 分鐘', how: 'Dashboard 點「🔄 重新檢測」' },
      { task: '修 SEO 紅燈（Meta / H1 / Alt）', time: '1-3 小時', how: '跟著「修復指南」逐項做' },
      { task: '修 robots.txt（不擋 AI 爬蟲）', time: '10 分鐘', how: '在 /robots.txt 加 allow 規則（詳見 Week 2）' },
      { task: '修 sitemap.xml（涵蓋所有重要頁）', time: '30 分鐘', how: 'WordPress 用 Rank Math / Yoast 自動產' },
      { task: '修完後點「我已修好」', time: '隨手', how: '記錄修復事件、+5 XP、可追蹤趨勢' },
    ])}

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:24px 0 8px;">為什麼從這裡開始</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0;">
      90% 的台灣中小企業網站在「基礎結構」就已經漏分。在做任何進階優化之前、先把這些一定要修的紅燈處理掉、後面才有意義。
      這週通常只需要 4-6 小時、但分數可以從 50 跳到 70+。
    </p>

    ${verifyList([
      'Aark 綜合分數 ≥ 70',
      '所有紅燈項目轉黃或綠',
      '至少觸發 5 筆「我已修好」記錄',
    ])}
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 4：Week 2 — AI 爬蟲開放 + llms.txt
// ═══════════════════════════════════════════════════════════════
function buildWeek2HTML() {
  return sectionWrap(`
    ${weekHeader(2, 'AI 爬蟲開放 + llms.txt', '明確告訴所有 AI「你可以來抓我、這是我的主題地圖」', LAYER_COLOR.GEO)}

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 2.1：robots.txt 開放 AI 爬蟲</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0 0 8px;">把這段加到 /robots.txt：</p>

    ${codeBlock(`User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /`, 'robots.txt')}

    <p style="font-size:12px;color:${TEXT_LIGHT};line-height:1.7;margin:8px 0 22px;">
      ⓘ 如果只想被 AI 搜尋引用但不想被當訓練資料、可擇優開放 PerplexityBot 但擋 GPTBot。一般中小企業建議全開、這時段曝光 > 擔心被「免費訓練」。
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 2.2：建 llms.txt</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0 0 8px;">在根目錄放純文字檔（不是 HTML）：</p>

    ${codeBlock(`# {公司名稱}

> {一句話描述你在做什麼、賣什麼、給誰}

## 核心產品/服務

- [產品 A 名稱]({URL}) — 一句話描述
- [產品 B 名稱]({URL}) — 一句話描述

## 重要內容

- [服務據點]({URL})
- [常見問題]({URL})
- [關於我們]({URL})

## 聯絡方式

- Email: ...
- 電話: ...`, 'llms.txt')}

    <p style="font-size:12px;color:${TEXT_LIGHT};line-height:1.7;margin:8px 0 0;">
      ⓘ 這檔給 AI 看的「網站索引」、跟 sitemap.xml 互補。部分 AI（特別是 Perplexity）會優先抓這個檔來理解你。
    </p>

    ${verifyList([
      'yourdomain.com/robots.txt 開瀏覽器看得到 AI 爬蟲規則',
      'yourdomain.com/llms.txt 開瀏覽器看得到內容',
      'Aark 的 GEO 分數至少上升 15 分',
    ])}
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 5：Week 3 — Schema 三件套
// ═══════════════════════════════════════════════════════════════
function buildWeek3HTML() {
  return sectionWrap(`
    ${weekHeader(3, 'Schema 三件套', '讓 AI 不只看到你、還能直接抓你的答案來回應用戶', LAYER_COLOR.AEO)}

    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0 0 18px;">
      技術含量最高的一週、但完成後 AEO 分數通常會跳 30+ 分。三件套：<strong style="color:${TEXT_DARK};">Organization / Product / FAQ</strong>。
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">A. Organization Schema（首頁放一次就夠）</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 8px;">告訴 AI「你是誰、做什麼的、可信度怎樣」：</p>

    ${codeBlock(`<script type="application/ld+json">
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
</script>`)}

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:18px 0 6px;">B. Product Schema（每個商品頁一份）</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 4px;">
      電商必加。重點欄位：<code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">name</code> /
      <code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">image</code> /
      <code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">description</code> /
      <code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">brand</code> /
      <code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">offers.price</code> /
      <code style="font-family:${FONT_MONO};font-size:11px;background:#f1f5f9;padding:1px 6px;border-radius:4px;">aggregateRating</code>。
      WordPress + WooCommerce 通常自動產、但要檢查是否完整。
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:18px 0 6px;">C. FAQ Schema（核心內容頁加上）</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 8px;">
      <strong style="color:#dc2626;">這是 AI 引用率最高的 schema 類型</strong> — AI 答題時直接把 FAQ 條目當答案塞進回應：
    </p>

    ${codeBlock(`<script type="application/ld+json">
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
</script>`)}

    ${verifyList([
      '用 Google Rich Results Test 確認 3 種 schema 都通過',
      'Aark 的 AEO 分數 ≥ 75',
      '至少 5 個核心頁、每頁至少有 1 種 schema',
    ])}
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 6：Week 4 — 內容權威化
// ═══════════════════════════════════════════════════════════════
function buildWeek4HTML() {
  return sectionWrap(`
    ${weekHeader(4, '內容權威化（E-E-A-T）', '讓 AI 認為你「值得引用」、而不是隨便一個賣家', LAYER_COLOR['E-E-A-T'])}

    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0 0 18px;">
      <strong style="color:${TEXT_DARK};">E-E-A-T</strong> = Experience（經驗）/ Expertise（專業）/ Authoritativeness（權威）/ Trustworthiness（信任）。
      AI 在選引用來源時會偷偷比這個。
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 4.1：作者 / 公司資訊頁</h3>
    <ul style="font-size:13px;color:${TEXT_MID};line-height:1.9;padding-left:22px;margin:0 0 18px;">
      <li>About 頁：「為什麼是我們、做多久了、服務多少人、創辦故事」</li>
      <li>Contact 頁：實體地址、電話、Email、Google Maps 嵌入</li>
      <li>隱私權政策 + 服務條款（trust signal）</li>
      <li>部落格文章每篇都要有作者 bio + 大頭照</li>
    </ul>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:18px 0 6px;">任務 4.2：內容深度升級</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 10px;">
      挑 3 篇核心頁面、用「回答客戶會搜的問題」的思路改寫：
    </p>

    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0 0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 14px;background:#fef2f2;color:#991b1b;font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:6px 0 0 0;">❌ 改寫前</th>
          <th style="text-align:left;padding:10px 14px;background:#ecfdf5;color:#065f46;font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:0 6px 0 0;">✅ 改寫後</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">精選車用 Android 安卓主機</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">Honda HRV 環景安卓主機推薦 — 2026 版本完整安裝指南 + 價格</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">最新優惠</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">車用安卓盒子怎麼選？5 個避雷重點 + 安裝店家推薦</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;color:${TEXT_MID};">商品介紹</td>
          <td style="padding:11px 14px;color:${TEXT_DARK};">Toyota 安卓機升級必看：4 種主流主機規格比較</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:12px;color:${TEXT_LIGHT};line-height:1.7;margin:14px 0 0;">
      <strong>判斷標準</strong>：標題裡有沒有「具體車型 + 問題 / 比較 / 推薦」這類關鍵字組合。
    </p>

    ${verifyList([
      'Aark 的 E-E-A-T 分數 ≥ 70',
      '至少 3 篇權威長文（≥ 1500 字、附作者 bio、附 FAQ schema）',
      'About / Contact / Privacy 三頁都完整',
    ])}
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 7：Week 5 — 外部訊號 + 修正 AI 錯誤認知
// ═══════════════════════════════════════════════════════════════
function buildWeek5HTML() {
  return sectionWrap(`
    ${weekHeader(5, '外部訊號 + 修正 AI 錯誤認知', '讓「不在你網站上」的 AI 也能找到你的對的資訊', '#dc2626')}

    <p style="font-size:13px;color:${TEXT_MID};line-height:1.8;margin:0 0 18px;">
      AI 訓練/檢索時會抓很多第三方平台。要被 AI 引用、單靠自己網站不夠、得在 <strong>AI 會去的地方</strong> 也有你的對的資訊。
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 5.1：第三方平台鋪設</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:8px 0 18px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:9px 12px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:6px 0 0 0;width:130px;">產業</th>
          <th style="text-align:left;padding:9px 12px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:0 6px 0 0;">主要平台</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">消費品 / 3C</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">Mobile01、PTT、Dcard、Threads</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">美食 / 餐飲</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">Google Maps、IG、Threads、Yelp</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">美業 / 健身</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">IG、Threads、Google Maps</td></tr>
        <tr><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">B2B 服務</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">LinkedIn、Medium、自家部落格 + SEO</td></tr>
        <tr><td style="padding:9px 12px;color:${TEXT_DARK};font-weight:500;">旅遊 / 製造</td><td style="padding:9px 12px;color:${TEXT_MID};">Tripadvisor / KKday / 行業協會目錄 / LinkedIn</td></tr>
      </tbody>
    </table>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 5.2：Google 商家檔案</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 18px;">
      實體店家必做：名稱/地址/電話/官網正確、營業時間填完整、≥ 10 張照片、鼓勵客戶留評論。
      <strong style="color:${TEXT_DARK};">這份資料 Google 直接餵給 Gemini / Google AI Overviews、命中率非常高。</strong>
    </p>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 8px;">任務 5.3：修正 AI 對你品牌的錯誤認知</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 12px;">
      如果 aivis 監測到 AI 對你品牌有錯誤資訊（地址錯、產品錯、把競品當你）、按這順序處理：
    </p>

    <div style="padding:16px 20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:bold;color:#92400e;margin-bottom:4px;">Step 1：找到 AI 引用的來源</div>
      <p style="font-size:12.5px;color:#78350f;line-height:1.7;margin:0;">打開 Perplexity、問同樣的問題、看右側列出的「Sources」是哪些網頁。<strong>那些就是錯誤的源頭。</strong></p>
    </div>

    <div style="padding:16px 20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:bold;color:#92400e;margin-bottom:8px;">Step 2：對應修法</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr><td style="padding:4px 0;color:#78350f;width:170px;"><strong>Wikipedia</strong></td><td style="padding:4px 0;color:#78350f;">直接編輯（帳號免費註冊）</td></tr>
        <tr><td style="padding:4px 0;color:#78350f;"><strong>PTT / Mobile01</strong></td><td style="padding:4px 0;color:#78350f;">在原帖回覆糾正（或聯絡版主）</td></tr>
        <tr><td style="padding:4px 0;color:#78350f;"><strong>新聞 / 媒體</strong></td><td style="padding:4px 0;color:#78350f;">寫信給編輯要求更正</td></tr>
        <tr><td style="padding:4px 0;color:#78350f;"><strong>你自己的網站</strong></td><td style="padding:4px 0;color:#78350f;">立刻改 + 加上正確版 Schema</td></tr>
        <tr><td style="padding:4px 0;color:#78350f;"><strong>Google 商家檔案</strong></td><td style="padding:4px 0;color:#78350f;">「建議編輯」或後台直接改</td></tr>
      </table>
    </div>

    <div style="padding:16px 20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:12px;">
      <div style="font-size:12px;font-weight:bold;color:#92400e;margin-bottom:4px;">Step 3：用「對的訊號」蓋過「錯的訊號」</div>
      <p style="font-size:12.5px;color:#78350f;line-height:1.7;margin:0;">在自己網站建「品牌事實」頁（含 Organization + FAQ Schema）、持續輸出正確版內容、6-8 週後 AI 會慢慢轉向。</p>
    </div>

    <div style="padding:16px 20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
      <div style="font-size:12px;font-weight:bold;color:#92400e;margin-bottom:4px;">Step 4：回報給 AI 廠商（重大錯誤時）</div>
      <p style="font-size:12.5px;color:#78350f;line-height:1.7;margin:0;">ChatGPT 對話框 👎 / Perplexity 點 source 旁 Report / Gemini「提供意見回饋」→「不正確」。命中率不高但免費、有時間順手做。</p>
    </div>

    ${verifyList([
      '至少 3 個第三方平台有你品牌的正確內容',
      'Google 商家檔案完整度 100%',
      '如有 AI 錯誤、至少修到 1 個源頭',
    ])}
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 8：Week 6 — aivis 啟用 + 驗收
// ═══════════════════════════════════════════════════════════════
function buildWeek6HTML(baselineScores) {
  const hasBaseline = baselineScores && (baselineScores.seo || baselineScores.aeo || baselineScores.geo || baselineScores.eeat)
  const overall = hasBaseline
    ? Math.round(((baselineScores.seo || 0) + (baselineScores.aeo || 0) + (baselineScores.geo || 0) + (baselineScores.eeat || 0)) / 4)
    : null
  const targetOverall = hasBaseline ? Math.min(100, overall + 20) : '+20 以上'

  return sectionWrap(`
    ${weekHeader(6, 'aivis 啟用 + 6 週驗收', '把「有沒有真的被 AI 推薦」這件事從感覺轉成數字', ACCENT_GREEN)}

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:0 0 6px;">任務 6.1：開啟 aivis 監測</h3>
    <p style="font-size:13px;color:${TEXT_MID};line-height:1.7;margin:0 0 10px;">
      方舟 AI 雷達 Dashboard → AI 曝光監測：
    </p>
    <ol style="font-size:13px;color:${TEXT_MID};line-height:1.9;padding-left:22px;margin:0 0 14px;">
      <li>加入你的品牌名（中文 / 英文都加）</li>
      <li>加入 5-10 個你客戶會問 AI 的問題（不要塞品牌名、要塞<strong>需求語句</strong>）</li>
    </ol>
    <div style="padding:14px 18px;background:#f8fafc;border-radius:8px;border:1px solid ${BORDER_LIGHT};font-size:12.5px;color:${TEXT_MID};line-height:1.8;margin:0 0 18px;">
      <div style="margin-bottom:4px;"><strong style="color:#16a34a;">✅ 對</strong>：「最推薦的車用安卓機品牌？」</div>
      <div style="margin-bottom:4px;"><strong style="color:#16a34a;">✅ 對</strong>：「FOC 馬達哪家品牌好？」</div>
      <div style="margin-bottom:4px;"><strong style="color:#dc2626;">❌ 錯</strong>：「金鉑先生車機評價」（這只測自己曝光、不測競爭）</div>
      <div><strong style="color:${TEXT_LIGHT};">aivis 每次掃描會問 3 個 LLM（ChatGPT / Gemini / Claude）、看你品牌被提到的次數。</strong></div>
    </div>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:18px 0 8px;">任務 6.2：6 週成果驗收表</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:0;">
      <thead>
        <tr>
          <th style="text-align:left;padding:9px 12px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:6px 0 0 0;">指標</th>
          <th style="text-align:center;padding:9px 12px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;">Week 0 起跑</th>
          <th style="text-align:center;padding:9px 12px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:0 6px 0 0;">Week 6 目標</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">Aark 綜合分數</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${overall ? scoreColor(overall) : TEXT_LIGHT};font-weight:bold;">${overall ?? '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">${targetOverall}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">AEO 分數</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${baselineScores?.aeo ? scoreColor(baselineScores.aeo) : TEXT_LIGHT};font-weight:bold;">${baselineScores?.aeo ?? '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">≥ 75</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">GEO 分數</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${baselineScores?.geo ? scoreColor(baselineScores.geo) : TEXT_LIGHT};font-weight:bold;">${baselineScores?.geo ?? '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">≥ 75</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">自然搜尋流量</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${TEXT_LIGHT};">_____</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">+20%</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">AI 引用率（aivis）</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${TEXT_LIGHT};">0 / 10</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">≥ 3 / 10</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:${TEXT_DARK};font-weight:500;">至少 1 個 AI 主動引用你網站</td>
          <td style="padding:10px 12px;text-align:center;color:${TEXT_LIGHT};">❌</td>
          <td style="padding:10px 12px;text-align:center;color:${ACCENT_GREEN};font-weight:bold;">✅</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size:15px;font-weight:bold;color:${TEXT_DARK};margin:22px 0 6px;">下一個 6 週的規劃</h3>
    <ul style="font-size:13px;color:${TEXT_MID};line-height:1.9;padding-left:22px;margin:0;">
      <li><strong style="color:#16a34a;">超過目標</strong> → 把策略複製到第二、三個產品線 / 服務線</li>
      <li><strong style="color:#d97706;">接近目標</strong> → 同一套再跑 6 週、深化</li>
      <li><strong style="color:#dc2626;">遠低於目標</strong> → 回 Week 1 檢查紅燈、可能有結構性問題</li>
    </ul>
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 9：附錄 A — 工具清單
// ═══════════════════════════════════════════════════════════════
function buildAppendixAHTML() {
  return sectionWrap(`
    <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Appendix A · Tools</div>
    <h2 style="font-size:24px;font-weight:bold;color:${TEXT_DARK};margin:0 0 18px;letter-spacing:-0.02em;">必用工具清單</h2>

    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:6px 0 0 0;width:200px;">工具</th>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;">用途</th>
          <th style="text-align:left;padding:10px 14px;background:#f1f5f9;color:${TEXT_MID};font-weight:600;font-size:11px;border-radius:0 6px 0 0;width:130px;">費用</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:600;">方舟 AI 雷達</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">5 訊號層即時健檢 + aivis 引用率監測</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">Pro NT$1,490/月</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">Google Search Console</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">看 Google 實際排名與流量</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#16a34a;">免費</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">Google Rich Results Test</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">驗證 Schema 正確性</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#16a34a;">免費</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">Perplexity</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">看 AI 引用來源、模擬潛在客戶體驗</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#16a34a;">免費版即可</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};font-weight:500;">Schema.org Validator</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">Schema 完整性檢查</td>
          <td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;color:#16a34a;">免費</td>
        </tr>
        <tr>
          <td style="padding:12px 14px;color:${TEXT_DARK};font-weight:500;">Wikipedia</td>
          <td style="padding:12px 14px;color:${TEXT_MID};">修正 AI 錯誤認知的核心戰場</td>
          <td style="padding:12px 14px;color:#16a34a;">免費</td>
        </tr>
      </tbody>
    </table>
  `)
}

// ═══════════════════════════════════════════════════════════════
// Section 10：附錄 B — 常見錯覺與真相
// ═══════════════════════════════════════════════════════════════
function buildAppendixBHTML(clientInfo) {
  const { agencyName = '' } = clientInfo || {}
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

  return sectionWrap(`
    <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">Appendix B · Myths vs Truth</div>
    <h2 style="font-size:24px;font-weight:bold;color:${TEXT_DARK};margin:0 0 18px;letter-spacing:-0.02em;">常見錯覺與真相</h2>

    <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 14px;background:#fef2f2;color:#991b1b;font-weight:600;font-size:11px;border-radius:6px 0 0 0;width:48%;">❌ 直覺以為</th>
          <th style="text-align:left;padding:10px 14px;background:#ecfdf5;color:#065f46;font-weight:600;font-size:11px;border-radius:0 6px 0 0;">✅ 實際真相</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">我跟 AI 講 100 次它就會記住</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">只記在你個人帳號、對其他用戶 0 影響</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">AI 會自己找到我</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">AI 只找到「Google 找得到 + Schema 結構化好 + 第三方提到」的網站</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">LLMO 跟 SEO 是兩件事</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">LLMO 包含 SEO、SEO 是地基層、不是替代關係</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">Schema 是給開發者玩的</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">Schema 是 AI 抓答案的主要來源、是 AEO 命脈</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_MID};">6 週應該夠看到效果</td>
          <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:${TEXT_DARK};">搜尋型 AI 是、模型型 AI 要 2-8 週甚至更久、要分開看</td>
        </tr>
        <tr>
          <td style="padding:11px 14px;color:${TEXT_MID};">不開放 AI 爬蟲才不會被免費訓練</td>
          <td style="padding:11px 14px;color:${TEXT_DARK};">對中小企業是錯誤平衡、擋掉的曝光 > 避免被訓練的好處</td>
        </tr>
      </tbody>
    </table>

    <!-- 結語 footer -->
    <div style="margin-top:48px;padding:24px 28px;background:#f8fafc;border-top:3px solid ${ACCENT_GREEN};border-radius:8px;text-align:center;">
      <div style="font-size:13px;color:${TEXT_MID};line-height:1.8;">
        ${agencyName ? `本清單由 <strong style="color:${TEXT_DARK};">${agencyName}</strong> 提供 · ` : ''}
        技術監測 · <strong style="color:${ACCENT_GREEN};">Aark</strong> AI 雷達（LLMO 監測平台）<br/>
        Powered by AARK · 由優勢方舟數位行銷研發 · ${date}
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-top:12px;line-height:1.7;">
        本清單為通用 LLMO 執行框架、實際效果受網站體質 / 產業競爭 / AI 演算法變動等多重因素影響、不保證具體成效。
      </div>
    </div>
  `)
}

// ═══════════════════════════════════════════════════════════════
// 主匯出函式：把所有 section 渲染成獨立 PDF 頁
// ═══════════════════════════════════════════════════════════════
export async function exportLLMO6WeekChecklistPDF(clientInfo, baselineScores = null) {
  // 10 個 section（封面 + intro + 6 週 + 2 個附錄）
  const sections = [
    buildCoverHTML(clientInfo, baselineScores),
    buildIntroHTML(),
    buildWeek1HTML(),
    buildWeek2HTML(),
    buildWeek3HTML(),
    buildWeek4HTML(),
    buildWeek5HTML(),
    buildWeek6HTML(baselineScores),
    buildAppendixAHTML(),
    buildAppendixBHTML(clientInfo),
  ]

  // 隱藏的 render 容器（在畫面外、不影響 UI）
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1;background:white;'
  document.body.appendChild(container)

  try {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < sections.length; i++) {
      container.innerHTML = sections[i]
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const imgHeight = (canvas.height * pdfWidth) / canvas.width

      // 第二個 section 開始、每個都先 addPage
      if (i > 0) pdf.addPage()

      // section 短於 A4：直接放、不切字
      // section 長於 A4：分頁處理（這時切的是同 section 內、不會切標題）
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight)
      } else {
        let position = 0
        let remaining = imgHeight
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight)
        remaining -= pdfHeight
        while (remaining > 0) {
          position -= pdfHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight)
          remaining -= pdfHeight
        }
      }
    }

    const clientSlug = (clientInfo?.clientName || 'client')
      .replace(/[^a-zA-Z0-9一-龥]/g, '_').slice(0, 30)
    const dateStr = new Date().toISOString().slice(0, 10)
    pdf.save(`LLMO_6週執行清單_${clientSlug}_${dateStr}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
