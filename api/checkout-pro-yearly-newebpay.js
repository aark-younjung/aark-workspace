/**
 * POST /api/checkout-pro-yearly-newebpay
 * 建立 NewebPay 付款訂單（Pro 年繳 / 早鳥首年 / Pro 月繳）
 *
 * 檔名 "yearly" 是歷史包袱（最早只支援 yearly 與 earlybird），現在也兼包月繳 NPA。
 * 受限 Vercel Hobby 12 functions 額度滿格，無法另開 endpoint，所以靠 plan 分流：
 *   - plan='yearly' / 'earlybird' → MPG 一次性付款（buildPaymentForm）
 *   - plan='monthly' → NPA 定期定額委託（buildPeriodForm，跳 /MPG/period 而非 /MPG/mpg_gateway）
 *
 * Body: { userId, email, plan: 'yearly' | 'earlybird' | 'monthly', returnUrl }
 *
 * Response（MPG / 一次性）:
 *   { apiUrl, fields: { MerchantID, TradeInfo, TradeSha, Version, EncryptType }, merchantOrderNo }
 *
 * Response（NPA / 月繳）:
 *   { apiUrl, fields: { MerchantID_, PostData_ }, merchantOrderNo }
 *   （注意 field key 帶底線，與 MPG 不同；前端 dispatch 時要看回傳 keys 決定如何組 form）
 *
 * 三種 plan：
 *   - yearly:    NT$13,900（一般年繳，含 14 天無條件退款保證）
 *   - earlybird: NT$11,880（早鳥首年 990×12，限前 100 名・首 4 週內，次年自動恢復 13,900）
 *   - monthly:   NT$1,490／月（NPA 定期定額，每月扣款，可隨時取消，當期用完不退款）
 *
 * notify 端：
 *   - kind='pro_yearly' → 原 MPG 路徑（is_pro=true）
 *   - kind='pro_monthly' → NPA 路徑，notify payload 含 PeriodNo → 寫 aivis_newebpay_period
 *
 * Env:
 *   NEWEBPAY_MERCHANT_ID / NEWEBPAY_HASH_KEY / NEWEBPAY_HASH_IV
 *   NEWEBPAY_API_URL（MPG）/ NEWEBPAY_PERIOD_API_URL（NPA）
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_SITE_URL
 */

import { createClient } from '@supabase/supabase-js'
import { buildPaymentForm, buildPeriodForm, generateOrderNo } from './lib/newebpay.js'
import { isTestOrder } from './lib/test-detect.js'

