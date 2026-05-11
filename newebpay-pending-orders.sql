-- ====================================================================
-- NewebPay 訂單暫存表 + aivis_topup_credits 加 gateway 欄位
-- 用途：NewebPay 不像 Stripe 有 metadata 可塞 userId/pack/quota，
--      改用此表先暫存 pending 訂單，notify callback 來時用 MerchantOrderNo 查回 user/pack/quota
-- ====================================================================

-- ---------- 1. NewebPay pending orders 暫存表 ----------
CREATE TABLE IF NOT EXISTS aivis_newebpay_pending (
  merchant_order_no TEXT PRIMARY KEY,            -- NewebPay 訂單編號（送出去前自己產生，長度上限 30）
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('topup_small', 'topup_large', 'pro_yearly', 'pro_monthly_first')),
  pack TEXT CHECK (pack IN ('small', 'large')),  -- topup 才有
  quota INTEGER,                                  -- topup 才有（300 / 800）
  amount INTEGER NOT NULL,                        -- 金額（TWD 整數，不是分位）
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  trade_no TEXT,                                  -- NewebPay 回傳的金流交易序號（notify 時寫入）
  payment_type TEXT,                              -- CREDIT / WEBATM / VACC / CVS / BARCODE 等
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  notify_raw JSONB                                -- notify callback 原始 payload（debug 用）
);

CREATE INDEX IF NOT EXISTS idx_aivis_newebpay_pending_user
  ON aivis_newebpay_pending (user_id, created_at DESC);

-- RLS：用戶可讀自己的 pending、不開放任何用戶端寫入（service role bypass）
ALTER TABLE aivis_newebpay_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_read_own_newebpay_pending ON aivis_newebpay_pending;
CREATE POLICY user_read_own_newebpay_pending
  ON aivis_newebpay_pending FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- admin 全讀（複用既有 is_admin() helper）
DROP POLICY IF EXISTS admin_read_all_newebpay_pending ON aivis_newebpay_pending;
CREATE POLICY admin_read_all_newebpay_pending
  ON aivis_newebpay_pending FOR SELECT TO authenticated
  USING (is_admin());

-- ---------- 2. aivis_topup_credits 加 gateway 欄位 ----------
-- 現存資料一律當 stripe（之前都是 Stripe 寫入的），新進 newebpay 寫入時帶 'newebpay'
ALTER TABLE aivis_topup_credits
  ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'stripe' CHECK (gateway IN ('stripe', 'newebpay'));

-- ---------- 3. profiles 加 payment_gateway 欄位（為 Phase 2 預留，現在 Pro 訂閱沒上線先放著） ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT CHECK (payment_gateway IN ('stripe', 'newebpay'));
