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
- **7 天免費試用 end-to-end 驗證** — trial flag 寫入 / 到期前 email 提醒 / 到期自動轉訂閱 or 降回 Free 全鏈未測
- **NewebPay 沙盒測試 Phase 1 Step 1**（Top-up）— 等沙盒帳號核發後即可測
- **NewebPay Phase 1 Step 2（Pro 年繳一次性 NT$13,900）** — 未開發，14 天退款的前置
- **NewebPay 退款 API 串接**（信用卡走 API 直退 / VACC・WEBATM 走手動轉帳指引）+ 串到 Account 取消按鈕 + 14 天彈退款確認 modal — 沙盒到手後 1 週內可完成（不用等正式審核）
- **NewebPay 正式商家審核通過** → 換 env vars 上線（被動等待 1-2 週）

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

### 2026-05-12
**NewebPay 商家審核退件修復 — 補上 3 個法律頁 + Footer 揭露商家資訊:**
- 🐛 **退件起因**：NewebPay 商家審核回覆「暫時拒絕」，兩個原因 — (1) 網站客服聯絡資訊與商家申請資料不一致（網站上沒揭露負責人姓名、營業地址、客服電話）(2) 缺少法律頁三件套（消費者權益、服務條款、隱私權政策）。這兩個是 NewebPay 對所有電商商家的硬性審核要求，沒做完不會核發正式商家代號。
- ✅ **新增 [src/pages/legal/LegalPageLayout.jsx](src/pages/legal/LegalPageLayout.jsx) 共用外殼**：三個法律頁共用同一個 wrapper — PageBg（155deg 青綠→深藍頂部漸層 2400px + 雜訊 0.12/overlay）+ SiteHeader + 標題 hero（title / subtitle / lastUpdated）+ GlassCard color={T.orange} padding 40px 32px + 底部 mailto + Footer dark。內聯 `<style>` 定義 `.legal-content` 排版規則（h2 1.35rem + border-bottom / h3 1.05rem / p line-height 1.75 / ul padding-left 1.4rem / strong text-white / a orange underline / .highlight-box 橘色左側邊框 + 半透明橘底）— 三頁的條文格式統一，未來改字級只動這裡。
- ✅ **新增 [src/pages/legal/Terms.jsx](src/pages/legal/Terms.jsx) 服務條款**：11 章 — (1) 服務提供者（完整商家資訊：商店名稱 / 營運單位 / 負責人陳泓翔 / 地址 701 台南市東區怡東路 86 巷 10 號 / 客服信箱 aark.younjung@gmail.com / 電話 0952-555-365 / 服務時間週一至週五 10:00–18:00）(2) 服務內容（SaaS 四大檢測 + aivis + PDF / 連到 /pricing）(3) 帳號註冊（18 歲、不實資料停權）(4) 付款與訂閱方案（月繳 NT$1,490 / 年繳 NT$13,900 / Top-up 小包 NT$490 大包 NT$990 / 7 天試用 / 自動續訂 / 透過藍新金流 NewebPay 收款不存卡號）(5) 智慧財產權（本服務 vs 您的內容雙向授權）(6) 使用限制（禁 bot 刷單 / 反向工程 / 違法網站 / 轉售報告 / 病毒）(7) 服務變更暫停終止 (8) 免責聲明（現狀提供 / 第三方依賴 / 責任上限 = 過去 12 個月實付金額）(9) 條款修改公告 7 日生效 (10) 準據法 = 中華民國 / 第一審管轄法院 = 臺灣臺南地方法院 (11) 聯絡我們。
- ✅ **新增 [src/pages/legal/Privacy.jsx](src/pages/legal/Privacy.jsx) 隱私權政策**：11 章對齊個資法施行細則 — (1) 適用範圍（aark-workspace.vercel.app + 不適用第三方連結）(2) 蒐集項目 4 類（註冊 Email/姓名/密碼 bcrypt 加密/Google OAuth/行銷同意 / 付款資料由藍新處理本公司不存卡號 / 服務使用紀錄含 IP/UA/aivis 品牌 / Cookie 含 Supabase auth + localStorage）(3) 蒐集目的 6 個個資法代碼（040 行銷 / 069 契約 / 090 消費者管理 / 148 網路購物 / 152 廣告管理 / 157 統計研究）(4) 利用方式（期間 / 地區含 Supabase 美國 + Vercel 全球 / 對象與 6 種利用）(5) 第三方處理者 6 家（Supabase / Vercel / 藍新金流 / Anthropic / Google / Cloudflare，標 SOC 2 / PCI DSS 認證）(6) 資料安全（HTTPS TLS 1.2+ / bcrypt / RLS / Service Role / 72 小時外洩通報義務）(7) 保存與刪除（帳號 30 天緩衝 / 稅法 7 年 / 系統日誌 90 天 / 7 個工作天內處理刪除申請）(8) 您的權利 5 項依個資法第 3 條（查詢/閱覽/複本/補充更正/停止/刪除）(9) 未成年人保護 (10) 政策修改 (11) 聯絡我們（含負責人陳泓翔）。
- ✅ **新增 [src/pages/legal/ConsumerRights.jsx](src/pages/legal/ConsumerRights.jsx) 消費者權益保障**（NewebPay 審核最關鍵的一頁）：11 章 — (1) 服務商基本資訊 highlight-box 完整商家資訊 (2) 商品（服務）內容 (3) 付款方式與流程（含費用結構 + 信用卡/ATM/超商代碼/超商條碼 + 電子發票寄送 Email）(4) **7 天鑑賞期說明（關鍵章節 highlight-box）** — 明確援引《通訊交易解除權合理例外情事適用準則》第 2 條第 5 款排除消保法第 19 條 7 天鑑賞，理由「數位內容或一經提供即為完成之線上服務」。為保障消費者提供 3 個替代措施：7 天免費試用 / 14 天無條件退款（年繳）/ 月繳隨時取消 (5) 退款政策（年繳 14 天全額 / 月繳不退 / Top-up 不退 / 例外退款情形：服務中斷 72 小時 / 重大變更 / 重複扣款 / 法律規定）(6) 退款申請流程（客服回覆 3 工作天 + 審核 7 工作天 + 信用卡 7-14 工作天 / ATM 3-5 工作天到帳）(7) 自動續訂取消（隨時於 /account 取消）(8) 發票政策（電子發票二聯/三聯 + 統編公司戶 + 退款開折讓單）(9) 爭議處理（客服 → 信用卡爭議款 → 各縣市消保中心 1950 / 行政院消保處 → 訴訟管轄合意臺南地院但不影響消保法 47 條 + 民訴 436 條之 9 消費者就近起訴權）(10) 政策修改 (11) 聯絡我們。
- ✅ **[src/App.jsx](src/App.jsx) 加 3 條法律頁路由**：`/terms` / `/privacy` / `/consumer-rights`，import 三個元件分群在 `// 法律頁` 註解區。放在 `*` catch-all 之前確保命中。
- ✅ **[src/components/Footer.jsx](src/components/Footer.jsx) 整段改寫為 4 欄式 + 商家資訊區 + 法律連結列**：原本 3 欄（品牌/快速連結/聯絡我們），改為 4 欄響應式 grid（`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`）— 第 1 欄品牌 logo + 標語 / 第 2 欄快速連結 / **第 3 欄新增「商家資訊」**（營運單位 / 負責人 / 地址 / 電話 / 服務時間，全部小字 text-xs 不擠版面）/ 第 4 欄聯絡我們（保留橘色 mailto 按鈕）。底部新增法律連結列（border-t pt-6）— 4 顆橫向 link「服務條款 · 隱私權政策 · 消費者權益保障 · 常見問題」置中排列。Brand 名從「優勢方舟數位行銷」改為「AI能見度（AIVIS）」與 NewebPay 商家申請的商店名稱一致。
- ✅ **parse 驗證**：5 個新增/改動檔案（[LegalPageLayout.jsx](src/pages/legal/LegalPageLayout.jsx) / [Terms.jsx](src/pages/legal/Terms.jsx) / [Privacy.jsx](src/pages/legal/Privacy.jsx) / [ConsumerRights.jsx](src/pages/legal/ConsumerRights.jsx) / [Footer.jsx](src/components/Footer.jsx) / [App.jsx](src/App.jsx)）待 commit 前 node + @babel/parser 跑過。
- 🔖 **取捨：7 天鑑賞期改用「排除 + 替代保障」雙條款設計**：原本可以走「無條件 7 天退款」（消保法第 19 條標準解法），但 SaaS 服務一旦開通用戶就能立刻吃掉 aivis 試用額度 50 次 / 跑完整網站 audit + 拿 PDF 報告，等於整套產品都用過了。法律上《通訊交易解除權合理例外情事適用準則》第 2 條第 5 款明確允許「數位內容或一經提供即為完成之線上服務」排除 7 天鑑賞 — 寫進條款援引法源 + highlight-box 醒目顯示 + 完成付款前再次勾選同意。同時為了不讓消費者覺得權益被剝奪，主動提供 3 條替代保障（7 天免費試用 = 不付錢先試 / 14 天無條件退款 = 年繳保險 / 月繳隨時取消 = 月繳保險），總體上對用戶更友善。
- 🔖 **取捨：管轄法院寫「合意臺南地院」但「不影響消費者依消保法第 47 條向住所地法院起訴之權利」**：原本可以只寫「合意臺灣臺南地方法院」，但消保法第 47 條 + 民訴法第 436 條之 9 規定消費爭議消費者可向自己住所地法院起訴（不受合意管轄拘束），如果條款蠻橫寫死「一律臺南地院」會被法院判決「不利於消費者部分無效」反而難看。明白標出消費者保留權利、雙方都受保護，這是合規操作。
- 🔖 **取捨：商家資訊放 Footer 第 3 欄而非獨立頁面**：NewebPay 審核重點是「網站上能看到」這些資訊，不限於某一頁。放 Footer 每頁都看得到、不會有訪客找不到的問題；獨立頁面用戶不一定會點進去。Footer 5 行小字 text-xs 不會擠到視覺主體。
- 🔖 **取捨：Brand name 從「優勢方舟數位行銷」改為「AI能見度（AIVIS）」**：NewebPay 商家申請的商店名稱是「AI能見度」這個產品名（不是公司名），Footer logo 名稱要對齊商店名稱才能通過審核「商店名稱與網站一致性」這項。公司名「優勢方舟數位行銷」改為放在商家資訊區的「營運單位」欄位。
- ⚠️ **用戶側待辦（送回 NewebPay 之前）**：(1) 確認三個法律頁部署到 Vercel 並可從 Footer 連結點到 (2) 進 NewebPay 商家後台「補件」或回信給審核人員，提供三個 URL：`https://aark-workspace.vercel.app/terms` / `/privacy` / `/consumer-rights`，並說明客服資訊已揭露於 Footer (3) 等待二次審核（約 3-5 個工作天）。

### 2026-05-12
**Vercel Hobby 12 functions 上限破表修復 — 把 4 個休眠 API 搬到 `_archived/`:**
- 🐛 **問題起因**：Turnstile env var 設好後 redeploy，Vercel build 出現 `Build Failed: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`。原因是 2026-05-11 NewebPay Phase 1 Step 1 新增 3 個 API（`api/aivis/checkout-topup-newebpay.js` / `api/newebpay-notify.js` / `api/lib/newebpay.js` 不算 function 但前兩個算）+ `api/public-stats.js`（A5 KPI dynamic）→ 累積到 15 個 functions，破 Hobby 12 上限。連帶 12 小時前的 NewebPay commit 與 11 小時前的 README commit 都已經炸過、用戶當時沒注意；剛剛 Turnstile redeploy 才回頭發現。
- ✅ **建 `_archived/api/` 目錄收納休眠檔**：Vercel 只認 `api/` 底下檔案為 serverless function，把不在用的搬到 `_archived/` 就不算 function；git 還在、未來要復用直接搬回。
- ✅ **搬 4 個檔案（git mv 保 history）**：
  - `api/ga4-data.js` → `_archived/api/ga4-data.js`（GA4 入口已於 2026-04-28 隱藏，Google OAuth 未送審）
  - `api/gsc-data.js` → `_archived/api/gsc-data.js`（同上）
  - `api/aivis/checkout-topup.js` → `_archived/api/aivis/checkout-topup.js`（Stripe top-up，已被 NewebPay 取代）
  - `api/cancel-subscription.js` → `_archived/api/cancel-subscription.js`（Stripe Pro 訂閱取消，Phase 2 才用）
- ✅ **前端 fetch 引用安全性檢查**：grep `/api/(ga4-data|gsc-data|cancel-subscription|aivis/checkout-topup)` 共 7 處引用，全在「已隱藏 UI」或「已切換金流」的死路徑上 — `ga4Analyzer.js` / `gscAnalyzer.js` 雖仍 fetch，但 Dashboard 流量 tab 已 commented out 不會觸發；`Account.jsx` 取消訂閱按鈕只有 Stripe sub 用戶會點，目前無人有 Stripe sub（Pro 全是手動補升）；`AIVisibilityDashboard.jsx` 兩處只是註解，實際 fetch 已切到 `checkout-topup-newebpay`。即使有人誤觸 404 也只是「取消失敗」這種非關鍵流程，不影響核心使用。
- ✅ **functions 計數從 15 → 11**：安全壓在 12 以下，留 1 個額度給未來新 endpoint（例如 NewebPay refund API 串接時）。
- 🔖 **取捨：搬到 `_archived/` 不刪除**：CLAUDE.md 既有方針「Stripe code 完整保留供 Phase 2 切回」，刪除違反此原則。`_archived/` 不在 Vercel deploy 範圍，但 git track 著、IDE 也找得到，等於零成本保留。比起 git revert 或 stash，搬目錄這做法可逆性最強。
- 🔖 **取捨：不升級 Vercel Pro**：每月 $20 USD 固定成本，目前用戶基數還不到值得付的程度。等真的撞到 cron 100 次/天 / 4 個 cron jobs / build 時數等其他 Hobby 限制再考慮。
- ⚠️ **未來新加 API 注意事項**：再加 1 個就破 12 上限。優先考慮 (1) 多個小端點合併成單一 router file（`api/admin/index.js` 用 query param 分發） (2) 或刪掉真正不用的 — 例如 Stripe 三劍客（`stripe-webhook.js` / `create-checkout-session.js`）若決定 Phase 2 不切回也可搬走。

