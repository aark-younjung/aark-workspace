-- ============================================================================
-- 7 天免費試用系統 — profiles 試用欄位 + start_pro_trial() RPC + cron lookup 索引
-- ============================================================================
-- 設計原則：
-- 1. 開戶時不自動給試用（避免多帳號刷單）— 用戶在 Pricing 或 Dashboard 主動點「免費試用 7 天」CTA 才觸發
-- 2. 試用期間 is_pro = true 解鎖所有 Pro 功能，但 is_trial 同時為 true 供前端顯示倒數
-- 3. 每個 user 一輩子只能啟動 1 次試用（透過 trial_started_at IS NULL 判斷）
-- 4. 到期靠 (a) 每日 cron job 掃 trial_ends_at < now() 的 row 把 is_pro 設回 false
--    (b) AuthContext lazy expiry 在 profile load 時也檢查一次（cron 萬一掛了的安全網）
-- 5. RPC SECURITY DEFINER → 用 auth.uid() 拿到當前登入用戶 id，不需從前端傳，避免被偽造
--
-- 在 Supabase SQL Editor 跑一次即可。
-- ============================================================================

-- Step 1: profiles 表加 3 個試用相關欄位
-- is_trial: 是否在試用期內（true 時前端顯示倒數）
-- trial_started_at: 試用開始時間（NULL = 從未試用過，用來防止再次啟動）
-- trial_ends_at: 試用到期時間（cron 用來掃過期 row）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Step 2: cron 掃描索引 — partial index 只索引「目前正在試用」的 row，
-- 表大了之後 cron 一秒就掃完，不會 full table scan
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at
  ON profiles(trial_ends_at)
  WHERE is_trial = true;

-- Step 3: 啟動試用 RPC
-- 回傳 jsonb 而不是直接 success/fail，因為前端要區分多種失敗原因（已試用過 / 已是 Pro / 未登入）
CREATE OR REPLACE FUNCTION start_pro_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_trial_started timestamptz;
  v_existing_is_pro boolean;
  v_trial_ends_at timestamptz;
BEGIN
  -- 從 auth.uid() 拿當前登入用戶 — 不接受前端傳 user_id 避免偽造
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 檢查當前狀態
  SELECT trial_started_at, is_pro
    INTO v_existing_trial_started, v_existing_is_pro
    FROM profiles
    WHERE id = v_user_id;

  -- 已經試用過（無論到期或未到期），都不允許再試用
  IF v_existing_trial_started IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_trialed');
  END IF;

  -- 已經是付費 Pro 用戶，不需要試用
  IF v_existing_is_pro = true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_pro');
  END IF;

  -- 啟動試用：is_trial + is_pro 同時 true，記下 started_at 與 ends_at
  v_trial_ends_at := now() + interval '7 days';
  UPDATE profiles
    SET is_trial = true,
        is_pro = true,
        trial_started_at = now(),
        trial_ends_at = v_trial_ends_at
    WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'trial_ends_at', v_trial_ends_at
  );
END;
$$;

-- 只允許登入用戶呼叫（anon 拿不到 auth.uid() 也會被 RPC 內擋掉，這裡多一層）
REVOKE ALL ON FUNCTION start_pro_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_pro_trial() TO authenticated;

-- Step 4: 驗證
-- 跑完後可以執行下面這段確認欄位、索引、函式都到位：
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name LIKE 'trial%' OR column_name = 'is_trial';
--   SELECT indexname FROM pg_indexes WHERE tablename = 'profiles' AND indexname LIKE '%trial%';
--   SELECT proname FROM pg_proc WHERE proname = 'start_pro_trial';
