# CLAUDE.md — 優勢方舟 AI 能見度儀表板

開發者 AI 助理指引文件。每次開始新對話時請先閱讀此文件。

---

## 產品定位

**產品名稱：** AI 能見度儀表板  
**公司名稱：** 優勢方舟數位行銷  
**線上網址：** https://aark-workspace.vercel.app/  
**GitHub：** https://github.com/aark-younjung/aark-workspace  

幫助品牌主與行銷人員檢測網站在 AI 搜尋引擎（ChatGPT、Perplexity、Google AI）中的「被看見程度」，提供 SEO、AEO、GEO、E-E-A-T 四大面向分析與具體修復建議。

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 樣式 | Tailwind CSS v4 |
| 路由 | React Router DOM v7 |
| 圖表 | Recharts |
| 資料庫 | Supabase (PostgreSQL + Auth) |
| 後端 | Vercel Serverless Functions（`/api/` 目錄） |
| 部署 | Vercel（push 到 main 自動部署，約 1–2 分鐘） |
| PDF 匯出 | jsPDF + html2canvas |
| 付款 | Stripe |

---

## 專案結構

```
aark-workspace/
├── api/                          # Vercel Serverless Functions
│   ├── fetch-url.js              # CORS Proxy，所有前端爬取都透過此 API
│   ├── create-checkout-session.js
│   ├── cancel-subscription.js
│   ├── stripe-webhook.js
│   ├── ga4-data.js
│   ├── gsc-data.js
│   ├── send-report-email.js
│   └── cron-weekly-reports.js    # 每週一 09:00 自動執行
├── src/
│   ├── context/
│   │   └── AuthContext.jsx       # 全域 user / isPro / userName / signOut
│   ├── lib/
│   │   └── supabase.js           # Supabase client
│   ├── pages/
│   │   ├── _legacy/              # 已下線的橘白版頁面備存（2026-04-22 起）
│   │   │   ├── Home.jsx          # 原橘白版首頁（保留備查，未被路由使用）
│   │   │   └── README.md         # 下線說明與復原步驟
│   │   ├── HomeDark.jsx          # 首頁（主視覺，深紅暗黑版）：輸入網址、觸發分析、雷達動畫
│   │   ├── Dashboard.jsx         # 儀表板：四大分數、圖表、AI 優化工具
│   │   ├── SEOAudit.jsx          # SEO 5 項詳細頁
│   │   ├── AEOAudit.jsx          # AEO 8 項詳細頁
│   │   ├── GEOAudit.jsx          # GEO 6 項詳細頁
│   │   ├── EEATAudit.jsx         # E-E-A-T 6 項詳細頁
│   │   ├── Showcase.jsx          # 排行榜 / 進步之星
│   │   ├── Compare.jsx           # 競品比較
│   │   ├── Pricing.jsx           # 定價頁
│   │   ├── FAQ.jsx               # FAQ 頁（含 FAQPage JSON-LD Schema）
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Account.jsx
│   ├── services/
│   │   ├── seoAnalyzer.js        # SEO 分析：Meta、H1、Alt、Mobile、Speed
│   │   ├── aeoAnalyzer.js        # AEO 分析：JSON-LD、FAQ Schema、OG、Canonical 等
│   │   ├── geoAnalyzer.js        # GEO 分析：llms.txt、品牌提及、結構化資料等
│   │   ├── eeatAnalyzer.js       # E-E-A-T：作者、About、Contact、隱私、Schema
│   │   ├── ga4Analyzer.js        # GA4（已串接，需用戶授權）
│   │   ├── gscAnalyzer.js        # GSC（已串接，需用戶授權）
│   │   ├── googleAuth.js         # Google OAuth for GA4/GSC
│   │   └── pdfExport.js          # PDF 報告匯出
│   ├── App.jsx                   # 路由設定
│   └── main.jsx
├── vercel.json                   # Vercel 設定 + Cron Job
├── seo-tables.sql                # Supabase 建表 SQL（參考用）
└── CLAUDE.md                     # 本文件
```

---

## 資料庫（Supabase）

**主要資料表：**

