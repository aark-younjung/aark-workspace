# CLAUDE.md — AI 雷達（AI 能見度儀表板）

開發者 AI 助理指引文件。每次開始新對話時請先閱讀此文件。

---

## 產品定位

**產品名稱：** 方舟 AI 雷達（台灣第一個 LLMO 監測平台）
**品牌母體：** AARK（logo / 視覺設計用、Aark 念「阿克」）
**營運公司：** 優勢方舟數位行銷（法定收款方，金流商家戶名稱）
**線上網址：** https://aark-workspace.vercel.app/
**GitHub：** https://github.com/aark-younjung/aark-workspace

**核心定位（2026-06-05 v2 重新定位，5 AI 共識）：** 方舟 AI 雷達是台灣第一個完整覆蓋 LLMO（Large Language Model Optimization，大型語言模型優化、業界俗稱「AI 搜尋優化」）的監測平台。把 LLMO 這把大傘拆成 5 個可量化的訊號層 — SEO（Google 排名地基）、AEO（答案引擎引用）、GEO（生成式 AI 推薦）、E-E-A-T（可信度訊號）、aivis（跨 LLM 引用率追蹤）— 各自打分、合成總分。

**主要客戶（P0）：** 中小型數位行銷代理商（5-30 人、有 SEO 服務、需要多客戶工作區 + 白標報告）
**次要客戶（P1）：** 品牌主 / 電商老闆（自己接觸過 SEO、想被 AI 推薦）

**核心訴求：** 從工具升級成平台、從一次性 SEO 顧問升級成持續訂閱服務。Ahrefs / SEMrush 教代理商贏 Google、方舟 AI 雷達教代理商贏 ChatGPT。

**品牌三層架構（v2 定案）：**
- **產品線（前端 / SEO / 口頭 / 簡報）**：方舟 AI 雷達 — 中文好記、有「載你度過 AI 洪水」隱喻、代理商口頭好講
- **品牌母體（logo / 視覺設計 / 國際擴張預留）**：AARK — 簡短、SaaS 風格、未來可延伸 Aark Radar / Aark Analytics 產品家族
- **營運公司（法律 / 發票 / 商業登記）**：優勢方舟數位行銷
- **完整呈現**：「方舟 AI 雷達 ｜ AI 搜尋能見度監測平台 · Powered by AARK · 由優勢方舟數位行銷研發」

**品牌使用原則（2026-05-20 rename 後）：**
- **產品名「AI 雷達」**：用於 logo、Footer、Email header / from、PDF 報告 header、index.html title / OG / Twitter、NewebPay ItemDesc / ProdDesc、法律文件「商店名稱」欄
- **公司名「優勢方舟數位行銷」**：用於法律文件「營運公司／服務提供者」欄、Email 簽名 / Footer 副標「由優勢方舟數位行銷營運」、發票抬頭、商業登記
- **業界術語「AI 能見度」（不是品牌名）**：FAQ、Hero h1「掌握 AI 能見度」、報告描述「AI 能見度報告」、Dashboard tooltip 等概念說明可保留

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
| `aivis_brands` | AI 曝光監測模組 — 使用者追蹤的品牌清單（Phase 1，2026-04-23 新增）。`website_id`（2026-07-28 新增，FK→`websites.id`、可空、`on delete set null`）＝一站一品牌關聯，供改版總覽以網站解析品牌；backfill 用「該網域最短 URL（首頁）那筆」|
| `aivis_prompts` | 每品牌的監測題庫。`tier`（2026-07-02 新增，`core`/`rotating`/`brand`/`info`，DEFAULT `core`，`info` 於 2026-07-17 加入 CHECK）＝四層題庫分流。`generated_by`（auto/user）、`is_active`（是否納入掃描）|
| `aivis_responses` | 每次掃描 1 筆（1 row = 1 scan＝1 額度）。Claude 主欄 + `engine_results` JSONB（多引擎結果）。額度計數看本表列數 |
| `anon_scan_events` | 未登入快掃事件日誌（value-first：url+SEO/AEO/GEO/EEAT 分數+時間，**不寫 audit 表**；2026-06-21 新增）。RLS：anon insert / admin select。在 /admin/websites 頂部「未登入快掃」區塊顯示 |
| `scan_leads` | 掃描失敗時留 email 的名單（2026-08-27 新增）。首頁掃不通會出現失敗卡，非「使用者自己打錯網址」的失敗才收 email。欄位：`email`／`url`／`error_kind`（timeout/blocked/network/unknown）／`error_message`／`user_id`（可空）／`session_id`。RLS：anon+authenticated insert / admin select。在 /admin/monitoring「掃描失敗留的名單」區塊顯示；insert 失敗會退寫 `error_logs`（source=`scan_lead_fallback`）避免名單無聲消失 |