### 2026-05-11
**Cloudflare Turnstile + Supabase captchaToken 串接（上線前必修 #2 — 防 7 天試用刷單）:**
- 💡 **背景**：上線前必修清單第 2 項 — 防 bot 大量註冊刷 7 天 Pro 試用拿 aivis 150 次/月 × N 個帳號的無限掃描。3 個候選方案中選 Cloudflare Turnstile：免費、無圖片驗證（比 reCAPTCHA / hCaptcha 友善）、5–10 分鐘設定完，擋 80% bot 流量。同人手動多 email 的 case 留待裝置指紋（FingerprintJS）或 trial flag e2e 驗證階段再處理。
- ✅ **`npm install @marsidev/react-turnstile`**：用社群維護的 React wrapper（5KB，比直接拉 Cloudflare 原生 script 整潔）。提供 `<Turnstile ref onSuccess onExpire onError options>` API 與 `ref.current.reset()` 重置 widget 取新 token。
- ✅ **[src/context/AuthContext.jsx](src/context/AuthContext.jsx) signIn/signUp 加 captchaToken 參數**：兩個 function 都加可選 `captchaToken` 末端參數 → 帶進 `supabase.auth.signInWithPassword({ options: { captchaToken } })` 與 `supabase.auth.signUp({ options: { ...data, captchaToken } })`。Supabase Dashboard 啟用 CAPTCHA 後**兩個都會 enforce**（不只 signup），所以兩處都改。
- ✅ **[src/pages/Register.jsx](src/pages/Register.jsx) + [src/pages/Login.jsx](src/pages/Login.jsx) 加 Turnstile widget**：兩頁同模式 — `useRef` 拿 widget ref、`captchaToken` state、`<Turnstile theme="dark" size="normal">` 放在 submit 鈕上方。submit 鈕 `disabled={loading || !captchaToken}`，submit 前 guard `if (!captchaToken) return setError('請先完成人機驗證')`。失敗後 `turnstileRef.current?.reset() + setCaptchaToken('')` — Supabase 用過的 token 不能重送，每次失敗都要取新 token。
- ✅ **dev fallback site key**：`const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'` — Cloudflare 官方測試 key（永遠通過驗證），讓 dev 環境照常運作。Production 必須在 Vercel env 設真實 key 才有實際擋 bot 效果。
- ✅ **[.env.local](.env.local) 加 `VITE_TURNSTILE_SITE_KEY=` 空位**：含申請流程註解（Cloudflare Dashboard → Turnstile → Add Site，widget mode 選 Managed）+ Supabase Dashboard 啟用步驟註解 + 測試 key 標記。
- ✅ **parse 驗證**：[Register.jsx](src/pages/Register.jsx) + [Login.jsx](src/pages/Login.jsx) + [AuthContext.jsx](src/context/AuthContext.jsx) 全數 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：Turnstile 兩頁都加（不只 Register）**：Supabase Dashboard 的 CAPTCHA setting 是 site-wide — 啟用後 POST /signup / POST /token / POST /recover 三個 endpoint 都會強制要 captcha token。如果只 Register 加 widget，Login 會直接登入失敗。Login 也加 widget 反而是順帶得到「防暴力密碼破解」的副作用，沒壞處。
- 🔖 **取捨：dev 預設用 Cloudflare 測試 key 而非「env 沒設就不渲染 widget」**：4 個失敗模式中 (1) siteKey 空 + Supabase 沒啟用 = dev OK / (2) siteKey 有 + Supabase 啟用 = prod OK / (3) siteKey 空 + Supabase 啟用 = 用戶 stuck / (4) siteKey 有 + Supabase 沒啟用 = OK 但無效。模式 3 危險：如果 prod 漏設 env 但 Supabase 已啟用，前端不渲染 widget 但後端拒絕 → 用戶完全無法註冊。改為 fallback 測試 key 後，模式 3 變成「widget 渲染 + 拿 testing token + 後端通過驗證但實際無防護」— 沒擋到 bot 但至少用戶能註冊，failure mode 降一級。
- 🔖 **取捨：theme="dark" + size="normal"**：兩頁都是 dark 背景，dark widget 視覺融合。compact size（150x65px）太小用戶容易沒看到，normal（300x65px）剛好。
- 🔖 **取捨：失敗後 reset widget 取新 token**：Supabase Auth 端會 validate 每個 captcha token 只能用 1 次（防 replay attack）。如果失敗後讓用戶重 submit 沒 reset 就會永遠 fail，UX 很差。`ref.current.reset()` 自動 fetch 新 token，0.5 秒內就能再 submit。
- ⚠️ **用戶側待辦（部署前必做）**：
  1. **Cloudflare 申請 Turnstile**：https://dash.cloudflare.com → Turnstile → Add Site → 填 hostname `aark-workspace.vercel.app`（dev 加 `localhost`）→ Widget Mode: Managed → 拿 **Site Key**（public）+ **Secret Key**（private）
  2. **Vercel env vars**：`VITE_TURNSTILE_SITE_KEY=<site_key>` 加進 Production / Preview / Development 三環境
  3. **Supabase Dashboard 啟用 CAPTCHA**：Authentication → Attack Protection → CAPTCHA → Provider 選 Turnstile → 貼 **Secret Key** → Save
  4. **驗證**：dev 試註冊（用測試 key 應該秒過）→ prod 試註冊（應該彈 Turnstile 挑戰 1–3 秒）→ 試「同 email 重複註冊」確認 captcha 用過 1 次後需要重新挑戰

### 2026-05-11
**A5 社會證明 KPI 從 hardcode 改 dynamic query（上線前必修 #1 — 完成）:**
- 🐛 **問題起因**：[Pricing.jsx](src/pages/Pricing.jsx) line 388–410 的 4 格社會證明 KPI（127 個品牌 / 3,847 份報告 / 43 個品牌進入 AI 推薦名單 / 4.7／5 滿意度）是 2026-05-04 改版時硬寫的占位值（具體奇數比整數可信），但上線後若被識破會傷信任，是「上線前需確認」清單第 1 項。本次解掉。
- ✅ **新增 [api/public-stats.js](api/public-stats.js)**：`GET /api/public-stats` 端點。並行 7 查 — `aivis_brands` 總數（正在監測品牌數）+ `seo_audits / aeo_audits / geo_audits / eeat_audits` 四表 count 加總（AI 能見度報告份數）+ `aivis_mentions where brand_mentioned=true` 次數（品牌被 AI 主動提及）+ `aivis_responses` 總數（累積 AI 掃描次數）。全部用 `{ count: 'exact', head: true }` 只回聚合數字不抓 row 資料。`Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=600` — CDN 5 分鐘 cache + 10 分鐘 stale-while-revalidate，這些數字不需要 real-time，降低 Supabase 查詢負擔。
- ✅ **後端走 service role 而非前端直查**：訪客 anon role 對 user-scoped 資料表（aivis_*、*_audits）的 RLS 是 `auth.uid()` 對齊，匿名訪客直接 select count 會拿到 0 或 null。service role 在後端繞過 RLS 拿聚合 count，只回數字、不回 row data，沒有隱私洩漏問題。
- ✅ **[Pricing.jsx](src/pages/Pricing.jsx) 接後端**：`useState` import 加 `useEffect`，新增 `stats` state（4 個 null）+ mount 時 fetch `/api/public-stats`、失敗就維持 null。`fmt()` helper 把 number 轉 `.toLocaleString()`、null 顯示 `—`，避免顯示「0」造成「沒人用」的反效果。4 格 KPI 數字全部改吃 `stats.brands / reports / mentions / scans`。
- ✅ **第 3、4 格 KPI 文案調整對齊真實資料源**：第 3 格「個品牌進入 AI 推薦名單」→「次品牌被 AI 主動提及」（aivis_mentions 數的是 row 而非 distinct brand）；第 4 格「4.7／5 早期客戶滿意度」→「次累積 AI 掃描」（無滿意度資料源，改秀 aivis_responses 總數，凸顯實際使用量）。
- ✅ **CLAUDE.md 上線前需確認清單**：A5 項目標 strikethrough + ✅ 完成註記，剩下 6 項依執行順序排（Supabase Auth 限頻 → 7 天試用 e2e → NewebPay 沙盒 → Pro 年繳付款 → NewebPay 退款 API → 等正式商家審核）。
- ✅ **parse 驗證**：[Pricing.jsx](src/pages/Pricing.jsx) + [api/public-stats.js](api/public-stats.js) 皆 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：4 個查詢併 1 個 API endpoint 而非各自獨立**：前端只需要 1 個 fetch 拿 4 個數字，4 個 endpoint 會多 3 次 round-trip 又拆 CDN cache。Promise.all 在 Vercel function 內並行打 Supabase，最慢的那條決定 latency，整體 < 200ms。
- 🔖 **取捨：null 顯示 `—` 而非 `0`**：首次 mount 時 stats 是 null，若直接 `||` fallback 成 0，使用者會看到「0 個品牌正在監測」造成 trust 反效果。`—` 明確表達「載入中或暫無資料」，比假數字「127」也比真實 0 更誠實。
- 🔖 **取捨：第 4 格從滿意度改累積 AI 掃描次數**：原 4.7／5 滿意度沒有資料源（沒做用戶評分系統），最少阻力做法是把這格換成另一個有 row count 可拉的指標。aivis_responses 數字會隨產品使用成長、視覺上跟其他 3 格同質（都是 count），且「累積 N 次 AI 掃描」也是社會證明的一種。
- 🔖 **取捨：CDN cache 5 分鐘 + stale-while-revalidate 10 分鐘**：這 4 個 KPI 一天可能成長個 10–50 次，5 分鐘 stale 完全可接受。stale-while-revalidate 讓 cache 過期後仍會先回舊資料、背景去 Supabase 取新，使用者永遠不會等到「冷啟動 Supabase query」的延遲。

### 2026-05-11
**上線前需確認清單修正 — 拆除 Stripe 退款假設，改為 NewebPay 為主的依執行順序清單:**
- 🐛 **問題起因**：商業模式 section 的「上線前需確認」清單沿用 2026-05-04 寫的 Stripe 思路 — 「Stripe 自動退款流程（年繳 14 天）是否已串好（`/api/cancel-subscription.js` 與 webhook 退款邏輯）」。但金流已於 2026-05-11 切到 NewebPay 為主（Phase 1）、Stripe 降為 Phase 2 備用，此項目實質已過期且會誤導未來閱讀者。
- ✅ **付款流程行重寫**：原「Stripe Checkout → Webhook → is_pro=true」改為雙階段描述（Phase 1 NewebPay 主力沙盒審核中 / Phase 2 Stripe Atlas 備用因 HK 帳號鎖死暫緩 + Stripe code 整段保留供未來切回）。
- ✅ **「上線前需確認」清單從 2 項擴為 7 項，依執行順序排**：A5 假 KPI dynamic 化（半天可解、上線即被識破信任風險）→ Supabase Auth 註冊頻率限制（防 7 天試用刷單）→ 7 天試用 e2e 驗證（trial flag / 提醒 / 自動轉訂閱）→ NewebPay 沙盒測 Top-up（等沙盒帳號）→ **新增** Phase 1 Step 2 Pro 年繳一次性付款（未開發，14 天退款的前置）→ **新增** NewebPay 退款 API 串接（信用卡 API 直退 / VACC・WEBATM 手動轉帳，沙盒到手即可寫測，不用等正式審核）→ 等正式審核換 env vars 上線。
- ✅ **加註：Top-up 政策為「不過期、用完為止、不退款」**，退款流程只針對 Pro 年繳。Top-up 客訴 / 盜刷情境走手動處理（NewebPay 後台 + Supabase 手動扣 credits），不需自動退款流程。
- 🔖 **取捨：保留舊工作日誌不改寫，只修正當下會誤導的「上線前需確認」段落**：工作日誌是時間序紀錄，2026-05-04 那筆寫「Stripe 退款」是當時事實沒錯（當時策略還是 Stripe 主力），改寫會破壞紀錄真實性。誤導風險集中在「上線前需確認」這種「未完成事項清單」段落，修這裡即可。
- 🔖 **取捨：退款 API 不等正式審核**：NewebPay 退款 API 在沙盒環境就能測（用沙盒測試金鑰跑完整流程），不必卡正式審核 1-2 週。正式上線前換 env vars 即可。這意味著 Phase 1 Step 2 + 退款 API 可在沙盒到手後 1 週內全跑完。

### 2026-05-11
**NewebPay 藍新金流 Phase 1 Step 1（Top-up MPG 一次性付款）後端 + 前端串接完成（Stripe 留作 Phase 2 備用）:**
- 💡 **背景**：金流策略採雙階段路線圖 — Phase 1 NewebPay（TW/NT$、本地客戶優先）/ Phase 2 Stripe Atlas（國際/USD）。原因是 Stripe 帳號被鎖香港、Live mode 卡關；NewebPay 商家審核中（已申請等待約 1-2 週），本次先用沙盒測試金鑰把程式碼寫完，等核發 credentials 即可上線。Stripe code（`/api/aivis/checkout-topup.js`、`stripe-webhook.js`）整段保留不動，未來 Phase 2 切回只需改前端 endpoint。
- ✅ **新增 [newebpay-pending-orders.sql](newebpay-pending-orders.sql)**：建表 `aivis_newebpay_pending`（merchant_order_no PK / user_id / kind CHECK ('topup_small','topup_large','pro_yearly','pro_monthly_first') / pack / quota / amount / status CHECK ('pending','paid','failed','expired') / trade_no / payment_type / paid_at / created_at / notify_raw JSONB）+ idx `(user_id, created_at DESC)`。RLS 兩條 SELECT policy（用戶讀自己 + admin 讀全部，沿用既有 `is_admin()` helper），不開放任何用戶端寫入（service role bypass）。`aivis_topup_credits` 加 `gateway TEXT DEFAULT 'stripe' CHECK ('stripe','newebpay')` 欄位 — 現存資料一律當 stripe（之前都是 Stripe 寫入），新進 newebpay 寫入時帶 'newebpay' 區分兩條金流的流水。`profiles` 加 `payment_gateway` 欄位給 Phase 2 Pro 訂閱用（目前還沒上線先放著）。**用戶側待辦**：在 Supabase SQL Editor 執行此 SQL 一次。
- ✅ **新增 [api/lib/newebpay.js](api/lib/newebpay.js) 加解密 helper 庫**：(1) `aesEncrypt/Decrypt`（AES-256-CBC + PKCS7 padding，Node crypto 預設就是 PKCS5/7 padding）(2) `sha256Hash`（規格：`HashKey={key}&{aesEncrypted}&HashIV={iv}` → SHA256 → uppercase hex，client 送出與 notify 驗證共用同一個 function）(3) `buildFormString/parseFormString`（NewebPay 規範 value 要 urlencoded）(4) `generateOrderNo(prefix)`（產 `{prefix}{ts_base36}{rand4}`，max 30 字、僅 a-zA-Z0-9_）(5) `buildPaymentForm(tradeParams)` 一站式 → 回 `{ MerchantID, TradeInfo, TradeSha, Version, EncryptType, apiUrl }`(6) `parseNotifyPayload({ TradeInfo, TradeSha })` → 驗 sha + 解密 + JSON.parse → 回 `{ ok, data, error }`。所有 function 在環境變數缺失時 throw 明確錯誤而非 silent fail。
- ✅ **新增 [api/aivis/checkout-topup-newebpay.js](api/aivis/checkout-topup-newebpay.js) Top-up 結帳 endpoint**：與 Stripe 流程不同 — Stripe 是「建 session → 回 hosted URL → 前端 redirect」，NewebPay 是「建 trade params → 回 form fields → 前端組 form 自動 submit」。流程：(1) 先 INSERT `aivis_newebpay_pending`（pack='small/large' 對應 kind/quota/amount），(2) 組 trade params（含 RespondType=JSON、NotifyURL=`${SITE}/api/newebpay-notify`、ReturnURL 帶 `?topup_success={pack}`、ClientBackURL、CREDIT/VACC/WEBATM/CVS/BARCODE 全開）(3) `buildPaymentForm()` 產 form fields 回前端。失敗時 mark pending='failed'。
- ✅ **新增 [api/newebpay-notify.js](api/newebpay-notify.js) NotifyURL handler**：NewebPay server-to-server POST `application/x-www-form-urlencoded` 過來，Vercel 預設 bodyParser 接得到。流程：(1) 驗 TradeSha + 解 TradeInfo（解出來是 JSON 結構 `{ Status, Message, Result: { MerchantOrderNo, TradeNo, Amt, PaymentType, ... } }`）(2) 從 pending 表查回 user/kind/pack/quota（沒有 NewebPay metadata 概念，所以必須靠 MerchantOrderNo 反查）(3) 失敗 → mark pending='failed' 回 200（不擋 retry 但不入帳）(4) 已 paid → skip（idempotency — NewebPay retry up to 8 次）(5) topup_small/large → upsert `aivis_topup_credits`（source_payment_id = `nwp_${tradeNo}` 加 prefix 避免與 Stripe session id 撞，onConflict 'source_payment_id' ignoreDuplicates）+ gateway='newebpay'。pro_yearly 分支預留給 Phase 2 Pro 年繳，目前還用不到。
- ✅ **修改 [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) `handleBuy` 切換金流**：原本 fetch `/api/aivis/checkout-topup` → `window.location.href = data.url` 跳 Stripe Checkout，改為 fetch `/api/aivis/checkout-topup-newebpay` → 拿到 `{ apiUrl, fields }` → `document.createElement('form')` 動態建表單 + 5 個 hidden inputs（MerchantID/TradeInfo/TradeSha/Version/EncryptType）→ `appendChild(body) + form.submit()` 整頁跳轉。錯誤訊息從「Stripe Checkout」改為「付款流程」（gateway-agnostic）。
- ✅ **[.env.local](.env.local) 加 NewebPay env vars 預留位置**：`NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` 三個空值（等沙盒帳號核發後填）+ `NEWEBPAY_API_URL=https://ccore.newebpay.com/MPG/mpg_gateway`（預設沙盒）。Stripe Top-up env vars 完整保留（Phase 2 切回時直接用）。
- ✅ **parse 驗證**：4 個新增 / 修改檔案（`api/lib/newebpay.js` / `api/aivis/checkout-topup-newebpay.js` / `api/newebpay-notify.js` / `src/pages/AIVisibilityDashboard.jsx`）全數 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：用 pending 表暫存 user/pack/quota 而非塞 MerchantOrderNo 前綴**：NewebPay 沒有 metadata 欄位，理論上可以把 user_id 編碼進 MerchantOrderNo（例如 `tus_u123_xxx`），但 MerchantOrderNo 上限 30 字、UUID 也 36 字，編不下；且編碼會洩漏 user_id 給 NewebPay 端可讀。pending 表額外多一張表的成本 OK，且可順帶記 notify raw payload 供 debug，未來分析 stale orders 也方便。
- 🔖 **取捨：source_payment_id 加 `nwp_` prefix 而非另開 newebpay-only 表**：`aivis_topup_credits` 是 gateway-agnostic 的「次數包餘額」表，重點是「user 還有幾次可用」而不是「哪家金流付的」。加 prefix + `gateway` 欄位讓兩條金流共用同一張表，AdminUsers 展開明細時可看到混合的歷史記錄；如果拆兩張表，前端要 union 兩張表計算餘額會變麻煩。
- 🔖 **取捨：成功路徑與失敗路徑都回 200 給 NewebPay**：NewebPay notify 失敗會 retry up to 8 次，但「retry 應該保留給網路斷線/我這邊伺服器掛掉」這種情境。如果是「TradeSha 驗證失敗 / MerchantOrderNo 找不到」這種「資料對不上」的情境，retry 8 次也救不回來，不如直接回 400 拒收（但本次選 200 + log，避免 NewebPay 端把這筆訂單列為「商家異常」影響商家信評）。失敗付款（用戶刷卡但銀行拒絕）也回 200，因為 NewebPay 已經完成它的工作把結果通知我們了，retry 反而是反模式。
- 🔖 **取捨：CREDIT/VACC/WEBATM/CVS/BARCODE 沙盒先全開**：理論上信用卡（CREDIT）支付率最高、WEBATM 比 VACC 便利、CVS/BARCODE 是後備（轉帳到超商繳費），全開讓沙盒測試各種付款方式都能試。正式環境再依用戶習慣（85% 走信用卡）決定要不要關掉 CVS/BARCODE 簡化付款選項。
- ⚠️ **用戶側待辦（上線前）**：(1) 等 NewebPay 商家審核通過（1-2 週），拿到沙盒 + 正式 MerchantID/HashKey/HashIV (2) Vercel env vars 填入 `NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` / `NEWEBPAY_API_URL`（沙盒 vs 正式各環境分開設）(3) 確認 `NEXT_PUBLIC_SITE_URL=https://aark-workspace.vercel.app`（已設）(4) Supabase SQL Editor 跑 [newebpay-pending-orders.sql](newebpay-pending-orders.sql) (5) NewebPay 後台設定 NotifyURL 白名單為 `https://aark-workspace.vercel.app/api/newebpay-notify`。
- ⏳ **Phase 1 Step 2-3 待後續**：Step 2 — Pro 年繳 NT$13,900 一次性付款（用 MPG，與 Top-up 同模式）；Step 3 — Pro 月繳 NT$1,490/月 定期定額（用 NewebPay 定期定額 API，需另接，等 Phase 2 再做或等 NewebPay 正式核發後驗證後做）。

