# AARK AI 能見度儀表板

> 檢測網站在 AI 搜尋引擎（ChatGPT、Perplexity、Google AI、Claude）的「被看見程度」— 五大面向分析（SEO / AEO / GEO / E-E-A-T / 內容品質）+ AI 曝光監測（aivis）+ 平台別修復指南

**線上網址**: https://aark-workspace.vercel.app
**公司**: 優勢方舟數位行銷
**GitHub**: https://github.com/aark-younjung/aark-workspace

---

## 方案對照表

| 功能 | 免費版 | Pro 版 NT$1,490／月（年繳 NT$13,900，省 22%） | Agency 版（即將推出） |
|------|--------|------------|-----------------------|
| **網站追蹤數** | 3 個 | 15 個 | 50 個 |
| **5 大面向分數** | ✅ SEO / AEO / GEO / E-E-A-T / 內容品質 | ✅ 完整 + 修復碼產生器 | ✅ + 白標 |
| **AI 曝光監測（aivis）** | 🔒 | ✅ **每月 150 次查詢額度** | ✅ + 解除月上限 |
| **AI 優化建議** | 3 條 | 完整清單 + P1/P2/P3 優先級 | + 多客戶工作區 |
| **平台別修復指南** | 🔒 | ✅ WordPress / Shopify / Wix / HTML | ✅ |
| **歷史趨勢圖** | 🔒 | ✅ | ✅ |
| **PDF 報告匯出** | 🔒 | ✅ | ✅ 白標 |
| **Email 週報訂閱** | 🔒 | ✅ | ✅ |
| **競品比對** | 2 個 | 4 個 | 4 個 |
| **文章內容分析** | 基本版 | 完整版（15 項 + 修復建議） | 完整版 |
| **客服支援** | 社群 | 一般 | 優先客服 |

**aivis Top-up 加購（隱藏於定價頁，just-in-time 揭露）**：超過月內含 150 次後可加購一次性次數包，小包 NT$490／+300 次、大包 NT$990／+800 次，**不過期、用完為止、不綁訂閱**。每月查詢硬上限 1,000 次（Agency 推出後解除）。

**承諾**：
- ✨ **7 天免費試用** — Pro 全功能試用 7 天（aivis 試用上限 50 次）
- 🛡 **14 天無條件退款** — 限年繳方案（月繳不退款）
- 🐣 **早鳥優惠** — 正式上線後 4 週內、前 100 名享首年 NT$990／月（年繳 NT$11,880），雙條件擇先觸發

---

## 功能說明

### 五大面向分析（各有獨立詳細報告頁）
| 模組 | 路由 | 檢測項目 |
|------|------|----------|
| SEO 分析 | `/seo-audit/:id` | Meta 標題/描述、H1 結構、Alt 覆蓋率、行動版相容、Core Web Vitals |
| AEO 分析 | `/aeo-audit/:id` | JSON-LD、FAQ Schema、Canonical、麵包屑、Open Graph、問句標題、結構化答案 |
| GEO 分析 | `/geo-audit/:id` | llms.txt、AI 爬蟲開放、Sitemap、OG/Twitter Card、JSON-LD 引用、HTTPS |
| E-E-A-T 分析 | `/eeat-audit/:id` | 作者資訊、關於我們、聯絡方式、隱私權政策、Organization Schema、社群連結 |
| 文章內容分析 | `/content-audit` | 15 項 SEO/AEO 檢測（H1/字數/Title/Meta/Schema/可讀性等），ad-hoc URL 即時分析 |

### AI 曝光監測模組（aivis）— Pro 核心功能
**為什麼需要**：SEO 修復是一次性的，但 AI 引用率天天在變、競爭對手天天在優化。aivis 用真實 Claude API 跑使用者口吻的中性 prompts，量化品牌在 AI 答案中的能見度。

- `/ai-visibility` — 品牌列表與新增
- `/ai-visibility/:id` — 單一品牌儀表板
- 自動產生 5 條中性測試 prompts（含地區型/預算型/痛點型/業種型/比較列表型 5 種切角）
- 手動觸發掃描：對每條 active prompt 跑 3 runs Claude Haiku 4.5（單次掃描 ~$0.006 USD）
- 30 天趨勢、品牌提及率、競品矩陣（Phase 2c.2 待開發）
- 用量超過 80% 顯示 Top-up Banner，超過 150 次自動引導加購

