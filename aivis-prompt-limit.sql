-- =====================================================
-- AI 曝光監測 — 每個品牌最多 10 條 prompts 限制
-- 用 trigger 強制檢查（CHECK constraint 不允許子查詢）
-- 可重複執行
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_aivis_prompt_limit()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM aivis_prompts WHERE brand_id = NEW.brand_id;
  IF cnt >= 10 THEN
    RAISE EXCEPTION '每個品牌最多 10 條 prompts（目前已 % 條）', cnt
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aivis_prompts_limit_check ON aivis_prompts;
CREATE TRIGGER aivis_prompts_limit_check
BEFORE INSERT ON aivis_prompts
FOR EACH ROW EXECUTE FUNCTION enforce_aivis_prompt_limit();

-- =====================================================
-- 完成。INSERT 第 11 條時會炸 check_violation 錯誤。
-- =====================================================
