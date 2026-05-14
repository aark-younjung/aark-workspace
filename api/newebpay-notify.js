/**
 * POST /api/newebpay-notify
 * 三用途 endpoint（Vercel Hobby 12 functions 上限對策，用 ?action 分發）：
 *   - 預設（無 action 或 action=notify）：NotifyURL server-to-server — 接收 NewebPay 付款結果
 *   - ?action=refund：14 天無條件退款 user-initiated 端點，前端 Account 取消按鈕呼叫
 *   - ?action=return：ReturnURL 中介 — NewebPay 付款完成後瀏覽器 POST 回來，我們 302 跳到 SPA GET URL
 *     （Vercel SPA fallback 不處理 POST，直接讓 NewebPay POST 到前端網址會 502；必須走 API 中介）
 *
 * ─────────────────── action=notify（預設）─────────────────────
 * NewebPay 以 application/x-www-form-urlencoded POST 過來：
 *   MerchantID, TradeInfo（AES 加密的 JSON 字串）, TradeSha, Version, Status
 *
 * 處理流程：
 *   1. 驗 TradeSha（防偽造）+ 解 TradeInfo
 *   2. 依 MerchantOrderNo 從 aivis_newebpay_pending 查回 user/kind/pack/quota
 *   3. 依 kind 寫入對應的目標表：
 *      - topup_small / topup_large → aivis_topup_credits
 *      - pro_yearly → profiles.is_pro = true
 *   4. 把 pending 狀態更新為 paid，記錄 trade_no / payment_type / paid_at
 *   5. 回 NewebPay 200（status 不重要，但必須回，否則它會重送 8 次）
 *
 * ─────────────────── action=refund ─────────────────────
 * Body: { userId, merchantOrderNo }（前端 JSON POST）
 *
 * 處理流程：
 *   1. 驗證 user — 從 Supabase auth header 拿 user.id 比對 body.userId（防偽造）
 *   2. 查 pending 訂單 — 確認 user_id / kind='pro_yearly' / status='paid' / 14 天內 / refund_status='none'
 *   3. 信用卡（payment_type 含 CREDIT）→ 呼叫 NewebPay `/API/CreditCard/Close` 直退
 *      → 成功則 refund_status='completed' / refund_method='api_credit' / refunded_at=now
 *      → 失敗則 refund_status='failed' + refund_note 記 NewebPay error message
 *   4. 非信用卡（VACC/WEBATM/CVS/BARCODE）→ refund_status='pending' / refund_method='manual_transfer'
 *      → 通知 admin（mark6465@gmail.com）7 工作天內手動轉帳
 *   5. 不論哪條路徑，profile.is_pro=false 立即生效（不等手動轉帳完成）
 *   6. 回 { success, refund_method, message } 給前端顯示對應提示
 *
 * Idempotency：notify 用 source_payment_id UNIQUE 約束、refund 用 refund_status !='none' 守門
 */

import { createClient } from '@supabase/supabase-js'
import { parseNotifyPayload, requestCreditCardRefund } from './lib/newebpay.js'

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

  // 分流：?action=refund 走退款邏輯（user-initiated, JSON body）
  // ?action=return 走 ReturnURL 中介（NewebPay POST → 302 跳 SPA GET URL）
  // 預設 / action=notify 走付款結果通知（NewebPay server-to-server, form body）
  if (req.query?.action === 'return') {
    return handleReturn({ req, res })
  }
  if (req.query?.action === 'refund') {
    return handleRefund({ req, res, supabase })
  }

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

