/**
 * POST /api/aivis/checkout-topup-newebpay
 * 建立 NewebPay 一次性付款訂單（Top-up 加購次數包）
 *
 * Body: { userId, email, pack: 'small' | 'large', returnUrl }
 *
 * Response（成功）:
 *   {
 *     apiUrl: 'https://ccore.newebpay.com/MPG/mpg_gateway',
 *     fields: { MerchantID, TradeInfo, TradeSha, Version, EncryptType }
 *   }
 *
 * 前端拿到後動態建一個 <form action={apiUrl} method="POST">，把 fields 寫成 hidden inputs，
 * 然後 form.submit() — 瀏覽器整頁跳轉到 NewebPay 付款頁。
 *
 * 與 Stripe 不同點：
 *   - Stripe 是「後端建 session → 回 hosted URL → 前端 window.location.href = url」
 *   - NewebPay 是「後端建 trade params → 回 form fields → 前端組 form 自動 submit」
 *   - 因為 NewebPay 沒有 metadata 欄位，先把 user/pack/quota 暫存到 aivis_newebpay_pending，
 *     等 notify callback 帶 MerchantOrderNo 回來再查表寫入 aivis_topup_credits。
 *
 * Env:
 *   NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV / NEWEBPAY_API_URL
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（寫 pending 表用）
 *   NEXT_PUBLIC_SITE_URL（建 NotifyURL / ReturnURL）
 */

import { createClient } from '@supabase/supabase-js'
import { buildPaymentForm, generateOrderNo } from '../_lib/newebpay.js'
import { isTestOrder } from '../_lib/test-detect.js'

const PACK_SPEC = {
  small: { amount: 490, quota: 300, label: 'aivis Top-up 小包 加購 300 次' },
  large: { amount: 990, quota: 800, label: 'aivis Top-up 大包 加購 800 次' },
}

