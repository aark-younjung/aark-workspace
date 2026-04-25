-- =====================================================
-- Admin RLS Policies — 讓 is_admin = true 的用戶能讀取所有客戶資料
-- 修復後台「只看到自己一筆」的問題
-- 請在 Supabase SQL Editor 執行（可重複執行，不會出錯）
-- =====================================================

-- 1. 建立 is_admin() helper function
--    用 SECURITY DEFINER 讓函式自己跳過 RLS 來查 profiles，避免「policy 查 profiles 又被自己擋」的遞迴
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- =====================================================
-- profiles：admin 可讀寫全表（用戶管理頁需要）
-- =====================================================
DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
CREATE POLICY "admins_read_all_profiles" ON profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_all_profiles" ON profiles;
CREATE POLICY "admins_update_all_profiles" ON profiles
  FOR UPDATE USING (public.is_admin());

-- =====================================================
-- websites：admin 可讀寫刪除全表（掃描紀錄頁需要）
-- =====================================================
DROP POLICY IF EXISTS "admins_read_all_websites" ON websites;
CREATE POLICY "admins_read_all_websites" ON websites
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_delete_all_websites" ON websites;
CREATE POLICY "admins_delete_all_websites" ON websites
  FOR DELETE USING (public.is_admin());

-- =====================================================
-- 四大 audit 表：admin 可讀全表（展開用戶看分數需要）
-- =====================================================
DROP POLICY IF EXISTS "admins_read_all_seo_audits" ON seo_audits;
CREATE POLICY "admins_read_all_seo_audits" ON seo_audits
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_aeo_audits" ON aeo_audits;
CREATE POLICY "admins_read_all_aeo_audits" ON aeo_audits
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_geo_audits" ON geo_audits;
CREATE POLICY "admins_read_all_geo_audits" ON geo_audits
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins_read_all_eeat_audits" ON eeat_audits;
CREATE POLICY "admins_read_all_eeat_audits" ON eeat_audits
  FOR SELECT USING (public.is_admin());

-- =====================================================
-- 完成：執行後刷新 /admin 頁面，應該看到所有用戶與網站
-- =====================================================
