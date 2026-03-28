/**
 * GET /api/cron-weekly-reports
 * Vercel Cron Job — 每週一 09:00 UTC 自動寄送週報
 *
 * Env:
 *   RESEND_API_KEY         — Resend API key
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (bypass RLS)
 *   CRON_SECRET            — Secret to verify cron caller
 *   NEXT_PUBLIC_SITE_URL   — e.g. https://aark.io (for dashboard links)
 */

import { createClient } from '@supabase/supabase-js'

function scoreColor(score) {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
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

function buildEmailHTML({ website, seoAudit, aeoAudit, geoAudit, eeatAudit, dashboardUrl }) {
  const date = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
  const seo = seoAudit?.score || 0
  const aeo = aeoAudit?.score || 0
  const geo = geoAudit?.score || 0
  const eeat = eeatAudit?.score || 0
  const overall = Math.round((seo + aeo + geo + eeat) / 4)

  const modules = [
    {
      label: 'SEO', score: seo, color: '#3b82f6',
      items: [
        { name: 'Meta 標題', passed: !!seoAudit?.meta_tags?.hasTitle },
        { name: 'Meta 描述', passed: !!seoAudit?.meta_tags?.hasDescription },
        { name: 'H1 標題結構', passed: !!seoAudit?.h1_structure?.hasOnlyOneH1 },
        { name: '圖片 Alt 屬性', passed: (seoAudit?.alt_tags?.altCoverage || 0) >= 80 },
        { name: '行動版相容', passed: !!seoAudit?.mobile_compatible?.hasViewport },
      ],
    },
    {
      label: 'AEO', score: aeo, color: '#8b5cf6',
      items: [
        { name: 'JSON-LD', passed: !!aeoAudit?.json_ld },
        { name: 'FAQ Schema', passed: !!aeoAudit?.faq_schema },
        { name: 'Canonical', passed: !!aeoAudit?.canonical },
        { name: '麵包屑導航', passed: !!aeoAudit?.breadcrumbs },
        { name: 'Open Graph', passed: !!aeoAudit?.open_graph },
        { name: '問句式標題', passed: !!aeoAudit?.question_headings },
        { name: 'Meta 描述長度', passed: !!aeoAudit?.meta_desc_length },
        { name: '結構化答案', passed: !!aeoAudit?.structured_answer },
      ],
    },
    {
      label: 'GEO', score: geo, color: '#10b981',
      items: [
        { name: 'llms.txt', passed: !!geoAudit?.llms_txt },
        { name: 'AI 爬蟲開放', passed: !!geoAudit?.robots_ai },
        { name: 'Sitemap', passed: !!geoAudit?.sitemap },
        { name: 'Open Graph', passed: !!geoAudit?.open_graph },
        { name: 'Twitter Card', passed: !!geoAudit?.twitter_card },
        { name: 'JSON-LD 引用信號', passed: !!geoAudit?.json_ld_citation },
        { name: 'Canonical', passed: !!geoAudit?.canonical },
        { name: 'HTTPS', passed: !!geoAudit?.https },
      ],
    },
    {
      label: 'E-E-A-T', score: eeat, color: '#f59e0b',
      items: [
        { name: '作者資訊', passed: !!eeatAudit?.author_info },
        { name: '關於我們', passed: !!eeatAudit?.about_page },
        { name: '聯絡方式', passed: !!eeatAudit?.contact_page },
        { name: '隱私權政策', passed: !!eeatAudit?.privacy_policy },
        { name: 'Organization Schema', passed: !!eeatAudit?.organization_schema },
        { name: '發布日期', passed: !!eeatAudit?.date_published },
        { name: '社群媒體連結', passed: !!eeatAudit?.social_links },
        { name: '外部權威連結', passed: !!eeatAudit?.outbound_links },
      ],
    },
  ]

  const moduleSections = modules.map(m => `
    <tr><td style="padding:20px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:10px;border-bottom:2px solid ${m.color};">
            <span style="font-size:15px;font-weight:700;color:#1e293b;">${m.label}</span>
            <span style="float:right;font-size:22px;font-weight:bold;color:${scoreColor(m.score)};">${m.score}</span>
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
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,#4c1d95 100%);padding:32px 40px;">
          <div style="font-size:20px;font-weight:bold;color:white;">優勢方舟 週報</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">AARK Weekly AI Visibility Report</div>
          <div style="margin-top:16px;font-size:14px;color:rgba(255,255,255,0.9);background:rgba(255,255,255,0.1);padding:8px 14px;border-radius:8px;display:inline-block;">${website?.url || ''}</div>
          <div style="margin-top:10px;font-size:12px;color:rgba(255,255,255,0.5);">報告日期：${date}</div>
        </td></tr>
        <tr><td style="padding:28px 40px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:0 16px 0 0;width:90px;">
                <div style="font-size:52px;font-weight:bold;color:${scoreColor(overall)};line-height:1;">${overall}</div>
                <div style="font-size:11px;color:#64748b;margin-top:4px;">綜合分數</div>
              </td>
              <td>
                <table width="100%" cellpadding="4" cellspacing="0">
                  <tr>
                    <td style="text-align:center;background:#eff6ff;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#3b82f6;">SEO</div><span style="font-size:22px;font-weight:bold;color:${scoreColor(seo)};">${seo}</span></td>
                    <td width="6"></td>
                    <td style="text-align:center;background:#f5f3ff;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#8b5cf6;">AEO</div><span style="font-size:22px;font-weight:bold;color:${scoreColor(aeo)};">${aeo}</span></td>
                    <td width="6"></td>
                    <td style="text-align:center;background:#f0fdf4;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#10b981;">GEO</div><span style="font-size:22px;font-weight:bold;color:${scoreColor(geo)};">${geo}</span></td>
                    <td width="6"></td>
                    <td style="text-align:center;background:#fffbeb;border-radius:8px;padding:10px;"><div style="font-size:11px;color:#f59e0b;">E-E-A-T</div><span style="font-size:22px;font-weight:bold;color:${scoreColor(eeat)};">${eeat}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">${moduleSections}</table>
        </td></tr>
        ${dashboardUrl ? `<tr><td style="padding:0 40px 32px;text-align:center;"><a href="${dashboardUrl}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;font-weight:600;font-size:14px;border-radius:10px;text-decoration:none;">查看完整報告 →</a></td></tr>` : ''}
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">本週報由 優勢方舟 (AARK) 自動生成 · ${date}<br>如需取消訂閱，請回到儀表板的「Email 通知」設定</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export default async function handler(req, res) {
  // Verify cron secret to prevent unauthorized calls
  const secret = process.env.CRON_SECRET
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark.io'

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get active subscriptions not sent in the past 6 days
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  const { data: subscriptions, error } = await supabase
    .from('email_subscriptions')
    .select('*, websites(*)')
    .eq('is_active', true)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sixDaysAgo}`)

  if (error) {
    console.error('Subscription query error:', error)
    return res.status(500).json({ error: error.message })
  }

  const results = { sent: 0, failed: 0, skipped: 0 }

  for (const sub of subscriptions || []) {
    try {
      const websiteId = sub.website_id

      // Fetch latest audits for this website
      const [seoRes, aeoRes, geoRes, eeatRes] = await Promise.all([
        supabase.from('seo_audits').select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('aeo_audits').select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('geo_audits').select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('eeat_audits').select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      if (!seoRes.data && !aeoRes.data) {
        results.skipped++
        continue
      }

      const dashboardUrl = `${SITE_URL}/dashboard/${websiteId}`
      const html = buildEmailHTML({
        website: sub.websites,
        seoAudit: seoRes.data,
        aeoAudit: aeoRes.data,
        geoAudit: geoRes.data,
        eeatAudit: eeatRes.data,
        dashboardUrl,
      })

      const seo = seoRes.data?.score || 0
      const aeo = aeoRes.data?.score || 0
      const geo = geoRes.data?.score || 0
      const eeat = eeatRes.data?.score || 0
      const overall = Math.round((seo + aeo + geo + eeat) / 4)
      const subject = `週報：${sub.websites?.name || sub.websites?.url || '您的網站'} AI 能見度 ${overall} 分`

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AARK 優勢方舟 <report@aark.io>',
          to: [sub.email],
          subject,
          html,
        }),
      })

      if (emailRes.ok) {
        await supabase
          .from('email_subscriptions')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', sub.id)
        results.sent++
      } else {
        results.failed++
      }
    } catch (err) {
      console.error('Error processing subscription:', sub.id, err)
      results.failed++
    }
  }

  return res.status(200).json({ success: true, results })
}
