/**
 * POST /api/aivis/checkout-topup
 * 建立 Top-up 加購次數包的 Stripe Checkout session（一次性付款，非訂閱）
 *
 * Body: { userId, email, pack: 'small' | 'large', returnUrl }
 *
 * Env:
 *   STRIPE_SECRET_KEY              — Stripe Secret Key
 *   STRIPE_TOPUP_SMALL_PRICE_ID    — Stripe Price ID（NT$490 / +300 次）
 *   STRIPE_TOPUP_LARGE_PRICE_ID    — Stripe Price ID（NT$990 / +800 次）
 *   NEXT_PUBLIC_SITE_URL           — e.g. https://aark-workspace.vercel.app
 *
 * 注意：Top-up 與 Pro 訂閱完全分離，用 mode: 'payment'（不是 subscription）。
 *       webhook 端用 metadata.kind === 'aivis_topup' 判斷要寫入 aivis_topup_credits。
 */

import Stripe from 'stripe'

// 兩種 Top-up 包的對應規格
const PACK_SPEC = {
  small: { priceEnvKey: 'STRIPE_TOPUP_SMALL_PRICE_ID', quota: 300, label: 'Top-up 小包' },
  large: { priceEnvKey: 'STRIPE_TOPUP_LARGE_PRICE_ID', quota: 800, label: 'Top-up 大包' },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, pack, returnUrl } = req.body || {}

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required' })
  }
  const spec = PACK_SPEC[pack]
  if (!spec) {
    return res.status(400).json({ error: `Invalid pack: ${pack}. Must be 'small' or 'large'.` })
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const STRIPE_PRICE_ID = process.env[spec.priceEnvKey]
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return res.status(500).json({
      error: 'Stripe environment variables not configured',
      detail: `Missing STRIPE_SECRET_KEY or ${spec.priceEnvKey}`,
    })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',                     // 一次性付款，不建立訂閱
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      // metadata 走進 webhook 用來辨識「這是 aivis topup 不是 pro 訂閱」+ 帶出加多少次
      metadata: {
        userId,
        kind: 'aivis_topup',
        pack,
        quota: String(spec.quota),
      },
      success_url: returnUrl
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}topup_success=${pack}`
        : `${SITE_URL}/?topup_success=${pack}`,
      cancel_url: returnUrl || `${SITE_URL}/`,
      locale: 'zh',
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Top-up checkout error:', err)
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' })
  }
}
