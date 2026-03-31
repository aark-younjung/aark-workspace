/**
 * POST /api/create-checkout-session
 * 建立 Stripe Checkout Session，回傳付款頁面 URL
 *
 * Body: { userId, email, returnUrl }
 *
 * Env:
 *   STRIPE_SECRET_KEY   — Stripe Secret Key
 *   STRIPE_PRICE_ID     — Stripe Price ID (月費方案)
 *   NEXT_PUBLIC_SITE_URL — e.g. https://aark.io
 */

import Stripe from 'stripe'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email, returnUrl, priceType } = req.body

  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required' })
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://aark-workspace.vercel.app'

  const PRICE_MAP = {
    monthly:   process.env.STRIPE_PRICE_ID,
    yearly:    process.env.STRIPE_PRICE_ID_YEARLY,
    earlybird: process.env.STRIPE_PRICE_ID_EARLYBIRD || process.env.STRIPE_PRICE_ID,
  }
  const STRIPE_PRICE_ID = PRICE_MAP[priceType] || PRICE_MAP.monthly

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return res.status(500).json({ error: 'Stripe environment variables not configured' })
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
      },
      success_url: returnUrl
        ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}upgraded=true`
        : `${SITE_URL}/?upgraded=true`,
      cancel_url: returnUrl || `${SITE_URL}/`,
      locale: 'zh',
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' })
  }
}
