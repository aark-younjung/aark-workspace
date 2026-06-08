import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function scoreColor(score) {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

function checkIcon(passed) {
  return passed ? '✓' : '✗'
}

function buildReportHTML({ website, seoAudit, aeoAudit, geoAudit, eeatAudit }) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const seoScore = seoAudit?.score || 0
  const aeoScore = aeoAudit?.score || 0
  const geoScore = geoAudit?.score || 0
  const eeatScore = eeatAudit?.score || 0
  const overall = Math.round((seoScore + aeoScore + geoScore + eeatScore) / 4)

  const seoChecks = [
    { name: 'Meta 標題', passed: !!seoAudit?.meta_tags?.hasTitle },
    { name: 'Meta 描述', passed: !!seoAudit?.meta_tags?.hasDescription },
    { name: 'H1 標題結構', passed: !!seoAudit?.h1_structure?.hasOnlyOneH1 },
    { name: '圖片 Alt 屬性', passed: (seoAudit?.alt_tags?.altCoverage || 0) >= 80 },
    { name: '行動版相容', passed: !!seoAudit?.mobile_compatible?.hasViewport },
  ]

  const aeoChecks = [
    { name: 'JSON-LD', passed: !!aeoAudit?.json_ld },
    { name: 'FAQ Schema', passed: !!aeoAudit?.faq_schema },
    { name: 'Canonical', passed: !!aeoAudit?.canonical },
    { name: '麵包屑導航', passed: !!aeoAudit?.breadcrumbs },
    { name: 'Open Graph', passed: !!aeoAudit?.open_graph },
    { name: '問句式標題', passed: !!aeoAudit?.question_headings },
    { name: 'Meta 描述長度', passed: !!aeoAudit?.meta_desc_length },
    { name: '結構化答案', passed: !!aeoAudit?.structured_answer },
  ]

  const geoChecks = [
    { name: 'llms.txt', passed: !!geoAudit?.llms_txt },
    { name: 'AI 爬蟲開放', passed: !!geoAudit?.robots_ai },
    { name: 'Sitemap', passed: !!geoAudit?.sitemap },
    { name: 'Open Graph', passed: !!geoAudit?.open_graph },
    { name: 'Twitter Card', passed: !!geoAudit?.twitter_card },
    { name: 'JSON-LD 引用信號', passed: !!geoAudit?.json_ld_citation },
    { name: 'Canonical', passed: !!geoAudit?.canonical },
    { name: 'HTTPS', passed: !!geoAudit?.https },
  ]

  const eeatChecks = [
    { name: '作者資訊', passed: !!eeatAudit?.author_info },
    { name: '關於我們', passed: !!eeatAudit?.about_page },
    { name: '聯絡方式', passed: !!eeatAudit?.contact_page },
    { name: '隱私權政策', passed: !!eeatAudit?.privacy_policy },
    { name: 'Organization Schema', passed: !!eeatAudit?.organization_schema },
    { name: '發布日期', passed: !!eeatAudit?.date_published },
    { name: '社群媒體連結', passed: !!eeatAudit?.social_links },
    { name: '外部權威連結', passed: !!eeatAudit?.outbound_links },
  ]

  function renderChecks(checks) {
    return checks.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:14px;font-weight:bold;color:${c.passed ? '#16a34a' : '#dc2626'};width:20px;text-align:center;">
          ${checkIcon(c.passed)}
        </span>
        <span style="font-size:13px;color:#374151;flex:1;">${c.name}</span>
        <span style="font-size:12px;padding:2px 10px;border-radius:99px;background:${c.passed ? '#dcfce7' : '#fee2e2'};color:${c.passed ? '#166534' : '#991b1b'};">
          ${c.passed ? '通過' : '未通過'}
        </span>
      </div>
    `).join('')
  }

  function renderScoreCard(label, score, color) {
    return `
      <div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:2px solid ${color}20;">
        <div style="font-size:32px;font-weight:bold;color:${scoreColor(score)};">${score}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
      </div>
    `
  }

  return `
    <div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;padding:0;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e293b 0%,#4c1d95 100%);padding:40px 48px;color:white;">
        <div style="font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:4px;">AI 雷達 — AI 能見度報告</div>
        <div style="font-size:14px;opacity:0.7;margin-bottom:16px;">AI Radar — AI Visibility Audit Report</div>
        <div style="font-size:16px;font-weight:500;background:rgba(255,255,255,0.1);padding:8px 16px;border-radius:8px;display:inline-block;">
          ${website?.url || ''}
        </div>
        <div style="margin-top:12px;font-size:12px;opacity:0.6;">報告生成日期：${date}</div>
      </div>

      <!-- Overall Score -->
      <div style="padding:32px 48px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
        <div style="display:flex;align-items:center;gap:32px;">
          <div style="text-align:center;min-width:100px;">
            <div style="font-size:56px;font-weight:bold;color:${scoreColor(overall)};line-height:1;">${overall}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">綜合分數</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:8px;">${website?.name || website?.url || ''}</div>
            <div style="font-size:13px;color:#64748b;margin-bottom:16px;">
              本報告涵蓋 SEO 技術優化、AEO 答案引擎優化、GEO 生成式 AI 優化及 E-E-A-T 信任度指標共 ${seoChecks.length + aeoChecks.length + geoChecks.length + eeatChecks.length} 項檢測。
            </div>
            <div style="display:flex;gap:8px;">
              ${renderScoreCard('SEO', seoScore, '#3b82f6')}
              ${renderScoreCard('AEO', aeoScore, '#8b5cf6')}
              ${renderScoreCard('GEO', geoScore, '#10b981')}
              ${renderScoreCard('E-E-A-T', eeatScore, '#f59e0b')}
            </div>
          </div>
        </div>
      </div>

      <div style="padding:32px 48px;">

        <!-- SEO Section -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #3b82f6;">
            <div style="width:36px;height:36px;background:#3b82f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">S</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">SEO 技術優化</div>
              <div style="font-size:12px;color:#64748b;">Search Engine Optimization</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:bold;color:${scoreColor(seoScore)};">${seoScore}</div>
          </div>
          ${renderChecks(seoChecks)}
        </div>

        <!-- AEO Section -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #8b5cf6;">
            <div style="width:36px;height:36px;background:#8b5cf6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">A</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">AEO 答案引擎優化</div>
              <div style="font-size:12px;color:#64748b;">Answer Engine Optimization</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:bold;color:${scoreColor(aeoScore)};">${aeoScore}</div>
          </div>
          ${renderChecks(aeoChecks)}
        </div>

        <!-- GEO Section -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #10b981;">
            <div style="width:36px;height:36px;background:#10b981;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">G</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">GEO 生成式 AI 優化</div>
              <div style="font-size:12px;color:#64748b;">Generative Engine Optimization</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:bold;color:${scoreColor(geoScore)};">${geoScore}</div>
          </div>
          ${renderChecks(geoChecks)}
        </div>

        <!-- E-E-A-T Section -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #f59e0b;">
            <div style="width:36px;height:36px;background:#f59e0b;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">E</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">E-E-A-T 信任度指標</div>
              <div style="font-size:12px;color:#64748b;">Experience, Expertise, Authoritativeness, Trustworthiness</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:bold;color:${scoreColor(eeatScore)};">${eeatScore}</div>
          </div>
          ${renderChecks(eeatChecks)}
        </div>

        <!-- Footer -->
        <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:11px;">
          本報告由 AI 雷達（優勢方舟數位行銷營運）AI 能見度檢測平台自動生成 · ${date}<br/>
          報告僅供參考，實際搜尋排名受多重因素影響
        </div>
      </div>
    </div>
  `
}

// ════════════════════════════════════════════════════════════════
// 2026-06-07：客戶提案 PDF（白標版）— 給代理商拿去賣客戶用
// 跟舊的 exportDashboardPDF 並存：
//   - exportDashboardPDF: 代理商自己看、紫色 header、Aark 署名 footer
//   - exportClientProposalPDF: 給代理商客戶看、Aark 青綠主題、可白標代理商名稱
//
// clientInfo {
//   clientName,     // 必填：客戶公司 / 品牌名（顯示在封面 hero）
//   agencyName,     // 選填：代理商名稱（白標 footer「由 X 提交」）
//   agencyContact,  // 選填：代理商聯絡（email / phone）
//   reportTitle,    // 選填：自訂報告標題（預設「AI 能見度檢測報告」）
// }
// ════════════════════════════════════════════════════════════════

// Aark Direction C radar mark 內嵌 SVG — 在 html2canvas 中可正確 render
const AARK_MARK_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="vertical-align:middle;">
  <circle cx="32" cy="32" r="26" stroke="#18c590" stroke-width="3"/>
  <path d="M 32 32 L 32 6 L 51 16 Z" fill="#18c590" fill-opacity="0.85"/>
  <path d="M 32 32 L 32 6 L 13 16 Z" fill="#18c590" fill-opacity="0.4"/>
  <circle cx="32" cy="32" r="3" fill="#18c590"/>
</svg>
`

// 從失敗 audit 抽出建議行動 Top 5（給「下一步建議」段落用）
// 邏輯對齊 DashboardV2 generateQuests、但精簡為純文字描述
function buildActionItems({ seoAudit, aeoAudit, geoAudit, eeatAudit }) {
  const items = []
  if (seoAudit?.bot_accessibility && seoAudit.bot_accessibility.passed === false) {
    items.push({ priority: 10, layer: 'SEO', title: '解除 Cloudflare 對 AI 爬蟲的封鎖', desc: 'GPTBot / Claude / Perplexity 等被擋的話 AI 完全找不到你' })
  }
  if (aeoAudit && !aeoAudit.json_ld) {
    items.push({ priority: 10, layer: 'AEO', title: '加入 JSON-LD 結構化資料', desc: 'AI 沒辦法理解你的頁面結構、修這個 AI 引用率會大幅提升' })
  }
  if (geoAudit && !geoAudit.robots_ai) {
    items.push({ priority: 10, layer: 'GEO', title: '檢查 robots.txt 沒擋 AI 爬蟲', desc: 'GPTBot / Google-Extended 被擋 = AI 完全找不到你' })
  }
  if (seoAudit?.meta_tags && seoAudit.meta_tags.passed === false) {
    items.push({ priority: 9, layer: 'SEO', title: '補完 Meta 標籤', desc: 'Title / Description 缺漏會讓 Google SERP 顯示殘缺、CTR 大幅下降' })
  }
  if (geoAudit && !geoAudit.llms_txt) {
    items.push({ priority: 9, layer: 'GEO', title: '建立 llms.txt', desc: '告訴 ChatGPT / Claude 怎麼讀你的網站、LLMO 業界新標準' })
  }
  if (aeoAudit && !aeoAudit.faq_schema) {
    items.push({ priority: 9, layer: 'AEO', title: '補 FAQ Schema', desc: 'AI 引用率會提升 ~15%、特別適合教學 / 服務介紹頁' })
  }
  if (eeatAudit && !eeatAudit.organization_schema) {
    items.push({ priority: 8, layer: 'E-E-A-T', title: '加 Organization Schema', desc: '告訴 Google 「你是誰」的核心訊號、品牌可信度大幅提升' })
  }
  if (seoAudit?.h1_structure && seoAudit.h1_structure.passed === false) {
    items.push({ priority: 8, layer: 'SEO', title: '修 H1 結構', desc: '頁面缺 H1 或多個 H1 — SEO 權重會被稀釋' })
  }
  if (geoAudit && !geoAudit.sitemap) {
    items.push({ priority: 7, layer: 'GEO', title: '建 sitemap.xml', desc: '幫 AI 爬蟲快速發現所有頁面' })
  }
  if (eeatAudit && !eeatAudit.author_info) {
    items.push({ priority: 6, layer: 'E-E-A-T', title: '加文章作者署名', desc: 'E-E-A-T 分數會 +6、AI 判斷你可信值得引用' })
  }
  if (aeoAudit && !aeoAudit.open_graph) {
    items.push({ priority: 6, layer: 'AEO', title: '補 Open Graph 標籤', desc: 'FB / LINE / X 分享預覽會空白、social CTR 會差' })
  }
  return items.sort((a, b) => b.priority - a.priority).slice(0, 5)
}

const LAYER_COLOR = {
  SEO: '#3b82f6', AEO: '#8b5cf6', GEO: '#10b981', 'E-E-A-T': '#f59e0b',
}

// ─── 2026-06-07 改：HTML 拆成多個獨立 section、各自渲染成 canvas、各自 1 頁 PDF ───
// 之前用單一 HTML + html2canvas 切片、會在文字中間切（user feedback）
// 改成「每個 section 1 個 canvas、1 頁 PDF」、徹底沒切字問題

function buildCoverHTML(data, clientInfo) {
  const { website } = data
  const { clientName = '', agencyName = '', agencyContact = '', reportTitle = 'AI 能見度檢測報告' } = clientInfo || {}
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  return `
    <div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;">
      <div style="background:linear-gradient(155deg, #050608 0%, #04130f 30%, #052e2c 60%, #18c590 130%);padding:80px 56px;color:white;min-height:1080px;display:flex;flex-direction:column;">
        <!-- Aark wordmark + mark -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:60px;">
          ${AARK_MARK_SVG}
          <div>
            <div style="font-size:32px;font-weight:bold;letter-spacing:-0.04em;font-family:'Inter','Microsoft JhengHei',sans-serif;">Aark</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px;">AI 雷達 · LLMO 監測平台</div>
          </div>
        </div>
        <div style="display:inline-block;width:auto;padding:6px 14px;background:rgba(24,197,144,0.18);border:1px solid rgba(24,197,144,0.5);border-radius:99px;font-size:11px;color:#86efac;font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;margin-bottom:30px;text-transform:uppercase;align-self:flex-start;">
          LLMO Monitoring Report
        </div>
        <div style="font-size:54px;font-weight:bold;letter-spacing:-0.025em;line-height:1.1;margin-bottom:10px;">${reportTitle}</div>
        <div style="font-size:24px;color:rgba(255,255,255,0.75);margin-bottom:50px;letter-spacing:-0.01em;">AI Visibility Audit Report</div>
        ${clientName ? `
        <div style="padding:24px 28px;background:rgba(255,255,255,0.06);border-left:4px solid #18c590;border-radius:12px;margin-bottom:30px;">
          <div style="font-size:11px;color:rgba(255,255,255,0.5);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">為您製作 · Prepared For</div>
          <div style="font-size:28px;font-weight:bold;color:white;letter-spacing:-0.01em;">${clientName}</div>
          ${website?.url ? `<div style="font-size:14px;color:rgba(255,255,255,0.65);margin-top:6px;font-family:'JetBrains Mono',monospace;">${website.url}</div>` : ''}
        </div>` : ''}
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-top:40px;border-top:1px solid rgba(255,255,255,0.1);">
          <div>
            ${agencyName ? `
              <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">提交者 · Prepared By</div>
              <div style="font-size:16px;font-weight:600;color:white;">${agencyName}</div>
              ${agencyContact ? `<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:2px;">${agencyContact}</div>` : ''}
            ` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;">報告日期 · Date</div>
            <div style="font-size:14px;color:white;font-family:'JetBrains Mono',monospace;">${date}</div>
          </div>
        </div>
      </div>
    </div>
  `
}

function buildSummaryHTML(data) {
  const { seoAudit, aeoAudit, geoAudit, eeatAudit } = data
  const seoScore = seoAudit?.score || 0
  const aeoScore = aeoAudit?.score || 0
  const geoScore = geoAudit?.score || 0
  const eeatScore = eeatAudit?.score || 0
  const overall = Math.round((seoScore + aeoScore + geoScore + eeatScore) / 4)
  function renderScoreCard(label, score, color) {
    return `<div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:2px solid ${color}33;">
      <div style="font-size:32px;font-weight:bold;color:${scoreColor(score)};">${score}</div>
      <div style="font-size:11px;color:#64748b;margin-top:4px;letter-spacing:0.05em;">${label}</div>
    </div>`
  }
  return `
    <div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;padding:48px 56px;min-height:1080px;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">01 · Executive Summary</div>
      <h2 style="font-size:28px;font-weight:bold;color:#1e293b;margin:0 0 20px;letter-spacing:-0.02em;">總體 AI 能見度分析</h2>
      <div style="display:flex;align-items:center;gap:32px;padding:28px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;margin-bottom:32px;">
        <div style="text-align:center;min-width:120px;">
          <div style="font-size:72px;font-weight:bold;color:${scoreColor(overall)};line-height:1;letter-spacing:-0.04em;">${overall}</div>
          <div style="font-size:13px;color:#64748b;margin-top:8px;letter-spacing:0.05em;">綜合分數 / 100</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          ${renderScoreCard('SEO', seoScore, LAYER_COLOR.SEO)}
          ${renderScoreCard('AEO', aeoScore, LAYER_COLOR.AEO)}
          ${renderScoreCard('GEO', geoScore, LAYER_COLOR.GEO)}
          ${renderScoreCard('E-E-A-T', eeatScore, LAYER_COLOR['E-E-A-T'])}
        </div>
      </div>
      <h3 style="font-size:18px;font-weight:bold;color:#1e293b;margin:0 0 12px;letter-spacing:-0.01em;">LLMO 5 訊號層架構</h3>
      <p style="font-size:13px;color:#64748b;line-height:1.7;margin:0 0 16px;">
        LLMO（Large Language Model Optimization）是 AI 搜尋時代的優化框架。Aark 把它拆成 5 個可量化訊號層、各自打分：
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;background:#f1f5f9;color:#475569;font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:6px 0 0 0;">訊號層</th>
            <th style="text-align:left;padding:8px 12px;background:#f1f5f9;color:#475569;font-weight:600;font-size:11px;letter-spacing:0.05em;">說明</th>
            <th style="text-align:right;padding:8px 12px;background:#f1f5f9;color:#475569;font-weight:600;font-size:11px;letter-spacing:0.05em;border-radius:0 6px 0 0;">您的分數</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${LAYER_COLOR.SEO};font-weight:600;">① SEO</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">傳統搜尋排名地基 — 讓 Google 找到你</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:${scoreColor(seoScore)};">${seoScore}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${LAYER_COLOR.AEO};font-weight:600;">② AEO</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">讓 AI 把你當答案、引用你的內容</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:${scoreColor(aeoScore)};">${aeoScore}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${LAYER_COLOR.GEO};font-weight:600;">③ GEO</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">讓 ChatGPT / Perplexity 主動推薦你</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:${scoreColor(geoScore)};">${geoScore}</td></tr>
          <tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:${LAYER_COLOR['E-E-A-T']};font-weight:600;">④ E-E-A-T</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">可信度框架 — AI 判斷你值得引用的訊號</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:bold;color:${scoreColor(eeatScore)};">${eeatScore}</td></tr>
          <tr><td style="padding:10px 12px;color:#f97316;font-weight:600;">⑤ aivis</td><td style="padding:10px 12px;color:#475569;">跨 LLM 引用率追蹤 — 結果驗證層</td><td style="padding:10px 12px;text-align:right;color:#94a3b8;font-size:11px;">需 Pro 訂閱</td></tr>
        </tbody>
      </table>
    </div>
  `
}

function buildRecommendationsHTML(data, clientInfo) {
  const actionItems = buildActionItems(data)
  if (actionItems.length === 0) return null
  const { agencyName } = clientInfo || {}
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  return `
    <div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;padding:48px 56px;min-height:1080px;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">02 · Recommendations</div>
      <h2 style="font-size:28px;font-weight:bold;color:#1e293b;margin:0 0 12px;letter-spacing:-0.02em;">給您的 Top ${actionItems.length} 建議行動</h2>
      <p style="font-size:13px;color:#64748b;line-height:1.7;margin:0 0 20px;">
        以下依優先級排序、由高至低、修這 ${actionItems.length} 項可帶來最大 AI 能見度提升。建議在下一個 sprint 內完成。
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${actionItems.map((it, i) => `
          <div style="padding:18px 20px;background:#f8fafc;border-radius:12px;border-left:4px solid ${LAYER_COLOR[it.layer] || '#94a3b8'};">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="font-size:13px;font-weight:bold;color:${LAYER_COLOR[it.layer] || '#475569'};">${String(i + 1).padStart(2, '0')}</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${(LAYER_COLOR[it.layer] || '#94a3b8')}22;color:${LAYER_COLOR[it.layer] || '#475569'};font-weight:600;letter-spacing:0.05em;">${it.layer}</span>
              <span style="font-size:16px;font-weight:700;color:#1e293b;">${it.title}</span>
            </div>
            <p style="font-size:13px;color:#64748b;line-height:1.7;margin:0 0 0 26px;">${it.desc}</p>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:auto;padding-top:40px;text-align:center;font-size:11px;color:#94a3b8;line-height:1.8;">
        ${agencyName ? `本報告由 <strong style="color:#1e293b;">${agencyName}</strong> 提供 · ` : ''}
        技術監測 · <strong style="color:#18c590;">Aark</strong> AI 雷達（LLMO 監測平台）· ${date}
      </div>
    </div>
  `
}

function buildDetailedAuditHTML(data, clientInfo) {
  const { seoAudit, aeoAudit, geoAudit, eeatAudit } = data
  const { agencyName } = clientInfo || {}
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const seoScore = seoAudit?.score || 0
  const aeoScore = aeoAudit?.score || 0
  const geoScore = geoAudit?.score || 0
  const eeatScore = eeatAudit?.score || 0

  const seoChecks = [
    { name: 'Meta 標籤', passed: !!seoAudit?.meta_tags?.hasTitle && !!seoAudit?.meta_tags?.hasDescription },
    { name: 'H1 結構唯一性', passed: !!seoAudit?.h1_structure?.hasOnlyOneH1 },
    { name: '圖片 Alt 文字', passed: (seoAudit?.alt_tags?.altCoverage || 0) >= 80 },
    { name: '行動版相容', passed: !!seoAudit?.mobile_compatible?.hasViewport },
    { name: '頁面載入速度', passed: (seoAudit?.page_speed?.score || 0) >= 60 },
  ]
  const aeoChecks = [
    { name: 'JSON-LD 結構化資料', passed: !!aeoAudit?.json_ld },
    { name: 'FAQ Schema', passed: !!aeoAudit?.faq_schema },
    { name: 'Canonical 標籤', passed: !!aeoAudit?.canonical },
    { name: '麵包屑導航', passed: !!aeoAudit?.breadcrumbs },
    { name: 'Open Graph', passed: !!aeoAudit?.open_graph },
    { name: '問句式標題', passed: !!aeoAudit?.question_headings },
  ]
  const geoChecks = [
    { name: 'llms.txt 配置', passed: !!geoAudit?.llms_txt },
    { name: 'AI 爬蟲開放性', passed: !!geoAudit?.robots_ai },
    { name: 'Sitemap', passed: !!geoAudit?.sitemap },
    { name: 'JSON-LD 引用信號', passed: !!geoAudit?.json_ld_citation },
    { name: 'Canonical', passed: !!geoAudit?.canonical },
    { name: 'HTTPS', passed: !!geoAudit?.https },
  ]
  const eeatChecks = [
    { name: '作者資訊', passed: !!eeatAudit?.author_info },
    { name: '關於我們頁', passed: !!eeatAudit?.about_page },
    { name: '聯絡方式', passed: !!eeatAudit?.contact_page },
    { name: '隱私權政策', passed: !!eeatAudit?.privacy_policy },
    { name: 'Organization Schema', passed: !!eeatAudit?.organization_schema },
    { name: '社群媒體連結', passed: !!eeatAudit?.social_links },
  ]
  function renderChecks(checks) {
    return checks.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:13px;font-weight:bold;color:${c.passed ? '#16a34a' : '#dc2626'};width:20px;text-align:center;">${c.passed ? '✓' : '✗'}</span>
        <span style="font-size:13px;color:#374151;flex:1;">${c.name}</span>
        <span style="font-size:11px;padding:2px 10px;border-radius:99px;background:${c.passed ? '#dcfce7' : '#fee2e2'};color:${c.passed ? '#166534' : '#991b1b'};">
          ${c.passed ? '通過' : '待修'}
        </span>
      </div>
    `).join('')
  }
  return `
    <div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;padding:48px 56px;">
      <div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">03 · Detailed Audit</div>
      <h2 style="font-size:28px;font-weight:bold;color:#1e293b;margin:0 0 24px;letter-spacing:-0.02em;">各訊號層詳細檢測</h2>
      ${[
        { key: 'SEO', fullName: 'Search Engine Optimization', score: seoScore, checks: seoChecks, desc: '傳統搜尋排名地基' },
        { key: 'AEO', fullName: 'Answer Engine Optimization', score: aeoScore, checks: aeoChecks, desc: '讓 AI 把你當答案' },
        { key: 'GEO', fullName: 'Generative Engine Optimization', score: geoScore, checks: geoChecks, desc: '讓生成式 AI 推薦你' },
        { key: 'E-E-A-T', fullName: 'Experience · Expertise · Authoritativeness · Trustworthiness', score: eeatScore, checks: eeatChecks, desc: '可信度框架' },
      ].map(s => `
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid ${LAYER_COLOR[s.key]};">
            <div style="width:36px;height:36px;background:${LAYER_COLOR[s.key]};border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:bold;">${s.key.charAt(0)}</div>
            <div>
              <div style="font-size:16px;font-weight:700;color:#1e293b;">${s.key}</div>
              <div style="font-size:11px;color:#64748b;">${s.fullName} · ${s.desc}</div>
            </div>
            <div style="margin-left:auto;font-size:28px;font-weight:bold;color:${scoreColor(s.score)};">${s.score}</div>
          </div>
          ${renderChecks(s.checks)}
        </div>
      `).join('')}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.8;">
        ${agencyName ? `本報告由 <strong style="color:#1e293b;">${agencyName}</strong> 提供 · ` : ''}
        技術監測 · <strong style="color:#18c590;">Aark</strong> AI 雷達（LLMO 監測平台）· ${date}
      </div>
    </div>
  `
}