**訂單表 `is_test_order` 欄位（2026-05-22 新增）：**
- `aivis_newebpay_pending.is_test_order` + `aivis_newebpay_period.is_test_order` 兩張表都有 BOOLEAN DEFAULT false
- 標記內部沙盒/偵錯訂單，避免污染 AdminRevenue 統計
- AdminRevenue 預設過濾（toggle 可包含測試）；AdminUsers 列表分類過濾但展開詳情仍顯示（加 🧪 chip）
- **自動標記**：所有 checkout endpoint（pro-yearly-newebpay、aivis/checkout-topup-newebpay）+ NPA notify 的 period upsert 都自動呼叫 [api/lib/test-detect.js](api/lib/test-detect.js) `isTestOrder(email)` 設定旗標
- **判斷條件**（兩條件 OR）：
  1. **沙盒環境** — `NEWEBPAY_API_URL` 含 `ccore.newebpay.com`
  2. **測試 email 名單** — Vercel env `TEST_EMAILS="email1@x.com,email2@x.com"` 逗號分隔
- 新增測試帳號只需把 email 加到 `TEST_EMAILS` env var，不必跑 SQL UPDATE

**Pro 方案判斷：** `profiles.is_pro = true`（目前由 Stripe webhook 寫入，也可在 Supabase 手動切換）

**Auth：** Supabase Auth，支援 Email/Password 與 Google OAuth

---

## 路由表

> **⚠️ 2026-08-14 硬切轉址後，新版 `/app/*` 為預設介面**：`/dashboard/:id`→`/app/:id/overview`、四大 audit→`/app/:id/health/:tab`（1:1 轉址）。新版路由：`/app/websites`（選站）、`/app/:websiteId/{overview|visibility[/:visTab]|health[/:healthTab]|gap}`。逃生口（觀察期後移除）：`/dashboard-v2/:id` 經典版、`/*-audit-legacy/:id` 四大舊頁。工具頁（/content-audit、/bulk-scan、/schema-check、/crawl-check、/ai-visibility*）保留原位。下表為轉址前的歷史對照：


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
7. **精簡優先（預設 ponytail 精神）：** 寫 code 前先爬決策梯，停在第一個成立的：(1) 這需要寫嗎（YAGNI，投機需求直接跳過並說一句） (2) 標準庫有嗎 (3) 平台原生功能覆蓋嗎（CSS 勝過 JS、DB 約束勝過 app code、`<input type=date>` 勝過套件） (4) 現有依賴能解嗎 (5) 能一行嗎 (6) 才寫最少可行 code。不過度抽象、不為小功能加新依賴、不寫沒人要的 boilerplate、刪優於加、無聊勝過聰明。**但不在這些上偷懶**：trust boundary 的輸入驗證、防資料遺失的錯誤處理、安全、無障礙、用戶明確要求的——少了這些的精簡 code 是半成品。刻意簡化用 `ponytail:` 註解標記（有已知上限就寫明上限 + 升級路徑）。一人團隊維護，code 越少越好維護。

---

## 商業模式

| 方案 | 月費 | 年費 | 功能 |
|------|------|------|------|
| 免費版 | $0 | — | 5 大面向分數、通過/不通過清單、3 條優化建議、競品比較 2 個、文章分析基本版、追蹤 3 站 |
| **Pro 版** | NT$1,490／月 | NT$13,900（**省 22%・等於免費多用 2.6 個月**） | 修復碼產生器、歷史趨勢圖、平台別修復指南（WP/Shopify/Wix/HTML）、競品比較 4 個、PDF 匯出、Email 週報、文章分析完整版、**AI 曝光監測（aivis）每月 150 次**、追蹤 15 站 |
| Agency Starter | NT$4,990／月起（即將推出） | — | 30 站、白標 PDF、多客戶工作區、優先客服、所有 Pro 功能 |
| Agency Plus | 定價待定（即將推出） | — | 100 站、Agency Starter 全部功能 |

**aivis 設計原則：** 已整合進 Pro 核心，不可獨立訂閱（5 LLM 共識）。理由：SEO 修復是一次性的，但 AI 引用率天天在變、競爭對手天天在優化 — aivis 是 Pro 持續訂閱的核心鉤子，把它獨立加購會讓用戶「改完就退訂」。

