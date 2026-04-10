# AARK AI 能見度儀表板

> 全面檢測網站 SEO、AEO、GEO、E-E-A-T，並整合 GA4 / GSC 數據的 SaaS 儀表板

**線上網址**: https://aark-dashboard.vercel.app

---

## 方案對照表

| 功能 | 免費版 | Pro 版 |
|------|--------|--------|
| **網站追蹤數** | 3 個 | 15 個 |
| **SEO 分析** | ✅ 完整 | ✅ 完整 |
| **AEO 技術檢測** | ✅ 8項通過/未通過 | ✅ + 平台別修復指南 |
| **GEO 在地健檢** | ✅ 完整 | ✅ 完整 |
| **E-E-A-T 分析** | ✅ 分數 + 檢查項目 | ✅ + 平台別修復指南 |
| **GA4 流量分析** | ✅ 6個摘要數字 | ✅ + 趨勢圖 + 智能洞察 |
| **GSC 搜尋成效** | ✅ 4個摘要數字 | ✅ + 趨勢圖 + 關鍵字表 + 建議 |
| **AI 優化建議** | ✅ 5條通用建議 | ✅ 5條通用建議 |
| **修復碼產生器** | 🔒 | ✅ llms.txt / JSON-LD / FAQ Schema |
| **歷史趨勢圖** | 🔒 | ✅ |
| **AI 搜尋關鍵字分析** | ✅ | ✅ |
| **PDF 報告匯出** | 🔒 | ✅ |
| **Email 週報訂閱** | 🔒 | ✅ |
| **競爭對手比對** | 2 個網站 | 4 個網站 |
| **文章內容分析** | 🔒 基本版免費 | ✅ 完整版 |
| **LINE 推播** | 🔒 | 即將推出 |

---

## 功能說明

### 核心分析（各模組均有獨立詳情頁）
| 功能 | 路由 | 說明 |
|------|------|------|
| SEO 分析 | `/seo-audit/:id` | Meta 標題/描述（含長度驗證）、H1 結構、Alt 屬性覆蓋率、行動版相容、載入速度 |
| AEO 分析 | `/aeo-audit/:id` | JSON-LD、FAQ Schema、Canonical、麵包屑、Open Graph、問句標題、Meta 描述長度、結構化答案 |
| GEO 分析 | `/geo-audit/:id` | llms.txt、AI 爬蟲開放、Sitemap、OG/Twitter Card、JSON-LD 引用、Canonical、HTTPS |
| E-E-A-T 分析 | `/eeat-audit/:id` | 作者資訊、關於我們、聯絡方式、隱私權政策、Organization Schema、發布日期、社群連結、外部連結 |

### GA4 流量分析（需串接）
- **免費**：工作階段、活躍使用者、網頁瀏覽量、新使用者、跳出率、互動率（6個數字）
- **Pro**：+ 近 30 天流量趨勢圖 + 智能洞察建議

### GSC 搜尋成效（需串接）
- **免費**：曝光次數、點擊次數、點擊率、平均排名（4個數字）
- **Pro**：+ 搜尋趨勢圖 + 熱門關鍵字 Top 10（CTR、排名、機會標注）+ 搜尋優化建議

### AI 優化工具（Pro）
- AI 優化建議（5 條具體行動）
- llms.txt / JSON-LD / FAQ Schema 修復碼產生器
- AI 搜尋關鍵字（10 組查詢詞）

### 帳號系統
- Email / 密碼 註冊登入
- Google OAuth 登入（Supabase Auth）
- 行銷同意 checkbox（GDPR 合規）
- Pro 方案升級（Stripe，台灣本地金流待開發）

---

## 技術堆疊

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite |
| 樣式 | Tailwind CSS |
| 圖表 | Recharts |
| 資料庫 / Auth | Supabase (PostgreSQL + RLS) |
| Serverless API | Vercel Functions |
| 部署 | Vercel (aark.younjung@gmail.com) |
| 支付 | Stripe Checkout（訂閱模式） |

---

## 專案結構

