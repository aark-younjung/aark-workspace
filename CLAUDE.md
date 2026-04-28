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
| Pro 版 | 月費 NT$1,490／年費 NT$14,900（呈現為 NT$1,242/月，省 NT$2,980） | 修復碼產生器、歷史趨勢圖、平台別修復指南、競品比較 4 個、PDF 匯出、Email 週報、文章分析完整版 |
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

### 2026-04-28
**AEO / GEO / EEAT / Content 四頁頂部分數區重構為 SEO 同款 ScoreHero（視覺最終統一）:**
- ✅ **抽出共用 [src/components/v2/AuditHero.jsx](src/components/v2/AuditHero.jsx)**：把 SEOAudit 內聯的「頂部麵包屑列 + 分數總覽 Hero」抽成獨立元件供四頁共用。`AuditTopBar`（返回 dashboard pill 麵包屑 + 重新檢測 + 匯出 PDF 漸層按鈕，吃 `accent`/`accent2` 雙色）/ `ScoreHero`（face chip + subChip + tagline + 150px ScoreCircle SVG + 7 日趨勢 Sparkline + 已通過/需修復兩格） / `HeroSkeleton`（載入骨架）三個 named export。內部 helpers：`ScoreCircle`、`Sparkline`。barrel export 加進 [src/components/v2/index.js](src/components/v2/index.js)。
- ✅ **[src/pages/AEOAudit.jsx](src/pages/AEOAudit.jsx) 套用**：補 `recentAudits` state + 從 `aeo_audits` 拉近 7 筆給 7 日趨勢用。`face="AEO"`、`subChip="技術檢測"`、`tagline="Answer Engine Optimization — 讓內容適合 Google 精選摘要與問答框"`、`accent={T.aeo}`、`accent2={AEO_ACCENT2}`。容器寬度從 `max-w-7xl mx-auto px-6` 換成 inline `maxWidth: 1180`，與 SEO 完全對齊。
- ✅ **[src/pages/GEOAudit.jsx](src/pages/GEOAudit.jsx) 套用**：同模式，`face="GEO"`、`tagline="Generative Engine Optimization — 生成式 AI 引用優化"`、`accent={T.geo}`、`accent2={GEO_ACCENT2}`，從 `geo_audits` 拉 7 筆 trend。
- ✅ **[src/pages/EEATAudit.jsx](src/pages/EEATAudit.jsx) 套用**：`face="E-E-A-T"`、`subChip="可信度檢測"`、`tagline="Experience · Expertise · Authoritativeness · Trustworthiness — Google 評估網站可信度的四維度"`、`accent={T.eeat}`、`accent2={T.orange}`，從 `eeat_audits` 拉 trend。
- ✅ **[src/pages/ContentAudit.jsx](src/pages/ContentAudit.jsx) 套用 ScoreHero（不含 AuditTopBar）**：因 ContentAudit 走「輸入網址 → 即時分析」流程沒 websiteId、也無歷史紀錄，AuditTopBar 麵包屑不適用，故只用 `<ScoreHero face="內容品質" subChip="文章分析" tagline={result.url} accent={CONTENT_ACCENT} recentAudits={[]} />`。順手刪除舊 `ScoreRing` 元件、`CATEGORIES` 常數與 `categoryCounts` 邏輯（被 ScoreHero 的「已通過/需修復」兩格取代）。
- 🔖 **取捨：ContentAudit 不接 AuditTopBar**：四頁都是 `/face-audit/:id` 路由 → 麵包屑回 `/dashboard/:id` 合理；唯獨 ContentAudit 是 `/content-audit` 跑 ad-hoc URL → 沒有「上一層 dashboard」可回，PDF 匯出也不在這頁的傳統。寧可少一塊也不要塞語意不對的元件。
- 🔖 **取捨：Sparkline 漸層 ID 加 prefix `audit-spark-grad-`**：避免與 SEOAudit 內聯 Sparkline 的 ID 撞名（SEOAudit 那份還沒抽，先共存）。將來 SEOAudit 也轉用共用元件後可以一起 dedupe。