**aivis 四層題庫（2026-07-02 建三層 / 2026-07-17 加 info）：** 掃描的統計效度靠 `aivis_prompts.tier` 分流 —
- **core（固定核心）**：品類問句、不含品牌名。每次掃描全跑，是**頭條曝光率與趨勢線的唯一基準**（固定樣本才能有效比較「這週 vs 上週」）。啟用上限 `PROMPT_CAP=10`。
- **rotating（輪替池）**：長尾品類問句。每次掃描**隨機抽 `ROTATING_SAMPLE_PER_SCAN`（預設 2）條**，擴大覆蓋、抓核心題測不到的盲點、防「應試化」（Goodhart）。
- **brand（品牌詞）**：帶品牌名。量「AI 認不認得你」、near-deterministic → fetch.js **強制 runs=1**；**刻意排除在頭條曝光率/趨勢之外**（另計 `brandRecogRate`），避免用品牌詞灌水（誠實 + 公平交易法）。
- **info（資訊型，Phase 2a）**：不含品牌名的知識/how-to 問句（例：「電波拉皮術後要注意什麼？」）。計分**不看有沒有被念名字，改看「AI 這題的引用來源裡有沒有你的網域」** → `contentExposure` 內容引用率（`InfoExposureCard`）。量的是**內容行銷／SEO 有沒有打進 AI（被當知識來源）**，是最能反映 SEO 成效、也最容易做出 before/after ROI 的軸。fetch.js `runs=1`、每次全掃（固定內容記分卡、不抽樣）；`INFO_COUNT=5`。**跟 brand 一樣刻意排除在頭條曝光率/趨勢之外**、獨立呈現，不拿來灌能見度分數（誠實 + 公平交易法）。`is_active=false` 進「池子」、不佔 `PROMPT_CAP=10` 上限。
- 題量在 [generate-prompts.js](api/aivis/generate-prompts.js) 檔頭常數可調；改動連動每次掃描額度花費（≈ core×3 + 抽樣×3 + brand×1 + info×1）。

**aivis Top-up 加購（隱藏於定價頁，just-in-time 揭露）：**
- 小包：NT$490 / +40 次（每次 NT$12.25，補檔用）
- 大包：NT$990 / +100 次（每次 NT$9.9，刻意對齊 Pro 隱含單價 1490/150）
- **2026-06-13 改價**：三引擎（ChatGPT+Claude+Gemini）全接地後成本 ~NT$5/次，舊量 300/800（單價 NT$1.63/1.24）每賣一次虧 NT$3-5。已售出舊 credits 照舊履行；上線兩週後用 DB `cost_usd` 實測校正次數
- 一次性購買、不過期、用完為止、不綁訂閱
- 每月查詢硬上限 1,000 次（內含 + Top-up 合計），Agency 推出後解除
- **不在定價頁陳列**：避免「還要再加錢嗎」的隱憂稀釋 Pro 卡訴求；改在 aivis dashboard 用量達 80%（120 次）顯示 banner、達 100%（150 次）跳 modal 提示加購

**早鳥優惠：** 正式上線起 **4 週內・前 100 名**付費用戶享首年 NT$990／月（年繳 NT$11,880），次年續訂自動恢復 NT$13,900／年。雙條件擇先觸發者截止。

**7 天免費試用：** Pro 全功能試用 7 天（aivis 試用上限 100 次）；試用結束前可取消、不收費。

**14 天無條件退款：** 限年繳方案；月繳不退款。

**聯盟分潤：** 暫不上線。等正式推出後依市場反應再決定（pending）。

**網站追蹤上限：** Free = 3 個、Pro = 15 個、Agency Starter = 30 個、Agency Plus = 100 個（唯一規格以 [src/lib/limits.js](src/lib/limits.js) 為準；2026-07-28 更正，原誤植「Agency 50」）

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
| `/admin/websites` | AdminWebsites | 掃描紀錄：登入用戶網站 + 四大分數 ＋ 頂部「未登入快掃」區塊（讀 anon_scan_events、value-first 免註冊掃描）|
| `/admin/revenue` | AdminRevenue | 營收：MRR 估算、Pro 用戶列表、近 6 月增長圖 |
| `/admin/activity` | AdminActivity | 用戶活躍分析：5 分群 KPI + 流失風險/升級潛力行動名單（2026-06-13） |
| `/admin/waitlist` | AdminWaitlist | 代理商候補名單檢視（讀 aark_agency_waitlist；2026-06-18）。申請時會 email 通知 aark6465（public.js `?action=agency-waitlist-notify`，fire-and-forget） |
| `/ai-visibility` | AIVisibility | **AI 曝光監測** — 品牌列表 + 新增（aivis 模組 Phase 1） |
| `/ai-visibility/:id` | AIVisibilityDashboard | AI 曝光監測 — 單一品牌儀表板（目前為空狀態）|

### 第一階段（已完成）
- [x] 用戶管理：列表、搜尋、篩選、手動升降級 Pro、展開查看已分析網站
- [x] 掃描紀錄：所有網站列表、四大分數、所屬用戶
- [x] 營收儀表板：MRR 估算、Pro 用戶數、轉換率、近 6 月圖表