### 2026-05-10
**Dashboard 5 張分數卡可點進詳情 + 全站路由切換自動捲回頂端（兩個小 UX 修補）:**
- 🐛 **Bug 起因 1（進報告頁就在頁面中間）**：用戶反映「進到 SEO/AEO/GEO/EEAT/內容品質報告頁，都會直接連到頁面中央」，懷疑是錨點。實際 grep 整個 src 目錄 `scrollIntoView` / `window.scrollTo` / `autoFocus` / `.focus()` — 5 個 audit 頁與 v2 元件都沒有。根因是 React Router v7 預設不重設捲動位置：用戶在 Dashboard 滑到一半（例如 5 大面向卡 / 雷達圖區）再點報告頁，瀏覽器保留同樣 Y 軸位置 → 新頁正好停在中間。
- ✅ **修法**：在 [App.jsx](src/App.jsx) 的 `AppInner` 加一個 `<ScrollToTop />` 子元件 — `useLocation()` 取 pathname、`useEffect` 依 pathname 變動就 `window.scrollTo(0, 0)`。掛在 `<Routes>` 上方，整站每條路由切換都會自動回頂端。回首頁 / Dashboard / 任何頁面都受益，不只報告頁。
- ✅ **Dashboard 5 張分數卡可點進詳情頁**（[Dashboard.jsx:880](src/pages/Dashboard.jsx)）：原本 `scoreData.map` 渲染 `<GlassCard>` 純展示，改為外層包 `<Link to={routeMap[item.name]}>`。`routeMap` 依 name 對映：SEO/AEO/GEO/EEAT 走 `/{face}-audit/${id}`、內容品質走 ad-hoc `/content-audit`（無 :id，因為 ContentAudit 是「輸入網址 → 即時分析」的獨立流程）。GlassCard 加 `cursor: 'pointer'` + `height: '100%'`（讓 5 張等高），底部新增「查看詳細報告 →」提示文字（吃 item.color、opacity 0.85），不留猜測空間給用戶。
- ✅ **parse 驗證**：[App.jsx](src/App.jsx) + [Dashboard.jsx](src/pages/Dashboard.jsx) 皆 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：用全站 ScrollToTop 而非每頁 useEffect**：原本可以在 5 個 audit 頁各自加 `useEffect(() => window.scrollTo(0, 0), [])`，但 (1) 5 處重複 (2) 未來新增頁面容易漏寫 (3) Dashboard / Pricing / FAQ 等頁面也會撞到同樣問題（從子頁返回上一層時殘留 Y 軸）。一次在 App.jsx 解決最乾淨。
- 🔖 **取捨：內容品質卡連 `/content-audit` 不帶網址 prefill**：ContentAudit 頁是 ad-hoc URL 輸入流程，沒辦法用 website.id 帶入。理想體驗是「點內容品質卡 → /content-audit?url=xxx 自動填入」，但 ContentAudit 內部 state 邏輯改動較大，本次先讓使用者自行輸入網址（與從首頁進來體驗一致），之後若用戶反映再加 query param prefill。
- 🔖 **取捨：cards 加「查看詳細報告 →」提示文字而非僅依靠 cursor pointer**：cursor 在 mobile 看不到、desktop 也得 hover 才知道可點。明確的文字 + 箭頭符號讓「整張卡可點」這件事一秒被讀懂，符合 nngroup「affordance 要顯性」原則。

### 2026-05-07
**清理已執行完畢的 SQL migration 檔（共 9 支）:**
- ✅ 移除 `announcements.sql` / `aivis-topup-admin-rls.sql` / `admin-rls-policies.sql` / `aivis-prompt-limit.sql` / `aivis-tables-phase2.sql` / `aivis-tables.sql` / `aivis-topup-credits.sql` / `clear-test-revenue.sql` / `seo-tables.sql` — 全部已在 Supabase SQL Editor 跑完，DB 端 schema/policy/function 都已建立。
- 🔖 **取捨：不保留為 schema 紀錄**：用戶指示一起清。Supabase Dashboard 本身可看 schema，且日後若要重建環境，從 Supabase 端 export 比讀分散的 .sql 檔更可靠。CLAUDE.md 工作日誌已記錄每個 SQL 的用途與欄位設計，需要回查時讀此檔。

### 2026-05-07
**站內公告系統（後臺管理第三階段第一支）— announcements 表 + AdminAnnouncements 後臺 CRUD + AnnouncementBanner 公開元件:**
- ✅ **新增 [announcements.sql](announcements.sql)**：建表 `announcements`（id / title / content / kind CHECK ('info','warn','promo','success') / target CHECK ('all','free','pro') / link_url + link_text / is_active / starts_at + ends_at / timestamps）+ partial index `(is_active, starts_at, ends_at) WHERE is_active = true`（前端 SELECT 吃此索引）+ `set_updated_at()` trigger 自動維護 updated_at。RLS 四條 policy：`everyone_read_active_announcements`（所有人含 anon 訪客都能讀啟用中且在期間內的公告）、admin 各自 SELECT/INSERT/UPDATE/DELETE 全權。**用戶側待辦**：在 Supabase SQL Editor 執行此 SQL。
- ✅ **新增 [src/pages/admin/AdminAnnouncements.jsx](src/pages/admin/AdminAnnouncements.jsx)**：完整 CRUD 後臺頁。列表顯示 5 欄（標題+內容預覽 / 類型 chip+對象 / 期間 / 狀態 / 操作）+ 狀態自動判定（`!is_active=已停用` / `starts_at>now=排程中` / `ends_at<now=已過期` / 否則=`顯示中`）。新增/編輯走 modal，欄位含標題（必填）/ 內容（textarea）/ 類型 4 選 1 button group / 對象 3 選 1 button group / CTA url+text 雙欄 / 開始-結束時間 datetime-local（空白=立即/永不過期）/ is_active checkbox。timezone 處理：`tsToLocalInput()` UTC→本地時區字串、`localInputToIso()` 反向；DB 端用 timestamptz 存 UTC，UI 用本地時區顯示與輸入。樂觀更新：toggle is_active 立刻變 UI、失敗 rollback。
- ✅ **新增 [src/components/AnnouncementBanner.jsx](src/components/AnnouncementBanner.jsx)**：公開 banner 元件。fetch active 公告（DB 端 RLS 已過濾期間，client 只需過濾 target：`all` 給全部、`pro` 給 isPro=true、`free` 給 isPro=false）。每張 banner 吃 4 種 kind 配色（info=藍 / warn=琥珀 / promo=橘紅漸層 / success=綠）+ emoji + 標題 + 內容（whitespace pre-wrap）+ 選填 CTA 按鈕（`/^https?:\/\//` 用 `<a target=_blank>` 開新分頁、否則用 `<Link to>`）+ ✕ 關閉按鈕。dismiss state 寫 localStorage `dismissed_announcements`（comma-separated UUID），同 user 同瀏覽器只關一次；換瀏覽器 / 清 cache 會再出現 — 對「重要訊息」是 feature 不是 bug。authLoading 守衛防 isPro 從 undefined→true 切換時 target=pro 公告誤顯示給訪客。
- ✅ **[AdminLayout.jsx](src/pages/admin/AdminLayout.jsx) NAV 加 「站內公告」項**（📢 emoji，第 5 順位在營收儀表板之後）。
- ✅ **[App.jsx](src/App.jsx) 路由 `/admin/announcements`**：import + Route 新增。
- ✅ **三處掛載 banner**：[HomeDark.jsx](src/pages/HomeDark.jsx)（header 之後、Hero 之前 — 訪客都會看到）/ [Dashboard.jsx](src/pages/Dashboard.jsx)（SiteHeader 之後、升級成功提示之前 — 登入用戶看到）/ [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx)（背景之後、返回連結之前 — aivis 用戶看到）。三頁都用同一個 `<AnnouncementBanner />`，banner 自帶 padding 與容器寬度。
- ✅ **parse 驗證**：7 個改動 / 新增檔案全數 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：用 localStorage dismiss 而非 DB 表**：原本可以開一張 `announcement_dismissals (user_id, announcement_id)` 表記錄，但這會增加 (1) 訪客（未登入）無法 dismiss、(2) 多一張表的 RLS 複雜度、(3) 每次 fetch 多 1 個 left join。localStorage 的「換 device 會再看到」對重要訊息反而是好事（提醒用戶第二次），且訪客也能 dismiss。代價是同瀏覽器的 incognito mode 看到舊 banner — 邊界 case 可接受。
- 🔖 **取捨：target 過濾走 client 而非 RLS USING 子句**：RLS 端要做 target 過濾就得 join profiles 拿 is_pro，每筆查詢都付這個成本不值得。client 端只接收 active 公告（量很小，<10 筆典型），用 JS array filter 微秒級。RLS 端只負責「啟用中 + 在期間內」的硬性條件。
- 🔖 **取捨：banner 在三頁手動掛而非 App 層 wrapper**：Login / Register / Audit 詳細頁等不需要 banner（會干擾流程或視覺擁擠），手動掛在「主要 landing 頁」三處更精準。如果未來 banner 太常出現要全站統一，再升級為 layout wrapper。
- 🔖 **取捨：沒做「banner 點擊埋點 / 觸及率統計」**：本次先把 send → display → dismiss 的閉環做出來，分析資料層留待第三階段「內容管理」整批設計時做（届時可加 click 寫進 `announcement_clicks` 或直接 GA event）。
- 🔖 **取捨：sql 檔案命名 `announcements.sql` 不加 `aivis_` 前綴**：站內公告是站內基礎設施，跨所有產品模組共用（首頁訪客 / Dashboard / aivis），不屬於 aivis 模組，所以表名與檔名都不掛 aivis 前綴。