### 內容與 SEO 工具（Pro 解鎖完整版）
- 5 條 AI 優化建議（依面向分類 + P1/P2/P3 優先級）
- 修復碼產生器：llms.txt / JSON-LD / FAQ Schema 一鍵複製
- 平台別修復指南：WordPress / Shopify / Wix / 自架 HTML 四套逐步操作 + 程式碼
- 競品比對（最多 4 個網站 vs 自家）

### 後臺管理系統（is_admin = true 才可進）
| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/admin` | AdminDashboard | 總覽（用戶數、付費 Pro 數、MRR、最新用戶）|
| `/admin/users` | AdminUsers | 用戶列表 + 搜尋 + 展開明細（Top-up 餘額 / 已分析網站 / API 成本）+ 手動升降級 Pro |
| `/admin/websites` | AdminWebsites | 掃描紀錄 + 四大分數 + 直接跳客戶儀表板 |
| `/admin/revenue` | AdminRevenue | MRR（區分付費 vs 手動授予）+ 近 6 月增長圖 |
| `/admin/announcements` | AdminAnnouncements | 站內公告 CRUD（4 種類型 / 對象篩選 / 期間排程）|

### 站內公告系統
- 4 種類型（info 藍 / warn 琥珀 / promo 橘紅漸層 / success 綠）
- 對象區隔（全部 / 免費 / Pro）+ 期間排程（datetime-local）
- 用戶可關閉，dismiss 寫入 localStorage（換瀏覽器會再出現，刻意設計）
- 自動掛載於：HomeDark / Dashboard / AIVisibilityDashboard

### 帳號系統
- Email / 密碼 註冊登入
- Google OAuth 登入（Supabase Auth）
- In-App Browser 偵測 + 引導開啟系統瀏覽器（解決 FB / LINE / IG 內建瀏覽器被 Google 擋的問題）
- 行銷同意 checkbox（GDPR 合規）

---

## 技術堆疊

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite 8 |
| 樣式 | Tailwind CSS v4 |
| 路由 | React Router DOM v7 |
| 圖表 | Recharts |
| 資料庫 / Auth | Supabase (PostgreSQL + RLS) |
| Serverless API | Vercel Functions（Hobby 方案） |
| 部署 | Vercel（push main 自動部署） |
| AI 模型 | Anthropic Claude Haiku 4.5（aivis 模組） |
| 支付（Phase 1） | NewebPay 藍新金流 MPG（NT$、本地客戶優先） |
| 支付（Phase 2） | Stripe Checkout（國際 / USD，Stripe Atlas 申請中） |
| PDF 匯出 | jsPDF + html2canvas |

---

## 專案結構

```
aark-workspace/
├── api/                                # Vercel Serverless Functions
│   ├── aivis/
│   │   ├── fetch.js                    # 對指定 prompt 跑 N 次 Claude，寫 responses/mentions
│   │   ├── generate-prompts.js         # Claude 讀品牌資料自動產 5 條中性 prompts
│   │   ├── checkout-topup.js           # Stripe Top-up 結帳（Phase 2 備用）
│   │   └── checkout-topup-newebpay.js  # NewebPay Top-up 結帳（Phase 1 主要）
│   ├── lib/
│   │   └── newebpay.js                 # NewebPay AES + SHA256 加解密 helper
│   ├── fetch-url.js                    # 網站抓取 proxy（解決 CORS）
│   ├── ga4-data.js                     # GA4 Data API proxy
│   ├── gsc-data.js                     # Google Search Console API proxy
│   ├── create-checkout-session.js      # Stripe Pro 訂閱結帳
│   ├── stripe-webhook.js               # Stripe Webhook（Pro 訂閱 + Top-up 入帳）
│   ├── newebpay-notify.js              # NewebPay NotifyURL（驗 sha + 解密 + 入帳）
│   ├── cancel-subscription.js          # Stripe 取消訂閱
│   ├── send-report-email.js            # 發送週報 Email
│   └── cron-weekly-reports.js          # 週報排程（每週一 09:00）
├── src/
│   ├── components/
│   │   ├── v2/                         # 共用設計系統（GlassCard / Btn / AuditHero / IssueBoard 等）
│   │   ├── AnnouncementBanner.jsx
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── pages/
│   │   ├── HomeDark.jsx                # 首頁（暗黑主視覺）
│   │   ├── Dashboard.jsx               # 主儀表板
│   │   ├── SEOAudit / AEOAudit / GEOAudit / EEATAudit.jsx
│   │   ├── ContentAudit.jsx            # 文章內容分析
│   │   ├── AIVisibility.jsx            # aivis 品牌列表
│   │   ├── AIVisibilityDashboard.jsx   # aivis 單一品牌儀表板（含 Top-up Modal）
│   │   ├── GA4Report.jsx / GSCReport.jsx
│   │   ├── Pricing.jsx / FAQ.jsx
│   │   ├── Showcase.jsx / Compare.jsx
│   │   ├── Login.jsx / Register.jsx / Account.jsx
│   │   ├── admin/                      # 後臺管理（AdminDashboard / Users / Websites / Revenue / Announcements）
│   │   └── _legacy/                    # 已下線的橘白版頁面備存
│   ├── services/
│   │   ├── seoAnalyzer.js / aeoAnalyzer.js / geoAnalyzer.js / eeatAnalyzer.js
│   │   ├── contentAnalyzer.js          # 文章內容 15 項檢測
│   │   ├── ga4Analyzer.js / gscAnalyzer.js
│   │   ├── googleAuth.js               # GA4/GSC OAuth
│   │   └── pdfExport.js
│   ├── lib/
│   │   ├── supabase.js
│   │   └── inAppBrowser.js             # FB/LINE/IG webview 偵測 + 引導
│   ├── styles/
│   │   └── v2-tokens.js                # 設計系統 design tokens
│   ├── App.jsx                         # 路由設定（含 ScrollToTop）
│   └── main.jsx
├── *.sql                               # Supabase migration scripts
├── vercel.json                         # Cron 設定
└── CLAUDE.md                           # AI 助理開發指引
```

---

## 環境變數

### Supabase
| 變數名 | 用途 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 專案 URL（前端） |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key（前端） |
| `SUPABASE_URL` | Supabase URL（server-side） |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（webhook / notify / cron 用） |

### Google OAuth（GA4/GSC，目前已暫時隱藏入口）
| 變數名 | 用途 |
|--------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID |

### Anthropic（aivis）
| 變數名 | 用途 |
|--------|------|
| `ANTHROPIC_API_KEY` | Claude API Key（Console 申請） |

### Stripe（Phase 2 國際金流）
| 變數名 | 用途 |
|--------|------|
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_PRICE_ID` | Pro 月繳 Price ID |
| `STRIPE_PRICE_ID_YEARLY` | Pro 年繳 Price ID |
| `STRIPE_PRICE_ID_EARLYBIRD` | 早鳥優惠 Price ID |
| `STRIPE_TOPUP_SMALL_PRICE_ID` | Top-up 小包 NT$490 |
| `STRIPE_TOPUP_LARGE_PRICE_ID` | Top-up 大包 NT$990 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 簽章驗證 |