### 第二階段（進行中）
- [x] **系統監控 AdminMonitoring（B3 — 2026-05-13 完成）**：4 KPI（本月掃描 / API 成本 / 提及率 / 活躍用戶）+ 7/30 天趨勢圖 + Top 10 重度使用者。錯誤日誌 viewer 待 schema 加 error 欄位後另外做。
- [x] 客服工具：補發 Top-up（B2a）/ 延長 Pro 到期日（B2b）/ 寄自訂 email（B2c）— 2026-05-13 完成 ✅（待用戶側跑 [admin-cs-tools.sql](admin-cs-tools.sql)）
- [x] **NewebPay 訂閱資料整合（2026-05-22 完成）**：AdminUsers 列表方案標籤細分（早鳥/年繳/月繳/授予 Pro），加退款警示 chip；展開詳情新增「Pro 月繳訂閱 NPA」區塊（已扣期數 + lifetime revenue + 下次扣款日 + 取消備註）；AdminRevenue 加 NPA 月繳 MRR + Top-up 累計營收兩張卡，MRR 公式改「per-user × 月攤分」加總，退款率分母校正為「所有歷史年繳已付款訂單」。
- [x] **用戶活躍分析 AdminActivity（2026-06-13 完成）**：以「最後一次產品行為」（aivis 掃描/網站掃描/新增網站/批次掃描）把全用戶分 5 群（活躍 ≤7 天/一般 8-30/沉睡 31-90/不活躍 >90/新註冊未啟用），KPI 卡可點擊過濾 + 分布條 + 兩張行動名單：⚠️ 流失風險（付費中但 30 天沒動 → 客服關懷）、💎 升級潛力（Free 但高頻活躍 → 行銷對象）。規模備忘：單來源 120 天事件 >1000 row 時改 Supabase RPC GROUP BY。

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

- **websites「一頁一筆」→ 改版用「依網域分組」解（2026-07-28 定案，不做破壞性 migration）**：websites 以「完整 URL（含路徑）＋user_id」為鍵，同站不同頁各建一筆（[HomeDark.jsx:481](src/pages/HomeDark.jsx) 的 normalizeUrl 只統一 www/斜線/query，**不拿掉路徑**）。2026-07-28 診斷（每用戶 row 數 vs distinct host）：重複幾乎**只集中在 1 個用戶**（`882810a8`：96 row→3 站、93 筆重複頁），其餘用戶乾淨。那些「重複頁」其實是不同頁的**真實體檢紀錄**，硬合併會刪真資料 → **決定不合併、不刪 row**。改版改在查詢/UI 層「依正規化 host 分組」呈現「一站一卡」，站數計數改算 distinct host（現行 [HomeDark.jsx:367](src/pages/HomeDark.jsx) 的 `myWebsites.length` 是算 row／算頁、且主掃描流程沒硬擋上限＝顯示/計數誤導、非阻擋 bug）。品牌↔網站關聯已於 Batch 1 backfill 到 `aivis_brands.website_id`（連到該網域首頁那筆）。
- ~~**pilotoptical.com.tw 類 analyzer 失敗診斷**~~（2026-05-22 已查到並修復）：根因是 SSL 憑證鏈不完整（`UNABLE_TO_VERIFY_LEAF_SIGNATURE`），台灣很多小網站都這樣設定。已在 [api/fetch-url.js](api/fetch-url.js) 加 SSL 容錯 fallback（undici Agent 放寬驗證重試）。
- **前端錯誤回報強化**（2026-05-22 加入待辦）：HomeDark.jsx analyzer 流程 try/catch 只有 `console.error`，掛了沒寫進 DB 也沒回報給用戶。建議加錯誤紀錄表 `error_logs` 寫進 supabase（user_id、url、step、error_code、created_at），方便客服日後查具體錯誤訊息。
- ~~`/content-audit`~~：✅ 已完成。15 項檢測（內容結構/字數/Meta/AEO/E-E-A-T/可讀性），免費看分數+清單，Pro 解鎖修復建議
- ~~`/ga4-report/:id` + `/gsc-report/:id`~~：**已下線（2026-05-26）** — 客戶實際使用率太低（要自己去 Google 後台拿 Property ID / 驗證網站太繁瑣），整套 GA4/GSC 整合（含 OAuth flow、Dashboard 區塊、報告詳情頁、3 個 service、6 個檔案）刪光光。未來若要重新接，需重建 service + OAuth + 後端 endpoint（會撞 Vercel 函數上限，需合併進 `api/google-data.js` 用 `?action=` 路由）
- `/crawl-check`：爬蟲可達性專項檢測頁（含終端機日誌動畫），對標 washinmura.jp
- Agency 方案升級流程
- n8n 自動化排程（設計已完成，待串接）
- 每週報告 Email（`/api/cron-weekly-reports.js` 已建，每週一 09:00）