// 14 天無條件退款 — 走 ?action=refund 分支
// 前端 fetch('/api/newebpay-notify?action=refund', { method:'POST', body: JSON.stringify({ userId, merchantOrderNo }) })
//
// 安全考量：用 Authorization: Bearer <access_token> header 帶 Supabase session，
// 後端用 service role 解 token 拿到 auth user.id，比對 body.userId 防偽造（不接受純信任前端傳的 userId）。
async function handleRefund({ req, res, supabase }) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  const { userId, merchantOrderNo } = req.body || {}
  if (!userId || !merchantOrderNo) {
    return res.status(400).json({ error: 'userId and merchantOrderNo are required' })
  }

  // 1. 驗證 user — 從 Bearer token 解出 auth user.id 比對 body.userId
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '')
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token' })
  }
  const { data: authData, error: authErr } = await supabase.auth.getUser(accessToken)
  if (authErr || !authData?.user) {
    return res.status(401).json({ error: 'Invalid access token' })
  }
  if (authData.user.id !== userId) {
    return res.status(403).json({ error: 'userId does not match authenticated user' })
  }

  // 2. 查 pending 訂單 — 必須是該 user 的 pro_yearly paid 訂單、14 天內、未退過
  const { data: order, error: orderErr } = await supabase
    .from('aivis_newebpay_pending')
    .select('user_id, kind, pack, amount, status, payment_type, paid_at, refund_status')
    .eq('merchant_order_no', merchantOrderNo)
    .maybeSingle()
  if (orderErr) {
    console.error('Refund order lookup error:', orderErr)
    return res.status(500).json({ error: 'Order lookup failed' })
  }
  if (!order) {
    return res.status(404).json({ error: 'Order not found' })
  }
  if (order.user_id !== userId) {
    return res.status(403).json({ error: 'Order does not belong to this user' })
  }
  if (order.kind !== 'pro_yearly') {
    // Top-up 政策為「不過期、用完為止、不退款」(見 CLAUDE.md 商業模式)
    return res.status(400).json({ error: 'Only Pro yearly orders are refundable. Top-up purchases are non-refundable.' })
  }
  if (order.status !== 'paid') {
    return res.status(400).json({ error: `Order status is "${order.status}", only paid orders can be refunded.` })
  }
  if (order.refund_status !== 'none') {
    return res.status(409).json({ error: `Order refund_status is already "${order.refund_status}".` })
  }
  // 14 天無條件退款窗口檢查
  const paidAt = order.paid_at ? new Date(order.paid_at) : null
  if (!paidAt) {
    return res.status(400).json({ error: 'Order has no paid_at timestamp, cannot verify 14-day refund window.' })
  }
  const daysSincePaid = (Date.now() - paidAt.getTime()) / (24 * 3600 * 1000)
  if (daysSincePaid > 14) {
    return res.status(400).json({ error: `Order is ${daysSincePaid.toFixed(1)} days old, exceeds 14-day refund window.` })
  }

  // 3. 依付款方式分流：信用卡走 API 直退、其他走手動轉帳
  // NewebPay payment_type 信用卡為 'CREDIT'（一次付清）或 'CREDITINST'（分期）— 都可走 Close API
  const isCreditCard = order.payment_type && order.payment_type.toUpperCase().startsWith('CREDIT')

  if (isCreditCard) {
    // 信用卡：呼叫 NewebPay /API/CreditCard/Close 直退
    let refundResult
    try {
      refundResult = await requestCreditCardRefund({
        merchantOrderNo,
        amount: order.amount,
      })
    } catch (err) {
      console.error('NewebPay refund API call threw:', err)
      await supabase
        .from('aivis_newebpay_pending')
        .update({
          refund_status: 'failed',
          refund_method: 'api_credit',
          refund_note: `API call exception: ${err.message}`,
        })
        .eq('merchant_order_no', merchantOrderNo)
      return res.status(502).json({ error: 'Refund API call failed', detail: err.message })
    }

    if (!refundResult.ok) {
      // NewebPay 業務面失敗（如訂單已關帳超過退款期限）
      await supabase
        .from('aivis_newebpay_pending')
        .update({
          refund_status: 'failed',
          refund_method: 'api_credit',
          refund_note: `NewebPay ${refundResult.status}: ${refundResult.message}`,
        })
        .eq('merchant_order_no', merchantOrderNo)
      return res.status(400).json({
        error: 'NewebPay refund failed',
        detail: `${refundResult.status}: ${refundResult.message}`,
      })
    }

    // 信用卡退款成功
    await supabase
      .from('aivis_newebpay_pending')
      .update({
        refund_status: 'completed',
        refund_method: 'api_credit',
        refund_amount: order.amount,
        refunded_at: new Date().toISOString(),
        refund_note: `NewebPay SUCCESS: ${refundResult.message || 'refund accepted'}`,
      })
      .eq('merchant_order_no', merchantOrderNo)

    // 立即降回 Free（不等對帳）
    await supabase
      .from('profiles')
      .update({ is_pro: false })
      .eq('id', userId)

    return res.status(200).json({
      success: true,
      refund_method: 'api_credit',
      message: `信用卡退款已成功送出，預計 7-14 個工作天內退回原卡。退款金額 NT$${order.amount.toLocaleString()}。`,
    })
  }

  // 非信用卡（VACC / WEBATM / CVS / BARCODE）：手動轉帳路徑
  await supabase
    .from('aivis_newebpay_pending')
    .update({
      refund_status: 'pending',
      refund_method: 'manual_transfer',
      refund_amount: order.amount,
      refund_note: `Awaiting manual transfer. Payment type: ${order.payment_type}. Customer: ${authData.user.email}`,
    })
    .eq('merchant_order_no', merchantOrderNo)

  // 立即降回 Free（手動轉帳是金流側流程，產品端立即停權公平）
  await supabase
    .from('profiles')
    .update({ is_pro: false })
    .eq('id', userId)

  return res.status(200).json({
    success: true,
    refund_method: 'manual_transfer',
    message: `因您是以 ${order.payment_type} 方式付款，無法線上自動退款。我們的客服將於 7 個工作天內以 email 聯繫您索取銀行帳號，並完成手動轉帳。退款金額 NT$${order.amount.toLocaleString()}。`,
  })
}