### 2026-04-28
**IssueBoard 看板套用到 AEO / GEO / EEAT / Content 四頁（與 SEO 視覺風格統一）:**
- ✅ **抽出共用 [src/components/v2/IssueBoard.jsx](src/components/v2/IssueBoard.jsx)**：把原本 SEOAudit 內聯的 4 欄看板（P1/P2/P3/OK）獨立成 ~280 行元件，吃 `accent` + `accentGlow` props 做面向別配色，CSS class 從 `.seo-issue-board` 改名為 `.v2-issue-board`、動畫 `seo-fix-panel`/`fadeUp` 改名為 `v2-issue-fix-panel`/`v2FadeUp`。export 預設 `IssueBoard` + named `IssueBoardSkeleton`。barrel export 加進 [src/components/v2/index.js](src/components/v2/index.js)。
- ✅ **AEO 8 項打 priority + 套 IssueBoard**：[src/pages/AEOAudit.jsx](src/pages/AEOAudit.jsx) 移除舊 FixGuide import，AEO_CHECKS 加 `priority` 欄位（json_ld/faq_schema/canonical=P1、open_graph/question_headings/meta_desc_length=P2、breadcrumbs/structured_answer=P3）。把 2-col GlassCard grid 換成 `<IssueBoard checks={checks} isPro accent={T.aeo} accentGlow={`${T.aeo}28`} />`，Skeleton 用於 audit 載入中狀態。
- ✅ **GEO 8 項打 priority + 套 IssueBoard**：[src/pages/GEOAudit.jsx](src/pages/GEOAudit.jsx) 補 `useAuth` import 拿 isPro，GEO_CHECKS 加 `priority`（llms_txt/robots_ai/canonical/https=P1、sitemap/open_graph/json_ld_citation=P2、twitter_card=P3）。同樣 `accent={T.geo}`。
- ✅ **EEAT 8 項打 priority + 套 IssueBoard**：[src/pages/EEATAudit.jsx](src/pages/EEATAudit.jsx) 移除 FixGuide import，EEAT_CHECKS 加 `priority`（author_info/about_page/contact_page=P1、privacy_policy/organization_schema/date_published=P2、social_links/outbound_links=P3）。`accent={T.eeat}`。
- ✅ **ContentAudit 15 項打 priority + 套 IssueBoard**：[src/pages/ContentAudit.jsx](src/pages/ContentAudit.jsx) CHECKS 全部加 `priority` 欄位（h1/wordcount/directanswer/title/desc/articleschema=P1、h2/question/faqschema/author/date/alttext/readability=P2、ogimage/internallinks=P3）。把舊「分類 Tab + 檢測清單 + 優先改善項目」三段砍掉，換成單一 `<IssueBoard accent="#ec4899" accentGlow="#ec489928" />`（粉紅，與 Dashboard 第五分數一致）。`max-w-4xl` → `max-w-7xl` 容納 4 欄。移除 `activeCategory` state、`visibleChecks` 邏輯、`Link` import、`IssueBoardSkeleton` import（loading 走獨立 spinner）。
- 🔖 **資料形狀映射策略**：IssueBoard 預期 `{ id, name, icon, priority, passed, detail, recommendation }`。各頁 checks 形狀略不同 — AEO/GEO/EEAT 用靜態 `description`（一律當 detail），ContentAudit 用 `detail(result)` runtime 函式。映射在元件內 `result` 可用後做。
- 🔖 **priority 分配判斷**：基礎/識別類（H1、字數、Title/Desc、Article Schema、JSON-LD、作者頁、HTTPS、canonical）= P1；結構性改善（H2、問句、FAQ Schema、OG、發布日期、Alt、可讀性）= P2；錦上添花（OG image、內部連結、社群連結、breadcrumbs）= P3。

