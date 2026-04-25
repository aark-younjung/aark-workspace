-- =====================================================
-- AI 曝光監測模組（aivis）資料表 — Phase 2
-- Phase 1 已建：aivis_brands
-- Phase 2 新增：aivis_prompts / aivis_responses / aivis_mentions
--
-- 設計原則：
-- 1. 三張表都帶 user_id（denormalized）→ RLS policy 跟 Phase 1 一樣簡單
-- 2. 全部用 ON DELETE CASCADE → 刪 brand 時連同 prompts/responses/mentions 一起清掉
-- 3. 可重複執行（IF NOT EXISTS / DROP POLICY IF EXISTS）
--
-- 請在 Supabase SQL Editor 執行（同樣可重複跑）
-- =====================================================


-- =====================================================
-- 1. aivis_prompts — 監測用的提示詞
--    Claude 分析品牌產業/調性後產生 5 條，使用者可改、可停用
-- =====================================================
CREATE TABLE IF NOT EXISTS aivis_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES aivis_brands(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,                        -- prompt 內文
    generated_by TEXT DEFAULT 'auto'           -- 'auto'（Claude 產生）/ 'user'（手動新增或修改）
        CHECK (generated_by IN ('auto', 'user')),
    is_active BOOLEAN DEFAULT true,            -- 是否啟用（停用就不會被 cron 抓）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aivis_prompts_brand ON aivis_prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_aivis_prompts_user_active ON aivis_prompts(user_id, is_active);

ALTER TABLE aivis_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aivis_prompts_select_own" ON aivis_prompts;
DROP POLICY IF EXISTS "aivis_prompts_insert_own" ON aivis_prompts;
DROP POLICY IF EXISTS "aivis_prompts_update_own" ON aivis_prompts;
DROP POLICY IF EXISTS "aivis_prompts_delete_own" ON aivis_prompts;

CREATE POLICY "aivis_prompts_select_own" ON aivis_prompts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aivis_prompts_insert_own" ON aivis_prompts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aivis_prompts_update_own" ON aivis_prompts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aivis_prompts_delete_own" ON aivis_prompts
    FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 2. aivis_responses — Claude 對 prompt 的單次回應
--    一個 prompt 重複跑 3 次 → 同 prompt_id 會有 3 列（run_index = 1/2/3）
-- =====================================================
CREATE TABLE IF NOT EXISTS aivis_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES aivis_brands(id) ON DELETE CASCADE NOT NULL,
    prompt_id UUID REFERENCES aivis_prompts(id) ON DELETE CASCADE NOT NULL,
    run_index INTEGER NOT NULL,                -- 第幾次重複（1, 2, 3 ... N）
    model TEXT NOT NULL,                       -- 用的模型，例如 'claude-haiku-4-5-20251001'
    raw_response TEXT NOT NULL,                -- Claude 完整回答原文
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd NUMERIC(10, 6),                   -- 這次呼叫成本（估算）
    brand_mentioned BOOLEAN DEFAULT false,     -- 我方品牌有沒有被提到（後處理寫入）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aivis_responses_prompt ON aivis_responses(prompt_id);
CREATE INDEX IF NOT EXISTS idx_aivis_responses_brand_date ON aivis_responses(brand_id, created_at DESC);

ALTER TABLE aivis_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aivis_responses_select_own" ON aivis_responses;
DROP POLICY IF EXISTS "aivis_responses_insert_own" ON aivis_responses;
DROP POLICY IF EXISTS "aivis_responses_delete_own" ON aivis_responses;

CREATE POLICY "aivis_responses_select_own" ON aivis_responses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aivis_responses_insert_own" ON aivis_responses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aivis_responses_delete_own" ON aivis_responses
    FOR DELETE USING (auth.uid() = user_id);
-- 不開放 UPDATE：回應原文應為不可變紀錄；要修正請刪除重跑


-- =====================================================
-- 3. aivis_mentions — 從回答中萃取出的品牌提及紀錄
--    Phase 2 暫時只記錄目標品牌（is_target=true）；
--    Phase 3 加競品時，同一筆 response 可能拆成多列 mentions（不同品牌）
-- =====================================================
CREATE TABLE IF NOT EXISTS aivis_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES aivis_brands(id) ON DELETE CASCADE NOT NULL,
    response_id UUID REFERENCES aivis_responses(id) ON DELETE CASCADE NOT NULL,
    mentioned_name TEXT NOT NULL,              -- 實際被提到的字串（可能是別名）
    is_target BOOLEAN DEFAULT true,            -- 是否為被監測的目標品牌（Phase 3 加競品時可能 false）
    position INTEGER,                          -- 在回答中第幾個被提到（用於排名分析）
    context TEXT,                              -- 周邊上下文片段（約 100 字）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aivis_mentions_response ON aivis_mentions(response_id);
CREATE INDEX IF NOT EXISTS idx_aivis_mentions_brand_date ON aivis_mentions(brand_id, created_at DESC);

ALTER TABLE aivis_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aivis_mentions_select_own" ON aivis_mentions;
DROP POLICY IF EXISTS "aivis_mentions_insert_own" ON aivis_mentions;
DROP POLICY IF EXISTS "aivis_mentions_delete_own" ON aivis_mentions;

CREATE POLICY "aivis_mentions_select_own" ON aivis_mentions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aivis_mentions_insert_own" ON aivis_mentions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aivis_mentions_delete_own" ON aivis_mentions
    FOR DELETE USING (auth.uid() = user_id);


-- =====================================================
-- 完成。執行後可在 Supabase Table Editor 看到 3 張新表。
-- 接著 Phase 2b：寫 /api/aivis/fetch.js 串 Claude Haiku。
-- =====================================================
