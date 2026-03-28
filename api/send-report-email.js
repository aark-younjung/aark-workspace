/**
 * POST /api/send-report-email
 * 傳送 AI 能見度報告到指定信箱
 *
 * Body: {
 *   email: string,
 *   website: { url, name },
 *   scores: { seo, aeo, geo, eeat, overall },
 *   checks: { seo: [{name, passed}], aeo: [...], geo: [...], eeat: [...] }
 * }
 *
 * Env: RESEND_API_KEY
 */

function scoreColor(score) {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

function scoreBadge(score) {
  const color = scoreColor(score)
  return `<span style="font-size:22px;font-weight:bold;color:${color};">${score}</span>`
}

function checkRow(name, passed) {
  return `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#374151;">${name}</td>
      <td style="padding:7px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
        <span style="font-size:12px;padding:2px 10px;border-radius:99px;
          background:${passed ? '#dcfce7' : '#fee2e2'};
          color:${passed ? '#166534' : '#991b1b'};">
          ${passed ? '通過' : '未通過'}
        </span>
      </td>
    </tr>
  `
}

function buildEmailHTML({ website, scores, checks, dashboardUrl }) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const { seo = 0, aeo = 0, geo = 0, eeat = 0, overall = 0 } = scores

  const modules = [
    { label: 'SEO', score: seo, color: '#3b82f6', items: checks?.seo || [] },
    { label: 'AEO', score: aeo, color: '#8b5cf6', items: checks?.aeo || [] },
    { label: 'GEO', score: geo, color: '#10b981', items: checks?.geo || [] },
    { label: 'E-E-A-T', score: eeat, color: '#f59e0b', items: checks?.eeat || [] },
  ]

  const moduleSections = modules.map(m => `
    <tr><td style="padding:24px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:10px;border-bottom:2px solid ${m.color};">
            <span style="font-size:15px;font-weight:700;color:#1e293b;">${m.label}</span>
            <span style="float:right;font-size:24px;font-weight:bold;color:${scoreColor(m.score)};">${m.score}</span>
          </td>
        </tr>
        ${m.items.map(c => checkRow(c.name, c.passed)).join('')}
      </table>
    </td></tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Microsoft JhengHei','PingFang TC',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#4c1d95 100%);padding:32px 40px;">
          <div style="font-size:20px;font-weight:bold;color:white;letter-spacing:0.5px;">優勢方舟 AI 能見度報告</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">AARK — AI Visibility Audit Report</div>
          <div style="margin-top:16px;font-size:14px;color:rgba(255,255,255,0.9);background:rgba(255,255,255,0.1);padding:8px 14px;border-radius:8px;display:inline-block;">
            ${website?.url || ''}
          </div>
          <div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,0.5);">報告日期：${date}</div>
        </td></tr>

        <!-- Overall Score -->
        <tr><td style="padding:28px 40px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:0 12px 0 0;width:90px;">
                <div style="font-size:52px;font-weight:bold;color:${scoreColor(overall)};line-height:1;">${overall}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">綜合分數</div>
              </td>
              <td>
                <table width="100%" cellpadding="4" cellspacing="0">
                  <tr>
                    <td style="text-align:center;background:#eff6ff;border-radius:8px;padding:10px;">
                      <div style="font-size:11px;color:#3b82f6;">SEO</div>
                      ${scoreBadge(seo)}
                    </td>
                    <td width="8"></td>
                    <td style="text-align:center;background:#f5f3ff;border-radius:8px;padding:10px;">
                      <div style="font-size:11px;color:#8b5cf6;">AEO</div>
                      ${scoreBadge(aeo)}
                    </td>
                    <td width="8"></td>
                    <td style="text-align:center;background:#f0fdf4;border-radius:8px;padding:10px;">
                      <div style="font-size:11px;color:#10b981;">GEO</div>
                      ${scoreBadge(geo)}
                    </td>
                    <td width="8"></td>
                    <td style="text-align:center;background:#fffbeb;border-radius:8px;padding:10px;">
                      <div style="font-size:11px;color:#f59e0b;">E-E-A-T</div>
                      ${scoreBadge(eeat)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Module Sections -->
        <tr><td style="padding:8px 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${moduleSections}
          </table>
        </td></tr>

        <!-- CTA -->
        ${dashboardUrl ? `
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-weight:600;font-size:14px;border-radius:10px;text-decoration:none;">
            查看完整報告 →
          </a>
        </td></tr>
        ` : ''}

        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">
            本報告由 優勢方舟 (AARK) 自動生成 · ${date}<br>
            如需取消訂閱，請回到儀表板的「Email 通知」設定
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
  }

  const { email, website, scores, checks, dashboardUrl } = req.body

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const html = buildEmailHTML({ website, scores, checks, dashboardUrl })

  const overall = scores?.overall || 0
  const subject = `AI 能見度報告：${website?.name || website?.url || '您的網站'} — 綜合分數 ${overall} 分`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AARK 優勢方舟 <report@aark.io>',
        to: [email],
        subject,
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return res.status(500).json({ error: data.message || 'Failed to send email' })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('Send email error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
