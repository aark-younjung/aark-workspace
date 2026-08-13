# 改版架構規格（第二層驗證用）

> 這份文件給「結構改版的獨立驗證者」看。目的是把**改版前的既有功能**與**改版後的新架構**放在一起對照，
> 檢查有沒有功能被漏掉、接錯、或讓使用者走進死路。**這是設計意圖文件，尚未寫成 code。**
>
> 視覺稿：本資料夾的 [redesign-hifi.html](./redesign-hifi.html)（上方可切換「① 首頁 / ② 儀表板總覽」兩張高保真稿）。
> Ground truth：路由在 [../src/App.jsx](../src/App.jsx)，產品規格在 [../CLAUDE.md](../CLAUDE.md)。

---

## 一、改版前：現有功能結構（面向使用者，非 admin）

| 路由 | 頁面元件 | 功能 |
|------|----------|------|
| `/` | HomeDark | 首頁：輸入網址 → 觸發分析 → 雷達動畫；含未登入快掃 AnonDiagnosis |
| `/login` `/register` | Login / Register | 登入 / 註冊 |
| `/dashboard/:id` | DashboardV2 | 儀表板總覽（現行；`:id` = website UUID） |
| `/dashboard-legacy/:id` | Dashboard | 舊版儀表板 |
| `/website-summary/:id` | WebsiteSummary | 單站彙整 |
| `/seo-audit/:id` | SEOAudit | SEO 5 項詳細 |
| `/aeo-audit/:id` | AEOAudit | AEO 8 項詳細 |
| `/geo-audit/:id` | GEOAudit | GEO 6 項詳細 |
| `/eeat-audit/:id` | EEATAudit | E-E-A-T 6 項詳細 |
| `/content-audit(/:id)` | ContentAudit | 文章內容分析（15 項；Free 看分數 / Pro 解鎖修復） |
| `/crawl-check` | CrawlCheck | 爬蟲可達性專項 |
| `/schema-check` | SchemaCheck | 結構化資料專項 |
| `/bulk-scan/:id` | BulkScan | 批次掃描 |
| `/ai-visibility` | AIVisibility | AI 曝光監測（aivis 主力）— 品牌列表 |
| `/ai-visibility/:id` | AIVisibilityDashboard | 單品牌 aivis 儀表板 |
| `/showcase` | Showcase | 排行榜 / 進步之星 |
| `/compare` | Compare | 競品比較 |
| `/clients` | MyClients | 代理商多客戶工作區 |
| `/pricing` `/faq` `/account` | Pricing / FAQ / Account | 定價 / 常見問題 / 帳號設定 |
| `/help/rank-math` | HelpRankMath | Rank Math 教學 |
| `/lp/:variant` | LandingPage | 行銷落地頁 |
| `/terms` `/privacy` `/consumer-rights` | legal/* | 法律頁 |

**Admin（需 `profiles.is_admin`）**：`/admin` `/admin/users` `/admin/websites` `/admin/revenue`
`/admin/announcements` `/admin/showcase` `/admin/monitoring` `/admin/activity` `/admin/waitlist`

**權限層級（改版後要保留）**：匿名(anon 快掃) / Free / Pro / Agency / Admin。
Free vs Pro 的功能閘門（修復碼、趨勢圖、PDF、aivis 次數、追蹤站數 3/15/50）散落各頁，
以 `useAuth()` 的 `isPro` 為線索。

---

## 二、改版後：新架構（要被驗證的設計）

改成「**左側選單 + 右側內容 + 分類標籤**」的 app-shell。
核心理念：**一屏一主角、aivis 是主角、技術分數降為輔助**。

**公開首頁（未登入）**：乾淨的 Hero + 掃描框 + CTA + 吉祥物；不放功能選單。

**登入後左側選單只有 6 項：**

| # | 選單 | 意圖對應的舊功能 |
|---|------|------------------|
| 1 | 總覽 | 現行 `/dashboard/:id`。主角是 aivis「AI 能見度」大分數 + 趨勢；下面把 SEO/AEO/GEO/EEAT 縮小成「技術體質・輔助指標」；再加一張「下一步該做的一件事」。頂部有時間標籤（本週/近30天/近90天）。 |
| 2 | AI 曝光監測（標「主力」） | `/ai-visibility` + `/ai-visibility/:id` |
| 3 | 網站體檢 | 意圖把 `seo/aeo/geo/eeat-audit` + `crawl-check` + `schema-check` 收進來，用分類標籤切換 |
| 4 | 內容缺口 | **來源待確認**：可能是 aivis info 題的內容引用缺口，也可能是 `content-audit` |
| 5 | 我的網站 | 網站列表 / 切換 / 新增 |
| 6 | 帳號 | `/account` |

**設計約束（驗證時一併檢查有沒有被違反）：**
1. **誠實原則**：掃描實際上是「單頁 + 站台層檔案(robots/sitemap/llms)」，**不是全站爬蟲**，文案不可暗示全站。aivis 只跑 **3 個引擎**（ChatGPT/Claude/Gemini），不可寫 5。
2. 不可捏造數據 / 保證。
3. aivis 當主角，但**技術分數是使用者付費會看的東西，不能被藏到找不到**。

---

## 三、已知的孤兒風險（驗證重點）

新 6 項選單裡「沒有明顯歸屬」的既有功能，至少包含 —— 請逐一給處置建議：

- 排行榜 / 進步之星（`/showcase`）
- 競品比較（`/compare`）
- 代理商多客戶工作區（`/clients`）
- 批次掃描（`/bulk-scan/:id`）
- 單站彙整（`/website-summary/:id`）
- 定價 / FAQ / 法律頁 / Rank Math 教學 的擺放位置
- 舊版儀表板（`/dashboard-legacy/:id`）是否下線

---

## 四、驗證產出要求

見交付給驗證者的 prompt。重點：覆蓋度矩陣（每個舊路由 → 新歸屬 + 判定 + `file:line` 證據）、
孤兒清單 + 處置、可達性/死路、權限與閘門保留、資料/狀態連續性（`:id` 綁定）、
設計約束合規、風險 three-tier 排序（上線前必須先決定 / 建議修 / 可延後）。

---

## 五、決策定案（2026-07-28，經 Codex 二層驗證 + 用戶確認）

畫五張畫面前，以下為準（取代第二、三節裡標「待確認」的部分）：

1. **一站一品牌（1:1）** — 加 `aivis_brands.website_id`（可空）單一 FK；既有資料用網域正規化一次性回填 + 人工複核。aivis 靠 website_id 解析品牌，無品牌顯示「設定 aivis」空狀態。**不用**網域字串做長期比對（只當一次性回填啟發式）。
   - **✅ 2026-07-28 已建欄位 + backfill**（6 連結 / 2 未連結）。連到「該網域最短 URL＝首頁」那筆。
   - **⚠️ 發現**：`websites` 是「一頁一筆」（同站不同頁各一筆 row），且重複集中在 1 個用戶。**決定不合併 DB**（重複頁是真實體檢紀錄）；改版「我的網站」改在**查詢/UI 層依 host 分組**呈現「一站一卡」、站數改算 **distinct host**（Batch 2/3 實作）。
2. **「內容缺口」窄用** — 這格＝aivis-info 的「你有內容、AI 卻不引用你」策略缺口。文章 15 項體檢 + 批次掃描（bulk-scan）歸「網站體檢／內容體檢」，不塞這格。
   - **📝 2026-08-13 修正案（用戶拍板）**：格名改「**內容機會**」（URL 維持 /gap）；單篇文章體檢＋批次掃描**收編進本格**（入口卡、工具本體沿用現有頁）；日後內容任務單也歸此。競品格：功能上線後加在主選單**最後一項**、現在不佔位。帳號移左下個人區、不佔主導覽格。
3. **Agency 兩級（Starter 30 / Plus 100）** — [src/lib/limits.js](../src/lib/limits.js) 為唯一規格（CLAUDE.md 已同步更正）。**不做強制「客戶」分組層**（2026-07-28 定案）：一站一品牌卡片走**扁平清單**即可（一個客戶有 2+ 站的情況少，為此加一層不划算）；既有 `/clients`（MyClients）保留為 Agency **選配**整理視圖，非預設結構。
4. **公開 crawl/schema 保留雙角色** — 公開落地頁留 shell 外（廣告/SEO 直達，已接 →註冊漏斗，見 Register.jsx:36）；登入態當「網站體檢」分頁，Dashboard/AEO cross-link 改指 shell 分頁。（實際流量待用戶查 GA/Vercel）

**誠實修正（改版前必做，與 IA 脫鉤）**：首頁免費掃只算 SEO/AEO/GEO/EEAT＝**技術體質**，**不是**實際 AI 曝光；文案改「AI 搜尋準備度／體質」，「AI 推不推薦你」留給 aivis（付費真相）。

**檢測呈現延續性（2026-08-13 加，⚠️ 大改版也要沿用）**：見 [AGENTS.md §0.1](../AGENTS.md)。三條共用 lib 已建、現行產品與改版都接：①頁型判斷（首頁不冤枉缺麵包屑/FAQ，`lib/pageAudit.js`；analyzer 層免扣分待做）②站台層複查（去其他頁實查、`lib/siteWideSchema.js` + `SiteWideSchemaProbe`，只講「檢查過的這幾頁」不宣稱全站）③Meta 長度分中英文（中 40–80／英 70–155，`lib/metaLength.js`）。改版任何體檢頁都沿用這三支，不可退回舊的「單頁口氣冤枉全站」。

### 定案後的左選單（6 格）與 URL 契約

- **公開（shell 外）**：`/`、`/pricing`、`/faq`、`/showcase`、`/website-summary/:id`、`/crawl-check`、`/schema-check`、`/lp/:variant`、法律頁
- **登入 shell（以 `websiteId` 為容器）**：
  | 選單 | URL | 內容 |
  |------|-----|------|
  | 總覽 | `/app/:websiteId/overview` | aivis 為主角 + 技術四分數（**可點入對應 audit**）+ 下一步一件事 |
  | AI 曝光監測「主力」 | `/app/:websiteId/visibility` | 靠 website_id 解析品牌；無品牌→設定 aivis |
  | 網站體檢 | `/app/:websiteId/health/{seo\|aeo\|geo\|eeat\|crawl\|schema}` | 六分頁 |
  | 內容缺口 | `/app/:websiteId/gap` | **僅** aivis-info 引用缺口 |
  | 我的網站 | `/app/websites` | 扁平網站/品牌卡片清單、切換/新增（不強制客戶分組） |
  | 帳號 | `/account` | 全域 |
- **URL 契約**：每個分頁都有真 URL（重整/分享/上一頁不失真）；舊 URL（`/dashboard/:id`、四大 audit、content、bulk、aivis 深連結）全部 1:1 轉址，不可全導總覽。

### 仍要處理（非 IA，是既有程式漏洞，待用戶同意動工）

- [AIVisibility.jsx:142](../src/pages/AIVisibility.jsx#L142) 移除 Perplexity（誠實，7/17 對齊漏網）
- [AdminSeed.jsx](../src/pages/AdminSeed.jsx) 包 AdminGuard（或撤出正式 router）
- [api/aivis/fetch.js:66](../api/aivis/fetch.js#L66) 補呼叫者 token 驗證（P1，比照 generate-prompts）
- [AIVisibilityDashboard.jsx](../src/pages/AIVisibilityDashboard.jsx) 補 Pro/Trial 前端守衛
- BulkScan 未登入卡 loading 死路 / `/clients` 登入後回不到原頁