```
aark-workspace/
├── api/                          # Vercel Serverless Functions
│   ├── fetch-url.js              # 網站內容抓取 proxy（解決 CORS）
│   ├── ga4-data.js               # GA4 Data API proxy
│   ├── gsc-data.js               # Google Search Console API proxy
│   ├── create-checkout-session.js # Stripe 付款頁面建立
│   ├── stripe-webhook.js         # Stripe Webhook 處理（升級/取消）
│   ├── send-report-email.js      # 發送週報 Email
│   └── cron-weekly-reports.js    # 週報排程
├── src/
│   ├── context/
│   │   └── AuthContext.jsx       # 全域 Auth 狀態（user, profile, isPro）
│   ├── lib/
│   │   └── supabase.js           # Supabase client
│   ├── pages/
│   │   ├── Home.jsx              # 首頁（網址輸入 + 分析觸發）
│   │   ├── Dashboard.jsx         # 主儀表板（分數、GA4、GSC、歷史）
│   │   ├── SEOAudit.jsx          # SEO 詳細頁（含優化路線圖）
│   │   ├── AEOAudit.jsx          # AEO 詳細頁
│   │   ├── GEOAudit.jsx          # GEO 詳細頁
│   │   ├── EEATAudit.jsx         # E-E-A-T 詳細頁
│   │   ├── Login.jsx             # 登入（Email + Google）
│   │   ├── Register.jsx          # 註冊（含行銷同意）
│   │   ├── Showcase.jsx          # 展示頁
│   │   ├── Compare.jsx           # 比較頁
│   │   └── GoogleAuthCallback.jsx # GA4/GSC OAuth 回調頁
│   ├── services/
│   │   ├── seoAnalyzer.js        # SEO 分析邏輯
│   │   ├── aeoAnalyzer.js        # AEO 分析邏輯
│   │   ├── geoAnalyzer.js        # GEO 分析邏輯
│   │   ├── eeatAnalyzer.js       # E-E-A-T 分析邏輯
│   │   ├── ga4Analyzer.js        # GA4 數據拉取與解析
│   │   ├── gscAnalyzer.js        # GSC 數據拉取與解析
│   │   ├── googleAuth.js         # GA4/GSC OAuth 隱式流程
│   │   └── pdfExport.js          # PDF 匯出
│   ├── App.jsx                   # 路由設定
│   └── main.jsx                  # 入口
```

---

## 環境變數

### Vercel 設定（Settings → Environment Variables）

| 變數名 | 用途 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 專案 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID（GA4/GSC 連接用） |
| `STRIPE_SECRET_KEY` | Stripe Secret Key |
| `STRIPE_PRICE_ID` | Stripe 訂閱方案 Price ID |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret |
| `SUPABASE_URL` | Supabase URL（server-side webhook 用） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（webhook 用） |
| `NEXT_PUBLIC_SITE_URL` | 網站網址（Stripe 回調用） |

---

## Supabase 資料表

| 資料表 | 說明 |
|--------|------|
| `websites` | 使用者分析的網站記錄 |
| `seo_audits` | SEO 分析結果（JSONB 欄位） |
| `aeo_audits` | AEO 分析結果 |
| `geo_audits` | GEO 分析結果 |
| `eeat_audits` | E-E-A-T 分析結果 |
| `profiles` | 使用者資料（name, is_pro, marketing_consent） |
| `email_subscriptions` | Email 週報訂閱記錄 |

---

## Google Cloud Console 設定

**OAuth 用戶端（GA4/GSC 連接用）：**
- 已授權 JavaScript 來源：`https://aark-workspace.vercel.app`
- 已授權重新導向 URI：`https://aark-workspace.vercel.app/auth/google/callback`

**已啟用的 API：**
- Google Analytics Data API
- Google Search Console API

**OAuth 同意畫面：** 測試模式（需手動加入測試使用者）

---

## Supabase Auth 設定

- Google Provider 已啟用
- Redirect URL：`https://aark-workspace.vercel.app/**`
- Skip nonce checks：已啟用

---

## 付款流程

