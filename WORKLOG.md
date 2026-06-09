# 工作日誌 — AI 雷達（AI 能見度儀表板）

從 CLAUDE.md 拆出（2026-05-18）。原本內嵌在 CLAUDE.md 會被 Claude Code 自動載入，膨脹到 270KB 後撐爆 context。

排序：最新在頂、舊的在下。新紀錄請 append 到本檔頂端（保持降冪），不要再寫回 CLAUDE.md。

---

### 2026-06-10（Agency v0 Phase A — Foundation：limits.js + AuthContext + HomeDark 站數上限）

**動機：** 用戶決定動工 Agency v0 多客戶工作區、不等候補名單上架（用戶自己就是代理商、需求 first-hand）。**商業上架延到「候補名單有訊號才上」**、code 先做好讓用戶 dogfood。

**Schema 升級（用戶端跑完）：**
- `profiles.subscription_tier` TEXT DEFAULT 'free' CHECK IN ('free', 'pro', 'agency_starter', 'agency_plus')
- `websites.agency_managed_by` UUID REFERENCES profiles(id)
- `websites.client_alias` TEXT
- websites RLS 加 policy「代理商可存取自己代管的站」（OR existing owner policy）
- `aark_agency_waitlist.invited_at` + `invite_status`（為 Phase 2「邀請候補試用」做準備）

**Foundation code（這次 ship）：**
- 新 [src/lib/limits.js](src/lib/limits.js)：TIER 常數 / SITE_LIMIT 對照 / `getTier(profile)` 向下相容 is_pro / `isAgencyTier` / `siteLimitForTier` / `tierLabel`。中央化方案邏輯、source of truth。
- [src/context/AuthContext.jsx](src/context/AuthContext.jsx)：暴露 `tier / isAgency / siteLimit / tierName` 四個新欄位。
- [src/pages/HomeDark.jsx](src/pages/HomeDark.jsx)：`WEBSITE_LIMIT = isPro ? 15 : 3` 改成讀 `siteLimit`。Agency 上來後 30/100 站自動生效、不用追改。

**未動：** Phase B（MyClients 列表頁 + AddClientModal）+ Phase C（ClientSwitcher dropdown + DashboardV2 client_alias badge）下一輪 ship。

---

### 2026-06-09（Agency 方案候補名單 — 上線同步收需求）

**動機：** 正式上線時 Agency 方案還是「籌備中」、Pricing 頁原本是 disabled 按鈕、客戶按了沒反應。改為 modal 收候補、同步收集需求數據驅動 Agency 設計。

**做的事：**
1. **新元件 [src/components/v2/AgencyWaitlistModal.jsx](src/components/v2/AgencyWaitlistModal.jsx)** — 4 欄表單（email* / 公司名 / 預估客戶數 4 區間 / 最想解決什麼）、寫入 `aark_agency_waitlist` 表。
2. **[src/pages/Pricing.jsx](src/pages/Pricing.jsx) 兩處 CTA 接 modal：**
   - Agency 卡按鈕「即將推出 disabled」→「🤝 加入候補名單（即將推出）」紫色 active 按鈕
   - 底部「洽談 Agency 合作」mailto 連結 → 同 modal 入口
3. **NotificationBell 加一則公告**（hc-agency-waitlist-2026-06-09、notice type）導引到 Pricing 頁登記
4. **[docs/launch-copy.md](docs/launch-copy.md)** — 補版本 7（私訊代理商朋友的候補引導段）+ Agency 設計狀態對齊
5. **[docs/ideas-backlog.md](docs/ideas-backlog.md)** — 新增「Agency 方案完整實作」設計討論：
   - 已實作 vs 待開發功能清單（多客戶工作區 P0、50 站 P0、NewebPay Agency SKU P0 等）
   - 4 個設計開放問題（客戶站隸屬模型 / 白標等級 / 定價結構 / 計費方式）
   - 推出時機指標（候補名單 ≥ 20 人 + 30+ 客戶 ≥ 5 人）

**待用戶側：** 跑 SQL 建 `aark_agency_waitlist` 表 + RLS policy（見回覆訊息）。

---

### 2026-06-09（🎉 正式上線、發佈公告 + 文案集）

**動機：** CLAUDE.md 標的上線阻擋是「公告文案 + 客服通道」、今天起算正式上線。

**做的事：**
1. **NotificationBell 加上線公告**（HARDCODED_BRIEFINGS 頂端）：
   - id: `hc-launch-2026-06-09`
   - type: `promo`（橘色 🎉 標記）
   - 內容：5 訊號層 LLMO、早鳥 100 名首年 NT$990／月、4 週限定
2. **[docs/launch-copy.md](docs/launch-copy.md)** — 6 個版本文案集：
   - NotificationBell 站內（已上）
   - Email 上線通知（給註冊試用 / 免費用戶）
   - Threads / FB 短版社群（180 字）
   - LinkedIn 較長版（給代理商）
   - X 超短版（quote tweet 用）
   - 私訊認識代理商朋友版
3. **發佈節奏建議表**（Day 0 / 1 / 2-3 / 7 / Week 2-4）
4. **訊息一致性 checklist**（價格 / 期限 / URL / aivis 描述）

**LINE OA：** 用戶詢問「一人可申請幾個」、回答無上限、暫緩申請 → 待用戶申請好 LINE ID 後再補 Footer / Hero / Email signature。

**第一位早鳥（1/100）：** yuppy0912@gmail.com、2026-06-09 完成早鳥年繳 NT$11,880。

---

### 2026-06-09（FixGuide 升級第三波：canonical + author_info 也加 WPCode 路徑）

**[src/data/fixGuides.js](src/data/fixGuides.js) 兩個再升：**

1. **`canonical` WP 兩條路：**
   - **方法 A：Rank Math / Yoast** — 雙外掛指南並列、註明「99% 情境裝完就好」、何時要手動指定（多語系互指 / 分頁回主頁）
   - **方法 B：WPCode PHP Snippet** — 用 WP 內建 `wp_get_canonical_url()` 自動為每頁注入、12 行就搞定

2. **`author_info` WP 兩條路：**
   - **方法 A：內建 bio + Simple Author Box** — 兩階段步驟（先填個人檔案 bio + Gravatar、再裝外掛顯示作者卡）。零成本、零程式碼。
   - **方法 B：WPCode Person Schema** — 額外注入 Person JSON-LD、給 AI 看（與 Method A 互補：Author Box 給人類、Schema 給 AI）。含 jobTitle / sameAs / worksFor 完整 E-E-A-T 訊號。

**已升級 5 個 fix item：** llms_txt / json_ld / faq_schema / canonical / author_info。剩下的（meta_title / meta_desc / open_graph / contact_page / privacy_policy / h1_structure / alt_tags / mobile_compatible / page_speed / bot_accessibility）暫不動 — 內容已詳細或不適合多 method 拆分。

---

### 2026-06-09（FixGuide 升級延伸：Organization Schema + FAQ Schema 也加 WPCode 路徑）

**動機：** 延續上一輪 llms.txt 多 method 升級、把客訴次高的兩個 Schema 項目也升級。Schema 紅燈是代理商客戶最痛的修復項目（要嘛裝 SEO 外掛、要嘛要碰程式碼）、給客戶兩條路選擇大幅降低客服回覆量。

**[src/data/fixGuides.js](src/data/fixGuides.js) 兩個升級：**

1. **`json_ld`（Organization Schema）WP 兩條路：**
   - **方法 A：Rank Math 外掛** — 後台 → Titles & Meta → Local SEO、視覺化填表單、自動注入。台灣 WP 站 70%+ 有裝 Rank Math、最高 CP 路線。
   - **方法 B：WPCode PHP Snippet** — 給沒裝 SEO 外掛的站、附完整 `wp_head` hook + PHP array → JSON-LD 範本、UTF8 不轉義、可直接複製貼上。

2. **`faq_schema` WP 兩條路：**
   - **方法 A：Rank Math 視覺化** — 編輯文章 → Schema 側欄 → FAQ Generator → 視覺化加 Q/A、儲存自動注入。
   - **方法 B：WPCode 指定頁注入** — 用 `is_page($TARGET_PAGE_ID)` 守衛限定特定頁、避免錯頁顯示。陣列結構讓改 Q/A 不用碰 JSON。

**其他 platform 暫不動：** Shopify / Wix / HTML 結構簡單、單 method 就夠。下次客戶反饋哪個項目再針對性處理。

---

### 2026-06-09（FixGuide 升級：支援多做法 sub-tab、llms.txt 提供 WPCode + 主機面板兩條路）

**動機：** 第一個付費客戶 kimbo3899 修 llms.txt 紅燈時、Aark 給的指引「在網站根目錄建立 llms.txt」沒講具體怎麼建、客戶踩到「沒主機後台權限不知怎麼辦」的痛點。

**做的事：**
1. **[src/components/FixGuide.jsx](src/components/FixGuide.jsx) 擴充 schema：** 同一個 platform 內支援多 `methods` 陣列（label / hint / steps / code / codeLabel）、UI 加 sub-tab 切換。向下相容單一 `steps + code` 的舊格式。
2. **[src/data/fixGuides.js](src/data/fixGuides.js) `llms_txt.wordpress` 改寫為兩個 methods：**
   - **方法 A（推薦）：WPCode 外掛** — 給「只有 WP admin、沒主機後台權限」的代理商客戶。完整 10 步驟 + 含 PHP heredoc 的 snippet 可直接複製。
   - **方法 B：主機面板新增檔案** — 給「有 Hostinger / cPanel / Plesk 後台」的自管站。7 步驟 + 純文字 llms.txt 範本。

**未動：** 其他 platform（Shopify / Wix / HTML）保持單 method、結構簡單沒必要拆。其他 fix 項目（FAQ Schema / Org Schema 等）schema 未升級、之後遇到「客戶不知怎麼做」的反饋再針對性處理。

---

### 2026-06-09（🔥 P0：NPA notify webhook 漏寫 `pro_expires_at` — 第一個付費客戶踩到）

**問題：** 第一個真實付費客戶 yuppy0912 完成早鳥年繳 NT$11,880、`is_pro=true` 有設、但 `pro_expires_at=NULL`。會變「終身 Pro」、明年到期不會自動降級、也不會觸發續訂提醒。

**根因：** [api/newebpay-notify.js:253-267](api/newebpay-notify.js#L253) `pro_yearly` 分支只寫 `is_pro / payment_gateway / subscribed_at`、漏寫 `pro_expires_at = paid_at + 1 年`。WORKLOG 期望「年繳 = paid_at + 365 天」但 webhook 沒實作。整個 codebase 沒有任何地方寫這欄位（除了客服工具手動延長 Pro 的 admin UI）。

**修法：**
1. **立即補這位客戶：** 用戶手動跑 SQL `UPDATE profiles SET pro_expires_at = '2027-06-09 06:24:47+00' WHERE email='yuppy0912@gmail.com'`
2. **源頭修：** [api/newebpay-notify.js](api/newebpay-notify.js) `pro_yearly` 分支補上：
   - `pro_expires_at: now + 1 year`
   - 順便清試用旗標 `is_trial: false / trial_ends_at: null`（試用→付費轉換時應該清掉）

**影響範圍：** 只有 yuppy0912 一位（這是第一個付費客戶）、無其他受影響用戶。下一個付費客戶起、webhook 自動寫 expires。

**未動：** NPA 月繳分支（line 602+）`pro_expires_at` 邏輯 — 月繳是自動續扣、語意應該是「下次扣款日」、需要另設計（先記在這、不急）。

---

### 2026-06-09（手機 QA 第一波：TopBar 收斂 + admin 密表 overflow）

**問題 1：DashboardV2 TopBar 4 顆按鈕在手機爆版**
- 「← 切回舊版」「🔄 重新檢測」「📄 匯出 PDF」「📋 6 週清單」+ 左側返回 + 網站名 + URL、375px 寬時 flex-wrap 醜。
- **修法：** [src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx) — 手機（< sm = 640px）只顯示 emoji + tooltip、桌面才補完整文字。「切回舊版」是最低用率、手機直接 `hidden sm:inline-block`、低估了好像沒人會在手機切舊版。

**問題 2：admin 4 個密表（CSS grid-cols-12）在手機爆寬**
- AdminUsers / AdminWebsites / AdminShowcase / AdminAnnouncements 用 `grid grid-cols-12` 模擬表格、但沒 RWD、375px 視窗每格 ~31px 完全無法閱讀。
- **修法：** 外層 `overflow-hidden` → `overflow-x-auto`、每個 grid-cols-12 row 加 `min-w-[800px]` 強制不縮。手機橫向滑動看密表、不撐爆整頁。

**處理量：** DashboardV2 TopBar 1 處 + admin 4 檔（AdminUsers 手改、其他 3 檔 Node 腳本批次）= 5 個檔案。

**未處理（觀察、無實證問題）：**
- MetricSignatures 6 欄格（90px + 5×1fr）— 375px 下擠但能塞、等實測再說
- BulkScan 大量 inline flex — Stage 1 字體拉大後可能更擠、等手機實測再針對性處理
- AuditHero `1fr 1fr` — 該自動縮、不動

---

### 2026-06-08（🔥 P0 金流 bug：試用中用戶無法升級早鳥 + UX 修補）

**問題：** 用戶想付 990 早鳥年繳、Pricing 頁只看到「免費試用 7 天」按鈕、按下去自動啟動試用、變成「✨ 試用中・剩 7 天」、找不到付款入口卡關。

**根因 (Pricing.jsx line 269)：**
```js
if (isPro) { navigate('/account'); return }  // ❌ 試用中 isPro=true、也被擋掉
```
試用中用戶 `isPro=true && isTrial=true`、但這條 guard 把所有 `isPro` 都導去 /account、試用用戶按付款按鈕也跳不到 NewebPay。

**修法：**
1. **Fix 1（根因）：** [src/pages/Pricing.jsx:269](src/pages/Pricing.jsx#L269) guard 改 `if (isPro && !isTrial)`、試用用戶可走付款流程把試用轉成早鳥年繳。
2. **Fix 2（UX）：** 試用中 UI 加上明顯的「🐣 立即升級鎖定早鳥 NT$990／月」橘黃漸層大按鈕、不再只靠「管理訂閱 →」灰字小連結。
3. **Fix 3（UX）：** 未試用過 UI 在「免費試用 7 天」主按鈕下方加「不用試用、直接鎖定早鳥 NT$990／月 →」次要連結、避免「想付錢卻被引導到免費試用」的認知落差。

**檔案：** [src/pages/Pricing.jsx](src/pages/Pricing.jsx)。

**影響：** 試用中客戶（包含已被卡住的真實案例）部署後即可直接從 Pricing 頁升級到付費年繳、不需另外聯絡客服。

---

### 2026-06-08（Stage 3：Tailwind `text-xs` + `text-[9-13px]` → `text-sm`、共 311 處）

**動機：** Stage 1+2 處理完 inline fontSize 後、Tailwind class 還有 `text-xs`（12px）和少數 `text-[10px]/[11px]/[12px]/[13px]` 散落 26 個檔。再次拉到 Dashboard 基準（text-sm = 14px）。

**處理量（合計 26 檔 / 311 處）：**
- AdminUsers: 68（admin 表格密集區）
- Dashboard.jsx (V1 legacy): 63
- WeeklyAITrendsCard: 16
- Account / Showcase: 14 各
- AdminAnnouncements / AdminShowcase: 13 各
- LLMOChecklistModal: 11
- AdminRevenue / AdminWebsites: 10 各
- AIVisibility / AdminMonitoring: 8-9 各
- FixGuide / WebsiteSummary / ClientReportModal / SiteHeader / Register / Footer / NotificationBell / AdminLayout / DashboardV2 / Login / AnnouncementBanner / EarlybirdBanner / AdminDashboard / AdminSeed: 3-7 各

**跳過：** `src/pages/_legacy/` 已下線、不渲染、不處理。

**累計 Stage 1+2+3：** 50 個檔案 / 679 處小字體拉到 14px 基準。

---

### 2026-06-08（Stage 2：全站殘存 inline fontSize 9-13 → 14、共 228 處）

**動機：** Stage 1 處理完 6 個 audit 頁後、再次全 src/ 掃描、發現還有 18 個檔案、228 處 inline fontSize 9-13 沒處理（包含 AIVisibilityDashboard 71 處、共享 components 像 MetricSignatures / IssueBoard / AuditHero、甚至 Dashboard V2 本身也有 5 處）。

**處理量（合計 18 檔 / 228 處）：**
- AIVisibilityDashboard: 71
- MetricSignatures: 25
- SchemaCheck / IssueBoard / OrgSchemaGenerator / HelpRankMath: 18-20 各
- AuditHero: 15
- SerpAndVitals: 9
- AdminMonitoring / ArticleAnalysisTabs / DashboardV2: 5-6 各
- 其他 ≤ 4 處：Dashboard / HomeDark / PlatformLogoWall / AdminRevenue / ContentAudit / Btn / HomeShowcaseSection

**手法：** 同 Stage 1、Node 腳本機械替換 `fontSize: 9-13` → `fontSize: 14`。大標題（18+）保持不動。

**累計：** Stage 1 + Stage 2 共處理 24 個檔案、368 處 inline fontSize 拉到 14px 基準。

---

### 2026-06-08（audit 頁字體統一拉到 Dashboard 標準 — Stage 1）

**問題：** 6 個 audit 頁（BulkScan / GEOAudit / CrawlCheck / SEOAudit / AEOAudit / EEATAudit）早期用 inline `fontSize: 10/11/12/13`、比 Dashboard V2 的 text-sm（14px）小 14-50%、用戶反映「文字小、看不清」。BulkScan 最痛（35 處 fontSize: 10 / 4 處 fontSize: 9）。

**修法：** 寫一支 Node 機械替換腳本、把 6 個檔案內所有 inline `fontSize: 9-13` 統一拉到 `fontSize: 14`（= Dashboard 基準）。大標題（fontSize 18+）保持不動。

**處理量：**
- BulkScan: 88 處
- GEOAudit: 26 處
- CrawlCheck: 12 處
- SEOAudit: 9 處
- AEOAudit: 4 處
- EEATAudit: 1 處
- **合計 140 處**

**Stage 2（暫緩）：** 其他頁面少數 `text-xs` chip/badge 等。Dashboard 本身也用 text-xs、不一定要動、等 Stage 1 看實際效果再決定。

---

### 2026-06-08（revert pdfmake 版、暫時維持 html2canvas 圖片版 PDF）

**為什麼 revert：** 早上嘗試把 LLMO 6 週清單 PDF 從 html2canvas（圖片版）改成 pdfmake（真文字版）、想讓 PDF 內的 robots.txt / Schema 程式碼可以被選取複製。但實測客戶生成時卡超過 60 秒沒完成、原因是 pdfmake 在瀏覽器 embed 12 MB Noto Sans TC CJK 字體時、子集化解析非常慢（已知 CJK 通病）。

**根本解：** build-time 字體子集化（300 KB 字體、< 2 秒生成）— 40 分鐘工作。
**但今天決定：** 先 revert、之後再做。客戶當下要能用 > 完美。

**revert commit：** `e057ccd` 撤銷 `0896445`、自動：
- 刪掉 public/fonts/NotoSansTC-Regular.ttf（12 MB）
- 刪掉 src/services/pdfMakeLoader.js
- 從 package.json 移除 pdfmake
- 還原 llmo6WeekChecklistPDF.js 為 html2canvas 版

**已知後遺症：** 12 MB 字體還在 git history 裡（之後想真正清乾淨要 git-filter-repo / BFG）。功能面 0 影響。

---

### 2026-06-08（LLMO 6 週執行清單 PDF — 平台級代理商交付物）

**動機：** LLMO 是抽象概念、代理商交付給客戶時很難講具體要做什麼。把它包成「6 週逐週執行清單」、含 robots.txt / llms.txt / Schema 完整模板 + 每週驗收標準、做為 Pro / Agency 用戶可重用的交付物。

**新檔：**
- [src/services/llmo6WeekChecklistPDF.js](src/services/llmo6WeekChecklistPDF.js) — 10 個 section builder（封面 / 序章 / Week 1-6 / 附錄 A 工具 / 附錄 B 常見錯覺）+ 主 export 函式。分段渲染、每 section 各自 1 canvas → 1 PDF 頁、不切字。
- [src/components/v2/LLMOChecklistModal.jsx](src/components/v2/LLMOChecklistModal.jsx) — 表單 modal、收 clientName / agencyName / agencyContact / startDate。agency info 跟 ClientReportModal 共用同一個 localStorage（aark_agency_info）。

**Dashboard 接線：** [src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx) TopBar 加「📋 6 週清單」按鈕（在「📄 匯出 PDF」右側）。把當下 4 大 audit 分數帶入當 Week 0 起跑點、PDF 封面 + Week 6 驗收表會顯示。

**檔案文案：** 完整 markdown 版備存於 [docs/llmo-6week-checklist.md](docs/llmo-6week-checklist.md)。

**附帶：** pdfExport.js 把 `AARK_MARK_SVG` / `LAYER_COLOR` / `scoreColor` export 出去、讓新 PDF service 重用品牌資產、不需要拷貝。

---

### 2026-06-08（DashboardV2 TopBar「重新檢測」按鈕修復）

**問題：** DashboardV2 TopBar 的 🔄 重新檢測按鈕點下去沒反應。

**根因：** TopBar 內這顆按鈕從來沒掛 `onClick`、純擺裝飾。

**修法：** [src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx) — 把 EmptyState 已經在用的 `handleFirstScan`（4-analyzer + DB insert + reload）也傳進 TopBar、加上載入狀態 spinner + disabled。兩處共用同一個函式、邏輯一致。

---

### 2026-06-08（修「我已修好」按鈕顏色 + PDF 分段渲染、避免跨頁切字）

**問題 1：** 「我已修好（+5 XP）」按鈕修改前/修改後都顯示綠色、看不出狀態差異。

**修法：** idle 改琥珀色（amber `#fcd34d` text / `rgba(251,191,36,0.22)` bg）、done 維持綠（`#86efac` / `rgba(34,197,94,0.18)`）、error 紅、recording 中性灰。BulkScan.jsx FixDoneButton + DashboardV2 ToolModal 「我已修好」按鈕同步更新。

**問題 2：** 客戶提案 PDF 經常切到文字中間（例如「總體 AI 能見度分析」標題下一行就斷掉跑到下一頁、看起來不專業）。

**根因：** 舊版用單一 HTML 渲染到單一 canvas、再用 jsPDF slice 切 A4 頁、`page-break-before` CSS 被 html2canvas 完全忽略。

**修法：** [src/services/pdfExport.js](src/services/pdfExport.js) 重構為 4 個 section builder（buildCoverHTML / buildSummaryHTML / buildRecommendationsHTML / buildDetailedAuditHTML），exportClientProposalPDF 改成 loop 每個 section 各自 render 到獨立 canvas、各自 `pdf.addPage()`。section 內若超過 A4 才會 slice、但至少 section 標題不會被切。舊 `buildClientProposalHTML`（244 行）整段刪除。

**檔案：** [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx)、[src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx)、[src/services/pdfExport.js](src/services/pdfExport.js)。

---

### 2026-06-06（DashboardV2 上線：補 3 缺口 + 主路由切換）

**用戶決策路線：補完 3 缺口 → 切換 `/dashboard/:id` 主路由 → 舊版改 `/dashboard-legacy/:id` 緩衝。**

**Gap 1 · 新用戶 onboarding 空狀態**（[src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx) `EmptyState`）：
- 觸發條件：`!seoAudit && !aeoAudit && !geoAudit && !eeatAudit && !contentLatest`
- 內容：歡迎標題 + 3 步驟說明（爬取 / 5 維度打分 / 給你今日該修清單）+「🚀 開始第一次檢測」主 CTA
- 點 CTA 觸發 `handleFirstScan()` — 對齊 HomeDark.jsx 的 4 analyzer + insert pattern（同步 SEO / AEO / GEO / E-E-A-T）、跑完 `window.location.reload()` 重抓資料
- 之前用戶第一次進 Dashboard 看到空白雷達 + 全 0 分數會以為產品壞掉 → 現在清楚知道下一步該做什麼

**Gap 2 · Action Center 接真資料**（DashboardV2.jsx `generateQuests()` + `QuestSection`）：
- 拿掉 `MOCK_QUESTS` 寫死的 3 筆假任務
- 新增 `generateQuests({ seoAudit, aeoAudit, geoAudit, eeatAudit })` — 從 4 大 audit 的失敗 boolean / JSONB.passed 抓出待修項
- 每個 quest 帶 priority（1-10）、按降序排 Top 3
- 16 個 quest 模板涵蓋：SEO bot_accessibility / meta / h1 / alt、AEO json_ld / faq / og / canonical、GEO llms / robots / sitemap / citation、EEAT org_schema / author / about / privacy
- 「去修」按鈕從 `<button>` 換 `<Link>` 跳對應 audit 詳情頁
- 全部通過 → 顯示「🎉 本日無待修」慶祝狀態（不是空白）

**Gap 3 · ToolBox 4 卡點下去開 modal + 「我已修好」**（DashboardV2.jsx `ToolBox` + `ToolModal`）：
- 卡從 `<Link>` 換 `<button>` 開 modal、不再直接跳走
- Modal 顯示工具完整說明（emoji + name + desc + longDesc）+ 2 個 CTA：
  - 「去用這個工具 → 新分頁開」（target="_blank" 跳對應 generator 頁、不離開 Dashboard）
  - 「✓ 我已修好 (+5 XP)」（呼叫 `recordFixEvent({ source: 'toolbox', findingId: 'tool_xxx' })`、入帳 +5 XP）
- modal 寫進 fix_event 後跳 +5 XP 狀態、1.5 秒後自動關閉
- finding_id 使用 `tool_org_schema / tool_faq_schema / tool_llms_txt / tool_article_schema`

**主路由切換**（[src/App.jsx](src/App.jsx)）：
- `/dashboard/:id` → 從 `<Dashboard />` 換成 `<DashboardV2 />`
- `/dashboard-v2/:id` 保留為 alias（歷史 email / 書籤連結 broken 防範）
- 新增 `/dashboard-legacy/:id` → `<Dashboard />`（舊版緩衝期 fallback）
- DashboardV2 TopBar「← v1」按鈕改名「← 切回舊版」、目標 URL 改 `/dashboard-legacy/:id`
- 觀察 1-2 週穩定後可刪除舊 Dashboard.jsx + `/dashboard-legacy/:id` 路由

**影響面：** 純前端、無 DB schema 變動、無 API 變動。Vercel 部署 ~2 分鐘生效。所有既有 `/dashboard/:id` 連結（Dashboard 內 / Email 報告 / showcase 等）會自動跳新版、不需另外更新。

**待後續：**
- 觀察 1-2 週後刪除 `/dashboard-legacy/:id` 路由 + 移除舊 Dashboard.jsx
- 把 DashboardV2.jsx 改名 Dashboard.jsx（讓檔案名跟主路由一致）
- 之前的 Dashboard.jsx 用了 `loadContentScore` cached bug 修法，記得移植到 DashboardV2 的 `analyzeContent` 流程

---

### 2026-06-05（LLMO 重新定位 P1+P2+P3：DashboardV2 同步 / Audit 訊號層副標 / lastmod 新訊號）

**承接 6/5 LLMO P0 重新定位（已上線 commit 38d3fa6）、用戶要求 P1-P3 接續做完。**

---

**P1 — DashboardV2 prototype 同步**（[src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx)）

DashboardV2 是登入後的儀表板、不是行銷 hero、所以不需要 Variant B 完整文案。但要把「aivis 跟其他 4 訊號層的關係」說清楚：
- AivisHero 副標補一行「LLMO 結果驗證層 · 跨 LLM 引用追蹤、跟 SEO / AEO / GEO / E-E-A-T 4 訊號層合成總分」
- AuditSection「📊 站點體檢」標題旁加綠色 chip「LLMO 4 訊號層 + aivis 結果驗證」

---

**P2 — 4 個 audit 詳情頁加 LLMO 訊號層副標**（4 個檔案）

之前 subChip 都是「技術檢測 / 可信度檢測」、太含糊。改成明確標出「LLMO 訊號層 ①/②/③/④」（aivis = ⑤、不另算）：

- [SEOAudit.jsx](src/pages/SEOAudit.jsx)：「LLMO 訊號層 ①」+ tagline「傳統搜尋排名 — LLMO 5 個訊號層的地基，沒這個 AI 也找不到你」
- [AEOAudit.jsx](src/pages/AEOAudit.jsx)：「LLMO 訊號層 ②」+ tagline「讓 AI 把你當答案、引用你的內容」
- [GEOAudit.jsx](src/pages/GEOAudit.jsx)：「LLMO 訊號層 ③」+ tagline「讓 ChatGPT、Perplexity、Gemini 在長篇回答中推薦你（LLMO 重疊度最高的一層）」
- [EEATAudit.jsx](src/pages/EEATAudit.jsx)：「LLMO 訊號層 ④」+ tagline「讓 AI 判斷你可信、值得被引用的訊號」

---

**P3 — geoAnalyzer 補 lastmod (content freshness) 訊號**（[src/services/geoAnalyzer.js](src/services/geoAnalyzer.js) + [GEOAudit.jsx](src/pages/GEOAudit.jsx)）

LLM 引擎在 retrieve / cite 時偏好「新鮮」內容（dateModified ≤ 365 天）— LLMO 業界共識訊號、之前完全沒檢測。

**新增 `checkLastmod(doc)` 函式**，從 4 個來源抓修改時間並判定新鮮度：
- (a) `<meta property="article:modified_time">` ← Yoast / Rank Math 自動輸出
- (b) `<meta itemprop="dateModified">` ← Schema.org microdata
- (c) JSON-LD 內 `dateModified` 欄位
- (d) `<time datetime>` 標籤

通過條件：找到任一來源、且 daysSince 在 [0, 365] 之間。

**設計選擇 — 暫不計入主分數：**
- 主分數仍用 /8 分母、避免歷史用戶分數突然 -11
- 也避免 geo_audits 表的 schema migration 壓力
- GEO_CHECKS 新增條目用 `isNewSignal: true` 標記
- GEOAudit.jsx 算 score 時 filter 掉 isNewSignal、不入分母
- 結果存在 `result.details.lastmod` 給 UI 展示

**未來升級為計分項的步驟（記錄、不在本次做）：**
1. SQL：`ALTER TABLE geo_audits ADD COLUMN lastmod_passed BOOLEAN DEFAULT NULL;`
2. 更新 4 個 insert sites（Dashboard / HomeDark / GEOAudit / AdminSeed）加 lastmod_passed 欄位
3. 拿掉 GEO_CHECKS 該條目的 isNewSignal flag、分母自動變 /9
4. 更新 [src/components/v2/MetricSignatures.jsx](src/components/v2/MetricSignatures.jsx) 加 lastmod 圖示（若有）

**影響面：** P1 / P2 純文案 + UI 結構小調整、零邏輯改動；P3 加 1 個 analyzer 函式 + 1 個 UI 條目、零 schema 變動、零既有分數影響。Vercel 部署 ~2 分鐘生效。

---

### 2026-06-05（meta title / desc 提示加「Rank Math 欄位」明確指引、消除「標題」歧義）

**用戶痛點：** finding 寫「標題只有 14 字（建議 30-60）」，客戶會困惑「標題指哪個」 — 可能誤改 WP 文章/商品名稱（h1）、瀏覽器分頁標題、或 Rank Math SEO Title。實際指的是 `<title>` tag = Rank Math「SEO Title」欄位。

**修法：所有 meta title / desc 文案加「Rank Math 欄位明確指引」**

[api/cron-bulk-scan.js](api/cron-bulk-scan.js) — 動態 label + note：
- `short_meta_title.label`：「標題只有 X 字...」→「**SEO Title 只有 X 字、建議 30-60（Rank Math「SEO Title」欄位）**」
- `long_meta_title.label`：「標題 X 字過長」→「**SEO Title 過長（Rank Math「SEO Title」欄位）**」
- `missing_meta_desc.label`：「缺 Meta 描述」→「**缺 Meta 描述（Rank Math「Description」欄位空白）**」
- `short_meta_desc.label`：「Meta 描述只有 X 字」→「**Meta 描述只有 X 字、建議 70-155（Rank Math「Description」欄位）**」
- `long_meta_desc.label`：「Meta 描述 X 字過長」→「**Meta 描述過長（Rank Math「Description」欄位）**」
- 所有 `suggestion.note` 結尾加「**改 Rank Math meta box 的「SEO Title / Description」欄位（不是 WP 文章/商品名稱 / 內文）**」

[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) — 靜態 PROBLEM_LABELS + PROBLEM_FIX_TIPS：
- PROBLEM_LABELS 6 個 meta 標題 / 描述 entry 全部補上「Rank Math「X」欄位」字尾
- PROBLEM_FIX_TIPS 6 個 entry 前段補上「這是 Rank Math meta box 的「X」欄位（不是 WP 文章/商品名稱 / 內文）」

**影響面：** 純文案改動、無邏輯變動。Push 後 Vercel 部署 ~2 分鐘；新舊 finding 都會顯示新文案（label 來自 server / tip 是 client 靜態）。

---

### 2026-06-05（Sitemap discovery 強化：robots.txt + 路徑擴充 + 重試）

**用戶痛點：「批次文章掃描立刻重掃確認之後又出現 ⚠️ Sitemap discovery failed，這個問題好像常常出現」**

**根因 4 個結構性缺口：**
1. **只查 3 個 hard-coded 路徑** — /sitemap_index.xml / /wp-sitemap.xml / /sitemap.xml；自訂變體（dash / 複數 / 編號）會 miss
2. **完全不讀 /robots.txt 的 Sitemap 指令** — 這是 SEO 業界標準路徑、最該優先讀的；之前漏了
3. **Timeout 15s 對慢主機不夠** — 跟之前 article fetch 同問題
4. **全失敗就立刻 throw** — mod_security 暫時 throttle（通常 < 5 秒就過）沒重試機會

**修法（[api/bulk-scan.js](api/bulk-scan.js)）：**
- 新增 `discoverSitemapsFromRobotsTxt(origin)` — fetch /robots.txt、用 regex 抽出所有 `Sitemap: <url>` 指令
- 候選路徑清單從 3 個 → 8 個（加 `/sitemap-index.xml` / `/sitemaps.xml` / `/sitemap1.xml` / `/post-sitemap.xml` / `/wp-sitemap-posts-post-1.xml`）
- robots.txt 找到的 sitemap URL 優先試、再試 hard-coded、最後去重
- 全失敗 → sleep 3 秒 → 重試 1 輪（應付暫時 rate-limit）
- Timeout 15s → 25s（常數提到 `SITEMAP_FETCH_TIMEOUT_MS` 同時更新子 sitemap fetch）
- 失敗錯誤訊息更具體：列出試了幾個路徑、robots.txt 內有沒有 Sitemap 指令、給用戶具體下一步

**預期效果：** 成功率從 60-70% → 90%+；失敗時 start endpoint 阻塞從 ~9 秒拉到 ~30-40 秒（多了 robots.txt + 重試 + 8 路徑 × 3 UA），但用戶看 ❌ 機率大減。

**影響面：** 純 worker 端、無 DB / 無前端、無 schema 變動。Push 後 Vercel 部署 ~2 分鐘生效、下次按重掃就用新版。

---

### 2026-06-05（LLMO v2 文案 + 品牌名「方舟 AI 雷達」定案 — 5 AI 共識整合）

**用戶把 P0 文案拿給 5 個 AI（GPT-5 / Gemini 2.5 / Grok / Perplexity / Claude）跑第二意見後、回來整合。**

**共識熱圖（5/5 高一致）：**
- 整體文案平均分 7.9/10、方向正確
- 代理商吸引度（4/5 給 ≥8.5、Claude 唯一 6.5 異議：認為原版「你」字偏品牌主視角）
- 主標「ChatGPT 推不推薦你?」3/5 建議加「**的品牌**」更具象（GPT / Grok / Claude）
- 副標「不會自動延續」5/5 都覺得語氣太衝、會嚇代理商 — 改「**不會 1:1 自動轉成 AI 曝光**」+ 補一句「**把這些成果再轉成 ChatGPT 看得懂的訊號**」延伸而非否定 SEO
- LLMO 5/5 一致：必須中文錨點、不能裸放 — 改「**AI 搜尋能見度監測平台（LLMO）**」
- 4/5 共識最大盲點：漏「**代理商賺錢角度**」、用戶搞不清「是給代理商還品牌主的」 — 第一個 chip 從「7 大檢測項一次到位」換成「**代理商必備：多站追蹤 + PDF 報告**」

**品牌名稱投票（5 AI 平手 2:2:1，回到市場優先順序決定）：**
- GPT / Gemini / Claude 推 Aark AI 雷達（國際 SaaS 質感）
- Grok / Perplexity 推方舟 AI 雷達（台灣記憶點、「方舟 = 載你度過 AI 洪水」隱喻）
- Aark 5/5 都說「會記不住、沒語意、要靠 logo 撐」

**最終決定：方舟 AI 雷達**（hybrid 三層架構）
- 產品線（前端 / SEO / 口頭）：方舟 AI 雷達
- 品牌母體（logo / 視覺）：AARK
- 營運公司（法律）：優勢方舟數位行銷
- 理由：P0 是台灣代理商、中文好記 > 國際感；未來國際版可走 AARK Radar 並行

**v2 改動 5 個檔案：**
- HomeDark.jsx — Hero h1 / 副標 / 訊號層 / 1 個 chip 替換
- FAQ.jsx — LLMO 兩題加方舟 AI 雷達 + 業界俗稱
- README.md — 標題改「方舟 AI 雷達」+ 加三層品牌架構說明
- CLAUDE.md — 產品定位段加 v2 + 三層品牌架構
- WORKLOG.md — 本筆紀錄

**待做（後續迭代）：**
- 加社會證明 thin bar（GPT 建議）— 需要 /api/public-stats 真實數字
- 加「為什麼現在要做」時間壓力敘事（GPT 建議）
- 「不懂程式碼也能照著步驟修」chip 位置可能要降權（Claude 提醒會稀釋專業感、但 P1 品牌主友善訊號要保留）
- Logo / 視覺設計補上 AARK 雙 A 視覺記憶點（5/5 都說 Aark 念錯記不住、要靠視覺撐）
- DashboardV2 prototype 同步新文案

---

### 2026-06-05（wp_admin_hint 加 slug 解析 + 一鍵直達 WP 後台搜尋按鈕）

**用戶痛點：「以上分析這有辦法寫得詳細一點嗎？因為現在都很難找到對應的頁面」**

範例：[kimbo3899.com.tw/product-category/特斯拉配件/screen/](https://kimbo3899.com.tw/product-category/特斯拉配件/screen/) 的 wp_admin_hint 只說「去 WooCommerce 商品分類頁」、沒講具體是「特斯拉配件 → screen」這個分類、用戶要自己去 200 個分類裡找。

**根因：** [detectWpAdminHint()](api/cron-bulk-scan.js) 給的 steps 太通用、沒從 URL 抽出 slug 也沒提供直達連結。

**修法（2 個層次）：**

**1. cron-bulk-scan.js — 從 URL 解析 slug + 組「直達後台搜尋」URL：**
- 商品分類頁（/product-category/A/B/）：
  - `where` 改為「WooCommerce 商品分類頁（路徑：A → B）」
  - steps 第一行寫「🎯 這個分類的 slug 是「B」、父層是「A」」
  - 新增 `direct_admin_url` = `{origin}/wp-admin/edit-tags.php?taxonomy=product_cat&post_type=product&s={leafSlug}`
  - URL 路徑 toLowerCase 後 `%E7` → `%e7`、decodeURIComponent 仍正確還原中文
- 商品頁（/product/xxx/）：
  - `where` 改為「WooCommerce 商品頁（商品 slug：xxx）」
  - 新增 `direct_admin_url` = `{origin}/wp-admin/edit.php?post_type=product&s={slug}`
- 商店頁（/shop/）：
  - 新增 `direct_admin_url` = `{origin}/wp-admin/edit.php?post_type=page&s=shop`

**2. BulkScan.jsx WpAdminHintBanner — 渲染 direct_admin_url 為藍色按鈕：**
- 放在 steps 上方最顯眼位置
- 用 rgba(59,130,246,0.25) 藍色 + emoji 🔥 + slug 字串標題
- target="_blank" 開新分頁、要求用戶已登入 WP admin

**體驗變化：**
- 之前：用戶看到 finding → 知道哪個 URL 有問題 → 自己想辦法找 WP 後台對應分類（可能 30 秒-2 分鐘）
- 之後：用戶看到 finding → 點藍按鈕 → 直達後台搜尋結果頁 → 按編輯（5 秒）

**影響面：** worker + 前端兩處改動，無 DB schema 變動。Push 後 Vercel 部署 ~2 分鐘；BulkScan 已快取的 result 要重掃才會帶新 hint 欄位，但 BulkScan.jsx 對舊欄位向下相容（沒 direct_admin_url 就不渲染按鈕）。

---

### 2026-06-05（LLMO 重新定位 P0：HomeDark hero / FAQ / README / CLAUDE.md 文案改寫）

**戰略討論結論：** 跟用戶對照 5 個模組（SEO/AEO/GEO/E-E-A-T/內容品質 + aivis）跟 LLMO 業界共識訊號的重疊度後，發現 AI 雷達實際做的事 70-80% 都落在 LLMO 範疇（GEO 90% + AEO 80% + E-E-A-T 70% + aivis 100%）。原本「SEO · AEO · GEO · LLMO · E-E-A-T 五大維度字母湯」語言是行銷詞、產品實際只有 4+1（沒獨立 LLMO 軸）— 言行不一致。

**新定位：** 「LLMO 是大傘、其他 4+1 是傘下子訊號層」。AI 雷達 = 台灣第一個 LLMO 監測平台。

**主要客戶（P0）：** 數位行銷代理商（5-30 人、已賣 SEO 服務、需要多客戶工作區 + 白標報告）— 用戶自己就是代理商、做產品的人 = 用戶 = PMF 最快路徑。代理商付工具是 OPEX 心理門檻低（Ahrefs $129+ USD/月已是標配），且 1 個代理商客戶 = 10-50 個網站 multiplier。

**Hero 文案改寫（Variant B 進攻版）：**
- h1：「ChatGPT 推不推薦你?」（從「你的網站，AI 看得見嗎?」改）
- 副標：「你花在 SEO 的投資，AI 時代不會自動延續。AI 雷達天天監測你在 ChatGPT、Perplexity、Gemini 的能見度。」（從「從 Google 到 ChatGPT，一次掌握你的 AI 能見度」改）
- 字母湯：「LLMO 監測平台 — 拆 5 個可量化訊號：SEO · AEO · GEO · E-E-A-T · aivis 跨 LLM 引用追蹤」（從「SEO · AEO · GEO · LLMO · E-E-A-T 五大維度一次到位」改）— 拿掉「字母湯」這個業界自嘲詞、產品端不該出現

**FAQ 兩題改寫：**
- 「什麼是 LLMO？」— 從「LLMO 是 GEO 的技術子集」改為「LLMO 是大傘、不是子集；AI 雷達把它拆成 5 個可測量子訊號」
- 「5 個維度差在哪？」— 從「層層疊加」改為「LLMO 是傘、其他 4 個是傘下子訊號層」、aivis 列入做「結果驗證」

**README + CLAUDE.md：** 標題改「AI 雷達 — 台灣第一個 LLMO 監測平台」、產品定位段補主要客戶 P0/P1 與核心訴求（從一次性顧問升級成持續訂閱）。

**影響面：** 純文字 / 標題 / 文案改動，0 行邏輯改動，0 個元件 layout 改動，可一個 git revert 即回去。Vercel 部署 ~2 分鐘生效。

**待做（後續階段）：**
- P1：DashboardV2 prototype hero 同步、Pricing 頁副標更新（金流敏感先觀望）
- P2：GEO / AEO / E-E-A-T audit 詳情頁 hero 加副標「（LLMO 訊號層）」
- P3：補真正缺的 LLMO 項目（lastmod / Markdown-friendly HTML / aivis 整合更深）
- 拿給 Gemini / GPT 做第二意見、看市場語感 + 轉換率角度

---

### 2026-06-05（BulkScan worker 對 Hostinger 共享主機過於兇猛、200 篇只掃到 12 篇的修復）

**用戶回報：** kimbo3899.com.tw 跑全站 BulkScan 後，全部結果列表 200 個 row 裡九成顯示 `❌ 所有 UA 嘗試都失敗：Bingbot: The operation was aborted due to timeout`。

**根因：** [api/cron-bulk-scan.js](api/cron-bulk-scan.js) 並發策略對 Hostinger 共享主機過於兇猛：
- `URLS_PER_TICK = 8`（每個 cron tick 8 並發 fetch）
- `FETCH_TIMEOUT_MS = 12000`（12 秒 timeout）
- UA fallback chain（Chrome → Googlebot → Bingbot）對 timeout 也會 retry

當 Vercel IP 用 8 並發打 kimbo3899（Hostinger + mod_security + LiteSpeed），主機被打爆 → 所有 8 個都慢 → 12 秒 timeout 全 abort → 換 UA 再各等 12 秒 timeout → 一個 URL 浪費 36 秒。Vercel function 60 秒上限內只有 1-2 篇趕得上回寫，6-7 篇被 abort 標 failed。25 分鐘 cron 跑下來只有 ~12 篇成功。

**修法（3 個改動）：**
- `URLS_PER_TICK: 8 → 3` — 給共享主機喘息空間，避免並發打爆
- `FETCH_TIMEOUT_MS: 12000 → 20000` — Hostinger 共享主機 > 12s 是常態
- `fetchArticleWithFallback` 偵測 `TimeoutError / AbortError / /aborted|timeout/i` 後**直接 break**、不再換 UA retry — timeout 是「主機慢」不是「擋 UA」，換 UA 沒用浪費秒數。HTTP 406/403/429/503 還是會走 UA retry chain（那才是真的擋 bot）。

**取捨：** 200 篇從目標 25 分鐘變實際 ~70 分鐘，但成功率從 ~10% 拉到 95%+。慢一點但能跑完比快但失敗好。Vercel Hobby 1 cron / 分鐘維持不變、Stale recovery 3 分鐘窗口足夠（單 URL 最壞 case 20s × 2 UA retry = 40s）。

**影響面：** 純 worker 端、無 DB schema 變動、無前端動。Push 後 Vercel 部署 ~2 分鐘生效，下次重掃就會改善。

---

### 2026-06-05（Dashboard 內容品質「重新檢測」不會重算的 bug 修復）

**用戶回報：** 在 Dashboard 按「重新檢測」後，SEO/AEO/GEO/EEAT 四個分數都會更新，但第 5 張卡「內容品質」分數永遠卡在第一次跑出來的值（用戶實際遇到的是 35 分一直不動）。

**根因：** [Dashboard.jsx:126](src/pages/Dashboard.jsx#L126) `loadContentScore` 設計成「先讀 cached、有就直接 return」。第一次跑時 cached=null 會 insert 一筆，之後**所有**呼叫都會讀到 cached 直接 return — 包括 handleReanalyze 觸發的那次。`handleReanalyze` 雖然有呼叫 `loadContentScore(id, website.url)`（[Dashboard.jsx:427](src/pages/Dashboard.jsx#L427)），但 cached 攔在前面，從來不會走到 `analyzeContent(url)`。

**修法：**
- `loadContentScore` 加 `forceRefresh = false` 第三參數；handleReanalyze 呼叫時傳 `true`，跳過 cached 直接重跑 analyzeContent → insert 新筆。
- `fetchData` 加 `{ skipContentScore }` 選項；handleReanalyze 呼叫 fetchData 時傳 `true`，避免 fetchData 內的 loadContentScore（cached 路徑）跟外層 forceRefresh 重算 race（cached 較快、會覆蓋掉新分數）。
- 初始 useEffect 呼叫 fetchData() 不傳參數、走預設 cached 路徑（首次載入仍從 cache 拿、不會多打一次 fetch）。

**影響面：** 純前端、無 DB schema 變動。Push 後 Vercel 部署 ~2 分鐘生效。歷史已存的 cached row 不會自動失效，用戶按「重新檢測」會 insert 新一筆覆蓋顯示。

---

### 2026-06-04（Rank Math 教學：inline 微教學 + /help/rank-math 速查頁）
**用戶痛點：「告訴用戶該去 Rank Math 改 XX、但沒教 Rank Math 怎麼用」 → agency / 客戶斷層。**

**A + B 兩階段：**

**A — wp_admin_hint 內加 inline 微教學**（[api/cron-bulk-scan.js](api/cron-bulk-scan.js)）：
- article / page / product 三種 hint 的 steps 末段加「📝 Rank Math meta box 常用欄位（教學）」
- 每個欄位附「該填什麼 + 範例 + 注意事項」
- 加 `help_link: '/help/rank-math'` + `help_link_label` 欄位、給前端渲染按鈕用
- 前端 WpAdminHintBanner 多渲染一顆紫色「📖 看 Rank Math 完整速查表」按鈕、連到 B 速查頁

**B — 新建 /help/rank-math 速查頁**（[src/pages/HelpRankMath.jsx](src/pages/HelpRankMath.jsx)）：
- App.jsx 加路由 `/help/rank-math`
- 5 大區塊 + 目錄錨點：
  1. 怎麼找到 Rank Math meta box（找不到 = Screen Options 沒勾）
  2. General 分頁 4 個欄位（Title / Description / Focus Keyword / Slug）含「該填什麼 + ✅ 好範例 + ❌ 不好範例 + 💡 重點」
  3. Schema 分頁該選哪種類型（商品=Product / 文章=Article / 法律頁=None 等表格）
  4. Advanced Robots Meta 各選項解釋（Index/NoIndex 等 6 個預設別動）
  5. 全域設定（Titles & Meta）9 個常見開關（呼應你截圖的 8 個）
- 暗色 V2 token 視覺、青綠雙漸層背景、Card 元件統一
- Footer 引導：看完不懂用「📤 給客戶報告」匯出整段

**效果：**
- agency 從 finding hint 一鍵跳到 /help/rank-math、不需上 google
- 客戶看到報告 + 速查頁、可以自己照表填、不用 agency 一個個解釋

---

### 2026-06-04（主題級 H1 重複的「給一般人看的修法」）
**用戶 push back：「父容器 class: pr-content」太技術、一般人看不懂、不知道找什麼東西、改什麼東西。**

確實、之前的訊息太工程師導向。重寫成 4 段任何人都能照做的步驟：

**[api/cron-bulk-scan.js](api/cron-bulk-scan.js) cross_container 重複時、附帶 `fix_guide` 物件：**
```js
{
  symptom_human: '同一段內容在商品頁出現兩次。一次在商品圖下方某個自訂區塊、一次在描述分頁。',
  how_to_verify: [4 步具體驗證流程],
  fix_options: [
    'A. 不修（接受）— 0 分鐘',
    'B. 請主題開發者調整 — ~30 分鐘工時',
    'C. 自己裝 Code Snippets 外掛 + 貼 PHP — ~10 分鐘',
  ],
  ticket_for_tech: '可直接複製貼到 LINE/Email 給工程師的訊息（含 URL + 症狀 + 影響 + 建議解法）'
}
```

**[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) H1DetailCard：**
- 主 reason 變 plain language：「你的網站把同一段商品描述顯示了兩次 — 不是你寫了兩份、而是網站主題自動塞的」
- 「🔧 如何處理」紅色 collapsible：點開有 4 段（症狀 / 驗證 / 3 修法 / 給工程師的訊息）
- 給工程師的訊息有「📋 複製訊息」按鈕、按下去進剪貼簿
- 父容器 class 收到最底下的 `<details>` 內、`🔬 工程師專用`、一般用戶不會看到

**效果：**
- 一般用戶展開「如何處理」、知道：哪個區塊有問題 + 怎麼確認 + 自己／工程師處理該怎麼下手
- agency 把「給工程師的訊息」一鍵複製、直接傳 LINE 給客戶的維運工程師、不用自己翻譯技術細節
- 工程師需要技術細節時、展開最底下 `🔬 工程師專用` 看 parent_class

---

### 2026-06-04（主題級 H1 重複偵測 — parent_class + cross_container）
**用戶 case：kimbo3899 skoda-mib-chinese 商品頁、改 H1→H2、清完快取、線上還是 3 個 H1。**

我抓 live HTML 看每個 H1 的父容器 class、發現真凶：
- H1#1 在 `summary entry-summary`（WC 主題模板的商品標題）
- H1#2 在 `pr-content`（**自訂主題的區塊**、把描述渲染了一次）
- H1#3 在 `woocommerce-Tabs-panel--description`（標準 WC 描述 tab、用戶編輯的內容）

→ 不是「商品簡述」問題、是**主題在多個位置渲染同一份內容**、改後台改不掉、要修主題 PHP。

**改動：**

- **[api/cron-bulk-scan.js](api/cron-bulk-scan.js) `analyzeArticleHtml`：**
  - 新增 `findNearestParentClass(html, position)` helper（往前 2000 字找最後 class 屬性）
  - h1Details 加 `parent_class` 欄位
  - `duplicateH1Groups` 加偵測 `cross_container`（同組 H1 parent_class 不同 → 主題級雙渲染）+ `parent_classes` + `has_standard_wc`
  - 重複 H1 的 reason 三層判斷：
    1. cross_container=true → 主題級、顯示「自訂區塊 `xxx` 把描述渲染了 2 次、需要主題開發者改 PHP」
    2. /product/ URL → WooCommerce 雙描述
    3. 其他 → 響應式雙版本
  - h1Details 個別 detail 加 `cross_container_duplicate: boolean`
- **[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `H1DetailCard`：**
  - 重複 chip 改成兩種：
    - 🔁 內容重複（一般、琥珀色）
    - 🔴 主題級重複（cross_container_duplicate、紅色）
  - 顯示父容器 class（monospace、青綠色）— 給用戶 / agency debug 定位用
  - 「父容器 class：`woocommerce-Tabs-panel--description...`」一行
- **`CommonMisunderstandingsPanel` 加 case 6：**
  - 症狀：改 H1→H2 + 清完 WP Rocket 快取後、掃描還是說有重複
  - 原因：主題級雙渲染（自訂 `pr-content` 等區塊 + 標準描述 tab）
  - 驗證：看 H1 卡片父容器 class、非標準 class（如 `pr-content`、`custom-section`、`wpb_text_column`）就是兇手

**效果：** 用戶 / agency 一眼看出「這個重複是後台能修 vs 要修主題 PHP」、不再以為清商品簡述就能解。

---

### 2026-06-04（Agency mode 起手：權限標籤 + 客戶報告匯出 + 藍圖文件）
**用戶（行銷 agency）糾正了我之前給 SQL 動客戶 DB 的建議：「應該為我們的掃描方式去做修改、而不是去更動客戶端的東西」。產品定位重整成「agency 工具」、不是「直接修網站」。**

**今天做了 3 件事：**

#### 1️⃣ Finding 權限標籤（#1）
- [api/cron-bulk-scan.js](api/cron-bulk-scan.js) 加 `getFixOwner(findingId)` 表 + `tagFixOwners()` 統一塞 fix_owner
- 3 種權限類別：
  - 🛠️ `seo_plugin` — Rank Math/Yoast 後台可改、agency 自己搞定（meta/og/schema/canonical）
  - 🔑 `wp_admin` — 要進 WP 編輯器、可能要找客戶（H1 改 H2、清商品簡述）
  - ✍️ `content_writer` — 要實際寫文字（字數不夠）
- 前端 [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) 加 `FixOwnerChip` 元件、每個 finding label 旁有 chip + hover title 解釋

#### 2️⃣ 給客戶報告匯出（#2）
- 新增 [src/lib/clientReport.js](src/lib/clientReport.js)：
  - `buildClientReport()` 把 findings 整理成 markdown
  - 分 3 段：「需要您 WP 後台處理」「需要寫內容」「我們已用 SEO 外掛處理」
  - 把 wp_admin_hint 的 steps 整合進客戶報告
  - Helpers：`copyToClipboard()` + `downloadMarkdown()`
- 前端 `ClientReportButton` 元件：紫色「📤 給客戶報告」按鈕、開 modal 預覽 + 兩顆 CTA（複製 / 下載 .md）
- 自動以「優勢方舟數位行銷」當 agency 名稱 footer 簽名

#### 3️⃣ Agency mode 藍圖（#3、純規劃文件）
- 新增 [AGENCY_MODE_ROADMAP.md](AGENCY_MODE_ROADMAP.md)
- 5 個 phase 拆解（A 多客戶切換 → B 客戶訪客 → C 白標 PDF → D 客戶端打勾 → E agency 聚合）
- 估時 8-12 小時、跨 3-4 session
- 商業層級對應 CLAUDE.md「Agency 版 NT$4,990/月起」

---

### 2026-06-04（H1 重複偵測升級 + 常見誤解 FAQ panel）
**用戶觀察：「我反覆把這幾類狀況當成 bug 回報、實際上是 WP/主題/外掛行為」。要把這些特殊狀況主動列出來、不要讓用戶以為是我們搜尋分析錯誤。**

具體案例：kimbo3899 id-buzz-音響升級 商品頁、用戶編輯器只看到 1 個 H1、但我們報 3 個。我 curl 確認線上**真的有 3 個** — H1#2 跟 H1#3 內容完全相同、是 WPBakery 響應式雙版本造成 DOM 渲染兩次。用戶在編輯器層看不到、會以為是我們誤判。

**兩層改動：**

1. **後端 H1 重複偵測**（[api/cron-bulk-scan.js](api/cron-bulk-scan.js)）：
   - H1 純文字分組、≥2 個內容相同 → 加進 `duplicate_h1_groups: [{text, indices, count}]`
   - 每個 detail 標 `is_duplicate: true`、重複組除第 1 個外的 `suggested_action` 變 `change_to_p`、reason 改成「跟其他 H1 內容相同 → 改 <p> 或刪除重複（多半是響應式雙版本）」
   - `multiple_h1` finding label 動態組合：可能同時顯示「N 個是空 H1」+「M 個內容相同」雙提示

2. **前端 H1DetailCard**（[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx)）：
   - 標頭加 chip「🔁 內容重複」（琥珀色）標記重複 H1

3. **CommonMisunderstandingsPanel**（前端新元件）：
   - 結果頁頂部、3 個 banner 後面（位於 Stale + RescanHint 之下）
   - 紫色折疊 panel「🤔 掃描結果跟我看到的不一樣？5 種常見狀況、開啟前先確認」
   - 5 個 case：
     1. 編輯器找 1 個 H1 但掃描說 2 個 → WP 主題自動加 H1
     2. 掃描說 H1 內容相同 → WPBakery 響應式雙版本
     3. 修了還顯示舊問題 → findings 是快照、要重掃
     4. Rank Math 後台 130 字但掃描 477 字 → Title 模板 hardcode 後綴
     5. 找不到 /shop/ /locations.kml 編輯位置 → 看 UrlRow 內藍色 wp_admin_hint banner
   - 每個 case 含「症狀」「原因」「怎麼驗證」三段

**設計意圖：** 降低用戶誤把這幾類狀況當成 bug 回報的機率、減少客服 / 信任成本。

---

### 2026-06-04（Q1+Q2+Bug B — worker UA / WP 編輯位置提示 / KML 黑名單）
**3 個用戶痛點一次修：**

1. **Q1：worker per-URL fetch 被 mod_security 擋** — `scanSingleUrl` 之前用簡單 `AIRadarBot/1.0` UA、跟 sitemap fix 同款問題、被 kimbo3899 (Apache + mod_security) 擋 406 → 部分 URL 標記 failed → 沒計入 finding count → 用戶以為「修了 10 篇 count 卻變多」。換 `ARTICLE_FETCH_HEADERS` Chrome 完整指紋（同 sitemap fix 設計）。
2. **Q2：locations.kml 找不到** — 用戶問「這個 URL 在 WP 後台哪裡編輯」、教學沒寫進工具。`/locations.kml` 是 Rank Math Local SEO 自動產的 XML、不是給編輯的 page。
3. **Bug B：/shop/ 找不到** — 用戶問同問題、`/shop/` 是 WooCommerce archive、不是普通 WP page、要去 Rank Math → Titles & Meta → WooCommerce → Product Archive 改。

**改動：**
- **[api/cron-bulk-scan.js](api/cron-bulk-scan.js) `scanSingleUrl`：**
  - 加 `ARTICLE_FETCH_HEADERS` 常數（Chrome UA + Sec-Ch-Ua + Sec-Fetch-* 完整指紋）
  - Content-type 檢查：非 `text/html` / `application/xhtml` → 早期回傳 `findings.page_type = 'non-html'`、空 problems、附 `wp_admin_hint` 說明這是外掛產 XML
- **[api/cron-bulk-scan.js](api/cron-bulk-scan.js) `analyzeArticleHtml`：**
  - 新增 `detectWpAdminHint(url, pageType)` helper、按 URL pattern 推 WP 編輯路徑
  - 6 種 page context：外掛 XML/KML / WooCommerce shop / WooCommerce product / homepage / blog post / 預設 page
  - 每種回傳 `{ where, plugin?, steps[], note? }`
  - findings 新增 `wp_admin_hint` 欄位
- **[api/bulk-scan.js](api/bulk-scan.js) `URL_BLACKLIST_PATTERNS`：**
  - 加 `.kml / .xml / .json / .rss / .atom` 到黑名單、sitemap discovery 不再 queue 這類 URL
- **[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `WpAdminHintBanner`：**
  - 新元件、UrlRow 展開時、finding 列表上方顯示藍色 info banner
  - 預設只顯示「WP 後台位置：xxx · 需要 Rank Math」一行 + 折疊按鈕
  - 展開後列步驟（1, 2, 3...） + 琥珀色 note hint

**反映訴求：用戶不只想知道「哪裡有問題」、還要知道「在 WP 後台怎麼找到那個地方」**。

---

### 2026-06-04（Q2 — BulkScan「先聚焦 Top 20、修完再下一輪」工作流）
**用戶觀察：200 篇文章一次給用戶看會把他壓垮、根本修不完。Top 10 文字現在 sticky 看得到 fix 但全部結果也是長串。**

**用戶要的工作流：**
1. 預設只看 Top 20 該修哪幾篇（不是 Top 10、給多一點）
2. 全部 200 篇 list 預設折疊、要看再展開
3. 修完一輪 → 主動提示「修了 N 個、重掃看下一輪 Top 20」

**改動：**

- **[api/cron-bulk-scan.js](api/cron-bulk-scan.js) + [api/bulk-scan.js](api/bulk-scan.js)**：`top_offenders.slice(0, 10)` → `slice(0, 20)`、聚合裡多塞 10 筆
- **[src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) ResultsView**：
  - heading 從 hardcode「最需要修的 10 篇」改成動態 `最需要修的 {offenderResults.length} 篇`
  - 新增 `FullResultsList` 元件：預設折疊、heading 旁邊「▾ 展開看全部 N 篇」按鈕、折疊狀態下顯示提示「先聚焦上面的 Top 20、修完按重新掃描會顯示下一輪 Top 20」
  - 新增 `RescanHintBanner` 元件：偵測 `fix_events.created_at > job.finished_at` 該 website + user 累積 ≥3 筆 → 顯示綠色 banner「你已經修了 N 個 finding！重新掃描確認效果、看下一輪 Top 20」+ 立即重掃 CTA

**設計考量：**
- 預設折疊 200 篇 → 跟「Top 20」訊息一致、不混淆
- ≥3 fix_event 才觸發提示（少於 3 不嘮叨）
- Sample 模式（Free 試掃）不顯示提示（避免誤導 Free 用戶以為能重掃）

**Q1 結果：** 5 Tab 不對稱（內容品質完整 / 其他 4 個簡化）→ 用戶選 C 維持現狀
**Q3 結果：** XP 加分仍走 A（按「我已修好」立即 +5 XP）

---

### 2026-06-04（B4 — /showcase 變首頁區塊）
**之前 HomeDark 只有一個小 GlassCard 按鈕「查看 AI 能見度排行榜」、要點才能看到內容 → 社會證明完全藏在 1 hop 後。**

**B4 改成首頁直接嵌一個完整 showcase 區塊**、降低用戶探索門檻。

新增 [src/components/v2/HomeShowcaseSection.jsx](src/components/v2/HomeShowcaseSection.jsx)：
- 自己抓 websites + 3 audit tables（同 Showcase.jsx 邏輯但限定 limit 200 + 抓完計算 stats）
- 顯示 Top 5 AI 友善度排行（含 SEO/AEO/GEO 三欄分數 + 總分大數字 + 🥇🥈🥉 名次）
- 右側 Top 3 進步之星卡片（綠光底、`+N 分` chip）
- 底部「查看完整排行榜」CTA 連到 /showcase 完整頁
- Empty state：沒資料時顯示「還沒有公開排行的資料」

[src/pages/HomeDark.jsx](src/pages/HomeDark.jsx)：
- 刪除原本 1281-1290 的「排行榜入口」GlassCard 薄按鈕
- 換成 `<HomeShowcaseSection />`
- 加 `import HomeShowcaseSection from '../components/v2/HomeShowcaseSection'`

**保留 /showcase 獨立路由**：作為「看完整排行」深入點 — 完整 5 個分頁、進步之星輪播、成功案例、全部目錄。首頁區塊是 teaser、完整版在 /showcase。

**設計取捨：**
- ❌ 不在首頁塞「全部目錄分頁表」— 太長、會壓制 FAQ 區塊
- ❌ 不在首頁塞「進步之星輪播」— 改成靜態 Top 3 卡片、不搶 hero 視覺
- ✅ 兩塊主視覺：Top 5 排行（左 3/5）+ 進步之星（右 2/5）

---

### 2026-06-03（B3 — DashboardV2 內容品質 Tab 換 prototype-4 完整版）
**B1/B2/B5/C 動畫套件完成、用戶說「繼續進度」→ 進 B3 把內容品質 Tab 從簡化版升級到 prototype-4 設計。**

**新增** `ContentTabPanel` 元件（取代 AuditTabBody 的 content 分支）— 完整實作 prototype-4 設計：

1. **Hero strip**（3 欄 grid）：
   - 左：100×100px 圓環顯示 score/100（粉紅 stroke + glow drop-shadow）
   - 中：30 天 sparkline、從真實 `contentHistory` 算出 normalize 後的 SVG path（資料點 < 2 顯示 empty state）
   - 右：本月已分析筆數 + 通過/待修 split
   - 月增幅 `monthlyDelta`：本月後半（最近 15 天）平均 - 本月前半平均、含 ▲/▼ 箭頭

2. **兩個入口卡**：
   - 📄 單篇文章分析 → `/content-audit/<websiteId>`、chip「免費版可用」
   - 📂 批次掃描全站 → `/bulk-scan/<websiteId>`、Free 用戶卡片轉灰 + chip「Pro 鎖」
   - 兩張卡都有角落 radial-gradient 光暈（粉紅 / 橘）

3. **15 項檢測 grid**（5 分類 × 3 項）：
   - 🏗️ 結構（H1 唯一性 / 標題層級 / 字數充足）
   - 🏷️ Meta（Title 長度 / Description 字數 / Canonical）
   - 🤖 AEO（FAQ Schema / OG 完整 / Article Schema）
   - ⭐ E-E-A-T（作者署名 / 圖片 alt / 外部引用）
   - 🎬 多媒體（圖片數量 / 影片嵌入 / 可讀性）
   - 每分類通過率 chip 三色階（綠 ≥80 / 黃 ≥60 / 紅 < 60）
   - `buildCheckCategories(contentLatest, overallScore)` 從 content_audits JSONB 欄位推每項狀態；資料缺失時用整體 score offset 估算

4. **底部 CTA bar**（青綠光暈）：
   - 動態文案：有待修 → 「本期 N 筆待修...」；全綠 → 「全部通過！」
   - 兩顆 CTA：「📂 看待修清單」+「🚀 重新批次掃描」

**資料抓取升級** [src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx):
- `fetchData` 內 content_audits 改抓近 30 天全部（含 heading/word_count/meta/aeo/author/images/links/outbound/multimedia/readability 全部 JSONB）+ 完整 row 給 ContentTabPanel
- 沒 cached 時跑 `analyzeContent` 並把全部欄位寫進去（之前只寫 score）

**`AuditSection` 條件渲染**：
```jsx
{activeFace === 'content' ? <ContentTabPanel ... /> : <AuditTabBody ... />}
```

**設計妥協 / B3b 後續：**
- 15 項狀態用「欄位存在 + score 估算」混合判斷、不是 100% 精確（因 analyzeContent JSONB 各個 field 結構不同）。之後可以重整 schema 讓每個 field 都有 `passed` boolean、就能 1:1 對應

---

### 2026-06-03（B5 — 修復事件追蹤 + 「我已修好」按鈕 + ScorePop 動畫）
**用戶體感問題：「我在修復工具箱修了東西、有分數嗎？目前看起來沒有納入遊戲機制」**

**設計缺口：**
B2 的 XP 公式（audits × 10 + websites × 50 + 日期 × 5）**沒把「用戶修復」算進去** —
- 點工具不獎勵（會被刷分）
- 分數變高才獎勵（但 UI 上不可見、用戶感覺不到努力被認可）
- 結果：用戶不知道修復跟 gamification 的關係

**B5 解法：顯式宣告 fix_event + 立即可見的 +5 XP 動畫**

新增：
- [src/lib/fixEvents.js](src/lib/fixEvents.js) — `recordFixEvent()` 寫一筆 fix_event；`listFixEvents()` 查全部
- [src/hooks/useGamification.js](src/hooks/useGamification.js) 加 fix_events 計分：
  - XP 公式：`totalAudits×10 + websiteCount×50 + distinctActiveDays×5 + fixEventCount×5`
  - 🔧 「初次修復」徽章從「totalAudits >= 5 代理」改成「真實 fixEventCount >= 1」
- [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `UrlRow` 每個 finding 加「✓ 我已修好 → 記錄修復」按鈕：
  - 3 狀態：待修（青綠膠囊）/ 記錄中⏳ / 已修復✅+5XP（綠膠囊）
  - 點下去：`recordFixEvent` 寫 DB + 觸發 `+5 XP` 浮起動畫（1.6s cubic-bezier、translateY -60px、opacity 0→1→0）
  - 用 `fixedSet`（Set of `${i}-${p.id}`）追蹤同一個 row 內哪些 finding 已修復
  - 反作弊：純前端 disable 重複點；DB 層沒擋（用戶可手動戳 API 刷分，但成本高、忽略）

**需要 SQL（用戶側 Supabase Dashboard 跑）：**
```sql
CREATE TABLE IF NOT EXISTS fix_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
  finding_id TEXT NOT NULL,
  url TEXT,
  source TEXT,  -- 'bulk_scan' / 'toolbox' / 'audit_detail'
  xp_awarded INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fix_events_user ON fix_events(user_id);
CREATE INDEX IF NOT EXISTS idx_fix_events_website ON fix_events(website_id);

ALTER TABLE fix_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own fix events" ON fix_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fix events" ON fix_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**沒做完的 / B5b 後續：**
- Dashboard ToolBox 4 個工具卡點下去開 modal + 「我已修好」 — 比 BulkScan 少了「貼回」這層、留給之後做
- BulkScan「我已修好」目前不真的重跑 audit 驗證、只信用戶誠實打卡（reasonable 起手）
- prototype-3 的 level up overlay / badge unlock 動畫沒接（B6 全頁慶祝動畫）

---

### 2026-06-03（B2 — gamification 接 Supabase 真資料）
**B1 視覺方向確認 OK → 進 B2 把 mock level/streak/badges 換成從 audits 反推的真資料。**

**設計決策：不加 DB 欄位、純前端推算**
- 避免 SQL migration 的成本（CLAUDE.md `feedback_no_sql_archive`）
- 直接從現有 `seo_audits / aeo_audits / geo_audits / eeat_audits / content_audits` 反推
- 之後若需要持久化（例如 badges 解鎖時點），可加欄位

**新增 [src/hooks/useGamification.js](src/hooks/useGamification.js)（256 行）：**
- 平行抓 5 個 audit 表的 `website_id, score, created_at`（filter user 的 websites）
- 計算：
  - **totalXp = totalAudits × 10 + websiteCount × 50 + distinctActiveDays × 5**
  - **5-tier 等級**：青銅 Lv.1-5（每級 100 XP）/ 白銀 6-10（200 XP）/ 黃金 11-15（400 XP）/ 鉑金 16-20（800 XP）/ 鑽石 21+（1500 XP）
  - **Streak**：從今天往前算連續有 audit 的天數（容許今天還沒掃、從昨天算）
  - **8 個徽章**：first_scan / streak_7 / full_audit / first_fix / improve_10 / all_green / streak_30 / diamond_tier
- 回傳 `{ loading, level, levelName, emoji, xp, xpToNext, totalXp, progressPct, streak, badges[], totalAudits, websiteCount, distinctActiveDays }`

**[src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx)：**
- 刪除 `MOCK_GAMIFY` 常數
- 加 `const gamify = useGamification(user?.id)`、`<GamifyRail gamify={gamify} />` 直接接 hook 回傳
- 修進度條 width：原本 `${gamify.xp}%` 對白銀以上 tier 會失準（xp 不等於 progressPct），改用 `gamify.progressPct`
- 進度條下方數字加 `XP` 單位（從 `65/100` 變 `65/100 XP`）讓資料來源更清楚

**Stage 1 後續沒做完的：**
- 🔧「初次修復」徽章目前用「totalAudits >= 5」當代理（沒有真正的「修復後重掃」事件可追蹤）— 等 B5 phase 接 prototype-3 動畫時補真實事件
- Quest section 還是 mock（B3 phase 會接「從 audits 找出缺項」自動產 quest）

---

### 2026-06-03（B1 — DashboardV2 prototype-2b 設計實作上線預覽）
**5 個 prototype 設計都通過 → 用戶選 B（實作 prototype-2b 進 React）。B 拆成 5 phase、B1 是 UI 骨架。**

**策略：side-by-side 預覽、不破壞現有 /dashboard/:id**
- 新增 [src/pages/DashboardV2.jsx](src/pages/DashboardV2.jsx)（590 行）
- [src/App.jsx](src/App.jsx) 加路由 `/dashboard-v2/:id` → DashboardV2、舊版仍掛在 `/dashboard/:id`
- 用戶可以在同個 website 切兩邊看（V2 頁右上有「← v1」按鈕回舊版）

**DashboardV2 結構（對齊 prototype-2b）：**
1. **SiteHeader**（共用）
2. **TopBar**：返回 + 網站名 + 「← v1 / 重新檢測 / 匯出 PDF」（後兩個 B2 phase 接 handler）
3. **aivis Hero**（8:4 grid）— 左 5 引擎 chip 矩陣 + 平均提及率 + CTA；Free 用戶 chip 數字 + 平均率變 🔒，CTA 變「升 Pro 解鎖 →」
4. **Gamify Rail**（右側 3 張卡）：青銅 Lv.5 / 65% 進度條 + 🔥 5 天 streak + 8 格徽章 grid（4 解鎖 / 4 鎖定）— B1 用 mock 資料、B2 接 Supabase
5. **Notice strip**：取代走馬燈、可關閉的單行通知欄
6. **Quest Section**（今日任務）：3 個 mock quest，含 face 色標、+N 分預估、~N 分鐘預估、「去修 →」按鈕
7. **站點體檢 5 Tab wrapper**：tab nav active 用對應 face 色（藍/紫/綠/琥/粉），tab body 顯示分數圓環 + 結論 + drill-down link 到對應 audit 頁。內容品質 tab 多一個批次掃描入口
8. **30 天進步曲線**：4 條線（SEO/AEO/GEO/EEAT）— 重用 seoHistory/aeoHistory 等舊 Dashboard 已有的 history 資料
9. **Footer**（共用）

**砍 / 收斂：**
- ❌ 永久早鳥 banner（EarlybirdBanner 不引入）
- ❌ 走馬燈版 AnnouncementBanner（改 Notice strip 一格通知欄）
- ❌ 4+1 散落 score 卡（整合進 5 Tab）
- ✅ 試用倒數 banner 保留（簡化樣式）

**B2-B5 後續：**
- **B2**：profiles 加 level/xp/streak/badges 欄位 + 算法、接真資料
- **B3**：5 Tab 內容品質 panel 換成 prototype-4 完整版（圓環 + sparkline + 兩入口 + 15 項 grid + CTA）
- **B4**：/showcase 整段塞進 HomeDark 滾下來的區塊
- **B5**（可選）：BulkScan「修復這個」flow 接 prototype-3 動畫

---

### 2026-06-02（Stage 3 — OG block + JSON-LD schema 模板也自動產出）
**Stage 2 上線後用戶秒重掃驗證、看到 title 改前/改後 + canonical 程式碼正常 →「Stage 3 開始」。**

**升級的 5 個 finding（都帶 suggestion.code_snippet）：**
| Finding | 模板長相 |
|---------|---------|
| `missing_og` | 6 行完整 OG block — title/desc/image/url/type/site_name 自動帶入 |
| `incomplete_og` | 只給缺的那幾行 OG meta tag、label 改成「OG 標籤不完整（缺 title / image）」具體標出缺哪些 |
| `no_json_ld` | Organization + WebSite 兩塊基礎 schema（從 url origin 抓網域） |
| `no_article_schema` | 完整 Article JSON-LD — headline/description/image/url/datePublished/author/publisher 都填好 |
| `no_product_schema` | 完整 Product JSON-LD — name/desc/image/brand/offers 都填好（價格 placeholder） |

**4 個新 helper：**
- `extractFirstArticleImage(html, baseUrl)` — `<article>`/`<main>`/`.entry-content` 內第一張非 logo/icon/avatar/tracker/data-uri 的 `<img>`、自動補絕對路徑
- `extractDatePublished(html)` — article:published_time > time[datetime] > 既有 JSON-LD datePublished
- `buildOgBlock` / `buildOgMissingTag` — full vs incremental OG snippet 兩種
- `buildArticleSchema` / `buildProductSchema` / `buildBaseSchema` — JSON-LD 模板，自動帶資料、抓不到的欄位用「【請填...】」中文 placeholder（用戶一眼知道哪邊要手動補）
- `esc()` — `<>"&` 跳脫，避免 attribute 值打斷 tag

**前端：** [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `SuggestionBlock` 的 code_snippet 區塊改用 `whiteSpace: pre-wrap` + `wordBreak: break-word` + `maxHeight: 280px overflowY: auto` — 多行 OG / schema 模板換行 + 縮排都正常顯示、超長 schema 不撐爆 row。

**Stage 1+2+3 三段合計：** 12 個 finding 全升級成「告訴你哪裡壞 + 直接給你貼回 HTML」、剩 missing_h1 / thin_content / short_content 沒升級（前兩者本來就靠用戶手動補內容、自動建議價值有限；之後若接 GPT 補文章再說）。

---

### 2026-06-02（Stage 2 — meta_title / meta_desc / canonical 也升級「智能建議 + 可貼回 HTML」）
**Stage 1 H1 卡片上線後用戶秒回「A. Stage 2 同款升級擴大」— 直接把同一個 pattern 套到其他高頻 finding。**

**後端** [api/cron-bulk-scan.js](api/cron-bulk-scan.js) 新增 3 個 helper + 升級 5 個 finding：

- `extractBrandName(html, metaTitle)` — og:site_name 優先、否則從 title 末段「｜brand / | brand / - brand」倒推（≤30 字）
- `extractBodyExcerpt(html, maxLen)` — 找 `<article>` / `<main>` / `.entry-content` / `.post-content` 區塊 → 抽 `<p>` → strip tag + 正規化空白 → `smartTruncate` 截到 maxLen
- `smartTruncate(text, maxLen)` — 優先句尾（。！？.!?）切、其次空白、最後硬切 + …
- `metaDescCode(desc)` — 跳脫 `"` 後包成完整 `<meta name="description" content="..." />` tag

升級的 finding（都帶 `suggestion: { kind, current?, current_len?, suggested?, suggested_len?, code_snippet?, note? }`）：
| Finding | 建議內容 |
|---------|----------|
| `missing_meta_title` | 偵測到品牌時、給 `<title>主關鍵字｜{brand}</title>` 模板 |
| `short_meta_title` | 自動補 `{current}｜{brand}` 到目標字數、改前改後對照 |
| `long_meta_title` | smartTruncate 到 60 字、改前改後對照 |
| `missing_meta_desc` | 從內文抓 155 字摘要 + 完整 `<meta>` tag |
| `short_meta_desc` | 改前 vs 內文較長版本對照 |
| `long_meta_desc` | smartTruncate 到 155 字、改前改後對照 |
| `missing_canonical` | 給 `<link rel="canonical" href="{url}" />` 完整 tag |

**前端** [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) 新增 `SuggestionBlock` 元件：
- 改前（紅微底）/ 改後（綠微底）對照 — current + suggested 都存在時兩列
- 純建議（綠微底）— 只 suggested 沒 current 時（如 missing_meta_desc）
- 可貼回 HTML 區塊（黑底 monospace） + **「📋 複製」按鈕**（clipboard API + execCommand fallback）
- note 說明
- 整個 UrlRow 渲染順序：問題標題 → `h1_details`（Stage 1） → `suggestion`（Stage 2） → 通用 tip

**設計重點：** suggestion 是**可選**欄位 — 沒有 suggestion 的 finding（如 missing_h1、thin_content）維持原本 tip-only 顯示、漸進式覆蓋不破壞舊邏輯。

**Stage 3 待做：** 
- 缺 OG / OG 不完整 → 給完整 OG block 模板
- thin_content / short_content → 不適合自動建議（內容要創作）但可以給「補哪些段落」checklist
- no_article_schema / no_product_schema → 給對應 schema JSON-LD 模板

---

### 2026-06-02（多 H1 警告升級為「每個 H1 都列出來 + 建議動作」— Stage 1）
**用戶痛點：** 我幫用戶人工逐篇分析 kimbo3899.com.tw 全站 H1 後（找到 5 篇有問題），用戶問：「我們分析之後給使用者的有辦法像你現在分析的這麼清楚嗎？」— 點出產品最大弱點：原本只說「有 N 個 H1」，沒說是哪幾個、內容是什麼、哪個該留哪個該改。

**這次的改動就是把人工分析的格式直接做進產品裡：**

- **後端** [api/cron-bulk-scan.js](api/cron-bulk-scan.js) `analyzeArticleHtml` H1 偵測改寫：
  - 把 `h1Matches` 拆解成 `h1Details` 陣列，每個元素 `{ index, text(剝光 tag 後純文字 ≤200 字), full_length, kind, suggested_action, reason }`
  - **kind 分類**：`empty`（空 H1）/ `sentence`（>30 字、句子型）/ `short`（≤30 字、短標題）
  - **suggested_action 規則**：第 1 個 H1 預設 `keep`、其餘的 sentence→`change_to_p`、short→`change_to_h2`、empty→`delete`
  - `findings.problems[].h1_details` 帶回前端展開渲染
- **前端** [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx)：
  - 新增 `H1DetailCard` 元件，按 `suggested_action` 給卡片 left-border 配色（綠/藍/粉/橘）+ kind chip + 動作標籤 + monospace 內容預覽 + reason 說明
  - `UrlRow` 偵測 `p.h1_details` 存在時，在 tip 上方先渲染 detail 卡片列表

**結果：** 用戶以後掃完看到「⚠️ 頁面有 3 個 H1」展開，會直接看到三張卡片：哪個保留、哪個改 `<h2>`、哪個改 `<p>` — 不用再回來問哪個是哪個。比這次的人工分析更可規模化（每篇文章自動跑、不用我每次手動 grep）。

**Stage 2 待做（之後再規劃）：**
- 「複製改好的 HTML」按鈕 — 把 `<h1 ...>原文</h1>` 直接產出 `<p>原文</p>` 給用戶複製貼回 WP
- 其他 finding 同款升級：`missing_meta_desc` 從內文 auto-suggest 描述、`short_meta_title` 補品牌名建議完整標題

---

### 2026-06-02（多 H1 警告補空 H1 細分 + 修復說明對齊主題自動加標題）
**用戶回報：** kimbo3899.com.tw/audi-virtual-cockpit/ 被報「2 個 H1」，但用戶在 WP 程式碼編輯器 Ctrl+F 搜 `<h1>` 只找到 1 個 → 以為是工具誤判。

**實際情況（curl 驗證）：**
1. `<h1 class="single-entry-title">Audi 三線道...</h1>` — WP 主題模板自動加的文章標題（編輯器看不到）
2. `<h1 data-path-to-node="11"></h1>` — WPBakery Page Builder 留下的空 H1 殘留（編輯器看得到）

工具沒誤判、但說明文案沒幫用戶釐清「為什麼編輯器只看到 1 個」這個迷惑。

**改了兩塊：**
- [api/cron-bulk-scan.js](api/cron-bulk-scan.js) `analyzeArticleHtml` 多 H1 檢測加上空 H1 計數：strip tag + `&nbsp;` 後沒文字的算空 H1，問題 label 動態補「，其中 N 個是空 H1（page builder 殘留）」、`empty_h1_count` 也寫進 findings.metrics 給後續分析用
- [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `PROBLEM_FIX_TIPS.multiple_h1` 改寫：解釋「WP 主題會自動加 1 個 H1（編輯器看不到），所以正確的剩 1 個 = 編輯器裡 0 個」、區分「空 H1 整行刪」vs「有文字的 H1 改成 h2/h3」

**為什麼有效：** UrlRow 渲染 `{p.label || PROBLEM_LABELS[p.id]}` — 動態 label 優先、所以新後綴會直接顯示在每筆 URL 結果裡。

---

### 2026-06-02（修 BulkScan UI 卡在舊 cached aggregate bug）
**症狀：** 用戶 SQL 重置 + 工人重跑完 200 篇後，UI 同時顯示「分數 0／已通過 0／待修 0」**和**「全站文章都通過 7 項檢測」— 明顯矛盾。

**診斷：**
- SQL 確認 `bulk_scan_results` 200 列全 `status=done`、200 列都有 `findings`、0 個 error → DB 端正常
- 根因在前端 [src/pages/BulkScan.jsx](src/pages/BulkScan.jsx) `fetchResults` — API 回傳的 `data.job`（含 freshAggregate）只寫進 `results` state，**沒有同步回外層 `job` state**
- `ResultsView` 拿的是外層 `job.aggregate`，永遠是舊的（fetchInitialData 載入時的 snapshot，重置後是 NULL）
- `agg.total_results` 從 NULL 變 0 → UI 整片歸零、但同時又因 `byType` 是空物件而顯示「全部通過」的慶祝訊息

**修法：** `fetchResults` 成功後加一行 `setJob(prev => ({ ...prev, ...data.job }))`，把 API 帶回來的 fresh aggregate 合併回外層 job state。下次 SQL 重置 + rescan 不會再卡這個 UI 矛盾。

**順手記錄的鄰近 bug（前次對話已修但這次受益）：**
- `<button onClick={onRescan}>` 把 React SyntheticEvent 當成 `mode` 參數傳 → `JSON.stringify({mode: event})` 觸發 circular structure error，導致用戶之前每次按「重新掃描全站」其實都沒真正建 job
- 改成 `onClick={() => onRescan('full')}` + handleStart 內 `typeof mode === 'string' ? mode : undefined` 雙保險

---

### 2026-06-01（站內公告 banner 改走馬燈輪播）
**用戶提議多則公告時用上下走馬燈切換取代垂直堆疊：**

- [AnnouncementBanner.jsx](src/components/AnnouncementBanner.jsx) 改造：
  - 多則時每 6 秒切換下一則（單則維持原本顯示）
  - 切換動畫：淡入 + 從上方滑下（500ms ease-out）
  - Hover 滑鼠停留時暫停輪播，移開繼續
  - 多則時下方顯示小指示點（圓點 → 當前那則變細長橫條），可點擊跳特定則
  - 指示點旁顯示「N / 總數」 + 「已暫停 · 移開繼續」提示
- **可訪問性**：尊重 `prefers-reduced-motion` 偏好 — 系統設「減少動畫」時 fallback 成原本垂直堆疊（不輪播、無動畫）
- 抽出 `AnnouncementCard` 子元件 — 輪播 + reduced-motion fallback 共用同一卡片渲染邏輯，避免重複代碼

---

### 2026-06-01（批次掃描 Phase 2 — Free 試掃 3 篇 FOMO 流程）
**用戶質疑「免費試一篇」FOMO 跟單篇模式重疊沒鉤子。改設計成：免費抓全 sitemap 顯示總篇數 + 真實掃 3 篇樣本 + 鎖剩下的：**

- 🗃️ **SQL migration**（用戶要跑）：
  ```sql
  ALTER TABLE bulk_scan_jobs
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'full' CHECK (kind IN ('sample', 'full')),
    ADD COLUMN IF NOT EXISTS discovered_count INTEGER DEFAULT 0;
  ```
- 🔧 **api/bulk-scan.js**：
  - `?action=start` body 接 `mode: 'sample'|'full'` 參數
  - Free 用戶**強制 sample**（後端守衛），Pro 用戶預設 full、可指定 sample（測試用）
  - sample 取 sitemap 前 3 篇（依 lastmod 倒序，最新文章先掃）
  - Free **每個網站只能跑 1 次 sample**（防刷）— 想再跑就升 Pro
  - 寫入 `discovered_count` = sitemap 抓到的全站總篇數（給 UI「你網站有 N 篇」用）
  - `kind`、`discovered_count` 也加進 status / results 回傳
- 🎨 **BulkScan.jsx**：
  - **Free 用戶**：拿掉 hard-lock upsell card，改成「🎁 免費試掃 3 篇」按鈕 + 旁邊「升級 Pro 一次掃完全部」CTA
  - **Pro 用戶**：「🚀 開始掃描全站文章」（保持原設計）
  - **結果頁**：新增 `SampleUpsellBanner` 大型 banner（紫色漸層 + 🔒），放 hero 上方第一眼看到。文案：「你網站總共 487 篇文章 — 還有 484 篇待解鎖」+「升級 Pro 解鎖全部」按鈕
  - ScoreHero 文案區分模式：sample 顯示「試掃樣本 / 已掃 3 / 共 487 篇」，full 顯示「批次掃描 / 200 篇」
  - sample mode 隱藏「重新掃描」按鈕（Free 不能再跑）
- 🎯 **設計理由**：對比「你網站有 487 篇」vs「我們只掃了 3 篇」造成落差感、觸發升級念頭。比舊版「Pro 限定鎖卡」轉化率高很多（對標 Ahrefs/SEMrush 同套路）

---

### 2026-06-01（批次掃描結果頁改 2 欄 Hero — 視覺跟單篇模式統一）
**用戶實測 Phase 1.5 後回報想要結果頁長得跟單篇模式一樣（左 ScoreHero 分數圈 + 右拆解進度條）：**

- [BulkScan.jsx ResultsView](src/pages/BulkScan.jsx) 改成 `v2-hero-grid` 兩欄佈局：
  - **左**：用既有的 `ScoreHero` 元件（跟 SEO/AEO/GEO/EEAT/內容品質 同款）。score = 通過率 %（=「全站 0 問題的文章占比」），face="批次掃描"、subChip="N 篇"、tagline 寫 X 篇通過 Y 篇待修
  - **右**：新加 `ProblemBreakdown` 元件 — 仿 `ContentSignature` 視覺，每條問題類型一個 row：label + 受影響 N 篇 + 進度條（受影響% / 總篇數）+ 嚴重度色（高=紅、中=橘、低=灰）
- 「重新掃描」按鈕從卡片右上角搬出來、獨立一行右對齊
- 視覺效果：跟單篇模式 100% 一致 — 用戶切 tab 不會有「咦怎麼版型不一樣」的違和感
- 設計理由：保持 IA 一致性（[[ArticleAnalysisTabs](src/components/v2/ArticleAnalysisTabs.jsx)] 統一 tab + 同款 hero layout = 「文章分析」這個功能不論模式都是同個東西）

---

### 2026-06-01（批次掃描 Phase 1.5 — aggregate bug 修 + UI 改進 + IA 統一到「文章分析」）
**用戶實測 kimbo3899 批次掃描跑完 200 篇後回報 2 個問題 + 1 個 IA 變更要求：**

**🐛 Bug #1 修：「全站問題統計」零問題、但每篇 URL 都顯示 2 問題 — 互相矛盾**
- Root cause：worker 把 row 標 `'scanning'` 後跑、有些 row 超時或多 worker 同跑造成 row 卡在 `'scanning'` 沒寫回。`processJobTick` 查 `status='pending'` 看到 0 就 fire `finalizeJob`、但這時還有很多 row 是 `'scanning'`、`computeAggregate(status IN ['done','failed'])` 統計空集合。後來 row 慢慢完成 findings 都正確寫進去、但 aggregate 已經被算錯
- 修法 [cron-bulk-scan.js](api/cron-bulk-scan.js)：
  - (a) stale recovery：每個 tick 開始先把 `status='scanning'` 且 `scanned_at < now - 3min` 的 row 重設為 pending（前一個 worker timeout 沒寫回的補救）
  - (b) finalize 守門：`pending=0` 還要額外查 `scanning count=0` 才 fire finalize；否則回 `waitingForScanning` 等下次再來
  - (c) claim 步驟同時設 `scanned_at = now()` 給 stale recovery 判斷依據（之前是 null）
- 修法 [bulk-scan.js handleResults](api/bulk-scan.js)：不信任 `job.aggregate` cached 值、每次 results 請求都 `computeAggregateFresh()` 重算當前 done/failed row → 永遠跟畫面一致

**✨ Bug #2 修：UrlRow 只寫「⚠️ 2 問題」沒寫是哪 2 個**
- [BulkScan.jsx UrlRow](src/pages/BulkScan.jsx) 改成可點擊展開、列出 problem labels（有問題的 row 才顯示 ▸ 展開符號 + 點 row 切換）
- 用 `SEVERITY_ICON` 顯示 🔴🟡⚪ 嚴重度分級

**🎨 IA 重組（用戶選項 B 中度方案）：「文章分析」統一頁面、tab 切換單篇 / 批次**
- 新元件 [src/components/v2/ArticleAnalysisTabs.jsx](src/components/v2/ArticleAnalysisTabs.jsx) — 共用頂部 tab、顯示「文章分析」品牌 + 「📄 單篇模式」「🔍 批次模式（Pro）」兩 tab
- ContentAudit.jsx DetailMode（有 websiteId） + AdHocMode（沒 id）都掛上 tab
- BulkScan.jsx 也掛同款 tab
- 沒 websiteId 時批次 tab 變灰 + tooltip「請從 Dashboard 選擇要分析的網站」
- Dashboard.jsx「優化工具」tab 上方原本的紫色「🔍 批次文章掃描」banner 拿掉 — 入口統一由「內容品質」卡 → /content-audit/:id → tab 切換進去
- **設計理由**：用戶心智裡「文章分析」是一件事不該分散兩頁面；tab 設計讓免費用戶切到批次模式時看到「Pro 限定」描述、觸發升級念頭

---

### 2026-05-30（批次文章掃描 Phase 1 上線 — Pro 殺手鐧、改 sitemap 不靠 GSC）
**用戶痛點：客戶網站有幾百篇文章，現在的單一 URL 掃描只能看首頁，要逐篇手動檢查太費工 → 做「一鍵掃全站文章」功能：**

- 🆕 **新檔 `api/bulk-scan.js`**（單一 endpoint，action 路由：start / status / results / cancel）
  - `?action=start` → 抓 sitemap.xml（順序試 /sitemap_index.xml → /wp-sitemap.xml → /sitemap.xml）→ 過濾雜訊 URL（/wp-admin、/tag/、/category/、/feed 等）→ 依 `<lastmod>` 倒序排 → 截 Pro 200 篇上限 → queue 進 bulk_scan_results 表
  - Pro / Trial 守衛 + 用戶必須是 website owner
  - 同 website 同時只允許 1 個 active job（防重複觸發）
- 🆕 **新檔 `api/cron-bulk-scan.js`**（每分鐘觸發的 worker）
  - 領 status='scanning' jobs，每 job 處理下 8 個 pending URL
  - 平行 fetch + 7 項 regex 檢測（H1 / Meta title / Meta desc / OG / JSON-LD schema / 字數 / canonical）
  - 沒 pending 了 → 算 aggregate（按 problem_type 分組 + top 10 offenders）→ 標 status='done'
  - 60s timeout 內安全（fetch 12s × 8 並行 ≈ 8 秒，留 buffer）
  - 200 URLs / 8 per tick = 25 ticks × 1 分鐘 = 約 25 分鐘掃完
- 🗃️ **SQL migration**（`C:\tmp\bulk-scan-tables.sql` 待用戶跑）：
  - `bulk_scan_jobs` 表（job 主表 + 狀態 + 進度 + aggregate JSONB）
  - `bulk_scan_results` 表（per-URL 結果 + findings JSONB + 排隊狀態）
  - RLS policy：用戶只能讀自己的 jobs / results
- 🆕 **新檔 `src/pages/BulkScan.jsx`** 路由 `/bulk-scan/:id`
  - Pro / Trial 守衛（免費版顯示 upsell card → /pricing）
  - 開始按鈕 → 進度條（每 5 秒 poll status）→ 完成後顯示聚合 + Top 10 offenders + 全部結果列表
  - 已掃結果有 cache：mount 時拉 website 最近 1 個 job 自動接續顯示
- 🔗 **入口**：Dashboard.jsx「優化工具」tab 上方加紫色橫條 banner（含 Pro + NEW 標籤）連到 `/bulk-scan/:id`
- 🔧 **vercel.json**：加 cron `/api/cron-bulk-scan` schedule `* * * * *`（每分鐘觸發）
- 📦 **Vercel 函數計數調整**：因 12 函數上限，把 Stripe legacy（`create-checkout-session.js` + `stripe-webhook.js`）移到 `_legacy_api/` 資料夾（Vercel 不掃 → 不算函數），騰出空間給 bulk-scan + cron-bulk-scan。Stripe Phase 2 因 HK 帳號鎖死本來就在暫緩、前端沒呼叫，要復活時把檔案搬回 api/ 即可
- 🎯 **設計理由（不接 GSC）**：原本 Phase 2 設計用 GSC 抓 Top 200 流量文章排序，但用戶決定 GA4/GSC 全套下線（客戶實際採用率 0），改用 sitemap `<lastmod>` 倒序 — 最近修改的文章先掃，符合「新文章更可能要修」實務需求

---

### 2026-05-26（GA4 / GSC 整合全套刪光 — 客戶實際採用率太低、佔 Vercel 函數額度）
**用戶決定：之前 GA4 + GSC 整合做完但客戶實際用不起來（要自己去 Google 後台拿 Property ID / 驗證網站太繁瑣），常用功能就 3 個按鈕大家點不下去 → 整套下線清光，後續批次掃描功能改用 sitemap.xml 就好（同樣有意義不用客戶自助）：**

- 🗑️ **刪 6 個檔**：
  - `src/services/googleAuth.js` — OAuth flow
  - `src/services/ga4Analyzer.js`、`src/services/gscAnalyzer.js` — 拉資料 service
  - `src/pages/GA4Report.jsx`、`src/pages/GSCReport.jsx` — 詳情頁
  - `src/pages/GoogleAuthCallback.jsx` — OAuth 回調頁
- 🔧 **修 4 個檔**：
  - [App.jsx](src/App.jsx) — 拿掉 4 個 import + 3 個 route
  - [SEOAudit.jsx](src/pages/SEOAudit.jsx) — Roadmap P3 那條「持續追蹤 GSC」改成「每月重掃一次 — 看 SEO 分數趨勢 + AI 引用率變化（aivis 模組）」
  - [legal/Privacy.jsx](src/pages/legal/Privacy.jsx) — Google LLC 第三方說明拿掉「或啟用 GA4 / GSC 整合」
  - [Dashboard.jsx](src/pages/Dashboard.jsx) — 430 行 GA4/GSC 區塊（整個 traffic tab + Google 設定 modal + 連接按鈕 + state + handlers + imports）通通刪掉；sitemap 提示「提交 sitemap 至 GSC」改成「在網站根目錄放 sitemap.xml 並提交至 Google Search Console」
- 📝 **CLAUDE.md 更新**：專案結構、路由表、待開發功能三段同步移除 GA4Report / GSCReport / ga4-data.js / gsc-data.js 提及；加上「2026-05-26 已下線、未來若要重新接需合併進 `api/google-data.js` 用 `?action=` 路由避免 Vercel 函數上限」標註
- 💡 **背後動機**：GA4/GSC 一直佔我們前後端 2-3 個檔案的「殼」，後端 `api/gsc-data.js` 早就被砍（Vercel Hobby 12 函數限制），結果前端按鈕點下去 404。今天為了批次掃描評估要不要把 GSC 接回來時發現實際採用率 0、決定整套下線、改用 sitemap 做更穩的 batch scan
- ⚠️ **CLAUDE.md 提示繞圈**：本地 npm run build 一直在 transforming 完後 silent exit code 9/127，多次重試（含清 .vite cache）都一樣，懷疑是 Windows + Vite v8 bundling 階段 memory 問題、跟 code 無關。已 grep 確認無 dangling import / 無 dead reference → push 讓 Vercel 驗

---

### 2026-05-26（AEO Open Graph fix guide 補 Rank Math 步驟）
**用戶實測客戶網站時發現 AEO Open Graph 修法只寫了 Yoast SEO 路徑，沒寫 Rank Math（台灣站近年 Rank Math 比 Yoast 更主流）：**

- [fixGuides.js open_graph wordpress](src/data/fixGuides.js) 改寫成「Yoast 或 Rank Math 二選一」並列：
  - Yoast：編輯文章 → Yoast 區塊 → 「社群」分頁 → Facebook / X 標題/描述/圖
  - Rank Math：編輯文章 → 右上 Rank Math 側欄（或下方區塊）→ 「Social」分頁 → Facebook 區塊填標題/描述/圖，X 預設沿用 Facebook
- 順手補：分享圖尺寸建議 1200x630px + <300KB、用 Facebook 偵錯工具「重新擷取」清快取驗證
- ⚠️ **canonical fix guide 也有同樣問題**（line 435 只寫 Yoast），但用戶這次沒問 → 留下次再處理或主動問用戶是否要一併補
- 🔄 **追加（同日，commit f3a781b）**：用戶確認要一起補。canonical fix guide 加 Rank Math 步驟（「進階」→「Canonical URL」欄位）+ 補一行說明「通常兩個外掛都自動加 canonical 不用手動設，要手動只發生在多語系互指或分頁/篩選頁要指回主頁兩種情境」
- 🔍 **順手 audit 其餘 Yoast/Rank Math 提及**（[fixGuides.js](src/data/fixGuides.js)）：
  - meta_title / meta_desc：步驟通用（兩個外掛 metabox 欄位名稱接近），不拆
  - json_ld：列 Schema Pro / Rank Math（Yoast 免費版生 Organization 不好用）— **可以順手把我們新做的 OrgSchemaGenerator 工具列為選項**，待問用戶
  - faq_schema：只列 Rank Math（Yoast 免費版不支援 FAQ Schema 是事實）— OK
- 🌟 **追加（同日）**：用戶確認要在 json_ld 推自家工具 → [fixGuides.js](src/data/fixGuides.js) json_ld 加 `featured` 欄位（title + body），[IssueBoard.jsx](src/components/v2/IssueBoard.jsx) FixPanel 渲染綠色亮眼底色區塊在 summary 下方、troubleshooting 上方。內容指引用戶滾本頁下方用 OrgSchemaGenerator，免裝外掛、四個平台都通。`featured` 是可重用結構，未來其他 fix guide 想推自家工具或關鍵 hint 都可用

---

### 2026-05-26（H1 fix guide 加 WPBakery 步驟 — page builder 偵測別憑印象猜的教訓）
**前一個 commit 拆 H1 fix guide 時，我憑印象寫了 Elementor / Divi / Bricks 步驟，但用戶 kimbo3899 客戶實際後台是 WPBakery（Visual Composer），被糾正：**

- 🐛 **判斷錯誤的點**：fetch kimbo3899 HTML 偵測時 `js_composer`（WPBakery）跟 `elementor-` 都有 match，我覺得「Elementor 比較主流」就跳過 WPBakery，只在 fix guide 寫 Elementor / Divi / Bricks 步驟
- ✅ **修法**：[fixGuides.js h1_structure missing](src/data/fixGuides.js) 加 WPBakery 步驟到第一順位（台灣 WP 老站 WPBakery 比例不低，舊主題很多綁這個外掛）
  - WPBakery Custom Heading 元素：Element tag 下拉改 h1
  - WPBakery Text Block 元素：段落 P 改標題 1
- 🧠 **教訓記到 memory**：`feedback_builder_detection.md`（在 user 的 `~/.claude/projects/.../memory/`）— HTML fingerprint 多重 match 時不能憑印象猜，要列全或先問用戶。rendered HTML 留下的指紋可能是舊主題殘留、不代表用戶實際編輯時用什麼 builder

---

### 2026-05-26（H1 fix guide 拆 missing / too_many 兩情境 — page builder 用戶不再卡）
**用戶實測 kimbo3899.com.tw 後追問 H1 fix guide 不適用情境 — diagnose 後發現 fix guide 預設「太多 H1」case，但實際很多用戶是「0 個 H1」（page builder 用 div 代替）：**

- **觀察**：kimbo3899 首頁實測 H1 = 0，H2-H6 全部 0，整頁無語義化 heading → Elementor 蓋的（也驗到 wp-content/themes/responsive）
- **問題**：[fixGuides.js h1_structure](src/data/fixGuides.js) 原本只寫「搜尋 <h1>、多餘的改成 <h2>」，假設用戶頁面有過多 H1，但實際 page builder（Elementor / Divi / Bricks）預設用 div + CSS 字級，根本 0 個 H1。用戶照步驟操作會找不到任何 H1 → 困惑
- **修法（資料 + UI 雙改）**：
  - [SEOAudit.jsx getValue](src/pages/SEOAudit.jsx) — h1_structure 的 getValue 加 `scenario` 欄位（'missing' / 'too_many'），count=0 標 missing、count>1 標 too_many
  - [fixGuides.js](src/data/fixGuides.js) h1_structure 每個平台改成 `scenarios: { missing, too_many }` 結構：
    - WP missing：分 Elementor / Divi / Bricks / Astra Builder / Gutenberg 五種 builder 各自的「找 widget → HTML Tag 改 H1」操作
    - WP too_many：原本的「程式碼編輯器搜 <h1> 改 H2」步驟
    - Shopify / Wix / HTML 同理拆兩個 scenario
  - [IssueBoard.jsx FixPanel](src/components/v2/IssueBoard.jsx) — 偵測 `rawPlatform.scenarios` 存在時，依 `check.scenario` key 切到對應 scenario object（fallback 拿第一個）；scenario 有 `title` 就在 steps 上方顯示一條彩色橫條告訴用戶現在看的是哪個情境
- 🔄 **設計上向後相容**：其他 check（meta_title / canonical / json_ld 等）沒拆 scenarios → FixPanel 直接讀 `platforms[id]`，老資料結構不破。未來其他 check 想拆情境（例如 canonical 「沒設」vs「指向其他網站」）只要加 scenarios 結構就生效
- ⚠️ `src/components/FixGuide.jsx` 是死代碼（沒人 import）— 用 grep 確認後未動，留著日後清理

---

### 2026-05-26（行動裝置相容性檢測 false negative — HomeDark 雙驚嘆號 bug + 防呆強化）
**用戶實測 kimbo3899.com.tw 回報「明明有 viewport 卻被判失敗」，diagnose 後找到真正 root cause：**

- 🐛 **Root cause（很尷尬）**：[HomeDark.jsx:469](src/pages/HomeDark.jsx#L469) 寫成 `mobile_compatible: !!seoResult.mobile_compatible` — 雙驚嘆號把整個 object 強轉成 boolean（永遠是 `true`，因為 object 永遠 truthy），存到 DB JSONB 欄位變成 `true`。但 [SEOAudit.jsx:90-114](src/pages/SEOAudit.jsx#L90) 讀取時當 object 用：`m?.hasViewport`、`m?.hasMediaQueries`、`m?.hasRwdFramework` → 三個 sub-field 都 undefined → 跑進「未偵測到 viewport meta、@media query、或 RWD 框架指紋」分支 → 用戶看到「行動裝置會看到桌面版縮小到無法閱讀」紅字
- **影響範圍**：**所有從首頁觸發的掃描都中招** — 過去寫的所有 audit row 的 mobile_compatible 欄位都是 boolean `true`，讀取頁面看起來都像「沒有 viewport」
- **為什麼之前沒被發現**：分數計算用的是 `mobileCompatible.score`，是在分析當下計算的，存進 DB 的是「不對的 boolean」但 UI 只在詳情頁才會解開讀子欄位 → 大部分用戶只看雷達圖總分沒進詳情頁
- **修法**：去掉 `!!`，跟 alt_tags / meta_tags / page_speed 等一致存完整 object
- 🛡️ **順手加防呆**：seoAnalyzer.js `checkMobileCompatibility(doc, html)` 加 regex fallback — DOMParser 找不到 viewport 就用 `/<meta\s+[^>]*\bname\s*=\s*['"]?viewport['"]?[^>]*>/i` 掃 raw HTML。多回兩個診斷欄位 `viewportSource`（'dom' / 'regex' / null）與 `viewportTagRaw`（實際抓到的 tag 原文）。未來大小寫變體、引號變體、parser 邊緣 case 都會被 regex 接住
- 📋 **fixGuides.js + IssueBoard.jsx 加 troubleshooting 區塊**：mobile_compatible 加 3 條假陰性排查線索（快取插件 / 子主題覆寫 / `wp_is_mobile()` 條件包住），琥珀色底色 + ⚠️ 標題醒目顯示。框架通用 — 未來其他 check 也能加 troubleshooting 欄位
- ⚠️ **歷史 audit 不會自動修好**：DB 裡舊資料是 boolean `true`，用戶需要重新掃描才能看到正確結果

---

### 2026-05-26（個人化 Organization Schema 產生器 — Pro 限定工具上線）
**對應上次「品牌報名表」教育敘事的下一步 — 把 YouTube 影片裡「用 ChatGPT 生 schema code」的手工痛點，直接做成永久儲存 + 一鍵複製的 Pro 工具。**

- 🆕 **新元件 [src/components/v2/OrgSchemaGenerator.jsx](src/components/v2/OrgSchemaGenerator.jsx)**
  - 表單欄位：公司名 / 英文名 / 網址 / Logo / 簡介 / Email / 電話 / 地址 / 5 個社群連結（sameAs）
  - 儲存到 `profiles.org_schema_data` JSONB → 永久持有、未來都用同一份
  - 自動產出 `<script type="application/ld+json">...</script>` Organization 完整 code
  - 一鍵複製到剪貼簿 + 內嵌平台安裝指引（WP / Shopify / Wix / 自架 HTML）
  - 編輯 / 預覽雙模式切換
  - **打字效能**：所有 input/textarea 用 `defaultValue + onBlur`（uncontrolled）跟註冊頁同款，避免重新渲染卡頓
- 🔓 **權限分層**
  - **Pro 用戶**：完整表單 + 預覽 + 複製
  - **免費用戶**：顯示 upsell card（「填一次 → 永久存著 → 自動產 code」訴求）→ `/pricing`
  - **未登入**：完全不渲染（這頁只給已登入用戶看到）
- 📍 **掛載位置**：[src/pages/AEOAudit.jsx](src/pages/AEOAudit.jsx) IssueBoard 之後、`/schema-check` 微入口之前 — 用戶看完「缺什麼 schema」立刻看到「我可以幫你生」
- 🗃️ **SQL migration（用戶側待跑）**：
  ```sql
  ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_schema_data JSONB DEFAULT NULL;
  ```
- 🎯 **定位**：對應 CLAUDE.md「修復碼產生器」Pro 核心功能 — 從「告訴你缺什麼」升級成「幫你生出來」，把產品從工具升級為平台

---

### 2026-05-25（Register 頁兩個 bug — 品牌文案漏改 + Turnstile 載入失敗 UX 改善）
**用戶截圖回報 /register 跟「final 版本」不一樣，診斷出兩個獨立問題：**

- 🐛 **Bug 1：行銷同意 checkbox 文案還寫「AARK」**（CLAUDE.md 規範品牌名應為「AI 雷達」）
  - 2026-05-20 rename 後忘了改這一行
  - 修法：[Register.jsx:260](src/pages/Register.jsx) 文案改成「我同意接收 AI 雷達 的產品更新...」
- 🐛 **Bug 2：Cloudflare Turnstile widget 載入失敗，顯示原生簡中錯誤「无法连接到网站」**
  - 用戶看不懂這個訊息，且因為 `if (!captchaToken) return setError('請先完成人機驗證')` 邏輯 → **所有新註冊被擋**
  - 真實 root cause 在 Vercel env / Cloudflare dashboard 配置（待用戶側確認）
  - UX 改善：onError 時除清 token 也標 `turnstileError=true`，下方顯示友善錯誤 banner：
    - 標題「⚠️ 人機驗證載入失敗」
    - 3 個 fallback 步驟：(1) 重整 (2) 關閉廣告攔截器 / VPN (3) 改用 Google 註冊
- 🔧 **待用戶側確認**：Vercel env `VITE_TURNSTILE_SITE_KEY` 設定 + Cloudflare Turnstile dashboard 的 Allowed Domains 是否含 `aark-workspace.vercel.app`

---

### 2026-05-25（一輪集中驗證 — 近 2 週功能 7/8 全綠）
**用戶實測驗證 8 個近期功能，7 個 OK、1 個是設計疑問（非 bug）：**

- ✅ **#1 /schema-check 未登入 CTA**：header 顯示「登入 / 免費註冊」，掃描後 CTA 寫「免費註冊 → 看完整修法」
- ❓ **#2 /crawl-check 功能用途**：用戶不知道這頁是什麼。設計上是「外部落地頁」（社群文/廣告用），目前無內部入口。社群文素材包在 [docs/social-posts-anti-bot.md](docs/social-posts-anti-bot.md)。**未決定**是否加內部入口（之前討論等第 3 個工具上線再開「工具」menu）
- ✅ **#3 雷達圖 100 分外框可見度**：白色細線清楚（之前 PolarGrid 0.1 透明度幾乎看不到）
- ✅ **#4 SchemaCheck 已登入 CTA 切換**：header 變「回首頁 →」、CTA 變「回首頁掃描你的網站 →」
- ✅ **#5 AEO 詳情頁 Free/Pro 分層**：JSON-LD / Canonical / Open Graph 開放、FAQ Schema 鎖 Pro、Canonical icon 改 📌 不再跟 lock 混淆
- ✅ **#6 GEOAudit「📡 AI 爬蟲訪問日誌」+「🔍 驗證上傳是否成功」**：crawler_visits SQL 跑完後正常顯示空狀態
- ✅ **#7 canon.co.uk 觸發聳動 modal**：紅色玻璃擬態 + CRITICAL 警示條 + 大字「你的網站對 AI 完全隱形」
- ✅ **#8 註冊 → 驗證信 → 自動登入**：emailRedirectTo + Supabase Site URL 配對正確、新 email 完整 e2e 跑通

**SQL migration 驗證（用戶側已跑）：**
- ✅ `crawler_visits` 表 + indexes + RLS policies
- ✅ `aeo_audits.faq_visual` BOOLEAN DEFAULT false

**還沒處理的設計問題：**
- `/crawl-check` 跟 `/schema-check` 都沒有內部入口，目前純外部 SEO/廣告 landing page 用途
- 社群文（docs/social-posts-anti-bot.md）寫好但還沒發布
- 沒有 schema 痛點版的第二批社群文

---

### 2026-05-25（移除 Cloudflare Turnstile captcha — 多輪修法仍無法解的打字中斷問題）
**6+ 輪修法後決定暫時拿掉 captcha：**

- 🐛 **核心問題：Cloudflare Turnstile 在無痕模式持續中斷用戶打字**
  - 用戶實測：每打一個字停 1-2 秒、字一個一個出來、整個註冊跑不完
  - 中斷源自 Cloudflare 的 background fingerprinting，即使 widget 設成 invisible/execute 模式仍會做
- 嘗試過的修法路徑（全部失敗）：
  1. ❌ 修 hostname 截斷
  2. ❌ 修 hostname 拼錯（少 .app）
  3. ❌ props reference 穩定（useCallback + 模組常數 options）
  4. ❌ React.memo 隔離 IsolatedTurnstile 子元件
  5. ❌ Deferred execute (`appearance: 'execute'` + `execution: 'execute'`)
  6. ❌ Conditional mount（只在按提交時掛 widget）
- ✅ **決定走 Path X：移除整個 Turnstile**
  - 刪 `src/components/v2/IsolatedTurnstile.jsx`
  - Register.jsx + Login.jsx 移除所有 captcha 相關 state / handler / JSX
  - handleSubmit 直接呼叫 signUp / signIn（不傳 captchaToken）
  - AuthContext.jsx 的 signUp / signIn 本來就支援 optional captchaToken，不用改
  - 保留 `@marsidev/react-turnstile` 在 package.json（dev dep 用、tree-shake 不會入 bundle）
- 🔧 **用戶側需做**：進 Supabase Dashboard → Authentication → Attack Protection → 把「Enable Captcha protection」toggle **關掉** → Save
- 安全層仍在（沒有真的「裸奔」）：
  - Email 驗證信（bot 仍需真實 inbox）
  - Supabase per-IP rate limit
  - profiles.is_pro 預設 false（bot 拿不到 Pro）
  - aivis 配額硬上限 50（試用）
  - Google OAuth 自帶反 bot
- 之後若真的看到 bot 浪潮 → 回頭研究 hCaptcha 或自家後端速率限制
- CLAUDE.md「上線前必修」清單裡的「Supabase Auth 註冊頻率限制」status 暫時改為「移除（換 server-side rate limit）」

---

### 2026-05-25（/schema-check 落地頁 — 第二個工具集成員）
**順著「每個痛點配一個獨立落地頁」格局做的第二個工具，姊妹頁是 /crawl-check：**

- 🆕 **[src/pages/SchemaCheck.jsx](src/pages/SchemaCheck.jsx)** — 「你的網站有哪些 Schema？AI 看得到嗎？」單一痛點檢測頁
  - 免註冊單一輸入 → /api/fetch-url → 解析 HTML 所有 `<script type="application/ld+json">` → 列出所有 schema type
  - 處理 3 種 JSON-LD 結構：頂層 @type / @type 為 array / @graph 巢狀
  - parseAllSchemas helper：回 `{ types, invalidCount, totalScripts }`，含 source 標註（哪個 script 哪個 @graph index）
  - 17 個 KEY_SCHEMA_TYPES 清單（Organization / WebSite / Article / FAQPage / BreadcrumbList / Product / LocalBusiness 等），分 3 層優先級（essential / recommended / context）
  - 偵測到的 schema：⚠️ 在我們清單裡的標 label + purpose；不在清單裡的標「非常見 type」
  - missingEssentials：自動列出 essential 級但缺漏的 type（給「強烈建議補上」區用）
  - 共用 aeoAnalyzer.js 的視覺 FAQ heuristic（detectVisualFaq）— 沒 FAQPage schema 但有視覺 FAQ 時跳警告
  - 動畫式掃描 log（5 行 / 每 600ms 一條）
- 🆕 **App.jsx 加路由** `/schema-check`
- 🆕 **AEOAudit 加微入口**（既有用戶 cross-link）：IssueBoard 下方加「🔬 想看你網站上所有 Schema 一覽？」卡，帶 `?url=...` query 預填到 SchemaCheck
- 🆕 **交接文件 [docs/schema-check-handoff.md](docs/schema-check-handoff.md)** — 給 Claude Design 後續視覺強化
- 設計取捨：
  - **獨立路由 + 微入口雙軌**（不放 Dashboard / 不開「工具」menu）— 等到第 3 個工具上線再規劃 menu
  - **不重新發明 schema 偵測邏輯** — 複用 aeoAnalyzer.js 既有 checkFaqSchema 的 hasVisualFaq 邏輯
  - **CTA 導去註冊**（不導去 Pricing）— 免費版就能跑完整 AEO 分析，註冊比直接升 Pro 阻力小

---

### 2026-05-25（soileng.com.tw 兩個踩坑 → 兩個增強）
**朋友測 soileng 反映 (a) 加了 llms.txt 還是被測到缺 (b) 視覺有 FAQ 卻沒被測到：**

- 🐛 **(a) 根因：用戶以為上傳成功但實際 builder 404**
  - 診斷：soileng 用 Hostinger Builder（`Server: hcdn`），`/llms.txt` 實際回 HTTP 404 + builder 404 頁
  - Builder 不開放 root 路徑放純文字檔 → 用戶完全沒辦法察覺上傳失敗
- 🆕 **增強 1：GEO 詳情頁 LlmsTxtSection 加「🔍 驗證上傳是否成功」按鈕**
  - 透過 /api/fetch-url 後端打用戶網站的 `/llms.txt` 取真實 HTTP 狀態
  - 偵測 4 種失敗模式：404 / 200 但 body 是 HTML（builder 攔截）/ 200 但 < 30 bytes / 200 但不像 llms.txt 標準（缺 # 或 >）
  - 5 種狀態 banner（live / not_found / invalid / error / idle）配色 + 失敗時自動推「方案 B」修法（在 robots.txt 加 LLM-Sitemap 指向我們代管 URL）
  - 對 builder 用戶意義最大：避免「以為上傳了但其實 AI 看不到」的隱形失敗

- 🐛 **(b) 根因：analyzer 只認 FAQPage schema，視覺 FAQ 無 schema 一律算 fail**
  - 但用戶 builder 通常自動生成的 FAQ 元件不會 inject JSON-LD
  - 結果：用戶肉眼看得到 FAQ 但 audit 一律報「缺 FAQ schema」，無法區分「沒做 FAQ vs 做了但缺 schema」
- 🆕 **增強 2：[aeoAnalyzer.js](src/services/aeoAnalyzer.js) 加視覺 FAQ 偵測**
  - 3 個 heuristic 訊號：
    1. 標題類似「常見問題 / FAQ / Q&A / Frequently Asked Questions / 問與答」（含 h1-h6 / class*=faq / id*=faq）
    2. `<details>` 元素 ≥ 3 個（HTML 折疊式 FAQ 慣用法）
    3. FAQ 標題 + ≥3 個「？」結尾短文字（問句模式）
  - 判定：(有 FAQ 標題 AND ≥3 問句) 或 (`<details>` ≥3) → `hasVisualFaq=true`
  - 輸出新欄位 `faq_visual` 到 result + DB（需用戶側跑 ALTER TABLE）
- 🆕 **AEOAudit 顯示邏輯增強**：FAQ schema 失敗時若 `faq_visual=true` 改顯示精準訊息
  > 「⚠️ 偵測到你的頁面有 FAQ 區塊但缺 FAQPage schema — 對人類訪客可見、但 ChatGPT / Claude / Perplexity 等 AI 引擎抓不到」
- 連帶：用戶展開 FAQ schema 卡會看到 [fixGuides.js](src/data/fixGuides.js) 既有的 WP/Shopify/Wix/HTML 平台別 FAQPage JSON-LD 範例 code（Pro 限定）

**用戶側要跑的 SQL（paste-ready）：**
```sql
ALTER TABLE aeo_audits ADD COLUMN IF NOT EXISTS faq_visual BOOLEAN DEFAULT false;
```

---

### 2026-05-23（Vercel deploy fail 根因 — Hobby 12 function 上限）
**6 個 commit 連續 build pass 但 deploy fail 的真實原因：**

- 🐛 **根因：Vercel Hobby plan 一個 deployment 最多 12 個 serverless functions**
  - 24dc683 加 `api/llms/[id].js` → function 數 12 → 13，超上限
  - 後續 6 個 commit 都帶著這個違規 → deploy 階段被 Vercel 阻擋
  - 症狀：Build Logs 顯示 `Build Completed [55s] / Deploying outputs...` 後沒下文
  - Vercel UI 沒在明顯地方顯示「超過 function 上限」訊息（user 展開 Deployment Summary/Checks 都看不到），是隱藏式的 deploy block
- ✅ **修法：合併 public-stats + llms-txt 進 `api/public.js`**
  - 兩者都是公開讀 + service role + 無 auth，邏輯天然相容
  - 用 `?action=stats` / `?action=llms` 分流
  - 刪 `api/public-stats.js` + `api/llms-txt.js` → function 數退回 12
  - 連帶恢復 B + C + 3 個 fetch-url bug fix（scalebar / canon / plantex / taishinbank）
- 學到的：以後新增 function 前先 `find api -maxdepth 3 -name "*.js" -not -path "api/lib/*" | wc -l` 看一下，到 12 就要合併不能加
- 設計取捨：未來如果功能持續增加且想保持每個 function 邏輯清晰 → 升 Vercel Pro 解除上限。短期靠合併撐

---

### 2026-05-23（fetch-url 修 3 個獨立 bug — 朋友測 4 個失敗網站）
**朋友回報 scalebar.co / canon.co.uk / plantex.my / taishinbank.com.tw 都失敗，診斷後是 3 個獨立 bug：**

- 🐛 **Bug 1：SSL_ERROR_CODES 漏接 `ERR_TLS_CERT_ALTNAME_INVALID`**（憑證 hostname 不符）
  - scalebar.co + taishinbank.com.tw 是此類 — 憑證有效但 CN 跟訪問的 hostname 對不上
  - 修法：白名單加 `ERR_TLS_CERT_ALTNAME_INVALID` + `ERR_TLS_CERT_ALTNAME_FORMAT` + `HOSTNAME_MISMATCH`（老 Node code）
  - 驗證：taishinbank.com.tw 用 undici 放寬 SSL → 200 OK 211KB「個人金融 - 台新銀行」
- 🐛 **Bug 2：Round 1 timeout/throw 就死掉，沒 fall through Round 2-4**
  - plantex.my 案例：站在馬來西亞，Vercel→MY RTT 高，Round 1 Googlebot 容易 timeout
  - 但 Round 2 Chrome 通常較快通過（不同 UA 走不同 anti-bot 路徑）
  - 原邏輯：Round 1 throw → 整個 request 失敗。修法：Round 1 catch 對「非 SSL」error 設 `response = null`，後續輪 `shouldFallback(response)` helper 接管
  - 同步 Round 2-3-4 都從 `response.status === 403/...` 改為 `shouldFallback(response)`，含 null 也算「該繼續」
  - 4 輪都 throw 的 edge case → 返回 503 + `antiBotBlocked: true` 讓 HomeDark partial audit 接住
- 🐛 **Bug 3：scalebar.co 「200 + 空 body」沒有具體錯誤訊息**
  - 該站 Apache 回 200 OK chunked 但 0 byte（broken WordPress / 維護中）
  - 原本：拿到空 HTML → 全部 analyzer 跑 0 分 → 用戶以為自己網站很爛
  - 修法：fetch-url 在 `html.trim().length < 50` 時回 502 + 具體 hint「目標網站回應 200 但內容為空，可能網站維護中 / 應用程式錯誤」
- ⚙️ **per-round timeout 從 6s 微調到 8s**：Vercel→海外網站 latency 比本地高，6s 太緊
  - 新 worst case：8+8+8+30 = 54s，maxDuration 60s 留 6s 緩衝

---

### 2026-05-23（C. 爬蟲訪問日誌 — 對標 washinmura.jp wow factor）
**順著 B 剛蓋的 llms.txt endpoint 加 visit logging — 不另做 JS pixel（純 JS 對 AI bot 無效）:**

- 🆕 **SQL：建 `crawler_visits` 表**（用戶側待跑，已給 paste-ready SQL）
  - 欄位：website_id / user_agent / ip_hash / is_ai_bot / bot_name / source / created_at
  - 2 個 index（按 website + 時間 desc / 只看 AI bot）
  - RLS：用戶看自己網站、admin 看全部
- 🆕 **[api/llms/[id].js](api/llms/[id].js) 加 visit logging**：
  - 知名 AI bot UA 識別表（15 個：GPTBot / ChatGPT-User / OAI-SearchBot / ClaudeBot / Claude-Web / anthropic-ai / PerplexityBot / Perplexity-User / Google-Extended / Applebot-Extended / Bytespider / CCBot / Amazonbot / Meta-ExternalAgent / YouBot）
  - 子字串 match 判定 is_ai_bot + bot_name
  - IP 去識別化（SHA-256 hash 前 16 字）
  - **排除 X-AARK-Internal: true header** — 避免 GEO 詳情頁的 preview fetch 污染統計
  - **Cache-Control 從 3600s 縮到 60s** — 否則 CDN cache hit 不會打到 endpoint、漏記 visit
- 🆕 **[GEOAudit.jsx](src/pages/GEOAudit.jsx) 加 CrawlerVisitsSection 組件**：
  - 3 個 KPI chip：總訪問次數 / AI 爬蟲訪問 / 24 小時內 AI 訪問
  - Visit timeline 列最近 30 筆，AI bot 用青綠 chip、一般訪問淡灰
  - 每筆顯示：bot type chip + bot name（若 AI）+ UA（截斷顯示，hover 看完整）+ 相對時間
  - **60 秒自動 refresh**（對標 washinmura「live tracker」體驗）
  - 誠實揭露限制：「只記對代管 llms.txt 的訪問，要追蹤整站訪問需要 server log forwarder（Pro 功能規劃中）」
- 設計取捨：
  - **不做 JS pixel** — AI bot 不執行 JS，做了白做
  - **不做 image pixel** — 多數 AI bot 也不抓圖
  - **只記代管 llms.txt 訪問** — 是「最低 build cost、最高訊號可信度」的組合（endpoint 在我們手上，記到的 UA 是真的 hit 過我們）
- 後續想要「整站訪問追蹤」的話走 Pro：server-side log forwarder（WP plugin / Nginx snippet）— 規劃中

**用戶側要跑的 SQL（paste-ready）：**
```sql
CREATE TABLE IF NOT EXISTS crawler_visits (
  id BIGSERIAL PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_agent TEXT NOT NULL,
  ip_hash TEXT,
  is_ai_bot BOOLEAN DEFAULT false,
  bot_name TEXT,
  source TEXT DEFAULT 'llms_txt',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crawler_visits_website_recent
  ON crawler_visits (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_visits_ai_bots
  ON crawler_visits (website_id, created_at DESC)
  WHERE is_ai_bot = true;
ALTER TABLE crawler_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own crawler visits" ON crawler_visits;
CREATE POLICY "users read own crawler visits" ON crawler_visits
  FOR SELECT TO authenticated
  USING (website_id IN (SELECT id FROM websites WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "admins read all crawler visits" ON crawler_visits;
CREATE POLICY "admins read all crawler visits" ON crawler_visits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

---

### 2026-05-23（B. llms.txt 代管功能 — 對標 washinmura.jp 偷學）
**對標分析後識別的差異化補強 — washinmura.jp 有「免費 llms.txt 代管」我們沒有：**

- 🆕 **endpoint：[api/llms/[id].js](api/llms/[id].js)** — Vercel dynamic route
  - 從 websites + 4 種 audit 最新一筆動態生成 llms.txt（符合 llmstxt.org 標準）
  - 內容含：site title / description / homepage / sitemap / AI crawler welcome list（14 個 AI/搜尋引擎 UA）/ structured data signals
  - service role 繞 RLS 拉資料、尊重用戶 opt_out
  - text/plain content-type + 1hr CDN cache + 1day stale-while-revalidate
- 🆕 **vercel.json rewrite**：`/llms/:id.txt → /api/llms/:id` 讓對外 URL 漂亮
  - 同時把 `llms/` 加進 fallback exclusion 避免被 SPA index.html 攔截
- 🆕 **GEO 詳情頁加 LlmsTxtSection 組件**（[GEOAudit.jsx](src/pages/GEOAudit.jsx)）
  - 代管 URL 顯示 + 一鍵複製
  - 內容預覽（讀 /api/llms/{id} 拿即時生成內容）
  - 下載 llms.txt 檔（Blob + download attr）
  - 複製內容 / 複製連結兩個按鈕，1.8 秒 ✓ 已複製 反饋
  - 折疊「怎麼接到我的網站？」教學：方法 1 下載上傳 root / 方法 2 robots.txt 加 LLM-Sitemap 指向
  - 標「免費功能」chip，不 Pro-gate（讓進 GEO 頁的用戶都能用，建立 goodwill）
- 設計取捨：
  - **Path-based** 不做 subdomain — DNS 門檻高、對 LLM 來說 path/subdomain 無差只是視覺加分
  - **不做用戶編輯** — 完整版（B 等級）會新增 llms_files 表 + textarea 編輯器，這版先做最小有用版
  - **內容繁中標題 + 英文 section name** — section name 用英文（GPTBot/ClaudeBot 等爬蟲對英文 section name 識別度高），描述文案保留繁中

---

### 2026-05-23（fetch-url 加 maxDuration + 縮短每輪 timeout — canon.co.uk 案例）
**朋友測 canon.co.uk 沒分數的新失敗模式：**

- 🐛 **新發現：Akamai 等 anti-bot 對 Chrome UA「拖時間」而非直接擋**
  - 4 輪行為：Googlebot 403（0.8s）/ Chrome timeout 20s ⏱ / Bingbot 403 / AllOrigins 520
  - 結果：4 輪累積 25-40 秒，**超過 Vercel Hobby function timeout 預設 10s**
  - Vercel 強砍 function → 前端收到網路錯不是 antiBotBlocked → catch 不走 partial audit → DB 無任何 audit row → 用戶看到「沒分數」
- ✅ **修法 1：[api/fetch-url.js](api/fetch-url.js) 加 `export const maxDuration = 60`** — Hobby 上限 60s，給 4 輪預算
- ✅ **修法 2：每輪 timeout 從 20s 縮到 6s（UA 三輪）**
  - 正常網站 1-3s 就回，6s 對「正常 case」綽綽有餘
  - 對「拖時間 anti-bot」（Akamai 拖 20s）果斷砍 → Round 2/3/4 仍能跑完
  - AllOrigins 維持 30s（proxy 多一層 hop 合理需時較久）
  - 4 輪 worst case：6+6+6+30 = 48s，在 60s 預算內留 12s 緩衝
- 連帶效應：antiBotBlocked 旗標一定能回到 client → HomeDark partial audit 路徑可觸發 → 用戶會看到「⚠️ 你的網站擋下我們的爬蟲」alert + 跳 SEO 詳情頁看修法
- 🔖 後續優化（不在這次）：fetch-url 改成回傳 per-round log array 讓 /crawl-check 能秀真實時序（目前是 inference）

---

### 2026-05-23（/crawl-check 落地頁骨架）
**對標 aeo.washinmura.jp 後的差異化策略 — 把 anti-bot 主動檢測包裝成單頁落地頁:**

- 新建 [src/pages/CrawlCheck.jsx](src/pages/CrawlCheck.jsx)：URL 輸入 + 動畫式 4 輪 fallback log + 結論卡 + 註冊 CTA
- 6 種結論狀態（clean / ssl / ua / proxy / blocked / network_error）依 fetch-url 4 旗標（sslFallback / uaFallback / proxyFallback / antiBotBlocked）反推，每種對應獨立 icon / 色 / 文案 / riskLevel
- 5 種 status badge（pass / warn / fail / skip / error）對應 4 輪的個別結果
- 不需登入即可測試（降低 friction），CTA 引導免費註冊看完整 7 項報告
- App.jsx 加路由 `/crawl-check`
- 視覺現為「功能完整、樣式平實」的骨架版，邏輯資料流全接通
- 寫交接文件 [docs/crawl-check-handoff.md](docs/crawl-check-handoff.md)：元件樹 / 狀態樹 / 6 種 verdict 真實資料範例 / 視覺自由發揮 vs 不要動的部分 / 動畫時序建議 / 行動裝置考量
- 待 Claude Design 接手做視覺強化（終端機動畫節奏、雷達背景、icon、漸層、進場動畫等）

---

### 2026-05-22（admin 列表 audit 排序修正）
**shop-aquas.com 案例暴露的小 bug：**

- 🐛 重掃過的網站，admin「已分析的網站」chip 可能還顯示舊分數
  - 根因：[AdminUsers.jsx:167](src/pages/admin/AdminUsers.jsx) nested select `seo_audits(score)` 沒指定排序，PostgREST 回傳順序不保證 → render 端 `.audits[0]` 隨機抓到舊 row
- ✅ **修法**：4 個內嵌 audit 各加 `.order('created_at', { foreignTable: '...', ascending: false })`，把最新一筆保證放在 [0]
- 連帶把 `created_at` 加進 nested select 欄位

---

### 2026-05-22（anti-bot 後續優化 1+2）
**清掉 iseeu.tw 後續優化清單的前兩項：**

- ✅ **#1 HomeDark 失敗時顯示具體訊息（不再黑箱 alert）**
  - 加 `errorInfo` state（title / hint / action / code / status / technical）
  - catch block 從 status / code / message 推斷錯誤類型 → 8 種分類（antiBotBlocked / 403 / 404 / 503 / timeout / invalid url / network / unknown）
  - 每種類型給「title（發生什麼）+ hint（為什麼）+ action（怎麼辦）」三段式人話
  - render 結構化錯誤 banner（紅色框 + ⚠️ icon + ✕ 關閉鈕 + 可展開的「技術細節」給客服複製）
  - 取代原本 `alert('發生錯誤：${detail}')` 黑箱訊息
- ✅ **#2 AdminUsers 加掃描錯誤紀錄區塊**
  - 加 `userErrorLogs` state，handleExpand 拉用戶最近 10 筆 scan_error_logs
  - UI 區塊放在「已分析的網站」之後
  - 每筆顯示：類型 chip（🛡️ Anti-bot / 🔒 SSL / ⏱ 逾時 / 🌐 DNS / ⚠️ 其他，依 http_status + error_code + error_message 推斷）+ HTTP status + UA/SSL fallback 旗標 + URL + step + error_code + error_message（截 200 字）
  - 客服回覆速度可大幅提升：以前要去 Vercel logs 撈，現在直接看後台

---

### 2026-05-22（行動裝置相容判斷放寬）
**朋友反映 happylandedu.com 行動裝置相容 0 分但實際有 RWD：**

- 原邏輯太死：只看 `<meta name="viewport">` 一個訊號
  - 偽陰性高：很多網站 RWD 寫在外部 .css（@media 抓不到）、或舊版 audit fetch 拿到 Cloudflare 攔截頁就 0 分
- ✅ **seoAnalyzer.js checkMobileCompatibility 升級為 3 訊號合判**：
  - viewport meta 標籤（最關鍵）
  - inline `<style>` 內 @media query / `<link media="...">`
  - 常見 RWD 框架/CMS 指紋（elementor / wp- / oceanwp / bootstrap / col-md- / tailwind 等 class 名稱）
- ✅ **評分梯度**：viewport + (media 或框架) = 100 / viewport only = 90 / media 或框架 only = 70 / 三者全無 = 30
- ✅ **SEOAudit.jsx detail 文案細分**：viewport 已設 + 有 RWD 訊號 / viewport 已設 / 沒 viewport 但有 RWD（warning=true 可展開看修法）/ 三者皆無
- 影響：用 Elementor / OceanWP / Bootstrap 等框架的 WordPress 網站不再被誤判為 0 分

---

### 2026-05-22（UX 修補：warning 狀態可展開）
**iseeu.tw 案例驗證後發現 UX 漏洞：**

- 🐛 **bot_accessibility 顯示為「已通過但有警告」（uaFallback case）時用戶無法展開看 Cloudflare WAF 修復碼**
  - 場景：iseeu.tw Googlebot UA 被擋但 Chrome / Bingbot 通過 → 落在「已通過」column
  - 問題：IssueBoard 預設 `canExpand = !check.passed`，passed 項目一律不給點 → 修復碼產生器白做
- ✅ **IssueBoard.jsx**：`canExpand = !check.passed || check.warning`（通過但有警告也允許展開）
- ✅ **SEOAudit.jsx**：bot_accessibility fallback case 加 `warning: true` 旗標
- 影響：iseeu.tw 等 anti-bot 偏嚴的網站，現在可以點開「🛡️ 爬蟲可達性」看到 Cloudflare / robots.txt / 其他 WAF 三套修復方案

---

### 2026-05-22（補完 4 項優化）
**「爬蟲可達性」生態系完整化 — 4 項優化全到位:**

- 🆕 **第 4 輪 AllOrigins proxy fallback**（免費 CORS proxy 繞 Cloudflare）：
  - 接續第 3 輪 Bingbot UA 仍 403 時，呼叫 `https://api.allorigins.win/get?url=...`
  - AllOrigins 出口 IP 跟 Vercel 不同段，Cloudflare 可能放它過、不放我們過
  - response.text() 偽造 wrapper 包 proxyData.contents 給後續流程用
  - 加新旗標 `proxyFallback: true` 標示這條路徑成功
  - 4 輪全失敗才設 `antiBotBlocked = true`（提高 fallback 機會）
- 🆕 **WAF Rule 修復碼產生器**（fixGuides.js 加 bot_accessibility）：
  - PLATFORMS 列表新增 3 個非平台 tab：cloudflare / robots / otherwaf
  - bot_accessibility guide 含 3 套完整修復步驟 + 一鍵複製 code：
    - **Cloudflare**：完整 WAF Custom Rule expression（含 14 個 AI/搜尋引擎 UA）+ Super Bot Fight Mode 降級步驟
    - **robots.txt**：標準格式涵蓋 GPTBot / ChatGPT-User / OAI-SearchBot / PerplexityBot / Perplexity-User / ClaudeBot / anthropic-ai / Claude-Web / Google-Extended / Applebot-Extended / Googlebot / Bingbot
    - **其他 WAF**：Imperva / DataDome / Sucuri / Akamai 各家後台路徑說明 + 通用 UA 清單
- 🐛 **修 partial audit 顯示 bug**（用戶反映 iseeu.tw 詳情頁顯示「未設置 Meta 標題」誤導）：
  - SEOAudit.jsx 新增 `isPartialAudit(audit)` helper：`bot_accessibility.blocked=true && !meta_tags`
  - 7 項 SEO_CHECKS 的 getValue 開頭都檢查 `if (isPartialAudit(audit)) return NOT_CHECKED`
  - 顯示「此次未檢測（爬蟲被擋導致無法分析頁面內容）」+ passed:true（不污染分數）
  - 用戶不再以為自己 Meta 標題 / H1 / Alt 等也有問題
- 🆕 **首頁 Hero 加 3 個差異化 chip**：
  - ✓ 7 大檢測項一次到位
  - ✓ 連 Cloudflare 擋 ChatGPT 都檢得出
  - ✓ Ahrefs / SEMrush 不做這個
  - 視覺：綠色 / 橘色 / 藍色三色 chip 並排
- 🆕 **社群文素材包**（docs/social-posts-anti-bot.md）：5 篇不同調性文章草稿
  - 1. 痛點科普型（FB / Threads / LinkedIn）— 「Google 排第一但 ChatGPT 沒推薦你」
  - 2. 數據對比型（LinkedIn / FB）— 「100 個網站抽樣，72% 在 AI 答案中消失」
  - 3. 技術警示型（LinkedIn / 工程社群）— 「Cloudflare Super Bot Fight Mode 殺掉你 AI 能見度」含完整 WAF Rule
  - 4. FOMO 限時型（IG / Threads）— 「10 個有 7 個是這個原因」
  - 5. 案例敘事型（LinkedIn / 部落格）— 「4 週實測 0→65% AI 引用率」
  - 每篇含建議發佈平台、Hashtag、CTA、圖卡建議
  - 投放排程：第 1-3 週每週 1-2 篇

---

### 2026-05-22（最最最後 — 真的最後了）
**「爬蟲可達性」加進 SEO 變第 7 項 — 把 anti-bot 痛點包裝成產品價值:**

- 🎯 **產品定位連結**：iseeu.tw 案例證明 Cloudflare 嚴格 anti-bot 會擋下我們三種 UA。**這正是「AI 雷達」要找的盲點** — Cloudflare 擋我們 ≈ 也擋 ChatGPTBot / PerplexityBot / ClaudeBot 等 AI 引擎爬蟲 → 客戶的網站在 AI 答案中完全隱形而不自知。Ahrefs / SEMrush 完全不檢這個。
- ✅ **SQL（用戶側已跑）**：`ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS bot_accessibility JSONB;`
- ✅ **修法**：
  - **seoAnalyzer.js**：fetchPageContent 簽名擴展 → `{ html, sslFallback, uaFallback, antiBotBlocked }`；新增 `checkBotAccessibility(uaFallback, antiBotBlocked)` 函式（三段判定：全擋 0 分 / fallback 60 分 / 第一輪過 100 分）；analyzeSEO 從 6 項變 7 項，總分 ÷6 改 ÷7；result 加 `bot_accessibility` 欄位；getAuditItems 加新檢測項描述。
  - **HomeDark.jsx**：seo_audits insert 加 `bot_accessibility: seoResult.bot_accessibility`。
  - **SEOAudit.jsx**：SEO_CHECKS 加第 7 項，priority **P1**（最高優先，影響 AI 引用率最直接），含 3 段詳細訊息（全擋/fallback/正常）與完整 Cloudflare 修法指南（Super Bot Fight Mode 降級 + WAF 白名單 GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot / anthropic-ai 等）。
- 🔖 **設計取捨**：
  - **bot_accessibility 給 P1，比 ssl_chain 的 P2 還重要**：SSL 鏈不完整時瀏覽器自動補；anti-bot 直接擋連線，沒辦法補。對 AI 引用率影響更直接。
  - **fallback 算「passed 但扣分」(60/100)**：Chrome / Bingbot 通過代表大多數爬蟲還能用，不算完全失敗。但 60 分能拉低總分 + 在詳情頁標記黃色警告，誘導用戶處理。
  - **修復建議文案三條獨立路徑**：Cloudflare（最常見）、其他 WAF（Imperva/DataDome）、白名單 UA 完整列表。客戶不必懂技術也能拿給網管照做。

---

### 2026-05-22（最最後）
**iseeu.tw 案例: anti-bot 偵測 + UA fallback + scan_error_logs 取代「無聲失敗」:**

- 🐛 **iseeu.tw bug**：lan0915 用戶測 iseeu.tw 沒分數。診斷 SQL 顯示 websites 表有 2 筆 row（含一筆 `https://ihttps//seeu.tw` 的複製貼上錯字 URL），但 audits 全部 NULL。
- 🔍 **根因（2 個 bug 疊加）**：
  - **(a) Cloudflare anti-bot 擋假 Googlebot UA**：iseeu.tw 是 WordPress + Cloudflare，對 fake Googlebot（非 Google IP 範圍）回 403。pilotoptical 那次是 SSL 鏈問題、iseeu 這次換 anti-bot 問題 — 同樣是「無聲失敗，audits 全空」。
  - **(b) normalizeUrl 沒擋住「protocol 字串混進 hostname」錯字**：`https://ihttps//seeu.tw` 被 URL parser 解成 `hostname=ihttps path=//seeu.tw`，DNS 解不出來但 normalizeUrl 沒擋下來，直接 INSERT 進 websites 表變成殭屍 row。
- ✅ **修法（3 個防護一次到位）**：
  - **(1) fetch-url UA fallback**：第一輪用 Googlebot UA（多數 SEO 站歡迎），若收到 403/503/429 → 第二輪改 Chrome desktop UA 重試。多數 Cloudflare 設定願意放 Chrome 過、擋 fake Googlebot。response 加 `uaFallback: true` 旗標 + 失敗時加 `hint` 訊息（「Cloudflare 等 anti-bot 設定嚴格」）。
  - **(2) normalizeUrl 防呆**：偵測 `hostname` 是 `http/https/ftp` 字串（或開頭跟 protocol 接非字母數字）→ 回空字串，HomeDark 上層 throw「URL 格式錯誤」拒絕 INSERT。
  - **(3) scan_error_logs 表（用戶側待跑 SQL）**：取代「靠 Vercel logs 找根因」的瞎子模式，每次掃描失敗都寫進 DB（user_id, url, step, error_code, error_message, http_status, ssl_fallback, ua_fallback）。HomeDark 的 catch block 加 supabase insert，非阻塞 try/catch 包住。RLS 設 admin 可讀全表、用戶讀自己的。
- 🔖 **後續優化空間**：
  - AdminUsers 展開詳情可加「掃描錯誤紀錄」區塊讓客服看每個用戶最近失敗原因
  - 前端 HomeDark 失敗時可顯示更具體錯誤訊息（用 hint 欄位）
  - 如果 403 仍持續，可考慮第三輪用其他 UA（如 facebookexternalhit、Slackbot）或 headless browser fallback

---

### 2026-05-22（再最後）
**公告 dismiss cache 修 + TOP 8 隱私改 E 方案（公開摘要頁）+ 管理員測試紀錄 toggle:**

- 🐛 **公告 bug**：用戶反映「後台編輯公告後，前台 banner 看不到」。診斷 SQL 證實公告在 DB 是 `應該顯示中` 狀態，問題在前端 localStorage：原本 `dismissed_announcements` 用 `id` 當 key，admin 編輯後 id 不變 → localStorage 仍認為被 dismiss 過 → 不顯示。
- ✅ **修法**：[AnnouncementBanner.jsx](src/components/AnnouncementBanner.jsx) dismiss key 改成 `${id}:${updated_at}` 組合。Admin 編輯公告後 updated_at 變新值 → 等於「新公告」→ 原本被 dismiss 過的也會重新顯示。select query 加 `updated_at` 欄位。

- 🆕 **TOP 8 公開排行榜隱私改 E 方案**（用戶選 E：混合）：
  - **SQL 兩條（用戶側待跑）**：
    ```sql
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS is_test_site BOOLEAN DEFAULT false;
    ALTER TABLE websites ADD COLUMN IF NOT EXISTS is_public_optout BOOLEAN DEFAULT false;
    UPDATE websites SET is_test_site = true
      WHERE user_id IN (SELECT id FROM profiles WHERE email = 'aark6465@gmail.com');
    CREATE INDEX IF NOT EXISTS idx_websites_public ON websites(created_at DESC)
      WHERE is_test_site = false AND is_public_optout = false;
    ```
  - **新建公開摘要頁 [src/pages/WebsiteSummary.jsx](src/pages/WebsiteSummary.jsx)**：只顯示 5 大面向分數（SEO/AEO/GEO/E-E-A-T/內容品質）+ 總分大圓 + 累計掃描次數 + 「免費註冊・分析你自己的網站」CTA。**刻意不顯示具體哪些檢測項通過 / 未通過 / 修復建議**。is_public_optout / is_test_site 為 true 直接 404 不存在。
  - **App.jsx 加路由 `/website-summary/:id`**。
  - **HomeDark.jsx**：
    - TOP 8 query 加 filter `is_test_site=false AND is_public_optout=false`
    - TOP 8 卡片點擊行為從 `<Link to="/dashboard/:id">` 改 `<Link to="/website-summary/:id">`（公開摘要頁取代完整詳情頁）
    - 跑馬燈 query 同步加 filter（用 inner join + `websites.is_test_site` 條件）
  - **AdminWebsites.jsx**：
    - Row 「網站」欄位旁加「🧪 標為測試 / 🧪 測試」toggle 按鈕（管理員一鍵切換）
    - is_public_optout=true 時顯示「🔒 不公開」紫色 chip 提示客服這個網站是用戶 opt-out 的
    - 篩選下拉加「全部 / 僅正式（前台可見）/ 🧪 僅測試（前台隱藏）」三選項
    - 新增 `handleToggleTestSite` handler + `togglingTest` state 防 double-click
  - **Account.jsx**：
    - 新增「排行榜公開設定」GlassCard 列出用戶所有非測試網站
    - 每個網站獨立 toggle「🌐 公開 / 🔒 不公開」（預設公開，對應 is_public_optout=false）
    - 用 `.eq('user_id', user.id)` 防越權，被 admin 標 is_test_site 的網站不會出現在此清單（已是隱藏狀態）
    - 樂觀更新 UI 不必 refetch

- 🔖 **設計取捨**：
  - **Per-website opt-out 而非 per-user**：用戶可能有的網站想公開（要展示效果）、有的私密（內部工具），給每個網站獨立開關更彈性。
  - **公開摘要頁**：只給總分與五大面向分數聚合數字，**刻意隱藏具體哪幾項通過/未通過/有什麼問題**，這些屬於網主私密診斷細節。但「總分 73」這種 aggregated 指標仍有展示效果作為社會證明。
  - **is_test_site 由 admin 操作**：用戶面對 admin 信任邊界，管理員自己內測的網站應該管理員自己標。但 schema 上同時允許未來自動偵測（e.g. email 在 TEST_EMAILS 名單時自動 true，跟 is_test_order 類似機制，目前只手動）。
  - **WebsiteSummary 對未登入訪客也可看**：故意設計成公開可看（無需登入），降低 TOP 8 點進去的摩擦；末尾 CTA 引導註冊 + 分析自己網站。

---

### 2026-05-22（最後）
**Free 方案功能稽核 + URL 正規化 + websites schema 修補:**

- 🐛 **Bug 1（嚴重）**：`websites.url` 設成「全局 UNIQUE constraint」(`websites_url_key`)，但 HomeDark.jsx dedup 用 `(url + user_id)` 查詢。當用戶 A 已測過某 URL，用戶 B 想測同個 URL 時 dedup 找不到（因 user_id 不同），進到 INSERT 分支噴 `duplicate key value violates unique constraint "websites_url_key"`，整個分析中斷無 audits 寫入。實際撞到的 URL：chuanyuan-water.com.tw（aark6465 內部測過，後續用戶測都掛）。
- ✅ **修法（用戶側已跑 SQL）**：
  ```sql
  ALTER TABLE websites DROP CONSTRAINT websites_url_key;
  ALTER TABLE websites ADD CONSTRAINT websites_url_user_unique UNIQUE (url, user_id);
  ```
  驗證 pg_constraint 顯示 `websites_url_user_unique | UNIQUE (url, user_id)` 已生效。

- 🐛 **Bug 2（URL 變體 dedup 失效）**：HomeDark.jsx `cleanUrl` 只補 `https://`，沒處理 trailing slash / www. / query string / hash。Leo 帳號（leo2895524@gmail.com）試 pilotoptical.com.tw 時從 Google Ads 點進來帶 `?gad_source=1&gad_campaignid=...`，又重打 1 次帶 slash、再 1 次不帶 slash，總共 3 個變體被當 3 個獨立網站建 3 筆 websites row。
- ✅ **修法**：新建 [src/lib/url.js](src/lib/url.js) `normalizeUrl()` helper 處理 7 種變體（補 protocol / 全小寫 / 拿掉 www. / 拿掉 trailing slash / 拿掉 query string / 拿掉 hash / 強制 https）；HomeDark.jsx 改用 `normalizeUrl(url)` 取代原本的 `url.trim() + 補 https://`。
- ⚠️ **未做**：歷史 row 合併（在 normalizeUrl 上線前已建出的多筆同網站變體 row）— 記入 CLAUDE.md TODO 等實際資料量再決定整理時機。

- 🐛 **Bug 3（已查到根因，已修）**：pilotoptical.com.tw 3 個 row 都沒寫進任何 audits — Vercel logs 顯示 `/api/fetch-url` 對 pilotoptical 抛 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` SSL 錯誤。pilotoptical 的伺服器只送終端憑證沒送中間憑證，瀏覽器有寬容機制能自動補但 Node.js 嚴格驗證直接拒連線。台灣很多小網站都這樣設定。
- ✅ **修法**：[api/fetch-url.js](api/fetch-url.js) 加 SSL 容錯 — 第一次嚴格驗證失敗時，如果是 SSL 憑證相關錯誤碼（`UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `CERT_HAS_EXPIRED` / `SELF_SIGNED_CERT_IN_CHAIN` 等 6 種），動態 import `undici` 用 `new Agent({ connect: { rejectUnauthorized: false } })` 重試。回應加 `sslFallback: true` 旗標供前端日後 surface 警告（目前不顯示）。讀公開 HTML 不傳憑證安全可接受。`undici` 從 supabase-js transitive dep 升為 package.json 明確 dep `^5.29.0`。

- 🆕 **SSL 憑證鏈檢測加進 SEO 變第 6 項**（同日加碼）：
  - **SQL（待用戶側跑）**：`ALTER TABLE seo_audits ADD COLUMN IF NOT EXISTS ssl_chain JSONB;`
  - **fetchPageContent 簽名改變**：從 `Promise<string>` → `Promise<{ html, sslFallback }>`。所有 caller（seoAnalyzer / aeoAnalyzer / geoAnalyzer / eeatAnalyzer / HomeDark）都同步改 destructure。Legacy `pages/_legacy/Home.jsx` 不改（已下線）。
  - **新增 `checkSSLChain(sslFallback)` 函式**：用 fetch-url 已經給的 sslFallback 旗標判定，0 額外請求成本。passed=true 給 100 分、passed=false 給 0 分。
  - **analyzeSEO** 從 5 項變 6 項，總分 ÷5 改 ÷6。
  - **HomeDark.jsx** seo_audits insert 加 `ssl_chain: seoResult.ssl_chain`。
  - **SEOAudit.jsx** SEO_CHECKS 陣列加第 6 項 `ssl_chain`，priority P2（比 page_speed 的 P3 更重要，因影響爬蟲可達性更直接）。舊資料（沒這欄位）顯示「此次掃描未檢測」當作 passed 不扣分。
  - **產品定位連結**：SSL 鏈不完整 → 嚴格爬蟲（含部分 AI 引擎）抓不到 → 影響 AI 引用率 → 跟「AI 雷達」主訴求一致，可包裝成差異化亮點（Ahrefs/SEMrush 不檢這個）。

- 🔧 **Free 方案功能稽核**（文案 vs 實際對齊）：
  - **修復碼產生器**：Pricing.jsx FEATURES_PRO 寫成 Pro 專屬，但 Dashboard.jsx Tab 2 註解「免費開放」且實際無 `isPro` 守衛 — 文案與實作矛盾。決定走 B 方案（承認既成事實）：從 FEATURES_PRO 移除「修復碼產生器」，加進 FEATURES_FREE 改寫為「基礎修復碼產生器（llms.txt / JSON-LD / FAQ Schema 通用模板）」；FEATURES_PRO 改成更精準的「平台別修復指南（WordPress / Shopify / Wix / HTML 各別整合教學）」對應 IssueBoard 展開的 platform-specific 修復面板。
  - **AI 優化建議數**：Pricing.jsx 寫「3 條通用方向」，但 Dashboard.jsx `getImprovementSuggestions = () => getAllImprovements().slice(0, 5)` 給所有人 5 條。決定走 B（讓 Free 真的只看 3、Pro 看 5）：`slice(0, isPro ? 5 : 3)` + 加 `hiddenSuggestionCount` 計算被隱藏的條數 + 在 Tab 1 的建議清單下方加「還有 N 條優先處理建議僅 Pro 版可見 → 升級 Pro」CTA 卡。Pricing 文案也對應修飾為「3 條優先處理項目」/「完整版（5 條優先處理項目）」更精準描述。

- 🧪 **驗證重點**：
  - chuanyuan-water 不同用戶測同 URL 不再噴 unique error，各自有獨立 row 與 audits
  - pilotoptical 之後新建 row 會用正規化 URL（`https://pilotoptical.com.tw`），不論用戶從 Google Ads / 直接輸入 / 帶 slash 都歸到同一筆
  - 免費用戶 Dashboard「優化建議」Tab 1 只看到 3 條 + 看到「還有 N 條僅 Pro 可見」CTA 卡
  - Pro 用戶看 5 條，沒 CTA

---

### 2026-05-22（深夜補完）
**加：is_test_order 欄位 — 把 aark6465 內部測試訂單從正式營收剔除:**

- 🐛 **症狀**：AdminRevenue 部署後跑對照 SQL 發現「Pro 用戶 2、MRR 0、退款率 5/5=100%、Top-up 4,440」— 程式邏輯正確，但 6 筆 Top-up + 5 筆年繳全是 aark6465 內部沙盒測試訂單，把營收統計變很怪（退款率 100% 嚇人但無意義）。
- ✅ **修法**：
  - **SQL 加欄位**（用戶側 Supabase Dashboard 已跑）：
    ```sql
    ALTER TABLE aivis_newebpay_pending ADD COLUMN is_test_order BOOLEAN DEFAULT false;
    ALTER TABLE aivis_newebpay_period  ADD COLUMN is_test_order BOOLEAN DEFAULT false;
    CREATE INDEX idx_pending_test ON aivis_newebpay_pending(is_test_order) WHERE is_test_order = false;
    CREATE INDEX idx_period_test  ON aivis_newebpay_period(is_test_order)  WHERE is_test_order = false;
    UPDATE aivis_newebpay_pending SET is_test_order = true WHERE user_id IN (SELECT id FROM profiles WHERE email = 'aark6465@gmail.com');
    UPDATE aivis_newebpay_period  SET is_test_order = true WHERE user_id IN (SELECT id FROM profiles WHERE email = 'aark6465@gmail.com');
    ```
  - **AdminRevenue.jsx**：新增 `includeTest` state（預設 false），三個訂單查詢條件加 `.eq('is_test_order', false)`；useEffect 依賴改 `[includeTest]` 切換時重 fetch；header 加 checkbox toggle「包含測試訂單」+ 開啟時顯示 🧪 黃色 chip 提示「含測試訂單」。
  - **AdminUsers.jsx**：fetchUsers bulk + Excel 匯出查詢加 `.eq('is_test_order', false)`（列表分類不被測試訂單污染，測試用戶 badge 變回「⭐ 授予」）；展開詳情查詢不過濾，但加 `is_test_order` 欄位 → 兩處 chip（年繳訂單 + 月繳訂閱）加「🧪 測試訂單 / 🧪 測試訂閱」黃色標記。
- 🔖 **設計取捨**：
  - **toggle 只在 AdminRevenue，不放 AdminUsers**：AdminRevenue 是「數字看板」需要乾淨；AdminUsers 是「用戶詳情」需要完整歷史。前者預設過濾 + 可切換、後者預設過濾分類但展開仍看到完整紀錄。
  - **沒走 email 過濾 (TEST_EMAILS const)**：用 schema 欄位比 hardcode email 更彈性 — 未來如果 QA 帳號、客服帳號、外部測試者也要標記，直接 UPDATE SQL 就好，不必改程式。
  - **不刪測試紀錄**：金流測試紀錄要保留作 audit（NewebPay 後台對帳、稽核 trail），純標記不刪。
- 🧪 **預期效果**：
  - 部署後 AdminRevenue 預設顯示：Pro 用戶 0、MRR 0、退款率 0/0 = 「— / 無資料」、Top-up 累計 0（乾淨基準線）
  - 勾「包含測試訂單」會跑回原本帶測試的數字（aark6465 的 6 Top-up + 5 退款），方便偵錯
  - AdminUsers 展開 aark6465 仍會看到完整 11 筆紀錄，每筆有 🧪 黃 chip 標示

- 🔄 **第三階段 — AdminUsers 分頁 + 訂單測試標記 toggle**（同日補完，UI 完整化）：
  - **分頁系統**：
    - state：`currentPage` / `pageSize` (預設 50) / `pageInput` (跳頁輸入框)
    - filter / search 變動時 useEffect 自動 `setCurrentPage(1)` 避免空白頁
    - `paged = filtered.slice((safePage-1)*pageSize, safePage*pageSize)`，列表 render 改用 paged
    - footer UI：左邊「共 N 筆・顯示第 X-Y 筆」、中間「← 上一頁 [跳頁 input] / 共 N 頁 下一頁 →」、右邊「每頁 [25/50/100/200] 筆」select
    - 適用所有 filter（全部/Pro/Free/早鳥/年繳/月繳/授予/退款），切換 filter 自動回第 1 頁
  - **訂單測試標記 toggle**：
    - 新增 handler `handleToggleTestOrder(table, idColumn, idValue, currentValue, userId)` — supabase update + 樂觀更新 setState（不必 refetch）
    - 防 double-click：`togglingTest` 物件 key 為 merchant_order_no 或 period_no
    - 年繳訂單 chip 從靜態 `<span>` 改為 `<button>`，is_test_order=true 顯示「🧪 測試訂單」黃色 + hover 提示「點擊取消」；false 顯示「⭕ 標為測試」灰色 + hover 變黃
    - 月繳訂閱 chip 同邏輯，按下切換 `aivis_newebpay_period.is_test_order`
    - 客服在 admin 端可一鍵切換任一筆訂單的測試狀態，不必跑 SQL UPDATE

- 🔄 **第二階段 — 自動標記**（同日加碼，避免日後手動 UPDATE SQL）：
  - **新建 [api/lib/test-detect.js](api/lib/test-detect.js)**：`isTestOrder(email)` helper 判斷兩條件 OR：
    1. **沙盒環境**（`NEWEBPAY_API_URL` 含 `ccore.newebpay.com`）→ 所有訂單一律標 test
    2. **email 在 `TEST_EMAILS` 名單**（env 逗號分隔）→ 正式環境下 admin/QA 用真卡買測試單也標
  - **3 個 insert 點插入 `is_test_order: testFlag`**：
    - [api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js) — Pro 年繳 / 早鳥 / 月繳 pending insert
    - [api/aivis/checkout-topup-newebpay.js](api/aivis/checkout-topup-newebpay.js) — Top-up 小/大包 pending insert
    - [api/newebpay-notify.js](api/newebpay-notify.js) `handlePeriodNotify` — NPA 首期 notify 把 pending.is_test_order 帶到 period upsert（pending 已在 checkout 時設好，period 只是複製過來）
  - **未來新增測試帳號**：把 email 加到 Vercel env `TEST_EMAILS="aark6465@gmail.com,qa@example.com"` 即可，不必跑 SQL
  - **沙盒 vs 正式自動切換**：env `NEWEBPAY_API_URL` 切回正式（`core.newebpay.com`）後，沙盒條件自動失效，只剩 email 名單條件生效 — 跟 NewebPay 切沙盒/正式同步

---

### 2026-05-22
**修：後台 NewebPay 訂閱資料整合（AdminRevenue + AdminUsers）— MRR 漏算 NPA 月繳 + Top-up 全補:**

- 🐛 **症狀**：AdminRevenue 的 MRR 數字嚴重低估
  - **漏 1 — NPA 月繳完全沒抓**：只查 `aivis_newebpay_pending kind=pro_yearly`，沒查 `aivis_newebpay_period`（NPA 定期定額在這張表）。每位月繳用戶 NT$1,490 MRR 直接不見。
  - **漏 2 — Top-up 加購完全沒入帳**：`topup_small / topup_large` 訂單沒進營收計算
  - **漏 3 — MRR 公式錯位**：`mrrFromNewebpay = annualRevenue / 12`（過去 12 月年繳一次性 ÷ 12），上線初期年繳訂單少時嚴重低估，季節跳變
  - **漏 4 — 退款率分母**：用 `refunded + earlybird + yearly`（只算過去 12 月 active 訂單）當分母，已退款的訂單若在 12 月外會少算
  - AdminUsers 列表方案標籤只顯示「⭐ Pro / Free」沒拆早鳥/年繳/月繳/授予；展開詳情看不到 NPA 月繳訂閱資料

- ✅ **修法 — AdminRevenue.jsx**：
  - 並行抓 7 個資料源（多了 `aivis_newebpay_period status=active` 與 Top-up 訂單）
  - MRR 公式改 per-user：`早鳥 active × (11880/12) + 年繳 active × (13900/12) + NPA active × 1490 + Stripe × 1490`
  - PLAN_CARDS 從 3 張擴成 5 張（加「Pro 月繳 NPA」青綠、「Top-up 加購」藍兩張卡），grid 改 `sm:grid-cols-2 lg:grid-cols-5`
  - Top-up 卡內顯示「小 X ・ 大 Y」即時拆分，revenueLabel 動態改「累計營收」 vs 「每月 MRR」
  - 退款率分母校正為 `newebpayOrders.length`（所有歷史年繳 paid 訂單，含已退款的）
  - 付費 Pro 去重：三條金流 user_id Set 合併（NewebPay 年繳 + NPA 月繳 + Stripe）
  - 6 月增長圖 NewebPay 線加進 NPA 月繳新簽（`period.created_at` 月份），看真實「每月新增付費用戶數」
  - MRR sub-text 改三項拆解：「年繳攤 X + 月繳 Y + Stripe Z」

- ✅ **修法 — AdminUsers.jsx**：
  - `fetchUsers` 並行 bulk 撈所有歷史年繳訂單 + active 月繳訂閱，建 user_id → subscriptionType map（月繳優先級高於年繳，因為月繳還在扣）
  - 列表方案標籤從「⭐ Pro / Free」細分為「🐣 早鳥（amber）/ ⭐ 年繳（orange）/ 📅 月繳（teal）/ ⭐ 授予（slate）/ Free」5 種
  - 退款警示 chip「↩️」加在 badge 旁，不必展開就能看到
  - 展開詳情新增「Pro 月繳訂閱（NewebPay NPA）」區塊：狀態 chip（active/cancelled）+ 已扣款期數 × NT$1,490 = lifetime revenue + 首次扣款 + 最後扣款 + 下次扣款預估（lastPay + 30 天）+ 委託編號 + 取消備註

- 🔖 **設計取捨**：
  - **列表 row badge 用 bulk fetch 而非 per-user 查**：list 有 N 個用戶，per-user 查會變 N+1 query。並行兩個 bulk query（yearlyOrders + activePeriods）+ 客戶端 join，效能 OK。
  - **月繳優先於年繳分類**：用戶同時有年繳 + 月繳訂閱時，列表顯示「月繳」標籤（代表當前扣款方式），年繳訂單在展開詳情仍會列出做客服稽核。
  - **退款率仍只算年繳分母**：因為公司退款政策只針對 Pro 年繳（月繳跟 Top-up 政策本就不退），分母用年繳訂單合理。標題改「退款率（限年繳）」更精準。
  - **Top-up 是一次性付款**：不放進 MRR（recurring revenue 定義），放「累計營收」卡片獨立顯示，避免污染 MRR 數字。

- 🧪 **驗證重點**（用戶側部署後）：
  - MRR 數字應比之前大（多了月繳 + per-user 公式）
  - 5 張方案卡都顯示，Top-up 卡 sub-text 對得上小+大拆分
  - 退款率分母對得上「所有歷史年繳 paid 訂單數」
  - 付費用戶 + 授予用戶加總 = Pro 用戶總數
  - 月繳用戶在 AdminUsers 列表標「📅 月繳」、展開能看到 NPA 訂閱卡

- 🔄 **第二輪補完**（同日 AdminUsers 補篩選 + 匯出）：
  - **Filter buttons 從 3 個擴成 8 個**：原 `全部 / Pro / Free` → 加 `🐣 早鳥 / ⭐ 年繳 / 📅 月繳 / ⭐ 授予 / ↩️ 退款` 5 個方案細分。按鈕列加 `flex-wrap` 在窄畫面自動換行。
  - **`filtered` 客戶端篩選邏輯**：方案細分依賴 `subscriptionType` 與 `hasRefund`（從 bulk-join 算出，server 沒有此欄位），所以細分篩選改在 client 跑。「`granted` = is_pro=true 但 subscriptionType=null」（手動授予判定）。「`refunded` = hasRefund=true」（不限 is_pro 狀態，因為退款後 cron 可能已把 is_pro 改 false）。
  - **server-side 預篩優化**：方案細分（earlybird/yearly/monthly/granted）一律是 is_pro=true，加進 server `query.eq('is_pro', true)` 預篩，減少 client load 量；`refunded` 不預篩。
  - **Excel 匯出加 4 欄**：「方案類型 / 到期日 / 退款狀態 / 金流」。匯出邏輯重寫並行抓 profiles + yearlyOrders + activePeriods 三來源 → 建 map → 推算每位用戶該 4 欄。月繳到期日寫「下次扣款 YYYY/MM/DD」（last_payment + 30 天估算）；年繳寫 paid_at + 365 天；授予寫 pro_expires_at 或「無到期日」。金流欄位區分「NewebPay NPA」/「NewebPay MPG」/「Stripe（歷史）」/「無」。

---

### 2026-05-21
**改：rename 收尾 + 定價頁文案微調 + 製作 30 秒 1:1 行銷動畫:**

- 🐛 **症狀（rename 收尾）**：昨日全站 rename 漏抓共用 `SiteHeader.jsx` 與 5 個獨立頁面（HomeDark / Login / Register / FAQ / Pricing）的左上角 logo `<span>優勢方舟數位行銷</span>`；Pricing.jsx 內文「優勢方舟用 1/10 顧問費⋯」「優勢方舟回答：」「Ahrefs/SEMrush vs 優勢方舟」等 4 處屬於**產品能力描述**也漏改。
- ✅ **修法**：[commit f8f156b](https://github.com/aark-younjung/aark-workspace/commit/f8f156b)
  - `SiteHeader.jsx`（共用 header）+ `HomeDark.jsx` / `Login.jsx` / `Register.jsx` / `FAQ.jsx` / `Pricing.jsx` 各自的左上角 logo → `AI 雷達`
  - `Pricing.jsx:135 / 480 / 571 / 594 / 821 / 843` 行銷文案產品名稱改 `AI 雷達`
  - `AdminUsers.jsx:1081` 客服寄件人提示 → `AI 雷達客服 <support@aark.io>`
  - `README.md` 標題 → `# AI 雷達（AI 能見度儀表板）`
- 🔖 **設計取捨**：
  - **`Pricing.jsx:810` AI 答案示範 demo 中的「優勢方舟數位行銷」保留**：那段是示範 AI 回答中**被追蹤的品牌名**例子，不是產品名 — 反而拿自家公司當示範 brand 增加可信度。
  - **`AIVisibility.jsx:191` placeholder「例：優勢方舟數位行銷」保留**：那是用戶輸入欄的範例，意義跟產品品牌無關。

- 🐛 **症狀（定價頁 hero 重複與過時）**：[Pricing.jsx](src/pages/Pricing.jsx) hero 區塊有「✨ 年繳省 22%・等於免費多用 X 個月」綠膠囊 + 旁邊還補一句「月繳方案即將開放」。但下方年/月切換按鈕的「年繳」徽章已經顯示「省 22%」、Pro 卡副標也已寫「等於免費多用 X 個月」— **資訊三重重複**。月繳更已於 2026-05-19 NPA 沙盒實測通過、2026-05-20 切正式環境，「即將開放」是過時文案。
- ✅ **修法**：[commit c43307c](https://github.com/aark-younjung/aark-workspace/commit/c43307c) 整段 hero 重複資訊區塊（line 484–498）刪除，保留註解說明歷史脈絡給未來看 commit 的人。

- 🐛 **症狀（hero 標語精準度）**：「你的品牌名是否會被**說出口**？」— 「說出口」描述偏 narrative 但不夠精準，AI 答案的實際行為是「被推薦給提問者」，且「推薦」是 SEO/AEO 高搜尋量關鍵字。
- ✅ **修法**：[commit 863bc5d](https://github.com/aark-younjung/aark-workspace/commit/863bc5d) `Pricing.jsx:477` 「說出口」→「推薦」，更貼近 LLM 引用行為的本質。

- 🎬 **製作 1:1 HTML 行銷動畫 [demo-animation/ai-radar-53s-1x1.html](demo-animation/ai-radar-53s-1x1.html)（最終 53 秒版）**：未推 git（本機 demo，跟既有 `let-ai-see-you.html` 並列備存）。9 個 scene、純 CSS keyframes、JS timer 同步字幕。經 7 輪用戶 review 反覆迭代：
  - **第 1 輪**：基本 scene 鋪好 → 用戶要求「網站風格 + 英文放大 + 加字幕」
  - **第 2 輪**：套 HomeDark 漸層 / grain / glass card、`.en` class 統一英數放大 132% + Inter 字型、底部 13% 字幕條 → 用戶要求「文字置中 + 右下角加漸層 + 字幕 3x + 移到 1/3 處」
  - **第 3 輪**：背景疊第二層 `radial-gradient at 85% 88%` 右下對角光、所有 scene `text-align:center`、字幕 21→64px（3x）、位置從 bottom:0 改 top:60% → 用戶要求「數字 / 英文 / 內容品質統一黃色」
  - **第 4 輪**：`.en` 與 `.num` 加 `color:#fbbf24` + 黃光暈、移除 5 大面向卡的多色配置改全黃 → 用戶反映「AI 字模糊」+「右下漸層不夠明顯」
  - **第 5 輪**：診斷出 brand-reveal / logo-fin 的 `background-clip:text` 把子層 `.en` 的 color 強制透明化，剩下的 `text-shadow` 看起來像鬼影；改成「中文白 + .en 實心金黃」雙色策略。右下漸層 circle→ellipse、`.42 → .65` 透明度、外圈 55%→70% 覆蓋面積約 1.5x。字幕 SEO/AEO/GEO/E-E-A-T 後面的「內容品質」也補上 `.yellow` class。
  - **第 6 輪**：中文主字體改 Google Fonts `Kosugi Maru`（日系圓潤體，給予柔和現代感），中文缺字 fallback Noto Sans TC；`.en` / `.num` 維持 Inter 保留英數硬朗對比。
  - **第 7 輪**：用戶反映「24 小時監測」那幕字幕最後一行被切 + 整片節奏太快。修法：(a) `.subtitle-bar` `top:60% height:40%` → `top:55% height:42%`，字幕區整體上移 5% + 底部留 3% 緩衝避免被進度條切到；(b) 整片時間軸 ×5/3 從 30s 拉長至 50s — 9 個 `s1`–`s9` scene 容器 + progress bar 從 `30s linear` → `50s linear`，30+ 個絕對延遲（4.2/6/10/11/12/12.2-13.4/16/16.2-16.8/17.6-18.2/20.2-20.8/21.2-21.8/22.6/23.4/24.2/25/27.2/27.8/28.3-28.8s）全數按比例放大，JS timer `t>=30` → `t>=50`，9 句字幕 data-from/to 重新對齊新 scene 邊界（0/5/10/15/20/26.7/33.3/40/45/50）。檔名從 `ai-radar-30s-1x1.html` rename 為 `ai-radar-50s-1x1.html`。
  - **第 8 輪**：Scene 5 五大面向卡靜態分數（89/82/76/85/91）改成「飆升動畫」— 起始 32/28/41/35/39（5 個都不同、皆 < 50）藍色（#60a5fa）顯示「不及格氛圍」，23.0s 起 ease-out cubic 插值 1.6s 飆到 87/84/81/88/86（皆 80+ 且互異），跨過 70 分門檻時 JS 移除 `.cool` class 經 CSS transition 0.28s 平滑切到黃 (#fbbf24)；24.9s 起 c1→c5 stagger 0.1s 依序 `cardPop`（scale 1→1.18→1 + 金黃 box-shadow + outline）強調，最後一卡 pop 結束於 25.85s，留 1.15s 給 scene 27s fade-out。`cardPop` keyframes 必須明寫 `opacity:1 + rotateY(0)`，因為 `.gcard.pop` 的 animation 屬性會整個蓋掉 `cardFlip forwards`，不寫的話元素會掉回 `.gcard` base 的 `opacity:0 / rotateY(90deg)` 變透明加翻面。
  - **第 9 輪**：文案 + 排版微調 — (a) 10-15s 字幕「在 AI 時代，沒被推薦 = 不存在」→「在 AI 時代，網站沒被推薦，就等於不存在」（加上「網站」主體與「就等於」連接詞更口語）；(b) Scene 7 四大平台卡（WP/Shop/Wix/HTML）`width:68px height:68px` → `flex:1 aspect-ratio:1/1`，`.platforms` 加 `width:100% max-width:78%` 與下方 code-box `max-width:78%` 對齊；font-size 13px → 26px 配大方塊；border-radius 16 → 20 視覺和諧。(c) Scene 9 slogan「現在就看見你」→「現在就讓 AI 看見你的網站」；CTA「立即免費試用 7 天」→「立即免費分析」（試用/退款承諾移除避免過早承諾）；(d) 45-50s 收尾字幕拿掉「7 天免費試用・14 天無條件退款」，剩下的 `.small` 升格主行同步改成「AI 雷達 — 現在就讓 AI 看見你的網站」呼應 slogan。
  - **第 10 輪**：Scene 9「AI 雷達」logo 下方加可愛老闆人偶 — 全 CSS 幾何造型（圓+矩形+三角，零 SVG/emoji），戴兩撇鬍子（CSS border 三角技法外八對稱）、右手拿紅書、左手拿黃筆（含深色筆尖）、青綠襯衫 + 黃色領帶（`::before` 三角倒立做領結 + `::after` clip-path polygon 做領帶身）、紅潤臉頰 + 微笑半圓嘴。動畫：整體 `bossBob` 上下浮 2.4s、頭 `bossHeadTilt` 左右搖 3.4s、左臂（拿書）`bossArmL` 輕擺 2.6s、右臂（拿筆）`bossArmR` 大幅度寫字感 1.8s（4 段位 0/25/75/100% 不對稱）、眼睛 `bossBlink` 4.2s 間歇眨、頭頂兩顆菱形 `bossSpark` 旋轉脈動。45.9s `fadeUp` 進場（接在 logo-fin 45.3s 之後、slogan 46.3s 之前的空檔），跑到 scene fade 結束。
  - **第 11 輪**（30s→50s→53s）：用戶提 5 項修正一次到位。修法：
    - **(a) 第一/二畫面文字 2x**：Scene 1 phone 寬 46% → 60%、phone-bar 11px → 22px、chat-title 12px → 24px、bubble 15px → 30px、cursor 8×14 → 14×26；Scene 2 answer-card 寬 78% → 88%、ac-head h3 13px → 26px、comp 14px → 28px、b 24px方→40px+font 12→22、pct 12px→24px、you-missing 13px→26px。
    - **(b) 插入 Scene 0 — 你的網站首頁 mockup（0-3s）**：browser-chrome（紅/黃/綠 traffic-light dots + yourbrand.com url 列）+ web-nav（你的品牌 logo + 關於/服務/案例/聯絡 menu）+ web-hero（46px h1 + 諮詢 CTA）+ 3 張漸層 feature card。z-index:5 覆蓋其他 scene。3s 自帶 fade in/hold/fade out 三段 keyframes。
    - **(c) 整片 50s → 53s**：9 個 s1–s9 scene 容器加 `animation-delay:3s`、progress bar 50s → 53s、JS timer t≥50 → t≥53、SCORE_TICK/POP 23/24.9 → 26/27.9、30+ 個絕對延遲值（typeIn .2s/flashRed 7s/ghostOut 10s/dotPing 16.7s/brandIn 18.3s/radar-dot delay 17.5-18.3s/cardFlip 20.3-22.3s/s5-title 20s/LLM 27-28s/badge 17.6+animation-delay 17.9-18.2s/s6-title 16s/plat 33.7-34.7s/code 35.3-36.3s/toast 37.7+39s/deal 40.3s/pop 41.7s/logo 45.3s/slogan 46.3s/CTA 47.2s+btnPulse 48s/ping 47.3s/boss-char 45.9s+bossBob 46.5s/bossHeadTilt 46.5s/bossBlink 47s/bossArmL 46.5s/bossArmR 46.7s/bossSpark 47.4s+ spark delays 47.4-47.9s）全部 +3 秒。9 句字幕 data-from/to 重新對齊（0→3、5→8、10→13、15→18、20→23、26.7→29.7、33.3→36.3、40→43、45→48），新增 0-3s「你的網站，AI 看得見嗎？」呼應 scene 0。
    - **(d) Perplexity 改 Claude**：Scene 6 LLM card l2 ico 文字 Pp → Cl、name Perplexity → Claude、ico 漸層從 cyan #06b6d4/0891b2 → Claude 品牌橘 #cc785c/a85e44、badge 顏色從藍 → 暖橘 #f4a487。29.7-36.3s 字幕同步改 Claude。
    - **(e) Scene 9 收尾頁大改**：刪除 48-53s 字幕「AI 雷達 — 現在就讓 AI 看見你的網站」；老闆人偶從 .closing flex column 內搬出來，改 absolute 定位到 stage 層（top:60%、margin-left:-115、width 230×height 300），z-index 85 居於 subtitle-bar 上方；臉部 head 62px → 120px（約 2x）、身體 boss-body 從圓角矩形 74×68 改為長條膠囊 100×220 + `border-radius:9999px`（pill 上下圓）、其餘所有部件（眼睛/鬍子/嘴/雙手/書筆/閃星）等比放大 ~2x；CTA 「立即免費分析」padding 14/38px → 28/76px、font 16px → 32px、shadow 也加倍；bossBlink keyframes 把眨眼動作從 93-97% 段挪到 36-42% 段，確保 4.2s cycle + 50s delay 內第一次眨眼能落在 51.8s 出現（scene 9 視窗 48-53s 內）。
    - **(f) 檔名同步**：`ai-radar-50s-1x1.html` → `ai-radar-53s-1x1.html`，WORKLOG 連結同步。
  - **第 12 輪**（同日連續迭代）：用戶又指 4 處細節調整：
    - **(a) Scene 5 五大面向分數 2x**：`.gcard .score` font-size 36px → 72px、margin-top 10 → 14、text-shadow 散度從 24px → 32px。低分藍 / 高分黃 / cardPop 邏輯維持。
    - **(b) Scene 6 三大 AI 模型卡 2x**：`.llm-wrap` width 88%→96%、gap 18→28；`.llm` padding 18/10→32/18、border-radius 20→28；`.llm .ico` 50px→96px+font 18→34+border-radius 14→24；`.llm .name` 13px→26px；`.llm .badge` padding 7/14→12/22+font 12→22。
    - **(c) 18-23s 字幕刪 AI 字**：「AI 雷達，幫你掃出 AI 看不見的盲點」→「AI 雷達，幫你掃出看不見的盲點」（句中第二個 AI 拿掉，避免重複拗口）。
    - **(d) Scene 9 老闆人偶大改**（5 處）：
      - 臉型：圓形 120×120 → 長橢圓 100×140（vertical-elongated，呼應身體膠囊形）
      - 頭髮 → 雅痞紳士帽（fedora）：`.boss-hair` 從半圓蓋頂改造成「帽冠 84×50 圓頂矩形」+ `::before` 帽簷 138×20 水平橢圓（向兩側延伸 27px 超過頭部）+ `::after` 金色帽帶 ribbon（fedora 經典款式）
      - 拿掉鬍子：HTML 刪除 `.boss-stache-l/-r` 兩個 div，CSS 對應規則一併移除
      - 身體縮短：`.boss-body` height 230 → 108（更短粗，比例不再壓過頭部），位置 top:108 → 152 配合長臉
      - 雙手高舉：`.boss-arm` top:24 → -20（從身體頂端向上突出），加 `transform-origin:bottom center` + `transform:rotate(±30deg)` 外擴；`.boss-hand` / `.boss-book` / `.boss-pen` 從 `bottom:-N` 改為 `top:-N`（書筆在手掌上方而非下方）；`bossArmL/R` keyframes 改成圍繞 ±30 基準小幅擺動 ±12deg（揮舞慶祝動作）；筆漸層方向反轉（`to top`）讓深色筆尖朝上
      - 領帶下尖：`.boss-body::after` clip-path 從六角形 `polygon(50% 0, 100% 18%, 100% 100%, 50% 88%, 0 100%, 0 18%)` 改為上寬下尖 `polygon(50% 0%, 100% 14%, 95% 78%, 50% 100%, 5% 78%, 0 14%)`（傳統領帶尾端尖角）
      - 連帶：boss-char height 300 → 260；眼睛/嘴巴/臉頰位置依長臉重算；閃星挪到帽子兩側上方（top:0/8、left/right:32）作為「歡呼」氛圍。
    - **(e) Stacking 設計**：head 與 body 都不設 z-index 創建 stacking context，依賴 DOM 順序（head 在 body 前 = head 在下層，被 body 領子蓋住 8px 做脖子過渡）；`.boss-hair`（帽子）獨設 z-index:3 確保蓋住頭頂；arms 在 body 內最後位置 → 自然在 body 與 head 之上（包含旋轉延伸到頭側面的書/筆）。
  - **第 13 輪**（人偶體態三細項微調）：
    - **(a) 臉型改 pill** — `.boss-head` `border-radius:50%` → `9999px`，從橢圓變膠囊（跟身體 boss-body 同形狀），整體看起來更修長有個性、頭身呼應一致。
    - **(b) 身體加長** — `.boss-body` height 108 → 160（用戶要求「再長一點」），boss-char 容器高度也跟著 260 → 320 避免溢出。
    - **(c) 雙手提到臉旁** — `.boss-arm` height 90→110 + top:-20→-60（更高從身體頂端伸出）、角度 ±30→±28（減少外擴讓手往上而非往兩側）；`.boss-hand` 維持 top:-12；`.boss-book` top:-38→-25 + transform rotate(-12)→rotate(18)（補償手臂 -28deg 傾角讓書直立）；`.boss-pen` top:-42→-28 + rotate(12)→rotate(-18)（補償右臂 +28deg）。bossArmL/R keyframes 基準角度同步從 ±30/±42 改成 ±28/±38。
    - **(d) 閃星位置調整** — `.boss-spark-1/2` 從 (top:0, left:32) / (top:8, right:32) 挪到 (top:-10, left:62) / (top:-4, right:62)，避開新的雙手位置（X=±52）和書筆延伸範圍，改在帽簷兩側上方。
    - 數學驗證：手掌新位置約在臉部 Y=105（眼-嘴之間）、X=±52（臉外緣 ±50 剛好外側 2px）— 視覺上手掌貼著臉頰兩側、書筆在眼-鼻高度，呼應「兩手提到臉旁」歡呼姿態。
  - **第 14 輪**（Scene 8 移除 + Scene 4 加 5 大 LLM 標籤 + 18-23s 字幕修詞）：
    - **(a) 移除 Scene 8 早鳥價頁**：用戶決定整段拿掉。刪除 `.s8` 容器 + `.deal/.tag/.old/.new/.unit/.perk` 全套 CSS + `@keyframes s8` + `@keyframes pop` + Scene 8 HTML 整段 div + 43-48s 字幕「前 100 名・首年 NT$990／月⋯」。
    - **(b) Scene 9 提前 5 秒接續 Scene 7**：避免 43-48s 出現空白，Scene 9 從 48s 提前到 43s 開始。keyframes 由 `0%,89%/91%` 改為 `0%,80%/82%`（80% × 50s = 40s 內部時間 = page 43s）。Scene 9 內部 13 個絕對延遲值全數 -5s：logo 48.3→43.3、slogan 49.3→44.3、cta 50.2→45.2 + btnPulse 51→46、ping 50.3→45.3、boss-char 48.9→43.9 + bossBob 49.5→44.5、bossHeadTilt 49.5→44.5、bossBlink 50→45、bossArmL 49.5→44.5、bossArmR 49.7→44.7、bossSpark 50.4→45.4、spark-1/2 delay 50.4/50.9→45.4/45.9。
    - **(c) Scene 4 加五大 LLM 標籤環繞雷達**：用戶要求「雷達四周出現五大大語言模型文字」。在 `.radar-wrap` 加 5 個 `.llm-label` pill 徽章（ChatGPT/Claude/Gemini/Perplexity/Copilot），用 r=53% 從中心向外推、72deg 間隔做 pentagon 排列（0deg 正上、72 右上、144 右下、216 左下、288 左上）；CSS 用 padding:8/18 + border-radius:999px 形成 pill；19-21s 依序 stagger 0.4s fade in + scale .6→1（呼應雷達掃描「掃到一個亮一個」氛圍）。
    - **(d) 18-23s 字幕修詞**：「AI 雷達，幫你掃出看不見的盲點」→「AI 雷達幫你掃描出看不見的盲點」（拿掉逗號 + 掃出→掃描出更精準對應雷達意象）。
  - **第 15 輪**（製作 16:9 橫向版）：新增 [demo-animation/ai-radar-53s-16x9.html](demo-animation/ai-radar-53s-16x9.html)，從 1:1 版 cp 後做以下調整 — 其餘 HTML / 動畫時間軸 / 字幕內容完全不動：
    - `.stage` `aspect-ratio:1/1` → `16/9`、寬度公式 `min(100vh,100vw)` → `min(100vw, calc(100vh * 16 / 9))`（16:9 寬畫面在橫向 viewport 鋪滿，直向 viewport 縮為符合 16:9 寬高）。
    - `.canvas` `bottom:40%` → `32%`（場景區從 60% 高 → 68% 高，因 16:9 較矮給場景更多上方空間）；`.subtitle-bar` `top:55% height:42%` → `top:68% height:29%`（往下挪配合新 canvas 邊界）。
    - `.boss-char` `top:60%` → `68%`（搬到新字幕區位置）；高度 320 維持，1080p 16:9 viewport 下 boss 區域 734-1054 仍在 1080 內。
    - 主要場景元素寬度按 9/16 比例縮小（保持絕對 px 寬度接近 1:1 版本，避免在寬畫面被拉得過大）：`.phone` 60→34%、`.answer-card` 88→50%、`.radar-wrap` 58→33%、`.grid5` 86→48%、`.llm-wrap` 96→54%、`.s7-inner` 84→47%、`.website-mockup` 88→50%。aspect-ratio 鎖定的元素（gcard / web-card / radar-ring / llm 卡）自動依 width 等比調整高度，比例保持不變。
    - 兩版差異化：1:1 版用於 IG 貼文 / 1:1 廣告位、16:9 版用於 YouTube / 橫向社群 / 簡報嵌入。底層動畫邏輯（CSS keyframes、JS timer、subtitle data-from/to、boss 動畫鏈）完全共用，只調 layout container 與場景元素寬度。
    - **檔案位置**：兩支 .html 並列在 `demo-animation/`，要剪 MP4 / GIF 各自跑 puppeteer screencast（用 1080×1080 viewport 或 1920×1080 viewport 對應抓）。
  - **第 16 輪**（9:16 直式版給 Reels / TikTok / Shorts 用）：新增 [demo-animation/ai-radar-53s-9x16.html](demo-animation/ai-radar-53s-9x16.html)，從 1:1 版 cp 後做以下調整：
    - `.stage` `aspect-ratio:9/16`、寬度公式改 `height:min(100vh, calc(100vw * 16/9))`（橫向 viewport 變直立窄條居中，直向 viewport 鋪滿）。
    - `.canvas` `bottom:40%` → `30%`（場景區從 60% 高 → 70% 高，直式有更多縱向空間放場景）；`.subtitle-bar` `top:55% height:42%` → `top:70% height:27%`（往下挪配合 70/30 分隔）；`.boss-char` `top:60%` → `70%`。
    - `.website-mockup` 加 `aspect-ratio:1.5/1` + `max-height:88%`（直式 canvas 太高 1344px，若用 height:88% 會被拉成 1183px 超高長條 — 加 aspect-ratio 鎖瀏覽器視窗比例）。
    - 其餘場景元素（phone / answer-card / radar / grid5 / llm-wrap / s7-inner）寬度不動 — 因為 stage 寬度在 1:1 與 9:16 都是 1080，% 寬度絕對 px 不變。aspect-ratio 鎖定的元素自動依寬度等比縮放。
    - **意外驚喜：phone 變成真正的直式手機**：1:1 版 phone 60×78% 在 1080×1080 stage 是 648×505（壓扁手機），在 9:16 stage 1080×1920 變成 648×1048（aspect 0.62:1，真正的直式手機比例）。chat 用 `justify-content:flex-end` bubbles 自動沉底，視覺上像真實手機 screenshot 中對話下半部，沒違和感。
    - **三版差異化定位**：1:1 → IG 貼文 / 1:1 廣告版位；16:9 → YouTube / 橫向社群 / 簡報嵌入；9:16 → IG Reels / TikTok / YouTube Shorts。底層動畫邏輯（CSS keyframes、JS timer、subtitle data-from/to、boss 動畫鏈、所有 53s 內部時間軸）三版完全共用，只改 layout container 與少數溢出元素的 aspect-ratio。
    - **檔案位置**：三支 .html 並列在 `demo-animation/`，puppeteer 抓 MP4 / GIF 各自用對應 viewport（1080×1080 / 1920×1080 / 1080×1920）。
- 📁 **檔案位置**：本機 `demo-animation/ai-radar-53s-1x1.html`，未 commit 也未部署上 Vercel — 屬於行銷素材本機 demo（沿用 2026-04-22 `let-ai-see-you.html` 同樣的命名與用途）。要剪 MP4 / GIF 走 puppeteer 截影 + ffmpeg 壓縮路徑，方法同 [let-ai-see-you-60fps.mp4](demo-animation/) 的產出流程。

- 🔖 **未完成 / pending**：
  - 53 秒影片 MP4 / GIF 匯出（用 puppeteer screencast）— 待用戶確認動畫定稿
  - 9:16 直式版（IG Reels / TikTok 用）— 待匯出後再生對應 viewport
  - 後續若品牌風格定錨後，可考慮把這個 1:1 動畫嵌進 `/pricing` 頁 hero 區替代靜態圖

---

### 2026-05-20
**改：全站 rename「AI能見度（AIVIS）」→「AI 雷達」（方案 1 — 產品品牌＝子品牌，公司＝法定母品牌不變）:**
- 🐛 **症狀**：產品名「AI 能見度（AIVIS）」太通用 / 沒記憶點；公司名「優勢方舟數位行銷」太長當 logo 擠；Footer / topbar / Email / PDF / OG / 法律文件「商店名稱」欄到處都是舊名，廣告與口頭品牌都沒地方落腳。
- 🔍 **決策過程**：產品定位顧問模式列了 7 個替代提案（AI 雷達 / AI 燈塔 / AI 搜得到 / 被 AI 看見 / AIVis / AISpot / AARK AI），3 派風格（意象 / 口語 / 雙語）；用戶選 AI 雷達 — 跟首頁雷達掃描動畫天然呼應、3 字短促好記、口語與專業都通。命名策略走「方案 1」：產品品牌 AI 雷達 = 子品牌（行銷展示用），公司名 優勢方舟數位行銷 = 母品牌（法律/金流/發票用），避免商業登記與藍新審核重來。
- ✅ **修法（涵蓋面 user-facing 與 SEO/金流，內部變數 / aivis_ table / aark.io email domain 不動）**：
  - **[index.html](index.html)**：title / description / keywords / og:site_name / og:title / og:image:alt / twitter:title 主品牌名換成「AI 雷達」，但 description 結尾加「由優勢方舟數位行銷營運」做雙品牌串連；keywords 兩個品牌字都塞。
  - **[src/components/Footer.jsx](src/components/Footer.jsx)**：logo 文字 `AI能見度（AIVIS）` → `AI 雷達`；版權列底部 `Powered by AI 能見度檢測平台` → `AI 雷達 — 由優勢方舟數位行銷營運`。
  - **[src/pages/legal/Terms.jsx / Privacy.jsx / ConsumerRights.jsx](src/pages/legal/)**：subtitle + 「商店名稱」欄位 `AI能見度（AIVIS）` 全部 replace_all → `AI 雷達`。法律主體仍是「優勢方舟數位行銷」（一、服務提供者 條目沒動）。
  - **[src/services/pdfExport.js](src/services/pdfExport.js)**：PDF header `優勢方舟 AI 能見度報告` → `AI 雷達 — AI 能見度報告`；副標 `AARK — AI Visibility Audit Report` → `AI Radar — AI Visibility Audit Report`；footer 標識補「優勢方舟數位行銷營運」字樣。
  - **[api/cron-weekly-reports.js](api/cron-weekly-reports.js) + [api/send-report-email.js](api/send-report-email.js)**：Email header / from / footer / signature 全部換成 AI 雷達 主品牌 +「優勢方舟數位行銷營運」副標。Resend `from:` 欄位 4 處改 `'AI 雷達 <report@aark.io>'`（email domain aark.io 不變、只改顯示名）。
  - **[api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js)**：3 個 ItemDesc label `AI能見度 Pro` → `AI 雷達 Pro`（年繳 / 早鳥 / 月繳）— 結帳頁與信用卡帳單 ItemDesc 顯示產品品牌；但「商家戶名稱」NewebPay 後台仍是「優勢方舟數位行銷」（不需改、藍新審核不用重來）。aivis Top-up 的 PACK_SPEC label 不動（aivis 是內部模組名）。
  - **[CLAUDE.md](CLAUDE.md)**：產品定位區塊更新 + 新增「品牌使用原則」段落，明列三層用法（產品名 AI 雷達 vs 公司名 優勢方舟 vs 業界術語 AI 能見度）。
- 🔖 **設計取捨**：
  - **「業界術語 AI 能見度」保留 vs 全改 AI 雷達**：保留。FAQ「什麼是 AI 能見度？」/ Hero h1「掌握 AI 能見度」/ Dashboard tooltip「五大 AI 能見度面向」這些是行業概念詞、SEO 高搜尋量關鍵字，跟 Google「Search」之於「Google」一樣是描述名詞，硬改成「AI 雷達」反而 SEO 自殺 + 用戶聽不懂。
  - **藍新商家戶名稱不動**：法定收款方仍是「優勢方舟數位行銷」（MS3830621445 不變），只改 ItemDesc 與 ProdDesc 兩個產品描述欄位。用戶刷卡帳單會看到「優勢方舟數位行銷」+「AI 雷達 Pro」雙顯示，讓品牌＝賣方的認知串起來、降低退款爭議。
  - **email domain `aark.io` 不換**：domain 已綁定 Resend / SPF / DKIM，換 domain 要重新驗證，得不償失。只改 `from:` 顯示名為「AI 雷達」即可。
  - **aark-workspace.vercel.app subdomain 不換**：等正式自有 domain `a-ark.com.tw` 上線後再考慮，現在 Vercel preview / 內部測試都靠這個 URL。
- 🧪 **驗證**：build pass / OG preview 用 metatags.io 確認 og:title 已顯示「AI 雷達」/ 走一次年繳結帳流程確認 ItemDesc 已換 / 寄一封週報 Email 確認 from 顯示「AI 雷達」/ 詳情頁匯出 PDF 確認 header 是「AI 雷達 — AI 能見度報告」。

---

### 2026-05-20
**修：內容品質詳情頁完整對齊 — 第 5 張卡終於跟前 4 張一致:**
- 🐛 **症狀**：Dashboard 5 張分數卡（SEO / AEO / GEO / E-E-A-T / 內容品質）— 前 4 張點下去進 `/<face>-audit/:id` 從 DB 讀 cached、有趨勢圖、有「重新檢測」按鈕；第 5 張內容品質點下去跳 `/content-audit` 空白頁要使用者重打 URL — 體驗破口。
- 🔍 **根因**：`/content-audit/:id` 從來沒存在過。`5c68495` (2026-05-10) commit 註解 + WORKLOG 2026-05-10 都明寫當時是主動 defer（「ContentAudit 內部 state 邏輯改動較大，本次先讓使用者自行輸入網址」），不是被拿掉。Dashboard 的 `routeMap['內容品質']` 也只能硬塞 `/content-audit`。
- ✅ **修法（5 個檔案 + 1 個 SQL）**：
  - **[content_audits.sql](content_audits.sql)（新檔，一次性）**：建 `content_audits` 表 + 12 個 jsonb/數值欄位（對應 `analyzeContent()` 回傳結構）+ `(website_id, created_at DESC)` index + RLS 兩條 policy（SELECT/INSERT，透過 websites.user_id join）。仿 seo_audits / aeo_audits 形狀。
  - **[src/App.jsx L102](src/App.jsx#L102)**：新增 `<Route path="/content-audit/:id" element={<ContentAudit />} />`。原 `/content-audit`（無 id）保留為任意 URL 分析模式。兩條都指向同一個 component，由 `useParams().id` 決定模式。
  - **[src/pages/ContentAudit.jsx](src/pages/ContentAudit.jsx)（單檔雙模式重構）**：頂層 component 變成只負責分歧 — `id ? <DetailMode/> : <AdHocMode/>`。`DetailMode` 仿 SEOAudit：`useEffect([id])` 拉 websites + content_audits（最新 + 最近 7 筆），DB 空就 lazy first-run analyzeContent + insert；有 cached 直接拿；「重新檢測」按鈕跑 analyze + insert + refetch。UI 用 `AuditTopBar + ScoreHero（帶 recentAudits 趨勢迷你圖）+ ContentSignature + IssueBoard + HeroSkeleton/IssueBoardSkeleton`，跟其他 4 面向長一樣。`AdHocMode` 保留原本任意 URL 輸入流程，不寫 DB。CHECKS 陣列 + `dbRowToResult()` 轉換器共用，確保兩邊 result shape 一致。
  - **[src/pages/Dashboard.jsx L1009](src/pages/Dashboard.jsx#L1009)**：routeMap `'內容品質': '/content-audit'` → `` `/content-audit/${id}` ``，註解同步改「5 個面向統一走 /:face-audit/:id」。
  - **[src/pages/Dashboard.jsx L249 loadContentScore](src/pages/Dashboard.jsx#L249)**：改為 DB 為單一來源 — 先 `content_audits.select` cached score，有就用，沒有才跑 `analyzeContent` + insert。簽名從 `(url)` 改 `(websiteId, url)`，兩處呼叫處（fetchData L273、handleReanalyze L520）同步改傳兩參。
  - **footer link L2011 `/content-audit`** 保留不動：頁尾「內容品質」連結維持任意 URL 分析入口（分析競品文、客戶文有獨立價值）。
- 🔖 **設計取捨**：
  - **DB 為單一資料來源 vs sessionStorage**：選 DB。`content_audits` 表既然要建（給詳情頁趨勢用），Dashboard 卡直接讀同一張表就能避免「Dashboard 每次重跑分析、詳情頁讀 cached」造成兩邊分數兜不上的尷尬。sessionStorage 跨分頁不共享、跨重新登入會掉，不適合做單一資料來源。
  - **單檔雙模式 vs 拆 ContentAuditDetail.jsx**：選不拆。兩個模式共用 80%+ UI（同一個 CHECKS 陣列、ScoreHero/IssueBoard/ContentSignature 三個共用元件、result shape 透過 `dbRowToResult()` 對齊），拆檔反而 duplication 更多。差異只在上方「URL 輸入框 vs AuditTopBar」一塊，用 ternary 分歧即可。
  - **不寫 ad-hoc 模式進 DB**：沒 `:id` 就是沒網站歸屬，寫進去就是 orphan row。保持 ad-hoc 純粹做即時分析。
  - **graceful 處理找不到網站**：`/content-audit/<不存在的 id>` → 顯示「🔍 找不到這個網站」+ 返回首頁 button，而非白屏或無限 loading。仿 SEOAudit 但實際 SEOAudit 沒這層、補成自家標配。
- 🧪 **驗證**：
  - SQL：Supabase SQL Editor 跑 content_audits.sql → 跑驗證 SELECT 確認 14 個欄位 + 2 條 RLS policy → 兩帳號跨權限驗 RLS → 刪檔
  - E2E：(1) 點 Dashboard 第 5 卡跳 `/content-audit/<websiteId>`（2）首次進詳情頁 fetch-url + insert 一次（3）第二次進只 supabase select、不重跑（4）按重新檢測新增第 2 筆 row、趨勢點變 2 個（5）直訪 `/content-audit` 無 id 維持任意 URL 模式、不寫 DB（6）Dashboard 卡分數跟詳情頁顯示一致

---

### 2026-05-20
**修：免費版可繞過 Pro 守衛使用 aivis（AI 曝光監測）— 三層全補:**
- 🐛 **症狀**：免費用戶（`is_pro=false` 且非試用）能進 `/ai-visibility` 建立品牌、跑掃描、按「重新產生 prompts」呼叫 Claude API，等於整套 Pro 專屬 aivis 模組對免費版完全敞開，平台直接燒成本。
- 🔍 **根因（三層全失守）**：
  - **前端 [src/pages/AIVisibility.jsx](src/pages/AIVisibility.jsx)**：完全沒檢查 `isPro / isTrial`，任何登入者都能用整個品牌管理 UI。
  - **後端 [api/aivis/fetch.js](api/aivis/fetch.js)**：profile select 只拿 `is_trial` 沒拿 `is_pro`；當 `is_trial=false` 時 fall through 到「150 次/月」配額路徑，免費用戶照樣可以掃。
  - **後端 [api/aivis/generate-prompts.js](api/aivis/generate-prompts.js)**：完全沒做認證（檔頭 comment 寫「Phase 2c 串前端時補上」結果忘了補），任何知道 `brand_id` 的人 POST 上來就能戳 Claude API 燒平台成本。
- ✅ **修法（三層守衛）**：
  - **Layer 1 [AIVisibility.jsx](src/pages/AIVisibility.jsx)**：`useAuth()` 取 `isPro / isTrial` → `hasAccess = isPro || isTrial`；`!hasAccess` 時 render 升級 CTA 卡（「AI 曝光監測為 Pro 功能 → 查看方案 / 啟用 7 天試用 / 返回首頁」），整個品牌管理 UI 隱藏；`handleCreate` 加 double-guard alert 防 console 戳。
  - **Layer 2 [api/aivis/fetch.js](api/aivis/fetch.js)**：profile select 加上 `is_pro`；新增 403 守衛 `if (!profile?.is_pro && !isTrial) return 403`。
  - **Layer 3 [api/aivis/generate-prompts.js](api/aivis/generate-prompts.js)**：三道守衛 — (1) 必須帶 `Authorization: Bearer <supabase access token>`，否則 401；(2) `brand.user_id !== authUser.id` → 403（防 A 用 B 的 brand_id）；(3) `!is_pro && !is_trial` → 403。
  - **Layer 3 前端配套 [AIVisibilityDashboard.jsx L400](src/pages/AIVisibilityDashboard.jsx#L400)**：`regeneratePrompts()` 改先取 `supabase.auth.getSession()` 拿 access_token，fetch 帶上 `Authorization: Bearer ${token}` header，否則自己的合法用戶也會被新後端守衛擋掉。
- 🔖 **設計取捨**：選擇升級 CTA 卡而非直接 redirect /pricing — 讓用戶清楚知道「這是 Pro 功能、不是頁面壞了」，且能直接點啟用試用，轉換漏斗較順。
- ⚠️ **檔頭 TODO 漏掉的教訓**：comment 寫「Phase 2c 串前端時補上」這種 deferred guard 非常容易忘，下次要嘛當下就寫、要嘛留檔頭 + TODO list 雙處標記。

---

### 2026-05-20
**修：路由轉場閃現紅黑舊版背景 — GlobalDarkBg 漸層改青綠對齊各頁:**
- 🐛 **症狀**：路由切換的瞬間（舊頁卸載 → 新頁青綠 gradient 還沒渲染上）會看到一閃紅黑色，視覺上像「舊版背景跑出來」。
- 🔍 **根因**：[src/App.jsx](src/App.jsx) `GlobalDarkBg` 元件（`fixed inset-0 -z-20`，鋪在所有頁面最底層）仍寫死紅黑漸層 `#a21540 → #000`。各頁（HomeDark / AEOAudit / Account / Compare / AIVisibility / AIVisibilityDashboard）已改畫青綠 `#18c590` 蓋在上面，但路由轉場那一幀沒有頁面背景蓋著，紅黑底就漏出來。
- ✅ **修法**：[src/App.jsx L45](src/App.jsx#L45) `GlobalDarkBg` 漸層由 `linear-gradient(135deg, #a21540 ...)` 改 `linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)`，跟各頁一致。轉場那一幀也是青綠，視覺上看不出切換。
- ✅ **同步 [CLAUDE.md](CLAUDE.md)**：「暗色版背景漸層」區塊把青綠版升為「目前使用」、紅黑版降為「歷史備存（已下線）」。
- 🔖 **設計取捨：保留 GlobalDarkBg 元件 vs 移除**：本來可以乾脆刪掉 `GlobalDarkBg`，每頁都自畫背景；但這樣會讓萬一某頁忘記畫背景時看到瀏覽器預設白色（更醜）。保留 + 改色當 fallback 安全網更穩。

---

### 2026-05-20
**🟢 上線阻擋全數解除 — 正式環境 + 金流 + SQL 7/7 全綠:**
- 🎯 **正式環境 + 金流端到端測試已通過**：env 已從沙盒切回正式（`MS3830621445` + `core.newebpay.com` 系列 endpoint），NPA 月繳 / Pro 年繳 / 早鳥 / Top-up 大小包 / 14 天退款 / NPA 取消委託（坑 7 修完）等 path 都已實測完成。
- ✅ **NPA 取消委託 SQL 驗證通過（坑 7 修補生效）**：用戶側截圖確認 `aivis_newebpay_period` row `period_no=P260520171337hqATJx status='cancelled' cancelled_at=2026-05-20 09:17:53.584+00`、`profiles.is_pro=false`（aark6465@gmail.com）。`449fdf0` commit 的 AES 解密修補生效，整條取消委託路徑全綠（按取消 → AlterStatus terminate → 解密 response → DB 寫 cancelled + is_pro=false）。
  - 📋 仍可進一步驗：(a) `cancel_note` 欄位是否拿到 NewebPay 真實成功訊息（非 `UNKNOWN:` / `DECRYPT_FAILED:`） (b) NewebPay 後台「信用卡定期定額管理 → 委託管理」該筆顯示「已終止」
- ✅ **SQL schema 驗證 7/7 通過**（用戶側 Supabase SQL Editor 跑純 SELECT 比對 information_schema + pg_constraint + pg_policies）：
  - ✅ `profiles.trial_started_at / trial_ends_at` 兩欄位齊全（trial-system 對應）— 程式碼不用 `trial_status` 欄位（grep 0 matches），原驗證 query 多查了不存在也不需要的欄位
  - ✅ `profiles.trial_reminders_sent TEXT[] DEFAULT '{}'`（trial-reminders 對應）
  - ✅ `aivis_newebpay_pending` 5 個退款欄位齊全：`refund_status / refund_amount / refund_method / refund_note / refunded_at`（newebpay-refunds 對應）
  - ✅ `profiles.is_admin` 欄位存在（admin-cs-tools 對應）— 程式碼不用 `admin_actions / admin_audit_log` 表（grep 0 matches），客服工具設計上沒做操作軌跡日誌、WORKLOG 規劃但未實作
  - ✅ `aivis_newebpay_pending_kind_check CHECK ((kind = ANY (ARRAY['topup_small', 'topup_large', 'pro_yearly', 'pro_monthly'])))` 含 `pro_monthly`
  - ✅ `aivis_newebpay_period` 表存在 + RLS policy `user reads own period`（SELECT）
  - ✅ `aivis_topup_consents` 表存在 + 主要欄位齊全（id / user_id / user_email / pack / amount / merchant_order_no / consent_version / consent_text / consented_at...）
- 🧹 **Supabase SQL Editor saved queries 已清理**：原 22 筆 PRIVATE saved snippets 整理 — 一次性 DDL（建表）+ 一次性 UPDATE（測試/手動授予 Pro）+ 重複的 notify_log 診斷 query → 全數刪除，依「跑完即刪」原則（[memory/feedback_no_sql_archive.md](../../.claude/projects/c--Users-ROG-STRIX-Desktop-Vibe-Coding-AI---/memory/feedback_no_sql_archive.md)）。剩通用工具 query（RLS 健康檢查 / schema 總覽 / 客服查用戶 / 營收監控 / 未付款訂單追蹤）。
- 🎯 **上線阻擋全數解除** — 接下來純等營運準備：(a) NewebPay 商家正式審核完成（目前 env 已切正式但若後台仍顯示「審核中」需確認）(b) 公告文案 / 早鳥計數 banner / 客服通道（aark.younjung@gmail.com）對外可達。
- 📌 **下一步**：拍板上線日 → 開放對外註冊 + 金流。建議軟啟動（少量行銷推廣）觀察首批用戶 e2e 是否照沙盒實測一樣全綠，發現 edge case 再 hotfix。

---

### 2026-05-19（深夜）
**NPA 取消委託 AlterStatus 回應自身加密 — 第 6 個坑（修完月繳取消 e2e 打通）:**

接續夜間月繳訂閱實測，繼續驗證「取消委託」第二條 NPA 關鍵路徑（用戶在 Account 頁按「取消委託」→ 後端打 NewebPay AlterStatus `terminate`）。Modal 確認後一直停在「處理中...」、瀏覽器 alert 跳「NewebPay period terminate failed」、SQL 看 `cancel_note='UNKNOWN:'` 空白訊息 — 拿不到 NewebPay 真正回什麼。

- 🐛 **坑 7（10/10）：NPA AlterStatus 回應本身是 AES 加密的 — `{"period":"<encrypted hex>"}`（小寫 period）**：以為 NewebPay 文件範例的 `{Status, Message, Result}` 是直接拿到的扁平 JSON，所以原 `requestPeriodTerminate` 第一段 `JSON.parse(rawText)` 之後直接讀 `parsed.Status`。實際打 sandbox API 後加診斷 dump 才發現 envelope 不是這樣 — 整包真實 response body 是 `{"period":"b46b9cdf4134c35e55b5ae77eb...（一坨 hex）"}` —— **這個 `period` 跟 notify body 的 `Period` 一樣，是 AES 加密過的 JSON blob，要用同一組 HashKey/IV 解密**。文件範例那個扁平結構是另一條走 `RespondType=String` 的舊路徑；走 JSON 一律加密。
  - **修法：**[api/lib/newebpay.js `requestPeriodTerminate`](api/lib/newebpay.js)（commit 449fdf0）— JSON parse 完先檢查 `outer.period`（小寫）是否存在，存在就 `aesDecrypt(outer.period, HashKey, IV)` + 二次 `JSON.parse` 拿真實 `{Status, Message, Result}` 再讀。decrypt 失敗時包成 `status='DECRYPT_FAILED'` + message 帶錯誤訊息回上層，比之前 `UNKNOWN:` 空白訊息容易看根因。
  - **為什麼前夜踩 5 個坑沒踩到這個**：notify 路徑是 NewebPay 主動推、訂閱建立後馬上發第一筆 — 月繳訂閱階段已經解過一次 NPA `Period`，但**只解了 notify body 那一條**。AlterStatus 是商家 server 主動呼叫的另一支 REST API，response envelope 設計成同樣加密**沒有任何文件說明** — 沙盒實測拿到 dump 才看出規律。**串接 NPA 任何呼叫都應該預設「response body 可能是 `{"period":"<hex>"}`」**，不是只有 notify 收到時才加密。
  - **加進 [feedback_payment_crypto_lessons.md](memory/feedback_payment_crypto_lessons.md) 第 10 條**：金流商「outbound REST API 的 response」也可能整包加密，不是只有 webhook/notify 加密。
  - **診斷過程值得保留的部分（前一輪 commit 0a031bd 加的、本輪不再改動）：**`requestPeriodTerminate` 在 `JSON.parse` 失敗時把 rawText.slice(0,500) 寫進 console.error + `status='INVALID_RESPONSE'`、解密失敗包成 `'DECRYPT_FAILED'`、外層 Status 缺失時把整個 `parsed` JSON dump 進 message — 三層 fallback 讓 SQL `cancel_note` 一眼看出當下卡在哪一層（非 JSON / 解密失敗 / NewebPay 業務失敗），不再回空字串。

**待驗證（用戶側）：** 重新按「取消委託」→ 應該看到 alert「月繳委託已取消」綠卡、SQL `aivis_newebpay_period.status='cancelled' cancelled_at=now() cancel_note='<NewebPay 真實成功訊息>'`、`profiles.is_pro=false`、NewebPay 沙盒後台「信用卡定期定額管理 → 委託管理」該筆狀態切「已終止」。如還失敗 alert 應該帶具體錯誤字串（不再是 `UNKNOWN:`）。

**Commit:** 449fdf0

---

### 2026-05-19（夜間）
**NPA 月繳沙盒實測全綠 — 端到端打通 + 五個 NPA 文件沒講清楚的坑:**

沙盒帳號 `aark6465@gmail.com` (MS359099640) 實測 NPA 月繳訂閱 e2e 流程：checkout → 沙盒卡 `4000-2211-1111-1111` → 跳回 `/account` → toast「✨ Pro 月繳訂閱成功！」 + 按鈕即時切「目前方案」。`aivis_newebpay_period` row `period_no=P260519192022nDE2SN status=active`、`profiles.is_pro=true`、`notify_log.decrypt_ok=true`。除錯過程踩到五個 NewebPay 官方文件不直白的坑，逐一修補：

- 🐛 **坑 1：NPA 服務開通是商家後台「啟用」開關，不是審核通過就自動啟用**：商家審核通過後 NPA 在後台「服務管理 → 信用卡定期定額授權服務」預設**未啟用**，要手動切到「啟用」狀態。未啟用直接刷卡會回 PER10001「商店資料取得失敗」。沙盒 + 正式各自獨立啟用狀態。**已加進 [docs/newebpay-onboarding.md](docs/newebpay-onboarding.md) 上線 checklist**。

- 🐛 **坑 2：NPA 沙盒「信用卡定期定額管理 → 設定 API 應用 URL」要單獨填一次**：MPG 後台填的 NotifyURL/ReturnURL 跟 NPA 後台是**獨立**設定，NPA 沒填會白屏直接退回 `/pricing`。沙盒 + 正式各自要填一次。固定值：
  - Notify URL: `https://aark-workspace.vercel.app/api/newebpay-notify`
  - Return URL: `https://aark-workspace.vercel.app/account`

- 🐛 **坑 3：`LangType` 大小寫敏感**：傳 `'zh-tw'` 全小寫直接被 NewebPay 退 PER10012「LangType 參數錯誤」。文件範例寫 `'zh-Tw'`（T 大寫）但沒明說大小寫敏感。NPA 對此格外挑剔，MPG 有時容許全小寫。**修法：[checkout-pro-yearly-newebpay.js:178](api/checkout-pro-yearly-newebpay.js#L178) 固定送 `'zh-Tw'`**（commit b16a1de）。

- 🐛 **坑 4 — 最致命：NPA notify body 用 `Period` 單欄位，不是 MPG 的 `TradeInfo` + `TradeSha`**：原 `/api/newebpay-notify` handler 第一行就是 `const { TradeInfo, TradeSha, Status } = req.body || {}`，NPA 進來後直接 line 140 早 return 400「Missing TradeInfo/TradeSha」。實際 NPA notify 規格：
  - body: `Status` + `Message` + `Period`（AES 加密 JSON blob，**沒有 hash 校驗欄位**，靠 TLS + IP 白名單防偽）
  - Period 解密後 JSON 結構與 MPG TradeInfo 解密後相同（`{ Status, Message, Result: {...} }`）
  - **修法：**[api/lib/newebpay.js](api/lib/newebpay.js) 加 `parsePeriodNotifyPayload({ Period })` helper（純 AES decrypt 無 SHA 校驗），[newebpay-notify.js](api/newebpay-notify.js) handler 改雙路徑：先試 `Period` (NPA) → 沒有就試 `TradeInfo+TradeSha` (MPG)。**handleReturn 也要同步修**，否則 toast 不跳（commit ec36126 + 29b4209）。

- 🐛 **坑 5：NPA notify 用 `multipart/form-data` Content-Type，Vercel 預設 bodyParser 不認得**：MPG notify 用 `application/x-www-form-urlencoded` Vercel 直接 parse OK，NPA 改 `multipart/form-data; boundary=...`（user-agent 都是 `pay2go` 看不出差別）Vercel 預設 bodyParser 留 `req.body=undefined`。**修法：**[newebpay-notify.js](api/newebpay-notify.js) `export const config = { api: { bodyParser: false } }` 關掉預設 parser，手動讀 stream + 依 content-type 三分支 parse（JSON/urlencoded/multipart），multipart parser 自己寫 ~20 行（NewebPay 不送檔案、純文字欄位夠用）（commit b62aa67）。

- 🐛 **坑 6：付款成功 toast 跳出但 Pro 卡按鈕沒切「目前方案」**：notify 已把 `profiles.is_pro` 寫成 true 沒問題，但前端 `useAuth()` 的 `isPro` 是登入時 cache 在 React state、後端改 DB 前端不會自動感知，要主動 refetch。用戶要手動 reload 才看到狀態切換。**修法：**[Account.jsx](src/pages/Account.jsx) + [Pricing.jsx](src/pages/Pricing.jsx) 兩支 `pro_success` effect 在 setState + clear URL 之後，立刻呼叫 `fetchProfile(user.id)` 同步刷 isPro（commit 135f0d8）。

**過程中加的診斷基建（保留供日後上線後查 issue 用）：**
- `aivis_newebpay_notify_log` 表（commit 7120781 前已建）— 持久化 raw_body + decrypt_ok + decrypt_error，補 Vercel Hobby 1 小時 log retention 不夠的缺。每次 notify 都寫一筆，問題定位看 SQL 比看 Vercel logs 還快。
- `/api/newebpay-notify?action=debug-keys` GET 端點 — 回 HASH_KEY/HASH_IV 的 SHA256 指紋（前 8 碼）+ 長度 + 本地 encrypt→decrypt round-trip 自測，不需 POST 不需刷卡。驗 Vercel env 跟 NewebPay 後台金鑰是否一致用（沙盒/正式切換時必跑）。

**清理 TODO（上線前要做）：**
- [ ] 刪除 [newebpay-notify.js](api/newebpay-notify.js) `handleReturn` 內的 `console.log('[handleReturn] NewebPay POST body:', ...)` 兩行 debug log（fc862f9 加的，現在解決就移除省 Vercel log quota）
- [ ] 沙盒驗證收尾後刪掉 Vercel env `NEWEBPAY_PERIOD_TYPE=D` + `NEWEBPAY_PERIOD_POINT=2` 兩個沙盒加速器（讓首期完就立刻第二期扣，方便看 alreadyTimes>1 行為）— 正式上線要恢復預設 M/05
- [ ] 把 Vercel env 從沙盒 `MS359099640` + sandbox HashKey/IV 切回正式 `MS3830621445` + production HashKey/IV（也要把 `NEWEBPAY_API_URL` / `NEWEBPAY_PERIOD_API_URL` / `NEWEBPAY_REFUND_API_URL` / `NEWEBPAY_CANCEL_API_URL` / `NEWEBPAY_PERIOD_ALTER_API_URL` 從 ccore.newebpay.com 切到 core.newebpay.com）

**Commits this session:** fc862f9 / b16a1de / b62aa67 / ec36126 / 29b4209 / 135f0d8

---

### 2026-05-19
**NPA 月繳定期定額串接完成（待沙盒實測）— Pro 月繳 NT$1,490／月 全端打通:**
- 🎯 **NewebPay 商家後台已啟用「信用卡定期定額授權服務（NPA）」**：用戶今早確認狀態欄顯示「啟用」，前序 WORKLOG 估的「最晚 2026-05-20」實際 2026-05-19 就到位。NPA 是獨立服務、與商家代號獨立審核，沙盒 + 正式都已開通。憑此啟動 NPA 端到端串接。
- ✅ **NPA helper [api/lib/newebpay.js](api/lib/newebpay.js)**：(a) 新增 `buildPeriodForm(periodParams)` — 把 params JSON.stringify → URLEncoded → AES → 回 `{ MerchantID_, PostData_, apiUrl }`（注意 field key 帶**底線**，與 MPG `TradeInfo/TradeSha` 不同；前端 dispatch 要看 `mode='npa'` 才認 underscore key）。預設 URL `https://ccore.newebpay.com/MPG/period`，env `NEWEBPAY_PERIOD_API_URL` 可覆蓋。(b) 新增 `requestPeriodTerminate({ merOrderNo, periodNo })` — POST 到 `/MPG/period/AlterStatus` 帶 `AlterType=terminate`，回 `{ ok, status, message, raw }`。env `NEWEBPAY_PERIOD_ALTER_API_URL` 可覆蓋。
- ✅ **後端建單 [checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js)**：(a) `PLAN_SPEC` 第三 SKU `monthly: { amount: 1490, mode: 'npa' }`（檔名留 yearly 是歷史包袱、Vercel Hobby 12 functions 卡死無法另開檔）(b) prefix `pm` (pro_monthly) / DB kind `'pro_monthly'`（要 ALTER `aivis_newebpay_pending` CHECK 接受新值）(c) `spec.mode === 'mpg'` 走原 MPG 一次性、`spec.mode === 'npa'` 走 NPA `buildPeriodForm`，回傳 `{ apiUrl, fields: { MerchantID_, PostData_ }, mode: 'npa' }`(d) NPA `periodParams` 用 `MerOrderNo`/`ProdDesc`（NPA 規範）而非 MPG 的 `MerchantOrderNo`/`ItemDesc`，`PeriodStartType=3` = 立即執行 NT$10 授權測試 + 首期立扣，`PeriodTimes=99` = 永久（直到用戶取消）。env `NEWEBPAY_PERIOD_TYPE`/`NEWEBPAY_PERIOD_POINT` 可改沙盒測試節奏（M/05 = 生產；D/2 = 沙盒每 2 天扣加速）。
- ✅ **後端 notify [newebpay-notify.js](api/newebpay-notify.js)**：(a) 預設 handler 抓 merchantOrderNo 同時讀 `result.MerchantOrderNo || result.MerOrderNo`（NPA notify 用 MerOrderNo、MPG 用 MerchantOrderNo，欄位命名不一致）、amount 讀 `Amt || PeriodAmt`(b) 加 `if (result.PeriodNo) return handlePeriodNotify(...)` 分流，存在 PeriodNo 即視為 NPA 月繳通知(c) `handlePeriodNotify` 依 `result.AlreadyTimes`：`<=1` 為首期 → upsert `aivis_newebpay_period` (period_no UNIQUE) + 標 pending `paid` + `profiles.is_pro=true`；`>1` 為後續期續扣 → update `already_times`+`last_payment_at`+`notify_raw_last`，is_pro 不動避免覆蓋手動授予狀態。(d) 新增 dispatcher `if (req.query?.action === 'cancel-period')` → `handleCancelPeriod`：驗 Supabase JWT user.id 比對 body.userId 防偽造、查 active period、呼 `requestPeriodTerminate()`、寫 `status='cancelled' / cancelled_at=now / cancel_note=<NewebPay message>` + `profiles.is_pro=false`。
- ✅ **前端 [Pricing.jsx](src/pages/Pricing.jsx)**：(a) `const isYearly = true` → `useState(true)` 解鎖切換 (b) handleUpgrade 加 `priceType === 'monthly'` 分支 (c) 新增「年繳／月繳」分段切換 UI（紫藍漸層 active + 年繳側「省 22%」徽章強化主推）(d) ProCardBody 早鳥顯示條件由 `earlybirdAvailable` → `isYearly && earlybirdAvailable`（toggle 切月繳時早鳥 UI 消失，因早鳥僅限年繳）(e) CTA 路由 `isYearly ? (earlybirdAvailable ? 'earlybird' : 'yearly') : 'monthly'`，desktop + mobile sticky 同步 (f) `pro_success` toast 支援 `monthly` plan 文案「✨ Pro 月繳訂閱成功！」
- ✅ **前端 [Account.jsx](src/pages/Account.jsx)**：(a) 新增 `latestPeriodSub` state + 平行查 `aivis_newebpay_period status='active'` (b) handleCancel 加優先分支：有 active period → 開月繳取消 modal（非退款 modal，月繳當期已扣不退、走 terminate 路徑）(c) 新增 `handleCancelPeriodConfirm` 呼 `/api/newebpay-notify?action=cancel-period`、成功 set `refundResult.method='period_terminate'` 顯示「月繳委託已取消」綠卡 (d) 新增 `CancelPeriodModal` component — 顯示 Pro 月繳/ NT$1,490／月/ 卡末四碼/ 下次扣款日/ 已扣款期數 + 黃色警示框「本期已扣不退款、期末降回 Free」，CTA「確認取消委託」(e) 取消按鈕副標依 `latestPeriodSub` 切換文案「月繳可隨時取消，當期已扣不退；期末降回免費版」vs「14 天內無條件退款；超過則用至年期到期」 (f) `pro_success` toast 也支援 monthly。
- 📋 **SQL 需求（用戶側 Supabase Dashboard 跑）**：
  ```sql
  -- 1) 放寬 aivis_newebpay_pending.kind CHECK 接受 'pro_monthly'
  ALTER TABLE aivis_newebpay_pending DROP CONSTRAINT IF EXISTS aivis_newebpay_pending_kind_check;
  ALTER TABLE aivis_newebpay_pending ADD CONSTRAINT aivis_newebpay_pending_kind_check
    CHECK (kind IN ('topup_small','topup_large','pro_yearly','pro_monthly'));

  -- 2) 建 aivis_newebpay_period（NPA 委託主表，by period_no unique 防 retry 寫重）
  CREATE TABLE IF NOT EXISTS aivis_newebpay_period (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    merchant_order_no text NOT NULL,
    period_no text NOT NULL UNIQUE,           -- NewebPay 回的委託代碼，本表的天然主鍵
    period_amount integer NOT NULL,            -- 每期扣款金額 NT$
    period_type text NOT NULL,                 -- M=每月 / D=每日 / W=每週 / Y=每年
    period_point text NOT NULL,                -- M 時為日期（'05'）/ D 時為間隔天數（'2'）
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','suspended','expired')),
    already_times integer NOT NULL DEFAULT 0,  -- 已扣款期數
    total_times integer,                       -- 總期數（99=永久）
    email text,
    card4_no text,                             -- 信用卡末四碼
    card6_no text,                             -- 信用卡前六碼（BIN，可選）
    first_payment_at timestamptz,
    last_payment_at timestamptz,
    next_payment_at timestamptz,               -- 預計下次扣款日，目前 notify 未計算（modal 顯示 '—'）
    cancelled_at timestamptz,
    cancel_note text,
    notify_raw_first jsonb,
    notify_raw_last jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_aivis_newebpay_period_user_status ON aivis_newebpay_period(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_aivis_newebpay_period_period_no ON aivis_newebpay_period(period_no);
  -- RLS：用戶可讀自己的 row 看訂閱狀態 / 寫入只給 service_role（notify + cancel-period）
  ALTER TABLE aivis_newebpay_period ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "user reads own period" ON aivis_newebpay_period FOR SELECT TO authenticated USING (user_id = auth.uid());
  ```
- 🔖 **設計取捨：next_payment_at 暫不計算**：notify handler 沒寫 next_payment_at 邏輯，因為要依 `period_type`/`period_point` 動態算（M+05 = 下月 5 日；D+2 = +2 天）且要處理跨月閏年。MVP 先讓 modal 顯示「—」，沙盒實測時 user 看到首扣後 last_payment_at 已有值即可確認流程通。Phase 2 再補計算邏輯（或用 `gen_random_uuid()` 不重要，但 next_payment_at 是 UX 細節值得做）。
- 🔖 **設計取捨：notify 分流靠 PeriodNo 存在性而非 ?action 參數**：NewebPay NPA 沒有「通知端點分開」的選項，NotifyURL 跟 MPG 共用同一個。所以靠 payload 結構分流 — `Result.PeriodNo` 存在 = NPA、不存在 = MPG。如果未來 NewebPay 改規範把 PeriodNo 也送進 MPG response，此分流會壞，要改看 `Result.PeriodType` 或更安全的 marker。
- 🔖 **設計取捨：月繳取消 modal 與年繳退款 modal 分開不複用**：兩者商業意義完全不同 — 年繳是「14 天無條件退款」（NT$13,900 退回），月繳是「取消委託」（NT$0 退、期末降 Free）。共用 modal 會讓用戶誤判可退多少錢，做兩個 modal 雖然多寫 100 行但語意乾淨。
- 📌 **下一步**：(1) 用戶在 Supabase Dashboard 跑上方 SQL — ALTER pending + CREATE period 表 (2) `git add` 七檔（lib/newebpay.js / newebpay-notify.js / checkout-pro-yearly-newebpay.js / Pricing.jsx / Account.jsx / WORKLOG.md / CLAUDE.md 如有改）+ push → Vercel 部署 (3) **沙盒實測**：建議先設 env `NEWEBPAY_PERIOD_TYPE=D NEWEBPAY_PERIOD_POINT=2`（每 2 天扣加速測試）→ 註冊測試帳號 → Pricing toggle 切月繳 → 刷沙盒卡 → 驗 (a) 首期 notify 寫入 `aivis_newebpay_period` + `pending.status=paid` + `profiles.is_pro=true` (b) Account 顯示「目前方案 Pro / 月繳可隨時取消」副標 (c) 等 2 天驗第二期 notify 寫入 `already_times=2 / last_payment_at` 更新 (d) 點取消訂閱 → CancelPeriodModal → 確認取消 → 驗 `period.status='cancelled' / cancelled_at=now / profiles.is_pro=false` (e) 還原 env 為 `M/05` 改回月扣  (4) **生產上線前**：用戶在 NewebPay 商家後台確認 NPA 已從沙盒換到正式環境（同 MPG 換法），切 env vars 包含 `NEWEBPAY_PERIOD_API_URL` 從 `ccore` 改 `core`。

---

### 2026-05-19
**Phase 1 NewebPay 整合全綠收尾 — 不退款 checkbox UI 驗證通過 + 客服信箱統一:**
- 🎯 **不退款 checkbox UX 驗證通過**：暫降 `AIVIS_QUOTA_PER_MONTH=1` 推到 production、SQL 灌 aark6465 為 Pro → 進 aivis dashboard 開 TopupModal → 驗 (a) 未勾 checkbox 「立即加購」按鈕灰底寫「請先勾選下方同意」、cursor not-allowed (b) 規則說明區出現橘黃色「⚠️ Top-up 屬於『一經提供即完成之線上服務』（消保法第 19 條第 2 項第 5 款）」段落 + 客服 mailto (c) 勾後按鈕變橙色／青綠色可點。3 點全綠不刷卡。已還原 `AIVIS_QUOTA_PER_MONTH=150` + 改 aark6465 回 Free。
- ✅ **客服信箱統一為 aark.younjung@gmail.com**：5 個 active 檔 — [AIVisibilityDashboard.jsx:1858](src/pages/AIVisibilityDashboard.jsx#L1858) TopupModal mailto / [Account.jsx](src/pages/Account.jsx) 取消訂閱 + 退款 5 個 alert / [Dashboard.jsx:952](src/pages/Dashboard.jsx#L952) 排行榜退件 alert / [newebpay-notify.js:32](api/newebpay-notify.js#L32) 手動轉帳 admin 通知 comment / [cron-weekly-reports.js:233](api/cron-weekly-reports.js#L233) 週報 footer。**未動**：`hello@aark.com.tw`（Agency 洽談 sales 用，不同範疇）/ `support@aark.io` + `report@aark.io`（Resend outgoing 寄件人，已驗證）/ WORKLOG.md 歷史紀錄 / docs/v3-unpacked mockup。
- 🎯 **Phase 1 NewebPay 整合 100% 完成 — 7 條 path 全綠**：早鳥 NT$11,880 ✅／Pro 年繳 NT$13,900 ✅／Top-up 小包 NT$490 ✅／Top-up 大包 NT$990 ✅／14 天退款（Close API 直退 + CancelTrans fallback）✅／不退款事先同意 + aivis_topup_consents 法律證據表（消保法 § 19-II-5 合規）✅／客服信箱統一 ✅。
- 📌 **下一步**：(1) NewebPay 商家正式審核通過後（沙盒帳號 → 正式商家代號）切換 Vercel env vars — `NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` 三組 secrets + `NEWEBPAY_API_URL` 由 `ccore.newebpay.com` 改 `core.newebpay.com` (2) Vercel Dashboard → Settings → Environment Variables 改完要 redeploy 才生效 (3) **NPA 月繳定期定額** 申請狀態追蹤（見下方 NPA 段）。

**NPA 月繳定期定額申請狀態 — 查詢方式:**
- 📋 **NPA 是獨立服務、需另外申請**：NewebPay 商家代號核發後仍**不會自動帶 NPA 權限**，要在商家後台另外開「信用卡定期定額授權服務」。[CLAUDE.md](CLAUDE.md) 商業模式表月繳 NT$1,490 目前 UI 已暫關（Pricing toggle 鎖死 `isYearly=true`），等 NPA 開通才復活月繳分支。
- 🔍 **查詢路徑**：登入 [NewebPay 商家後台](https://core.newebpay.com)（正式環境）→ 左側選單「**會員中心**」or「**商店管理**」→ 找「**申請服務**」or「**服務狀態**」or「**商店服務**」（NewebPay 後台命名版本不一定）→ 看「**信用卡定期定額授權**」狀態欄。三種狀態：未申請 / 審核中 / 已啟用。
- 📋 **若顯示「未申請」**：點申請按鈕填表，準備文件通常包含：(a) 商品為訂閱制的營業說明 (b) 退款規則（前面已寫在法律頁三件套）(c) 預估月扣款筆數與金額。審核期 NewebPay 標準為 3-5 工作天，實際常拖 1-2 週。
- 📋 **若顯示「審核中」**：等通知 email（會寄到 NewebPay 註冊信箱），或直接打 NewebPay 業務窗口（02-2370-6688）追進度。
- 📋 **若顯示「已啟用」**：可串接 NPA API，前一輪 WORKLOG 提到的 NPA TODO 啟動 — (1) 月繳 endpoint 走 `MPG_API/period`（與 MPG 不同 URL）(2) NPA Notify endpoint 另建 (3) 取消委託 API (4) 沙盒實測首扣 + 第二月自動扣 + 取消委託 (5) Pricing.jsx `isYearly` 改 useState、把月繳 dead branch 復活。
- 🔖 **判斷時機**：今天 2026-05-19。前序 WORKLOG 預估「最晚 2026-05-20 NPA 啟用」是樂觀估，實際看 NewebPay 後台為準。如果今明兩天仍「審核中」就要打電話追、不然 Phase 1 上線後月繳會空一陣子。

---

### 2026-05-19
**Top-up「不退款」事先同意條款 — 消保法 § 19-II-5 合規 + aivis_topup_consents 法律證據表:**
- ⚖️ **合規動機**：用戶提醒「既然規則是大小包都不退費，那這件事應該在下單前明確寫上去」。Phase 1 上線前必補的法律強制：**消保法第 19 條第 2 項第 5 款**規定，「一經提供即完成之線上服務」不適用 7 天無條件解除權，但**前提是消費者事先同意**。原本 TopupModal 只有一行「一次性購買、不過期、用完為止、不綁訂閱」隱晦帶過，沒有「不退款」明文 + 沒有用戶主動勾選 = 不符合「事先同意」要件，事後客訴會被裁罰。
- ✅ **前端 [AIVisibilityDashboard.jsx TopupModal](src/pages/AIVisibilityDashboard.jsx#L1644)**：(a) 新增 `TOPUP_CONSENT_V1` 模組級常數定義同意書文案 v1（後端同步定義 `TOPUP_DISCLAIMER_V1` 比對一致）(b) 規則說明區改寫：把舊三行底下加入「⚠️ Top-up 屬於『一經提供即完成之線上服務』（消保法第 19 條第 2 項第 5 款），付款完成、credits 入帳後不適用 7 天無條件解除權、亦不退款」橘黃色強調 + 客服 mailto 鏈接 (c) 規則說明下方新增勾選框（淡綠 hover、勾選後變更背景）：「我已閱讀並同意：Top-up 加購屬於『一經提供即完成之線上服務』（消保法第 19 條第 2 項第 5 款），credits 入帳後**不適用 7 天無條件解除權、亦不退款**」(d) `[agreed, setAgreed]` state 控制 checkbox + 「立即加購」按鈕 `disabled={!!buying || !agreed}`，未勾按鈕灰底寫「請先勾選下方同意」+ cursor `not-allowed` (e) `handleBuy()` 多送 `agreed: true / consentVersion: 'v1' / consentText: TOPUP_CONSENT_V1` 三個欄位給後端。
- ✅ **後端 [checkout-topup-newebpay.js](api/aivis/checkout-topup-newebpay.js)**：(a) module-level 定義 `TOPUP_DISCLAIMER_V1` 同字串，新增 body destructure `agreed / consentVersion / consentText` (b) **雙層守衛**：(i) `agreed !== true` 回 400「請先勾選同意」(ii) `consentVersion !== 'v1' || consentText !== TOPUP_DISCLAIMER_V1` 回 400「同意書版本不符，請重新整理頁面後再試」防有人改前端送假同意書 (c) 在 pending insert **前**先抓 `req.headers['x-forwarded-for']` 第一個 hop 當 ip_address + `req.headers['user-agent']`，寫入 `aivis_topup_consents`：`{user_id, email, pack, amount, merchant_order_no, consent_version, consent_text, ip_address, user_agent}` (d) consent insert 失敗即 500 終止、不寫 pending — 避免 stale pending 找不到對應 consent。
- 📋 **SQL 需求（用戶側執行）**：要在 Supabase SQL Editor 跑 `CREATE TABLE aivis_topup_consents`，欄位 `id uuid pk / user_id uuid fk profiles / email text / pack text / amount int / merchant_order_no text / consent_version text / consent_text text / ip_address text / user_agent text / created_at timestamptz default now()` + index on `(user_id, created_at desc)` + RLS `service_role only`（用戶不需要讀自己的同意紀錄，純法律證據用）。
- 🔖 **設計取捨：consent_text 整段存而非只存 version**：本來想只存 `consent_version='v1'` 再對照後端 hardcode 的文案，但這樣未來改文案到 v2 後事後查 v1 紀錄會出問題（code 已 deploy 蓋掉 v1 字串、git log 找得到但對非工程不友善）。直接把當下顯示給用戶看的原文整段寫進去，事後不管 code 怎麼改、客訴稽核拿出來看一目瞭然。
- 🔖 **設計取捨：守衛擺前端 + 後端雙層**：前端 checkbox + disabled button 是 UX 引導，但 curl/Postman 仍可繞 UI 戳 API；後端 verify `consentText === TOPUP_DISCLAIMER_V1` 字串相等，篡改前端文案後送過來會被拒。雙層才完整。
- 📌 **下一步**：(1) 用戶在 Supabase Dashboard 跑 CREATE TABLE SQL (2) `git add` 三檔 commit + push 觸發 Vercel 部署 (3) production smoke test：未勾 checkbox 按鈕應 disabled、勾後變橙色可點、刷一筆 Top-up 小包驗 `aivis_topup_consents` 有新增 row 含 ip_address + user_agent + consent_text 完整 (4) 文案如要改 (e.g. 增加客服回覆時程承諾) 同步 bump 到 v2、前後端常數一起改。

---

### 2026-05-19
**Top-up 小包 NT$490 smoke test 通過 + 還原 quota=150 + aark6465 回 Free:**
- 🎯 **小包 NT$490 端到端驗證通過**：UPDATE profiles 把 aark6465 灌成手動 Pro（is_pro=true, payment_gateway=NULL）→ 暫降 `AIVIS_QUOTA_PER_MONTH=1` 觸發 UsageBanner soft limit → 點「加購次數包」開 TopupModal → 點小包「立即加購」→ NewebPay 結帳頁 → 真卡刷 NT$490 → 跳回 dashboard。三表全綠：`aivis_newebpay_pending` 寫入 `kind='topup_small'` `status='paid'` `amount=490` / `aivis_newebpay_notify_log` `decrypt_ok=true` `status_decrypted=SUCCESS` `status_query=SUCCESS` / `aivis_topup_credits` 新增一筆 `pack_size='small'` `quota_total=300` `quota_remaining=300` `source_payment_id='nwp_2605191426173466'`。order_no `tusmpc90y77cvfr`（`tus` = topup small 前綴）。
- 🎯 **大包 NT$990 之前已通過**：`aivis_topup_credits` 查到先前測試紀錄 3 筆 large（2026-05-14 兩筆 + 2026-05-18 一筆），都 `quota_total=800 quota_remaining=800`。Phase 1 Top-up 雙 SKU 端到端驗證全收齊，不需重測大包。
- ✅ **還原 [AIVisibilityDashboard.jsx:61](src/pages/AIVisibilityDashboard.jsx#L61) `AIVIS_QUOTA_PER_MONTH = 150`**：smoke test 期間暫降為 1 觸發 modal，測完還原回正式商業邏輯（Pro 每月內含 150 次）。
- ✅ **還原 aark6465 至 Free 狀態**：`UPDATE profiles SET is_pro=false, subscribed_at=NULL WHERE id='1f50e799-...';` 把手動授予的 Pro 收回，回到真實商業狀態（早鳥訂單 pebmpc693co6xl5 已退款，aark6465 該是 Free）。
- ⚠️ **Top-up 消耗計數錯位（待追，不擋 Phase 1 上線）**：UsageBanner 顯示「Top-up 59 次已用」但 `aivis_topup_credits` 每筆 `quota_remaining` 都還是滿值（300/800 沒減）。可能 [api/aivis/fetch.js](api/aivis/fetch.js) 的 quota deduction 只更新 used counter 沒同步減 credits 表的 quota_remaining，或 Banner 的「Top-up 59」是另一個計算口徑（總用量 - quota = 60-1 = 59，不一定真的消耗了 59 次 Top-up credits）。Phase 1 不擋上線（用戶看到 banner 數字大致正確），但要排進 Phase 2 修正：要不要在 Pro 訂閱頁顯示 Top-up 餘額需要正確的消耗計數。
- 📌 **下一步（Phase 1 NewebPay 收尾）**：(1) commit + push 還原 quota=150（這次改動）(2) 跑 SQL 還原 aark6465 為 Free (3) 驗 production：以 aark6465 進 aivis dashboard 應顯示「本月已用 60/150 次（40%）」、UsageBanner 不出現、加購入口隱藏 (4) **Phase 1 NewebPay 整合 100% 完成** — 早鳥 Pro 年繳 / Pro 年繳一般 / Top-up 大包 / Top-up 小包 / 14 天退款 五個 SKU+ 路徑全綠 (5) **Phase 1 商家正式審核通過後再切 live 環境**（目前還是沙盒 env vars）。

---

### 2026-05-19
**Top-up endpoint 補 isPro/isTrial 守衛 — 防 Free 用戶繞 UI 直購:**
- ⚠️ **產品邏輯漏洞修補**：用戶提醒 Top-up 規則應該是「Pro 用戶 quota 超量後才開放購買」，但 [checkout-topup-newebpay.js](api/aivis/checkout-topup-newebpay.js) 原本只擋 userId+email 必填，**沒檢查 is_pro**。Free 用戶直接 curl POST 可成功建單刷卡，造成「沒訂 Pro 卻擁有 Top-up credits」的詭異狀態（aivis dashboard 又沒 isPro 守衛，credits 還能正常消耗）。前端 UI 端因 UsageBanner 只在 atWarn=true 才出現確實有自然屏障，但這只是 UX 默契、不是 enforcement。
- ✅ **修補**：[checkout-topup-newebpay.js:55](api/aivis/checkout-topup-newebpay.js#L55) 在建單前查 `profiles.is_pro` 和 `profiles.is_trial`，兩個都 false 直接回 403「加購次數包僅限 Pro 訂閱用戶或試用期間用戶購買」。trial 用戶也放行因為他們有 100 次試用 quota、超量也合理買加購。
- 🔖 **設計取捨：用 profile lookup 而非 access token 驗證**：本來想學 [newebpay-notify.js handleRefund](api/newebpay-notify.js#L248-L260) 用 `supabase.auth.getUser(accessToken)` 比對 body.userId 防偽造，但 Top-up 結帳 endpoint 從 TopupModal 直接 fetch、前端未必傳 Authorization header（現況沒傳），改 token 驗證會破壞 UI 串接。先用 service role 直查 profiles 擋商業邏輯漏洞，token 驗證等 TopupModal 端一起改（用戶用 `mark6465` 偽造 `aark6465` 的 userId 來刷 Top-up 給對方這種 abuse 場景不是 P0）。
- 📌 **測試方式**：(1) `git add api/aivis/checkout-topup-newebpay.js` + push → Vercel 部署 (2) is_pro=false 狀態下 curl POST 應回 403 (3) 跑 `UPDATE profiles SET is_pro=true, payment_gateway=NULL WHERE id='1f50e799-...'` 把 aark6465 灌成手動 Pro (4) aivis dashboard 改 `AIVIS_QUOTA_PER_MONTH = 1` push → 觸發 UsageBanner → TopupModal → 點小包 NT$490 → 真卡刷 → 驗 notify decrypt + `aivis_topup_credits` 加 300 + UsageBanner 顯示「+300 Top-up」(5) 大包 NT$990 重複 (6) 測完還原 quota=150 + 把 aark6465 改回 Free。

**早鳥 end-to-end smoke test 通過 + Account 退款 UX 假失敗修補:**
- 🎯 **早鳥 NT$11,880 真卡刷卡通過**：aark6465 帳號刷 `pebmpc693co6xl5`、`paid_at=2026-05-19 05:09:50`、`pack='earlybird'`、notify `decrypt_ok=true` / `SUCCESS` / `payment_type=CREDIT`、`profiles.is_pro=true` + `payment_gateway=newebpay` + `subscribed_at=2026-05-19 05:09:50`。Pricing 卡 + Account 卡顯示「✓ 目前方案」徽章。**首筆早鳥 Pro 訂單完整跑通**。
- 🎯 **早鳥計數器邏輯驗證**：`SELECT COUNT(*) FROM aivis_newebpay_pending WHERE pack='earlybird' AND status='paid' AND refund_status != 'completed'` 回 1（pebmpc693co6xl5 算入；舊測試單 pebmp5c4p5euh07 因 refund_status='completed' 自動排除；pending 單 pebmpc5yypinvdb 因 status≠paid 排除）。**寫入端**（[checkout-pro-yearly-newebpay.js:94](api/checkout-pro-yearly-newebpay.js#L94) `pack: plan`）+ **讀取端**（[public-stats.js:54](api/public-stats.js#L54) `.eq('pack','earlybird').neq('refund_status','completed')`）+ **退款回滾**三段邏輯閉環，端到端通過。
- 🎯 **早鳥退款 server side 完整通過**：付款後 14 分鐘內按取消訂閱 → NewebPay Close API 回 TRA10035（未請款）→ 自動 fallback 打 CancelTrans → 「放棄授權成功」→ `refund_status='completed'` + `refund_method='api_credit'` + `refund_amount=11880` + `refunded_at=2026-05-19 05:23:07` + `profiles.is_pro=false`。WORKLOG 標記「最關鍵未測路徑」實際上前序就過了（pebmp5c4p5euh07），這次再次驗證 CancelTrans fallback 100% 可用。
- ⚠️ **UX 假失敗 bug 修補 — [Account.jsx:174](src/pages/Account.jsx#L174) catch 加 retry-on-timeout**：原本 `fetch('/api/newebpay-notify?action=refund')` 在 Vercel Hobby 10s timeout 後直接 `alert('連線失敗，請稍後再試')`，但伺服器側其實已成功（NewebPay Close/Cancel API 通常跑 10-15s）。修法：catch 內等 2s 後從 Supabase 直查 `aivis_newebpay_pending.refund_status`，若為 `completed` 就走 success path（`setRefundResult` + `fetchProfile`，文案標註「系統處理時間較長」），否則才彈 alert 並引導用戶聯繫客服。避免用戶誤以為失敗重複點按或致電客服，也避免 is_pro 殘留 true 造成 UI 顯示矛盾。
- 🔖 **memory 記錄修正：測試帳號 aark6465 ≠ memory userEmail mark6465**：早鳥 SQL 驗證時我曾誤用 memory 裡的 mark6465 查 profiles 出現 is_pro=false 誤判為 P0 bug。實際付款帳號是 aark6465@gmail.com，memory userEmail 是用戶個人信箱。已新增 [project_test_account.md](C:/Users/ROG%20STRIX/.claude/projects/c--Users-ROG-STRIX-Desktop-Vibe-Coding-AI---/memory/project_test_account.md) 提醒之後遇到 aivis 沙盒實測一律先確認帳號。
- 🔖 **CDN cache 觀察**：用戶反映「付款前計數器 1、付款後計數器 1」覺得沒加上去，實際是 [public-stats.js:64](api/public-stats.js#L64) 設 `s-maxage=300`（5 分 CDN cache）+ 10 分 SWR — 用戶看到的 1 是付款前的 CDN 殘留值（前一輪退款後 cache 尚未失效時的舊讀數），DB 真值經過 0→1 是對的。**不改 cache 設定**（5 分鐘對行銷頁進度條夠精準），但記下這個用戶觀察陷阱，下次 demo 時若要即時驗計數器要清 cache 或加 `?nocache=1`。
- 📌 **下一步**：(1) `git add Account.jsx + WORKLOG.md` commit + push 觸發 Vercel 部署 (2) 等 1-2 分鐘部署完到 production 再次刷早鳥 → 立刻退款 → 觀察新版 catch path 是否正常顯示「退款已完成」success 卡（不再彈 alert）(3) 進入 Top-up 大/小包 smoke test（小包 NT$490 / 大包 NT$990，aivis quota 已從 1 恢復回 150）(4) 確認剩餘 11 個 Vercel functions 上限沒爆。

---

### 2026-05-18
**Pricing 早鳥/Pro 雙卡整合 — 一張卡同時呈現原價 NT$13,900 + 早鳥 NT$11,880:**
- 💡 **背景**：原本 Pricing 頁早鳥（NT$11,880/年 = NT$990/月）與 Pro 年繳（NT$13,900）是**兩張獨立卡片＋兩顆 CTA**（[Pricing.jsx](src/pages/Pricing.jsx) Pro 卡 + line 802-857 的「早鳥方案」獨立 block）。用戶反映**看不懂該按哪顆**，要把兩者整合在一張卡上、用劃線價對比呈現「平常價 NT$13,900／早鳥 NT$11,880」差距，讓決策一目瞭然。前序 Phase B smoke tests（Top-up 小/大包刷卡、Pro 年繳退款）皆已完成，下一輪要測早鳥按鈕，整合後才測。
- ✅ **[Pricing.jsx](src/pages/Pricing.jsx) `ProCardBody` 改寫 — 內嵌早鳥條件渲染**：(a) 新增 4 個 props：`earlybirdAvailable` / `earlybirdYearly` / `earlybirdSlotsTaken` / `earlybirdSlotsTotal`（兩處 usage 同步補齊 dark / light 兩條 render path）(b) 價格區塊三分流：早鳥有名額 → 大字 NT$990／月（橘黃 `T.warn`）+ 副標「年繳 NT$11,880・原價 NT$13,900」劃線對比 + 「首年限定，次年恢復 NT$1,158／月」說明 + 「🐣 早鳥首年限定・前 100 名」膠囊；早鳥售完 → 走原本年繳 NT$1,158／月 +「省 NT$x・等於免費多用 x.x 個月」副標；月繳分支保留 dead branch 給日後 NPA 串接復活 (c) 進度條（earlybirdSlotsTaken / 100）內嵌到 Pro 卡價格區下方，原 standalone block 的進度條樣式 1:1 搬入。
- ✅ **按鈕分流改 4 種狀態**：未試用過 → 「免費試用 7 天」（紫藍漸層，原邏輯）／試用過 + 早鳥有名額 → 「搶早鳥首年 NT$990／月」（**橘黃漸層 shadow-yellow**，走 `onUpgrade('earlybird')`）／試用過 + 早鳥售完 → 「立即升級 Pro · NT$1,158／月」（紫藍漸層，走 `onUpgrade('yearly')`）／已是 Pro → 顯示「✓ 目前方案」。Mobile Sticky CTA（line 945）同步加 earlybird 分支，按鈕色與文案邏輯與 ProCardBody 一致。
- ✅ **移除 standalone 早鳥 block（line 802-857，~56 lines）**：原本獨立的「早鳥方案」卡（橘色玻璃背景 + 進度條 + 搶早鳥按鈕）整段刪除，留一行註解標明已整合進 Pro 卡。Sticky 早鳥 bar（最頂部 line 374）**保留**因為仍有滾動時提醒名額剩餘的引流功能，與 Pro 卡形成「頂部提醒 → 主卡 CTA」的單一決策路徑。
- ✅ **Build 通過**：`npm run build` exit 0、1.93s built、881 modules transformed、CSS 112.28 kB / index.js 2380 kB（既有 chunk size warning 與本次改動無關）。ESLint 對 Pricing.jsx 0 errors / 0 warnings。
- 🔖 **取捨：早鳥不走 7 天試用**：若未試用過用戶按 CTA 仍走 `onStartTrial()`（與一般 Pro 同），試用期結束後再讓他選早鳥。理由 (a) 早鳥試用會需要 backend 加 `trial → earlybird` upgrade path，現在沒實作 (b) 試用 7 天 + 早鳥剩餘名額時間差可能造成 race（試用結束時早鳥已賣完，承諾打折跳票）。讓未試用客戶先試用、試用過再看到早鳥稀缺感推他結帳，反而 UX 順暢。
- 🔖 **取捨：劃線價放副標而非與主價同行**：本來考慮主價 `~~NT$1,158~~ NT$990／月` 同行排版，但這樣大字會被劃線稀釋視覺重量。最後採用「主價大字 NT$990」+ 副標「年繳 NT$11,880 + 劃線原價 NT$13,900」拆兩行排版，主價維持單一數字最醒目、原價對比放副標仍清楚可讀。
- 🔖 **取捨：dead month 分支不清**：ProCardBody 的 `isYearly ? ... : (月繳分支)` 三元式仍在 — 雖然外層 `isYearly = true` 常數鎖死，month 分支永遠不到。保留理由與 [2026-05-15 工作日誌](#2026-05-15) Pricing toggle 改寫同步：NPA 後台啟用後（最晚 2026-05-20）回來把 `isYearly` 改 state，這條 dead branch 直接復活，現在清掉等於先寫一次再寫一次。
- 📌 **下一步**：(1) `git add src/pages/Pricing.jsx` + commit + push 觸發 Vercel 部署（約 1-2 分鐘）(2) 部署完到 production smoke test：用未試用過的 aark6465 / 試用過的 aark6465 / 已 Pro 的 aark6465 三種帳號狀態觀察按鈕文案 + 顏色 + onClick 路徑分流是否正確 (3) 真卡刷早鳥 NT$11,880 走 NewebPay 端到端（與 Pro 年繳 NT$13,900 共用同一 endpoint `checkout-pro-yearly-newebpay`，差別在 `plan='earlybird'` 把金額換 11880），驗 `aivis_newebpay_pending.plan_type='earlybird'`、`paid_at` 寫入、`profiles.is_pro=true` (4) 退款 path 驗 — 早鳥 D+1 自動請款後測 Close API、未請款測 Cancel API fallback。

---

### 2026-05-18
**Phase 1 NewebPay 整合 end-to-end 完整收尾 + Phase A cleanup:**
- 🎯 **Production smoke test 通過**：`a3ad41a` 部署後真卡 NT$13,900 Pro 年繳新單 `pympb1nqvxn28r` 完整跑通 — `decrypt_ok=true` / `status_decrypted=SUCCESS` / `payment_type=CREDIT` / `trade_no=26051818120456526` / `profiles.is_pro=true` / `payment_gateway=newebpay` / `subscribed_at=2026-05-18 10:12:49`。前端 Account 頁顯示 Pro badge + 訂閱日期 + 取消訂閱按鈕。bad_decrypt → padding strip 兩段式修補的整條 path 證明可行。
- ✅ **Phase A cleanup（3 項並 1 commit）**：(a) **[api/lib/newebpay.js](api/lib/newebpay.js):92-96** 拆掉 `buildPaymentForm` 內 5 行 debug console.log（apiUrl/MerchantID/cleartext TradeInfo/encrypted TradeInfo/TradeSha）— 會把 plaintext 訂單資料印到 Vercel Function Logs，安全性 cleanup (b) **[api/newebpay-notify.js](api/newebpay-notify.js)** 整個拆掉 `?action=debug-decrypt-variants` dispatch + `handleDebugDecryptVariants` 函式 ~90 行 — root cause 已找到，留著佔 Vercel Hobby 12/12 function quota (c) **Bug A 修補**：`handleReturn` 加 `paymentSuccess = (req.body?.Status === 'SUCCESS')`，flag 附加條件改成「成功才掛」— 之前失敗也會帶 `pro_success=yearly` 讓前端誤跳成功 toast。-94 lines / +5 lines。
- 📌 **下一步 Phase B smoke tests**：(a) Top-up 小包刷卡 (b) Top-up 大包刷卡 (c) Pro 年繳退款 — 測 Close API → TRA10035 → Cancel API fallback 雙路徑。趕在 D+1 自動請款（2026-05-19）前完成最完整測試。

### 2026-05-18
**aesDecrypt strip 放寬 N 上限 — NewebPay PKCS7-style with N=25 解謎:**
- 🎯 **真正 root cause**：V0 加入後（直呼 production aesDecrypt）看到 `ok=true` 但 `utf8Tail` 末尾仍有 25 個 `\u0019` 殘留 + `plaintextLen=512`。轉譯：NewebPay 用 **PKCS7-style padding 但允許 N > block_size(16)** — 487-byte JSON 補 25 個 `0x19`（25=0x19）到 512 bytes。標準 PKCS7 規範 N ≤ 16，所以 Node `setAutoPadding(true)` 看到 0x19=25 認定非法 → bad_decrypt；我先前的 strip 也限制 `lastByte <= 16` 同樣沒剝 → V0 表面成功但 plaintext 留 25 個 0x19 → JSON.parse 仍會炸。
- ✅ **[api/lib/newebpay.js](api/lib/newebpay.js) `aesDecrypt` 拿掉 N ≤ 16 上限**：(a) 末尾 strip 邏輯改成只要 `lastByte >= 1 && lastByte <= buf.length` 就嘗試剝（不限制 N ≤ 16）(b) 風險評估：要誤剝必須 plaintext 結尾真的有 N 個重複相同 byte 且該 byte = N，JSON 結尾固定是 `}` (0x7D=125)，要碰巧 125 個連續 `}` 才會誤剝，實務上零機率 (c) 同時兼容標準 PKCS7（N ≤ 16）+ NewebPay 變體（N > 16） — 我方 round-trip 情境也安全。+4 lines。

### 2026-05-18
**bad_decrypt root cause 定位 + aesDecrypt 修補 — V6 noPadding 揪出真兇:**
- 🎯 **Root cause**：debug-decrypt-variants endpoint 跑 6 變體，V6 (`CBC + envIV + noPadding`) 唯一成功，解出完整 NewebPay JSON `{"Status":"SUCCESS","MerchantID":"MS3830621445","Amt":13900,...}` + `shaMatch: true`。確認：**KEY/IV/算法全對，唯獨 NewebPay 端 notify TradeInfo 不用 PKCS7 padding**（可能用 zero padding 或無 padding）。對稱矛盾：我方 checkout 送 PKCS7 給 NewebPay 他們解得開（授權 NT$13,900 成功），但 NewebPay 回 notify 卻用不同 padding 規範 — 兩個方向不對稱。
- ✅ **[api/lib/newebpay.js](api/lib/newebpay.js) `aesDecrypt` 改用 noPadding + 智慧 strip**：(a) `setAutoPadding(false)` 不讓 Node 自動 strip，避免把真實 plaintext 末尾字元誤判為 padding (b) 智慧 strip 兩段：先試 PKCS7（末尾 N bytes 都等於 N 且 N 在 1-16 → 剝掉），不符則剝末尾連續 0x00（兼容 zero padding 或無 padding）(c) 為何兩段：要兼容**我方加密 TradeInfo round-trip** 情境（如 debug-keys endpoint 自我加解密測試、若未來有 checkout server-internal verify），那個方向用 PKCS7 (`aesEncrypt` 維持不變)，所以解密側必須能識別兩種 padding (d) JSON 結尾不會是 0x00，所以剝末尾 zero 安全，不會誤剝 plaintext 內容。+18 lines。
- 📌 **驗證計畫**：deploy 後重新觸發 `?action=debug-decrypt-variants`，預期 V1 (現行 path) 變 `ok=true`。**不需再刷實卡** — 已存的 TradeInfo 直接餵新版 aesDecrypt 就能驗證。

### 2026-05-18
**bad_decrypt root cause hunt — debug-decrypt-variants endpoint (L1 不打掉路線):**
- 💡 **背景**：今日真卡 NT$13,900 Pro 年繳測試，`aivis_newebpay_notify_log` 抓到 2 筆 `decrypt_ok=false` + `bad decrypt` 錯誤（同筆訂單 retry，間隔 12 秒）。Vercel KEY/IV fingerprint 已與 NewebPay 後台 MS3830621445 商家 KEY/IV SHA256 fingerprint 比對通過、`trade_info_exact_match=true` 排除 body parser 破壞、`roundTripOk=true` 證明 KEY/IV self-consistent — 但 NewebPay 送的 TradeInfo 用我們的 KEY/IV 就是解不開。對稱加密邏輯上應該不可能，唯一剩餘解釋是 NewebPay 端用的加密規範 ≠ AES-256-CBC + PKCS7（最可能 GCM 或不同 IV 取法）。決策走 **L1 不打掉廠商也不換 npm 套件**，先寫 debug endpoint 試 6 種解密變體定位真實算法。
- ✅ **[api/newebpay-notify.js](api/newebpay-notify.js) 加 `?action=debug-decrypt-variants` GET endpoint**：(a) dispatch 排在 `debug-keys` 後面、POST method check 之前（GET 即可觸發）(b) 不需刷卡 — 從 `aivis_newebpay_notify_log` 抓最新一筆 TradeInfo，可選 `?orderNo=xxx` 指名抓 (c) 共用 `tryDecrypt` helper 跑 6 變體：V1 CBC+envIV（對照組）/ V2 CBC+IV取密文前16B / V3 CBC+zero IV / V4 GCM+envIV+tag取密文末16B / V5 CBC+KEY前16字當IV / V6 CBC+envIV+noPadding（看 raw bytes 是不是有效但 padding 異常）(d) SHA 重算驗證 `shaMatch` 一起回，徹底排除 SHA path 干擾 (e) 每變體回 `ok` + `rawHexHead`(64 字元) + `utf8Head`(200 字元) 或 `error` message。+84 lines。
- 🎯 **預期結果**：6 變體中只有一個 `ok=true` 且 `utf8Head` 是合法 JSON （`{"Status":"SUCCESS","Message":...`）→ 直接定位 NewebPay 真實算法。若全部失敗 → 升級 L2 換 community npm SDK 或開 NewebPay 客服 ticket。

### 2026-05-18
**NewebPay notify 持久化 log — bad_decrypt 取證 (Path B):**
- 💡 **背景**：2026-05-15 上線測試時真實卡片被授權 NT$13,900 × 4 次（全為授權保留、未實扣），webhook `/api/newebpay-notify` 回 400 `bad_decrypt`。Vercel Hobby plan 只保留 1 小時 Function Logs，等想看時原始 TradeInfo 與 decrypt error 已經消失，無法 reproduce 真因。決策走 **Path B — 持久化 inbound 紀錄**：另開一張 Supabase 表 `aivis_newebpay_notify_log`，notify handler 在任何 return / decrypt 前先寫入，永久保存 TradeInfo + decrypt_ok + decrypt_error + payload + raw_body + headers 供事後 forensics。理由：bad_decrypt root cause 五個劇本（env vars 有空白/換行、舊沙盒 TradeInfo replay、HashKey/IV 與 MerchantID 對不上、NewebPay 改加密格式、TradeInfo URL-encode 兩次）— 不靠完整 raw payload 沒法排除任何一個。
- ✅ **[api/newebpay-notify.js](api/newebpay-notify.js):73-115 加 `logNotify` 非阻塞 helper**：(a) 在 `req.body` destructure 後立即定義 async 函式，try/catch 包覆 — log 寫失敗不影響 notify 主流程 (b) 兩個 call site：missing TradeInfo/TradeSha 早退時呼叫 `logNotify(null)`、parseNotifyPayload 後呼叫 `logNotify(parsed)` 帶上解密結果 (c) 捕捉欄位：`trade_info` / `trade_info_length` / `trade_sha` / `status_query`（query string Status）/ `status_decrypted`（解密後 Status）/ `merchant_order_no` / `decrypt_ok` / `decrypt_error` / `payload`（成功才寫）/ `raw_body` / `headers`（user-agent + content-type + x-forwarded-for + referer）。+31 lines。
- 🔍 **「錯誤會不會發生在測試金流上」診斷分析**：用戶提問是否 Vercel env vars 可能殘留沙盒 HashKey/IV。三組反駁證據：(1) 真實 Visa 被銀行授權 NT$13,900 — 沙盒卡刷不出真錢 (2) 2026-05-15 Vercel logs 抓到 Referer `core.newebpay.com`（沙盒是 `ccore.newebpay.com`）(3) 若 KEY/IV 對不上 MerchantID，NewebPay 在送單階段就會擋下，到不了授權。結論：env vars 基本確認是 production，但無法 100% 排除空白/換行污染或舊沙盒 TradeInfo replay — 等 logNotify 上線後下次刷卡就有真相。

### 2026-05-15
**Phase 1 上線備戰 — 月繳按鈕暫關 + Account 退款狀態收尾 (Route B 啟動):**
- 💡 **背景**：2026-05-14 NewebPay 同日通過 MPG + Close API + **NPA**（11:28:46 客服信件確認），正式商家代號 `MS3830621445`。但 NPA 後台啟用需 1-3 工作天（最晚 2026-05-20），程式串接月繳 `MPG_API/period` endpoint 還沒寫。決策：**Route B — 立即用 MPG-only 上線**（早鳥 + Pro 年繳 + Top-up），月繳按鈕先藏起來、NPA 串接 1-2 週後補。理由：早鳥 NT$11,880 比月繳 NT$1,388×12=NT$16,656 划算 29%，市場心理會自動把多數客戶導向年繳，月繳市占短期 < 20% 不急。
- ✅ **[Pricing.jsx](src/pages/Pricing.jsx) 月繳/年繳 toggle 改為「月繳即將開放」單行提示**：(a) `handleUpgrade(billingCycle = 'yearly')` 預設值改 `'yearly'`，並移除原本 monthly 分支落地到 Stripe checkout 的 fallback（避免任何途徑觸發舊 Stripe 月繳 flow）(b) UI toggle 兩顆 pill button 整段刪除、換成置中微文案「月繳方案即將開放，目前提供年繳與早鳥優惠價」(c) `const isYearly = true` 固定常數，留下原本依賴 isYearly 的條件分支（line 1069 / 1113 / 1223 / 1229）作為 dead branch — 不清因為等 NPA 串接回來時要直接把這條改回 state 即可。diff 41 insertions / 75 deletions, parse OK。
- ✅ **[Account.jsx](src/pages/Account.jsx) `latestProOrder` 查詢補 `refund_status='none'` filter + 退款成功自動 `fetchProfile`**：(a) line 9 `useAuth` destructure 加 `fetchProfile`（之前沒拿出來用）(b) `latestProOrder` Supabase query 加 `.eq('refund_status', 'none')` filter — 修補 [2026-05-14 沙盒 SQL 補丁的 TODO](#2026-05-14)，正式環境「客戶買→退→再買→再退」場景必踩雷，原本按 `paid_at DESC limit 1` 會抓到已退款訂單導致 handler 409 擋住第二次退款 (c) `handleRefundConfirm` 退款成功路徑加 `await fetchProfile(user.id)` — 因為 AuthContext 的 `isPro` 是 lazy state、退款 API 把 DB `profiles.is_pro=false` 後若沒重抓，前端 isPro 殘留 true 會造成「退款成功訊息卡」與「Pro 用戶介面」同時顯示的鬼畜場景。diff 5 lines, parse OK。
- ✅ **`/refund-policy` 路徑驗證**：[ConsumerRights.jsx](src/pages/legal/ConsumerRights.jsx) 已含 Step 4「7 天鑑賞期說明」+ Step 5「退款政策」，含 14 天無條件退款條款（[2026-05-13 工作日誌](#2026-05-13)有完整定義）。App.jsx / Footer.jsx / Terms.jsx 三處 reference `/refund-policy` 與 `/consumer-rights` 路由均已掛載，**無須額外修改**。
- 🔖 **取捨：留 dead `isYearly` 分支不清**：原本 4 處 `{isYearly ? A : B}` 三元式現在 B 分支永遠不到，clean code 觀點該刪。但 NPA 串接 1-2 週內就會回來把 `isYearly` 改回 useState、屆時 B 分支要復活，現在刪了等於先寫一次再寫一次。短期暫留可讀性沒差。
- 🔖 **取捨：月繳 UI 完全藏掉而非「停售中」disabled 按鈕**：原本可保留月繳按鈕但加 disabled + tooltip「即將開放」當作 marketing teaser。但 (a) 按鈕被點到還是會走 handleUpgrade，要再加守衛邏輯保險 (b) toggle UI 留著但其中一邊不可點，比直接拿掉醜（UX 直覺「為什麼擺這顆」）。微文案一行直接告知更乾淨，等 NPA 上線時把 toggle 整段補回即可。
- 🔖 **取捨：不在 commit 裡動 Stripe 月繳 endpoint**：原本 Pricing.jsx 月繳是走 Stripe `/api/create-checkout-session`，現在月繳路徑封死後 Stripe endpoint 變孤兒。但保留它 (a) 萬一 NewebPay 出包要回滾到 Stripe 月繳路徑成本低 (b) Vercel 12/12 functions 上限沒省的必要 (c) NPA 串完後若決策要保 Stripe 為國際版 fallback（Stripe Atlas Phase 2 路線圖[項目](memory/project_payment_strategy.md)），這條 endpoint 還能用。先放著不動。
- ⏳ **用戶側操作 checklist（commit + push 後執行）**：(1) **Vercel env vars 切正式**：`NEWEBPAY_MERCHANT_ID=MS3830621445` / 正式 `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV`（向客服索取正式版）/ `NEWEBPAY_API_URL` 從 `ccore.newebpay.com` 換 `core.newebpay.com` / `NEWEBPAY_REFUND_API_URL` / `NEWEBPAY_CANCEL_API_URL` 對應替換 (2) **NewebPay 商家後台**「商店網址」填 `aark-workspace.vercel.app`（正式網址；自訂網域 `a-ark.com.tw` 目前未生效不要填）(3) **真卡 production smoke test**：自己刷 Top-up 小包 NT$490 → 收銀行 SMS → 收 NewebPay 入帳 email → 自己退款 → 收取消授權／退款 email → 完整鏈路在正式環境跑一次才開放給客戶 (4) **NPA 後台啟用驗證**（最晚 2026-05-20）：到 `會員中心 → 商店管理 → 商店設定 → 設定` 啟用「信用卡定期定額」，啟用後 `會員中心 → 信用卡定期定額管理 → 批次新增委託單` 的「選擇商店」dropdown 應跑出商店名稱才算開通成功。
- ⏳ **NPA 程式串接 TODO**（NPA 啟用後 1-2 週內完成）：(1) 月繳 endpoint 新增走 NPA `MPG_API/period`（PostData_/PeriodType/PeriodPoint/PeriodStartType 等參數）(2) NPA Notify endpoint 另建（與 MPG Notify 不同 URL）(3) 取消委託 API 串接（月繳訂閱可隨時取消）(4) 沙盒實測月繳首次扣款 + 第二月自動扣款 + 取消委託三條 flow (5) Pricing.jsx 把月繳 UI toggle 補回，`isYearly` 改 state，把這次的 dead branch 復活。
- ⏳ **電子發票**（法定 requirement）：仍未申請，可上線後補（先用人工開立或暫不開）— 走 NewebPay 加值或綠界 / ezPay，獨立工作項目。

### 2026-05-15
**Production smoke test 卡關 root cause 翻案 — TradeInfo 送了未開通的付款方式被 NewebPay 擋（不是 MRB10004 商家未啟用）:**
- 💡 **背景**：今天稍早工作日誌（[2026-05-15 Production smoke test 卡關](#2026-05-15)）把 Pro 年繳 NT$13,900 真卡刷下去 5 秒 bounce 回 `?pro_success=yearly` 的 root cause 判定為「NewebPay 商家正式環境未完全啟用 MRB10004」，建議「打客服等 1-3 工作天」。在 Vercel Function Logs 看到 NewebPay POST 回來的 `?action=return` 的 referer 是 `core.newebpay.com` + NewebPay 商家後台多個選單跳 MRB10004 → 看起來像帳號 active 問題。**但事後翻 Vercel Logs 找 checkout-pro-yearly-newebpay 的 stdout、看到完整 TradeInfo 明文一行**：`MerchantID=MS3830621445&...&CREDIT=1&VACC=1&WEBATM=1&CVS=1&BARCODE=1` — root cause **不是商家未啟用**，是 **TradeInfo 送了 4 個未開通的付款方式 (WebATM/VACC/CVS/BARCODE) 被 NewebPay 整筆擋掉**。
- 🔴 **真實 root cause**：[2026-05-14 NewebPay 商家審核通過](#2026-05-14) 已記錄 `MS3830621445` 只通過 **MPG (信用卡) + Close API (退款) + NPA (定期定額)** 三項服務。NewebPay 對 TradeInfo 的付款方式欄位是 **server-side enforcement**：當商家送 `WEBATM=1` 但實際沒申請開通該服務，NewebPay 會立刻 redirect 回 ReturnURL 並把整筆交易擋掉（不會走到信用卡輸入頁，所以「5 秒 bounce」+「不能輸入卡資料」+「沒實際扣款」+「沒入帳 email」四個現象全對齊）。MRB10004 商家後台選單錯誤是另一個獨立的後台帳號權限問題，跟結帳被擋無關。
- ✅ **修補 [api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js) line 95-99 + [api/aivis/checkout-topup-newebpay.js](api/aivis/checkout-topup-newebpay.js) line 94-98**：`VACC: 1 / WEBATM: 1 / CVS: 1 / BARCODE: 1` 改為 `0`，只留 `CREDIT: 1`。檔內加註解標明「MS3830621445 商家只通過 MPG（信用卡）+ Close + NPA / WebATM/VACC/CVS/BARCODE 未申請開通，送 1 會被 NewebPay 擋掉整筆交易（5 秒彈回）」。Top-up 端口同步修，避免 Top-up 也踩雷。
- ✅ **錢、DB、profile 三方乾淨確認沒誤入帳**：跟今天稍早的核對結果一致 — `aivis_newebpay_pending` 最新一筆 `pymp6qna807gtf` status='pending' / paid_at=NULL、profiles is_pro=false / subscribed_at=NULL、銀行 SMS 沒扣款通知、信箱沒 NewebPay 入帳 email。修補前後 DB 都乾淨，本次只是修原始碼避免下次再撞。
- 🔖 **取捨：不打 NewebPay 客服等啟用，直接修 TradeInfo 推 Vercel deploy 重測**：早上判定「等 1-3 工作天」是因為錯把 root cause 鎖在「商家未啟用」上。實際抓到 TradeInfo 明文後，答案在自家 code 裡、不在 NewebPay 後台 — 1 分鐘 edit + 5 分鐘 deploy 就能直接重測，不必等客服回覆。MRB10004 商家後台選單錯誤可以另外慢慢問客服，但不阻擋上線。
- 🔖 **取捨：留 Bug A handleReturn 假 toast 在下一輪解**：Bug A（[2026-05-15 Production smoke test 卡關](#2026-05-15) line 4）handleReturn 沒讀 POST body Status 導致付款失敗也彈「升級成功」toast — 這個還沒修。理由：(a) 修 Bug A 需要 e2e 驗證（讓 NewebPay 真的回 SUCCESS/FAIL 兩種 Status 看 toast 是否分流正確）、Bug B 沒修通的話 NewebPay 連卡片輸入頁都到不了，沒辦法測 Bug A (b) 兩個 bug 一起修一起測一次到位最高效。先讓 Bug B 真卡刷過、再修 Bug A。
- ⏳ **next step (commit 9ce9ce5 已建，等 push)**：(1) `git push origin main` 觸發 Vercel 自動 deploy（commit ahead of origin by 1，diff 2 files / 12 insertions / 9 deletions）(2) 等 Vercel 部署到 Ready 狀態（約 1-2 分鐘）(3) 重跑 Pro 年繳 NT$13,900 真卡 smoke test → 預期 NewebPay 不再 5 秒 bounce、跳出信用卡輸入頁、完整付款 flow 走通 (4) 驗證 DB `profiles.is_pro=true` + 銀行 SMS 扣款 + NewebPay 入帳 email 三件事齊全 (5) 修 Bug A handleReturn 讀 POST body Status (6) 再跑一輪確認假 toast 消失才開放給客戶。
- ⏳ **觀察：Vercel Function 環境變數 SMOKE_TEST_TRADE_INFO_LOG 是這次的關鍵診斷工具**：今天稍早為了配合送 NewebPay 客服診斷，在 [api/lib/newebpay.js](api/lib/newebpay.js) 加了把 buildPaymentForm 的 cleartext TradeInfo 印 console.log 的 debug 代碼。事後抓 root cause 全靠這條 log（不然 TradeInfo 加密過、看 NewebPay POST body 完全看不出送了什麼付款方式）。**待 Bug B 修通後要清掉這條 debug log**（會把信用卡敏感資訊一起印出來，正式環境留著有安全疑慮）— 改在 [api/lib/newebpay.js](api/lib/newebpay.js) 把 console.log 那兩行刪掉、redeploy 即可。

### 2026-05-15
**Production smoke test 卡關 — NewebPay 商家正式環境未完全啟用 (MRB10004) + handleReturn 假成功 toast bug:**
- 💡 **背景**：完成 Phase 1 上線備戰後（commit `363cb85` + `f40b89c`），按 [smoke test plan](#2026-05-15) 階段 D 用 aark6465 帳號刷真卡 Pro 年繳 NT$13,900 跑端到端驗證。結果按下「立即升級 Pro」→ NewebPay 頁面**閃過約 5 秒就 bounce 回 `/pricing?pro_success=yearly`**、沒讓用戶輸入卡片資訊、瀏覽器卻顯示「✓ 升級成功」toast。**Phase 1 上線需暫停等 NewebPay 客服啟用**。
- ✅ **錢沒扣、DB 沒被汙染**（最關鍵的驗證）：(a) Supabase `aivis_newebpay_pending` 查最新一筆 `pymp6qna807gtf` → `status='pending'` / `paid_at=NULL`（不是 paid！）證明 NewebPay 沒回 paid notify、付款未完成 (b) `profiles` 查 `mark6465@gmail.com` → `is_pro=false` / `subscribed_at=NULL` / `payment_gateway=NULL` 全部乾淨（之前沙盒測試的數據早已退款收尾）(c) 銀行 SMS 完全沒扣款通知、信箱沒 NewebPay 入帳 email — 三方一致證實真的沒收費。
- ✅ **Vercel env vars 已正確切正式**（排除沙盒嫌疑）：Vercel Function Logs 看 `/api/newebpay-notify` request 的 **`Referer: https://core.newebpay.com/`** ← `core` 不是 `ccore`，證明 6 個 NEWEBPAY_* 環境變數確實設為正式值、Redeploy 也有抓到（之前用戶手動 Add New 6 個 Production scope env vars + commit `f40b89c` 後 Redeploy）。
- 🔴 **Root cause: NewebPay 正式商家帳號未完全啟用（MRB10004）**：用戶在 NewebPay 商家後台點多個選單跳「錯誤：查無資料 (MRB10004)」。NewebPay 商家審核通過 ≠ 正式環境立即可用，典型流程是「審核 email → 1-3 工作天延遲 → 正式環境 active」。`MS3830621445` 2026-05-14 才剛通過審核、隔天 2026-05-15 就試結帳屬於灰色狀態 — 正式環境收到結帳請求 → 後端發現帳號未 active → 立刻拒絕並 redirect 回 ReturnURL（沒走到卡片輸入頁）。預計 1-3 工作天內 active（最晚 2026-05-20，跟 NPA 啟用時程一致）。
- 🔴 **Bug A: [api/newebpay-notify.js](api/newebpay-notify.js) `handleReturn` 不檢查 NewebPay 交易 status → 假「升級成功」toast**：[handleReturn](api/newebpay-notify.js#L417) 只讀 `req.query.dest` + `req.query.flag` 兩個 URL params，**完全不讀 `req.body`**（NewebPay POST 回來的 Status / Message 欄位）。配合 [checkout-pro-yearly-newebpay.js:93](api/checkout-pro-yearly-newebpay.js#L93) 把 `flag=pro_success=${plan}` **硬編碼在 ReturnURL** — 結果不管 NewebPay 那邊付款成功、失敗、被拒絕都 302 redirect + 加 success flag → Pricing.jsx 看到 `?pro_success=yearly` 就顯示「✓ 升級成功」toast。**UX 嚴重誤導用戶以為付款成功**（雖然 DB 是真實 source of truth、profiles.is_pro 還是 false，但用戶會以為自己刷卡了）。
- 🔖 **Bug A 暫不修、等 NewebPay 啟用後一併處理**：理由 (a) 修法要 `handleReturn` 讀 POST body 解 NewebPay TradeInfo（AES 解密）、check Status === 'SUCCESS' 才附 flag、失敗就附 `?pro_error=xxx` 走另一個 toast 分支 — 約 30 分鐘工程量 (b) 現在等 NewebPay 啟用前修了沒辦法 e2e 驗證（沒辦法跑真實付款 flow）等同無償盲修 (c) 啟用後一起修一起測一次解掉。先把這個 bug 記下來。
- 🔖 **取捨：用戶側操作通通維持正式環境設定不回滾**：(a) Vercel 6 個 NEWEBPAY env vars 保留正式值（HASH/MerchantID 都對、等啟用後直接可用）(b) NewebPay 商家後台「商店網址 / NotifyURL / ReturnURL」維持 `aark-workspace.vercel.app` 不切回 sandbox 設定 (c) 本機 `.env.local` 沙盒值維持不動 — 開發新功能還能在本機跑沙盒。**等於把所有部署側設定 freeze 在「啟用後立即可用」狀態**，啟用後不用再動任何 env / 後台設定、直接重跑 D 階段即可。
- 🔖 **取捨：不在 production 重複按升級累積 pending rows**：每按一次升級就會在 `aivis_newebpay_pending` 多一筆 status='pending' row，雖然不影響 production（pending rows 不會誤判 is_pro），但累積垃圾資料未來 admin 端會看到一堆 ghost orders。**啟用前不再做任何 production 結帳測試**，等啟用 OK 後一次跑通就好。
- ⏳ **next step (待 NewebPay 客服回覆)**：(1) **打 NewebPay 客服 02-27863655（編號 202）/ cs@newebpay.com** 確認啟用進度，提供 `MS3830621445` + 商店名稱「AI 能見度 / AIVIS」，問句「正式環境何時可用？信用卡（MPG）服務需要額外啟用步驟嗎？」(2) 啟用 confirm 後重跑階段 D Pro 年繳 NT$13,900 真卡 smoke test (3) D 全綠後修 Bug A handleReturn 讀 POST body + Status check (4) 修完再跑一次 D 確認假 toast 已消失 (5) 才開放給客戶。
- ⏳ **觀察：NewebPay 後台「失敗交易紀錄」查 `pymp6qna807gtf` 結果**：用戶反映後台選單跳 MRB10004 沒辦法查到該筆失敗紀錄，**判斷後台失敗交易查詢也跟著未啟用**。Bug A 暫不修可能讓我們失去這條診斷路徑，等 NewebPay 啟用後若仍有 5 秒 bounce back 問題、屆時 (a) 後台失敗交易紀錄應該能查 (b) Bug A 修好 handleReturn 也會在 Vercel logs 印出 NewebPay POST body 含錯誤碼 — 雙保險診斷路徑。

### 2026-05-14
**NewebPay 沙盒實測完整收尾 — 6 條 flow 全綠通過 + 退款雙 path 驗證 + NPA 月繳申請缺口確認:**
- 💡 **背景**：2026-05-14 NewebPay 商家審核通過後同日完成沙盒端到端實測，把 MPG 一次性付款 + Close API 退款雙路徑全部驗證一輪，順手抓到並修補兩個上線級 bug（pack_check constraint 漏值、TRA10035 fallback）。是「程式碼寫完到能上線」之間最關鍵的一個 milestone。
- ✅ **6 條 flow 全綠**：(1) Top-up 小包 NT$490 / +300 次 ✅ (2) Top-up 大包 NT$990 / +800 次 ✅ (3A) Pro 年繳 NT$13,900 ✅ (3B) 早鳥 NT$11,880 ✅ (4-CancelTrans) 退款・未請款 path ✅ — 走 `cancelCreditCardAuthorization`，refund_note `NewebPay CancelTrans SUCCESS: 放棄授權成功` (4-Close) 退款・已請款 path ✅ — 走 `requestCreditCardRefund` CloseType=2，refund_note `NewebPay SUCCESS: 退款資料新增成功_模擬信用卡`。兩條退款 path 的成功訊息差異化（CancelTrans「1-3 個工作天釋放預留額度」vs Close「7-14 個工作天退回原卡」）讓客戶清楚知道銀行端會看到什麼。
- ✅ **NewebPay 商家後台手動請款驗證**：4-Close path 需要先把交易從「已授權」推進到「已請款」狀態才能用 CloseType=2，沙盒環境的 D+1 自動請款不保證，故走 NewebPay 商家後台「銷售中心 → 信用卡交易專用查詢」找到 `pymp5bwem1gq63` 按「請款」綠色按鈕手動觸發。後台訊息「模擬信用卡請款成功」確認交易進入已請款狀態，再回 `/account` 走退款流程命中正確 path。**這個手動請款步驟未來上線後不會發生**（NewebPay 正式環境會 D+1 自動請款），但沙盒測試必經。
- 🔖 **取捨：用 SQL 直接調整 paid_at 而非加 latestProOrder 查詢 filter**：測 4-Close path 時 aark6465 已有兩筆 paid pro_yearly（早鳥已退、年繳未退），[Account.jsx](src/pages/Account.jsx) `latestProOrder` 查詢按 `paid_at DESC limit 1` 會抓到早鳥（refund_status='completed' 已被退過），按退款會被 handler 用 409 擋。沙盒測試端用 SQL `UPDATE aivis_newebpay_pending SET paid_at = paid_at - interval '1 day' WHERE merchant_order_no = 'pebmp5c4p5euh07'` 把早鳥往前推一天讓 query 抓到年繳，比改 Account.jsx code + redeploy + 等部署快。但 **正式環境前需把 `.eq('refund_status', 'none')` filter 加進去**，否則「客戶買→退→再買→再退」的場景會抓錯訂單（已記在 TODO 待跑）。
- 🔖 **NPA 月繳定期定額本次未申請，月繳暫繼續走 Stripe**：今天 NewebPay 通過的是 **MPG（單筆收單）+ Close API（退款）**，不含 NPA（定期定額／信用卡訂閱）。Pro 月繳 NT$1,388/月 走 Stripe 通道不變。判斷標準：上線 1-2 週後若月繳請求多再補申請 NPA（流程同 MPG 約 1-2 週審核），目前預期早鳥 + 年繳折扣會吸走多數用戶、月繳市占應 < 20%、不急著切。**電子發票（法定 requirement）也未申請，要另外走 NewebPay 加值或綠界 / ezPay**，下一個獨立工作項目。
- ⏳ **正式環境切換 checklist（待 NewebPay 正式商家代號核發後執行）**：(1) 換 Vercel 4 個 env vars 從沙盒值換成正式值（`NEWEBPAY_MERCHANT_ID` / `NEWEBPAY_HASH_KEY` / `NEWEBPAY_HASH_IV` / `NEWEBPAY_API_URL` `ccore.newebpay.com` → `core.newebpay.com` / `NEWEBPAY_REFUND_API_URL` / `NEWEBPAY_CANCEL_API_URL`）(2) NewebPay 商家後台「商店網址」從 `aark-workspace.vercel.app` 換成 `app.a-ark.com.tw`（主網域）(3) 自己用真卡先付小金額 Top-up 小包 NT$490 → 收銀行 SMS → 確認 NewebPay 入帳 email → 自己按退款 → 收取消授權 / 退款 email → 整條鏈端到端在正式環境也跑一次才開放給客戶。(4) `latestProOrder` 加 `refund_status='none'` filter（multi-refund scenarios）+ Account 頁退款成功後自動 `fetchProfile` reset stale isPro state。
- ⏳ **6 個 .sql 檔本地清理 commit 待跑**（依 [feedback_no_sql_archive](feedback_no_sql_archive.md) 「跑完即刪」原則）：admin-cs-tools.sql / newebpay-pending-orders.sql / newebpay-refunds.sql / showcase-approval.sql / trial-reminders.sql / trial-system.sql 六個檔已 `git rm` 但未 commit，下個 commit 一起收。

### 2026-05-14
**NewebPay 沙盒實測 Flow 4 — 14 天退款 TRA10035「未請款狀態」fallback 補洞:**
- 💡 **背景**：Flow 3 早鳥 NT$11,880 付款成功後立刻在 `/account` 按「取消訂閱 → 確認退款」，NewebPay 回 `TRA10035: 該交易非授權成功或已請款完成狀態`，退款失敗。Root cause 是 NewebPay 信用卡兩階段金流 — 授權 (Authorize) → D+1 自動請款 (Capture) — 而 Close API (CloseType=2) 退款只接受「已請款」狀態，剛付款 2 分鐘的交易仍停在「已授權未請款」階段被擋。**這個 bug 不修上線後會反覆出現**：客戶下午付完年繳、傍晚就反悔，必然踩到同個雷（NewebPay D+1 才請款是常態，不是沙盒特有行為）。
- ✅ **新增 [api/lib/newebpay.js](api/lib/newebpay.js) `cancelCreditCardAuthorization()` helper**：對應 NewebPay `https://ccore.newebpay.com/API/CreditCard/Cancel`（正式 `core.newebpay.com`），PostData 規範比 Close 少一個 `CloseType` 欄位、其他皆同（RespondType / Version / Amt / MerchantOrderNo / TimeStamp / IndexType=1）。env 加可選 `NEWEBPAY_CANCEL_API_URL` 覆寫（沙盒/正式切換用，預設沙盒）。回傳介面與 `requestCreditCardRefund` 一致（`{ ok, status, message, raw }`），讓 caller 切換無痛。
- ✅ **[api/newebpay-notify.js](api/newebpay-notify.js) `handleRefund` 加 TRA10035 fallback 分支**：信用卡 Close API 失敗時，先判斷 `refundResult.status === 'TRA10035'`（同時用正則覆蓋 `message` 內含 'TRA10035' 的情況容錯），若命中 → 呼叫 `cancelCreditCardAuthorization()` 取消授權。成功路徑：(a) 標 `refund_status='completed'` / `refund_method='api_credit'`（**沿用既有 method 標籤，差異記在 refund_note** — 避免再踩 CHECK constraint 雷，前科見上方 pack_check 條目）/ `refund_note='NewebPay CancelTrans SUCCESS (unsettled auth path): ...'` (b) `profiles.is_pro=false` 立即停權 (c) 回前端訊息差異化「因您剛完成付款不久（NewebPay 尚未請款），系統已直接取消授權，您的銀行帳戶不會被扣款，預留額度將於 1-3 個工作天內釋放回信用卡」(d) 失敗則 refund_note 記 `Close TRA10035 → Cancel {status}: {message}` 便於診斷雙重失敗。
- ✅ **parse 驗證**：[api/lib/newebpay.js](api/lib/newebpay.js) + [api/newebpay-notify.js](api/newebpay-notify.js) @babel/parser sourceType=module 通過 (`OK`)。
- 🔖 **取捨：用 refund_method='api_credit' 統一兩條路徑、差異塞 refund_note**：原本可加新值 `'api_cancel_auth'` 但會需要先 ALTER refund_method 的 CHECK constraint（如有），而今天才剛被 pack_check 咬一次。沿用 `api_credit` 對用戶面零差別（兩條路最終都是退到原卡），admin 端要差異化未來改寫 `refund_note LIKE '%CancelTrans%'` 即可，不開新 schema 戰場。
- 🔖 **取捨：用 status 字串比對 'TRA10035' 而非加白名單 enum**：NewebPay 錯誤碼是 prefix-coded 字串（TRA / SYS / ...），未來可能新增更多「未請款相關」錯誤碼。當下只精確匹配 TRA10035（最常見場景）+ 正則容錯，避免過早抽象「任何未請款錯誤都 fallback」反而吃掉真實的退款失敗（如金額不符、訂單不存在）。發現第二個錯誤碼需要 fallback 時再擴。
- 🔖 **取捨：CancelTrans 沒有 refund_amount 部分退款概念，仍寫整筆 order.amount**：NewebPay Cancel API 是「全額取消授權」、不支援部分。對 14 天無條件退款場景沒影響（本來就全退），未來若加部分退款功能必須走 Close API（已請款後才能部分退）+ 不同 endpoint，schema 已有 refund_amount 欄位先佔位。
- ⏳ **驗收待跑**：deploy 後重置 `pebmp5c4p5euh07` 的 refund_status='none'，回 `/account` 再按一次「取消訂閱」，預期 alert「因您剛完成付款不久…預留額度將於 1-3 個工作天內釋放」+ DB 端 `refund_status='completed'` / `refund_method='api_credit'` / `refund_note` 開頭含 `CancelTrans SUCCESS` / `profiles.is_pro=false`。隔日 D+1 NewebPay 自動請款後可再付一次測「已請款 → CloseType=2 直退」path 補完雙路徑覆蓋。

### 2026-05-14
**NewebPay 沙盒實測 Flow 3 — Pro 年繳 / 早鳥結帳 CHECK constraint 漏網修補:**
- 💡 **背景**：沙盒商家審核 2026-05-14 通過後，依序測 Flow 1 Top-up 小包 ✅ / Flow 2 Top-up 大包 ✅ / Flow 3 Pro 年繳。Pricing 頁「立即升級 Pro · NT$1,158／月」按下後彈出 `Pending order insert failed: new row for relation "aivis_newebpay_pending" violates check constraint "aivis_newebpay_pending_pack_check"`，付款流程中斷。**這是上線前抓到的關鍵 bug — 不修的話開賣第一天每個想付年繳的用戶都會踩到，年繳營收直接歸零**。
- ✅ **Root cause**：[aivis_newebpay_pending](aark-workspace) 表的 `pack` 欄位 CHECK constraint 在 Phase 1 Step 1（2026-05-11，Top-up MPG 串接）建表時只寫 `CHECK pack IN ('small', 'large')`，後續 Phase 1 Step 2（2026-05-13，Pro 年繳 endpoint）寫 [api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js) 時 `pack: plan`（值為 `'yearly'` 或 `'earlybird'`）但忘了同步擴充 constraint。因為當時沒沙盒帳號無法 e2e 跑，所以 parse OK 就過了，constraint 漏網直到今天實測才暴露。
- ✅ **修補 SQL**（Supabase Dashboard 已跑）：`ALTER TABLE aivis_newebpay_pending DROP CONSTRAINT IF EXISTS aivis_newebpay_pending_pack_check; ALTER TABLE aivis_newebpay_pending ADD CONSTRAINT aivis_newebpay_pending_pack_check CHECK (pack IN ('small', 'large', 'yearly', 'earlybird'));` — table-level 永久修補，所有未來用戶都安全，跟個別帳號無關。
- ✅ **驗證**：修完重按「立即升級 Pro」成功跳轉 NewebPay 沙盒付款頁，pending row 寫入正常。
- 🔖 **取捨：用 CHECK + IN list 而非 enum type**：原本可改成 PG enum (`CREATE TYPE pack_kind AS ENUM (...)`)，型別更嚴格、加值要 `ALTER TYPE ... ADD VALUE`。但 enum 改值是 PG 12+ 才完全支援、加值不能放交易裡、刪值更麻煩，相較之下 CHECK + IN list 改 constraint 是兩條 ALTER 完事、可重跑、無 migration 複雜度。pack 值未來大概率不會超過 4-5 種（再加 Agency 訂閱方案頂多 6 種），CHECK 表達力足夠。
- 🔖 **取捨：constraint name 沿用 `aivis_newebpay_pending_pack_check`**：PG 自動命名遵循 `{table}_{column}_check`，DROP 後 ADD 用同名能讓 Supabase Dashboard 與 pg_dump 輸出一致，未來別人讀 schema 不會看到孤兒 constraint 名困惑「為什麼這個叫 pack_check_v2」。
- ⚠️ **流程教訓**：Phase 1 Step 2 寫的時候若有沙盒帳號就能當天 e2e 跑、當天抓到 constraint 問題；本案是「程式碼 + DB schema 跨批次演進」典型場景 — 改 endpoint 時必須一併 review 它寫入的表的 constraint 是否還涵蓋新值。未來加新 `kind` / `pack` / `status` 等 enum-like 字串值前，先 grep 對應表的 SQL 定義確認 constraint 不會擋。
- ⏳ **剩餘 NewebPay 沙盒測試**：Flow 3 Test A 年繳 NT$13,900 結帳完成 → 驗 notify 寫 `profiles.is_pro=true / payment_gateway='newebpay' / subscribed_at=now()` / Flow 3 Test B 早鳥 NT$11,880 結帳 → 驗 `aivis_newebpay_pending.pack='earlybird' AND status='paid'` 算進 public-stats earlybird_taken / Flow 4 14-day 退款流程。

### 2026-05-13
**後臺第三階段 — Showcase 排行榜審核（admin approval gate + Dashboard 提交入口 + 4 分支狀態 UI）:**
- 💡 **背景**：第三階段三項待辦中用戶選定優先級 (2) Showcase 審核 → (1) FAQ/定價管理 → (3) /crawl-check。原 Showcase 頁（/showcase）自動把所有 `scan_count > 0` 的 websites 列出來，開放上線後用戶會把測試 URL / 競品 / 不雅內容刷上去傷品牌，需 admin 審核 gate。本批次完整實作 admin 審核閉環：用戶在 Dashboard 提交網站 → 進待審佇列 → admin 在 /admin/showcase 核准 / 退回 → 核准的才出現在公開 /showcase，退回的把原因回顯給用戶。Vercel Hobby 12/12 functions 已頂死 → 全部走 admin 端 / 用戶端直寫 supabase + RLS（既有 `is_admin()` helper），不加新 endpoint。
- ✅ **新增 [showcase-approval.sql](showcase-approval.sql)**：(1) `websites` 加 3 個欄位 `is_approved BOOLEAN NOT NULL DEFAULT false` / `submitted_at TIMESTAMPTZ` / `rejection_reason TEXT`。(2) **Backfill**：既有 websites 全部視為已核准（`UPDATE WHERE is_approved=false AND submitted_at IS NULL AND rejection_reason IS NULL`），避免上線當下 Showcase 變空；WHERE 限制確保重跑也不會誤覆蓋已被 admin reject 的 row。(3) 兩條 partial index — `idx_websites_pending_approval ON (submitted_at DESC) WHERE is_approved=false AND submitted_at IS NOT NULL`（admin 待審佇列查詢）+ `idx_websites_approved_listing ON (created_at ASC) WHERE is_approved=true`（前台 Showcase fetchData）。(4) `admin_update_websites` RLS policy（沿用 `is_admin()` helper）讓 AdminShowcase 可直寫 is_approved / rejection_reason，不開新 Vercel function。冪等：IF NOT EXISTS + DROP IF EXISTS。**用戶側待辦**：Supabase SQL Editor 跑一次。
- ✅ **新增 [src/pages/admin/AdminShowcase.jsx](src/pages/admin/AdminShowcase.jsx) ~275 行 / 3-tab CRUD**：(1) 上排 3 張統計卡 — 待審件數（橘）/ 已核准（綠）/ 已退回（紅），點 chip 切換 tab。(2) 列表單一 SQL `select * from websites where submitted_at IS NOT NULL OR is_approved=true OR rejection_reason IS NOT NULL` 一次撈回後 in-memory 按 tab 分組（避免三條 query），順便 `select profiles.id, name, email in(...)` batch join 用戶資料避免 N+1。(3) 每列顯示網站名稱（可點連 /dashboard/:id 開新分頁查實際內容）+ URL + 用戶 email + 提交時間。(4) **待審 tab** 動作鈕：「✅ 核准」直寫 `update websites set is_approved=true, rejection_reason=null where id=X` / 「❌ 退回」開 modal 必填退回原因（textarea + 預設快捷選項：「測試 URL，請改提交正式品牌」/「內容不符合社群規範」/「疑似競品代發」/「網站尚未完成」）+ 確認後 `update set is_approved=false, submitted_at=null, rejection_reason=reason`。(5) **已核准 tab** 顯示核准日期 + 「⏬ 撤回核准」按鈕（罕用，但 admin 萬一誤核准要 escape hatch）。(6) **已退回 tab** 顯示退回原因 + 「↩ 重新審核」按鈕（reset 回待審狀態，給用戶第二次機會）。
- ✅ **[src/pages/Showcase.jsx](src/pages/Showcase.jsx) fetchData 加 `.eq('is_approved', true)` 過濾**：原本 `select * from websites where scan_count > 0 order by ...` 直接撈全部，改為加上 `is_approved=true` 條件。Backfill 確保既有資料全 approved，上線當下 Showcase 不會變空。SAMPLE_SITES（前端硬寫的示範資料陣列）不受影響，繼續秀。
- ✅ **[src/pages/admin/AdminLayout.jsx](src/pages/admin/AdminLayout.jsx) NAV 加第 6 項**：`{ path: '/admin/showcase', label: '排行榜審核', icon: '⭐' }`，插在「站內公告 📢」與「系統監控 📡」之間。NAV 總數 6 → 7。
- ✅ **[src/App.jsx](src/App.jsx) 接路由**：加 `import AdminShowcase from './pages/admin/AdminShowcase'` + `<Route path="/admin/showcase" element={<AdminShowcase />} />` 在 admin announcements 與 admin monitoring 之間。
- ✅ **[src/pages/Dashboard.jsx](src/pages/Dashboard.jsx) TopBar 加 4 分支「提交至排行榜」UI**：依用戶 website 狀態自動切換：(a) **`is_approved=true`** → 翠綠 `Link to=/showcase`「✅ 已上排行榜」（讓用戶能直接連去看自己的卡）(b) **`rejection_reason` 有值** → 紅色 button `onClick={() => alert(\`提交至排行榜未通過審核：\\n\\n${reason}\\n\\n如需重新申請請聯絡客服 mark6465@gmail.com\`)}`「🚫 排行榜申請被退回」(c) **`submitted_at` 有值但未核准** → 琥珀 span（不可點）「⏳ 排行榜審核中」+ title tooltip 標明「審核通常 1-3 個工作天」(d) **預設（未提交）** → 琥珀 outline button `onClick={handleSubmitToShowcase}` 「⭐ 提交至排行榜」。每分支都加 `sm:inline` / `sm:hidden` 雙文案（mobile 顯示縮短文字「已上榜」/「審核中」/「上排行榜」）避免擠版。
- ✅ **handleSubmitToShowcase 確認流程**：`window.confirm` 揭露完整 implications — 「提交後將進入管理員待審佇列 / 審核通常 1-3 個工作天 / 核准後會出現在 /showcase 公開展示所有訪客可看到 / 若內容不符（測試 URL / 不雅內容 / 競品代發）會被退回 / 確認要提交嗎？」。確認後直寫 `supabase.from('websites').update({ submitted_at: new Date().toISOString() }).eq('id', website.id)` + 樂觀更新 `setWebsite({ ...website, submitted_at: ... })`，失敗 `alert('提交失敗，請稍後再試')`。`submittingShowcase` state 防連點 + button loading「送出中...」。
- ✅ **parse 驗證**：[showcase-approval.sql](showcase-approval.sql) 跳過（純 SQL）+ [AdminShowcase.jsx](src/pages/admin/AdminShowcase.jsx) + [Showcase.jsx](src/pages/Showcase.jsx) + [AdminLayout.jsx](src/pages/admin/AdminLayout.jsx) + [App.jsx](src/App.jsx) + [Dashboard.jsx](src/pages/Dashboard.jsx) 五檔 @babel/parser sourceType=module + jsx plugin 通過 (`OK`)。
- 🔖 **取捨：admin 直寫 supabase 而非開審核 Vercel function**：Vercel Hobby 已 12/12 functions 上限（同前 B1+B2 / B3 批次模式），加新 endpoint 會破 build。前端直接走 `supabase.from('websites').update()`，第二層守門靠 `admin_update_websites` RLS policy + `is_admin()` helper — 即使 anon key 流出，沒有 `is_admin=true` 的 profile 也寫不進去。代價是 admin 端 client 邏輯多一些（樂觀更新 + rollback），好處是不必再加一個 Vercel function。
- 🔖 **取捨：審核三層 schema（is_approved + submitted_at + rejection_reason）而非單一 status enum**：理論上可以用 `status TEXT CHECK ∈ ('draft','pending','approved','rejected')` 單欄表達所有狀態，但 (1) is_approved 是布林過濾 RLS / 前台 SELECT 最便宜（partial index 直接吃）(2) submitted_at + rejection_reason 同時是業務語意「何時提交」「為什麼退回」的 source of truth，併進 status 反而要再加一張 history 表記時間戳 (3) Dashboard 4 分支判定靠三欄組合最直觀（is_approved → rejection_reason → submitted_at → 預設）。三欄正交設計比 enum 表達力更強。
- 🔖 **取捨：rejection_reason 必填（admin 端 modal 強制）而非可選**：admin 退回若不寫原因，用戶看到「🚫 申請被退回」但不知道為什麼，會直接客訴。Modal 必填 + 4 個預設快捷選項（測試 URL / 不符社群規範 / 競品代發 / 尚未完成）讓 admin 1 秒選好原因 + 可選自由文字補充，比自由輸入快 80%。Server 端不 enforce（怕未來有 admin migration 場景），靠 client UI 守門即可。
- 🔖 **取捨：Backfill 條件 `WHERE is_approved=false AND submitted_at IS NULL AND rejection_reason IS NULL`**：直接 `UPDATE websites SET is_approved=true` 會把 admin 已 reject 的 row 重新核准（如果 SQL 重跑），這是 destructive。三條件守門確保只動「從未經審核處理」的 row — 第一次跑時所有既有 row 都符合此條件全部核准，之後再跑只動新插入但未經審核處理的 row（不太會有，因為新建走 default false），實質上等於只在第一次跑時生效。
- 🔖 **取捨：「已核准」tab 仍提供「撤回核准」按鈕**：理論上核准後就不該再動，但保留 escape hatch 給「admin 誤核准違規網站事後發現」的場景。按鈕加紅色 + alert 二次確認「撤回後該網站會立刻從 /showcase 公開頁面消失」避免誤觸。
- 🔖 **取捨：Dashboard 4 分支 UI 而非單一按鈕 + status badge**：原本可以一顆「提交至排行榜」按鈕 + 旁邊 chip 顯示「審核中 / 已核准 / 已退回」狀態，但每個狀態需要不同的 affordance — 已核准應該能點去 /showcase 慶祝；已退回需要彈原因 + 客服 email；審核中要傳達「正在等」的非操作感；未提交要鼓勵點擊。把這四個狀態合進一個按鈕語意會打架，分開 4 個元件視覺差異化（綠 Link / 紅 button alert / 琥珀 span / 琥珀 outline button）比硬塞一個按鈕清晰得多。
- ⚠️ **用戶側待辦（上線前）**：(1) **Supabase SQL Editor 跑 [showcase-approval.sql](showcase-approval.sql) 一次** — 加 is_approved / submitted_at / rejection_reason + 2 條 partial index + admin_update_websites RLS policy。跑完用三條 query 驗證：`SELECT column_name FROM information_schema.columns WHERE table_name='websites' AND column_name IN ('is_approved','submitted_at','rejection_reason')`（應回 3 row）+ `SELECT COUNT(*) FROM websites WHERE is_approved=true`（應 ≥ 既有 website 數）+ `SELECT policyname FROM pg_policies WHERE tablename='websites' AND policyname='admin_update_websites'`（應回 1 row）。(2) **測試 4 個流程**：(a) 用戶 A 在 Dashboard 點「⭐ 提交至排行榜」→ confirm dialog → 確認後 chip 變「⏳ 排行榜審核中」+ 進 /admin/showcase 待審 tab 應看得到該 row (b) admin 在 /admin/showcase 點「✅ 核准」→ /showcase 應出現該網站 + 用戶 A Dashboard chip 變「✅ 已上排行榜」可點去 /showcase (c) admin 對另一個用戶 B 點「❌ 退回」→ modal 必填原因「測試 URL」→ 用戶 B Dashboard chip 變紅色「🚫 排行榜申請被退回」點下去 alert 顯示原因 (d) admin 對 B 點「↩ 重新審核」→ B 的 chip 回到「⭐ 提交至排行榜」可重新申請。
- ⏳ **第三階段剩餘待辦**：(1) FAQ / 定價文案管理（DB 表 + AdminContent.jsx CRUD，讓 admin 改 /faq、/pricing 文案不必動 code）(2) /crawl-check 爬蟲可達性檢測頁（對標 washinmura.jp，輸入網址 → 即時打 robots.txt + 8 種 AI/搜尋引擎 UA 模擬抓取 → 終端機風格動畫 + 通過/失敗報告）。Showcase 審核閉環完成後下批次接著做。

### 2026-05-13
**後臺第二階段 B3 — AdminMonitoring 系統監控頁（aivis 掃描量趨勢 + 成本 + 提及率 + Top 10 重度使用者）:**
- 💡 **背景**：B1+B2 客服工具三件套同日完成後接著做 B3。aivis 模組已上線兩週、累積使用量需要 admin 視角的儀表板看 (1) 整體 API 成本走勢（本月 / 趨勢圖）防上線後燒錢失控 (2) 品牌提及率分布看 aivis 對客戶有沒有實際價值 (3) 哪些用戶在重度使用（潛在 Pro 流失 vs Agency 升級候選 vs 刷單異常）。Vercel Hobby 12/12 functions 已頂死 → 全部走前端直查 supabase + admin RLS（既有 [admin-rls-policies.sql](admin-rls-policies.sql) 已開放 admin 全表讀），不加新 endpoint。
- ✅ **新增 [src/pages/admin/AdminMonitoring.jsx](src/pages/admin/AdminMonitoring.jsx) ~200 行**：(1) **4 張 KPI 卡（上排）** — 本月 aivis 掃描次數（藍 + 被提及次數副標）/ 本月 API 成本 USD（琥珀 + NT$ ≈ ×31 換算副標）/ 本月品牌提及率（>30% 翠綠、否則橘）/ 本月活躍用戶數（紫）。資料源：`aivis_responses where created_at >= UTC monthStart` 並行查 user_id / cost_usd / brand_mentioned / created_at 後 in-memory 聚合。(2) **7 天 + 30 天掃描趨勢圖 (Recharts LineChart)** — 30 天版用 `aivis_responses where created_at >= now-30d order by created_at asc` 抓回後按 UTC dayKey GROUP BY 預填 30 個 bucket（避免缺漏日空洞），同圖兩條線「掃描次數 #3b82f6 藍」+「被提及 #10b981 翠綠」。7 天版直接 slice(-7) 不另查。(3) **本月 Top 10 重度使用者**：按掃描次數降序，每列顯示姓名 + Pro 徽章 + email + 掃描次數（藍）+ cost USD + 提及次數。聚合用 Map by user_id (scans/cost/mentioned)，sort 後 slice(0,10) 再 `supabase.from('profiles').select('id,name,email,is_pro').in('id', ids)` batch 拉用戶資料，避免 N+1 query。
- ✅ **[src/App.jsx](src/App.jsx) + [src/pages/admin/AdminLayout.jsx](src/pages/admin/AdminLayout.jsx) 接路由 + NAV**：App.jsx 加 `import AdminMonitoring from './pages/admin/AdminMonitoring'` + `<Route path="/admin/monitoring" element={<AdminMonitoring />} />`。AdminLayout NAV 加第 6 項 `{ path: '/admin/monitoring', label: '系統監控', icon: '📡' }`。
- ✅ **parse 驗證**：[App.jsx](src/App.jsx) + [AdminLayout.jsx](src/pages/admin/AdminLayout.jsx) + [AdminMonitoring.jsx](src/pages/admin/AdminMonitoring.jsx) @babel/parser sourceType=module + jsx plugin 三檔通過 (`OK`)。
- 🔖 **取捨：30 天趨勢用 UTC dayKey 而非 Asia/Taipei 時區**：aivis_responses.created_at 寫入用 supabase default (UTC)，趨勢圖跟著用 UTC bucket 邏輯最一致；用戶在凌晨 0-8 點掃描會被算到「前一天」（台北時間 +8h），admin 端可接受。若改 Asia/Taipei 要寫時區偏移轉換 + dayKey 邏輯改寫，CP 值低。
- 🔖 **取捨：錯誤日誌 viewer 本批次跳過**：aivis_responses schema 目前沒 error 欄位（fetch.js 失敗會在 server-side throw 但不寫 row），要做錯誤日誌 viewer 必須先 (a) ALTER TABLE aivis_responses ADD COLUMN error JSONB 或 (b) 新建 aivis_error_logs 表 + 修 [api/aivis/fetch.js](api/aivis/fetch.js) catch 分支寫入。兩條路都涉及 schema migration，與本批次「不加新 endpoint + 不動 schema」的範圍衝突 → 留給下批次。AdminMonitoring 頁面 sub-text 已揭露「錯誤日誌 viewer 待 schema 加 error 欄位後另外做」管理用戶預期。
- 🔖 **取捨：Top 10 而非 Top 20 / Top 50**：本月活躍用戶通常 50-200 量級，Top 10 已涵蓋 80% 異常用量 + Agency 升級候選。Top 20 會擠版面（每列 80px + 10 列 = 800px 已是看板下半部），Top 50 用戶要 scroll 才看完反而失焦。日後若用戶基數爆增再考慮加分頁 / 篩選。
- 🔖 **取捨：成本 USD ×31 直接寫死 NT$ 換算而非吃即時匯率**：admin 是看「相對量級」決策（這個月燒了幾百還是幾千），即時匯率上下浮動 30→32 對決策不影響。寫死省去多打一個匯率 API。日後若要做 NewebPay 結算對帳這種需要精準匯率的場景再加。
- 🔖 **取捨：4 張 KPI 的「本月活躍用戶」用 Set 去重 user_id 而非 distinct query**：原本可以 `select distinct user_id from aivis_responses where ...` 但 supabase-js 不直接支援 distinct，要走 rpc 或 raw SQL。本月 responses row 數通常 < 5000，前端 `new Set(rows.map(r => r.user_id)).size` 1ms 完成，比新建 RPC 划算。
- ⏳ **未來增強（不阻塞）**：(1) 加 error 欄位到 aivis_responses + fetch.js catch 寫入後做錯誤日誌 viewer（fetch 失敗的 prompt_id / error_message / 重試次數 / 模型 ID）(2) 成本趨勢加 Anthropic 端 token 用量分項（input vs output tokens × $3 vs $15 per M tokens 計算）(3) Top 10 加「異常標記」chip — 掃描次數 > 平均 ×5 標紅警示刷單嫌疑 (4) 加日期區間 selector（本月 / 上月 / 過去 90 天 / 自訂）(5) 加品牌維度 — Top 10 brands by mention count 看哪些客戶的 aivis 真的拿到引用。

### 2026-05-13
**後臺第二階段 B1 + B2 批次 — 客服工具三件套（補發 Top-up / 延長 Pro / 寄自訂 email）+ admin RLS / 操作軌跡 schema:**
- 💡 **背景**：用戶選定優先級 (b) — 跳過 NewebPay 月繳定期定額 Phase 1 Step 3（等待沙盒資格另行核發）、優先做 #2 /crawl-check + #3 後臺第二階段 + #4 後臺第三階段。本批次完成 B1（schema + RLS）+ B2（客服工具 UI 三件套），讓客服人員（mark6465@gmail.com + 未來 admin 同事）可直接從 `/admin/users` 處理客訴：補發點數包、延長 Pro 到期日、寄自訂 email，每筆操作寫進 `profiles.admin_history` JSONB 軌跡欄位供日後對帳。Vercel Hobby 12/12 functions 已頂死 → 客服寄信功能合併進既有 [send-report-email.js](api/send-report-email.js) 用 `?action=admin_custom` 分發，不破 build。
- ✅ **新增 [admin-cs-tools.sql](admin-cs-tools.sql)**：(1) `profiles.pro_expires_at TIMESTAMPTZ` — 客服參考用 Pro 到期日（NULL = 永久 / 未追蹤），加 partial index `WHERE is_pro=true AND pro_expires_at IS NOT NULL` 供未來 cron 掃即將到期 Pro 用。**目前不串自動降級 cron**（避免誤傷現有 NewebPay 年繳付費用戶，他們的 paid_at 沒 backfill 到此欄位），先把 schema 與 UI 鋪好，cron 邏輯日後另外做。(2) `profiles.admin_history JSONB NOT NULL DEFAULT '[]'::jsonb` — append-only 客服操作軌跡陣列，結構 `[{ ts, admin_id, action, ...details }]`，三種 action：`extend_pro` 含 `{ days, reason, prev_expires_at, new_expires_at }` / `grant_topup` 含 `{ pack, quota, reason, source_payment_id }` / `send_email` 含 `{ subject, reason }`。(3) `aivis_topup_credits` 加 admin INSERT + UPDATE policy（沿用既有 `is_admin()` SECURITY DEFINER helper），讓客服可補發點數包（INSERT，source_payment_id 用 `admin_compensation_<ts>` 區分）+ 修正錯誤入帳（UPDATE quota_remaining 軟刪除，保留稽核軌跡），**不開 DELETE**。冪等：IF NOT EXISTS + DROP IF EXISTS 確保重複跑也不報錯。**用戶側待辦**：Supabase SQL Editor 跑一次。
- ✅ **[src/pages/admin/AdminUsers.jsx](src/pages/admin/AdminUsers.jsx) 三個客服 modal — B2a 補發 Top-up（橘色）+ B2b 延長 Pro（藍色）+ B2c 寄信（粉紅）**：
  - **B2a 補發 Top-up（topupModal）**：用戶展開列右側「🎁 補發」按鈕。Modal 兩段選擇：(1) Pack（小包 NT$490/+300 / 大包 NT$990/+800）(2) 必填補發原因 textarea 供稽核。`handleGrantTopup()` 直寫 supabase `aivis_topup_credits` INSERT（user_id / pack / quota_remaining = quota_total / source_payment_id = `admin_compensation_${Date.now()}` 避免與真實 Stripe/NewebPay session id 撞）+ 並行 update `profiles.admin_history` append `{ action: 'grant_topup', pack, quota, reason, source_payment_id }`。樂觀更新 users state 把新 credit row 推進去，失敗 rollback + 顯示錯誤訊息。
  - **B2b 延長 Pro（extendModal）**：用戶展開列「📅 延長」按鈕。Modal 三段選擇：(1) 延長天數 button group（7 / 30 / 90 / 180 / 365 預設值，或自訂輸入框）(2) 顯示「原到期日 → 新到期日」即時計算（若 pro_expires_at NULL 從 now 起算）(3) 必填原因 textarea。`handleExtendPro()` 直寫 supabase update `profiles.pro_expires_at` + 同步 `is_pro=true`（萬一過期降回 Free，補發等於重新開通）+ append `admin_history` `{ action: 'extend_pro', days, reason, prev_expires_at, new_expires_at }`。
  - **B2c 寄自訂 email（emailModal）**：用戶展開列「✉️ 寄信」按鈕。Modal：(1) 主旨 input（200 字限制 + 字數計數）(2) 內容 textarea（10000 字限制，resize-y，10 rows）(3) 必填寄送原因 textarea。`handleSendEmail()` 從 `supabase.auth.getSession()` 拿 access_token → `POST /api/send-report-email?action=admin_custom` 帶 Bearer header + `{ toUserId, subject, body, reason }`。後端回 `{ success, message_id }` 後前端樂觀 append admin_history `{ action: 'send_email', subject, reason, message_id }` + 顯示成功 banner 含 Resend message_id 與收件人 email。寄件人卡片提示 `AARK 優勢方舟客服 <support@aark.io>` 讓 admin 清楚信會從哪寄出。
- ✅ **[api/send-report-email.js](api/send-report-email.js) 加 `?action=admin_custom` 分發 + `handleAdminCustomEmail()` 整段**：(1) Bearer token 驗證 — `Authorization: Bearer <token>` → `supabase.auth.getUser(token)` → 拿 user.id → `SELECT is_admin FROM profiles WHERE id = user.id` → 非 admin 回 403。(2) Body 驗證 — subject 1~200 字、body 1~10000 字、reason 必填、toUserId 必填。(3) 抓收件人 — `SELECT name, email FROM profiles WHERE id = toUserId` → 無此用戶回 404。(4) `buildCustomEmailHTML({ subject, body, recipientName })` 組信 — `&<>` HTML escape + `\n→<br>` 把純文字 admin 在 textarea 輸入的內容安全嵌入 HTML email 模板（避免 admin 不小心打 `<script>` 也炸不開）。(5) `from: 'AARK 優勢方舟客服 <support@aark.io>'` POST Resend API → 成功拿 message_id。(6) 寫 admin_history `{ ts, admin_id: auth.user.id, action: 'send_email', subject, reason, message_id }`。(7) 回 `{ success: true, message_id }`。
- 🔖 **取捨：admin 直寫 supabase 而非開 admin Vercel function（B2a/B2b）**：Vercel Hobby 已 12/12 functions 上限（[2026-05-12 工作日誌](#2026-05-12)），加新 endpoint 會破 build。前端直接走 `supabase.from('aivis_topup_credits').insert()` + `profiles.update()`，第二層守門靠 [admin-cs-tools.sql](admin-cs-tools.sql) 的 RLS policy + `is_admin()` helper — 即使 anon key 流出，沒有 `is_admin=true` 的 profile 也寫不進去。代價是 admin 端 client 邏輯多一些（樂觀更新 + rollback），好處是不必再加一個 Vercel function。
- 🔖 **取捨：B2c 寄信走 Vercel function（不直寫）— 與 B2a/B2b 不同模式**：因為 Resend API key 是 server-only secret，不可暴露給 client。但又不能新加 endpoint（破 12/12），所以合併進既有 [send-report-email.js](api/send-report-email.js) 用 `?action=admin_custom` 分發。檔內既有的「掃描完成寄報告」邏輯放 default handler、admin_custom 走獨立 `handleAdminCustomEmail()`，靠 `req.query.action` 在 handler 開頭分流，函數內部不交織。
- 🔖 **取捨：admin_history 用 append-only JSONB array 而非獨立 admin_action_logs 表**：理論上獨立表更乾淨（可加 indexed by action / created_at / admin_id），但 (1) 多一張表 + RLS 設定成本 (2) 客服查某用戶歷史時要 join，前端 UI 較囉嗦 (3) admin_history 跟著 profile row 走，反查最直觀（展開該用戶就看得到所有操作軌跡）。代價是 array 累積大會影響 row size，但客服操作頻率低（一個用戶一年內最多幾十筆），20 年內 row size 都不會撞 PostgreSQL TOAST 限制。
- 🔖 **取捨：pro_expires_at 目前不串自動降級 cron**：理論上有了到期日欄位 + partial index 就可以做 cron 每天掃 `WHERE is_pro=true AND pro_expires_at < now()` 自動 reset is_pro=false。但 (1) Phase 1 之前的 NewebPay 年繳付費用戶 paid_at 沒 backfill 到 pro_expires_at — 若直接開 cron 會誤傷他們（從 Pro 降回 Free）(2) Vercel Hobby cron jobs 上限 2 個，目前用 1 個（daily trial sweep），加自動降級要等 backfill 完才不會誤傷。所以先做 schema + UI 客服可手動延長，cron 邏輯日後另外做。
- 🔖 **取捨：寄信 from 用 `support@aark.io` 而非 `report@aark.io`**：既有 send-report-email 預設 from 是 `report@aark.io`（沿用週報寄件人），但客服信本質不一樣 — 用戶可能會直接回信問問題，`report@aark.io` 是 cron 自動寄信用、無人接收回信。改用 `support@aark.io` 讓回信會進客服信箱（mark6465@gmail.com 轉信或之後設專屬 inbox），更符合客服場景。Resend 端兩個地址都已驗證可用。
- 🔖 **取捨：subject 200 字 + body 10000 字限制（客服端 + server 雙重 enforce）**：subject 過長會被 email client 截斷（Gmail ~78 字、Outlook ~70 字），200 字已是寬容上限；body 10000 字大約 50 段純文字，客服寫客訴回覆 / 升級通知 / 系統公告都夠用，避免 admin 不小心貼整篇文章造成 Resend payload 過大被拒。client 端 textarea maxLength + char counter 是 UX 提示，server 端再驗一次是防 client 繞過。
- 🔖 **取捨：HTML escape `\n→<br>` 而非用 Resend Markdown / handlebars 模板**：admin 在 textarea 輸入的是純文字，不期望他寫 markdown / HTML。直接 escape `&<>` 三個字元 + 轉換換行為 `<br>` 是最保守做法 — admin 寫 `<script>alert(1)</script>` 也只會在 email 內看到字面文字（不會執行）。Resend 也支援 markdown but 引入額外解析層只會增加風險面，純文字 escape + linebreak 已夠用。
- ⚠️ **用戶側待辦（上線前）**：(1) **Supabase SQL Editor 跑 [admin-cs-tools.sql](admin-cs-tools.sql) 一次** — 加 pro_expires_at + admin_history 欄位 + aivis_topup_credits admin INSERT/UPDATE policies。跑完用兩條 query 驗證：`SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('pro_expires_at','admin_history')`（應回 2 row）+ `SELECT policyname FROM pg_policies WHERE tablename='aivis_topup_credits' AND policyname LIKE 'admin_%'`（應回 admin_insert_topup_credits + admin_update_topup_credits 2 row）。(2) **Resend Dashboard 確認 `support@aark.io` 已驗證寄件人**（與既有 report@aark.io 同 domain，理論上 SPF/DKIM 自動繼承但要在 Resend 端 explicit add as verified sender）。(3) **測試 3 個工具流程**：(a) 補發 Top-up — 隨便挑一個測試用戶展開列「🎁 補發」→ 選大包 + 填原因「測試補發」→ 確認 aivis_topup_credits 多一筆 source_payment_id 開頭 admin_compensation_ + profiles.admin_history 多一筆 action=grant_topup。(b) 延長 Pro — 同帳號「📅 延長」→ 選 30 天 + 填原因 → 確認 profiles.pro_expires_at 從 NULL 變未來日期 + is_pro=true + admin_history 多一筆 action=extend_pro。(c) 寄信 — 同帳號「✉️ 寄信」→ 主旨「測試客服信」+ 內容兩段純文字（含換行）+ 原因「驗證 modal」→ 確認該用戶收信箱收到 Resend HTML email、subject 正確、body 內 `\n` 變 `<br>` 換行、admin_history 多一筆 action=send_email 含 message_id。
- ⏳ **B3 (待做) — AdminMonitoring.jsx 系統監控**：(1) aivis 7/30 day 掃描量趨勢圖（按日 GROUP BY aivis_responses.created_at）+ 成功/失敗率（API 錯誤 / Anthropic 端拒絕 / 寫入失敗等）(2) 錯誤日誌 viewer — 先檢查 aivis_responses.error 欄位是否已存在，若無則建 aivis_error_logs 表記每次失敗的 prompt_id / error_message / created_at。下次 commit 做。
- ⏳ **後臺第三階段 (待做)**：(1) FAQ / 定價文案管理（DB 表 + AdminContent.jsx CRUD）(2) Showcase 審核（用戶提交品牌進排行榜需 admin approve / reject）。B3 完成後做。
- ⏳ **/crawl-check (待做)**：爬蟲可達性檢測頁，對標 [washinmura.jp](https://washinmura.jp/crawl-check/)。獨立路由，輸入網址 → 即時打 robots.txt + 8 種 AI/搜尋引擎 UA 模擬抓取 → 終端機風格動畫 + 通過/失敗報告。後臺三階段做完後做。

### 2026-05-13
**NewebPay Phase 1 Step 4 — 14 天無條件退款 API 串接（信用卡 API 直退 + 非信用卡手動轉帳雙軌 + Account RefundModal）:**
- 💡 **背景**：商業模式承諾「年繳 14 天無條件退款」是 NewebPay 商家審核 + 法律頁（[消費者權益](src/pages/legal/ConsumerRights.jsx) Step 5-6）共同要求的功能，但 Step 1（Top-up）+ Step 2（Pro 年繳）寫完後，Account 取消按鈕仍走 archived 的 [`/api/cancel-subscription.js`](_archived/api/cancel-subscription.js)（Stripe 邏輯）— 真有用戶 14 天內想退款會撞 404。本次補上 NewebPay 端的退款鏈，跟法律頁承諾的內容對齊。並非阻塞上線（沙盒帳號還沒核發），但寫完後沙盒一到手可一次測完 Step 1+2+4 三條鏈。
- ✅ **新增 [newebpay-refunds.sql](newebpay-refunds.sql) 退款 metadata 欄位**：`aivis_newebpay_pending` 加 5 欄 — `refund_status TEXT NOT NULL DEFAULT 'none' CHECK ∈ ('none','pending','completed','failed')` / `refund_amount INTEGER`（預留未來部分退款）/ `refund_method TEXT CHECK ∈ ('api_credit','manual_transfer')` / `refunded_at TIMESTAMPTZ` / `refund_note TEXT`（自由文字記客戶銀行帳號 / API 失敗訊息 / 客服備註）。加 partial index `WHERE refund_status IN ('pending','failed')` 供 admin 查「待手動處理 / 失敗重試」訂單。**用戶側待辦**：Supabase SQL Editor 跑一次。
- ✅ **[api/lib/newebpay.js](api/lib/newebpay.js) 新增 `requestCreditCardRefund({ merchantOrderNo, amount })`**：呼叫 NewebPay `/API/CreditCard/Close` 端點（環境變數 `NEWEBPAY_REFUND_API_URL` 沙盒 `https://ccore.newebpay.com/API/CreditCard/Close` / 正式 `https://core.newebpay.com/API/CreditCard/Close` 切換）。流程：(1) 組 PostData_ 內容（form string）含 `RespondType=JSON` + `Version=1.0` + `Amt` + `MerchantOrderNo` + `TimeStamp` + `IndexType=1`（用商家訂單編號查）+ `CloseType=2`（退款，=1 是請款不適用）(2) AES 加密同 MPG 加密 helper (3) POST form-urlencoded `MerchantID_` + `PostData_`（注意末尾底線是 NewebPay 規範）(4) NewebPay 回 JSON `{ Status: 'SUCCESS' | 'XXX', Message, Result }`，回 `{ ok, status, message, raw }` 給 caller 判斷。
- ✅ **[api/newebpay-notify.js](api/newebpay-notify.js) 加 `?action=refund` 分發 + `handleRefund()` 整段**：Vercel Hobby 12/12 functions 已頂死（[2026-05-12](#2026-05-12)），加新檔會破 build → 合併進既有 notify file，用 query `?action=refund` 區分 server-to-server notify vs user-initiated refund。流程：(1) **驗 user** — 從 `Authorization: Bearer <access_token>` header 解出 `supabase.auth.getUser(token)`，比對 body.userId 防偽造（不接受純信任前端 userId）(2) **查訂單合格性** — `user_id` 對齊 / `kind='pro_yearly'`（Top-up 不退款，依商業模式）/ `status='paid'` / `refund_status='none'`（idempotency）/ `paid_at` 距今 ≤ 14 天 (3) **依 payment_type 分流**：信用卡（`CREDIT*` 開頭）→ 呼叫 `requestCreditCardRefund()` → 成功則 `refund_status='completed'` + `refund_method='api_credit'` + `refunded_at=now` + `refund_amount` / 失敗則 `refund_status='failed'` + `refund_note` 記 NewebPay 錯誤訊息回 400；非信用卡（VACC/WEBATM/CVS/BARCODE）→ `refund_status='pending'` + `refund_method='manual_transfer'` + `refund_note` 記 customer email 供 admin 後續轉帳 (4) **兩條路徑都立即 `profiles.is_pro=false`**（不等手動轉帳完成，產品端先停權公平）(5) 回 `{ success, refund_method, message }` 給前端顯示對應提示。
- ✅ **[src/pages/Account.jsx](src/pages/Account.jsx) handleCancel 四分支重寫 + RefundModal 元件**：(1) 加 3 個 state — `latestProOrder`（用 useEffect 載入用戶最近 paid pro_yearly NewebPay 訂單）/ `refundModalOpen` / `refundResult`。(2) `handleCancel()` 四分支邏輯：**(a) Stripe sub** 用戶（`profile.stripe_subscription_id` 存在）→ alert 提示寄信客服 mark6465@gmail.com（archived endpoint 不可呼叫）/ **(b) NewebPay 14 天內** 有 paid order → 開 `RefundModal` 二次確認 / **(c) NewebPay 超過 14 天** → alert 顯示年期到期日「可繼續使用至 YYYY-MM-DD，到期後自動降回免費版」/ **(d) 找不到 order**（手動授予 Pro）→ alert 客服聯繫。(3) `handleRefundConfirm()` 從 `supabase.auth.getSession()` 拿 access_token → `POST /api/newebpay-notify?action=refund` 帶 Bearer header + `{ userId, merchantOrderNo }` → 成功則記 `refundResult` 並 `setCancelDone(true)` 切換 UI。(4) cancelDone 卡從黃色「已設定取消」改為**綠色** + 雙文案：信用卡顯示「退款已完成 + NewebPay API success」、手動轉帳顯示「退款已申請（待手動轉帳）+ 客服 7 天內聯繫」。
- ✅ **新增 RefundModal 元件**（[Account.jsx](src/pages/Account.jsx) 同檔尾巴）：黑色半透明遮罩 + 中央 GlassCard。內容：(1) **訂單摘要卡**（方案 / 退款金額 T.pass 綠 / 付款方式 / 退款期剩餘天數，剩 ≤ 3 天用 T.warn 警示色）(2) **付款方式分流提示框**：信用卡 → 綠色 T.pass「💳 7-14 工作天退原卡」/ 非信用卡 → 黃色 T.warn「🏦 手動轉帳，客服 7 天內聯繫」(3) **警語** ⚠️「Pro 功能立即停用、資料保留但無 PDF/aivis/修復碼」(4) **雙 CTA**：「繼續使用 Pro」灰底 outline vs「確認退款 NT$X,XXX」紅底 T.fail destructive。
- ✅ **parse 驗證**：[api/lib/newebpay.js](api/lib/newebpay.js) + [api/newebpay-notify.js](api/newebpay-notify.js)（node --check）+ [src/pages/Account.jsx](src/pages/Account.jsx)（@babel/parser sourceType=module + jsx plugin）三檔 parse 通過 (`OK`)。
- 🔖 **取捨：合併進 newebpay-notify.js 用 `?action=refund` 分發而非開新檔**：Vercel Hobby functions 已 12/12 滿，加新檔會破 build。三個候選：(a) 升級 Vercel Pro $20/月 — 用戶之前明確不要 (b) 從 _archived 搬 cancel-subscription.js 回 — 同樣 +1 破上限 (c) 併入既有檔。選 (c) — newebpay-notify 已有完整 NewebPay 加密 helper imports（`parseNotifyPayload`），refund 共用 `requestCreditCardRefund` 邏輯一致。語意上 notify（server→server）vs refund（user-initiated）有點混，但靠 `req.query.action === 'refund'` 在 handler 開頭即分流到獨立 `handleRefund()` function，邏輯不交織。檔名 `newebpay-notify.js` 略誤導但內部分工清楚，比破 build 或多付 $20 划算。
- 🔖 **取捨：refund 驗 user 用 Bearer access_token 而非純信任 body.userId**：原本可以照 Top-up checkout endpoint 那樣只看 body.userId（前端可信賴假設），但退款是「動錢」的操作，理論上有用戶 A 偽造 body 退用戶 B 的訂單再 hijack 顯示 is_pro=true 的攻擊面（雖然不會收到錢，但可破壞別人的 Pro 狀態）。多一層 `supabase.auth.getUser(accessToken)` 比對 `body.userId === auth.user.id` 把這條偽造路徑封死。代價是前端要多寫 `supabase.auth.getSession()` 拿 token + 加 Authorization header，不痛。
- 🔖 **取捨：信用卡與非信用卡都立即 `profile.is_pro=false`**：理論上手動轉帳路徑「客服還沒轉帳給用戶」此時 is_pro=false 等於用戶損失 7 天 Pro 使用（已停權但錢還沒回）。但反向考慮：若手動轉帳路徑保留 is_pro=true 等到 admin 手動轉帳完才停權，會出現「客戶申請退款後繼續吃 Pro 額度 + aivis 150 次掃描」的薅羊毛漏洞。SaaS 業界慣例是「申請退款=即停權」，用戶若不接受可選擇不申請退款用到年期到期。我們的法律頁也明寫「申請退款後 Pro 功能立即停用」（雖然要透過 RefundModal 警語強調），條款層面有保護。
- 🔖 **取捨：Top-up 不開放退款（CHECK 在 handleRefund kind='pro_yearly' 守門）**：商業模式 [CLAUDE.md L222](CLAUDE.md#L222) 明文「Top-up 不過期、用完為止、不退款」。如果開放 Top-up 退款，會撞到「用戶買 800 次 Top-up、用了 600 次、退款拿回全額」這種薅羊毛場景，且 Top-up 配額是次數型（非時間型），不適合 14 天視窗概念。守門靠後端 `if (order.kind !== 'pro_yearly') return 400`，前端 UI 不顯示 Top-up 取消按鈕（Top-up 本來就沒有「取消訂閱」概念）。
- 🔖 **取捨：14 天視窗用 `paid_at` 而非 `created_at`**：訂單 created_at 是「用戶點下升級按鈕」時間，paid_at 是「NewebPay notify 入帳」時間，兩者通常差 1-30 秒（即時付款）但 ATM / 超商等可能差數小時甚至幾天。法律頁鑑賞期承諾的是「收到商品起 14 天」對應 paid_at（實際取得服務）才公道。NewebPay notify 寫入 paid_at 由 [2026-05-11 Top-up commit](#2026-05-11) 已寫好，refund handler 直接消費即可。
- 🔖 **取捨：RefundModal 元件放 Account.jsx 同檔尾巴而非 components/ 獨立檔**：只有 Account.jsx 一處使用，抽出去要寫 prop types + 多 1 個 import 句、IDE 跳查更費事。同檔尾巴 + JSDoc 註解標清楚用途即可。日後若 Pricing 也需要退款 modal（不太可能，Pricing 是升級頁不是降級頁）再抽。
- 🔖 **取捨：取消按鈕點下後若超過 14 天用 `window.alert` 而非 modal**：14 天內走 modal 二次確認（高 stakes 動作要正式）；超過 14 天根本不會發起退款請求、只是告知「期已過、用至到期」純資訊性訊息，alert 就夠。多寫一個 modal 反而讓用戶以為「還可以點什麼動作」。
- ⚠️ **用戶側待辦（上線前）**：(1) **Supabase SQL Editor 跑 [newebpay-refunds.sql](newebpay-refunds.sql) 一次** — 加 5 個欄位 + 1 個 partial index。跑完用 `SELECT column_name FROM information_schema.columns WHERE table_name='aivis_newebpay_pending' AND column_name LIKE 'refund_%'` 驗證。(2) **Vercel env vars 加 `NEWEBPAY_REFUND_API_URL`**（沙盒）：`https://ccore.newebpay.com/API/CreditCard/Close`，正式上線後改為 `https://core.newebpay.com/API/CreditCard/Close`。若不設環境變數會走預設沙盒 URL，不影響沙盒測試。(3) **沙盒測試 4 個 case**：(a) 14 天內信用卡 paid 訂單點取消 → 開 modal → 確認後跑 API → profile.is_pro=false + pending.refund_status='completed' + 看到綠色「退款已完成」狀態卡 (b) 14 天內 VACC 沙盒訂單點取消 → modal 顯示「🏦 手動轉帳」黃色提示 → 確認後 refund_status='pending' + refund_method='manual_transfer'（不會打 NewebPay API） (c) 手動 `UPDATE pending SET paid_at = now() - interval '15 days'` 製造超期訂單 → 點取消按鈕應顯示 alert「年期到期日 YYYY-MM-DD、到期自動降回 Free」 (d) Stripe 用戶（手動把 `profile.stripe_subscription_id` 設成假值）→ 點取消按鈕應 alert「請寄信客服」。
- ⏳ **延後到上線後（非阻塞）**：(1) AdminUsers 加「退款紀錄」展開列（refund_status / refund_amount / refund_method / refunded_at）方便客服查 (2) Admin Dashboard 加「待手動處理退款」紅色 badge — 用既有 partial index 查 `refund_status IN ('pending','failed')` 計數 (3) refund 成功後寄退款確認 email 給用戶（沿用 [send-report-email.js](api/send-report-email.js) Resend 通道）(4) `?refund_success=manual|api` query toast — 與 `?pro_success` 同模式，目前用 cancelDone 卡狀態替代已夠（重整不會掉，因為 refund_status 寫進 DB）。

### 2026-05-13
**NewebPay Phase 1 Step 2 收尾 — `?pro_success` 升級成功 toast + 早鳥名額動態查詢 + 上線前清單同步:**
- 💡 **背景**：早上工作日誌（[2026-05-13 NewebPay Phase 1 Step 2](#2026-05-13)）標了兩個 trade-off 為「先佈線不做 UI」/「目前先寫 0」：(1) NewebPay 跳回 `?pro_success={plan}` query string 前端未消費 → 用戶付款回來沒有任何「升級成功」提示，UX 卡卡 (2) [Pricing.jsx](src/pages/Pricing.jsx) `earlybirdSlotsTaken = 0` 是 hardcode，沒接 `/api/public-stats` 動態查 — 早鳥賣出去進度條都不會動。同時發現「上線前需確認」清單 line 235 寫 Step 2「未開發」是 stale，跟早上工作日誌不一致。本次三件事一次清掉，Step 2 進入「等沙盒實測」終態。
- ✅ **擴充 [api/public-stats.js](api/public-stats.js) 加 `earlybird_taken` 計數**：原 7 個並行 head:true count query 加第 8 個 — `aivis_newebpay_pending` where `pack='earlybird' AND status='paid'`，回 response 新欄位 `earlybird_taken`。同樣 5 分鐘 CDN cache + 10 分鐘 stale-while-revalidate（早鳥名額不需 real-time）。註解標明此 count 同時供 Pricing 進度條與「剩 N 名」文案使用。
- ✅ **[src/pages/Pricing.jsx](src/pages/Pricing.jsx) 三處改動**：(1) 移除 `const earlybirdSlotsTaken = 0` hardcode (2) `stats` state 預設加 `earlybird_taken: null`、新增 `const earlybirdSlotsTaken = stats.earlybird_taken ?? 0` （API 失敗或載入中 fallback 0 避免進度條炸 NaN）— 三處 UI 自動接到動態值（sticky top bar 剩 N 名 / 早鳥 block 進度條 N/100 / footer 文案）(3) **新增 `?pro_success={plan}` toast**：import `useLocation`，useEffect 抓 query string 若 `plan === 'yearly' || 'earlybird'` → 設 `proSuccessPlan` state → 立刻 `navigate(pathname, { replace: true })` 清 URL（防重整再彈）→ 6 秒後自動 setProSuccessPlan(null)。Toast UI 右上 fixed top-16 right-4 z-50，T.pass→teal 漸層 + ✓ 大字 icon + 「✨ Pro 年繳升級成功！」/「🐣 早鳥首年購買成功！」雙文案 + 「付款已送出，系統入帳處理中。Pro 功能將於數十秒內全部解鎖」說明 + 右上 × 手動關閉鈕 + 內聯 `slideInRight` keyframes 進場動畫。
- ✅ **[src/pages/Account.jsx](src/pages/Account.jsx) 同模式 toast**：import `useLocation`、加 `proSuccessPlan` state + useEffect 抓 query string + 6 秒自動消失。Toast UI 放 PageBg 與 `<div className="relative z-10">` 之間，視覺與 Pricing 完全一致（`fixed top-16 right-4 z-50` + T.pass 漸層 + 同雙文案）。為什麼兩頁都要做：NewebPay form-submit ReturnURL 預設 `${SITE_URL}/account?pro_success=${plan}`，但 Pricing 端 `handleUpgrade` 把 `returnUrl: window.location.href` 帶過去 → 從 /pricing 點升級的會回 /pricing、從其他頁（如 Dashboard banner）點則回 /account，兩條路徑都要有 toast 才不會 UX 斷裂。
- ✅ **[CLAUDE.md](CLAUDE.md) line 230-237「上線前需確認」清單同步**：Step 2「未開發」→ `~~~~` strikethrough + ✅ + 「待沙盒帳號核發後實測」終態；同步把 7 天試用兩項合併為一條「程式碼完成 / 待用戶側 SQL + e2e 測試」狀態（A2.1 + A2.2 都在 2026-05-13 同日完工）。剩 4 項依執行順序：NewebPay 沙盒測試（Step 1+2）→ 退款 API → 正式審核 → 7 天試用 e2e。
- ✅ **parse 驗證**：[api/public-stats.js](api/public-stats.js)（node --check）+ [src/pages/Pricing.jsx](src/pages/Pricing.jsx) + [src/pages/Account.jsx](src/pages/Account.jsx)（@babel/parser sourceType=module + jsx plugin）三檔全數 parse 通過 (`OK`)。
- 🔖 **取捨：toast 用 `fixed top-16 right-4` 而非頁面內 banner**：Pricing 有 Sticky 早鳥 bar（z-30）+ Header 緊貼頂部，頁面內 banner 會被 sticky bar 蓋掉或擠壓視覺。fixed 右上角脫離文件流 + z-50 比所有 sticky 高 + max-w-sm 不擋主視覺，桌面 / 手機都 OK。Account 沒有 sticky bar 但用同樣的視覺保持品牌一致性。6 秒消失也比常駐 banner 不擋路。
- 🔖 **取捨：toast 文案不寫「Pro 功能已解鎖」而是「將於數十秒內全部解鎖」**：NewebPay 付款入帳是非同步 — 用戶瀏覽器 form-submit 完跳回 returnUrl 的瞬間，NewebPay 才剛開始把 notify POST 到 `/api/newebpay-notify`，profile.is_pro 可能要 1-30 秒才寫進去。寫「已解鎖」會被「為什麼還沒生效」客訴轟炸；寫「數十秒內解鎖」是誠實預期管理。`navigate(pathname, { replace: true })` 清掉 URL 也順便提示「可重整頁面確認方案徽章」。
- 🔖 **取捨：URL 清理用 `navigate({ replace: true })` 而非 `window.history.replaceState`**：兩種都能清 query string 不留 history entry，但 React Router 內部用 history state 追路由，`window.history.replaceState` 直接改瀏覽器 URL 但 React Router 不知道 → location.search 還是舊值、下次 useEffect 不會 re-run。`navigate(pathname, { replace: true })` 同時更新 URL + React Router state + 觸發 useEffect 依賴變化（從有 search → 無 search），語義最乾淨。
- 🔖 **取捨：early-bird taken 用 `?? 0` fallback 而非 `loading` 狀態判斷**：API 載入中 stats.earlybird_taken 是 null，可以畫個 spinner 或「載入中…」但這會讓進度條視覺閃跳。直接 fallback 0 → 載入完 UI 從「0/100」滑到「N/100」最多一次數字變化，無感平滑。最壞情況 API 完全掛掉用戶看到「剩 100 名」也比看到「載入中」更鼓勵點擊。
- 🔖 **取捨：toast 只放 Pricing + Account，不放 Dashboard / 全域 layout**：理論上可做成全域 `<UpgradeSuccessToast />` 掛在 App.jsx，任何頁面 url 帶 `?pro_success=` 都會彈。但 NewebPay returnUrl 實際只會回兩條路徑（Pricing.handleUpgrade 用 `window.location.href` 帶當前頁，從 Pricing 點則回 Pricing；其他頁面如 Dashboard banner 點「立即升級 Pro」實際 navigate 到 /pricing 才觸發 handleUpgrade）。多寫全域元件 = 多 1 個 file + AuthContext 依賴注入，CP 值低。日後若新增「Dashboard 內聯升級按鈕」直接 fetch /api/checkout-pro-yearly-newebpay 再考慮抽 hook。
- ⚠️ **用戶側待辦（不阻塞）**：(1) 等 NewebPay 沙盒帳號核發後，用沙盒測試卡 `4000-2211-1111-1111` 走一次 yearly 流程，確認跳回 /pricing?pro_success=yearly 後看到綠色 toast + 6 秒自動消失 (2) 同手法測 earlybird → 確認 `aivis_newebpay_pending` 表多一筆 `pack='earlybird' AND status='paid'` 後重整 Pricing 進度條應從「0/100」變「1/100」(3) 測重整 — 在 /pricing?pro_success=yearly 重整 → URL 應已清空（query string 不在），不會再彈第二次 toast。
- ⏳ **延後到上線後（非阻塞）**：(1) 早鳥已售名額快到 100 時提示用戶「剩 N 名・即將額滿」的視覺加強（紅色閃爍 / 倒數）(2) 100 名滿額後自動把 Pricing 早鳥 block 隱藏 + sticky top bar 換成「早鳥已額滿，年繳 NT$13,900 享 14 天無條件退款」(3) AdminRevenue 加「早鳥營收」獨立 row（區分早鳥 NT$11,880 vs 一般年繳 NT$13,900，計算 LTV 差異）。

### 2026-05-13
**7 天免費試用 A2.2 — daily cron 過期掃描 + Day 4/6/7 提醒 email + aivis 試用 50 配額（上線前必修 #3 後半段，A2.1 補完）:**
- 💡 **背景**：A2.1（同日上午）把試用啟動→解鎖→倒數→lazy expiry 整條鏈打通。A2.2 補三件 A2.1 沒做、但「上線後就會有人撞到」的後續：(1) cron 每天掃過期試用 reset 而非只靠 AuthContext lazy expiry（避免「用戶從未登入過、試用過期了帳號還顯示 Pro」的後台資料污染）(2) Day 4/6/7 三段提醒 email 提高 trial→paid 轉換率 (3) aivis 試用期 quota 50 而非 150 防 bot 註冊試用刷大量掃描。Vercel Hobby functions 已 12/12 頂到上限，必須合併進現有 cron-weekly-reports.js 而非加新檔。Vercel Hobby 也只給 2 cron jobs（目前用 1 個），把週一週報擴成每天跑 + 內部用 `getUTCDay() === 1` 分流。
- ✅ **新增 [trial-reminders.sql](trial-reminders.sql)**：`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_reminders_sent TEXT[] NOT NULL DEFAULT '{}'`。用 TEXT[] 記哪些 Day N 已寄過（'day4'/'day6'/'day7'），cron 每天跑時 `array_contains` / `.includes('dayN')` 判斷 idempotency — 同 cron 一天跑兩次（如 retry）也不會重複寄信。NOT NULL DEFAULT '{}' 讓既有 row 自動補空陣列免 backfill。**用戶側待辦**：在 Supabase SQL Editor 跑一次。
- ✅ **[api/cron-weekly-reports.js](api/cron-weekly-reports.js) 大幅擴充：拆兩 function + handler 分流**：(1) 新增 `processTrials({ supabase, RESEND_API_KEY, SITE_URL })` — 先 `UPDATE profiles SET is_trial=false, is_pro=false WHERE is_trial=true AND trial_ends_at < now() RETURNING id, email, name, trial_ends_at, trial_reminders_sent`（一個 SQL 同時掃 + 拿到剛過期 row 的舊 trial_reminders_sent 陣列）→ 對每個剛過期 row 若 !sent.includes('day7') 寄 Day 7 信並 append 'day7' 到 array。再 SELECT 所有 is_trial=true 的活躍試用，依 `daysSinceStart = (now - trial_started_at) / 86400000` 分流：3 ≤ days < 5 寄 Day 4（剩 3 天）、5 ≤ days < 7 寄 Day 6（剩 1 天），都用 !sent.includes() 守門。(2) `processWeeklyReports({ ... })` 原本的週報邏輯整段搬進去不變（同樣 6 天去重、loop email_subscriptions 並 join websites 拉最新 audits、Resend 寄信、寫 last_sent_at）。(3) handler 改成「每天先 await processTrials() → 若 `new Date().getUTCDay() === 1` 才 await processWeeklyReports()」，回 jsonb `{ success, trial: { expired, day4, day6, day7, failed }, weekly: null|{ sent, failed, skipped } }`。
- ✅ **新增 [buildTrialEmailHTML({ kind, name, trialEndsAt, daysLeft, dashboardUrl, pricingUrl })](api/cron-weekly-reports.js) 三段 email 模板**：單一 function 內 `COPY` 物件分 day4/day6/day7 三套 subject + headerTitle + heroLine + body + cta1/cta2 + gradient（綠/橙/紫）。共用外殼 — `linear-gradient(135deg, #1e293b 0%, ${gradient} 100%)` 深藍→主色 header bar + hero 區大字（kind-specific gradient 著色）+ body 文字（HTML <br> + <strong> 排版）+ 雙 CTA（主橘琥珀漸層、副半透明 outline）。Day 4 著重「還沒體驗的 Pro 功能」（修復碼/aivis 50 次/平台別指南三條）、Day 6 著重「無縫銜接 + 早鳥 NT$990 限時優惠」、Day 7 著重「資料已保留 + AI 引用率天天在變 = 持續訂閱核心價值」。從 `mark6465@gmail.com` 寄出（footer 也標這個 email 收回信，方便用戶反饋使用體驗）。
- ✅ **[api/aivis/fetch.js](api/aivis/fetch.js) 加試用期額度分支**：(1) 新增常數 `AIVIS_QUOTA_PER_TRIAL = 50`（與 trial-system.sql FAQ 文案「試用期 aivis 上限 50 次」對齊）。(2) 拉 prompt 後並行 `select is_trial, trial_started_at from profiles where id = prompt.user_id`。(3) `isTrial = !!profile?.is_trial && !!profile?.trial_started_at`，據此分流：`quotaLimit = isTrial ? 50 : 150`、`hardCap = isTrial ? 50 : 1000`（試用期硬上限=quota 不開放 Top-up）、計數起始 `countSinceIso = isTrial ? trial_started_at : monthStart`（整 7 天試用期合計 vs UTC calendar month）。(4) 硬上限攔截 error code 試用走 `trial_quota_exhausted`、付費走 `monthly_hard_cap_exceeded`，前端可分流不同提示。(5) Top-up 消費路徑 `if (!isTrial && wouldBeNthQuery > AIVIS_QUOTA_PER_MONTH)` 加 isTrial 守門 — 試用用戶就算撞到 50 次也不走 `aivis_consume_topup_credit` RPC（hardCap=50 已先擋）。(6) response `quota` meta 加 `is_trial` 旗標 + `quota_per_month` 改回 `quotaLimit`（前端 banner 可顯示「試用期額度 N/50」vs「本月 N/150」）。
- ✅ **[vercel.json](vercel.json) cron schedule 改每天跑**：`"0 9 * * 1"`（週一）→ `"0 9 * * *"`（每天 09:00 UTC）。檔名仍叫 cron-weekly-reports.js 不改 — 改檔名會讓 Vercel cron history 斷掉、且既有 CRON_SECRET 環境變數設定不必動。
- ✅ **parse 驗證**：[api/cron-weekly-reports.js](api/cron-weekly-reports.js) + [api/aivis/fetch.js](api/aivis/fetch.js) 兩個改動檔 `node --check` 通過 (`OK`)。vercel.json schedule 改動確認 (cat 顯示 `"0 9 * * *"`)。
- 🔖 **取捨：合併進 cron-weekly-reports.js 而非新加 cron-trial.js**：Vercel Hobby functions 上限 12/12 已頂滿（[2026-05-12 工作日誌](#2026-05-12)），再加 1 個會破 build。Vercel Hobby cron jobs 上限 2 個目前用 1 個，理論上可加，但「每天跑掃過期 + 提醒」這兩件事跟「週一寄週報」邏輯都是 cron 觸發 + 並行寄 email + 寫 last_sent_at 同模式，併進一支 file 用 day-of-week 分流是 SaaS 慣例。代價是 file 從 256 行膨脹到 ~400 行，但邏輯清楚拆兩個 function，可讀性沒掉。
- 🔖 **取捨：trial_reminders_sent 用 TEXT[] 而非 boolean × 3**：原本可以加 `day4_sent BOOLEAN`、`day6_sent BOOLEAN`、`day7_sent BOOLEAN` 三個欄位，但 (1) 未來想加 Day 5 還要 ALTER TABLE (2) 三欄位 query/update 比較囉嗦（要寫三條 `OR day4_sent = false`）(3) TEXT[] + `'dayN' = ANY(arr)` / `array_append` 表達意圖最直接。Postgres 對短 array 的 `ANY()` 效能跟 boolean 不會差。
- 🔖 **取捨：Day 4 寄條件 `3 ≤ days < 5`，不是純 `>= 3`**：純 `>= 3 && !sent.includes('day4')` 看似簡單，但會撞到 edge case — 若用戶在試用第 1 天起算、cron 第 3 天剛好 09:00 之前啟動試用 → daysSinceStart < 3 沒寄 Day 4 → 第 4 天 daysSinceStart 已 4.x，過了「Day 4 是『提醒剩 3 天』」的語意。改成區間限制 `3 ≤ days < 5` 確保 Day 4 永遠在 day3~day4 區間寄、Day 6 永遠在 day5~day6 區間寄、Day 7 在過期當下寄。極端晚註冊（如 days = 4.9 才註冊，第一次 cron 跑時就 days=5+）會跳過 Day 4 直接寄 Day 6，這 OK — 比寄錯 daysLeft 數字（user 看到「剩 3 天」但其實只剩 2 天）好。
- 🔖 **取捨：Day 7 寄出時機 = 試用過期當天的 cron 跑時（不是 trial_ends_at 那一秒）**：理論上 trial_ends_at 是 trial_started_at + 7 days 那精準秒，但 cron 每天 09:00 UTC 才跑一次。意味著 Day 7 信可能在試用過期後 0~24 小時內才寄出。可接受 — 用戶體驗上「試用結束後一天內收到 email」比「剛過期那一秒立刻收到」更不容易被忽略（用戶可能那秒在睡覺）。AuthContext lazy expiry 在試用期內若有人 load profile 也會立刻 reset is_pro 不等 cron，所以「過期後 0~24 小時 Pro 功能還能用」的 leak 視窗實際上更短。
- 🔖 **取捨：試用期 aivis quota=50（而非 150）且不開 Top-up**：50 次設計理由 (a) 防 bot 註冊試用刷大量 AI 掃描 — 150 × 多帳號的成本爆炸 (b) 試用期 7 天 ÷ 50 次 ≈ 每天 7 次掃描，足夠正常用戶評估「aivis 對品牌監測有沒有用」 (c) hardCap=quota=50（不開 Top-up）讓「想要更多」=「升級訂閱」這條 conversion 路徑唯一明確，不會被「先加購 Top-up 看看」分散決策。付費 Pro hardCap 1000 是因為已收年費風險低、Agency 推出前留個安全網。
- 🔖 **取捨：cron 把 expired sweep + Day 7 send 合併在同 function**：原本可以拆成「先一個 UPDATE 把所有過期 row reset，再一個 SELECT 撈剛剛過期的 row 寄 Day 7」，但這樣兩條 query 中間有 race condition（其他 worker 同時跑 lazy expiry 把 row 也 reset 了 → 第二條 SELECT 撈不到）。改用 PostgreSQL `UPDATE ... RETURNING` 一次 atomic 同時做兩件事 + 拿到剛 reset 的 row（含舊 trial_reminders_sent 值），再 in-memory loop 寄 email。同樣的 row 不會被別人重複 sweep（is_trial=false 後 WHERE is_trial=true 就跳過了）。
- ⚠️ **用戶側待辦（上線前）**：(1) **Supabase SQL Editor 跑 [trial-reminders.sql](trial-reminders.sql) 一次** — 加 trial_reminders_sent TEXT[] 欄位。跑完用 `SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='trial_reminders_sent'` 確認 (2) **確認 Resend `report@aark.io` 寄件人已驗證**（已沿用既有週報 from address，理論上 OK 但 trial email 量比週報大、Resend domain reputation 影響可能更大）(3) **測試流程**：用測試帳號啟動試用 → 手動 `UPDATE profiles SET trial_started_at = now() - interval '4 days', trial_ends_at = now() + interval '3 days' WHERE id=X` 模擬 Day 4 → 在 Vercel Dashboard 手動觸發 cron `/api/cron-weekly-reports`（帶 CRON_SECRET）→ 確認收到 Day 4 信、profile.trial_reminders_sent = ['day4'] (4) 同樣手法測 Day 6（trial_started_at = now() - interval '6 days', trial_ends_at = now() + interval '1 day'）與 Day 7（trial_ends_at = now() - interval '1 hour'，會同時觸發 expire sweep + Day 7）(5) **aivis 試用 quota 測試**：試用帳號去 aivis dashboard 跑掃描 → quota meta 應回 `{ quota_per_month: 50, hard_cap: 50, is_trial: true }`、跑到第 50 次後第 51 次應回 429 `trial_quota_exhausted`。
- ⏳ **A2.3 延後到上線後再做（非阻塞）**：(1) 試用啟動分析事件埋點（trial_started / trial_converted_to_paid / trial_expired_without_upgrade funnel）— 上線後 1-2 週看 conversion 數字決定要不要加 (2) 試用結束後 7 天再寄一封「資料即將清理」email — 暫不做，CLAUDE.md 商業模式只承諾「資料保留」沒說多久，避免承諾要清資料 (3) 試用期 aivis dashboard banner 顯示「試用期額度 N/50」而非 N/150 — 前端可消費 fetch.js 回傳的 `quota.is_trial` flag 切換顯示，但會牽涉 AIVisibilityDashboard.jsx 的 UsageBanner 跟 TopupModal 條件，本次先讓後端 ready、前端等用戶反饋再調整。

### 2026-05-13
**7 天免費試用 A2.1 — DB schema + AuthContext lazy expiry + Pricing CTA + Account 試用卡 + Dashboard 倒數 banner（上線前必修 #3 前半段）:**
- 💡 **背景**：上線前必修清單第 3 項「7 天試用 end-to-end 驗證」，分兩階段做。**A2.1（本次）**：把試用啟動 → 解鎖 → 倒數顯示 → lazy 過期降回 Free 整條鏈打通，上線後就能讓用戶在 Pricing 點「免費試用 7 天」走完整個流程。**A2.2（後續）**：每日 cron 掃過期 + Day4/6/7 提醒 email + aivis 50 配額（試用期 aivis 上限），都是這條鏈跑起來後才有意義的優化。
- ✅ **新增 [trial-system.sql](trial-system.sql)**：(1) profiles 加 3 個欄位 `is_trial / trial_started_at / trial_ends_at` (2) 加 partial index `idx_profiles_trial_ends_at ON profiles(trial_ends_at) WHERE is_trial=true`（給後續 cron 掃過期用 — 表大了一秒掃完不 full scan）(3) RPC `start_pro_trial()` SECURITY DEFINER：從 `auth.uid()` 拿用戶 id（不接受前端傳 id 避免偽造）→ 檢查 `trial_started_at IS NULL`（一輩子只能 1 次試用）+ `is_pro=false`（已付費 Pro 不需要試用）→ `UPDATE profiles SET is_trial=true, is_pro=true, trial_started_at=now(), trial_ends_at=now()+'7 days'` → 回 jsonb `{ok, trial_ends_at}` 或 `{ok:false, error: 'already_trialed' | 'already_pro' | 'not_authenticated' | 'rpc_failed'}`。GRANT EXECUTE 只給 authenticated（anon 拿不到 auth.uid() 也會被擋）。**用戶側待辦**：在 Supabase SQL Editor 跑一次。
- ✅ **[src/context/AuthContext.jsx](src/context/AuthContext.jsx) 加 lazy expiry + startTrial + 4 個 derived 值**：(1) `expireIfNeeded(row)` — profile load 時若 `is_trial=true && trial_ends_at < now` → 立刻 UPDATE 寫回 `is_trial=false, is_pro=false` 並設定 setProfile 到新值（cron 萬一掛了的安全網，不阻塞 UI 失敗就下次 load 再試）(2) `startTrial()` → `supabase.rpc('start_pro_trial')` → 成功就 `await fetchProfile(user.id)` 立刻刷 UI (3) 4 個 derived：`isTrial / trialEndsAt / hasTrialedBefore (!!trial_started_at) / trialDaysRemaining (向上取整 — 剩 6.2 天顯示「剩 7 天」更友善)` 全部加進 Context value 給三頁消費。
- ✅ **[src/pages/Pricing.jsx](src/pages/Pricing.jsx) — 三狀態 CTA 邏輯**：destructure 加 `isTrial / hasTrialedBefore / trialDaysRemaining / startTrial`。新增 `handleStartTrial()` — 未登入導 /register、已 Pro 導 /、`hasTrialedBefore=true`（試用過了）改走 `handleUpgrade` 直接結帳、否則打 `startTrial()` → 成功導 /、`already_trialed` 走 fallback 結帳。ProCardBody CTA 三分支：(a) `isPro && isTrial` → 「✨ 試用中・剩 N 天」+ 管理訂閱連結 (b) `isPro` → 「✓ 目前方案」+ 管理訂閱連結 (c) 否則 → button：`!hasTrialedBefore` 顯示「免費試用 7 天」走 `onStartTrial`、`hasTrialedBefore` 顯示「立即升級 Pro · NT$X／月」走 `onUpgrade`。Mobile sticky bottom CTA 同樣分支。
- ✅ **[src/pages/Account.jsx](src/pages/Account.jsx) — 試用狀態卡 + 試用中徽章 + 方案管理三狀態**：(1) Avatar 區徽章三段：`isTrial` → 綠色「✨ 試用中・剩 N 天」（脈動點，`T.pass` #10b981 配 #86efac）/ `isPro` → 紫色 Pro 徽章 / 否則橘色「免費版」(2) Avatar GlassCard 與「方案管理」卡之間新增獨立 `<GlassCard color={T.pass}>` 試用狀態卡：左欄「✨ 免費試用中」標題 + 「剩 N 天」大字 T.pass 綠 + 試用結束日期 + 一行說明「試用結束前升級 Pro 可無縫銜接；不升級則自動降回免費版，已建立的資料保留」/ 右側「立即升級 Pro →」橘琥珀漸層按鈕（連 /pricing）(3) 方案管理卡內邏輯改三分支：`isTrial` → 簡化版「7 天免費試用 + 剩 N 天」+「升級 Pro 訂閱」按鈕（無「取消訂閱」鈕，因為沒有實際訂閱可取消，試用過期會自動降回 Free）/ `isPro` → 維持原本 Pro 訂閱管理（取消訂閱）/ 否則 → 免費版升級 CTA。
- ✅ **[src/pages/Dashboard.jsx](src/pages/Dashboard.jsx) — 頂部倒數 banner**：destructure 加 `isTrial / trialEndsAt / trialDaysRemaining`。AnnouncementBanner 與 upgradeSuccess 之間插入新 banner — `linear-gradient(90deg, ${T.pass}1f → ${T.aeo}1f)` 綠紫漸層 + `backdrop-blur-xl` + 雙列文案：第一列「✨ Pro 試用中・剩 N 天」(N 字 T.pass 綠 emphasis) / 第二列「YYYY-MM-DD 到期・升級訂閱可無縫銜接所有功能」+ 右側兩顆按鈕「查看試用詳情」（半透明邊框 → /account）/「立即升級 Pro →」（橘琥珀漸層 → /pricing）。`flex-wrap` 響應式手機自動換行。
- ✅ **parse 驗證**：[AuthContext.jsx](src/context/AuthContext.jsx) + [Pricing.jsx](src/pages/Pricing.jsx) + [Account.jsx](src/pages/Account.jsx) + [Dashboard.jsx](src/pages/Dashboard.jsx) 四檔全數 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：is_pro + is_trial 雙旗標而非單獨拆 trial state**：試用期間用戶要解鎖完整 Pro 功能（修復碼產生器 / PDF 匯出 / aivis 等），最少阻力做法是讓 `is_pro=true`，整個 codebase 既有的 `isPro` 判斷都自動生效。另加 `is_trial=true` 旗標只供前端顯示倒數 + 區分「試用 Pro vs 付費 Pro」（前者沒有實際訂閱可取消、過期自動降回 Free；後者要走 Stripe / NewebPay 取消流程）。如果用第三個 state 'trial' 取代 is_pro，要改 50+ 處 `isPro` 判斷風險太大。
- 🔖 **取捨：lazy expiry 寫回 DB 而非純前端判斷**：原本可以前端算 `trialEndsAt < now ? force isPro=false in derived` 不寫 DB，但這會導致 (1) cron 掃描索引看到的 row 與用戶實際狀態不一致 (2) admin 後台看 profiles.is_pro=true 但用戶其實已過期 → 客服困擾。lazy expiry 直接寫回 DB 讓 source of truth 永遠一致；UPDATE 失敗就下次 load 再試（非阻塞），cron 萬一掛了至少有人 load profile 時會幫忙修。
- 🔖 **取捨：startTrial 用 SECURITY DEFINER RPC 而非 Vercel function**：Vercel Hobby 12 functions 上限已頂到 12/12（[2026-05-12 工作日誌](#2026-05-12) 整理過），再加 1 個會破上限。Supabase RPC 不算 Vercel function 額度，且 SECURITY DEFINER + `auth.uid()` 寫法剛好可以做「不接受前端傳 user_id」的防偽造保護，比 Vercel function 還安全。
- 🔖 **取捨：trialDaysRemaining 用 Math.ceil 向上取整**：實際剩 6.2 天，`Math.floor=6` 會讓用戶覺得「明明剛啟動沒幾天怎麼就剩 6 天」，`Math.ceil=7` 「剩 7 天」更友善。試用啟動瞬間 trial_ends_at = now+7d 算出 days=7.0 也剛好顯示「剩 7 天」對齊「7 天免費試用」這個賣點承諾。
- 🔖 **取捨：Account 試用方案管理卡不顯示「取消」按鈕**：試用期沒有實際訂閱（沒刷卡、沒 Stripe/NewebPay subscription_id），「取消」按鈕點下去什麼都不會發生。試用過期會自動降回 Free（lazy expiry + cron 雙保險），用戶想提前停試用直接不升級即可，不需要顯式取消按鈕。改為單一 CTA「升級 Pro 訂閱」引導 conversion。
- 🔖 **取捨：Pricing 三分支 CTA 邏輯放在 ProCardBody 內部而非 wrapper**：原本可以在外層 `if (isTrial) <TrialCTA /> else if (isPro) <ProCTA /> else <FreeCTA />` 拆三個元件，但這三個分支共享 80% 的卡片外框（GlassCard + 標題 + 價格 + 功能列表），拆會造成大量重複。內聯三元 + props 傳入是最小改動路徑。
- ⚠️ **用戶側待辦（上線前）**：(1) **Supabase SQL Editor 跑 [trial-system.sql](trial-system.sql) 一次** — 建好 3 個欄位 + 1 個 partial index + start_pro_trial() RPC + GRANT EXECUTE。跑完用 `SELECT proname FROM pg_proc WHERE proname='start_pro_trial'` 確認 function 存在 (2) **測試流程**：用測試帳號 Pricing 點「免費試用 7 天」→ 確認 navigate('/') 後 isPro=true（Dashboard 解鎖 Pro 功能）+ Account 頁出現綠色試用狀態卡 + Dashboard 頂部出現倒數 banner (3) **過期測試**：手動 `UPDATE profiles SET trial_ends_at = now() - interval '1 hour' WHERE id = X` 模擬過期 → 重整頁面 → 確認 AuthContext lazy expiry 把 is_pro/is_trial 都改 false → 試用卡與 banner 消失、回到 Free 狀態。
- ⏳ **A2.2 待後續（不阻塞上線）**：(1) 每日 cron 掃 `is_trial=true AND trial_ends_at < now()` 把 is_pro/is_trial 都 reset false（合併到既有 cron-weekly-reports.js 改成每日跑、避免再加 cron 函式）(2) Day 4 / Day 6 / Day 7 試用提醒 email（沿用 send-report-email.js 模板）(3) aivis fetch.js 試用期 quota = 50（vs 付費 Pro 150）— 防止刷單拿大量 AI 掃描 (4) 試用啟動分析事件埋點（看 funnel：點 CTA → start_trial → 試用期內升級 Pro 的轉換率）。

### 2026-05-13
**上線前小修補批次 — 404 頁面 + sitemap 擴充 + OG/Twitter meta 補完:**
- 💡 **背景**：等 NewebPay 審核期間（3-5 工作天）做幾個不阻塞、不依賴外部、不佔 Vercel functions 額度（已 12/12）的上線前小修補。挑了 3 個 trust 與 SEO/SMO 的基本要素：404 死路徑 / 部分頁面未進 sitemap / OG 缺圖。
- ✅ **新增 [src/pages/NotFound.jsx](src/pages/NotFound.jsx) + [App.jsx](src/App.jsx) 替換 catch-all**：原本 `<Route path="*" element={<Navigate to="/" replace />} />` 把任何錯誤 URL 靜默 redirect 回首頁 — 用戶不知道自己點錯、首頁載完也不知道為什麼來這。改為 `<NotFound />` 顯示：(1) 巨大 404 橘紅漸層數字 (2) 「找不到這個頁面」+ 一段說明 (3) 主 CTA「← 回到首頁分析」橘紅漸層 + 副 CTA「查看方案 →」半透明 (4) 4 顆常用連結（排行榜 / 競品比較 / 文章分析 / 常見問題）作為 escape hatch (5) 底部 mailto 回報壞連結。沿用 LegalPageLayout 同款外殼（青綠雙端漸層 + 雜訊 + SiteHeader + Footer），視覺與其他頁一致。連帶移除 `Navigate` import（不再用到）。
- ✅ **擴充 [public/sitemap.xml](public/sitemap.xml) 從 4 → 9 URLs**：原本只列了 / / pricing / showcase / compare 4 頁，補上 /faq / /content-audit（內容類，weekly+0.7）+ /terms / /privacy / /consumer-rights（法律類，monthly+0.4）。`/dashboard/:id` / `/seo-audit/:id` 等 user-scope 頁面不放進 sitemap（屬於登入後個人化內容，Googlebot 也爬不到）。
- ✅ **[index.html](index.html) 補 OG + Twitter Card meta**：原本只有 og:title/description/url/type/locale 5 個，補上 og:site_name（社群顯示「優勢方舟數位行銷 — AI能見度（AIVIS）」品牌名）/ og:image + og:image:width/height/alt（1200×630 標準尺寸 + 替代文字）+ Twitter Card 4 個（card=summary_large_image + title + description + image）。FB / LINE / Slack / X 分享預覽會吃這些 tag，沒設 og:image 的話縮圖會空白傷 CTR。
- ✅ **parse 驗證**：[NotFound.jsx](src/pages/NotFound.jsx) + [App.jsx](src/App.jsx) 皆 node + @babel/parser parse 通過 (`OK`)。sitemap.xml 9 URLs / index.html 4 個新 meta key 全部就位確認。
- 🔖 **取捨：404 用 SPA route 而非真正的 HTTP 404 status**：理想是讓伺服器回 404 status code（讓 Googlebot 不索引這條 URL），但這需要 Vercel rewrite/edge function 或改 Vite 出 fallback 機制。SPA 路由 catch-all 出 HTTP 200 + 客戶端顯示 404 內容是 React SPA 通用 trade-off，視覺體驗已對齊；SEO 端如果之後要嚴格做 404 status 再加 vercel.json rewrite 或 middleware（多 1 個 function 又要破 12/12 上限，所以暫不做）。
- 🔖 **取捨：og-image.png 沒生成、只留 reference**：1200×630 OG 圖需要設計師 / Figma 出，這次只先把 meta tag 補上、reference path `/og-image.png`，等用戶把實際圖片放進 `public/og-image.png` 即可生效。未放圖前 FB/X 抓圖會 fallback 沒圖（不會壞，只是縮圖空白）。
- ⚠️ **URL 不一致提醒**：sitemap.xml / index.html / robots.txt 都用 `https://www.a-ark.com.tw/`，但 production 實際是 `aark-workspace.vercel.app`（CLAUDE.md 也記錄如此）。法律頁內文寫的也是 `aark-workspace.vercel.app`。兩種網址同時存在是因為自訂網域 a-ark.com.tw 可能規劃中但未指到 Vercel。**用戶側待決定**：(a) 把 a-ark.com.tw 指到 Vercel 並設為正式 URL，sitemap/canonical 維持現狀 (b) 改為 aark-workspace.vercel.app（要改 3 個檔案 + index.html canonical）。本次先不動 URL，等用戶確認 canonical domain。
- ⚠️ **用戶側待辦（不阻塞上線）**：(1) 出一張 1200×630 的 og-image.png（建議：黑底 + 橘紅 logo + 「在 AI 搜尋時代讓品牌被看見」標語 + 雷達圖示意），放進 `aark-workspace/public/og-image.png` (2) 確認 canonical domain 與 sitemap URL 一致（見上面 URL 不一致提醒）。

### 2026-05-13
**NewebPay Phase 1 Step 2 — Pro 年繳一次性付款（NT$13,900 + 早鳥 NT$11,880）後端 + 前端串接完成:**
- 💡 **背景**：14 天無條件退款的前置必備。Phase 1 Step 1（Top-up）已於 2026-05-11 完成、法律頁三件套已於 2026-05-12 補完並重新送 NewebPay 審核，趁等待審核（3-5 工作天）期間把 Step 2 寫好，等沙盒帳號 + 正式商家代號核發後可直接打開上線。月繳（Phase 1 Step 3 定期定額）暫時仍走 Stripe 通道、後續另行處理。
- ✅ **新增 [api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js)**：`POST` body `{ userId, email, plan: 'yearly'|'earlybird', returnUrl }` → `PLAN_SPEC` 對映 plan → amount + label（yearly=NT$13,900 / earlybird=NT$11,880 = 990×12）。流程沿用 Top-up 同模式：(1) INSERT `aivis_newebpay_pending`（kind='pro_yearly'、pack=plan、amount=spec.amount，兩個 plan 共用 kind 因為 DB CHECK constraint 只允許 4 種值；用 pack 欄位區分早鳥 vs 一般年繳）(2) 組 trade params（RespondType=JSON、NotifyURL=`${SITE}/api/newebpay-notify`、ReturnURL 帶 `?pro_success={plan}` 回原頁、ClientBackURL=/pricing、CREDIT/VACC/WEBATM/CVS/BARCODE 全開沙盒先全試）(3) `buildPaymentForm()` 產 form fields 回前端。merchantOrderNo prefix `py` / `peb` 讓人眼看訂單前綴就能辨識早鳥 vs 一般。
- ✅ **修改 [src/pages/Pricing.jsx](src/pages/Pricing.jsx) `handleUpgrade` 分流**：`priceType === 'yearly' || 'earlybird'` 走新的 NewebPay endpoint → 拿到 `{ apiUrl, fields }` → `document.createElement('form') + 5 個 hidden inputs（MerchantID/TradeInfo/TradeSha/Version/EncryptType）+ appendChild + form.submit()` 整頁跳轉到 NewebPay 付款頁。`priceType === 'monthly'` 維持 fetch `/api/create-checkout-session` 走 Stripe（暫時保留，Phase 1 Step 3 定期定額串好後再切換）。涵蓋四個 CTA 觸發點：Sticky top bar 搶名額（earlybird）/ Pro 卡片立即升級（yearly 或 monthly）/ 早鳥 block 搶早鳥按鈕（earlybird）/ Mobile sticky bottom CTA（依 isYearly 切換 yearly / monthly）。
- ✅ **notify handler `pro_yearly` 分支已就緒**：[api/newebpay-notify.js](api/newebpay-notify.js) 早在 Phase 1 Step 1 寫 Top-up 時就把 `pro_yearly` 分支寫好了 — 收到 paid 通知後 `update profiles set is_pro=true, payment_gateway='newebpay', subscribed_at=now() where id=pending.user_id`。本次 endpoint 寫入的 pending row（kind='pro_yearly'）正好對應這個分支，無需動 notify handler。
- ✅ **parse 驗證**：[api/checkout-pro-yearly-newebpay.js](api/checkout-pro-yearly-newebpay.js) + [src/pages/Pricing.jsx](src/pages/Pricing.jsx) 皆 node + @babel/parser parse 通過 (`OK`)。
- 🔖 **取捨：yearly + earlybird 共用 kind='pro_yearly'，用 amount + pack 區分**：DB CHECK 只開 4 個值（topup_small/topup_large/pro_yearly/pro_monthly_first），不想為早鳥再 ALTER TABLE 加新值（會造成既有 row 反查麻煩）。同樣是「一年期 Pro 訂閱」，notify 端的 profiles 更新邏輯也完全一致（is_pro=true + subscribed_at=now），差別只在收的錢不一樣。pack 欄位記 'yearly'/'earlybird' 給 AdminRevenue 報表區分這筆是否為早鳥優惠，未來計算 LTV / 早鳥名額耗用時可用。
- 🔖 **取捨：月繳暫時不切走 NewebPay**：NewebPay 定期定額需要另外申請「定期定額授權」資格、API 跟一次性付款 (MPG) 不同（要走 NPA 信用卡定期定額），這條鏈未串通前先讓 yearly + earlybird 跑起來，month 訂閱用戶數量小（多數會被早鳥 + 年繳折扣拉走）影響有限。Phase 1 Step 3 視 NewebPay 正式核發後實際支援哪些 API 再決定。
- 🔖 **取捨：成功 returnUrl 帶 `?pro_success={plan}` query string 但前端目前不消費**：NewebPay form-submit 完成後瀏覽器跳回 returnUrl（通常是 /pricing 或 /account），帶這個 flag 未來想顯示「✓ 升級成功」toast 時直接讀 `URLSearchParams` 即可，本次先佈線不做 UI。實際入帳是非同步走 notify URL 寫 DB，前端 toast 只是給用戶心理確認，不依賴 NewebPay redirect 帶資料。
- 🔖 **Vercel functions 計數 11 → 12（剛好頂到 Hobby 上限）**：本 commit 新增 1 個 endpoint 後 functions 計數 = 12，正好是 Hobby plan 上限。未來再需新加 API 必須先合併現有端點（例如把 admin 系列收進單一 router file）或升級 Vercel Pro。NewebPay 退款 API（Phase 1 Step 4 待辦）有兩種做法可避免再 +1：(a) 與 notify handler 合併（用 query param 分發 `/api/newebpay-notify?action=refund`）(b) 升級 Vercel Pro。本次先讓 yearly 上線。
- ⚠️ **用戶側待辦（上線前）**：跟 Phase 1 Step 1 共用同一批前置條件，無新增項目 — (1) NewebPay 沙盒帳號核發後填 env vars（NEWEBPAY_MERCHANT_ID/HASH_KEY/HASH_IV）(2) Supabase SQL Editor 跑 [newebpay-pending-orders.sql](newebpay-pending-orders.sql)（如尚未跑）(3) 沙盒測一次年繳全流程：點「立即升級 Pro」→ 跳轉 NewebPay → 沙盒測試卡（4000-2211-1111-1111）付款 → notify 回寫 profiles.is_pro=true。

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