### 2026-04-28
**SEOAudit v3 IssueBoard 看板整合 + 五頁檢測頁統一外殼（SEO / AEO / GEO / EEAT / Content）:**
- ✅ **[src/pages/SEOAudit.jsx](src/pages/SEOAudit.jsx) 詳細檢測項目改為 4 欄看板**：把原本 6 張 `<CheckCard>` 平面 grid 改寫為 `<IssueBoard>` 四欄式（P1 立即修復 / P2 本月內 / P3 季度規劃 / OK 已通過），每張卡可點擊展開 `<IssueFixPanel>`。Pro 用戶看到完整修復內容（摘要 + 平台分頁 WordPress/Shopify/Wix/HTML + 步驟 + 程式碼），Free 看 `<IssueLockCTA>` 鎖定卡導向 /pricing。Lane 顏色配 `T.fail/warn/ACCENT/pass`，新增 `.seo-issue-board` grid CSS（>1100px 4 欄、>600px 2 欄、其他 1 欄）+ `.seo-fix-panel` fadeUp 動畫。
- ✅ **新增 [src/components/v2/SiteHeader.jsx](src/components/v2/SiteHeader.jsx) 共用站頭**：從 HomeDark 抽出 nav（Logo + 桌機選單 排行榜/競品比較/定價/文章分析/FAQ + 登入/頭像/升級鈕 + 手機橫向 nav），讀 `useAuth()` 共享登入狀態。整合到 SEO/AEO/GEO/EEAT/Content 五頁，取代原本各自的內聯 sticky header。
- ✅ **五頁統一暗色 wrapper（PageBg 同 HomeDark）**：`#000` 黑底 + 上方 3000px 155deg 青綠→深藍漸層（`mix-blend-mode: lighten`）+ 雜訊 0.12/overlay。捨棄 HomeDark 的下方 4500px 漸層（檢測頁通常高度不夠，下層會反壓上層）。每頁 `<PageBg>` + `<SiteHeader />` + 主內容 + `<Footer dark />` 三段式結構。
- ✅ **AEO/GEO/EEAT 改用 in-page 標題 chip**：移除原本的 inline `<header>`（含 1px 面向色條），改在主內容頂部放 chip 膠囊作為視覺辨識 — AEO 紫（`${T.aeo}33→#6366f133`）、GEO 綠（`${T.geo}33→#14b8a633`）、EEAT 琥珀→橘（`${T.eeat}33→${T.orange}33`）。內部 GlassCard 結構保持不動，最小化改動範圍。
- ✅ **ContentAudit 全頁暗色化**：原本是橘白主題（`bg-orange-50/100`、`text-slate-*`、`bg-white/40`），bulk 替換 ~15 種 Tailwind 模式為暗色版（`bg-black/40 + border-white/10`、`text-white/{60,70,40}`、`bg-orange-500/{10,20}` + `text-orange-300`、`from-orange-500/10 to-amber-500/10`、`stroke="rgba(255,255,255,0.08)"`）。ScoreRing 軌道圓圈也改為半透明白。
- 🔖 **設計取捨：保留各頁 module-scoped `PageBg`**：五頁各自一份 `function PageBg()` 在檔尾，沒抽到 components 因為這是頁面層 wrapper（不是元件），未來可能各頁分歧（例如某頁想用紅色版漸層）。SiteHeader 抽出來是因為它真的會被多頁同步使用、登入狀態邏輯共享。
- 🔖 **下一頁待整合**：Showcase / Compare 也需要相同 PageBg + SiteHeader 處理；Dashboard 主菜結構複雜，需要更多 GlassCard 變體後另開 commit。