const PLAN_SPEC = {
  yearly: {
    amount: 13900,
    label: 'AI 雷達 Pro 年繳方案 NT$13,900（含 14 天無條件退款）',
    mode: 'mpg',
  },
  earlybird: {
    amount: 11880,
    label: 'AI 雷達 Pro 早鳥首年 NT$11,880（限前 100 名，次年恢復 NT$13,900）',
    mode: 'mpg',
  },
  monthly: {
    amount: 1490,
    label: 'AI 雷達 Pro 月繳方案 NT$1,490／月（NPA 定期定額，可隨時取消）',
    mode: 'npa',
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
  if (!spec) return res.status(400).json({ error: `Invalid plan: ${plan}. Must be 'yearly', 'earlybird', or 'monthly'.` })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 早鳥 100 名守門：成功付款且未退款的早鳥單已達 100 → 擋下，引導改買年繳
  // 退款（refund_status='completed'）的名額會回補池子，跟 public-stats earlybird_taken 同一邏輯
  if (plan === 'earlybird') {
    const { count, error: countErr } = await supabase
      .from('aivis_newebpay_pending')
      .select('*', { count: 'exact', head: true })
      .eq('pack', 'earlybird')
      .eq('status', 'paid')
      .neq('refund_status', 'completed')
    if (countErr) {
      console.error('Failed to count earlybird slots:', countErr)
      return res.status(500).json({ error: `Earlybird slot check failed: ${countErr.message}` })
    }
    if ((count || 0) >= 100) {
      return res.status(400).json({
        error: 'earlybird_sold_out',
        message: '早鳥前 100 名額已售完，請改選年繳 NT$13,900 方案',
      })
    }
  }

  // NPA 月繳防重複訂閱守門：已有 active period → 直接拒絕，避免前端 isPro 緩存過期時誤觸第二筆
  // 前端 isPro guard 有 race condition（fetchProfile 非同步），後端是最後防線
  if (plan === 'monthly') {
    const { data: existingPeriod, error: periodCheckErr } = await supabase
      .from('aivis_newebpay_period')
      .select('period_no', { count: 'exact', head: false })
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (periodCheckErr) {
      console.error('Failed to check existing period:', periodCheckErr)
      return res.status(500).json({ error: `Period check failed: ${periodCheckErr.message}` })
    }
    if (existingPeriod) {
      return res.status(409).json({
        error: 'already_subscribed',
        message: '您已有進行中的月繳訂閱，無需重複訂閱。如需管理訂閱請前往帳號設定。',
      })
    }
  }

  // 訂單編號 prefix：py = pro_yearly / peb = pro_earlybird / pm = pro_monthly
  // monthly DB kind 用 'pro_monthly'（需 ALTER pending CHECK constraint 才能接受）
  const prefix = plan === 'earlybird' ? 'peb' : (plan === 'monthly' ? 'pm' : 'py')
  const merchantOrderNo = generateOrderNo(prefix)
  const dbKind = plan === 'monthly' ? 'pro_monthly' : 'pro_yearly'

  // 沙盒環境 OR email 在 TEST_EMAILS 名單 → 自動標 is_test_order=true，避免測試訂單污染營收統計
  const testFlag = isTestOrder(email)

  const { error: pendingErr } = await supabase
    .from('aivis_newebpay_pending')
    .insert({
      merchant_order_no: merchantOrderNo,
      user_id: userId,
      kind: dbKind,
      pack: plan,
      amount: spec.amount,
      status: 'pending',
      is_test_order: testFlag,
    })
  if (pendingErr) {
    console.error('Failed to insert pending order:', pendingErr)
    return res.status(500).json({ error: `Pending order insert failed: ${pendingErr.message}` })
  }

  // ───── MPG 一次性付款分支（yearly / earlybird）─────
  if (spec.mode === 'mpg') {
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
      // 只開信用卡：MS3830621445 商家只通過 MPG（信用卡）+ Close + NPA
      // WebATM/VACC/CVS/BARCODE 未申請開通，送 1 會被 NewebPay 擋掉整筆交易
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
      await supabase
        .from('aivis_newebpay_pending')
        .update({ status: 'failed' })
        .eq('merchant_order_no', merchantOrderNo)
      return res.status(500).json({ error: err.message || 'Failed to build payment form' })
    }
  }

  // ───── NPA 定期定額分支（monthly）─────
  // PeriodType=M 每月扣 / PeriodPoint='05' 每月 5 日（生產用）
  // 沙盒測試加速：用 PeriodType=D + PeriodPoint='2' 改每 2 天扣（可用 env var override）
  // PeriodStartType=3 = 立即執行十元授權測試 + 立刻扣首期（推薦，授權測試確保卡片有效）
  // PeriodTimes=99 = 永久扣款（直到用戶 terminate）
  const periodType = process.env.NEWEBPAY_PERIOD_TYPE || 'M'
  const periodPoint = process.env.NEWEBPAY_PERIOD_POINT || '05'  // 每月 5 日扣款（避開月初帳單擁擠）
  const periodParams = {
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: '1.5',                                                  // NPA 規範版本（與 MPG 2.0 不同）
    LangType: 'zh-Tw',                                               // NPA 對大小寫挑剔：只接受 'zh-Tw' 或 'en'，全小寫會回 PER10012
    MerOrderNo: merchantOrderNo,                                     // NPA 用 MerOrderNo（MPG 用 MerchantOrderNo）
    ProdDesc: spec.label,                                            // NPA 用 ProdDesc（MPG 用 ItemDesc）
    PeriodAmt: spec.amount,
    PeriodType: periodType,
    PeriodPoint: periodPoint,
    PeriodStartType: 3,                                              // 3 = 立即執行 NT$10 授權測試 + 首期立扣
    PeriodTimes: 99,                                                 // 99 = 永久（直到用戶取消）
    PayerEmail: email,
    NotifyURL: `${SITE_URL}/api/newebpay-notify`,                   // notify 共用，靠 PeriodNo 分流
    ReturnURL: `${SITE_URL}/api/newebpay-notify?action=return&dest=${encodeURIComponent(returnUrl || '/account')}&flag=${encodeURIComponent(`pro_success=${plan}`)}`,
    BackURL: returnUrl || `${SITE_URL}/pricing`,
    EmailModify: 0,                                                  // 不允許用戶在付款頁修改 email
  }

  try {
    const form = buildPeriodForm(periodParams)
    return res.status(200).json({
      apiUrl: form.apiUrl,
      fields: {
        MerchantID_: form.MerchantID_,
        PostData_: form.PostData_,
      },
      merchantOrderNo,
      mode: 'npa',  // 前端 dispatch 判斷用：mode=npa 表示 form fields 是 NPA 規格
    })
  } catch (err) {
    console.error('NewebPay period form build error:', err)
    await supabase
      .from('aivis_newebpay_pending')
      .update({ status: 'failed' })
      .eq('merchant_order_no', merchantOrderNo)
    return res.status(500).json({ error: err.message || 'Failed to build period form' })
  }
}
