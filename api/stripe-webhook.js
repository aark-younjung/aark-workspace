/**
 * POST /api/stripe-webhook
 * 處理 Stripe Webhook 事件
 *
 * 事件：
 *   checkout.session.completed (mode=subscription)         → 付款成功，設定 profiles.is_pro = true
 *   checkout.session.completed (mode=payment, kind=aivis_topup) → 寫入 aivis_topup_credits（次數包儲值）
 *   customer.subscription.deleted                          → 訂閱取消，設定 profiles.is_pro = false
 *
 * Env:
 *   STRIPE_SECRET_KEY        — Stripe Secret Key
 *   STRIPE_WEBHOOK_SECRET    — Stripe Webhook Signing Secret
 *   SUPABASE_URL             — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (bypass RLS)
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const signature = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.userId
    const kind = session.metadata?.kind                  // 'aivis_topup' | undefined（訂閱）

    if (!userId) {
      console.error('No userId in session metadata')
      return res.status(400).json({ error: 'Missing userId in metadata' })
    }

    // 分支 A：aivis Top-up 一次性購買 — 寫入次數包儲值表
    if (kind === 'aivis_topup' && session.mode === 'payment') {
      const pack = session.metadata?.pack                // 'small' | 'large'
      const quota = parseInt(session.metadata?.quota || '0', 10)

      if (!pack || !quota) {
        console.error('Missing pack or quota in topup metadata')
        return res.status(400).json({ error: 'Missing pack or quota in topup metadata' })
      }

      // session.id 作為 source_payment_id（UNIQUE 約束）防止 webhook 重送重複入帳
      // 第二次被觸發時 INSERT 會炸 unique violation，靠 onConflict ignore 跳過
      const { error: topupErr } = await supabase
        .from('aivis_topup_credits')
        .upsert({
          user_id: userId,
          pack_size: pack,
          quota_total: quota,
          quota_remaining: quota,
          source_payment_id: session.id,
          purchased_at: new Date().toISOString(),
        }, { onConflict: 'source_payment_id', ignoreDuplicates: true })

      if (topupErr) {
        console.error('Topup credit insert error:', topupErr)
        return res.status(500).json({ error: topupErr.message })
      }

      console.log(`User ${userId} purchased aivis Top-up ${pack} (+${quota} 次)`)
      return res.status(200).json({ received: true, kind: 'aivis_topup' })
    }

    // 分支 B：Pro 訂閱 — 既有邏輯，不變
    const customerId = session.customer
    const subscriptionId = session.subscription

    const { error } = await supabase
      .from('profiles')
      .update({
        is_pro: true,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscribed_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      console.error('Supabase update error:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`User ${userId} upgraded to Pro`)
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    const customerId = subscription.customer

    // 以 stripe_customer_id 找到對應用戶並撤銷 Pro
    const { error } = await supabase
      .from('profiles')
      .update({ is_pro: false, stripe_subscription_id: null })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('Supabase downgrade error:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log(`Customer ${customerId} subscription cancelled`)
  }

  return res.status(200).json({ received: true })
}
