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
| `content_audits` | 內容品質分析結果（15 項檢測，含 heading/word_count/meta/aeo/author/images/links/outbound/multimedia/readability JSONB；2026-05-20 新增，給 `/content-audit/:id` 詳情頁吃 cached + 趨勢迷你圖）|
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
| `/content-audit` | ContentAudit | 文章內容分析（任意 URL 模式，15 項檢測，Pro 解鎖修復建議）|
| `/content-audit/:id` | ContentAudit | 內容品質詳情頁（DB-backed 模式，綁定 website_id，吃 cached + 趨勢迷你圖；2026-05-20 新增）|
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

**目前使用（青綠版，2026-05-20 改為主視覺）：**
```
linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)
```

各頁面（HomeDark / Dashboard / Audit 系列 / AIVisibility / Account / Compare 等）與 `App.jsx` 的 `GlobalDarkBg` 全域背景均一致使用此漸層；路由切換時不會看到舊版顏色閃現。

**歷史備存（紅黑版，已下線）：**
```
linear-gradient(135deg, #a21540 0%, #6b0e2a 18%, #2a0510 32%, #0a0208 46%, #000000 60%)
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

| 方案 | 月費 | 年費 | 功能 |
|------|------|------|------|
| 免費版 | $0 | — | 5 大面向分數、通過/不通過清單、3 條優化建議、競品比較 2 個、文章分析基本版、追蹤 3 站 |
| **Pro 版** | NT$1,490／月 | NT$13,900（**省 22%・等於免費多用 2.6 個月**） | 修復碼產生器、歷史趨勢圖、平台別修復指南（WP/Shopify/Wix/HTML）、競品比較 4 個、PDF 匯出、Email 週報、文章分析完整版、**AI 曝光監測（aivis）每月 150 次**、追蹤 15 站 |
| Agency 版 | NT$4,990／月起（即將推出） | — | 50 站、白標 PDF、多客戶工作區、優先客服、所有 Pro 功能 |

**aivis 設計原則：** 已整合進 Pro 核心，不可獨立訂閱（5 LLM 共識）。理由：SEO 修復是一次性的，但 AI 引用率天天在變、競爭對手天天在優化 — aivis 是 Pro 持續訂閱的核心鉤子，把它獨立加購會讓用戶「改完就退訂」。

**aivis Top-up 加購（隱藏於定價頁，just-in-time 揭露）：**
- 小包：NT$490 / +300 次（每次 NT$1.63，補檔用）
- 大包：NT$990 / +800 次（每次 NT$1.24，多品牌或競品矩陣）
- 一次性購買、不過期、用完為止、不綁訂閱
- 每月查詢硬上限 1,000 次（內含 + Top-up 合計），Agency 推出後解除
- **不在定價頁陳列**：避免「還要再加錢嗎」的隱憂稀釋 Pro 卡訴求；改在 aivis dashboard 用量達 80%（120 次）顯示 banner、達 100%（150 次）跳 modal 提示加購

**早鳥優惠：** 正式上線起 **4 週內・前 100 名**付費用戶享首年 NT$990／月（年繳 NT$11,880），次年續訂自動恢復 NT$13,900／年。雙條件擇先觸發者截止。

**7 天免費試用：** Pro 全功能試用 7 天（aivis 試用上限 100 次）；試用結束前可取消、不收費。

**14 天無條件退款：** 限年繳方案；月繳不退款。

**聯盟分潤：** 暫不上線。等正式推出後依市場反應再決定（pending）。

**網站追蹤上限：** Free = 3 個、Pro = 15 個、Agency = 50 個

付款流程：**Phase 1 NewebPay**（TW/NT$、主力，沙盒審核中）→ Notify → `profiles.is_pro = true`；**Phase 2 Stripe Atlas**（國際/USD、備用，因 HK 帳號鎖死暫緩）保留 code（`/api/aivis/checkout-topup.js`、`stripe-webhook.js`）。

**⚠️ 上線前需確認（依執行順序）：**
- ~~A5 假 KPI（127 / 3,847 / 43 / 4.7）改 dynamic query~~ — ✅ 2026-05-11 完成，改吃 `/api/public-stats` 後端 service role 聚合
- ~~Supabase Auth 註冊頻率限制~~ — ✅ 2026-05-11 程式碼完成（Cloudflare Turnstile + Supabase captchaToken），剩下用戶側 Cloudflare 申請 + Supabase Dashboard 啟用
- ~~7 天免費試用 程式碼~~ — ✅ 2026-05-13 完成（A2.1 trial 啟動 / lazy expiry / Pricing CTA / Account 卡 / Dashboard banner + A2.2 daily cron sweep + Day 4/6/7 email + aivis 試用 50 配額）
- ~~NewebPay Phase 1 Step 2（Pro 年繳 NT$13,900 + 早鳥 NT$11,880）~~ — ✅ 2026-05-13 程式碼 + 2026-05-19 沙盒實測通過
- ~~NewebPay 退款 API（信用卡 API 直退 / VACC・WEBATM 手動轉帳）~~ — ✅ 2026-05-13 程式碼 + 2026-05-19 沙盒實測通過
- ~~NewebPay Phase 1 Step 1（Top-up 小包 NT$490 / 大包 NT$990）~~ — ✅ 2026-05-19 真卡實測通過（三表寫入正確）
- ~~Top-up 不退款事先同意（消保法 §19-II-5）~~ — ✅ 2026-05-19 完成（TopupModal checkbox + `aivis_topup_consents` 證據表 + 前後端雙層守衛）
- ~~NPA 月繳定期定額 NT$1,490／月~~ — ✅ 2026-05-19 沙盒實測通過（首扣 + 取消委託 e2e 全綠，踩平 7 個 NewebPay 文件沒講清楚的坑）
- ~~正式環境 + 金流端到端測試~~ — ✅ 2026-05-20 通過（env 已切回 `core.newebpay.com` + 正式 `MS3830621445`）

**🟢 上線阻擋全數解除（2026-05-20）— SQL schema 驗證 7/7 全綠：**
- ~~trial-system~~ — ✅ `profiles.trial_started_at / trial_ends_at` 齊全（程式碼不用 trial_status）
- ~~trial-reminders~~ — ✅ `profiles.trial_reminders_sent TEXT[] DEFAULT '{}'`
- ~~newebpay-refunds~~ — ✅ `aivis_newebpay_pending` 5 個退款欄位齊全
- ~~admin-cs-tools~~ — ✅ `profiles.is_admin` 存在（客服工具不依賴 audit_log 表）
- ~~`ALTER pending.kind CHECK`~~ — ✅ ARRAY 含 `'pro_monthly'`
- ~~`CREATE aivis_newebpay_period`~~ — ✅ 表 + RLS policy 已建
- ~~`CREATE aivis_topup_consents`~~ — ✅ 表 + 主要欄位齊全

**接下來純等營運準備：**(a) NewebPay 商家正式審核完成（env 已切正式）(b) 公告文案 / 早鳥計數 banner / 客服通道對外可達 → 拍板上線日。

備註：Top-up 政策為「不過期、用完為止、不退款」，退款流程只針對 Pro 年繳。Top-up 客訴 / 盜刷情境走手動處理（NewebPay 後台 + Supabase 手動扣 credits）。

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

### 第二階段（進行中）
- [x] **系統監控 AdminMonitoring（B3 — 2026-05-13 完成）**：4 KPI（本月掃描 / API 成本 / 提及率 / 活躍用戶）+ 7/30 天趨勢圖 + Top 10 重度使用者。錯誤日誌 viewer 待 schema 加 error 欄位後另外做。
- [x] 客服工具：補發 Top-up（B2a）/ 延長 Pro 到期日（B2b）/ 寄自訂 email（B2c）— 2026-05-13 完成 ✅（待用戶側跑 [admin-cs-tools.sql](admin-cs-tools.sql)）
- [ ] NewebPay 訂閱資料整合：AdminUsers 顯示方案類型 / 到期日 / 退款紀錄、AdminRevenue 拆早鳥 vs 一般年繳（原 Stripe 整合項目，2026-05-13 因金流主力切到 NewebPay 而改寫）

### 第三階段（待開發）
- [ ] 內容管理：~~公告~~（✅ 2026-05-07 完成）、FAQ、定價文案
- [ ] 排行榜管理：Showcase 審核與人工介入

### 認證機制
- `profiles.is_admin = true` → 允許進入後臺（需在 Supabase 手動設定）
- `AdminGuard` 組件：非管理員自動重導至首頁
- Supabase RLS 需設定 admin 可讀取全表（目前依賴 anon key，上線前需加 RLS policy）

### 資料庫需求
- `profiles` 表需加 `is_admin BOOLEAN DEFAULT false` 欄位

---

## 工作日誌

工作日誌已搬移至 [WORKLOG.md](./WORKLOG.md)。歷史紀錄請至該檔查閱；新增紀錄請 append 到 WORKLOG.md **頂端**（保持最新在頂）。

**為何拆出：** 內嵌在 CLAUDE.md 會被 Claude Code 每次對話自動載入，工作日誌持續 append 後撐到 270KB，導致 autocompact thrashing。

---

## 待開發 / 未完成功能

- ~~`/content-audit`~~：✅ 已完成。15 項檢測（內容結構/字數/Meta/AEO/E-E-A-T/可讀性），免費看分數+清單，Pro 解鎖修復建議
- ~~`/ga4-report/:id`~~：✅ 已完成。GA4 詳細報告（KPI 卡片、健康指標條、5 分頁 Tabs、建議引擎）
- ~~`/gsc-report/:id`~~：✅ 已完成。GSC 詳細報告（KPI 卡片、健康指標條、5 分頁 Tabs、機會關鍵字、建議引擎）
- `/crawl-check`：爬蟲可達性專項檢測頁（含終端機日誌動畫），對標 washinmura.jp
- Agency 方案升級流程
- n8n 自動化排程（設計已完成，待串接）
- 每週報告 Email（`/api/cron-weekly-reports.js` 已建，每週一 09:00）