**目前：** Stripe Checkout（訂閱模式）
- `checkout.session.completed` → `profiles.is_pro = true`
- `customer.subscription.deleted` → `profiles.is_pro = false`

**待開發：** 台灣本地金流（綠界 / 藍新）

---

## 本地開發

```bash
cd aark-workspace
npm install
npm run dev
```

`.env.local`：
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_CLIENT_ID=...
```

---

## 版本記錄

| 日期 | 更新內容 |
|------|----------|
| 2026-04-10 | 新增 /content-audit 文章分析頁：15 項指標（內容結構/字數/Meta/AEO/E-E-A-T/可讀性），免費看分數，Pro 解鎖修復建議 |
| 2026-04-10 | 補鎖 Pro 功能：修復碼產生器、歷史趨勢圖加 isPro 判斷（免費用戶顯示模糊預覽+升級提示） |
| 2026-04-10 | 網站追蹤上限調整：Free 3 個、Pro 15 個（原為 5 個） |
| 2026-04-10 | 新增 /faq 完整頁面（4 分類 18 題，含 FAQPage JSON-LD Schema）+ Home 頁底部 FAQ 展開區塊 |
| 2026-04-10 | Dashboard 四大分數卡加入 icon、親民說明標語、白話解釋（方便非技術用戶理解） |
| 2026-04-02 | 新增「修復指南」功能（Pro 限定）：每個失敗項目顯示 WordPress/Shopify/Wix/自架 HTML 四平台的逐步操作說明與程式碼範例 |
| 2026-04-02 | 新增帳號設定頁（/account）：Google 大頭照、方案狀態、取消訂閱、Email 週報管理 |
| 2026-04-02 | 新增 /pricing 定價頁：Free/Pro/Agency 三方案 + 早鳥優惠（NT$990）+ FAQ |
| 2026-04-02 | Stripe 付款流程：月繳/年繳/早鳥、Webhook 自動更新 is_pro、自助取消訂閱 |
| 2026-04-02 | 新增 sitemap.xml、robots.txt（含 AI 爬蟲規則）、SEO meta 標籤 |
| 2026-03-31 | 首頁新增即時爬蟲動態區塊（8 AI爬蟲 + 5 搜尋引擎爬蟲），數字由分析記錄衍生 |
| 2026-03-31 | 首頁新增「AI 即時讀取」跑馬燈（最近 15 筆分析紀錄循環顯示） |
| 2026-03-31 | 新增 /admin/seed 隱藏頁面，可一鍵寫入 20 個日本小品牌種子數據（每站 3 輪歷史記錄） |
| 2026-03-30 | 新增「最近被 AI 讀取」功能：Showcase 排行榜新 tab + 目錄每筆顯示 🤖 badge；Dashboard 標頭顯示 AI 讀取時間 |
| 2026-03-30 | AI 優化工具改為免費開放（優化建議、llms.txt、修復碼產生器、AI關鍵字），競爭力策略調整 |
| 2026-03-30 | 自動抓取網站名稱（og:site_name → title 品牌段 → hostname fallback） |
| 2026-03-30 | SEO 詳情頁建立（/seo-audit/:id），含各項數值顯示與 Pro 優化路線圖 |
| 2026-03-30 | Free vs Pro 功能分界全面實作（網站上限、AEO修復建議Pro、PDF、Email、GA4/GSC進階、競品比對限制） |
| 2026-03-29 | GA4/GSC 介接說明卡（未串接時顯示步驟說明） |
| 2026-03-29 | GA4/GSC 加強：新增指標、機會關鍵字、智能建議 |
| 2026-03-29 | 修正歷史趨勢圖對齊問題（從最新端對齊） |
| 2026-03-29 | 修正分析失敗時不覆蓋舊分數 |
| 2026-03-29 | 修正 React #310 錯誤（useEffect 位置問題） |
| 2026-03-29 | GA4/GSC 串接完成（Google OAuth 隱式流程） |
| 2026-03-28 | Google OAuth 登入（Supabase Auth） |
| 2026-03-28 | 行銷同意 checkbox（Register 頁） |
| 2026-03-28 | Stripe 付款流程（Serverless Functions） |
