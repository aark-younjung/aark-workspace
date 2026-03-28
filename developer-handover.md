# 優勢方舟 AI 能見度儀表板 - 開發交接文件

**交接日期：** 2026-03-26
**最後更新：** 2026-03-27
**接手開發者：** Claudia
**原始開發者：** 貞貞 / 素子

---

## 📋 專案概述

### 產品定位
全方位數位能見度健檢儀表板 (SEO + AEO + GEO Scanner)，幫助業主檢測網站的傳統 SEO、Answer Engine 優化 (AEO) 與 Generative Engine 優化 (GEO)。

### 三大模組定義
| 模組 | 全名 | 定義 |
|------|------|------|
| SEO | Search Engine Optimization | 傳統搜尋引擎技術優化 |
| AEO | Answer Engine Optimization | 針對 Google 精選摘要、問答式搜尋的優化 |
| GEO | Generative Engine Optimization | 針對 ChatGPT、Perplexity、Gemini 等生成式 AI 引用的優化 |

### 商業模式
- **免費版 (Freemium)**：導流換名單基本檢測
- **專業版 ($2,000/月)**：完整檢測、競爭對比、優化建議報告、推播通知

### 線上網站
- **網址：** https://aark-dashboard.vercel.app/
- **GitHub：** https://github.com/aark-younjung/aark-workspace

---

## 🏗️ 技術架構

### 前端
- **框架：** React + Vite
- **圖表：** Recharts
- **樣式：** Tailwind CSS
- **路由：** React Router DOM

### 後端
- **主機：** Vercel (Serverless Functions)
- **資料庫：** Supabase (PostgreSQL)
- **自動化：** n8n (設計已完成，待串接)

### 第三方服務
| 服務 | 用途 | 狀態 |
|------|------|------|
| Vercel | 網站托管 | ✅ 已上線 |
| Supabase | 資料庫 | ✅ 已上線 |
| GitHub | 程式碼管理 | ✅ 已上線 |
| n8n | 自動化排程 | 📋 設計已完成 |

---

## 📁 專案結構

```
aark-workspace/
├── api/
│   └── fetch-url.js          # Vercel Serverless API (解決 CORS 問題)
├── public/
├── src/
│   ├── lib/
│   │   └── supabase.js       # Supabase 客戶端設定
│   ├── pages/
│   │   ├── Home.jsx          # 首頁（輸入網址、觸發三模組分析）
│   │   ├── Dashboard.jsx     # 儀表板（SEO + AEO + GEO 總覽）
│   │   └── AEOAudit.jsx      # AEO 詳細檢測頁面
│   ├── services/
│   │   ├── seoAnalyzer.js    # SEO 分析服務（5 項基礎檢測）
│   │   ├── aeoAnalyzer.js    # AEO 分析服務（8 項 Answer Engine 指標）
│   │   ├── geoAnalyzer.js    # GEO 分析服務（8 項 Generative Engine 指標）
│   │   ├── ga4Analyzer.js    # GA4 分析服務（待實作）
│   │   ├── gscAnalyzer.js    # GSC 分析服務（待實作）
│   │   └── googleAuth.js     # Google 授權（待實作）
│   ├── App.jsx               # 主應用程式
│   └── main.jsx              # 進入點
├── vercel.json               # Vercel 設定
├── package.json              # 專案依賴
└── vite.config.js            # Vite 設定
```

---

## 🔍 各模組檢測項目

### AEO（Answer Engine — 傳統 Google 問答）
| # | 欄位名稱 | 說明 |
|---|---------|------|
| 1 | json_ld | JSON-LD 結構化資料（schema.org，特別是 FAQ/HowTo） |
| 2 | faq_schema | FAQ Schema（FAQPage 或 QAPage 類型） |
| 3 | canonical | Canonical 標籤（防止重複內容影響精選摘要） |
| 4 | breadcrumbs | 麵包屑導航（BreadcrumbList schema） |
| 5 | open_graph | Open Graph（影響 Google 搜尋預覽） |
| 6 | question_headings | H2/H3 問句式標題（標題是否以問句呈現） |
| 7 | meta_desc_length | Meta 描述長度（120-160 字元） |
| 8 | structured_answer | 結構化答案段落（首段是否有清楚的問答格式） |