// 同意書文案 v1 — 與前端 AIVisibilityDashboard.jsx TOPUP_CONSENT_V1 必須完全一致
// 後端要 verify 用戶送的 consentText 等於這串，避免有人改前端送假同意書
const TOPUP_DISCLAIMER_V1 = '本人已閱讀並同意：Top-up 加購屬於「一經提供即完成之線上服務」（消保法第 19 條第 2 項第 5 款），credits 入帳後不適用 7 天無條件解除權、亦不退款。'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, pack, returnUrl, agreed, consentVersion, consentText } = req.body || {}
  if (!userId || !email) return res.status(400).json({ error: 'userId and email are required' })
  const spec = PACK_SPEC[pack]
  if (!spec) return res.status(400).json({ error: `Invalid pack: ${pack}. Must be 'small' or 'large'.` })

  // 法律強制揭露守衛：消保法 § 19-II-5「事先同意」要件 — 必須 agreed=true 且 consentText 與當前版本完全相符
  // 防止 curl/Postman 繞 UI 直接戳 API 跳過同意書（不然事後客訴會說「我沒看到任何不退款警告」）
  if (agreed !== true) {
    return res.status(400).json({ error: '請先勾選同意「不退款」條款後再加購' })
  }
  if (consentVersion !== 'v1' || consentText !== TOPUP_DISCLAIMER_V1) {
    return res.status(400).json({ error: '同意書版本不符，請重新整理頁面後再試' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 守衛：Top-up 是 Pro / 試用用戶 quota 超量後的續命包，Free 用戶不應能買
  // 防止用戶（含 curl/Postman 繞 UI）在 is_pro=false 狀態買到 Top-up credits 造成商業邏輯不一致
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('is_pro, is_trial')
    .eq('id', userId)
    .maybeSingle()
  if (profileErr) {
    console.error('Profile lookup failed:', profileErr)
    return res.status(500).json({ error: 'Profile lookup failed' })
  }
  if (!profile?.is_pro && !profile?.is_trial) {
    return res.status(403).json({ error: '加購次數包僅限 Pro 訂閱用戶或試用期間用戶購買，請先升級 Pro' })
  }

  const merchantOrderNo = generateOrderNo(`tu${pack === 'small' ? 's' : 'l'}`)

  // 法律證據捕捉：抓 IP（信任 Vercel x-forwarded-for 第一個 hop）+ User-Agent
  // 萬一日後客訴上消保官，這兩個欄位 + consent_text 是完整證明用戶當下確實看到並勾選了同意書
  const xff = req.headers['x-forwarded-for'] || ''
  const ipAddress = (typeof xff === 'string' ? xff.split(',')[0] : '').trim() || req.socket?.remoteAddress || null
  const userAgent = req.headers['user-agent'] || null

  // 1. 先寫同意書紀錄（消保法 § 19-II-5 法律證據）
  // 這個必須先過、再寫 pending — 不然 stale pending 沒有對應 consent 會搞亂事後稽核
  const { error: consentErr } = await supabase
    .from('aivis_topup_consents')
    .insert({
      user_id: userId,
      email,
      pack,
      amount: spec.amount,
      merchant_order_no: merchantOrderNo,
      consent_version: consentVersion,
      consent_text: consentText,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  if (consentErr) {
    console.error('Failed to insert consent record:', consentErr)
    return res.status(500).json({ error: `Consent record insert failed: ${consentErr.message}` })
  }

  // 2. 再把 pending 寫進去（如果 NewebPay form-submit 後沒回 notify，這筆會留著當 stale order 追蹤）
  // 沙盒環境 OR email 在 TEST_EMAILS 名單 → 自動標 is_test_order=true
  const testFlag = isTestOrder(email)

  const { error: pendingErr } = await supabase
    .from('aivis_newebpay_pending')
    .insert({
      merchant_order_no: merchantOrderNo,
      user_id: userId,
      kind: pack === 'small' ? 'topup_small' : 'topup_large',
      pack,
      quota: spec.quota,
      amount: spec.amount,
      status: 'pending',
      is_test_order: testFlag,
    })
  if (pendingErr) {
    console.error('Failed to insert pending order:', pendingErr)
    return res.status(500).json({ error: `Pending order insert failed: ${pendingErr.message}` })
  }

  // 2. 組 NewebPay MPG 必填參數
  const tradeParams = {
    RespondType: 'JSON',                                  // notify 回 JSON 格式（不是 String）
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: '2.0',
    MerchantOrderNo: merchantOrderNo,
    Amt: spec.amount,                                     // TWD 整數
    ItemDesc: spec.label,
    Email: email,
    LoginType: 0,                                          // 不需登入 NewebPay 會員
    // server-to-server 通知（這條一定會收到，是寫 DB 的真正依據）
    NotifyURL: `${SITE_URL}/api/newebpay-notify`,
    // 付款完成後 NewebPay 會以 POST method redirect 回 ReturnURL
    // Vercel SPA fallback 只處理 GET，直接 POST 到前端網址會 502
    // 走 /api/newebpay-notify?action=return 中介：API 接 POST 後 302 跳到 SPA GET URL
    ReturnURL: `${SITE_URL}/api/newebpay-notify?action=return&dest=${encodeURIComponent(returnUrl || '/')}&flag=${encodeURIComponent(`topup_success=${pack}`)}`,
    // 付款頁「取消」按鈕的去處
    ClientBackURL: returnUrl || `${SITE_URL}/`,
    // 只開信用卡：MS3830621445 商家只通過 MPG（信用卡）+ Close + NPA
    // WebATM/VACC/CVS/BARCODE 未申請開通，送 1 會被 NewebPay 擋掉整筆交易（5 秒彈回）
    CREDIT: 1,
    VACC: 0,
    WEBATM: 0,
    CVS: 0,
    BARCODE: 0,
  }

  try {
    const form = buildPaymentForm(tradeParams)
    return res.status(200).json({
      apiUrl: form.apiUrl,
      fields: {
        MerchantID: form.MerchantID,
        TradeInfo: form.TradeInfo,
        TradeSha: form.TradeSha,
        Version: form.Version,
        EncryptType: form.EncryptType,
      },
      merchantOrderNo,
    })
  } catch (err) {
    console.error('NewebPay payment form build error:', err)
    // 把剛寫進去的 pending 標記為 failed（不然會留在 pending 狀態誤導後續分析）
    await supabase
      .from('aivis_newebpay_pending')
      .update({ status: 'failed' })
      .eq('merchant_order_no', merchantOrderNo)
    return res.status(500).json({ error: err.message || 'Failed to build payment form' })
  }
}