| 資料表 | 用途 |
|--------|------|
| `profiles` | 用戶資料，含 `is_pro`（布林值，Pro 方案判斷）、`marketing_consent` |
| `websites` | 被分析的網站（url, name） |
| `seo_audits` | SEO 分析結果（JSONB） |
| `aeo_audits` | AEO 分析結果（注意：Answer Engine Optimization 靜態檢測，與 aivis_ 模組是不同概念） |
| `geo_audits` | GEO 分析結果 |
| `eeat_audits` | E-E-A-T 分析結果 |
| `aivis_brands` | AI 曝光監測模組 — 使用者追蹤的品牌清單（Phase 1，2026-04-23 新增）|

**Pro 方案判斷：** `profiles.is_pro = true`（目前由 Stripe webhook 寫入，也可在 Supabase 手動切換）

**Auth：** Supabase Auth，支援 Email/Password 與 Google OAuth

---

## 路由表

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/` | HomeDark | 首頁（暗黑主視覺），輸入網址觸發分析 |
| `/dashboard/:id` | Dashboard | 儀表板，`:id` 為 website UUID |
| `/seo-audit/:id` | SEOAudit | SEO 詳細報告 |
| `/aeo-audit/:id` | AEOAudit | AEO 詳細報告 |
| `/geo-audit/:id` | GEOAudit | GEO 詳細報告 |
| `/eeat-audit/:id` | EEATAudit | E-E-A-T 詳細報告 |
| `/showcase` | Showcase | 排行榜 |
| `/compare` | Compare | 競品比較 |
| `/pricing` | Pricing | 定價 |
| `/faq` | FAQ | 常見問題 |
| `/content-audit` | ContentAudit | 文章內容分析（15 項檢測，Pro 解鎖修復建議）|
| `/ga4-report/:id` | GA4Report | GA4 詳細報告（趨勢/流量來源/熱門頁面/建議引擎）|
| `/gsc-report/:id` | GSCReport | GSC 詳細報告（趨勢/關鍵字分析/機會/建議引擎）|
| `/login` | Login | 登入 |
| `/register` | Register | 註冊 |
| `/account` | Account | 帳號設定 |

---

## UI / UX 設計規範

**主視覺：** 暗黑深紅版（HomeDark，自 2026-04-22 起為預設）  
**ThemeContext：** `isDark` 預設為 `true`；`/dark` 路由已移除、整併至 `/`  
**橘白版：** 已下線，首頁搬至 `src/pages/_legacy/Home.jsx` 備查；共用頁面（Pricing、FAQ、Dashboard 等）仍保留 `!isDark` 分支供未來切換復原

**配色主題（暗黑主視覺）：** 深紅漸層 + 黑底；其餘共用頁面沿用橘白配色資料

### 橘白版配色（備存，供日後切換回來使用）

```css
/* 背景漸層 */
background: radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%);

/* 背景點點紋路 */
backgroundImage: radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px);
backgroundSize: 28px 28px;

/* 玻璃卡片 */
bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl

/* 主要按鈕 */
bg-orange-500 hover:bg-orange-600 text-white rounded-xl

/* 強調色 */
Orange: #fb923c / #f97316
Amber: #f59e0b
```

**四大面向顏色：**
- SEO：`#3b82f6`（藍）
- AEO：`#8b5cf6`（紫）
- GEO：`#10b981`（綠）
- E-E-A-T：`#f59e0b`（琥珀）
- 內容品質：`#ec4899`（粉紅，第五分數）

**公司 Logo：** 橘色漸層方塊 + 閃電 SVG icon + 文字「優勢方舟數位行銷」

### 暗色版（HomeDark）背景漸層

**目前使用（紅色版）：**
```
linear-gradient(135deg, #a21540 0%, #6b0e2a 18%, #2a0510 32%, #0a0208 46%, #000000 60%)
```

**備用（青綠版）：**
```
linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)
```

### 雜訊（Grain）數值

**暗色版 HomeDark：**
- `baseFrequency='0.65'` `numOctaves='4'` `opacity: 0.18` `mixBlendMode: 'soft-light'`

**橘白版（所有淺色頁面）：**
- `baseFrequency='0.65'` `numOctaves='3'` `opacity: 0.25` `mixBlendMode: 'overlay'`

---

## 重要開發規則

1. **CORS：** 所有對外部網站的 fetch 必須透過 `/api/fetch-url.js`，不可從前端直接 fetch 外部網址
2. **部署：** `git push` 到 `main` 即自動部署 Vercel，無需手動操作
3. **Pro 判斷：** 使用 `useAuth()` 取得的 `isPro`，來自 `profiles.is_pro`
4. **SVG 動畫：** SVG 元素內的 pulse 動畫須用 `<animate>` 原生屬性（r、opacity），不可用 CSS scale（transform-origin 會跑位）
5. **網站分析上限：** Free=3 個、Pro=15 個（Home.jsx 的 `WEBSITE_LIMIT` 已啟用）
6. **文件同步：** 每次功能變動後，同步更新 `README.md`（版本記錄 + 方案對照表）和 `CLAUDE.md`（待開發功能、商業模式）