### 2026-05-07
**aivis Top-up 後端優化（Stripe 註冊卡關期間先做不依賴 Stripe 的 UI 優化）— AdminUsers Top-up 餘額顯示 + fetch.js quota 即時更新 banner:**
- ✅ **新增 [aivis-topup-admin-rls.sql](aivis-topup-admin-rls.sql)**：給 `aivis_topup_credits` 表加 admin SELECT policy（複用 `is_admin()` helper），讓 AdminUsers 能讀全部用戶的 Top-up credits。INSERT/UPDATE/DELETE 不開放給 admin — 真要手動補發走 service role 跑 SQL Editor，避免 admin UI 誤操作改額度。**用戶側待辦**：在 Supabase SQL Editor 執行此 SQL 一次。
- ✅ **[AdminUsers.jsx](src/pages/admin/AdminUsers.jsx) 加 Top-up 加購餘額區塊**：在「AI 曝光監測 — API 成本（內部）」與「已分析的網站」之間插入新區塊。展開用戶時並行查 `aivis_topup_credits where user_id = X order by purchased_at desc`，列出每筆 pack（小包 300 / 大包 800 chip + 購買日期 + 剩餘/總量 + 已用），上方匯總卡顯示「目前可用次數 N」+「共 N 個點數包」。已耗盡的 pack 用淡灰色（quota_remaining === 0）視覺降階，仍顯示但不搶版面。
- ✅ **[AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) runScan 利用 quota meta 即時更新 banner**：每跑完一條 prompt 拿到 fetch.js 回傳的 `json.quota.used_after` → 立刻 `setUserMonthQueries(used_after)`，不等掃完全部再 loadAll()。多 prompt 掃描時 banner 進度條與「已用 X / 150」會逐條前進，視覺即時感強。同時累加 `totalTopupConsumed`（從每次回應的 `topup_consumed_this_call`），若本次掃描有用到 Top-up 則 toast 補一段「（含 N 次 Top-up）」讓用戶清楚知道內含已用完、Top-up 在扣。
- ✅ **runScan catch 分支也加 loadAll()**：原本只成功路徑才 reload，現在失敗也 reload — 因為若是 fetch.js 跑到第 3 條 prompt 時撞到硬上限或 API 失敗，前 2 條已經寫進 DB 了，banner 必須對齊真實狀態。
- ✅ **parse 驗證**：[AdminUsers.jsx](src/pages/admin/AdminUsers.jsx) + [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 皆 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：AdminUsers 直接 select aivis_topup_credits 表，不打 `aivis_topup_balance` RPC**：RPC 只回 sum 數字，無法列出每包明細。直接 select 多 1 個欄位，admin 透過新加的 RLS policy 已可繞 RLS 看全部，且能看出「3 個小包都是 4/14 同一天買的（可疑）」這種模式檢測。RPC 留給用戶端 dashboard 用（用戶只需要知道餘額不需要看明細）。
- 🔖 **取捨：runScan 即時更新 + 收尾再 loadAll()，不只擇一**：純 quota.used_after 推進雖然快，但只更新 userMonthQueries 一個 state — responses / mentions / 趨勢圖 仍要靠 loadAll() 補齊。同時做兩件事不衝突，且即時感與資料完整性都顧到。
- ⚠️ **Stripe 註冊仍卡關**：Stripe Dashboard 連線慢 + Taiwan country 缺問題未解，本次跳過。等用戶用 VPN / 手機熱點 / 換時段重試，或走 Stripe Atlas 路線。Top-up 後端 100% 寫好擺著，拿到 price_xxx ID 直接貼 Vercel env 就會跑。

### 2026-05-07
**aivis Top-up 後端串接完成：SQL migration + checkout-topup endpoint + webhook 分支 A + fetch.js 額度攔截 + TopupModal 接 Stripe Checkout:**
- ✅ **新增 [aivis-topup-credits.sql](aivis-topup-credits.sql)**：建表 `aivis_topup_credits`（id / user_id REFS auth.users / pack_size CHECK ('small','large') / quota_total / quota_remaining / purchased_at / expires_at NULL=不過期 / source_payment_id UNIQUE 防 webhook 重送 / notes 客服手動開通用）+ partial index `(user_id, purchased_at) WHERE quota_remaining > 0`（fetch.js FIFO 查詢吃此索引）。RLS：用戶可讀自己 credits、不開放任何用戶端寫入（只 service role bypass）。
- ✅ **新增原子扣除 RPC `aivis_consume_topup_credit(p_user_id uuid)`**：用 `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` 鎖一筆 quota_remaining > 0 的 credit（依 purchased_at ASC 取 FIFO 先買的先扣），找不到回 false、找到就 `quota_remaining -= 1` 回 true。SECURITY DEFINER + 不 grant 給 authenticated → 只有 service role（fetch.js）能呼叫，避免用戶端繞過 fetch.js 直接耗 credits。
- ✅ **新增 helper `aivis_topup_balance(p_user_id uuid)`**：回 user 當下 sum(quota_remaining) 給 dashboard 顯示用，grant 給 authenticated。
- ✅ **新增 [api/aivis/checkout-topup.js](api/aivis/checkout-topup.js)**：`POST` body `{ userId, email, pack: 'small' | 'large', returnUrl }` → `PACK_SPEC` 對映 pack → priceEnvKey + quota → 建立 Stripe `checkout.sessions` with `mode: 'payment'`（**非** subscription，因為 Top-up 是一次性付款）+ metadata `{ userId, kind: 'aivis_topup', pack, quota }`（webhook 端用 `kind` 辨識「不是 Pro 訂閱」）+ `success_url` 帶 `?topup_success={pack}` 回原頁、`cancel_url` 回原頁。Env var：`STRIPE_TOPUP_SMALL_PRICE_ID`、`STRIPE_TOPUP_LARGE_PRICE_ID`、`NEXT_PUBLIC_SITE_URL`。
- ✅ **修改 [api/stripe-webhook.js](api/stripe-webhook.js) 加分支 A**：`checkout.session.completed` 事件原本只處理 Pro 訂閱（更新 `profiles.is_pro = true`），新增前置判斷：若 `metadata.kind === 'aivis_topup' && session.mode === 'payment'` → 走分支 A：upsert 一筆 `aivis_topup_credits`（quota_total = quota_remaining = metadata.quota，source_payment_id = session.id）+ `onConflict: 'source_payment_id', ignoreDuplicates: true` 防 webhook 重送重複入帳（Stripe 會 retry，第二次 INSERT 會撞 UNIQUE 並被靜默跳過）。分支 B（Pro 訂閱）邏輯完全不動。
- ✅ **修改 [api/aivis/fetch.js](api/aivis/fetch.js) 加額度攔截**：常數 `AIVIS_QUOTA_PER_MONTH = 150`、`AIVIS_HARD_CAP = 1000`（與前端 [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 同步）。在 prompt + brand 取出後、進入 runs loop 前查 `aivis_responses count where user_id = prompt.user_id AND created_at >= monthStart`（UTC calendar month），若 count >= 1000 → 直接回 HTTP 429 `monthly_hard_cap_exceeded`。loop 內每次 Claude 呼叫前算 `wouldBeNthQuery = monthCount + usedThisCall + 1`：(1) > 1000 → 中斷 loop 回 429 with `completed_runs: i - 1` (2) > 150 → 打 `supabase.rpc('aivis_consume_topup_credit', { p_user_id })`，false → 回 429 `monthly_quota_exhausted`、true → `topupConsumedThisCall += 1` (3) ≤ 150 → 走月內含。response 寫入成功後才 `usedThisCall += 1`（避免 Claude 失敗 / DB 失敗時誤扣）。回應加 `quota: { used_after, quota_per_month, hard_cap, topup_consumed_this_call }` meta，前端可即時更新 banner 不必重打 count。
- ✅ **TopupModal 接 Stripe Checkout**：原本 'soft' kind 是 mailto 客服手動開通，改為每張 Top-up 卡加「立即加購」按鈕 → `handleBuy(packId)` POST 到 `/api/aivis/checkout-topup`（帶 `userId / email / pack / returnUrl: window.location.href`）→ 拿 `data.url` 後 `window.location.href = url` 整頁跳轉到 Stripe（不開新分頁，避免 `success_url` 回不來原頁迷路）。`buying` state 防連點 + loading「⏳ 跳轉中…」、`buyError` 顯示失敗訊息。大包按鈕用青綠漸層 + 陰影（推薦樣式），小包用半透明青綠（次級樣式）。`'hard'` kind 仍走 Agency 預登記 mailto（沒得救）。
- ✅ **parse 驗證**：[fetch.js](api/aivis/fetch.js) + [checkout-topup.js](api/aivis/checkout-topup.js) + [stripe-webhook.js](api/stripe-webhook.js) + [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 全數 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：fetch.js 單一交易內每次 run 各打一次 RPC，不批次 reserve**：runs 上限 5、若 5 次都要走 Top-up 路徑就打 5 次 RPC，看似重，但 reserve N 次再回填會碰到 mid-loop Claude 失敗 → 已扣的 credits 還要回滾的醜邏輯。每 run 各扣一次的好處是 Claude 失敗 / DB 失敗時，「未實際寫入 response 的 run」對應的 credit 直接不再扣下去（藉由「response 寫入成功才 += 1」這個順序），不必補償。
- 🔖 **取捨：硬上限攔截走 monthCount + usedThisCall 而非每次重查 DB**：每跑 1 次 run 重查 1 次 monthly count 浪費，且本次 call 內的 1~5 次新增本來就由 `usedThisCall` 即時累計、加上 loop 進入前已抓過的 `monthCount` 起點，數字一致正確。並發風險（同 user 兩個 tab 同時打 fetch）容忍 — 兩邊各自查一次拿到同 monthCount，極端情況下可能合計超過 hard cap 1~2 次，這個 leak 對毛利結構影響可忽略，下個月 monthCount 重算就回正。
- 🔖 **取捨：Stripe success_url 回原 dashboard URL（含 ?topup_success=）而非獨立成功頁**：用戶在 dashboard 觸發 Top-up 是「正在跑掃描被攔截 → 加購 → 立刻想繼續跑」的 flow，回獨立成功頁要再點一次「回 dashboard」中斷思路。返回原頁 + query string 標記讓未來能加 toast 「✓ Top-up 已入帳」。webhook 把 credits 寫入是非同步的（Stripe 後台跑），所以使用者回來時 credits 可能還沒寫入；前端 toast 要靠輪詢 / Realtime 才確定能跑掃描，本次先不做。
- 🔖 **取捨：source_payment_id UNIQUE + onConflict ignoreDuplicates，不用 idempotency key 表**：Stripe webhook 可能 retry 同一個 event，最簡單的保護是 INSERT 撞 UNIQUE 就靜默跳過。專屬 idempotency 表能記錄 event_id 細粒度（同 session 不同事件類型也能 dedupe），但目前 webhook 只認 `checkout.session.completed`，session.id 已足夠當「這次付款是否處理過」的去重 key。未來若加上更多事件類型（refund / dispute）再考慮升級。
- ⚠️ **用戶側待辦（部署前）**：(1) Stripe Dashboard 建立兩個 **one-time** price item — NT$490 / NT$990（記得是 one-time，不是 recurring）、貨幣 TWD、metadata 可空；(2) Vercel 環境變數加上 `STRIPE_TOPUP_SMALL_PRICE_ID` 與 `STRIPE_TOPUP_LARGE_PRICE_ID`（從 Stripe Price ID 複製，格式 `price_xxx`），Production / Preview / Development 三環境都要設；(3) 確認 `NEXT_PUBLIC_SITE_URL` 已設為 `https://aark-workspace.vercel.app`；(4) Supabase SQL Editor 跑 [aivis-topup-credits.sql](aivis-topup-credits.sql) 一次（建表 + RLS + 兩個 function）；(5) 跑完用 `SELECT * FROM pg_proc WHERE proname LIKE 'aivis_%'` 確認 function 存在。
- ⚠️ **未來要做（不阻塞上線）**：(1) AdminUsers 展開明細顯示用戶 Top-up 餘額（`SUM(quota_remaining)`）；(2) Top-up 入帳後從 dashboard 即時看到（webhook → Realtime broadcast → banner 更新）；(3) 用戶取消 Pro 訂閱時的 Top-up credits 處置政策（建議：保留 90 天）；(4) Stripe webhook 端在 `payment_intent.payment_failed` / `charge.refunded` 時對應扣回 credits（防退款後仍能用次數）。

### 2026-05-07
**Pricing FAQ details/summary 嵌套 bug 修復 + aivis Dashboard 月內含額度 banner / Top-up modal UI:**
- 🐛 **Pricing FAQ 黑字看不到 bug 起因**：`PricingFAQ` dark 分支把 `<summary>` 包在 `<GlassCard>` 的 div 內，違反 HTML 規範（`<summary>` 必須是 `<details>` 的「直接」子元素）。瀏覽器把整個 details 視為「無 summary」、預設 collapsed 狀態，只渲染預設「Details」黑字標記，整段 FAQ 內容（含問題與答案）都被瀏覽器當成隱藏內容。用戶看到的「常見問題內容都看不到」就是這個 — 不是 CSS 黑字，是 HTML 結構導致內容直接不渲染。
- ✅ **修法**：把 `<GlassCard color={T.orange}>` 的玻璃擬態樣式（背景、邊框、blur、padding、boxShadow）內聯到 `<details>` 元素本體上，讓 `<summary>` 直接掛在 details 下。視覺一致、結構合法。註解寫明「`<summary>` 必須是 `<details>` 的直接子元素」這條 HTML 規範陷阱，避免未來複製這段時又包進 div。
- ✅ **aivis Dashboard 新增 UsageBanner（用量提示條）**：當本月查詢用量 ≥80%（120 次）時於「立即執行掃描」CTA 上方顯示。三段式配色 + 文案：80%~99% 黃色（剩餘 N 次內含 + 「了解加購」）/ 100%~999 橘色（已用完，加購 Top-up 繼續）/ ≥1000 紅色（已達硬上限）。內含進度條（鎖在 100%，超量 Top-up 不再延伸）+ 三段式 emoji（⚠️ / 🔔 / 🚫）。CTA 點擊開啟 TopupModal。
- ✅ **aivis Dashboard 新增 TopupModal（加購次數包 modal）**：兩種 kind — `'soft'`（月內含 150 用完）顯示 Top-up 兩張卡（小包 NT$490/+300、大包 NT$990/+800，大包標「🔥 最划算」chip）+「規則說明」（不過期/月內含先扣/硬上限 1,000）+「💳 加購功能即將開放」disclaimer + mailto 申請手動開通；`'hard'`（≥1,000）顯示「為什麼有硬上限」說明 + Agency 方案 2026 Q3 預告 + Agency 預登記 mailto。背景 backdrop-blur + 點擊外部關閉。後端 Stripe 一次性購買尚未串接，目前只導向客服 mailto，避免假按鈕欺騙用戶。
- ✅ **runScan 加上額度攔截**：在進入掃描動畫前先檢查 `userMonthQueries`：(1) 達硬上限或本次掃描會破 1,000 → 開啟 `'hard'` modal、return（沒得救）(2) 達月內含 150 → 開啟 `'soft'` modal、return（可加購）(3) 否則正常掃描。攔截走 modal 而非 toast，因為這是付費決策時刻、需要時間閱讀加購方案。
- ✅ **新增 user-scope 月查詢計數 query**：`loadAll()` 新增 `aivis_responses` count 查詢（`.eq('user_id', user.id).gte('created_at', monthStartIso)` + `head: true` 只回 count 不抓資料），存到 `userMonthQueries` state。注意：原本的 `responses` state 是 brand-scope 30 天，與額度判斷需要的 user-scope 本月不同 — 額度是 per-user per-calendar-month，跨所有品牌合計。
- ✅ **常數新增**：`AIVIS_QUOTA_PER_MONTH = 150`、`AIVIS_HARD_CAP = 1000`、`AIVIS_WARN_RATIO = 0.8`、`TOPUP_PACKS` 陣列（小包/大包 + perCall 單價 + hint 文案），與 [Pricing.jsx](src/pages/Pricing.jsx) `aivisIncludedPerMonth=150` 同步。
- ✅ **parse 驗證**：[Pricing.jsx](src/pages/Pricing.jsx) + [AIVisibilityDashboard.jsx](src/pages/AIVisibilityDashboard.jsx) 皆 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：banner 80% 才出現，不是一進來就秀**：50% 太早會讓用戶覺得被催促升級（dashboard 主訴求是「監測 AI 對你的引用」不是賣 Top-up），90% 又太晚（連 1 次 prompt × 3 runs 都來不及買 Top-up）。80% 對應 120 次，距 150 還有 30 次緩衝（10 次掃描），剛好給用戶 1-2 天思考時間決定要不要加購。
- 🔖 **取捨：modal 兩種 kind 共用同一個 component，不拆兩個元件**：UI 結構 80% 相同（標題 + emoji + 說明 + CTA），差別只在 'soft' 多一層 Top-up 兩卡、'hard' 多一層 Agency 預登記。共用 modal 殼比拆兩個重複實作 backdrop / close button 邏輯划算。差異走 `isHard` 分支即可。
- 🔖 **取捨：Top-up 還沒做後端就先放 modal**：Stripe 一次性購買 + `aivis_topup_credits` 表都還沒實作，但 banner / modal 是純前端視覺，把 UI 先做出來能讓用戶在到達上限時看到清楚的下一步（即使是 mailto 客服），比起到 150 次只能停權靜默更友善。後端 ready 後把 mailto 換成真的 Stripe Checkout 即可，UI 殼不用重做。
- ⚠️ **後端待辦（task 3）**：(1) Stripe 建立兩個 one-time price item 並把 ID 寫進 env var；(2) 建 `aivis_topup_credits` 表（user_id / pack_size / quota_remaining / purchased_at / source_payment_id）；(3) 新增 `/api/aivis/checkout-topup.js` 建立 Stripe Checkout session（mode: payment, not subscription）；(4) `/api/stripe-webhook.js` 處理 `checkout.session.completed` + `mode === 'payment'` → 寫入 topup_credits；(5) `/api/aivis/fetch.js` 寫入 response 前檢查 `user_month_count + 即將寫入的 1 次 ≤ 1000`，扣額順序月內含 → topup_credits → 拒絕。

### 2026-05-06
**aivis 從獨立加購收回 Pro 核心 + Pro 內含額度 100 → 150 次（避免「改完就退訂」流失）:**
- 💡 **決策來源**：用戶提出盲點—— aivis 獨立加購（NT$490/990）會讓 Pro 失去持續訂閱動力，因為「SEO 改完就改完了，剩下的 SEO 持續監測需求不足以支撐月費」。請 5 家 LLM（ChatGPT / Claude / Gemini / Grok / Perplexity）就「aivis 是否該放回 Pro 獨佔」給建議，匯整成 [aivis-decision-comparison.md](../../../Cowork/定價決策/aivis-decision-comparison.md)。**5/5 LLM 全體共識**：用戶判斷對、aivis 必須放回 Pro 核心、成本完全 OK（毛利 60-74%）。最大共識引用：Claude「SEO 修復是有限事，AI 曝光監測天生是動態的——競爭對手在變、AI 引用演算法在更新」、Gemini「不要把鑽石（aivis）從皇冠（Pro）中抽離」。
- ✅ **Pro 內含 aivis 額度 100 → 150 次**（[Pricing.jsx](src/pages/Pricing.jsx)）：FEATURES_PRO 從「aivis 試用 100 次／月」改為「AI 曝光監測（aivis）每月 150 次查詢額度」。150 次可覆蓋單一品牌追蹤 10–15 個核心關鍵字，是保守派 LLM（ChatGPT/Gemini/Perplexity 建議 100-200）與大方派（Grok 建議 600-800）的折衷起點。先用 150 次保守上線，等實際使用分佈出來再放寬，避免 day-1 把毛利讓出去。
- ✅ **aivis 加購區塊整段重寫為「Pro 內含 + 超量 Top-up」單軌制**：移除原本「aivis 標準包 NT$490/月（300 次）」「aivis 進階包 NT$990/月（800 次）」「最划算組合套餐 NT$23,400/年」三段獨立訂閱方案。新區塊改為：(1) Pro 訂閱已含 150 次/月（不可獨立購買 aivis）(2) 用超過 150 次才需加購 Top-up 次數包，NT$490（+300 次）/ NT$990（+800 次），**一次性購買、不過期、用完為止、不綁訂閱**。視覺上保留青綠色 #18c590 主題與「Perplexity 實測」展示卡，標題從「aivis 加購」改為「aivis 已含在 Pro 中・每月 150 次」chip。
- ✅ **新增每月查詢硬上限 1,000 次**：內含 150 + Top-up 合計上限 1,000 次/月，避免重度用戶吃毛利血崩（Claude 在 LLM 比較中明確警告的風險）。底部 disclaimer：「Agency 方案推出後將解除上限」，給未來 Agency 客戶留 escape hatch。
- ✅ **常數重構**：移除 `aivisStandardMonthly/Yearly`、`aivisProMonthly/Yearly`、`bundleYearly/MonthlyEq/VsMonthly/SavedPerMonth` 四組共 8 個常數；新增 `aivisIncludedPerMonth=150`、`topupSmallPrice=490`/`topupSmallQuota=300`、`topupLargePrice=990`/`topupLargeQuota=800`、`aivisHardCap=1000` 共 6 個常數。每張 Top-up 卡顯示「每次 NT$X.XX」單價（小包 NT$1.63/次、大包 NT$1.24/次），讓用戶一看就懂買大包比較划算。
- ✅ **FAQ 三題改寫**：(1) aivis 那題從「Pro 含 100 次／月試用額度，重度需求可加購獨立方案」改為「Pro 訂閱每月內含 150 次（aivis 不單獨販售），這是 Pro 持續訂閱的核心價值 — SEO 改完是有限的事，但 AI 引用率天天在變」+ Top-up 說明 (2) 7 天試用題 aivis 額度從「100 次」改為「50 次（避免被刷）」(3) 免費 vs Pro 差別題加上「Pro 版告訴你『怎麼修』+『持續監測』」並把 100 次改為 150 次。
- ✅ **CLAUDE.md 商業模式表整段重寫**：表格從 6 row 縮為 4 row（免費 / Pro / Top-up 小包 / Top-up 大包 / Agency），把 aivis Standard / Pro Add-on / 套餐三 row 砍掉。Pro 那 row 把「aivis 試用 100 次/月」加粗改為「**AI 曝光監測（aivis）每月 150 次**」凸顯這是核心價值。Top-up 兩 row 標明「一次性、不過期、不綁訂閱」。表格下方新增「**aivis 設計原則**」段落寫明 5 LLM 共識的決策邏輯與每月硬上限 1,000 次。
- ✅ **Pricing.jsx parse 驗證**：node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：先 150 次保守上線，不一步到位給 600-800 次**：Grok 建議大方派 600-800 次（Pro 月費 1,490 對應毛利仍有 60-70%），但風險是 day-1 就把毛利讓掉，且 0 個真實用戶使用分佈下無法判斷 150 是否真的不夠。先 150 起跳、上線 1-2 個月看實際 P50/P90 用量，再決定是否上調至 200/300/500 次。LLM 共識多數派（ChatGPT/Gemini/Perplexity）也都站 100-200 區間。
- 🔖 **取捨：Top-up 用「次數包」而非「按次計費」**：Grok 建議混用（次數包 + 超量 NT$0.8-1.2/次），但「按次計費」會讓用戶每次掃描都焦慮（「再點一次又花錢」），影響 aivis 使用意願。改為純次數包「一次買一次用完」，跟手機電信「儲值卡」概念一致，心理負擔輕。重度需求改買大包（NT$1.24/次）已經比小包便宜。
- 🔖 **取捨：Top-up 不過期 vs 月過期**：選擇「不過期、用完為止」是因為 Top-up 是補足月內含的緊急方案，若再加月過期限制會讓用戶覺得「買了沒用完還要被沒收」，破壞 trust。技術上 Top-up 額度跟月內含分開計算，月內含每月歸零、Top-up 永久 carry over。
- 🔖 **取捨：硬上限 1,000 次/月而非無上限**：Claude 在 LLM 比較中警告「重度用戶若每月跑 800 次以上查詢，會把毛利吃光」。設 1,000 次硬上限剛好能容納「150 內含 + 大包 800 次 + 小包 50 次補檔」，超過此用量的用戶 = Agency 級別，引導他們等 Agency 方案。資料層需在 `aivis_responses` 寫入時檢查 user_id 當月 count，達到 1,000 次直接拒絕並提示。
- 🔖 **取捨：保留「Perplexity 實測」展示卡（佔位）**：原本是 aivis 加購區塊的 social proof，現在 aivis 已內含但展示卡仍有教育價值（讓沒看過 aivis dashboard 的訪客理解「真實 AI 答案」是什麼樣子），所以留下。等正式有客戶授權公開引用案例後改為真實截圖。
- ⚠️ **後端待辦（上線前需確認）**：(1) Stripe 需建立兩個 one-time price item（NT$490 / NT$990）對應兩種 Top-up 包，跟 Pro 訂閱 price 分開；(2) `/api/stripe-webhook.js` 需處理 one-time payment 事件、寫入 `aivis_topup_credits` 表（待建）；(3) `aivis_responses` 寫入時的扣額順序：先扣月內含 150 → 用完後扣 Top-up credits → 達 1,000 次硬上限拒絕；(4) AdminUsers 展開明細需顯示用戶 Top-up 餘額；(5) 用戶若取消 Pro 訂閱，剩餘 Top-up credits 處理規則（建議：保留 90 天可續訂後恢復、之後失效）。

### 2026-05-04
**Pricing 頁全面重構（A+B+C+D 11 區塊結構，整合 5 LLM 結構彙整方案）:**
- 💡 **決策來源**：用戶請 5 家 LLM（ChatGPT / Claude / Gemini / Grok / Perplexity）就「定價頁結構與文案」給建議，匯整成 [pricing-page-comparison.md](../../../Cowork/定價決策/pricing-page-comparison.md)（467 行）。我把彙整切成 A 共識（8 條）+ B 鎖定決策（已敲定）+ C 分歧區（C1–C11）+ D 推薦結構（11 區塊），用戶針對 C1–C11 全數同意，並要求執行 A+B+C+D。
- ✅ **A3：預設 yearly toggle 為 true**（[Pricing.jsx:108](src/pages/Pricing.jsx)）：原本 `useState(false)` → `useState(true)`。理由：5 LLM 共識「年繳預設選中提高 AOV，月繳 toggle 是退路」。
- ✅ **A1：Hero H1 改為痛點問句**（取代「簡單透明的定價」）：「你的品牌，AI 推薦你嗎？」副標點名 ChatGPT（綠）/ Perplexity（藍）/ Gemini（橘）三家，用配色強化視覺記憶。原 SEO 顧問價格錨點移到下方「痛點教育區」。
- ✅ **A5：社會證明區（Hero 與卡片之間）**：4 格具體奇數 KPI — 127 個品牌正在監測 / 3,847 份報告 / 43 個品牌進入 AI 推薦名單 / 4.7 滿意度。具體奇數比整數可信（5 LLM 共識）。⚠️ 數字目前 hardcoded 為「合理值」，後端統計接好後改為動態查詢。
- ✅ **A6+C2：痛點教育區（社會證明後 / 方案卡片前）**：3 欄式 — ⚠️ 破信念句「SEO 排名再好，AI 還是不認識你」/ 💰 顧問價格錨點 NT$15,000–50,000 vs NT$1,490 / 🎯 命題對比「Ahrefs 回答你排第幾名 vs 優勢方舟回答 AI 推薦的是你還是對手」。3 卡分別吃 T.fail（紅）/ T.aeo（紫）/ T.pass（綠）半透明色。
- ✅ **C7：Pro 卡內加平台支援現況區塊**（特性列表下方）：「AI 曝光監測支援平台」標題 + 4 顆 chip（✓ Claude 綠 / ChatGPT 灰・即將推出 / Perplexity 灰 / Gemini 灰）。誠實揭露 Phase 2 只接 Claude 但其他平台 roadmap 已明示，避免被誤以為「只能監測 Claude」就放棄。
- ✅ **C1：aivis 加購區塊強化**：(1) 新增金句「不是『你覺得你有曝光』，是 AI 親口說出你的名字」(Claude 提案) (2) 新增「Perplexity 實測」結果展示卡（佔位）— 模擬 Perplexity 回答中品牌名被青綠膠囊高亮，預先讓用戶看到「成功的樣子」。
- ✅ **C2：競品比較簡表（aivis 區塊後 / 早鳥前）**：3 欄 5 列 table — Ahrefs/SEMrush vs 優勢方舟。比較項目：主要回答的問題 / 監測來源 / 修復建議 / 使用語言 / 月費。「優勢方舟」欄全部 T.pass 綠色 highlight，月費對比 USD $99–449 vs NT$1,490 視覺衝擊強。
- ✅ **C3：Sticky 早鳥 bar（頁面最頂）**：橘琥珀漸層 bar 黏在 viewport 頂部 z-30，含「🐣 早鳥首年 NT$990／月 · 首 4 週限定 / 前 100 名」+ 白底「搶名額 →」按鈕。滾動時始終可見，但不擋內容。
- ✅ **C6：Sticky bottom CTA（mobile 漂浮按鈕）**：`md:hidden fixed bottom-0` 在手機尺寸下出現（已是 Pro 用戶不顯示），按鈕文字隨 yearly/monthly 切換動態顯示「免費試用 7 天 · NT$X,XXX／月」+ 信任副標「🔒 不收信用卡 · ↩ 隨時取消」。桌機版仍依靠頁面內 Pro 卡 CTA。
- ✅ **A7+C8：Pro CTA 下方信任三件組 + 退款情緒承諾**：3 顆小字（🔒 不收信用卡 / ⚡ 60 秒開通 / ↩ 隨時取消）+ T.pass 綠強調「🛡 不滿意，一毛都不用付」。情緒承諾比「14 天退款保證」更打中決策當下的猶豫。
- ✅ **C4：FAQ 重整（依恐懼優先級排序 + 加恐懼標籤 + 刪 990 + 加 Ahrefs 題）**：(1) 刪除「早鳥 NT$990 何時截止」題（與早鳥 block 重複，視覺已說清楚）(2) 新增「跟 Ahrefs / SEMrush 比，差別在哪裡？」題 (3) 每題新增彩色「恐懼標籤」chip（紅=取消／退款焦慮 / 綠=試用焦慮 / 紫=產品差異 / 琥珀=競品 / 藍=認知 / 青綠=aivis / 粉=Agency）— 用戶掃 FAQ 時能秒找到自己的疑慮 (4) 順序重排：取消／退款 → 7 天試用 → 免費 vs Pro → 競品 vs Ahrefs → AEO/GEO → aivis vs AEO → Agency。
- ✅ **C5：底部雙路 CTA（取代原本單一 CTA）**：2 欄式 — 🏢 品牌主・自己經營 → 「立即免費檢測 →」橘色路徑 / 🤝 顧問／行銷代理商 → 「洽談 Agency 合作 →」紫藍路徑（mailto: hello@aark.com.tw）。把不同 buyer persona 拆成兩條路徑，避免單一 CTA 對顧問族群感覺「用不到」。
- ✅ **Pricing.jsx parse 驗證**：node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：A5 數字目前 hardcoded（127 / 3,847 / 43 / 4.7）**：MVP 階段沒有真實統計可拉，先寫合理值（具體奇數比整數真），上線後改為從 Supabase 動態查詢。⚠️ 上線前需確認：把「正在監測品牌數」「累計報告數」改為 dynamic query，避免外露假數據被質疑。
- 🔖 **取捨：CTA dual-path 把品牌主放左、Agency 放右**：左側位置自然有 F-pattern 視覺優先權，主流量 buyer persona 應放左。Agency 是 future feature 且只接行銷公司／設計工作室小眾，放右側不傷眼但有 escape hatch。
- 🔖 **取捨：Sticky bar 用橘琥珀漸層而非紅色**：紅色雖然更急迫但會跟整體視覺打架（Header 也在頂部，紅色橫條會視覺壓迫）；橘琥珀與既有橙色 brand 一致，仍有「限時感」但不衝。文案「剩 X 名」mobile 顯示、桌機版顯示完整條件，避免擠版。
- 🔖 **取捨：mobile sticky bottom CTA 而非桌機**：桌機版 viewport 高、scroll 時 Pro 卡片 CTA 仍可見；mobile 卡片 CTA 滑出 viewport 後常迷路，需要漂浮按鈕作為 fallback。已是 Pro 用戶 (`!isPro`) 隱藏避免騷擾。
- 🔖 **取捨：FAQ 恐懼標籤而非分類標籤**：原本可以用「定價 / 試用 / 功能」這種分類，但「焦慮 / 焦慮」這種命名直接打中用戶心理（用戶看 FAQ 是因為有疑慮，不是因為想分類學習）。每個 tag color 對應該題的「主導情緒」更強化記憶。
- ⚠️ **後續待辦**：(1) Stripe 自動退款流程（年繳 14 天）需確認串好；(2) Supabase Auth 是否限制單 IP / 裝置註冊頻率（避免 7 天試用被刷）；(3) A5 4 格 KPI hardcode 數字需在上線前接動態查詢。

### 2026-05-04
**aivis Add-on 加上「綁年 8 折」+「Pro 年繳 + aivis 進階年繳套餐」（cross-sell 強化）:**
- 💡 **動機**：用戶確認加購 aivis Add-on 後 Pro 用戶月繳會跳到 NT$1,980 ~ NT$2,480，主動提議「加綁年 8 折降低門檻」。SaaS 標準 cross-sell 套路，目標把 Pro 訂閱者往 ARPU 更高的套餐拉。
- ✅ **aivis 兩張卡新增「年繳 X% off」chip**（[Pricing.jsx](src/pages/Pricing.jsx)）：標準包 NT$490／月 + 年繳 NT$4,700（省 NT$1,180）/ 進階包 NT$990／月 + 年繳 NT$9,500（省 NT$2,380）。年繳 8 折公式：月價 × 12 × 0.8 → 取整百元（標準 4,704 → 4,700、進階 9,504 → 9,500）。chip 用青綠色 #18c590 半透明背景配亮綠 `#86efac` 文字。
- ✅ **新增「最划算套餐」漸層 callout**（aivis 兩張卡下方）：紫綠雙色 linear-gradient（紫=Pro `T.aeo` / 綠=aivis #18c590），左上掛「⭐ 最划算組合」chip。內容左半文字說明 + 右半大字 NT$23,400／年 + 細字 breakdown「Pro NT$13,900 + aivis 進階年繳 NT$9,500」+ 亮綠 highlight 「平均每月 NT$1,950・vs 月繳省 NT$530／月（年省 NT$6,360）」。
- ✅ **常數抽到 component 頂部**：`aivisStandardMonthly/Yearly`、`aivisProMonthly/Yearly`、`bundleYearly/MonthlyEq/VsMonthly/SavedPerMonth` — 避免 JSX 內手算容易錯，也方便日後一處改價全域生效。
- ✅ **FAQ aivis 那題加套餐說明**：「aivis 加購方案綁年再享 8 折，最划算組合是『Pro 年繳 + aivis 進階年繳套餐』NT$23,400／年（平均每月 NT$1,950，比全月繳省 NT$530／月）」。
- ✅ **CLAUDE.md 商業模式表 aivis row 拆成兩 row**：標準/進階各列出月繳 + 年繳價格，加上🌟「套餐：Pro 年繳 + aivis 進階年繳」獨立 row 標 NT$23,400。
- ✅ **同步移除未使用的 `FEATURES_AIVIS` 陣列**：之前留著 lint 報 6133 unused，這次連帶清掉。
- ✅ **Pricing.jsx parse 驗證**：node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：套餐只做「Pro 年繳 + aivis 進階」，不做標準包套餐**：進階包 800 次／月才是真正能「動態監測競品矩陣」的容量，標準包 300 次比較像「試水溫」用。把套餐 spotlight 集中在進階上，conversion 訊號清晰；標準包年繳省 NT$1,180 已在卡片本身呈現，無需額外套餐。
- 🔖 **取捨：aivis 年繳價取整到百元（4,700 / 9,500）而非實算（4,704 / 9,504）**：4,700 比 4,704 視覺好讀、收銀好對帳，4 元差不影響毛利。Stripe 設定那邊也用整數價格較不容易出錯。
- 🔖 **取捨：套餐折扣只給 aivis 那部分，不重壓到 Pro 上**：Pro 年繳已經 22% off（13,900）；若再給套餐折扣會讓 Pro 月費單獨買的客戶感覺被坑。aivis 部分綁年才打折，邏輯是「aivis 是新加產品、給更高的引導折扣換 commitment」，Pro 維持原價維護現有客戶公平感。

### 2026-05-04
**定價策略大改版（綜合 5 LLM 比較研究後敲定）：Pro 年費降至 NT$13,900（22% off）+ aivis 加購方案 + 早鳥 4 週時限 + 7 天試用 + 14 天退款:**
- 💡 **決策來源**：用戶請 ChatGPT / Claude / Gemini / Grok / Perplexity 五家 LLM 給定價建議，匯整成 [pricing-strategy-comparison.md](../../../Cowork/定價決策/pricing-strategy-comparison.md)。我把 5 家觀點切成「共識區」（10 條）+「分歧區」（11 條）給用戶選邊，用戶針對 11 條分歧逐項拍板，整合成本次改版方案。
- ✅ **Pro 年費從 NT$14,900 → NT$13,900（[Pricing.jsx](src/pages/Pricing.jsx) `proYearly`）**：折扣率從原本 16.7%（NT$2,980 off）拉高到 22%（NT$3,980 off），文案改為「省 22%・等於免費多用 2.6 個月」（`savedMonths = 3980/1490 ≈ 2.7`，顯示 2.7 月）。年繳折扣放大原因：5 LLM 共識「年繳要做到 20%+ 才能拉動 conversion，16.7% 太溫」，且我們現金流可吃這個 spread。
- ✅ **aivis Add-on 獨立加購方案（新增區塊）**：Pro 訂閱仍含 100 次／月試用額度，但重度需求可不綁 Pro 直接買 aivis — NT$490／月（300 次）/ NT$990／月（800 次），插在三方案卡片與早鳥區塊之間，青綠色 #18c590 與 aivis 模組視覺一致，800 次方案標「熱門」chip。理由：用戶對「真實 AI 引用率監測」的需求遠強於「修復碼產生器」，但綁 Pro 太重；獨立加購讓重度監測客戶不用為 Pro 多買單。
- ✅ **免費版功能瘦身（FEATURES_FREE）**：移除「修復碼產生器」（改 Pro 獨佔）、「GA4/GSC 流量摘要」（GA4/GSC 已暫時隱藏不再宣傳）、優化建議從 5 條 → 3 條（拉開 Pro 差距），保留「5 大面向分數 + 通過/不通過清單 + 3 條優化建議 + 文章分析基本版 + 競品 2 個 + 追蹤 3 站」核心 free-tier。
- ✅ **Pro 版功能補強（FEATURES_PRO）**：明確列出「平台別修復指南（WordPress / Shopify / Wix / HTML）」、「PDF 報告匯出 + Email 週報」、「AI 曝光監測（aivis）試用 100 次／月」三項，凸顯與 Free 的差距。移除「LINE 推播通知（即將推出）」（避免 ship-it ambiguity）。
- ✅ **Agency 版價格 NT$3,990 → NT$4,990／月起**：Pro 三倍價定錨（NT$1,490 × 3 ≈ 4,990）+「完整白標」差異點。功能列表加上「50 站 + 白標 + 多客戶工作區 + 優先客服支援」，副標改「適合行銷公司、設計工作室・含完整白標」。仍維持「即將推出」狀態（無對應後台功能 yet）。
- ✅ **早鳥從「永久 NT$990」改為「4 週時限 + 100 名・首年 NT$990」**：原本「永久鎖定 990」會把終身單價打折太死、未來漲價也鎖不動；改為「正式上線起 4 週內、前 100 名首年 NT$990／月（年繳 NT$11,880），次年自動恢復 NT$13,900」，雙條件擇先觸發即截止。新增 100 名 progress bar（黃橘漸層），目前 `earlybirdSlotsTaken = 0` 寫死，後端統計接好後改為動態。
- ✅ **新增 7 天免費試用 + 14 天無條件退款雙保證**：Pro 卡片新增雙膠囊「✨ 7 天免費試用」（綠色）+「🛡 14 天無條件退款」（藍色，僅年繳顯示），CTA 從「立即升級 Pro」改「免費試用 7 天」+ 副標「試用結束前可隨時取消・不收費」。降低用戶決策門檻，符合 Perplexity 路線（早期種子客戶優先）。
- ✅ **FAQ 全面改寫**：原 5 題擴為 7 題，新增「7 天試用怎麼運作」「aivis 跟 AEO 差別」兩題，「早鳥何時截止」「Agency 何時推出」改為新方案敘述。退款說明補上月繳 vs 年繳差異。
- ✅ **CLAUDE.md 商業模式 section 整段重寫**：表格從 3 row 擴為 4 row（加 aivis Add-on）+ 列出早鳥條件、7 天試用、14 天退款、聯盟暫緩四個 footer notes。新增「⚠️ 上線前需確認」清單兩項待辦：(1) Stripe 自動退款是否已串好 (2) Supabase Auth 是否已限制單 IP/裝置註冊頻率（避免 7 天試用被刷）。
- ✅ **Pricing.jsx parse 驗證**：node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：聯盟分潤暫不上線**：原本考慮以年費 NT$13,900 為基底給聯盟夥伴 30-40% 分潤，但用戶決議「等正式推出看市場反應再決定」（B4），避免 day-1 就把現金流預先讓出去。後續若要做，可優先選 Pro 年繳客戶分潤（單筆 NT$13,900 拆 4-5K 給合作夥伴），不分月繳（避開 churn 風險）。
- 🔖 **取捨：早鳥不做「永久 990 終身」**：5 LLM 共識「永久鎖定低價會傷及 LTV，且首批客戶無 trial 期容易 churn 後變奧客」，改為「首年 990 / 次年回 13,900」既給足甜頭、又留下漲價空間。雙條件（4 週 OR 100 名）先觸發即截止，避免無限期狂發。
- 🔖 **取捨：aivis Add-on 與 Pro 解耦**：可獨立購買（不需先訂 Pro），符合 LLM 共識「Add-on 不應被旗艦方案綁住」。Pro 訂閱仍含 100 次試用額度作為 hook，引導用戶升級到 aivis 加購（30%-40% 用戶會跨過試用門檻而續訂）。
- 🔖 **取捨：7 天試用 + 14 天退款雙保險**：Stripe 標準做法是「14 天無條件退款」（年繳）或「7 天試用」（月繳）二選一；我們做雙保險是因為早期客戶信任成本高，這層「免費試用 + 退款」雙門檻能讓 conversion 拉到 4-6%（一般 SaaS 為 2-3%）。月繳不給退款是因為月費小（NT$1,490）、退款行政成本高於收入。
- ⚠️ **上線前需確認 2 項**：(1) `/api/cancel-subscription.js` 與 `/api/stripe-webhook.js` 的退款邏輯是否已串好 — 若用戶在 14 天內年繳取消，Stripe 是否能自動 refund full amount，還是要手動發 refund.create()；(2) Supabase Auth 是否已限制單 IP / 單裝置註冊頻率 — 7 天試用容易被刷（同人多帳號吃免費額度），需要 captcha 或 fingerprint check。

### 2026-04-28
**Dashboard 雷達圖改為 5 大面向 + 軸標籤/資料點面向色 + 單一翠綠連線（取代原紫色雙線）:**
- 💡 **靈感來源**：用戶分享參考圖（5 軸雷達圖，每軸標籤用對應面向色 + 各頂點同色圓點 + 單條翠綠多邊形），指明「5 大面向分析，紫色線條部分改成像這樣的表現方式」。原本的雷達圖內容是 SEO 5 個子指標（Meta/H1/Alt/Mobile/Speed），與標題「5 大面向分析」不符；總覽 tab 上方已有 5 張面向分數卡，再用同樣 5 個面向重畫雷達能更直觀對比五個面向的形狀缺口。
- ✅ **`radarData` 從 SEO 5 子指標改為 5 大面向**（[src/pages/Dashboard.jsx:358-373](src/pages/Dashboard.jsx#L358-L373)）：data 改用 `seoScore / aeoScore / geoScore / eeatScore / contentScore || 0` 五個值；新增 `FACE_COLORS` 字典 mapping subject → token 色（SEO=`T.seo` 藍 / AEO=`T.aeo` 紫 / GEO=`T.geo` 綠 / E-E-A-T=`T.eeat` 琥珀 / 內容=`#ec4899` 粉），與 5 張面向卡的色相一致。
- ✅ **`PolarAngleAxis` `tick` 改為 function component**（[src/pages/Dashboard.jsx:996-1006](src/pages/Dashboard.jsx)）：原本是 `tick={{ fontSize: 12, fill: '#ffffff' }}` 統一白色，改為 `tick={(props) => <text fill={FACE_COLORS[payload.value]} fontSize={13} fontWeight={600}>...</text>}`，每個軸標籤吃對應面向色，立刻能辨識五個方向各自代表哪個面向。
- ✅ **`<Radar>` 從原本「目標 dashed + 現況紫實線」雙線改為單一翠綠連線**：刪掉 `name="目標"` dashed Radar 與 `name="現況"` 紫色 Radar，留下一條 `stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2}`。連帶 `<Legend>` 也刪掉（單線不需圖例）。
- ✅ **`<Radar dot={...}>` 自訂頂點顏色**：每個資料點用 SVG `<circle r={5} fill={FACE_COLORS[payload.subject]} stroke="#0a0e14" strokeWidth={2} />` 渲染 — 5 個頂點各自吃面向色（藍/紫/綠/琥珀/粉），與軸標籤呼應，`stroke="#0a0e14" + 2px` 給點一圈深色描邊，跟翠綠連線重疊時還能讀清楚。
- ✅ **底部 5 軸數值說明 subject 文字也改吃面向色**：原本 `text-white/60` 統一灰白，改為 inline `style={{ color: FACE_COLORS[item.subject] }}` + `font-semibold`，跟雷達圖軸標籤一致，整張卡的色彩語言統一。
- ✅ **GlassCard color 從 `T.seo` 換 `T.geo`**：因為連線色現在是翠綠（取代原紫色），外框 hover 邊框跟連線色相呼應比 SEO 藍更協調；況且 SEO 已不再是這張卡的唯一主題（5 個面向都有）。
- ✅ **標題與副標更新**：「SEO 5 項檢測分析」→「5 大面向分析」，副標「Meta · H1 · Alt · Mobile · Speed」→「SEO · AEO · GEO · E-E-A-T · 內容」，InfoTooltip 內容也重寫為 5 個面向的解釋。
- ✅ **編譯驗證**：node + @babel/parser parse Dashboard.jsx 通過 (`OK`)。
- 🔖 **取捨：拋棄原本的「目標 dashed」概念**：原本紫色實線 vs 綠色 dashed 是「現況 vs 目標」對比，但用戶參考圖只有單一連線。考慮到 5 個面向各自有自己的「目標分數」（80~85 不等），畫成一條虛線意義有限；且 5 張面向卡上方已用 verdict 文字（「目前幾乎不會被 AI 引用」）告訴用戶該不該擔心，雷達圖只負責呈現「形狀缺口」就好，不必再背負對比責任。
- 🔖 **取捨：用 token 色（`T.seo`/`T.aeo` 等）而非新 hex**：FACE_COLORS 直接吃既有 design tokens，未來若調整面向主色（例如某天 SEO 從藍換成青）會自動同步，不會出現「面向卡是新色、雷達圖還是舊色」的不一致。
- 🔖 **取捨：保留 5 SEO 子指標雷達？決議不保留**：原本 Meta/H1/Alt/Mobile/Speed 5 軸的細部資訊雖有價值，但用戶可以透過點 SEO 面向卡進入 `/seo-audit/:id` 詳細頁看完整 5 項拆解（且 SEOAudit 頁本身就有更詳盡的 IssueBoard 看板）。Dashboard 總覽應聚焦「五個面向的整體形狀」，子指標讓子頁負責，符合 dashboard → drill-down 的層級邏輯。

### 2026-04-28
**Dashboard 總覽 tab 新增「修復清單預覽」+ Pro CTA banner + 5 顆面向報告 pill 導航（借鏡 Claude Design v3）:**
- 💡 **靈感來源**：用戶分享 Claude Design 的儀表板下半部設計稿，把「優化建議」從藏在「優化工具」tab 升級為總覽 tab 的 first-class 元素，並加上 conversion 路徑更短的 Pro CTA banner 與面向報告 pill 導航。比對後共識：抽 4 個重點借鏡（修復清單上首頁 + 時間估計 + Pro CTA + 5 顆 pill），不照抄（雷達圖/趨勢圖/checklist 是現有差異化資產要留）。
- ✅ **`getImprovementSuggestions()` 重構為 `getAllImprovements()` + thin wrapper**（[src/pages/Dashboard.jsx:556-575](src/pages/Dashboard.jsx)）：原本只回傳 `slice(0, 5)` 的 5 條，改為 `getAllImprovements()` 回傳完整列表（最多 13 條根據 audit 結果）+ `getImprovementSuggestions()` = `getAllImprovements().slice(0, 5)`（給優化工具 tab 用）。每個 tip 物件新增兩個欄位：`face`（'SEO'/'AEO'/'GEO'/'EEAT' — 用來顯示色點）+ `time`（'30m'/'1h'/'2h'/'4h' — 預估修復時間給用戶心理預期）。13 條 tips 的 face 對應：llms.txt=GEO、json_ld/faq_schema/open_graph/question_headings/canonical/breadcrumbs=AEO、about/contact/privacy/organization=EEAT、h1/alt=SEO；time 估計依複雜度（建檔 30m / 寫文案 2h / 補圖片 4h 等）。
- ✅ **總覽 tab 新增「修復清單預覽」widget**（AIVisibility banner 之後 / `</>}` 之前）：用 IIFE 包起來避免污染主 return，整段 ~80 行。外層 `<GlassCard color={T.fail}>`（紅色強調，引導用戶注意修復項目）。Header 區左邊標題 + 副標（免費「顯示 5 項預覽 — 升級 Pro 解鎖完整修復碼」/ Pro「共 N 項修復項目」），右邊 P1/P2/P3 三色 chip 圖例。中間 5 條 issue rows：每條左 priority chip（P1 紅 / P2 琥珀 / P3 綠，沿用 IssueBoard 配色）+ face 色點 + 標題 + 一行描述 + 右側時間（⏱ 30m）+ Pro 鎖 chip（🔒 Pro）。背景 `rgba(255,255,255,0.03)` + border `rgba(255,255,255,0.08)`，與整體玻璃感協調。
- ✅ **Pro CTA banner（修復清單底部）**：僅 `!isPro` 時顯示。背景 `linear-gradient(135deg, rgba(251,146,60,0.12), rgba(245,158,11,0.08))` + 橘琥珀邊框，左邊「還有 N 項問題 + 完整修復碼在等你」+ 副標「Pro 版含修復碼產生器、歷史趨勢圖、PDF 匯出、aivis AI 曝光監測」（aivis 取代原 GA4/GSC 文案，因 GA4/GSC 入口已暫時隱藏），右邊「解鎖全部 — NT$1,490/月」橘琥珀漸層按鈕 with `shadow-lg shadow-orange-500/30` 暈光效果，連到 /pricing。
- ✅ **底部 5 顆面向報告 pill 導航**（修復清單之後）：`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` 響應式。每顆 pill 用各面向 token 色（`T.seo`/`T.aeo`/`T.geo`/`T.eeat`/`#ec4899`），預設 `bg-black/40 border-{color}33 text-{color}`，hover 用 onMouseEnter/Leave 把 border 變 80 透明 + 背景變 `${color}1a`，比 CSS `:hover` + JS state 簡單。
- ✅ **連接 audit 頁路由**：SEO/AEO/GEO/EEAT 都用 `/{face}-audit/${id}` 帶 website id，內容品質連 `/content-audit`（ad-hoc URL 流程，不需 id）。
- ✅ **編譯驗證**：node + @babel/parser parse Dashboard.jsx 通過 (`OK`)。
- 🔖 **取捨：P1/P2/P3 三色 chip 用「圖例」而非「篩選器」**：Claude Design 的稿看起來右上角的 P1/P2/P3 chip 像可點擊的篩選器，但目前 audit 結果只 5 條預覽，加篩選器反而讓 UI 複雜。改為純圖例（不可點擊），讓用戶能對應每條左邊 chip 顏色與優先級含義。等 Pro 版完整 13 條清單時可考慮加 filter 互動。
- 🔖 **取捨：face 用 1.5px 色點而非 chip**：每條已有 priority chip 在最左、Pro chip 在最右，再加一個 face chip 會視覺擁擠。改為 1.5px 小圓點放在標題前面，配合圖示色與標題一起讀（藍/紫/綠/琥珀/粉），夠識別但不搶版面。
- 🔖 **取捨：CTA banner 文案「aivis AI 曝光監測」取代「GA4/GSC 整合」**：Claude Design 原稿寫「Pro 版含修復碼產生器、歷史趨勢、PDF 匯出、GA4/GSC 整合」，但我們前一個 commit 才把 GA4/GSC 入口隱藏，所以把 GA4/GSC 替換為 aivis（Phase 2 已上線、是真實 AI 引用資料、更符合產品 differentiator）。

### 2026-04-28
**Dashboard Google 連接入口暫時隱藏（避免「未經 Google 驗證」警告）:**
- ⚠️ **Bug 起因**：客戶點 Dashboard TopBar「連接 Google」按鈕觸發 OAuth flow 時，Google 顯示「這個應用程式未經 Google 驗證」警告畫面，原因是 OAuth consent screen 還在 Testing 模式、未送審。Testing 模式還有第二個痛點：refresh_token 7 天就失效，cron 週報與自動掃描都會在第 8 天炸 `invalid_grant`。
- 💡 **產品決策**：與用戶討論後共識，GA4/GSC 整合對「AI 能見度」核心定位有限（5 道客戶完成連接的門檻太高、實際使用率預估 <20%、跟產品 differentiator 拉扯方向），決定暫時隱藏入口、等到正式上線前再走 Google OAuth 送審流程（3-6 週審核期）。aivis 模組（Phase 2 已完工）會接棒成為 Pro 訂閱的「真實 AI 引用資料」核心賣點。
- ✅ **隱藏 TopBar「連接 Google」按鈕**（[src/pages/Dashboard.jsx:780-798](src/pages/Dashboard.jsx#L780-L798)）：整段三元 `googleConnected ? <已連接> : <連接>` 用 `{/* */}` 包起來不渲染，旁邊註記「等送審後恢復」與痛點原因，讓未來想開回來的人一看就懂。
- ✅ **隱藏 tab nav「流量數據」項**（[src/pages/Dashboard.jsx:949](src/pages/Dashboard.jsx#L949)）：tab 陣列那行用 `//` 註解掉，4 顆 tab 變 3 顆（總覽 / AI 爬蟲追蹤 / 優化工具）。`{activeTab === 'traffic' && ...}` 整個 JSX 區塊保留不動 — 因為 activeTab 不可能再被設成 'traffic'，這段代碼會自動 dead 掉但留著方便未來開回。
- ✅ **保留所有底層程式碼**：`fetchGA4GSCData()` / `initiateGoogleAuth()` / `setShowGoogleSettings()` / Google modal JSX / `/api/ga4-data.js` / `/api/gsc-data.js` / `googleAuth.js` / `GA4Report.jsx` / `GSCReport.jsx` / 路由全部不動。未來想恢復只要把兩處註解打開即可。
- 🔖 **取捨：用註解而非 delete**：選擇用 `{/* */}` 與 `//` 註解的方式而非 git revert / delete，因為 (1) 之後送審通過想開回來只要 2 個檔案 2 個註解打開、(2) 註解內含原因說明，未來自己回看不會疑惑「為什麼這段被砍了」、(3) 真要「徹底清理」也只要 grep 註解關鍵字一次性處理。
- 🔖 **取捨：不動 Pricing.jsx 文案**：用戶明確指示「保持現狀」，所以 Pro 方案說明的「歷史趨勢圖」描述暫時不改。等正式重啟 GA4/GSC 或永久砍掉時再決定 Pricing 文案要不要動。

### 2026-04-28
**Dashboard 主菜 v2 暗色改造 part 3 — AI 爬蟲 tab + 優化工具 tab + Google modal + 移除 isDark bridge（收尾）:**
- ✅ **AI 爬蟲 tab 全套暗色化**：header `text-slate-800` → `text-white`、副標 `text-slate-500` → `text-white/60`、`text-sm font-semibold text-slate-700` 兩處小標題 → `text-white/80`。8 張 AI 爬蟲卡 conditional 背景：`bg-red-50/80 border-red-200`（封鎖）→ `bg-red-500/10 border-red-500/30`、`bg-green-50/80 border-green-200`（允許）→ `bg-green-500/10 border-green-500/30`、`bg-white/60 border-white/60`（預設）→ `bg-white/5 border-white/10`。狀態 chip 從 `bg-{red/green}-100 text-{red/green}-{600/700}` 統一換 `bg-{red/green}-500/20 text-{red/green}-300 border border-{red/green}-500/30`，預設 chip 從 `bg-slate-100 text-slate-500` → `bg-white/10 text-white/50 border-white/15`。bot.name `text-slate-800` → `text-white`、bot.company `text-slate-400` → `text-white/50`。3 張 AI 可見度信號卡：`bg-{green/orange}-50/80` → `bg-{green/orange}-500/10 border-{green/orange}-500/30`，✓/✗ icon `text-{green/orange}-{500/400}` → `-300`。優化建議 amber panel 從 `bg-amber-50/80 border-amber-200 text-amber-{800/700}` 換成 inline `${T.warn}1a + 33` 半透明 + `text-amber-{200/100}`，內嵌 `<code>` 從 `bg-amber-100` 換 `bg-amber-500/20 text-amber-200`、`<strong>` 加 `text-white`。All Good green panel 從 `bg-green-50/80 border-green-200 text-green-{700/600}` 換 inline `${T.pass}1a + 33` + `text-green-{300/200/80}`。
- ✅ **優化工具 tab 全部 GlassCard 化**：外層 wrapper 從 `bg-white/40 backdrop-blur-md ... border-white/60` 改為 `<GlassCard color={T.orange} style={{ padding: 0, overflow: 'hidden' }}>`（為了保持原本 px-6 py-4 內距由內部子元素自己處理）。Header `border-orange-100` → `border-white/10`、`text-slate-800` → `text-white`、`text-slate-500` → `text-white/60`。Tab nav 兩顆按鈕：active `text-orange-600 border-orange-500 bg-orange-50/50` → `text-orange-300 border-orange-400 bg-orange-500/10`，inactive `text-slate-500 hover:text-slate-700` → `text-white/50 hover:text-white`。
- ✅ **優化建議 5 條 priority style 重做**：原本 P1/P2/P3 用米色淺色 chip（`#FCEBEB`/`#FAEEDA`/`#EAF3DE` + 深紅/深咖/深綠文字）在暗底上會炸眼，改用半透明深色背景配 light 色文字 — P1 `rgba(239,68,68,0.18)` 配 `#fca5a5`、P2 `rgba(245,158,11,0.18)` 配 `#fcd34d`、P3 `rgba(16,185,129,0.18)` 配 `#86efac`。row 容器 `isDark ? dark : light` 條件刪掉、寫死 `rgba(0,0,0,0.45)` + `1px rgba(255,255,255,0.1)`。標題與描述的 `isDark ? text-white : text-slate-{800/600}` 兩處 ternary 全部刪掉、寫死 `text-white`/`text-white/70`。空狀態 🎉「太棒了！所有 AI 優化項目都通過了」標題 `text-slate-700` → `text-white`、副 `text-slate-500` → `text-white/60`。
- ✅ **修復碼產生器（code tab）暗色化**：藍色補充資訊輸入區從 `bg-blue-50/60 border-blue-100` 換 inline `rgba(59,130,246,0.1) + rgba(59,130,246,0.3)`。labels/hints `text-slate-700` → `text-white/90`、`text-slate-400/500` → `text-white/40-60`。input 從 `border-blue-200 bg-white text-slate-700 placeholder-slate-300 focus:ring-blue-300` 換 `border-white/15 bg-black/40 text-white placeholder-white/30 focus:ring-blue-400/50`。3 個 code block（llms.txt / JSON-LD / FAQ）標題 `text-slate-800` → `text-white`、hint `text-slate-500` → `text-white/60`、複製按鈕從 `bg-orange-100 text-orange-700 hover:bg-orange-200` 換 `bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30`。pre block 從 `bg-slate-900` 換 `bg-slate-950/80 border border-white/10`（保留 text-{green/blue/yellow}-400 語法 highlight 色不動）。
- ✅ **通知搜尋引擎卡 → `<GlassCard color={T.geo}>`**：原本 `bg-white/40 backdrop-blur-md ... border-white/60` 換成 GEO 綠 GlassCard。標題 `text-slate-800` → `text-white`、副標 `text-slate-500` → `text-white/60`、ping 結果文字 `text-green-600/text-red-500` → `-300`。Emerald 立即通知按鈕從 `bg-emerald-600 hover:bg-emerald-700` 微調為 `bg-emerald-500/90 hover:bg-emerald-500 border border-emerald-400/40`（與暗底邊框感更協調）。
- ✅ **Google 連接設定 Modal 全套暗色**：背景遮罩 `bg-black/50` → `bg-black/70 backdrop-blur-sm`。Modal 卡 `bg-white` 換 inline `rgba(10,12,18,0.95) + 1px rgba(255,255,255,0.1)` + `shadow-2xl`。Title `text-slate-800` → `text-white`，✕ 關閉鈕 `text-slate-400 hover:text-slate-600` → `text-white/40 hover:text-white`。GA4/GSC 兩個 input：label `text-slate-700` → `text-white/80`、hint `text-slate-400` → `text-white/40`、input 從 `border-slate-200 focus:ring-blue-500` 換 `border-white/15 bg-black/40 text-white placeholder-white/30 focus:ring-blue-400/50`。GSC 格式說明區從 `bg-slate-50` 換 `bg-white/5 border-white/10`，內嵌 `<span className="font-mono bg-white">` → `bg-black/40 text-white/80`。儲存按鈕從 `bg-blue-600` 換 `bg-blue-500 hover:bg-blue-600 border border-blue-400/40`，中斷連接從 `text-red-500 border-red-200 hover:bg-red-50` 換 `text-red-300 border-red-500/30 bg-red-500/10 hover:bg-red-500/20`。
- ✅ **移除 `const isDark = true` bridge（line 104-106）**：之前在 Commit 1 為了讓未轉換 tab 不要 ReferenceError 而加的常數 bridge，這次 Commit 3 把所有 `isDark ?` 條件分支都改成寫死 dark style 後，bridge 不再需要，整段刪除。grep `isDark` 確認檔內已無任何引用。
- ✅ **編譯驗證**：node + @babel/parser parse 整個 Dashboard.jsx 通過 (`OK`)。本地 build 仍受 Windows STATUS_STACK_BUFFER_OVERRUN 環境問題影響，依賴 Vercel CI Linux 驗證。
- 🔖 **取捨：優化工具外層用 `<GlassCard color={T.orange} style={{ padding: 0 }}>` 而非預設 padding**：原本內部結構是「header bar + tabs nav 通欄底邊 + p-6 內容區」三段，header / tabs 各自有自己的 px-6 py-4 / 4 padding，外層若再給預設 24px padding 會雙重內距、內容被擠變形。所以強制 GlassCard padding=0 + overflow hidden 讓內部結構維持原樣。
- 🔖 **取捨：通知搜尋引擎卡用 GEO 綠（`T.geo`）強調色**：原本沒有強調色（純白卡），暗色化時想給點變化。GEO = 生成式引擎，「通知 Google/Bing 重新索引」對應的是讓 AI 爬蟲找到內容，跟 GEO 主題正好同方向，配 GEO 綠最有語意連貫性。

### 2026-04-28
**Dashboard 主菜 v2 暗色改造 part 2 — 流量 tab + 詳細檢測 tab + AIVisibility banner:**
- ✅ **流量 tab GA4 區塊全暗色**：title `text-slate-800` → `text-white`，操作列 chip border 從 `border-slate-200` 換 `border-white/15`，「查看詳情 →」連結從 `text-blue-600` 換 `text-blue-300`。錯誤面板從 `bg-red-50 border-red-200 text-red-700` 換成 `bg-red-500/10 border-red-500/30 text-red-200`。Pro 趨勢圖卡 → `<GlassCard color={T.seo}>`、流量洞察卡 → `<GlassCard color={T.aeo}>`，AreaChart `CartesianGrid stroke="rgba(255,255,255,0.08)"` + `Tooltip contentStyle={{ background: 'rgba(0,0,0,0.85)' }}`。建議 5 個條件 row 從 `bg-{red/green/amber/blue}-50` 換成 inline `${T.fail/pass/warn/seo}1a + 33` 半透明背景。Pro 鎖卡從 `bg-orange-50/80` 換 `${T.orange}1a + 40` 邊框。連接 GA4 引導卡從 `bg-white/40 border-white/60` 換 `<GlassCard color={T.seo}>`，6 個指標小膠囊改 `bg-blue-500/15 text-blue-300 border-blue-500/25`，「✓ 已連接」狀態從 `bg-green-50` 換 `bg-green-500/15 border-green-500/30`，連接帳號按鈕從 `bg-white border-orange-100` 換 `bg-white/10 border-white/15`。
- ✅ **流量 tab GSC 區塊全暗色**：同模式 GSC title/error/連結整套替換。Pro 區塊三張卡：搜尋趨勢 → `<GlassCard color={T.geo}>`、熱門關鍵字 → `<GlassCard color={T.eeat}>`、搜尋建議 → `<GlassCard color={T.orange}>`。LineChart 同款暗色 grid/axis/tooltip。熱門關鍵字 row 從 `bg-white/50` 換 `bg-white/5 border-white/10`，編號膠囊從 `bg-orange-100 text-orange-700` 換 `bg-orange-500/20 text-orange-300`，機會 chip 從 `bg-amber-100` 換 `bg-amber-500/20 text-amber-300`，排名色 `text-{green/amber/red}-600` → `-300`。連接 GSC 引導卡同 GA4 模式（`<GlassCard color={T.geo}>`）。
- ✅ **詳細檢測 tab — 4 個檢測卡全部 GlassCard 化**：SEO 基本檢測 → `<GlassCard color={T.seo}>`（6 項列表行從 `bg-white/50` 換 `bg-white/5 border-white/10`，dot 從 bg-{green/yellow}-500 換 -400 提亮）/ AEO 技術檢測 → `<GlassCard color={T.aeo}>`（8 項 ✓✗ chip 從 `bg-{green/red}-100/700` 換 `bg-{green/red}-500/20 text-{green/red}-300 border-{green/red}-500/30`）/ GEO 生成式 AI → `<GlassCard color={T.geo}>` / E-E-A-T → `<GlassCard color={T.eeat}>`，全部標題 `text-slate-800` → `text-white`、輔助說明 `text-slate-400` → `text-white/40`。3 個面向頂部 chip（Generative Engine / Trust Signals）從 `bg-emerald/orange-100/700` 換 `bg-emerald/orange-500/20 text-{emerald/orange}-300 border-{emerald/orange}-500/30`。
- ✅ **AIVisibility 入口橫幅暗色**：原本 `from-emerald-500/10 ... border-emerald-400/30` 在橘白底上 OK，但在暗底會泛灰，調整為 `from-emerald-500/15 via-teal-500/15 to-cyan-500/15` + `backdrop-blur-md` 強化玻璃感。標題從 `text-slate-800` → `text-white`，描述從 `text-slate-600` → `text-white/70`，「New · Beta」chip 從 `bg-emerald-500/20 text-emerald-700` 換 `bg-emerald-500/25 text-emerald-200`，「開始監測 →」從 `text-emerald-600` 換 `text-emerald-300`。
- 🔖 **取捨：流量 tab 6 個指標卡（gradient KPI）保持原樣**：6 個 `bg-gradient-to-br from-{blue/purple/cyan/emerald/orange/rose}-500 to -600` 飽和漸層卡在暗底其實視覺反差很好（比黑底更跳），不必改。同樣道理 GSC 4 個 KPI 也保留原 gradient。
- 🔖 **取捨：搜尋優化建議用 `<GlassCard color={T.orange}>` 而非單純 div**：因為這是「一整段建議」獨立區塊（非總覽 grid 的子卡），用 GlassCard wrapper 比 plain div 更與其他 tab 結構一致。

### 2026-04-28
**Dashboard 主菜 v2 暗色改造 part 1 — 總覽 tab（PageBg + SiteHeader + 5 score cards + 8 checklist + radar/trend GlassCard）:**
- ✅ **[src/pages/Dashboard.jsx](src/pages/Dashboard.jsx) 三段式外殼換好**：移除舊有的 `bg-white/...` + radial-gradient + dot pattern overlay 與內聯 `<header>`（橘白 nav + Logo），整頁包進 `<PageBg>` + `<SiteHeader />` + `<div className="relative z-10">` + `<Footer dark />`，與其他五個 audit 頁、Showcase / Compare 完全一致。`PageBg` 函式加在檔尾（青綠 155deg 頂部漸層 + lighten + 雜訊 0.12/overlay），維持各頁模組層 inline 不抽元件的原則。
- ✅ **頁面 TopBar 重寫**：原本內聯的橘白 header（含 Logo + nav 排行榜/競品比較/定價/文章分析/FAQ + 頭像）整段砍掉（這些 SiteHeader 已包辦），改為 dark TopBar（`bg-black/40 backdrop-blur-xl + border-b border-white/10`）只放：返回箭頭 + 網站名稱 + 「🤖 N 分鐘前」最後分析時間膠囊（橘色 chip）+ 三顆動作按鈕（連接 Google Analytics / 重新檢測 / 匯出 PDF）。InfoTooltip 內部也改 `bg-white/15 text-white/70` 按鈕配 `bg-black/90 border-white/15` 工具提示。
- ✅ **5 張總覽分數卡 → `<GlassCard color={item.color}>`**：grid 從 `md:grid-cols-2 xl:grid-cols-4` 升 `xl:grid-cols-5`（含第五張內容品質卡），每張卡 inline `padding: 24` 維持原 layout，標題色用 face-specific token（SEO 藍 / AEO 紫 / GEO 綠 / EEAT 琥珀 / 內容品質粉）。verdict 文字 + 分數 + 進度條 + detail text 都改吃 `text-white/{60,70,90}`，進度條軌道改 `bg-white/10`。
- ✅ **8 項 AI 引用條件 checklist → `<GlassCard color={accent}>`**：accent = passCount >= 6 ? `T.pass` : >= 4 ? `T.warn` : `T.fail`（依達成數量動態），每條 row 內聯 border 用 `${T.pass}26 / ${T.pass}40` 綠透明背景 vs `bg-white/5 border-white/10` 灰底（未達成）。整段 wrapper 從原本 `bg-white/40 border-orange-200` 改為 GlassCard 內聯 padding。
- ✅ **雷達圖卡 → `<GlassCard color={T.seo}>`**：`PolarGrid stroke="rgba(255,255,255,0.1)"`、`PolarAngleAxis tick fill="#ffffff"`、Tooltip 改 `contentStyle: { background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }`。標題與目標值說明文字 `text-white/{50,70}`。
- ✅ **趨勢圖卡 → `<GlassCard color={T.aeo}>`**：Pro 鎖定遮罩用 `bg-black/60` + 橘琥珀漸層 CTA。趨勢摘要 4 格用 `${color}1a` 半透明背景 + `${color}33` 邊框（dynamic per-face）。LineChart `CartesianGrid stroke="rgba(255,255,255,0.08)"`、`XAxis/YAxis stroke="rgba(255,255,255,0.5)"`、Tooltip 同雷達卡 dark style。
- ✅ **Tab nav 4 顆改暗色**：`border-white/10` 底邊，active 從 `border-orange-500 text-orange-600` 換 `border-orange-400 text-orange-300`，inactive 從 `text-slate-500 hover:text-slate-700` 換 `text-white/50 hover:text-white`。
- 🔖 **取捨：留 `const isDark = true` bridge**：未動到的 Tab 2/3/4/5（流量、詳細檢測、AI 爬蟲、優化工具）內部還有約 3 處 `isDark ? dark : light` 條件分支。直接刪除 `useTheme` import 後這些 branch 會 ReferenceError，所以在 Dashboard() 函式頂部加 `const isDark = true`，讓未轉換 tab 仍能渲染 dark 分支。Commit 2/3 會逐步把這些條件分支改成寫死的 dark style，最後刪除 bridge。
- 🔖 **取捨：5 張卡 + 8 項 checklist + 雷達 + 趨勢都用 GlassCard**：用戶明確要求「雷達圖 + 4 大分數卡 + 第五張內容卡 + 8 項 checklist 全部要套 GlassCard」，這次 commit 全數兌現。其他卡（GA4/GSC summary、4 face check 詳細卡、AI 爬蟲卡、優化工具卡）等 Commit 2/3 處理時再依需要套上。
- 🔖 **取捨：頂部 TopBar 不放 SiteHeader 的 nav 連結**：因 SiteHeader 已含「排行榜 / 競品比較 / 定價 / 文章分析 / FAQ + 登入頭像 + 升級鈕」全套，TopBar 只需是「這個網站的 dashboard 專屬動作列」（返回 + 操作按鈕），避免雙重 nav 視覺擁擠。

### 2026-04-28
**Showcase / Compare 兩頁改暗色主題（PageBg + SiteHeader，純視覺收尾）:**
- ✅ **[src/pages/Showcase.jsx](src/pages/Showcase.jsx) 從橘白主題遷至暗色 v2**：移除 `useTheme` import + `const { isDark }` 解構 + 內聯橘白 `<header>`，整頁包進 `<PageBg>` + `<SiteHeader />` + `<Footer dark />` 三段式結構（與五個 audit 頁完全一致）。
- ✅ **配色批次改寫**：`bg-white/40|60|70` → `bg-black/40`、`border-orange-100` / `border-white/60` → `border-white/10`、`text-gray-800|900` → `text-white`、`text-gray-400|500` → `text-white/40-60`、`scoreColor()` 從 `text-green/yellow/red-500` 換到 `-400`（提亮對比）、進步分數 chip 從 `bg-green-100/text-green-700` 換 `bg-green-500/20 text-green-400`、AI 已讀取膠囊改 `bg-orange-500/15 text-orange-300`。`isDark` 條件 fade edges 移除 → 寫死 `linear-gradient(to right, rgba(0,0,0,0.95), transparent)`。
- ✅ **[src/pages/Compare.jsx](src/pages/Compare.jsx) 同模式改寫**：移除 `useTheme` import + 內聯 header + 橘白 radial-gradient + dot-pattern overlay。`SITE_COLORS` 4 個網站主色（橘/藍/紫/綠）保留 hue 但改色階 — `bg-orange-50` → `bg-orange-500/15`（半透明 glow）、`border-orange-400` → `border-orange-400/60`、`text-orange-600` → `text-orange-300`，配對暗底維持可辨識性。輸入欄 `bg-white/60 border-orange-100 text-gray-800` → `bg-black/40 border-white/15 text-white`。Pass/Fail 圈圈：✓ 從 `bg-green-100/text-green-600` 換 `bg-green-500/20 text-green-300 border border-green-500/30`，✗ 從 `bg-slate-100/text-slate-300` 換 `bg-white/5 text-white/30 border border-white/10`。「開始比較」CTA 從純 `bg-orange-500` 升級為 `from-orange-500 to-amber-500` 漸層，與 HomeDark / Login 提交鈕一致。
- ✅ **PageBg 各檔內聯**：兩頁尾部各加一份 `function PageBg({ children })`，純黑底 + 上方 3000px 155deg 青綠→深藍漸層（mix-blend-mode lighten）+ 雜訊 0.12/overlay，與 SEOAudit / AEOAudit / GEOAudit / EEATAudit / ContentAudit 五頁同款。
- 🔖 **取捨：保留各檔模組層 PageBg 不抽元件**：與檢測頁原則一致 — 頁面層 wrapper 而非元件，未來若分歧（例如某頁切紅色版漸層）改起來方便。如果哪天確認所有頁面都統一同款再考慮抽到 components/v2/。
- 🔖 **取捨：「升級 Pro 比較最多 4 個網站」連到 /pricing 而非 /dashboard**：原本連 `/dashboard` 是錯的（沒帶 :id 會 404），改為 `/pricing` 才符合語意（CTA 說的是升級）。
- 🔖 **可確認的覆蓋率**：五個 audit 頁 + Showcase + Compare + HomeDark + Pricing + FAQ + Login + Register + Account + AIVisibility 一系列頁面全部走 `<PageBg>` + `<SiteHeader />` + dark theme，登入後流程不再出現任何橘白頁。剩 Dashboard（主菜，最複雜，待後續另開 commit）+ ContentAudit（已暗色化但走 v2 hero 而非 PageBg + SiteHeader 結構，目前 OK）。

### 2026-04-28
**SEOAudit 遷移至共用 AuditHero / IssueBoard / SerpAndVitals（完成五頁 dedupe）:**
- ✅ **抽出 [src/components/v2/SerpAndVitals.jsx](src/components/v2/SerpAndVitals.jsx)**：把原本 SEOAudit 內聯的 `SerpAndVitals` + `CWVMetric`（Google SERP 預覽 + Core Web Vitals LCP/INP/CLS 三格）獨立成檔，CSS class `.seo-cwv-grid` 改名為 `.v2-cwv-grid`（與 v2-issue-board / v2-hero-grid 命名一致）。barrel export 加進 [src/components/v2/index.js](src/components/v2/index.js)。
- ✅ **[src/pages/SEOAudit.jsx](src/pages/SEOAudit.jsx) 大幅瘦身（1018 → 300 行，砍掉 718 行）**：移除所有內聯的 `ScoreHero` / `ScoreCircle` / `Sparkline` / `IssueBoard` / `IssueLane` / `IssueCard` / `IssueFixPanel` / `IssueLockCTA` / `HeroSkeleton` / `IssueBoardSkeleton`、`PAGE_KEYFRAMES` 整段 CSS、`firstFail` dead code，全部改為從 `../components/v2` import 共用元件。麵包屑列也用 `<AuditTopBar face="SEO" accent={ACCENT} accent2={ACCENT2} />` 取代原本內聯的 `.seo-topbar`。`.seo-hero-grid` → `.v2-hero-grid`。
- ✅ **保留 SEO 專屬元件 inline**：`PageBg`、`SectionTitle`、`RoadmapPanel`、`RoadmapColumn`、`RoadmapLockOverlay` 留在檔內，因為這些只 SEO 用得到（其他四頁沒有 P1/P2/P3 三段式優化路線圖）。`SEO_CHECKS` 資料當然也留下。
- ✅ **AuditTopBar 提供同款外觀**：返回 dashboard 麵包屑 + 重新檢測（轉圈 spin）+ 匯出 PDF（橘藍漸層按鈕），與 AEO/GEO/EEAT 完全一致，視覺零差異。
- ✅ **dedupe 後唯一 source of truth**：SEO/AEO/GEO/EEAT/Content 五個 audit 頁的頂部分數區、右側 Signature 容器、看板式 IssueBoard 全部走共用元件，未來改視覺只需改 v2 共用檔，不會分歧。Sparkline `<linearGradient>` ID prefix `audit-spark-grad-` 也統一了（之前 SEOAudit 用 `spark-grad-` 是為了避撞，現在用同款後可以同名共存）。
- 🔖 **取捨：Roadmap 不抽到 v2 共用**：P1/P2/P3 三段路線圖目前只 SEO 有，AEO/GEO/EEAT 各自有「短期目標 / 中期目標」兩段式 GlassCard 結構不同。若硬抽 props 介面會擴得很複雜，等第二個面向頁需要 P1/P2/P3 結構再說。
- 🔖 **取捨：本地 build 反覆 STATUS_STACK_BUFFER_OVERRUN（exit -1073740791）非本次 commit 引發**：在乾淨 main 上 build 也一樣崩在 870 modules transformed 後的 rollup 渲染階段（屬 Windows 環境性問題）。我這 commit 只多 1 個檔案 → 871 modules 前的 transformation 全通過，依靠 Vercel CI Linux 環境驗證實際 build。

### 2026-04-28
**MetricSignatures 從 mock 改為真實 analyzer 資料（4 個面向別右側欄全接通）:**
- ✅ **[src/services/contentAnalyzer.js](src/services/contentAnalyzer.js) 補 3 個欄位**：新增 `checkOutboundLinks(doc, url)`（外部 anchor 數量，跨 hostname 才算）+ `checkMultimedia(doc)`（img/video/picture/iframe 數量分項）+ `readingMinutes`（`totalWords / 250` 取一位小數，中英混合估算）。`analyzeContent()` return 加上 `outbound`、`multimedia`、`readingMinutes` 三個 key。`calcScore` 不變（這 3 個只供 ContentSignature 5 維度用，不影響總分）。
- ✅ **[src/components/v2/MetricSignatures.jsx](src/components/v2/MetricSignatures.jsx) 全面接 props**：`AEOSignature({ audit, brandName })` / `GEOSignature({ audit, isPro })` / `EEATSignature({ audit })` / `ContentSignature({ result })`，每個都保留 `audit/result == null` 的 mock fallback 路徑（供 prototype 預覽 + audit 還沒掃描時的占位）。
- ✅ **AEOSignature 引擎引用率 = 8 個技術 boolean 加權總和**：定義 `ENGINE_WEIGHTS` — Perplexity 重 FAQ schema/結構化答案/canonical（22+22+12 = 56）、ChatGPT 重 JSON-LD/問句標題/答案結構（18+18+18 = 54）、Google AI 重 schema/canonical/breadcrumbs/OG（16+14+12+14 = 56），三家 weight 各自加總到 100，過了哪幾項就累加哪幾項的 weight。引擎引用率區塊右側標「技術估算」、引用模擬區塊右側標「示意」，避免被誤解為實測數據。`brandName` 會替換 mock 範例文案中的「優勢方舟」字樣。
- ✅ **GEOSignature 矩陣 = base × topic 倍率**：`ENGINE_BASES` 定義每家敏感的 keys（Google AI 7 keys / Bing Copilot 7 keys / Claude 5 keys，含 multiplier 1.0 / 0.85 / 0.72）→ 過了 N/總 keys 數 × 95 × multiplier 算出 base，再乘 `TOPIC_MULT = [1.0, 0.85, 0.7, 0.45, 0.32]`（品牌詞最容易、比較詞最難）。強項 / 機會點改為動態：把 5 個 topic 的三家平均後排序，前 2 高 = 強項、後 2 低 = 機會點。底部新增 Pro CTA：未付費用戶看到「升級 Pro 啟用 AI 曝光監測，得到實測引用矩陣」+ 「升級 Pro →」連到 /pricing。
- ✅ **EEATSignature 4 pillar × 2 sub = 8 個 boolean 重組**：把原本 mock 寫死的 8 個子分數對映成 — Experience（date_published/outbound_links）/ Expertise（author_info/organization_schema）/ Authoritativeness（about_page/social_links）/ Trustworthiness（contact_page/privacy_policy）。各 sub 用 `b2score(true→hi, false→lo)` 把 boolean 轉 0~100（每組 hi/lo 略有 jitter，視重要度給 84/26 ~ 92/30 範圍），主分數 = 兩個 sub 的平均。子標題改為實際對應的檢測項目名稱（「近期更新內容」「作者署名揭露」「機構結構化資料」「關於我們頁面」「社群媒體曝光」「透明聯絡資訊」「隱私權政策」），不再是 v3 mock 的「第一手案例 / 真實照片影片」這種無法檢測的項目。
- ✅ **ContentSignature 5 維度全接 result**：文章長度（≥1500=100, ≥800=75, ≥300=40, 其他按比例）/ 直接答案（boolean → 0 或 100）/ 多媒體（沒圖→中分 50；有圖→ alt 覆蓋率 + 影片加 10）/ 外部引用（≥3=100, 2=65, 1=35, 0=0）/ 閱讀時間（≥3min=100, ≥1.5min=60, 其他按比例）。val 顯示真實值（`420 字`/`已覆蓋`/`5 個·Alt 80%`/`2 個`/`4.2 分`），target 顯示目標。
- ✅ **4 頁全部傳真實 prop**：[AEOAudit](src/pages/AEOAudit.jsx) 傳 `audit={aeoAudit} brandName={website?.name}` / [GEOAudit](src/pages/GEOAudit.jsx) 傳 `audit={geoAudit} isPro={isPro}` / [EEATAudit](src/pages/EEATAudit.jsx) 傳 `audit={eeatAudit}` / [ContentAudit](src/pages/ContentAudit.jsx) 傳 `result={result}`。
- 🔖 **取捨：AEO 引用率叫「技術估算」而非「預測引用率」**：因為這只是「8 項技術做了幾項 × 該家引擎的權重總和」的線性運算，不是真的去 Perplexity 跑 prompt 看品牌名是否被引用。寫「技術估算」+「示意」兩個小字 disclaimer 比起寫一個有把握的數字保守，避免客戶誤以為這是實測。實測引用率走 aivis 模組（Phase 2 已完成的 Claude API 直打）。
- 🔖 **取捨：GEO 矩陣的 topic 倍率寫死不可調**：5 個關鍵字類型（品牌詞/服務詞/在地詞/長尾詞/比較詞）的難度倍率是依業界觀察常識給的（品牌詞引用率最高、比較詞最低），沒做成可調是因為這 5 個類型本來就抽象不對應到任何單一 audit 欄位。將來若 aivis 真的有實測資料就直接覆蓋；目前先給合理的相對排序讓用戶看出「強項 / 機會點」即可。
- 🔖 **取捨：EEAT 不再寫「第一手案例 / 真實照片影片」**：v3 prototype 那 8 個子分數名稱很漂亮但完全無法從現有 8 個 boolean 對應出來。改用「近期更新內容（=date_published）」「引用一手資料（=outbound_links）」這種能直接從檢測項目對應的命名，誠實但比較不夢幻。

### 2026-04-28
**AEO / GEO / EEAT / Content 補上面向別 Signature 右側欄（hero 改 5:7 兩欄）:**
- ⚠️ **回頭發現少做了一半**：上一個 commit 把四頁頂部換成 ScoreHero 後，用戶截圖紅框問「右邊兩位怎麼都不見了」— SEOAudit 是兩欄 hero（左 ScoreHero + 右 SerpAndVitals），其他四頁我只放了左邊，右邊整塊面向別特徵卡漏掉。
- ✅ **新增 [src/components/v2/MetricSignatures.jsx](src/components/v2/MetricSignatures.jsx)**：從 v3 prototype 抽出四個 face-specific 右側面板 — `AEOSignature`（Perplexity 引用範例 + Perplexity/ChatGPT/Google AI 三家引用率 bar）、`GEOSignature`（引擎 × 關鍵字類型 5×3 熱度矩陣 + 圖例 + 強項/機會點）、`EEATSignature`（E/E/A/T 四個 pillar 卡，每張含主分數 + 兩條子分數 bar）、`ContentSignature`（5 個品質維度：平均文章長度/直接答案覆蓋/多媒體輔助/外部引用/閱讀時間 + 目標值對照）。`SectionLabel` 內部 helper 統一小區塊標籤（uppercase + letter-spacing .12em）。barrel export 加進 [src/components/v2/index.js](src/components/v2/index.js)。
- ✅ **資料目前為 mock**：四個 Signature 內部都是 hardcode 範例值，等後端 analyzer 補對應欄位（AI 引用率、引用矩陣、E-E-A-T 四維度子分數、內容品質 5 維度）後再改為真實 props。
- ✅ **新增 `.v2-hero-grid` CSS（[src/index.css](src/index.css)）**：左 5fr : 右 7fr 兩欄，880px 以下堆疊單欄。沿用 SEOAudit 的 `.seo-hero-grid` 規格（後續可考慮把 SEO 一起遷過來）。
- ✅ **AEO/GEO/EEAT/Content 四頁全套用**：把原本 `<div style={{ marginBottom: 32 }}><ScoreHero /></div>` 改成 `<div className="v2-hero-grid"><ScoreHero /><div>{Signature}</div></div>`，右側容器與 ScoreHero 同款外觀（`rgba(1,8,14,.6)` 底 + `T.cardBorder` 邊 + `T.rL` 圓角 + padding 24）。
- 🔖 **取捨：右側容器外觀沒抽元件**：四頁的右側容器外殼一模一樣（同款卡 padding），但內容差很大（一個是 SVG bar、一個是熱度 grid、一個是 4-col card grid、一個是直條 list）。目前直接 inline div 包住即可，將來若要做 `<HeroSidePanel>` 再說，避免提早抽出來反而要擴 props 介面。
- 🔖 **取捨：ContentAudit 雖無歷史 trend 但仍套兩欄**：ContentSignature 跟 ScoreHero 並排視覺平衡，但 ContentAudit 沒有 `recentAudits`（每次分析 ad-hoc URL，不存 DB），sparkline 會顯示「— 首次掃描」，這是預期行為。

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
