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
        <div style="font-size:22px;font-weight:bold;letter-spacing:1px;margin-bottom:4px;">優勢方舟 AI 能見度報告</div>
        <div style="font-size:14px;opacity:0.7;margin-bottom:16px;">AARK — AI Visibility Audit Report</div>
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
          本報告由 優勢方舟 (AARK) AI 能見度檢測平台自動生成 · ${date}<br/>
          報告僅供參考，實際搜尋排名受多重因素影響
        </div>
      </div>
    </div>
  `
}

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