---

## 商業模式

| 方案 | 月費 | 功能 |
|------|------|------|
| 免費版 | $0 | 四大分析分數、各項通過/不通過清單、5 條優化建議、競品比較 2 個、文章分析基本版 |
| Pro 版 | $2,000/月 | 修復碼產生器、歷史趨勢圖、平台別修復指南、競品比較 4 個、PDF 匯出、Email 週報、文章分析完整版 |
| Agency 版 | 洽談 | 多客戶管理、白標報告 |

**網站追蹤上限：** Free = 3 個、Pro = 15 個

付款流程：Stripe Checkout → Webhook → `profiles.is_pro = true`

---

## 後臺管理系統規格書

### 路由（需 `profiles.is_admin = true`）

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/admin` | AdminDashboard | 總覽：用戶數、Pro 數、MRR、最新用戶 |
| `/admin/users` | AdminUsers | 用戶列表：搜尋、篩選、展開詳情、手動升降級 Pro |
| `/admin/websites` | AdminWebsites | 掃描紀錄：所有網站 + 四大分數 |
| `/admin/revenue` | AdminRevenue | 營收：MRR 估算、Pro 用戶列表、近 6 月增長圖 |
| `/ai-visibility` | AIVisibility | **AI 曝光監測** — 品牌列表 + 新增（aivis 模組 Phase 1） |
| `/ai-visibility/:id` | AIVisibilityDashboard | AI 曝光監測 — 單一品牌儀表板（目前為空狀態）|

### 第一階段（已完成）
- [x] 用戶管理：列表、搜尋、篩選、手動升降級 Pro、展開查看已分析網站
- [x] 掃描紀錄：所有網站列表、四大分數、所屬用戶
- [x] 營收儀表板：MRR 估算、Pro 用戶數、轉換率、近 6 月圖表

### 第二階段（待開發）
- [ ] 系統監控：API 成功率、錯誤日誌、掃描量統計
- [ ] 客服工具：補償工具（延長 Pro）、寄送自訂 Email
- [ ] Stripe 實際訂閱資料整合

### 第三階段（待開發）
- [ ] 內容管理：公告、FAQ、定價文案
- [ ] 排行榜管理：Showcase 審核與人工介入

### 認證機制
- `profiles.is_admin = true` → 允許進入後臺（需在 Supabase 手動設定）
- `AdminGuard` 組件：非管理員自動重導至首頁
- Supabase RLS 需設定 admin 可讀取全表（目前依賴 anon key，上線前需加 RLS policy）

### 資料庫需求
- `profiles` 表需加 `is_admin BOOLEAN DEFAULT false` 欄位

---

## 工作日誌

### 2026-04-25
**營收儀表板數字治理:**
- ✅ **補上 `profiles.subscribed_at` 缺失欄位**:[stripe-webhook.js:77](api/stripe-webhook.js#L77) 與 [AdminRevenue.jsx:34](src/pages/admin/AdminRevenue.jsx#L34) 都會用到,但 profiles 表沒這欄,造成查詢炸 `column not exist`(隱性 bug — 真有客戶刷卡時 webhook 也會炸)。透過 [clear-test-revenue.sql](clear-test-revenue.sql) Step 0 用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 補上。
- ✅ **AdminDashboard MRR 邏輯與 AdminRevenue 對齊**([AdminDashboard.jsx:27,40](src/pages/admin/AdminDashboard.jsx)):原本 `/admin` 總覽算 `proUsers × 1490`(含手動授予),與 `/admin/revenue`「只算實際付費」的規則不一致 — 同一個 MRR 出現兩種數字。改為查 `paidProUsers`(`is_pro=true AND stripe_subscription_id IS NOT NULL`)。
- ✅ **清掉個人帳號的 Stripe 測試訂閱資料**:`mark6465@gmail.com`(站長自己)的 profiles 還掛著 Stripe Test Mode 留下的 `stripe_subscription_id` / `stripe_customer_id`,使 MRR 假性顯示 NT$1,490。執行 `UPDATE profiles SET stripe_subscription_id=NULL, stripe_customer_id=NULL, subscribed_at=NULL WHERE email='mark6465@gmail.com'` 清除,`is_pro` 保留(站長依然是 Pro,只是不再被算進營收)。
- 📋 **新增 [clear-test-revenue.sql](clear-test-revenue.sql)**:可重複執行的維運腳本,Step 0 補欄位 / Step 1 檢查 / Step 2A 清全部 / Step 2B 清特定 email,清楚標示先檢查再清空的順序。
- 🔖 **SQL 管理慣例(待落實)**:Supabase SQL Editor 上累積了 11+ 個 tab,決議「一次性 ad-hoc 查詢跑完關 tab 不存」、「重複用的查詢才進 Saved」、「schema migration 寫成 .sql 放 repo,Supabase 跑完刪 tab」。預計把 repo 根目錄 4 份 .sql 搬到 `db/migrations/` + `db/ops/` 結構(本次未執行)。

### 2026-04-24
**Bug 修復與付費流程優化：**
- ✅ **修復新客戶分析資料無法在後台顯示**（`HomeDark.jsx:353`）：原 `websites` 查詢只用 `url` 為鍵，導致同一網址被多個用戶分析時都綁到第一位用戶的 row，新客戶的 audit 全寫進舊客戶的 website 紀錄；admin 後台 `select where user_id = newUser` 因此抓不到。改為 `url + user_id` 雙鍵查詢，每位用戶各自一筆 website row。
- ✅ **AdminGuard 未登入導向修正**（`AdminGuard.jsx`）：原本未登入直接打 `/admin` 會被靜默彈回首頁，無提示；改為未登入導向 `/login` 並帶 `from` state，登入後自動回到原本的後台路徑。已登入但非管理員才彈回首頁。
- ✅ **儀表板「升級 Pro」按鈕改先導向方案頁**（`Dashboard.jsx:153`）：原本 5 個升級按鈕直接呼叫 `/api/create-checkout-session` 跳 Stripe 結帳，對未充分了解的使用者過於突兀；改為先到 `/pricing` 看月費/年費/早鳥/功能差異後再決定是否進結帳。

**後台資料可見性與營收識別修復：**
- ✅ **新增 admin RLS 例外**（`admin-rls-policies.sql`）：profiles 啟用 RLS 後，admin 變成只能看到自己一筆。新增 `is_admin()` SECURITY DEFINER helper 與 admin 全表讀取 policy，覆蓋 profiles / websites / 4 大 audit 表。需在 Supabase SQL Editor 執行。
- ✅ **AdminWebsites 網站名稱改為可點**（`AdminWebsites.jsx`）：點擊 → `/dashboard/:id` 並 `target="_blank"` 另開新分頁，admin 可直接看任一客戶的完整分析儀表板（與前台同視圖），不離開後台清單。
- ✅ **AdminWebsites 拆分網站連結與分析按鈕**（`AdminWebsites.jsx`）：上一步把網站名稱整段吃成儀表板連結後，原本連到客戶實際網站的外部連結變得隱晦。改為：網站欄維持名稱純顯示 + 網址外部連結；新增獨立「分析」欄（col-span-1）放橘色「📊 查看」按鈕，點擊開新分頁進儀表板。Header grid 從 3+2+4+2+1 重排為 3+1+2+3+2+1。
- ✅ **AdminUsers 展開列表的網站也改為可點**（`AdminUsers.jsx`）：同樣 `target="_blank"` 開新分頁進 `/dashboard/:id`，方便 admin 從用戶層面進入個別網站分析。
- ✅ **AdminRevenue 區分「實際付費」vs「手動授予」**（`AdminRevenue.jsx`）：MRR 與轉換率改以 `stripe_subscription_id IS NOT NULL` 為準，避免手動授予 Pro 灌水營收數字；Pro 用戶列表加上 💳 付費 / ⭐ 授予 徽章；近 6 月圖表改用 `subscribed_at`（實際刷卡日）而非 `created_at`（註冊日）。
- ⚠️ **歷史資料污染未清理**：bug 修復前已綁錯的 audit 紀錄不會自動修復，後台仍可能看不到部分舊客戶的網站；如需清理需另寫 SQL 重新分配 `websites.user_id`。

### 2026-04-23
**AI 曝光監測模組（aivis）Phase 1 基礎建置：**
- ✅ 新增 SQL migration `aivis-tables.sql`：`aivis_brands` 主檔 + 使用者層級 RLS（auth.uid() = user_id）
- ✅ 新增 `src/pages/AIVisibility.jsx`：品牌列表 + 新增/刪除表單，暗黑主題
- ✅ 新增 `src/pages/AIVisibilityDashboard.jsx`：單一品牌儀表板骨架，4 個指標卡占位（品牌提及率 / 引用率 / 模型占有率 / 營收曝光落差），Phase 1 顯示空狀態
- ✅ `App.jsx` 註冊 2 條新路由：`/ai-visibility` 與 `/ai-visibility/:id`
- ✅ `Dashboard.jsx` 加入橫幅入口卡（overview Tab 底部，連往 `/ai-visibility`）
- 🔖 命名決策：統一用 `aivis_` 前綴避開既有 `aeo_audits` 命名衝突
- 🔖 Vercel 方案：維持 Hobby，Phase 3 worker 改為每 20 分鐘跑（避開 100 次/天 cron 上限）
- 🔖 中文產品名：**AI 曝光監測**（側邊欄、標題、行銷文案統一用此名）
- ⏳ Phase 2 待辦：`aivis_prompts/responses/mentions` 三表、`/api/aivis/fetch` 手動觸發 Claude Haiku 單 prompt 抓取
- ⏳ 執行前置：使用者需辦 Anthropic 帳號並儲值 USD $10，在 Vercel 設定 `ANTHROPIC_API_KEY` 環境變數

### 2026-04-22
**暗黑版升格為主視覺：**
- ✅ `ThemeContext` 預設 `isDark: true`（sessionStorage 無值時預設暗黑）
- ✅ `App.jsx` 路由：`/` 指向 `HomeDark`，`/dark` 路由移除
- ✅ 原 `Home.jsx`（橘白版首頁）搬至 `src/pages/_legacy/Home.jsx`，並附 README 說明復原步驟
- ✅ 全庫 `to={isDark ? "/dark" : "/"}` 全部收斂為 `to="/"`（Compare/ContentAudit/Dashboard/Login/FAQ/Register/Pricing/Showcase）
- ✅ `HomeDark.jsx` 內部 `state: { from: '/dark' }` 改為 `{ from: '/' }`
- ⚠️ 共用頁面 `!isDark` 橘白分支保留，以便日後切換回橘白版（無需重寫）

### 2026-04-19
**Dashboard 儀表板強化（參考競品分析報告借鏡）：**
- ✅ SEO 雷達圖加入第二條虛線「建議目標」（綠色），與現況對比
- ✅ 優化建議卡片加入 P1／P2／P3 優先級標籤（紅/橘/綠色）
- ✅ 四大分數卡加入白話判定語（如「目前幾乎不會被 AI 引用」）
- ✅ 新增第五張分數卡「📝 內容品質」（粉紅色，`#ec4899`），Dashboard 載入時自動對首頁跑 `analyzeContent`，無需改資料庫
- ✅ 新增「被 AI 引用的關鍵條件」checklist（8 項，含通過/未通過狀態與計數）

