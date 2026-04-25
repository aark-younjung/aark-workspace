-- =====================================================
-- 清掉測試用的「假訂閱」資料 — 讓營收儀表板歸零
-- 規則：營收只算 Stripe 真正刷卡的用戶（stripe_subscription_id IS NOT NULL）
-- 後台手動授予 Pro（is_pro=true 但無 stripe_subscription_id）不算營收，
-- 所以只要清掉錯誤帶有 stripe_subscription_id 的測試資料即可。
--
-- ⚠️ 執行前請務必先跑「Step 1 檢查」，確認名單裡沒有真正付費的客戶！
-- 一旦清掉就回不來了。
-- =====================================================

-- ---------------------------------------------------------
-- Step 0：補上缺失欄位（subscribed_at）
--   stripe-webhook.js 與 AdminRevenue.jsx 都會用到這欄，
--   你的 profiles 表目前沒有，所以下面 SELECT 會炸 column not exist。
--   ADD COLUMN IF NOT EXISTS 重複執行不會報錯，可安全執行。
-- ---------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ;

-- ---------------------------------------------------------
-- Step 1：檢查 — 看目前有哪些 profiles 帶著 stripe_subscription_id
-- ---------------------------------------------------------
SELECT
  id,
  email,
  name,
  is_pro,
  stripe_customer_id,
  stripe_subscription_id,
  subscribed_at,
  created_at
FROM profiles
WHERE stripe_subscription_id IS NOT NULL
ORDER BY subscribed_at DESC NULLS LAST, created_at DESC;

-- ---------------------------------------------------------
-- Step 2A：如果上面名單「全都是測試資料」 → 一次清空所有訂閱欄位
--   （is_pro 保留不動，他們仍可使用 Pro 功能；只是不再被算進營收）
-- ---------------------------------------------------------
-- UPDATE profiles
-- SET
--   stripe_subscription_id = NULL,
--   stripe_customer_id     = NULL,
--   subscribed_at          = NULL
-- WHERE stripe_subscription_id IS NOT NULL;

-- ---------------------------------------------------------
-- Step 2B：如果只想清掉「特定 email」的測試資料 → 改用這段
--   （把 'test@example.com' 換成要清掉的 email，可加多筆）
-- ---------------------------------------------------------
-- UPDATE profiles
-- SET
--   stripe_subscription_id = NULL,
--   stripe_customer_id     = NULL,
--   subscribed_at          = NULL
-- WHERE email IN ('test@example.com', 'mark6465@gmail.com');

-- ---------------------------------------------------------
-- Step 3：清完後再跑一次 Step 1 確認 — 應該回傳 0 列
-- ---------------------------------------------------------
