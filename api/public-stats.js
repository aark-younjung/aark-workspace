/**
 * GET /api/public-stats
 * Pricing 頁社會證明 KPI（公開資料，無需登入）
 *
 * Response:
 *   {
 *     brands:          number,  // aivis_brands 總數 — 正在監測的品牌數
 *     reports:         number,  // seo+aeo+geo+eeat 四表 audit 總和 — AI 能見度報告份數
 *     mentions:        number,  // aivis_mentions where brand_mentioned=true — 品牌被 AI 主動提及次數
 *     scans:           number,  // aivis_responses 總數 — 累積 AI 掃描次數
 *     earlybird_taken: number,  // 早鳥首年付費完成數 — Pricing 進度條用
 *   }
 *
 * 為什麼用 service role 而非前端直查 Supabase：
 *   訪客（anon role）對 user-scoped 資料表（aivis_*、*_audits）的 RLS 是 auth.uid() 對齊，
 *   匿名訪客讀回來會是 0 或 null。後端用 service role 繞過 RLS 拿聚合 count，
 *   只回數字、不回 row data，沒有隱私洩漏問題。
 *
 * Cache-Control：5 分鐘 CDN cache（這些數字不需要 real-time），降低 Supabase 查詢負擔。
 *
 * Env:
 *   SUPABASE_URL / VITE_SUPABASE_URL（fallback）
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 並行 8 查（4 個 audit 表 + 3 個 aivis 表 + 1 個早鳥已售名額），head:true 只回 count 不抓 row 資料
    // 早鳥計數用 newebpay_pending（pack='earlybird' + status='paid'）— Pricing 進度條即時顯示「N / 100 名」
    const [brandsRes, seoRes, aeoRes, geoRes, eeatRes, mentionsRes, scansRes, earlybirdRes] = await Promise.all([
      supabase.from('aivis_brands').select('*', { count: 'exact', head: true }),
      supabase.from('seo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('aeo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('geo_audits').select('*', { count: 'exact', head: true }),
      supabase.from('eeat_audits').select('*', { count: 'exact', head: true }),
      supabase.from('aivis_mentions').select('*', { count: 'exact', head: true }).eq('brand_mentioned', true),
      supabase.from('aivis_responses').select('*', { count: 'exact', head: true }),
      supabase.from('aivis_newebpay_pending').select('*', { count: 'exact', head: true })
        .eq('pack', 'earlybird').eq('status', 'paid'),
    ])

    const brands = brandsRes.count || 0
    const reports = (seoRes.count || 0) + (aeoRes.count || 0) + (geoRes.count || 0) + (eeatRes.count || 0)
    const mentions = mentionsRes.count || 0
    const scans = scansRes.count || 0
    const earlybird_taken = earlybirdRes.count || 0

    // 5 分鐘 CDN cache + 10 分鐘 stale-while-revalidate（過期後仍會回舊資料、背景更新）
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ brands, reports, mentions, scans, earlybird_taken })
  } catch (err) {
    console.error('[public-stats] query failed:', err)
    return res.status(500).json({ error: 'Failed to load stats' })
  }
}