### GEO（Generative Engine — 生成式 AI 引用）
| # | 欄位名稱 | 說明 |
|---|---------|------|
| 1 | llms_txt | llms.txt（AI 爬蟲說明文件） |
| 2 | robots_ai | robots.txt AI 開放性（是否允許 GPTBot、PerplexityBot、Google-Extended） |
| 3 | sitemap | Sitemap（幫助 AI 爬蟲探索頁面） |
| 4 | open_graph | Open Graph（AI 引用時的社群標籤信號） |
| 5 | twitter_card | Twitter Card（AI 摘要中的社群信號） |
| 6 | json_ld_citation | JSON-LD 引用信號（author、publisher、datePublished 等可信度資訊） |
| 7 | canonical | Canonical（告訴 AI 正確的引用來源 URL） |
| 8 | https | HTTPS（安全連線，AI 偏好可信來源） |

---

## 🗄️ Supabase 資料表結構

### websites
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| url | TEXT | 網址 |
| name | TEXT | 網站名稱（hostname） |
| created_at | TIMESTAMPTZ | 建立時間 |

### seo_audits
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| website_id | UUID | 關聯 websites |
| score | INTEGER | 總分 (0-100) |
| meta_tags | JSONB | Meta 標籤檢測結果 |
| h1_structure | JSONB | H1 結構檢測結果 |
| alt_tags | JSONB | 圖片 Alt 檢測結果 |
| mobile_compatible | JSONB | 行動裝置相容性 |
| page_speed | JSONB | 頁面速度 |
| created_at | TIMESTAMPTZ | 建立時間 |

### aeo_audits
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| website_id | UUID | 關聯 websites |
| score | INTEGER | 總分 (0-100) |
| json_ld | BOOLEAN | JSON-LD 結構化資料 |
| faq_schema | BOOLEAN | FAQ Schema *(2026-03-27 新增)* |
| canonical | BOOLEAN | Canonical 標籤 |
| breadcrumbs | BOOLEAN | 麵包屑導航 |
| open_graph | BOOLEAN | Open Graph |
| question_headings | BOOLEAN | 問句式標題 *(2026-03-27 新增)* |
| llms_txt | BOOLEAN | *(保留舊資料，顯示邏輯已移至 GEO)* |
| robots_txt | BOOLEAN | *(保留舊資料，顯示邏輯已移至 GEO)* |
| sitemap | BOOLEAN | *(保留舊資料，顯示邏輯已移至 GEO)* |
| twitter_card | BOOLEAN | *(保留舊資料，顯示邏輯已移至 GEO)* |
| created_at | TIMESTAMPTZ | 建立時間 |

### geo_audits *(2026-03-27 新增)*
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UUID | 主鍵 |
| website_id | UUID | 關聯 websites |
| score | INTEGER | 總分 (0-100) |
| llms_txt | BOOLEAN | llms.txt 存在 |
| robots_ai | BOOLEAN | AI 爬蟲未被封鎖 |
| sitemap | BOOLEAN | Sitemap 存在 |
| open_graph | BOOLEAN | Open Graph 標籤 |
| twitter_card | BOOLEAN | Twitter Card 標籤 |
| json_ld_citation | BOOLEAN | JSON-LD 引用信號（author/publisher/datePublished） |
| canonical | BOOLEAN | Canonical 標籤 |
| https | BOOLEAN | HTTPS 安全連線 |
| created_at | TIMESTAMPTZ | 建立時間 |

---

## ✅ 目前進度

### Phase 1: 基礎建設（已完成）

