-- =====================================================
-- AI 曝光監測模組（aivis）資料表 — Phase 1 基礎
-- 對應規格：AEO_Dashboard_Dev_Spec_v2.md（以 aivis_ 前綴避開現有 aeo_ 命名衝突）
-- 請在 Supabase SQL Editor 中執行
-- =====================================================

-- 1. 品牌主檔：使用者要監測的品牌清單
CREATE TABLE IF NOT EXISTS aivis_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,                    -- 品牌中文或英文名稱
    domain TEXT,                           -- 品牌官網網域（不含 protocol）
    industry TEXT,                         -- 產業分類
    description TEXT,                      -- 品牌簡介（供後續 LLM prompt 使用）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aivis_brands_user ON aivis_brands(user_id);

-- 啟用 Row Level Security（每位使用者僅能讀寫自己的資料）
ALTER TABLE aivis_brands ENABLE ROW LEVEL SECURITY;

-- 先移除舊 policy（若存在），再重新建立；讓此腳本可重複執行
DROP POLICY IF EXISTS "aivis_brands_select_own" ON aivis_brands;
DROP POLICY IF EXISTS "aivis_brands_insert_own" ON aivis_brands;
DROP POLICY IF EXISTS "aivis_brands_update_own" ON aivis_brands;
DROP POLICY IF EXISTS "aivis_brands_delete_own" ON aivis_brands;

-- 只允許擁有者操作自己的品牌紀錄
CREATE POLICY "aivis_brands_select_own" ON aivis_brands
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "aivis_brands_insert_own" ON aivis_brands
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "aivis_brands_update_own" ON aivis_brands
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "aivis_brands_delete_own" ON aivis_brands
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- Phase 2 起將新增的表（此檔先保留註解，實際建立時再啟用）：
--   aivis_competitors       -- 競品清單
--   aivis_prompts           -- 監測用的 prompt
--   aivis_responses         -- AI 回答原文
--   aivis_mentions          -- 品牌/競品被提及紀錄
--   aivis_daily_snapshots   -- 每日聚合指標
--   aivis_user_quotas       -- 使用者配額（對應方案 tier）
--   aivis_fetch_queue       -- Worker 抓取佇列
-- =====================================================
