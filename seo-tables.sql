-- =====================================================
-- SEO 檢測資料庫 - SQL 建表語法
-- 請在 Supabase SQL Editor 中執行
-- =====================================================

-- 1. 網站資料表
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SEO 審計資料表
CREATE TABLE IF NOT EXISTS seo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    meta_tags JSONB DEFAULT '{}'::jsonb,
    h1_structure JSONB DEFAULT '{}'::jsonb,
    alt_tags JSONB DEFAULT '{}'::jsonb,
    mobile_compatible BOOLEAN DEFAULT false,
    page_speed JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AEO 審計資料表
CREATE TABLE IF NOT EXISTS aeo_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    json_ld BOOLEAN DEFAULT false,
    llms_txt BOOLEAN DEFAULT false,
    open_graph BOOLEAN DEFAULT false,
    twitter_card BOOLEAN DEFAULT false,
    canonical BOOLEAN DEFAULT false,
    breadcrumbs BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. GEO 商家資料表
CREATE TABLE IF NOT EXISTS geo_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    business_name TEXT,
    rating DECIMAL(2,1),
    reviews_count INTEGER,
    address TEXT,
    phone TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 啟用 Row Level Security (RLS)
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE aeo_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_data ENABLE ROW LEVEL SECURITY;

-- 允許所有操作
CREATE POLICY "Allow all for websites" ON websites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for seo_audits" ON seo_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for aeo_audits" ON aeo_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for geo_data" ON geo_data FOR ALL USING (true) WITH CHECK (true);

-- 插入測試網站
INSERT INTO websites (url, name) VALUES 
    ('https://example.com', 'Example'),
    ('https://google.com', 'Google')
ON CONFLICT (url) DO NOTHING;

-- 插入測試 SEO 審計數據
INSERT INTO seo_audits (website_id, score, meta_tags, h1_structure, alt_tags, mobile_compatible, page_speed)
SELECT 
    w.id,
    75,
    '{"hasTitle": true, "hasDescription": true, "hasKeywords": false, "titleContent": "Example", "descriptionContent": "This is an example", "score": 66}'::jsonb,
    '{"hasH1": true, "hasOnlyOneH1": true, "h1Count": 1, "score": 100}'::jsonb,
    '{"totalImages": 10, "imagesWithAlt": 8, "imagesWithEmptyAlt": 2, "imagesWithoutAlt": 0, "altCoverage": 80, "score": 80, "passed": true}'::jsonb,
    true,
    '{"loadTime": 1200, "speedGrade": "良好", "score": 80, "passed": true}'::jsonb
FROM websites w
WHERE w.url = 'https://example.com'
ON CONFLICT DO NOTHING;
