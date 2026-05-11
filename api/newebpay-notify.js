/**
 * POST /api/newebpay-notify
 * NewebPay NotifyURL（server-to-server）— 接收付款結果通知
 *
 * NewebPay 會以 application/x-www-form-urlencoded POST 過來：
 *   MerchantID, TradeInfo（AES 加密的 JSON 字串）, TradeSha, Version, Status
 *
 * 處理流程：
 *   1. 驗 TradeSha（防偽造）+ 解 TradeInfo
 *   2. 依 MerchantOrderNo 從 aivis_newebpay_pending 查回 user/kind/pack/quota
 *   3. 依 kind 寫入對應的目標表：
 *      - topup_small / topup_large → aivis_topup_credits
 *      - pro_yearly → profiles.is_pro = true (Phase 2 才會用到)
 *   4. 把 pending 狀態更新為 paid，記錄 trade_no / payment_type / paid_at
 *   5. 回 NewebPay 200（status 不重要，但必須回，否則它會重送 8 次）
 *
 * Idempotency：用 source_payment_id UNIQUE 約束防重複入帳（NewebPay 可能 retry）
 *
 * 重要：Vercel Serverless 預設會 parse application/json，這裡 NewebPay 送 form-urlencoded，
 *      需要設 bodyParser config 接受 form。
 */

import { createClient } from '@supabase/supabase-js'
import { parseNotifyPayload } from './lib/newebpay.js'

// Vercel/Next 預設 bodyParser 會接受 form-urlencoded 並解到 req.body — 不需要特別 raw body
// 但要確認 NewebPay 送的 Content-Type 是 application/x-www-form-urlencoded
// 若是 multipart 則要關掉 bodyParser 自己 parse — 目前 NewebPay 規範是 urlencoded

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed')

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase env vars not configured')
    return res.status(500).send('Server misconfigured')
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { TradeInfo, TradeSha, Status } = req.body || {}
  if (!TradeInfo || !TradeSha) {
    console.error('NewebPay notify missing TradeInfo/TradeSha:', req.body)
    return res.status(400).send('Missing TradeInfo/TradeSha')
  }

  // 1. 驗 hash + 解密
  const parsed = parseNotifyPayload({ TradeInfo, TradeSha })
  if (!parsed.ok) {
    console.error('NewebPay notify decrypt/verify failed:', parsed.error)
    return res.status(400).send(`Notify verification failed: ${parsed.error}`)
  }

  // NewebPay 解密後的 JSON 結構：
  // { Status: 'SUCCESS', Message: '...', Result: { MerchantID, Amt, TradeNo, MerchantOrderNo,
  //   PaymentType, RespondType, PayTime, IP, EscrowBank, AuthCode, Card6No, Card4No, ... } }
  const payload = parsed.data
  const result = payload?.Result || {}
  const merchantOrderNo = result.MerchantOrderNo
  const tradeNo = result.TradeNo
  const amount = parseInt(result.Amt || '0', 10)
  const paymentType = result.PaymentType
  const isSuccess = (payload?.Status === 'SUCCESS') || (Status === 'SUCCESS')

  if (!merchantOrderNo) {
    console.error('NewebPay notify missing MerchantOrderNo:', payload)
    return res.status(400).send('Missing MerchantOrderNo')
  }

  // 2. 從 pending 表查回 user/kind/pack/quota
  const { data: pending, error: pendingErr } = await supabase
    .from('aivis_newebpay_pending')
    .select('user_id, kind, pack, quota, amount, status')
    .eq('merchant_order_no', merchantOrderNo)
    .maybeSingle()

  if (pendingErr) {
    console.error('Pending lookup error:', pendingErr)
    return res.status(500).send('Pending lookup failed')
  }
  if (!pending) {
    console.error('Unknown MerchantOrderNo (not in pending table):', merchantOrderNo)
    return res.status(400).send('Unknown MerchantOrderNo')
  }

  // 3. 對應金額（防 NewebPay 端被竄改 — 不太可能但多一層保險）
  if (amount && amount !== pending.amount) {
    console.error(`Amount mismatch for ${merchantOrderNo}: NewebPay=${amount} vs pending=${pending.amount}`)
    // 不擋付款（NewebPay 端的金額才是實收），但記下來供事後 audit
  }

  // 4. 失敗的話只更新 pending 狀態，不寫入 credits
  if (!isSuccess) {
    await supabase
      .from('aivis_newebpay_pending')
      .update({
        status: 'failed',
        trade_no: tradeNo,
        payment_type: paymentType,
        notify_raw: payload,
      })
      .eq('merchant_order_no', merchantOrderNo)
    console.log(`NewebPay payment failed for order ${merchantOrderNo}:`, payload?.Message)
    return res.status(200).send('OK (payment failed, marked)')
  }

  // 5. 已處理過的訂單直接跳過（idempotency — NewebPay 可能 retry 同個 notify）
  if (pending.status === 'paid') {
    console.log(`Order ${merchantOrderNo} already paid, skipping`)
    return res.status(200).send('OK (already processed)')
  }

  // 6. 依 kind 寫入目標表
  if (pending.kind === 'topup_small' || pending.kind === 'topup_large') {
    // 寫入 aivis_topup_credits
    // source_payment_id 用 NewebPay TradeNo（加 'nwp_' prefix 避免與 Stripe session id 撞）
    const sourcePaymentId = `nwp_${tradeNo || merchantOrderNo}`
    const { error: creditErr } = await supabase
      .from('aivis_topup_credits')
      .upsert({
        user_id: pending.user_id,
        pack_size: pending.pack,
        quota_total: pending.quota,
        quota_remaining: pending.quota,
        source_payment_id: sourcePaymentId,
        gateway: 'newebpay',
        purchased_at: new Date().toISOString(),
      }, { onConflict: 'source_payment_id', ignoreDuplicates: true })

    if (creditErr) {
      console.error('Topup credit insert error:', creditErr)
      return res.status(500).send(`Credit insert failed: ${creditErr.message}`)
    }
    console.log(`User ${pending.user_id} purchased NewebPay Top-up ${pending.pack} (+${pending.quota} 次, order=${merchantOrderNo})`)
  } else if (pending.kind === 'pro_yearly') {
    // Phase 2 預留：Pro 年繳 — 寫 profiles.is_pro = true
    const { error: proErr } = await supabase
      .from('profiles')
      .update({
        is_pro: true,
        payment_gateway: 'newebpay',
        subscribed_at: new Date().toISOString(),
      })
      .eq('id', pending.user_id)
    if (proErr) {
      console.error('Pro upgrade error:', proErr)
      return res.status(500).send(`Pro upgrade failed: ${proErr.message}`)
    }
    console.log(`User ${pending.user_id} upgraded to Pro (yearly, NewebPay, order=${merchantOrderNo})`)
  } else {
    console.error(`Unknown pending kind: ${pending.kind}`)
    return res.status(400).send(`Unknown kind: ${pending.kind}`)
  }

  // 7. 更新 pending 為 paid
  await supabase
    .from('aivis_newebpay_pending')
    .update({
      status: 'paid',
      trade_no: tradeNo,
      payment_type: paymentType,
      paid_at: new Date().toISOString(),
      notify_raw: payload,
    })
    .eq('merchant_order_no', merchantOrderNo)

  return res.status(200).send('OK')
}