| 功能 | 狀態 | 說明 |
|------|------|------|
| React 前端骨架 | ✅ | Home, Dashboard, AEOAudit 頁面 |
| Supabase 資料庫 | ✅ | websites, seo_audits, aeo_audits, geo_audits 資料表 |
| Serverless API | ✅ | /api/fetch-url 解決 CORS 問題 |
| 錯誤處理機制 | ✅ | 分析失敗時的 fallback 機制 |

### Phase 2: SEO 模組（部分完成）

| 功能 | 狀態 | 說明 |
|------|------|------|
| SEO 基礎 5 項檢測 | ⚠️ | 已實作，部分網站因 Cloudflare / SSL 問題可能抓取失敗 |
| 網站速度檢測 | ⚠️ | 已實作 |

### Phase 3: AEO 模組（已完成）

| 功能 | 狀態 | 說明 |
|------|------|------|
| AEO 8 項 Answer Engine 檢測 | ✅ | JSON-LD, FAQ Schema, Canonical, Breadcrumbs, Open Graph, 問句標題, Meta 描述長度, 結構化答案 |
| AEO 詳細檢測頁面 | ✅ | /aeo-audit/:id |
| AEO 優化建議工具 | ✅ | llms.txt 產生器、JSON-LD 產生器、FAQ Schema 產生器 |

### Phase 4: GEO 模組（已完成）

| 功能 | 狀態 | 說明 |
|------|------|------|
| GEO 8 項 Generative Engine 檢測 | ✅ | llms.txt, robots.txt AI 開放性, Sitemap, Open Graph, Twitter Card, JSON-LD 引用信號, Canonical, HTTPS |
| GEO 結果顯示於 Dashboard | ✅ | 顯示在詳細檢測區塊底部 |

### Phase 2.5: Google 數據整合（待開發）

| 功能 | 狀態 |
|------|------|
| Google OAuth 2.0 授權 | ❌ |
| GSC API 串接 | ❌ |
| GA4 Data API 串接 | ❌ |

### Phase 5: 公開目錄與社群功能（待開發）

參考對標：https://aeo.washinmura.jp/

首頁新增公開展示區，讓訪客可以看到其他網站的 AI 能見度分數，形成社群效應並增加工具說服力。

#### 5-1 🌟 進步之星
| 項目 | 說明 |
|------|------|
| 觸發條件 | 同一網站有 ≥ 2 次掃描，且最新分數 > 首次分數 |
| 顯示欄位 | 網站名稱、首次總分 → 最新總分、進步幅度（+N 分）、掃描次數 |
| 排序 | 進步幅度由大到小，顯示前 5 名 |
| 更新頻率 | 每次分析完成後觸發重新計算 |
| 自動輪播 | 每 8 秒切換（參考 washinmura.jp） |

**所需 Supabase 查詢：**
```sql
-- 找出同網站最大進步幅度
SELECT w.name, w.url,
  MIN(combined_score) AS first_score,
  MAX(combined_score) AS best_score,
  MAX(combined_score) - MIN(combined_score) AS improvement,
  COUNT(*) AS scan_count
FROM websites w
JOIN (
  SELECT website_id,
    ROUND((COALESCE(s.score,0) + COALESCE(a.score,0) + COALESCE(g.score,0)) / 3.0) AS combined_score
  FROM seo_audits s
  JOIN aeo_audits a USING (website_id)
  JOIN geo_audits g USING (website_id)
) scores ON scores.website_id = w.id
GROUP BY w.id, w.name, w.url
HAVING COUNT(*) >= 2 AND MAX(combined_score) > MIN(combined_score)
ORDER BY improvement DESC
LIMIT 5;
```

#### 5-2 🏆 排行榜
三個 Tab 切換：

