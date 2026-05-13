-- ============================================================================
-- 後臺客服工具（CS Tools）— RLS policy + profiles 加 pro_expires_at 欄位
-- ============================================================================
-- 設計原則：
-- 1. 客服動作（補發 Top-up / 延長 Pro / 發 email）走 admin 前端直寫 supabase，
--    不開新 Vercel function（Hobby plan 已 12/12 functions 上限）。
-- 2. 第二層守門靠 RLS policy + `is_admin()` helper（即使 anon key 流出，
--    沒有 is_admin=true 的 profile 也寫不進去）。
-- 3. profiles.pro_expires_at 是「客服參考用」到期日欄位，目前**不**串自動降級 cron
--    （避免誤傷現有 NewebPay 年繳付費用戶，他們的 paid_at 沒 backfill 到此欄位）。
--    cron 自動降級邏輯日後另外做，先把 schema 與 UI 鋪好。
--
-- 在 Supabase SQL Editor 跑一次即可。冪等：IF NOT EXISTS + DROP IF EXISTS 確保重複跑也不報錯。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.pro_expires_at — Pro 到期日（NULL = 永久 / 未追蹤）
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

-- 索引：未來 cron 掃「即將到期 Pro」用
CREATE INDEX IF NOT EXISTS idx_profiles_pro_expires_at
  ON profiles (pro_expires_at)
  WHERE is_pro = true AND pro_expires_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 1b. profiles.admin_history — 客服操作軌跡（append-only JSONB array）
-- ----------------------------------------------------------------------------
-- 記錄延長 Pro / 補發 / 寄信等客服動作的歷史，供後續對帳與客訴回溯。
-- 結構：[{ ts, admin_id, action, ...details }]
--   action='extend_pro' → { days, reason, prev_expires_at, new_expires_at }
--   action='grant_topup' → { pack, quota, reason, source_payment_id }
--   action='send_email' → { subject, reason }
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. aivis_topup_credits — 加 admin INSERT/UPDATE policy（客服補發點數包用）
-- ----------------------------------------------------------------------------
-- 原 RLS 只開用戶 SELECT 自己 + admin SELECT 全部（見 aivis-topup-credits.sql / aivis-topup-admin-rls.sql）。
-- 本次加 admin INSERT + UPDATE，讓客服可以：
--   (a) 補發點數包（INSERT 新 row，source_payment_id 用 'admin_compensation_<ts>' 區分）
--   (b) 修正錯誤入帳（UPDATE quota_remaining，極少用）
-- 不開 DELETE — 補發錯了就 UPDATE quota_remaining=0 軟刪除，保留稽核軌跡。

DROP POLICY IF EXISTS admin_insert_topup_credits ON aivis_topup_credits;
CREATE POLICY admin_insert_topup_credits ON aivis_topup_credits
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_update_topup_credits ON aivis_topup_credits;
CREATE POLICY admin_update_topup_credits ON aivis_topup_credits
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 3. 驗證：
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name = 'pro_expires_at';
--   SELECT policyname FROM pg_policies
--     WHERE tablename = 'aivis_topup_credits' AND policyname LIKE 'admin_%';
-- ----------------------------------------------------------------------------