### 2026-04-27
**四大檢測頁（SEO / AEO / GEO / E-E-A-T）v2 視覺套用（純 dark，不留 !isDark 分支）:**
- ✅ **[src/pages/SEOAudit.jsx](src/pages/SEOAudit.jsx) / [AEOAudit.jsx](src/pages/AEOAudit.jsx) / [GEOAudit.jsx](src/pages/GEOAudit.jsx) / [EEATAudit.jsx](src/pages/EEATAudit.jsx) 統一改寫**：四頁採用相同模板 — `PageBg` 共用暗色 wrapper（青綠頂部漸層 + 雜訊 0.12/overlay）、Header 改 `bg-rgba(0,0,0,0.5) backdrop-blur-xl` + 頂部 1px 四大面向色條（SEO 藍 / AEO 紫 / GEO 綠 / EEAT 琥珀→橘漸層）作為視覺辨識。
- ✅ **總覽分數卡 `<GlassCard color={accent}>`**：分數採用各面向色 → 第二段色（SEO #3b82f6→#06b6d4、AEO #8b5cf6→#6366f1、GEO #10b981→#14b8a6、EEAT #f59e0b→#f97316）的 135deg 漸層 `WebkitBackgroundClip: text` 立體效果，重新檢測按鈕使用同套漸層 + boxShadow `${accent}40`。進度條軌道改 `rgba(255,255,255,0.06)` 暗底。
- ✅ **檢測項目卡 `<GlassCard color={pass ? T.pass : T.fail}>`**：通過 / 未通過卡片 hover 時邊框變綠 / 紅。Pass / Fail / Unknown chip 用 `T.pass`、`T.fail` 的 `26` (15%) 透明背景配 light 色文字（`#86efac` / `#fca5a5`）。
- ✅ **Pro 鎖定 UI 統一**：未通過項目升級 Pro 提示改 `rgba(255,255,255,0.04)` 暗底 + `T.cardBorder`，「🔒 升級 Pro」徽章用 `T.orange + '26'` 配 `#fdba74` 文字。SEO / AEO / EEAT 含 FixGuide（Pro 解鎖修復指南），GEO 不含 FixGuide 直接顯示建議文字。
- ✅ **路線圖卡 `<GlassCard color={accent}>`**：SEO 三欄式（立即修復/短期改善/中期優化，搭配 P1/P2/P3 數字膠囊）、AEO/GEO 兩欄式（短期/中期）。Pro 鎖定狀態顯示中央 CTA 改 `<Link to="/pricing">` 漸層按鈕。
- ✅ **EEAT 四維度說明卡** (Experience/Expertise/Authoritativeness/Trustworthiness)：四張並排 `<GlassCard>`（無 color 強調），保留 Google E-E-A-T 概念教育價值。
- ✅ **EEAT Pro 升級 CTA 覆蓋層**：模糊預覽下覆蓋 `rgba(0,0,0,0.6) backdrop-blur-xl` 黑色玻璃卡 + `T.eeat` 邊框。順手修掉 NT$2,000 → NT$1,490（同前次 Pricing 修正），與 Pricing 月費對齊。
- ✅ **PageBg 抽出為各檔案 module-scoped function**：四頁各自有同樣的 `function PageBg()` 在檔尾，靠 JS hoisting 提早可用。沒有 dedupe 到 components 目錄，因為這四頁是頁面層 wrapper 不是元件，且未來可能各自分歧（例如某頁要用紅色版漸層）。
- 🔖 **不留 !isDark 橘白分支**：原檔的 `useTheme` import 全部刪除。檢測頁是登入後的功能頁面，不屬於 marketing landing 範疇，與 Account/Login/Register 同樣固定 dark。
- 🔖 **下一頁:Showcase / Compare / ContentAudit 三頁**，再來才是 Dashboard 主菜（最大頁面）。

