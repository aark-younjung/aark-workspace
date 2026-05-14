/**
 * POST /api/checkout-pro-yearly-newebpay
 * 建立 NewebPay 一次性付款訂單（Pro 年繳 / 早鳥首年）
 *
 * Body: { userId, email, plan: 'yearly' | 'earlybird', returnUrl }
 *
 * Response（成功）:
 *   {
 *     apiUrl: 'https://ccore.newebpay.com/MPG/mpg_gateway',
 *     fields: { MerchantID, TradeInfo, TradeSha, Version, EncryptType },
 *     merchantOrderNo
 *   }
 *
 * 與 Top-up 同模式（後端建 trade params → 回 form fields → 前端組 form 自動 submit）。
 * notify 端 kind='pro_yearly' 分支已寫好，會把 profiles.is_pro=true + payment_gateway='newebpay' + subscribed_at=now。
 *
 * 兩種 plan：
 *   - yearly:    NT$13,900（一般年繳，含 14 天無條件退款保證）
 *   - earlybird: NT$11,880（早鳥首年 990×12，限前 100 名・首 4 週內，次年自動恢復 13,900）
 *
 * 兩個 plan 都用 kind='pro_yearly'（DB CHECK constraint 只允許 4 種），amount 欄位區分。
 *
 * Env:
 *   NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV / NEWEBPAY_API_URL
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL
 */

import { createClient } from '@supabase/supabase-js'
import { buildPaymentForm, generateOrderNo } from './lib/newebpay.js'

const PLAN_SPEC = {
  yearly: {
    amount: 13900,
    label: 'AI能見度 Pro 年繳方案 NT$13,900（含 14 天無條件退款）',
  },
  earlybird: {
    amount: 11880,
    label: 'AI能見度 Pro 早鳥首年 NT$11,880（限前 100 名，次年恢復 NT$13,900）',
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, plan, returnUrl } = req.body || {}
  if (!userId || !email) return res.status(400).json({ error: 'userId and email are required' })
  const spec = PLAN_SPEC[plan]
  if (!spec) return res.status(400).json({ error: `Invalid plan: ${plan}. Must be 'yearly' or 'earlybird'.` })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  // 訂單編號 prefix：py = pro_yearly、peb = pro_earlybird（仍寫 kind='pro_yearly' 但 prefix 方便人眼辨識）
  const merchantOrderNo = generateOrderNo(plan === 'earlybird' ? 'peb' : 'py')

  const { error: pendingErr } = await supabase
    .from('aivis_newebpay_pending')
    .insert({
      merchant_order_no: merchantOrderNo,
      user_id: userId,
      kind: 'pro_yearly',
      pack: plan,
      amount: spec.amount,
      status: 'pending',
    })
  if (pendingErr) {
    console.error('Failed to insert pending order:', pendingErr)
    return res.status(500).json({ error: `Pending order insert failed: ${pendingErr.message}` })
  }

  const tradeParams = {
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: '2.0',
    MerchantOrderNo: merchantOrderNo,
    Amt: spec.amount,
    ItemDesc: spec.label,
    Email: email,
    LoginType: 0,
    NotifyURL: `${SITE_URL}/api/newebpay-notify`,
    // NewebPay 以 POST method redirect 到 ReturnURL，Vercel SPA fallback 只認 GET 會 502
    // 走 /api/newebpay-notify?action=return 中介：API 接 POST 後 302 跳到 SPA GET URL
    ReturnURL: `${SITE_URL}/api/newebpay-notify?action=return&dest=${encodeURIComponent(returnUrl || '/account')}&flag=${encodeURIComponent(`pro_success=${plan}`)}`,
    ClientBackURL: returnUrl || `${SITE_URL}/pricing`,
    CREDIT: 1,
    VACC: 1,
    WEBATM: 1,
    CVS: 1,
    BARCODE: 1,
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
    await supabase
      .from('aivis_newebpay_pending')
      .update({ status: 'failed' })
      .eq('merchant_order_no', merchantOrderNo)
    return res.status(500).json({ error: err.message || 'Failed to build payment form' })
  }
}
