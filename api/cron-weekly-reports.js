/**
 * GET /api/cron-weekly-reports
 * Vercel Cron Job — 每天 09:00 UTC 自動執行
 *
 * 雖然檔名仍叫 cron-weekly-reports 是為了避免 Vercel cron history 斷掉，
 * 實際上每天都會跑兩件事：
 *   1. processTrials() — 每天跑：(a) 掃過期試用 reset is_pro/is_trial (b) 寄 Day 4/6/7 提醒
 *   2. processWeeklyReports() — 只在週一跑（getUTCDay() === 1）：寄週報給訂閱用戶
 *
 * Env:
 *   RESEND_API_KEY            — Resend API key
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (bypass RLS)
 *   CRON_SECRET               — Secret to verify cron caller
 *   NEXT_PUBLIC_SITE_URL      — e.g. https://aark-workspace.vercel.app (for dashboard links)
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

// ===========================================================================
// 試用提醒 Email — Day 4 / Day 6 / Day 7 三種模板
// ===========================================================================
// kind:
//   'day4' — 試用滿 3 天後寄，「剩 3 天」，正向引導探索更多 Pro 功能
//   'day6' — 試用滿 5 天後寄，「剩 1 天」，最後機會升級提醒
//   'day7' — 試用過期當日寄，「試用結束」，引導付費延續服務
// ===========================================================================
function buildTrialEmailHTML({ kind, name, trialEndsAt, daysLeft, dashboardUrl, pricingUrl }) {
  const greeting = name ? `${name} 您好` : '您好'
  const endDate = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  const COPY = {
    day4: {
      subject: `試用還剩 ${daysLeft} 天 — 別錯過 Pro 完整功能`,
      headerTitle: '✨ 試用過半，還有更多沒體驗的',
      heroLine: `您的 Pro 試用還剩 ${daysLeft} 天`,
      heroSub: `試用結束：${endDate}`,
      body: `${greeting}，<br><br>您的 7 天 Pro 試用已過半。除了基本檢測，建議您也試試這幾個 Pro 獨家功能：<br><br><strong>1. 修復碼產生器</strong> — 不只告訴您「哪裡不及格」，直接給可貼上的 llms.txt / JSON-LD / FAQ Schema 程式碼。<br><br><strong>2. AI 曝光監測 (aivis)</strong> — 試用期內可使用 50 次查詢，看看您的品牌是否真的在 Claude / Perplexity 等 AI 答案中被提及。<br><br><strong>3. 平台別修復指南</strong> — WordPress / Shopify / Wix / 純 HTML 四套對應步驟，挑您的平台直接做。<br><br>有任何問題歡迎回信，或進入儀表板開始探索。`,
      cta1: { label: '回到儀表板 →', url: dashboardUrl },
      cta2: { label: '查看完整方案', url: pricingUrl },
      gradient: '#10b981',
    },
    day6: {
      subject: `試用只剩 ${daysLeft} 天 — 升級即可無縫銜接`,
      headerTitle: '⏰ 試用倒數最後一天',
      heroLine: `試用只剩 ${daysLeft} 天`,
      heroSub: `試用結束：${endDate}`,
      body: `${greeting}，<br><br>您的 Pro 試用即將到期。如果您覺得這 6 天的體驗有幫到您的網站 AI 能見度，現在升級訂閱即可<strong>無縫銜接所有 Pro 功能</strong>，已建立的資料、修復進度與 aivis 追蹤品牌全部保留。<br><br>若不升級，明天起：<br>• Pro 功能（修復碼、PDF 匯出、aivis 等）將鎖定<br>• 已有資料保留，可隨時回來升級<br>• 免費版功能（5 大面向分數、3 條建議）持續可用<br><br><strong>限時優惠</strong>：早鳥首年 NT$990／月（年繳 NT$11,880），首 4 週或前 100 名截止。錯過後恢復原價 NT$1,490／月。`,
      cta1: { label: '立即升級 Pro →', url: pricingUrl },
      cta2: { label: '回到儀表板', url: dashboardUrl },
      gradient: '#f59e0b',
    },
    day7: {
      subject: '您的 Pro 試用已結束 — 隨時可升級延續',
      headerTitle: '👋 試用已結束，感謝您體驗',
      heroLine: '試用已結束',
      heroSub: `結束於 ${endDate}`,
      body: `${greeting}，<br><br>您的 7 天 Pro 試用已結束。帳號已自動切換回免費版，您建立的所有資料（網站、檢測記錄、aivis 品牌）都<strong>完整保留</strong>，隨時可升級恢復 Pro 功能。<br><br>過去 7 天您體驗到的功能：<br>• 4 大面向 + 內容品質 詳細檢測<br>• 修復碼產生器（llms.txt / JSON-LD / FAQ Schema）<br>• AI 曝光監測 (aivis) 50 次查詢<br>• PDF 報告匯出、平台別修復指南<br><br>若您覺得這些功能對網站營運有幫助，歡迎升級訂閱繼續使用。SEO 改完就改完了，但 AI 引用率天天在變、競爭對手天天在優化 — 持續監測才是 Pro 訂閱的核心價值。<br><br>如有任何問題、想反饋使用體驗，或想了解 Agency 方案，歡迎直接回信。`,
      cta1: { label: '升級 Pro 訂閱 →', url: pricingUrl },
      cta2: { label: '回到儀表板', url: dashboardUrl },
      gradient: '#8b5cf6',
    },
  }

  const c = COPY[kind] || COPY.day4

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Microsoft JhengHei','PingFang TC',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e293b 0%,${c.gradient} 100%);padding:32px 40px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:white;">${c.headerTitle}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:6px;">優勢方舟 AI 能見度</div>
        </td></tr>
        <tr><td style="padding:32px 40px 16px;text-align:center;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <div style="font-size:34px;font-weight:bold;color:${c.gradient};line-height:1.2;">${c.heroLine}</div>
          <div style="font-size:13px;color:#64748b;margin-top:8px;">${c.heroSub}</div>
        </td></tr>
        <tr><td style="padding:28px 40px;font-size:14px;color:#334155;line-height:1.8;">${c.body}</td></tr>
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <a href="${c.cta1.url}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#f97316,#f59e0b);color:white;font-weight:600;font-size:14px;border-radius:10px;text-decoration:none;margin-bottom:12px;">${c.cta1.label}</a>
          <br>
          <a href="${c.cta2.url}" style="display:inline-block;padding:10px 24px;color:#64748b;font-size:13px;text-decoration:none;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;">${c.cta2.label}</a>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="font-size:11px;color:#94a3b8;margin:0;">優勢方舟 (AARK) · AI 能見度儀表板<br>如有任何問題，歡迎回信至 mark6465@gmail.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// ===========================================================================
// processTrials — 每天跑：掃過期試用 + 寄 Day 4/6/7 提醒
// ===========================================================================
async function processTrials({ supabase, RESEND_API_KEY, SITE_URL }) {
  const results = { expired: 0, day4: 0, day6: 0, day7: 0, failed: 0 }

  // 1) 掃過期試用 — 把 is_trial=true 且 trial_ends_at < now() 的 row 一次 reset
  //    cron 跑這個是主路徑；AuthContext lazy expiry 是 cron 萬一掛掉的安全網
  const nowIso = new Date().toISOString()
  const { data: expiredRows, error: expiredErr } = await supabase
    .from('profiles')
    .update({ is_trial: false, is_pro: false })
    .eq('is_trial', true)
    .lt('trial_ends_at', nowIso)
    .select('id, email, name, trial_ends_at, trial_reminders_sent')

  if (expiredErr) {
    console.error('Trial expire sweep error:', expiredErr)
  } else {
    results.expired = expiredRows?.length || 0
  }

  // 2) 寄 Day 7 給「剛剛過期、還沒寄過 day7」的人
  //    expiredRows 來自上面的 UPDATE ... RETURNING，含 trial_reminders_sent 舊值
  for (const row of expiredRows || []) {
    if (!row.email) continue
    if ((row.trial_reminders_sent || []).includes('day7')) continue
    try {
      const html = buildTrialEmailHTML({
        kind: 'day7',
        name: row.name,
        trialEndsAt: row.trial_ends_at,
        daysLeft: 0,
        dashboardUrl: `${SITE_URL}/account`,
        pricingUrl: `${SITE_URL}/pricing`,
      })
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'AARK 優勢方舟 <report@aark.io>',
          to: [row.email],
          subject: '您的 Pro 試用已結束 — 隨時可升級延續',
          html,
        }),
      })
      if (emailRes.ok) {
        const newSent = [...(row.trial_reminders_sent || []), 'day7']
        await supabase.from('profiles').update({ trial_reminders_sent: newSent }).eq('id', row.id)
        results.day7++
      } else {
        results.failed++
      }
    } catch (err) {
      console.error('Day 7 reminder error:', row.id, err)
      results.failed++
    }
  }

  // 3) 寄 Day 4 / Day 6 給「還在試用、滿 N 天、還沒寄過」的人
  //    一次 SELECT 拉所有 is_trial=true 的活躍試用 row，在 JS 裡分流
  const { data: activeTrials, error: activeErr } = await supabase
    .from('profiles')
    .select('id, email, name, trial_started_at, trial_ends_at, trial_reminders_sent')
    .eq('is_trial', true)
    .not('trial_started_at', 'is', null)

  if (activeErr) {
    console.error('Active trial query error:', activeErr)
    return results
  }

  const nowMs = Date.now()
  const DAY_MS = 86400000

  for (const row of activeTrials || []) {
    if (!row.email || !row.trial_started_at) continue
    const startedMs = new Date(row.trial_started_at).getTime()
    const daysSinceStart = (nowMs - startedMs) / DAY_MS
    const sent = row.trial_reminders_sent || []

    // Day 4 — 試用滿 3 天後（daysSinceStart >= 3）、未滿 5 天前寄。剩 3 天。
    //   區間限制：避免極端晚註冊 + cron 延遲導致 Day 4 跟 Day 6 同一天寄
    let kindToSend = null
    let daysLeft = null
    if (daysSinceStart >= 3 && daysSinceStart < 5 && !sent.includes('day4')) {
      kindToSend = 'day4'
      daysLeft = 3
    } else if (daysSinceStart >= 5 && daysSinceStart < 7 && !sent.includes('day6')) {
      kindToSend = 'day6'
      daysLeft = 1
    }

    if (!kindToSend) continue

    try {
      const html = buildTrialEmailHTML({
        kind: kindToSend,
        name: row.name,
        trialEndsAt: row.trial_ends_at,
        daysLeft,
        dashboardUrl: `${SITE_URL}/account`,
        pricingUrl: `${SITE_URL}/pricing`,
      })
      const subject = kindToSend === 'day4'
        ? `試用還剩 ${daysLeft} 天 — 別錯過 Pro 完整功能`
        : `試用只剩 ${daysLeft} 天 — 升級即可無縫銜接`
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'AARK 優勢方舟 <report@aark.io>',
          to: [row.email],
          subject,
          html,
        }),
      })
      if (emailRes.ok) {
        const newSent = [...sent, kindToSend]
        await supabase.from('profiles').update({ trial_reminders_sent: newSent }).eq('id', row.id)
        results[kindToSend]++
      } else {
        results.failed++
      }
    } catch (err) {
      console.error(`${kindToSend} reminder error:`, row.id, err)
      results.failed++
    }
  }

  return results
}

// ===========================================================================
// processWeeklyReports — 只在週一跑（getUTCDay() === 1）
// ===========================================================================
async function processWeeklyReports({ supabase, RESEND_API_KEY, SITE_URL }) {
  const results = { sent: 0, failed: 0, skipped: 0 }

  // Get active subscriptions not sent in the past 6 days
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  const { data: subscriptions, error } = await supabase
    .from('email_subscriptions')
    .select('*, websites(*)')
    .eq('is_active', true)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sixDaysAgo}`)

  if (error) {
    console.error('Subscription query error:', error)
    return { ...results, error: error.message }
  }

  for (const sub of subscriptions || []) {
    try {
      const websiteId = sub.website_id

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

  return results
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
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 每天跑：試用過期掃描 + Day 4/6/7 提醒 email
  const trialResults = await processTrials({ supabase, RESEND_API_KEY, SITE_URL })

  // 週一才跑：訂閱戶週報
  // getUTCDay(): Sunday=0, Monday=1, ..., Saturday=6
  let weeklyResults = null
  if (new Date().getUTCDay() === 1) {
    weeklyResults = await processWeeklyReports({ supabase, RESEND_API_KEY, SITE_URL })
  }

  return res.status(200).json({
    success: true,
    trial: trialResults,
    weekly: weeklyResults, // null when not Monday
  })
}
