-- ============================================================================
-- 7 天試用提醒系統 — profiles 加 trial_reminders_sent 欄位
-- ============================================================================
-- 設計原則：
-- 1. 用 TEXT[] 記哪些 Day N 提醒已寄過（'day4' / 'day6' / 'day7'），cron 每天跑時
--    檢查 ARRAY_CONTAINS 或 includes('dayN') 達成 idempotency；同 cron 一天跑兩次也不會重複寄信。
-- 2. NOT NULL DEFAULT '{}'：所有既有 row 自動補空陣列，無需 backfill。
-- 3. Day 4 = 試用滿 3 天後寄「剩 3 天」/ Day 6 = 滿 5 天後寄「剩 1 天」/ Day 7 = 過期當日寄「試用結束」。
--    cron 端用 `(now() - trial_started_at) >= interval 'N days'` 判斷該不該寄。
--
-- 在 Supabase SQL Editor 跑一次即可。
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_reminders_sent TEXT[] NOT NULL DEFAULT '{}';

-- 驗證：
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name = 'trial_reminders_sent';