**視覺調整：**
- ✅ 橘白版所有頁面雜訊調整：`baseFrequency 0.65`、`overlay`、`opacity 0.25`（修正灰色偏色問題）
- ✅ 暗色版雜訊調整：`baseFrequency 0.65`、`numOctaves 4`、`soft-light`、`opacity 0.18`（接近 Lightspark 質感）
- ✅ HomeDark 背景漸層實驗青綠版（`#18c590`），最終保留紅色版

---

## 待開發 / 未完成功能

- ~~`/content-audit`~~：✅ 已完成。15 項檢測（內容結構/字數/Meta/AEO/E-E-A-T/可讀性），免費看分數+清單，Pro 解鎖修復建議
- ~~`/ga4-report/:id`~~：✅ 已完成。GA4 詳細報告（KPI 卡片、健康指標條、5 分頁 Tabs、建議引擎）
- ~~`/gsc-report/:id`~~：✅ 已完成。GSC 詳細報告（KPI 卡片、健康指標條、5 分頁 Tabs、機會關鍵字、建議引擎）
- `/crawl-check`：爬蟲可達性專項檢測頁（含終端機日誌動畫），對標 washinmura.jp
- Agency 方案升級流程
- n8n 自動化排程（設計已完成，待串接）
- 每週報告 Email（`/api/cron-weekly-reports.js` 已建，每週一 09:00）