### 2026-04-27
**Account / Login / Register 三頁 v2 視覺套用（純 dark，不留 !isDark 分支）:**
- ✅ **[src/pages/Login.jsx](src/pages/Login.jsx) 重寫為純 dark v2**：移除 `useTheme` import，整頁用單向頂部漸層 `linear-gradient(155deg, #18c590 → #0d7a58 → #084773 → #011520 → #000000)`（頁面短不需要底部漸層）+ 雜訊疊層 0.12/overlay。表單卡片改用 `<GlassCard color={T.orange}>` (hover 時邊框變橘),In-App Browser modal 改用 `<GlassCard color={T.warn}>`。輸入欄背景 `rgba(255,255,255,0.06)` + `T.cardBorder` 邊框 + `T.text` 白文字。Submit 按鈕保留橘琥珀漸層（與 HomeDark 提交鈕一致）。
- ✅ **[src/pages/Register.jsx](src/pages/Register.jsx) 重寫為純 dark v2**：同 Login 結構，多了姓名 + 確認密碼欄 + 行銷同意 checkbox + 註冊成功狀態頁。`PageBg` 子元件抽出共用暗色漸層 wrapper（成功頁與表單頁共享）。Marketing consent checkbox 用 `accent-orange-500` 配色，CTA「立即取得免費分析額度」維持橘琥珀漸層。
- ✅ **[src/pages/Account.jsx](src/pages/Account.jsx) 重寫為純 dark v2**：移除 `useTheme` import，header 改 `bg-rgba(0,0,0,0.5) backdrop-blur-xl` + `T.cardBorder`。三大區塊（用戶資訊 / 方案管理 / 帳號操作）全部換成 `<GlassCard>`。Pro 徽章用 `T.aeo` (#8b5cf6 紫，與 Pricing Pro 卡一致)，免費版徽章用 `T.orange`，取消訂閱按鈕用 `T.fail` 半透明紅，登出按鈕保留紅色文字。
- 🔖 **取捨：純 dark 不留 light 分支**：Login / Register / Account 是 auth / 個人帳號頁面，不屬於 CLAUDE.md「共用頁面（Pricing / FAQ / Dashboard 等）保留 !isDark 分支」原則涵蓋範圍。橘白備份分支只保留在 marketing / 報告頁面，auth 流程直接固定 dark 體驗，避免維護兩套表單樣式。
- 🔖 **In-App Browser 引導 modal 完整保留**：FB / LINE / IG 內建瀏覽器偵測 + 複製網址 + Android `intent://` 跳 Chrome + iOS Safari 步驟提示等所有 P0 修復邏輯不動，只把外殼從 `bg-white border` 換成 `<GlassCard color={T.warn}>`。

### 2026-04-27
**Pricing 頁 v2 視覺套用（保留 !isDark 橘白備份分支）:**
- ✅ **[src/pages/Pricing.jsx](src/pages/Pricing.jsx) 套上 v2 設計系統**：dark 分支整套換 v2 — 主容器底色 `#000` + 雙端 2400px 漸層（lighten 混合）+ 雜訊疊層 0.12/overlay。Header 改 `bg-black/50 backdrop-blur-xl border-white/8` + 白文字。早鳥膠囊改 `T.warn` 半透明、Title 用 `T.text`、副標 `T.textMid`。
- ✅ **三層方案卡用 GlassCard**：Free 卡無強調色（一般 GlassCard）、Pro 卡用 `T.aeo` (#8b5cf6) hover 邊框 + `borderWidth: 2` 加粗 + 「最多人選擇」紫藍漸層膠囊保留、Agency 卡 opacity 0.7 表現 disabled。月繳/年繳 toggle 改吃 T.aeo / T.orange 雙色，省 NT$2,980 chip 用 `T.pass`。
- ✅ **Pro 升級按鈕保留紫藍漸層**：`from-purple-500 to-blue-500` 做差異化（與其他 CTA 橘色按鈕區隔），早鳥按鈕保留 yellow-to-orange、CTA 底部按鈕回到 orange-to-amber（與 HomeDark 提交鈕一致）。
- ✅ **早鳥方案 wrapper**：dark 用 `T.warn + '0d'` 半透明黃底 + `T.warn + '4d'` 邊框 + backdrop-blur，「限量」chip 用 `T.warn + '33'` 填色。
- ✅ **FAQ 折疊項抽出 `<PricingFAQ>` 子元件**：dark 用 `<details>` 包 `<GlassCard color={T.orange}>`，light 維持原 details + bg-white/40。新增 Footer（原本沒有）統一頁面結構。
- 🔖 **聯盟行銷對話結論寫進筆記**：Pro 月費 NT$1,490／年費 NT$14,900（呈現 NT$1,242/月），分潤計算基礎是年費總額 NT$14,900，建議年費分潤 40-50%、月費不分潤、Agency 方案做高客單價（待設計）。
- 🔖 **下一頁:Account / Auth (Login + Register)**，這幾頁結構簡單但要小心 Google OAuth 的 in-app browser 引導 modal 不能誤動。

### 2026-04-27
**FAQ 頁 v2 視覺套用（保留 !isDark 橘白備份分支）:**
- ✅ **[src/pages/FAQ.jsx](src/pages/FAQ.jsx) 套上 v2 設計系統**：dark 分支整套換 v2 — 主容器底色純黑 `#000` + 雙端漸層（上方 2400px 155deg 左上亮、下方 1800px 335deg 右下亮，兩層皆 `mix-blend-mode: lighten` 避免互蓋）+ 雜訊疊層 0.12/overlay。Header 改為 `bg-black/50 backdrop-blur-xl border-white/8` + 白文字 + nav hover 變橘色。Hero 膠囊 / H1 / 副標統一吃 `T.orange / T.text / T.textMid`。
- ✅ **FAQ 折疊項抽出 `<FAQItem>` 子元件**：dark 用 `<GlassCard color={T.orange}>`（hover 邊框變橘 + 投影），light 維持 `bg-white/50` 原樣。問題標題 `T.text`、答案 `T.textMid`、+ 圖示 `T.orange`、分隔線改為半透明白。CTA 卡片同樣 `<GlassCard>` 包裝，按鈕保留 orange-to-amber 漸層（與 HomeDark 提交鈕一致）。
- ✅ **JSON-LD FAQ Schema 不動**：`<script type="application/ld+json">` 在 dark/light 都保留，SEO 必要。
- ✅ **light 分支（`!isDark`）完全維持原樣**：橘色 radial 背景 + 點陣紋路 + 白色卡片 + slate 文字，作為日後切換回橘白版的復原路徑（CLAUDE.md「共用頁面保留 !isDark 分支」原則）。
- 🔖 **下一頁:Pricing**（`/pricing`），會比 FAQ 重一截 — 三層方案卡（Free/Pro/Agency）+ Stripe 結帳按鈕 + 可能還有功能比較表，需要更多 GlassCard 變體與 Btn 元件。

### 2026-04-27
**HomeDark v2 視覺套用(維持 Hero 原排版):**
- ✅ **[src/pages/HomeDark.jsx](src/pages/HomeDark.jsx) 套上 v2 設計系統**:Hero 區塊(H1 / 副標 / 副副標 / 網址輸入欄 + 橘紅漸層按鈕 / 雷達 SVG)依用戶指示完整保留原有排版與 Tailwind 樣式。Hero 以下所有區塊改用 `<GlassCard>` + `T` tokens:**我的網站卡**(7 處,色相 `T.orange`,score 條改吃 `T.pass/warn/fail`)、**跑馬燈**(強調色由紫改為 `T.aivis` 青綠,與 v2 模組一致)、**AI 爬蟲卡 8 張**(`T.aivis`)、**搜尋引擎爬蟲卡 5 張**(`T.seo`)、**三大 Features**(各配 `T.seo/aeo/geo`)、**排行榜入口**(GlassCard 包外殼,內部藍紫按鈕作差異化)、**FAQ 折疊項**(`T.orange` hover 邊框)。
- ✅ **保留原視覺資產**:青綠漸層背景、同心圓陣列、雷達脈衝動畫、橘色 CTA 按鈕、URL 輸入欄打字動畫 + 脈衝光環、`home-url-input` 白底深字 override 規則 — 全部不動。
- ✅ **Hero 排版約束**:用戶反饋「首頁Hero部分想維持原有排版」,所以 form 內部 `<button>` 沒換成 `<Btn>`(避免漸層由橘琥珀變橘深紅)、H1 / 副標的 Tailwind 字級不動、雷達區寬度高度位置全部維持。
- 🔖 **下一頁:Dashboard**(`/dashboard/:id`),v2 改造會比 HomeDark 大,因為 Dashboard 有更多原生 Tailwind 卡片需轉 GlassCard,而且需引入 ScoreCard / RadarChart 等 docs/AI_ v2.html 內的衍生元件。

### 2026-04-27
**v2 設計系統基礎建設(整站改版前置):**
- ✅ **新增 [src/styles/v2-tokens.js](src/styles/v2-tokens.js)**:從 `docs/AI_ v2.html` 抽出共用 design tokens — `T`(顏色/文字/卡片/狀態/字型/圓角)、`SCORE_META`(四大面向元資料)、`getVerdict()` / `verdictColor()`(分數白話判定)。所有 v2 頁面 import 同一份,色值統一管理。
- ✅ **新增 [src/components/v2/](src/components/v2/) 共用元件目錄**:`GlassCard.jsx`(玻璃擬態卡片基底,hover 浮起動畫)、`Btn.jsx`(primary 橘紅漸層 / secondary 半透明 / ghost 透明,自帶 disabled 與 hover 狀態)、`useCountUp.js`(KPI 滾動 hook,ease-out cubic),`index.js` barrel export 讓後續頁面一行 import 完。
- 🔖 **設計策略**:「先抽 tokens、後逐頁改」。直接全站重寫風險太大、page-by-page 又會跑出每頁綠色色值不一致。先建單一 source of truth,後面從首頁 HomeDark 開始照流量優先順序逐頁移植。
- 📋 **下一步計畫**:HomeDark → Dashboard → 四大檢測頁 → Pricing → Account / Auth → FAQ / Showcase / Compare。每頁獨立 commit,部署後即時驗證。
- 🔖 **不立即重構 aivis dashboard**:現有 `AIVisibilityDashboard.jsx` 內聯 T tokens 已穩定上線,等其他頁面用同一份 tokens 後一起 deduplicate,避免動會炸的東西。

### 2026-04-27
**aivis Phase 2c.1.1 — 前台隱藏 API 成本、改放 AdminUsers 展開明細:**
- ✅ **[AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 拔掉所有美金/台幣字樣**:第 4 張 KPI 從「本月總費用」改為「本月新增提及」(計算改為 `responses.filter(brand_mentioned && created_at >= monthStart).length`)、scan 完成 toast 拿掉 `(成本 $X.XXXX)`、regenerate toast 拿掉成本字串、「立即執行掃描」說明拿掉 `~NT$ X.XX`。理由:用戶付的是訂閱費(Free/Pro NT$1,490/月),不是 pay-per-use,前台秀美金會讓人誤以為要另外加錢。
- ✅ **[AdminUsers.jsx](src/pages/admin/AdminUsers.jsx) 展開明細加 AI 曝光監測成本卡**:點開任一用戶時,除了載入網站列表外,並行查 `aivis_responses where user_id = X` 計算 `monthUsd` / `totalUsd` / `monthRuns` / `totalRuns`,在「已分析的網站」上方顯示 4 格 KPI(本月成本 / 累積成本 / 本月呼叫 / 累積呼叫),USD 後附 NT$ ≈ 換算(×31)。內部追蹤用,客戶看不到。
- 🔖 **設計原則**:SaaS 標準做法是 hide 基礎設施成本、show 額度概念(「本月使用 3/30 次掃描」)。額度方案後續再決定;目前先把美金字樣藏起來,避免造成 trust 傷害。

### 2026-04-27
**aivis Phase 2c.1 — Dashboard v2 視覺整合 + Supabase 資料串接:**
- ✅ **[src/pages/AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 全面改寫**(190 行 → 1474 行):從 Phase 1 空狀態骨架升級為 Claude Design v2 完整儀表板。沿用既有暗色 + 青綠 `#18c590` aivis 主題色,以 inline-style + T design tokens 實作(不走 Tailwind),頁面以 zIndex -1 的青綠漸層 div 蓋掉 HomeDark 紅色底。
- ✅ **資料層接 Supabase**:`loadAll()` 並行四查 — `aivis_brands` 主檔 / 同 user 全部品牌(供 BrandSwitcher) / `aivis_prompts` (這個 brand 的 active 條目) / 過去 30 天 `aivis_responses` + `aivis_mentions`。useMemo 聚合出 `activePrompts` / `exposureRate`(被提及次數 / 總回應數)/ `avgPos` / `scanCount` / `monthCostUsd` / `monthCostNT` / 30 日趨勢線(按 dayKey GROUP BY) / `historyDays`(distinct 7 天) / `recentResults`(指定日的 prompt 群組)。
- ✅ **互動寫回 Supabase**:`togglePrompt` / `saveEdit` / `addPrompt`(帶 PROMPT_CAP=10 上限檢查,trigger 端強制)以樂觀更新 + 失敗 rollback 寫入 `aivis_prompts`。`regeneratePrompts` 打 `POST /api/aivis/generate-prompts?brand_id=`,`runScan` 對每條 active prompt 串行打 `POST /api/aivis/fetch?prompt_id=&runs=3`,動畫進度條 + 累計成本。
- ✅ **子組件全內聯在同檔**:BrandSwitcher(useRef 監聽外點關選單)/ TrendChart(原生 SVG + hover tooltip)/ RecentResults(歷史日期 chip + 巢狀展開單條 prompt 結果)/ ScanOverlay(雷達掃描動畫 + 階段清單)/ 各 Skeleton/Empty/Error 卡 / Toast。`useCountUp` hook 給 KPI 數字滾動效果,`highlightBrandAuto` 在 snippet 中用青綠膠囊高亮品牌名。
- 📋 **Phase 2c.2 待辦(已留 hook)**:歷史 chip 點擊載入該日期完整資料(目前已有 30 天 buffer 在記憶體)、競品比較欄位、prompt 編輯時的 server-side 衝突偵測。
- 🔖 **設計取捨**:沒拆 BrandSwitcher / TrendChart 成獨立檔案,因為這些都是 dashboard 專屬、不會被別頁用到,提早抽元件反而需要擴 props 介面;等真的有第二個頁面要用再拆。

**P0 修復 — 客戶從 In-App Browser 登入被 Google 擋:**
- ⚠️ **Bug 起因**:客戶從 LINE / Facebook 點分享連結進站後,點「使用 Google 帳號登入」→ Google 回 `403 disallowed_useragent`(Google 自 2021 起禁止 OAuth 在 embedded webview 內進行)。客戶看到「使用安全瀏覽器」全英文錯誤頁,直接放棄登入。
- ✅ **新增 [src/lib/inAppBrowser.js](src/lib/inAppBrowser.js)**:UA 偵測工具 — `isInAppBrowser()` 涵蓋 Facebook(FBAN/FBAV/FB_IAB)/ LINE / Instagram / WeChat / TikTok / Twitter / KakaoTalk / 通用 Android wv,`getInAppBrowserName()` 回傳中文名,`getDeviceOS()` 區分 iOS/Android,`tryOpenInSystemBrowser()` 對 Android 用 `intent://` scheme 跳出到 Chrome。
- ✅ **[Login.jsx](src/pages/Login.jsx) + [Register.jsx](src/pages/Register.jsx) 加入兩層引導**:(1)頁面 mount 時若偵測到 in-app browser → 表單上方顯示 amber banner 提示;(2)點 Google 按鈕時若 in-app → 不打 OAuth API,改彈 modal 顯示完整網址 + 「複製網址」按鈕(`navigator.clipboard.writeText()` + `document.execCommand('copy')` fallback),iOS 顯示「複製→Safari→長按貼上」三步驟,Android 額外提供「嘗試直接開啟 Chrome」按鈕。Modal 也提供「關閉,改用 Email 登入/註冊」逃生口。
- 🔖 **設計取捨**:沒走 Supabase auth provider 設定那邊改,是因為這是 client-side UA 阻擋而非 server-side flow 問題;直接在 React 層偵測+引導比動 OAuth client 設定快,而且不影響系統瀏覽器的正常 OAuth 流程。

### 2026-04-26
**aivis Phase 2 ─ 端到端串通 + meta prompt 真人化:**
- ✅ **執行 [aivis-tables-phase2.sql](aivis-tables-phase2.sql)**:在 Supabase 建好 `aivis_prompts` / `aivis_responses` / `aivis_mentions` 三張新表(全部帶 user_id denormalized + RLS auth.uid() 對齊)。
- ✅ **新增 [api/aivis/fetch.js](api/aivis/fetch.js)**:`POST /api/aivis/fetch?prompt_id=xxx&runs=3` 端點 — 對指定 prompt 跑 N 次 Claude Haiku 4.5、寫入 responses、偵測品牌提及寫入 mentions、回傳 `mention_rate` 與成本。實測每次掃描(3 runs)約 $0.006(NT$0.2)。
- ✅ **新增 [api/aivis/generate-prompts.js](api/aivis/generate-prompts.js)**:`POST /api/aivis/generate-prompts?brand_id=xxx` 端點 — Claude 讀品牌產業/簡介自動產 5 條中性測試 prompts。`replace_existing=true` 為預設(語意=重新產生),會把舊 auto prompts 軟刪除(is_active=false)再寫新的,避免撞上限。
- ✅ **加入 [aivis-prompt-limit.sql](aivis-prompt-limit.sql)**:用 plpgsql trigger 強制每個 brand 最多 10 條 prompts(CHECK 不支援子查詢所以走 trigger 路線),INSERT 第 11 條會炸 `check_violation`。
- ✅ **修正 Anthropic API key 安全事件**:user 在截圖中外洩過完整 key,立刻請其去 Console 撤銷+重發,新 key 只放 Vercel env var(Production / Preview / Development),從未回顯。
- ✅ **meta prompt 真人化改寫**([generate-prompts.js:137](api/aivis/generate-prompts.js#L137)):原版生出來的 prompt 太「產業分析師味」(「請推薦三家在台灣專門做品牌策略...」),不符合中小企業老闆真實搜尋口吻。改為強制涵蓋 5 種切角:**地區型**(台南/高雄)/ **預算型**(預算 10 萬內)/ **痛點型**(IG 沒人追蹤該找誰)/ **業種型**(餐廳老闆)/ **比較列表型**(最多 1 條),口語要求「找哪家」「值得推薦」、禁用「請問」「敬請」。
- 📋 **新增 [docs/aivis-phase2-ui-brief.md](docs/aivis-phase2-ui-brief.md)**:給 Claude Design / 設計師的 hand-off 文件,含 5 區塊 UI 規格(概況卡 / Prompts 管理 / 手動觸發 / 最近結果 / 30 天趨勢),沿用既有暗色 + 橘色強調,aivis 主題色定為青綠 `#18c590`。

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
