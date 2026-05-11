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
import { buildPaymentForm, generateOrderNo } from '../lib/newebpay.js'

const PACK_SPEC = {
  small: { amount: 490, quota: 300, label: 'aivis Top-up 小包 加購 300 次' },
  large: { amount: 990, quota: 800, label: 'aivis Top-up 大包 加購 800 次' },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, pack, returnUrl } = req.body || {}
  if (!userId || !email) return res.status(400).json({ error: 'userId and email are required' })
  const spec = PACK_SPEC[pack]
  if (!spec) return res.status(400).json({ error: `Invalid pack: ${pack}. Must be 'small' or 'large'.` })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const merchantOrderNo = generateOrderNo(`tu${pack === 'small' ? 's' : 'l'}`)

  // 1. 先把 pending 寫進去（如果 NewebPay form-submit 後沒回 notify，這筆會留著當 stale order 追蹤）
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
    // 付款完成後 browser redirect 回前台（順便帶 success flag）
    ReturnURL: returnUrl
      ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}topup_success=${pack}`
      : `${SITE_URL}/?topup_success=${pack}`,
    // 付款頁「取消」按鈕的去處
    ClientBackURL: returnUrl || `${SITE_URL}/`,
    // 支付方式：信用卡 + ATM + 網路 ATM + 超商代碼/條碼（沙盒先全開，正式可依需求調整）
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
    // 把剛寫進去的 pending 標記為 failed（不然會留在 pending 狀態誤導後續分析）
    await supabase
      .from('aivis_newebpay_pending')
      .update({ status: 'failed' })
      .eq('merchant_order_no', merchantOrderNo)
    return res.status(500).json({ error: err.message || 'Failed to build payment form' })
  }
}