**Tab A：總分 TOP 10**
| 欄位 | 說明 |
|------|------|
| 排名 | 1-10 |
| 網站名稱 | hostname |
| 總分 | (SEO + AEO + GEO) / 3，圓餅圖或進度條 |
| 最後掃描時間 | N 天前 |
| 分數著色 | ≥70 綠色、40-69 黃色、<40 紅色 |

**Tab B：最近更新**
| 欄位 | 說明 |
|------|------|
| 排名 | 依時間排序 |
| 網站名稱 | hostname |
| 最後掃描時間 | 顯示幾分鐘/小時/天前 |
| 總分 | 最新一次綜合分數 |

**Tab C：最多掃描**
| 欄位 | 說明 |
|------|------|
| 排名 | 依掃描次數排序 |
| 網站名稱 | hostname |
| 掃描次數 | 歷史累計掃描總數 |
| 平均分數 | 所有掃描的平均綜合分數 |

#### 5-3 📖 成功案例
| 項目 | 說明 |
|------|------|
| 資料來源 | 從進步之星中篩選進步幅度 ≥ 20 分的網站 |
| 卡片格式 | 橫向捲動（overflow-x: scroll） |
| 卡片內容 | 網站名稱、首次分數 → 最新分數、進步幅度、通過的 AEO/GEO 項目清單 |
| 展示數量 | 最多 6 張卡片 |

每張卡片範例：
```
[網站名稱]
首次：35 分 → 現在：72 分  (+37 分) 🎉
通過項目：✅ JSON-LD  ✅ HTTPS  ✅ Open Graph
          ✅ Sitemap  ✅ Canonical
```

#### 5-4 全部網站完整目錄
| 項目 | 說明 |
|------|------|
| 每頁顯示 | 20 筆 |
| 排序 | 預設依總分由高到低 |
| 可切換排序 | 總分 / 最近更新 / 掃描次數 |
| 欄位 | 排名、網站名稱、SEO 分、AEO 分、GEO 分、總分、最後掃描 |
| 分數著色 | ≥70 綠色、40-69 黃色、<40 紅色 |
| 分頁導航 | 上一頁 / 頁碼 / 下一頁 |
| 顯示說明 | 「目前展示 20 筆 · 共 X 筆」 |

#### 5-5 資料庫變更需求

**新增 Supabase View（或 RPC）：**
```sql
-- 建立公開目錄 View（每個網站的最新綜合分數）
CREATE OR REPLACE VIEW public_directory AS
SELECT
  w.id,
  w.name,
  w.url,
  w.created_at,
  COALESCE(s.score, 0) AS seo_score,
  COALESCE(a.score, 0) AS aeo_score,
  COALESCE(g.score, 0) AS geo_score,
  ROUND((COALESCE(s.score,0) + COALESCE(a.score,0) + COALESCE(g.score,0)) / 3.0) AS total_score,
  GREATEST(s.created_at, a.created_at, g.created_at) AS last_scanned_at
FROM websites w
LEFT JOIN LATERAL (
  SELECT score, created_at FROM seo_audits
  WHERE website_id = w.id ORDER BY created_at DESC LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT score, created_at FROM aeo_audits
  WHERE website_id = w.id ORDER BY created_at DESC LIMIT 1
) a ON true
LEFT JOIN LATERAL (
  SELECT score, created_at FROM geo_audits
  WHERE website_id = w.id ORDER BY created_at DESC LIMIT 1
) g ON true;
```

#### 5-6 前端元件規劃
| 元件 | 路由/位置 | 說明 |
|------|------|------|
| `Showcase.jsx` | `/showcase` 或首頁下半段 | 包含全部 4 個區塊 |
| `ProgressStars.jsx` | Showcase 子元件 | 進步之星輪播 |
| `Leaderboard.jsx` | Showcase 子元件 | 三 Tab 排行榜 |
| `SuccessStories.jsx` | Showcase 子元件 | 成功案例橫向捲動 |
| `DirectoryTable.jsx` | Showcase 子元件 | 分頁目錄表格 |