export async function exportClientProposalPDF(data, clientInfo) {
  // 2026-06-07：分段渲染 — 每個 section 各自 1 個 canvas、各自 1 頁 PDF
  // 不再用單一 HTML + html2canvas 切片（之前會在文字中間切、看起來不專業）
  const sections = [
    buildCoverHTML(data, clientInfo),
    buildSummaryHTML(data),
    buildRecommendationsHTML(data, clientInfo),  // 可能 null（無建議行動）
    buildDetailedAuditHTML(data, clientInfo),
  ].filter(Boolean)

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

      // 從第二個 section 開始、每個都先 addPage
      if (i > 0) pdf.addPage()

      // section 短於 A4：直接放進去（不會切字）
      // section 長於 A4：分頁處理（這時切的是同 section 內、不會切 section 標題等關鍵內容）
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

    const clientSlug = (clientInfo?.clientName || data.website?.name || data.website?.url?.replace(/https?:\/\//, '') || 'report')
      .replace(/[^a-zA-Z0-9一-龥]/g, '_').slice(0, 30)
    const dateStr = new Date().toISOString().slice(0, 10)
    pdf.save(`AI能見度報告_${clientSlug}_${dateStr}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

// ════════════════════════════════════════════════════════════════
// 舊版 exportDashboardPDF — 給 legacy Dashboard.jsx 用、保持不動
// ════════════════════════════════════════════════════════════════
export async function exportDashboardPDF(data) {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;z-index:-1;background:white;'
  container.innerHTML = buildReportHTML(data)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pdfWidth
    const imgHeight = (canvas.height * pdfWidth) / canvas.width

    let position = 0
    let remainingHeight = imgHeight

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    remainingHeight -= pdfHeight

    while (remainingHeight > 0) {
      position -= pdfHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      remainingHeight -= pdfHeight
    }

    const siteName = data.website?.name || data.website?.url?.replace(/https?:\/\//, '') || 'report'
    const dateStr = new Date().toISOString().slice(0, 10)
    pdf.save(`AI能見度報告_${siteName}_${dateStr}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}
