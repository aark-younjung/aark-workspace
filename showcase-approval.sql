-- ============================================================================
-- Showcase 排行榜審核 — websites 加 is_approved/submitted_at/rejection_reason
-- ============================================================================
-- 設計原則：
-- 1. 排行榜（/showcase）目前自動把所有 scan_count > 0 的 websites 都列出來，
--    開放後用戶會把奇怪測試 URL / 競品 / 不雅內容刷上去傷品牌，需 admin 審核。
-- 2. 新增 is_approved 旗標 + 待審佇列欄位 + 拒絕原因，前端 fetchData 加上
--    `.eq('is_approved', true)` 過濾。SAMPLE_SITES 不受影響（前端硬寫陣列）。
-- 3. 既有 websites 全部 backfill is_approved=true，避免上線當下 Showcase 變空。
--    新建 websites 預設 is_approved=false，需用戶手動「提交至排行榜」進待審佇列。
-- 4. 第二層守門靠 RLS — admin UPDATE policy 沿用既有 is_admin() helper，
--    讓 AdminShowcase 可直寫 supabase（不開新 Vercel function，已 12/12 上限）。
--
-- 在 Supabase SQL Editor 跑一次即可。冪等：IF NOT EXISTS + DROP IF EXISTS 確保重複跑也不報錯。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. websites 加 3 個審核欄位
-- ----------------------------------------------------------------------------
ALTER TABLE websites
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ----------------------------------------------------------------------------
-- 2. Backfill：既有 websites 全部視為已核准（避免上線後 Showcase 立刻變空）
-- ----------------------------------------------------------------------------
-- 此 statement 只在第一次跑時影響資料；之後再跑只會更新「曾被 admin reject 又
-- 沒重設」的 row，但既有資料不該被誤覆蓋，所以加 WHERE 限制只動「從未被審核過」的 row。
UPDATE websites
  SET is_approved = true
  WHERE is_approved = false
    AND submitted_at IS NULL
    AND rejection_reason IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Index：admin 待審佇列查詢用（按提交時間排序）
-- ----------------------------------------------------------------------------
-- partial index 只 cover「已提交但未核准」的 row，admin queue 走這條最快。
CREATE INDEX IF NOT EXISTS idx_websites_pending_approval
  ON websites (submitted_at DESC)
  WHERE is_approved = false AND submitted_at IS NOT NULL;

-- 另一條 index 給前台 Showcase fetchData 用（按建立時間升序、只撈已核准）
CREATE INDEX IF NOT EXISTS idx_websites_approved_listing
  ON websites (created_at ASC)
  WHERE is_approved = true;

-- ----------------------------------------------------------------------------
-- 4. RLS policy — admin 可 UPDATE 任何 website（審核 approve/reject 用）
-- ----------------------------------------------------------------------------
-- 既有的 admin_select_websites（admin-rls-policies.sql）已開放 admin SELECT 全表，
-- 但 UPDATE policy 不存在 — 本次加上，讓 AdminShowcase 可直寫 is_approved 與 rejection_reason。
DROP POLICY IF EXISTS admin_update_websites ON websites;
CREATE POLICY admin_update_websites ON websites
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- 5. 驗證：
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'websites' AND column_name IN ('is_approved', 'submitted_at', 'rejection_reason');
--   -- 應回 3 row
--
--   SELECT COUNT(*) AS approved_count FROM websites WHERE is_approved = true;
--   -- 應 ≥ 既有 website 數
--
--   SELECT policyname FROM pg_policies
--     WHERE tablename = 'websites' AND policyname = 'admin_update_websites';
--   -- 應回 1 row
-- ----------------------------------------------------------------------------
