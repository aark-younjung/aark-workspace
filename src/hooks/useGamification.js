/**
 * useGamification — 從用戶現有 audit 資料反推 gamification 狀態
 *
 * 為什麼不在 DB 加欄位：避免 SQL migration 的複雜度（CLAUDE.md feedback_no_sql_archive），
 * 直接從 audits 表的事實資料推算 XP / 等級 / streak / 徽章；之後若要加快可改成計算欄位。
 *
 * XP 計分規則：
 *   +10 XP × 每次 audit（4 大面向 + 1 內容、跨所有 websites 累加）
 *   +50 XP × 每個 website
 *   +5  XP × 每個有 audit 的日期（distinct days）
 *
 * 等級分層（總 XP）：
 *   青銅 Lv.1-5    0-499      （每級 100 XP）
 *   白銀 Lv.6-10   500-1499   （每級 200 XP）
 *   黃金 Lv.11-15  1500-3499  （每級 400 XP）
 *   鉑金 Lv.16-20  3500-7499  （每級 800 XP）
 *   鑽石 Lv.21+    7500+      （每級 1500 XP）
 *
 * Streak：從今天往前算、連續有任何 audit 的天數。
 *
 * 徽章 8 個：
 *   🚀 首次掃描          至少 1 次 audit
 *   🔥 7 日連續登入       streak >= 7
 *   🩺 完成站點體檢       至少 1 個 website 5 個面向都有分數
 *   🔧 初次修復           總 audit 次數 >= 5（暫時代理；B5 phase 接真正的「修復後重掃」事件）
 *   ✨ 改進 +10 分        任一面向歷史 max - min >= 10
 *   🎯 所有 5 面向 ≥80    至少 1 個 website 全綠
 *   📈 連續 30 天進步     streak >= 30
 *   💎 達到鑽石級         level >= 21
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── 等級表 ─────────────────────────────────────────
const TIER_CONFIG = [
  { tier: '青銅', emoji: '🥉', minLevel: 1,  maxLevel: 5,  xpPerLevel: 100,  baseXp: 0     },
  { tier: '白銀', emoji: '🥈', minLevel: 6,  maxLevel: 10, xpPerLevel: 200,  baseXp: 500   },
  { tier: '黃金', emoji: '🥇', minLevel: 11, maxLevel: 15, xpPerLevel: 400,  baseXp: 1500  },
  { tier: '鉑金', emoji: '🏆', minLevel: 16, maxLevel: 20, xpPerLevel: 800,  baseXp: 3500  },
  { tier: '鑽石', emoji: '💎', minLevel: 21, maxLevel: 99, xpPerLevel: 1500, baseXp: 7500  },
]

function computeLevelInfo(totalXp) {
  // 找到對應 tier
  let tier = TIER_CONFIG[0]
  for (const t of TIER_CONFIG) {
    if (totalXp >= t.baseXp) tier = t
    else break
  }
  // 該 tier 內部的等級
  const xpInTier = totalXp - tier.baseXp
  const levelInTier = Math.min(Math.floor(xpInTier / tier.xpPerLevel), tier.maxLevel - tier.minLevel)
  const level = tier.minLevel + levelInTier
  // 進度條：當前等級內已累積 / 該等級需要
  const xpInLevel = xpInTier - levelInTier * tier.xpPerLevel
  const xpToNext = tier.xpPerLevel - xpInLevel
  const progressPct = Math.round((xpInLevel / tier.xpPerLevel) * 100)

  return {
    tier: tier.tier,
    emoji: tier.emoji,
    level,
    xp: xpInLevel,
    xpToNext,
    totalXp: tier.xpPerLevel,
    progressPct,
  }
}

// Streak — 從今天往前算連續有 audit 的天數
function computeStreak(distinctDates) {
  if (!distinctDates.length) return 0
  const dateSet = new Set(distinctDates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  // 允許今天還沒掃 — 從昨天開始累積也算
  let checkDate = new Date(today)
  if (!dateSet.has(formatDate(checkDate))) {
    checkDate.setDate(checkDate.getDate() - 1)
    if (!dateSet.has(formatDate(checkDate))) return 0
  }
  while (dateSet.has(formatDate(checkDate))) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }
  return streak
}

function formatDate(d) {
  // YYYY-MM-DD（本地時區）— 跟 audit created_at 的日期部分對齊
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── 預設徽章定義（順序對齊 prototype-2b）────────────
const BADGE_DEFS = [
  { key: 'first_scan',    emoji: '🚀', label: '首次掃描',         test: (s) => s.totalAudits >= 1 },
  { key: 'streak_7',      emoji: '🔥', label: '7 日連續登入',      test: (s) => s.streak >= 7 },
  { key: 'full_audit',    emoji: '🩺', label: '完成站點體檢',      test: (s) => s.hasFullAudit },
  { key: 'first_fix',     emoji: '🔧', label: '初次修復',          test: (s) => s.totalAudits >= 5 },
  { key: 'improve_10',    emoji: '✨', label: '改進 +10 分',       test: (s) => s.maxImprove >= 10 },
  { key: 'all_green',     emoji: '🎯', label: '所有 5 面向 ≥80',   test: (s) => s.allGreen },
  { key: 'streak_30',    emoji: '📈', label: '連續 30 天進步',     test: (s) => s.streak >= 30 },
  { key: 'diamond_tier', emoji: '💎', label: '達到鑽石級',         test: (s) => s.level >= 21 },
]

export function useGamification(userId) {
  const [state, setState] = useState({
    loading: true,
    level: 1, levelName: '青銅', emoji: '🥉',
    xp: 0, xpToNext: 100, totalXp: 100, progressPct: 0,
    streak: 0,
    badges: BADGE_DEFS.map(b => ({ ...b, unlocked: false })),
    // 額外暴露讓 Dashboard 顯示「why」
    totalAudits: 0, websiteCount: 0, distinctActiveDays: 0,
  })

  useEffect(() => {
    let cancelled = false
    if (!userId) return

    async function load() {
      try {
        // 1. 取所有 websites（拿 ids 給 audits 查）
        const { data: websites } = await supabase
          .from('websites').select('id').eq('user_id', userId)
        if (cancelled) return
        const websiteIds = (websites || []).map(w => w.id)
        const websiteCount = websiteIds.length

        if (websiteCount === 0) {
          // 新用戶、沒掃過 — 直接回 0 狀態
          if (!cancelled) setState(prev => ({ ...prev, loading: false, websiteCount: 0 }))
          return
        }

        // 2. 平行抓 4 大 audit + content_audits
        const [seo, aeo, geo, eeat, content] = await Promise.all([
          supabase.from('seo_audits').select('website_id, score, created_at').in('website_id', websiteIds),
          supabase.from('aeo_audits').select('website_id, score, created_at').in('website_id', websiteIds),
          supabase.from('geo_audits').select('website_id, score, created_at').in('website_id', websiteIds),
          supabase.from('eeat_audits').select('website_id, score, created_at').in('website_id', websiteIds),
          supabase.from('content_audits').select('website_id, score, created_at').in('website_id', websiteIds),
        ])
        if (cancelled) return

        const allAudits = [
          ...(seo.data || []),
          ...(aeo.data || []),
          ...(geo.data || []),
          ...(eeat.data || []),
          ...(content.data || []),
        ]

        const totalAudits = allAudits.length

        // 3. 計算 distinct days
        const dates = new Set()
        allAudits.forEach(a => {
          if (a.created_at) {
            const d = new Date(a.created_at)
            dates.add(formatDate(d))
          }
        })
        const distinctActiveDays = dates.size

        // 4. 算 XP
        const totalXp = totalAudits * 10 + websiteCount * 50 + distinctActiveDays * 5

        // 5. 算等級
        const levelInfo = computeLevelInfo(totalXp)

        // 6. 算 streak
        const streak = computeStreak(Array.from(dates))

        // 7. 算「至少有 1 個 website 5 個面向都有分數」(hasFullAudit)
        //    跟「至少有 1 個 website 5 個面向都 >= 80」(allGreen)
        let hasFullAudit = false
        let allGreen = false
        const perSiteFaces = {}
        for (const a of seo.data || [])     {(perSiteFaces[a.website_id] ||= {}).seo = (perSiteFaces[a.website_id].seo ?? a.score)}
        for (const a of aeo.data || [])     {(perSiteFaces[a.website_id] ||= {}).aeo = (perSiteFaces[a.website_id].aeo ?? a.score)}
        for (const a of geo.data || [])     {(perSiteFaces[a.website_id] ||= {}).geo = (perSiteFaces[a.website_id].geo ?? a.score)}
        for (const a of eeat.data || [])    {(perSiteFaces[a.website_id] ||= {}).eeat = (perSiteFaces[a.website_id].eeat ?? a.score)}
        for (const a of content.data || []) {(perSiteFaces[a.website_id] ||= {}).content = (perSiteFaces[a.website_id].content ?? a.score)}
        for (const wid in perSiteFaces) {
          const f = perSiteFaces[wid]
          if (f.seo != null && f.aeo != null && f.geo != null && f.eeat != null && f.content != null) {
            hasFullAudit = true
            if (f.seo >= 80 && f.aeo >= 80 && f.geo >= 80 && f.eeat >= 80 && f.content >= 80) {
              allGreen = true
            }
          }
        }

        // 8. 算「改進 +10 分」— 任一 website 任一面向 max-min >= 10
        let maxImprove = 0
        const groupByFace = { seo: seo.data, aeo: aeo.data, geo: geo.data, eeat: eeat.data, content: content.data }
        for (const face in groupByFace) {
          const rows = groupByFace[face] || []
          const perSite = {}
          for (const r of rows) {
            if (r.score == null) continue
            ;(perSite[r.website_id] ||= []).push(r.score)
          }
          for (const wid in perSite) {
            const scores = perSite[wid]
            if (scores.length < 2) continue
            const diff = Math.max(...scores) - Math.min(...scores)
            if (diff > maxImprove) maxImprove = diff
          }
        }

        // 9. 結算徽章
        const stats = {
          totalAudits, websiteCount, distinctActiveDays,
          streak,
          hasFullAudit, allGreen, maxImprove,
          level: levelInfo.level,
        }
        const badges = BADGE_DEFS.map(b => ({
          emoji: b.emoji,
          label: b.label,
          key: b.key,
          unlocked: b.test(stats),
        }))

        if (!cancelled) {
          setState({
            loading: false,
            levelName: levelInfo.tier,
            emoji: levelInfo.emoji,
            level: levelInfo.level,
            xp: levelInfo.xp,
            xpToNext: levelInfo.xpToNext,
            totalXp: levelInfo.totalXp,
            progressPct: levelInfo.progressPct,
            streak,
            badges,
            totalAudits, websiteCount, distinctActiveDays,
          })
        }
      } catch (e) {
        if (!cancelled) {
          console.error('useGamification error:', e)
          setState(prev => ({ ...prev, loading: false }))
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [userId])

  return state
}
