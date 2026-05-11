/**
 * POST /api/cancel-subscription
 * 在訂閱週期結束時取消訂閱（不立即中斷，讓用戶用到到期日）
 *
 * Body: { userId }
 *
 * Env:
 *   STRIPE_SECRET_KEY        — Stripe Secret Key
 *   SUPABASE_URL             — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId is required' })

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const stripe = new Stripe(STRIPE_SECRET_KEY)

  // 從 Supabase 取得 stripe_subscription_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.stripe_subscription_id) {
    return res.status(404).json({ error: '找不到訂閱資料' })
  }

  try {
    // 設定在週期結束時取消（不立即中斷）
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    return res.status(500).json({ error: err.message || '取消失敗，請稍後再試' })
  }
}