### NewebPay 藍新金流（Phase 1 主要金流）
| 變數名 | 用途 |
|--------|------|
| `NEWEBPAY_MERCHANT_ID` | 商家代號（MS 開頭） |
| `NEWEBPAY_HASH_KEY` | 32 字元 AES key |
| `NEWEBPAY_HASH_IV` | 16 字元 AES IV |
| `NEWEBPAY_API_URL` | 沙盒 `https://ccore.newebpay.com/MPG/mpg_gateway` / 正式 `https://core.newebpay.com/MPG/mpg_gateway` |

### 其他
| 變數名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_SITE_URL` | 網站網址（金流回調用） |

---

## Supabase 資料表

### 核心
| 資料表 | 說明 |
|--------|------|
| `profiles` | 使用者資料（is_pro, is_admin, marketing_consent, stripe_subscription_id, payment_gateway, subscribed_at） |
| `websites` | 分析的網站記錄（user_id + url 雙鍵） |
| `seo_audits` / `aeo_audits` / `geo_audits` / `eeat_audits` | 四大面向分析結果（JSONB） |
| `email_subscriptions` | Email 週報訂閱記錄 |

### aivis（AI 曝光監測）
| 資料表 | 說明 |
|--------|------|
| `aivis_brands` | 使用者追蹤的品牌主檔 |
| `aivis_prompts` | 每個品牌的測試 prompts（每 brand 最多 10 條，trigger 強制） |
| `aivis_responses` | Claude 每次回應原始資料 + 成本 |
| `aivis_mentions` | 從 responses 偵測到的品牌提及（含位置 / 上下文片段） |
| `aivis_topup_credits` | Top-up 加購餘額（gateway: stripe / newebpay） |
| `aivis_newebpay_pending` | NewebPay 訂單暫存（用 MerchantOrderNo 反查 user/pack/quota） |

### 後臺管理 / 站內公告
| 資料表 | 說明 |
|--------|------|
| `announcements` | 站內公告（kind / target / starts_at-ends_at / is_active） |

---

## 付款流程

### Phase 1（目前 — NewebPay 藍新金流，本地 NT$ 客戶）
- **Top-up 一次性付款**：前端 fetch `/api/aivis/checkout-topup-newebpay` → 拿到 `{ apiUrl, fields }` → 動態建 form + hidden inputs → form.submit() 整頁跳轉
- **NotifyURL**：`/api/newebpay-notify` 驗 TradeSha → 解密 TradeInfo → 從 pending 表查回 user/pack/quota → 寫入 `aivis_topup_credits`
- **Idempotency**：`source_payment_id = nwp_{TradeNo}` UNIQUE 約束防 retry 重複入帳
- **狀態**：商家審核中（1-2 週），程式碼已就緒等沙盒金鑰驗證

### Phase 2（規劃中 — Stripe Atlas 國際 USD）
- **Stripe Checkout 訂閱**：`checkout.session.completed` → `profiles.is_pro = true`、`customer.subscription.deleted` → `is_pro = false`
- **Top-up 一次性**：`session.mode = 'payment'` + `metadata.kind = 'aivis_topup'` → 寫入 `aivis_topup_credits`（gateway='stripe'）
- **狀態**：Stripe Atlas 申請流程啟動中（aark6465 帳號被鎖香港）

---

## 本地開發

```bash
cd aark-workspace
npm install
npm run dev
```

`.env.local`（最少必填）：
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
```

