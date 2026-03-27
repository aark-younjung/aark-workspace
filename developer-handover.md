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

### Phase 2.5: Google 數據整合（待開發）【付費功能】

| 功能 | 狀態 | 方案 |
|------|------|------|
| Google OAuth 2.0 授權 | ❌ | 專業版 |
| GSC API 串接（關鍵字排名、曝光、點擊） | ❌ | 專業版 |
| GA4 Data API 串接（流量、跳出率） | ❌ | 專業版 |

### Phase 5: 內容智能分析（待開發）【付費功能】

> 靈感來源：Content Evo 研究報告方法論（2026-03-27）
> 目標：讓儀表板不只給分數，而是像專業 SEO 顧問一樣給出可執行的改善建議

| 功能 | 狀態 | 方案 | 說明 |
|------|------|------|------|
| **H2 結構分析** | ❌ | 免費 | 檢測頁面是否有 H2/H3，以及數量統計 |
| **競品內容比較** | ❌ | 專業版 | 輸入最多 3 個競品網址，比較 AEO/GEO/內容結構差距 |
| **Content Gap 分析表** | ❌ | 專業版 | 自動產出「我們有/競品有/我們沒有」的差距對照表 |
| **關鍵字排名追蹤** | ❌ | 專業版 | 串接 GSC，顯示每個關鍵字的排名、曝光、CTR |
| **優化建議詳細版** | ❌ | 專業版 | 每項未通過的檢測附上具體修復範例（含範例文字/程式碼） |
| **ROI 試算器** | ❌ | 專業版 | 根據網站現況自動試算導入優化後的預期效益 |
| **AI 健檢完整報告 PDF** | ❌ | 專業版 | 自動產出類似 Content Evo 研究報告格式的完整 PDF |
| **歷史趨勢比較** | ❌ | 專業版 | 追蹤每次掃描的分數變化，顯示優化進度 |

### Phase 6: 商業化基礎設施（待開發）

| 功能 | 狀態 |
|------|------|
| 會員系統（註冊/登入） | ❌ |
| Stripe 金流串接 | ❌ |
| 訂閱管理系統（免費版 / 專業版） | ❌ |
| LINE/Email 推播通知 | ❌ |

---

## 💰 商業模式規格

### 免費版（Freemium）
- SEO 基礎 5 項檢測
- AEO 8 項檢測（無詳細建議）
- GEO 8 項檢測（無詳細建議）
- H2 結構計數
- 每個網址每月可掃描 3 次

### 專業版（$2,000/月）
- 以上所有免費功能（無掃描次數限制）
- GSC + GA4 數據整合
- 優化建議詳細版（含修復範例）
- 競品內容比較（最多 3 個競品）
- Content Gap 分析表
- 關鍵字排名追蹤
- ROI 試算器
- AI 健檢完整報告 PDF 匯出
- 歷史趨勢圖表
- LINE/Email 推播（分數下降時通知）

---

## 🎯 後續開發重點

### 優先順序 1：修復問題
1. **網站抓取穩定性** - 部分網站因 Cloudflare 或 SSL 問題無法抓取，導致 SEO/AEO 分數為 0
2. **本地開發環境** - `npm run dev` 無法執行 Serverless Functions，需用 `vercel dev` 或直接測試線上版

### 優先順序 2：強化免費版體驗
1. **GEO 詳細頁面** - 仿照 AEOAudit.jsx 建立 GEOAudit.jsx
2. **H2 結構計數** - 在 SEO 或 AEO 中加入「頁面是否有 H2」的基礎檢測
3. **優化建議升級** - 每項未通過項目附上更具體的修復範例文字

### 優先順序 3：付費功能開發
1. **會員系統** - 註冊/登入，作為所有付費功能的基礎
2. **Stripe 金流** - 訂閱收費
3. **競品比較功能** - 最高轉換價值的付費功能
4. **PDF 報告產出** - 完整健檢報告，參考 Content Evo 研究報告格式
5. **GSC/GA4 串接** - 關鍵字排名與流量數據

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

*最後更新：2026-03-27（新增 Phase 5 內容智能分析付費功能規格）*
