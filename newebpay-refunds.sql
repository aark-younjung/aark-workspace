-- ============================================================================
-- NewebPay 退款系統 — aivis_newebpay_pending 加 5 個欄位
-- ============================================================================
-- 設計原則：
-- 1. 退款 metadata 直接掛在原訂單 row 上（一張訂單最多退一次，不需獨立表）。
-- 2. refund_status：'none'（未退）/ 'pending'（已申請待處理）/ 'completed'（已完成）/ 'failed'（API 失敗）。
-- 3. refund_method：'api_credit'（信用卡走 NewebPay Close API 線上直退）
--    / 'manual_transfer'（VACC/WEBATM/CVS/BARCODE 走手動轉帳）/ NULL（尚未決定）。
-- 4. refund_amount：實退金額（一律 = pending.amount，預留未來部分退款用 INTEGER 而非 BOOLEAN）。
-- 5. refunded_at：完成退款的時間戳（pending 階段是 NULL，completed 時才填）。
-- 6. refund_note：手動轉帳的客戶銀行帳號 / API 失敗錯誤訊息 / 客服備註等自由文字。
--
-- 在 Supabase SQL Editor 跑一次即可。冪等：ADD COLUMN IF NOT EXISTS 確保重複跑也不報錯。
-- ============================================================================

ALTER TABLE aivis_newebpay_pending
  ADD COLUMN IF NOT EXISTS refund_status TEXT
    NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'pending', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS refund_amount INTEGER,
  ADD COLUMN IF NOT EXISTS refund_method TEXT
    CHECK (refund_method IN ('api_credit', 'manual_transfer')),
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_note TEXT;

-- 索引：admin 查「待手動處理的退款單」用（pending 狀態 + 依時間排序）
CREATE INDEX IF NOT EXISTS idx_newebpay_refund_pending
  ON aivis_newebpay_pending (refund_status, created_at DESC)
  WHERE refund_status IN ('pending', 'failed');

-- 驗證：
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--     WHERE table_name = 'aivis_newebpay_pending'
--       AND column_name IN ('refund_status', 'refund_amount', 'refund_method', 'refunded_at', 'refund_note');