// ReturnURL 中介 — NewebPay 付款完成後瀏覽器 POST 回來，我們 302 跳到 SPA GET URL
// Vercel SPA fallback 不處理 POST，直接讓 NewebPay POST 到前端網址會 502，必須走 API 中介
// Query params:
//   dest=<URL-encoded 目的地路徑>（必填，例如 /pricing 或 /account）
//   flag=<URL-encoded 附加 query 片段>（選填，例如 pro_success=yearly）
// Same-origin 守門：dest 必須是相對路徑（/開頭）或同 host，防 open redirect
async function handleReturn({ req, res }) {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.a-ark.com.tw'
  const destRaw = req.query?.dest
  const flagRaw = req.query?.flag

  if (!destRaw || typeof destRaw !== 'string') {
    return res.status(400).send('Missing dest query param')
  }

  let dest
  try {
    dest = decodeURIComponent(destRaw)
  } catch {
    return res.status(400).send('Invalid dest encoding')
  }

  // Same-origin 檢查：(1) 相對路徑 /xxx OK (2) 絕對 URL 必須是 SITE_URL host
  let target
  if (dest.startsWith('/')) {
    target = `${SITE_URL.replace(/\/$/, '')}${dest}`
  } else {
    let destUrl
    try {
      destUrl = new URL(dest)
    } catch {
      return res.status(400).send('Invalid dest URL')
    }
    const siteHost = new URL(SITE_URL).host
    if (destUrl.host !== siteHost) {
      return res.status(400).send('dest must be same-origin')
    }
    target = destUrl.toString()
  }

  // 附加 flag（成功提示 query）
  if (flagRaw && typeof flagRaw === 'string') {
    let flag
    try {
      flag = decodeURIComponent(flagRaw)
    } catch {
      return res.status(400).send('Invalid flag encoding')
    }
    const sep = target.includes('?') ? '&' : '?'
    target = `${target}${sep}${flag}`
  }

  res.setHeader('Location', target)
  return res.status(302).end()
}