#### 5-7 與 washinmura.jp 的差異
| 功能 | washinmura.jp | 我們的版本 |
|------|------|------|
| 分類系統 | 商家類型（餐廳/旅宿/景點） | 暫無分類，Phase 6 可加 |
| AI 爬蟲造訪統計 | 有（需 log 分析） | 無（改用掃描次數） |
| Verified 徽章 | 有 | 暫無 |
| 展示上限 | 100 筆 | 20 筆/頁（無限分頁） |
| 更新頻率 | 60 秒輪詢 | 頁面載入時查詢 |

### Phase 6: 商業化（待開發）

| 功能 | 狀態 |
|------|------|
| 會員系統（註冊/登入） | ❌ |
| Stripe 金流串接 | ❌ |
| 訂閱管理系統 | ❌ |
| PDF 報告生成 | ❌ |
| LINE/Email 推播 | ❌ |
| 競品比較分析 | ❌ |
| 網站分類標籤 | ❌ |

---

## 🎯 後續開發重點

### 優先順序 1：修復問題
1. **網站抓取穩定性** - 部分網站因 Cloudflare 或 SSL 問題無法抓取，導致 SEO/AEO 分數為 0
2. **本地開發環境** - `npm run dev` 無法執行 Serverless Functions，需用 `vercel dev` 或直接測試線上版

### 優先順序 2：公開目錄（Phase 5）
1. **建立 Supabase View** - `public_directory` 查詢最新綜合分數
2. **建立 Showcase.jsx** - 首頁公開目錄頁面
3. **進步之星元件** - `ProgressStars.jsx`，8 秒輪播
4. **排行榜元件** - `Leaderboard.jsx`，三 Tab
5. **成功案例元件** - `SuccessStories.jsx`，橫向捲動
6. **目錄表格元件** - `DirectoryTable.jsx`，20 筆分頁

### 優先順序 3：商業化（Phase 6）
1. **Stripe 串接** - 訂閱收費
2. **PDF 報告** - 匯出功能
3. **推播通知** - LINE/Email

---

## 🔧 開發環境設定

### 1. Clone 專案
```bash
git clone https://github.com/aark-younjung/aark-workspace.git
cd aark-workspace
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 設定環境變數
建立 `.env` 檔案：
```env
VITE_SUPABASE_URL=https://mekmvytdzxmwjvpnmike.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1la212eXRkenhtd2p2cG5taWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTQ1ODcsImV4cCI6MjA4OTQ5MDU4N30.aH8PfQ7LqCoICU2sLJ-Vm6cwG9Cf2F71bWZV4D7RHdA
```

### 4. 啟動開發伺服器
```bash
npm run dev
```
⚠️ 注意：本地端的 `/api/fetch-url` Serverless Function 不會執行，SEO/AEO 分析會失敗（GEO 部分項目仍可運作）。建議直接測試線上版或使用 `vercel dev`。

### 5. 部署到 Vercel
推送到 GitHub main branch，Vercel 會自動部署。

---

## 📞 技術文件

### 環境變數（Vercel 後台）
```
VITE_SUPABASE_URL = https://mekmvytdzxmwjvpnmike.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1la212eXRkenhtd2p2cG5taWtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTQ1ODcsImV4cCI6MjA4OTQ5MDU4N30.aH8PfQ7LqCoICU2sLJ-Vm6cwG9Cf2F71bWZV4D7RHdA
```

### 團隊成員
| 角色 | 名稱 | 擅長 |
|------|------|------|
| 專案經理 | 貞貞 | 溝通協調 |
| 前端工程師 | 素子 | React, Vite, Tailwind |
| n8n 自動化 | 小愛 | 自動化流程 |
| AI 開發 | Claudia | 功能開發與維護 |

---

## 📝 參考資源

- **線上網站：** https://aark-dashboard.vercel.app/
- **參考對標：** https://aeo.washinmura.jp/

---

*最後更新：2026-03-28*
