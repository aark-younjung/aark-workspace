/**
 * limits.js — 訂閱方案站數上限與輔助函式（2026-06-10）
 *
 * 為什麼集中：原本 HomeDark.jsx 寫死 `WEBSITE_LIMIT = 15`、Free 用戶實際只能 3 站
 * 沒程式擋（只有 UI 暗示）。Agency 加入後變 4 個方案、要一個 source of truth。
 *
 * 漸進遷移：profile.subscription_tier 為新欄位、profile.is_pro 為舊欄位、
 * `getTier(profile)` 會優先看 tier、沒有 fallback to is_pro / free。
 */

// ─── 方案常數 ───
export const TIER = {
  FREE: 'free',
  PRO: 'pro',
  AGENCY_STARTER: 'agency_starter',
  AGENCY_PLUS: 'agency_plus',
}

// ─── 每方案站數上限 ───
// Free 3 / Pro 15 / Agency Starter 30 / Plus 100
export const SITE_LIMIT = {
  [TIER.FREE]: 3,
  [TIER.PRO]: 15,
  [TIER.AGENCY_STARTER]: 30,
  [TIER.AGENCY_PLUS]: 100,
}

// ─── 方案中文標籤（UI 顯示用） ───
export const TIER_LABEL = {
  [TIER.FREE]: '免費版',
  [TIER.PRO]: 'Pro',
  [TIER.AGENCY_STARTER]: 'Agency Starter',
  [TIER.AGENCY_PLUS]: 'Agency Plus',
}

// ─── 從 profile 取 tier（向下相容 is_pro 欄位） ───
// profile.subscription_tier 為新欄位、優先用；沒設且 is_pro=true → 推斷為 'pro'
export function getTier(profile) {
  if (!profile) return TIER.FREE
  if (profile.subscription_tier) return profile.subscription_tier
  return profile.is_pro ? TIER.PRO : TIER.FREE
}

// ─── 是否為 Agency 方案（Starter 或 Plus） ───
export function isAgencyTier(tier) {
  return tier === TIER.AGENCY_STARTER || tier === TIER.AGENCY_PLUS
}

// ─── 取站數上限 ───
export function siteLimitForTier(tier) {
  return SITE_LIMIT[tier] ?? SITE_LIMIT[TIER.FREE]
}

// ─── 方案標籤（給 UI 顯示） ───
export function tierLabel(tier) {
  return TIER_LABEL[tier] || TIER_LABEL[TIER.FREE]
}

// ─── aivis 每月額度（顯示用）───
// 執法端唯一真相在 api/aivis/fetch.js（AIVIS_QUOTA_PER_MONTH=150 / AIVIS_QUOTA_PER_TRIAL=50）；
// 這裡是前端顯示分母，改額度時兩邊要一起動。
export const AIVIS_QUOTA_PRO = 150
export const AIVIS_QUOTA_TRIAL = 50
export function aivisQuotaFor({ isTrial = false } = {}) {
  return isTrial ? AIVIS_QUOTA_TRIAL : AIVIS_QUOTA_PRO
}