完整變數見「環境變數」段。

---

## 上線前 Checklist

- [ ] NewebPay 商家審核通過 + 沙盒金鑰填入 Vercel env vars + 沙盒端到端實測一次
- [ ] Supabase SQL Editor 跑 `newebpay-pending-orders.sql`
- [ ] NewebPay 後台 NotifyURL 白名單設 `https://aark-workspace.vercel.app/api/newebpay-notify`
- [ ] Stripe 自動退款流程驗證（年繳 14 天）
- [ ] Supabase Auth 限制單 IP / 單裝置註冊頻率（避免 7 天試用被刷）
- [ ] Pricing 頁社會證明區 4 格 KPI（127 品牌 / 3,847 報告 / 43 進 AI 推薦 / 4.7 滿意度）改為動態查詢
- [ ] Google OAuth consent screen 送審（解除 GA4/GSC 入口隱藏）

---

## 版本記錄

| 日期 | 更新內容 |
|------|----------|
| 2026-05-11 | **NewebPay 藍新金流 Phase 1 Step 1 完成**：Top-up MPG 一次性付款後端 + 前端串接。新增 aivis_newebpay_pending 暫存表、newebpay.js 加解密 helper、checkout-topup-newebpay endpoint、newebpay-notify NotifyURL handler，前端 handleBuy 切換為 NewebPay form-submit 流程。Stripe code 完整保留供 Phase 2 切回 |
| 2026-05-10 | Dashboard 5 張分數卡可點進詳情頁、全站路由切換自動捲回頂端（App.jsx ScrollToTop） |
| 2026-05-07 | 站內公告系統上線：announcements 表 + AdminAnnouncements 後臺 CRUD + AnnouncementBanner 公開元件（HomeDark / Dashboard / aivis 三處掛載） |
| 2026-05-07 | aivis Top-up 後端串接完成：Stripe 一次性付款 + aivis_topup_credits 表 + fetch.js 額度攔截 + TopupModal 接 Stripe Checkout（Phase 2 備用） |
| 2026-05-07 | Pricing FAQ details/summary 嵌套 bug 修復 + aivis Dashboard 月內含額度 banner / Top-up modal UI |
| 2026-05-06 | aivis 從獨立加購收回 Pro 核心（5 LLM 共識）：Pro 內含每月 150 次（原 100），移除獨立訂閱方案，改為超量 Top-up 一次性次數包，硬上限 1,000 次/月 |
| 2026-05-04 | Pricing 頁全面重構（A+B+C+D 11 區塊）：Hero 痛點問句、社會證明區、痛點教育區、Pro 卡平台支援、Ahrefs 競品比較、Sticky 早鳥 bar、Sticky bottom CTA、FAQ 恐懼標籤、底部雙路 CTA |
| 2026-05-04 | 定價策略大改版：Pro 年費 NT$14,900 → NT$13,900（22% off）、7 天試用 + 14 天退款雙保證、早鳥從「永久 NT$990」改為「4 週 + 100 名 / 首年」、Agency NT$3,990 → NT$4,990 |
| 2026-04-27 | **設計系統 v2 上線**：抽出 v2-tokens.js + GlassCard / Btn 共用元件，HomeDark / Dashboard / 5 個 audit 頁 / Pricing / FAQ / Login / Register / Account / Showcase / Compare 全站套用暗色 + 青綠漸層底 + 玻璃擬態卡片 |
| 2026-04-26 | **aivis Phase 2 端到端串通**：新增 fetch.js（Claude Haiku 跑 N runs）+ generate-prompts.js（自動產 5 條中性 prompts，5 種切角真人化）+ aivis_prompts/responses/mentions 三表 + 10 條上限 trigger |
| 2026-04-26 | P0 修復 — In-App Browser 偵測 + 引導：FB/LINE/IG webview 內建瀏覽器被 Google OAuth 擋（403 disallowed_useragent），新增 inAppBrowser.js + 兩層引導（banner + modal）+ Android intent:// 跳 Chrome |
| 2026-04-25 | 營收儀表板數字治理：補 profiles.subscribed_at 欄位、AdminDashboard MRR 邏輯與 AdminRevenue 對齊（區分付費 vs 手動授予）、清個人帳號的 Stripe 測試訂閱資料 |
| 2026-04-24 | Bug 修復：新客戶分析資料無法在後台顯示（websites 查詢改為 url + user_id 雙鍵）；AdminGuard 未登入導向修正；儀表板「升級 Pro」按鈕改先導向 /pricing |
| 2026-04-24 | 後臺資料可見性修復：新增 is_admin() helper + admin RLS policies（覆蓋 profiles / websites / 4 大 audit 表）；AdminUsers / AdminWebsites 加「查看儀表板」開新分頁 |
| 2026-04-23 | **AI 曝光監測模組（aivis）Phase 1 基礎建置**：aivis_brands 表 + RLS、/ai-visibility 品牌列表 + 新增表單、/ai-visibility/:id 單一品牌儀表板骨架、Dashboard 加入口橫幅卡 |
| 2026-04-22 | 暗黑版升格為主視覺：ThemeContext 預設 isDark=true，/dark 路由移除，原橘白首頁搬至 _legacy/ 備存 |
| 2026-04-19 | Dashboard 強化：SEO 雷達圖加「建議目標」第二條虛線、優化建議 P1/P2/P3 優先級、四大分數白話判定語、新增第五張「內容品質」分數卡、「被 AI 引用條件」checklist（8 項） |
| 2026-04-15 | **後臺管理系統第一階段上線**：/admin 總覽、/admin/users 用戶管理（手動升降級 Pro）、/admin/websites 掃描紀錄、/admin/revenue 營收儀表板 |
| 2026-04-15 | 新增「通知搜尋引擎」功能（Google + Bing Sitemap ping）、移除 AI 搜尋關鍵字 Tab、清除 Email 死碼 |
| 2026-04-10 | /content-audit 文章分析頁：15 項指標（內容結構/字數/Meta/AEO/E-E-A-T/可讀性），免費看分數 Pro 解鎖修復建議 |
| 2026-04-10 | GA4/GSC 詳細報告頁（/ga4-report/:id、/gsc-report/:id）+ FAQ 頁（含 FAQPage JSON-LD） |
| 2026-04-10 | Pro 鎖定完善：修復碼產生器、歷史趨勢圖加 isPro 判斷（免費顯示模糊預覽 + 升級提示）；網站追蹤上限 Pro 5 → 15 |
| 2026-04-02 | Stripe 付款流程（月繳/年繳/早鳥、Webhook 自動更新 is_pro、自助取消訂閱）+ /pricing 定價頁 + /account 帳號設定 |
| 2026-04-02 | 平台別修復指南（Pro 限定）：WordPress / Shopify / Wix / 自架 HTML 四套逐步操作 + 程式碼 |
| 2026-04-02 | sitemap.xml、robots.txt（含 AI 爬蟲規則）、SEO meta 標籤 |
| 2026-03-31 | 首頁新增即時爬蟲動態區塊（8 AI 爬蟲 + 5 搜尋引擎爬蟲）+「AI 即時讀取」跑馬燈（最近 15 筆分析） |
| 2026-03-30 | SEO 詳情頁建立 + Pro 優化路線圖 + Free vs Pro 全面分界 + 自動抓取網站名稱 |
| 2026-03-30 | 「最近被 AI 讀取」功能：Showcase 排行榜新 tab + 目錄 🤖 badge + Dashboard 標頭顯示 AI 讀取時間 |
| 2026-03-29 | GA4/GSC 串接完成（Google OAuth 隱式流程） |
| 2026-03-28 | Google OAuth 登入（Supabase Auth）+ 行銷同意 checkbox + Stripe 付款流程 Serverless Functions |
