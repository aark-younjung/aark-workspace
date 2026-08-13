# AGENTS.md — 方舟 AI 雷達 · AI 代理協作指引

> 給在此 repo 工作的 AI 代理（Codex / Claude / Cursor…）。**動手前先讀本檔 + [CLAUDE.md](./CLAUDE.md)。**
> 產品脈絡、資料表、路由、商業模式在 [CLAUDE.md](./CLAUDE.md)；工作日誌在 [WORKLOG.md](./WORKLOG.md)；改版架構/決策在 [_design/redesign-spec.md](./_design/redesign-spec.md)；改版長相在 [_design/redesign-app.html](./_design/redesign-app.html)。

---

## 0. 最高原則：誠實（違反有法律風險 — 公平交易法）

- **不捏造數據/分數/統計/見證。** 一律接真實資料；沒資料就用誠實 placeholder「接資料中」或空狀態。設計稿裡的示意數字（62、41%…）是**假的**，實作要換成真 query，沒有就顯示空狀態。
- **只講 3 個 AI 引擎：ChatGPT / Claude / Gemini。** 絕不寫「5 引擎」、不把 **Perplexity** 當「監測引擎」（爬蟲/教育類的 `PerplexityBot`、robots.txt 字樣可保留）。
- **不寫「保證上 AI 推薦」** 這類保證性字眼。
- 掃描實際是**單頁 + 站台層檔案**（robots / sitemap / llms.txt），**不可暗示全站爬蟲**。
- aivis「頭條曝光率」只用 core（品類）題；品牌詞題、資訊型題**另計、不灌入主分數**。

## 0.1 檢測呈現規則（⚠️ 延續性硬需求：改版、大改版都要沿用，不可弄丟）

> 背景：掃描是「單頁 + 站台層檔案」。多次客訴同源——用戶在**內頁/FAQ 頁**做了麵包屑/FAQ，我們卻在**首頁**掃描、用全站口氣說「你沒有」，冤枉人。以下三條是這問題的長期解，邏輯放共用 lib，現行產品與改版共用同一支。

1. **頁型判斷（page-type）** — 共用 `src/lib/pageAudit.js`（`isHomepage` / `HOMEPAGE_NOTES` / `HOMEPAGE_NA_CHECKS`）。
   - **麵包屑 / FAQ schema 在首頁「缺」是正常的**（首頁在最上層、沒有麵包屑；FAQ 通常在 FAQ 頁）→ 首頁這兩項＝**N/A：不紅字、不扣分**，標「通過＋正常化說明」。
   - **已做到計分層（2026-08-13）**：`aeoAnalyzer` 的 `scoredPassed` 首頁對這兩項免扣分（DB 的 raw boolean 照實存＝誠實；只有 score 用調整後）；顯示層（`AEOAudit` / `buildAeoChecks`）同步翻 `passed=true`。**舊 audit 要重掃才套新計分。**
   - 例外：首頁若真的有 FAQ 區塊（`faq_visual`）→ 是「該補 schema」的真問題，照舊扣分、不套正常化說明。

2. **站台層複查（site-wide）** — 共用 `src/lib/siteWideSchema.js`（`detectSchemaAcrossSite`）+ `src/components/SiteWideSchemaProbe.jsx`（深/亮兩色）。
   - 首頁報「缺麵包屑/FAQ」時，經 `fetchSitemapUrls` 去站台其他頁**實際驗證**，找到就明講「你的 /faq/ 有，這一頁沒有是正常的」。
   - 已接：`AEOAudit`（深色）+ 改版 `AppHealth`（亮色）。改版新做任何體檢頁都要沿用同一支。
   - **誠實**：只講「我們檢查的這幾頁」（回 `checked` 數），**絕不宣稱「全站」**都有／都沒有（只抓有限頁數；抓不到 sitemap 回 `unknown`、不下結論）。

3. **Meta 描述長度分語言 + 明確標示** — 門檻依語言自動判斷（`src/lib/metaLength.js`：**中文 40–80 字、英文 70–155 字元**）。
   - **判定源頭**：`aeoAnalyzer.js` 的 `checkMetaDescLength` 用 `metaLengthVerdict`（分語言），**不可**再寫死 `120–160`（舊 bug：英文規則套中文站，把 84 字中文站誤判「過短」）。SEO 那支 `meta_desc` 早就用 `metaLengthVerdict`，兩邊同源。
   - **顯示**：用 `pageAudit.js` 的 `metaDescFindingDetail(text)`＝「偵測語言 + 實際字數 + 適用範圍 + 過長/過短」明確句。aeo_audits 只存 boolean → 字數靠 SEO audit 的 `meta_tags.descriptionContent` 算（`AEOAudit` 加查一次、改版 `AppHealth` 已有）。
   - 若日後要把英文收緊成 120–160＝改 `metaLength.js` 門檻本身，別只改文案。

4. **快取新鮮度提示** — 共用 `src/lib/cacheDetect.js`（`detectCacheInfo`：LiteSpeed / WP Super Cache / W3TC / WP Rocket / WP Fastest Cache 的 HTML 註記指紋）+ `src/components/CacheFreshnessNote.jsx`（深/亮兩色）。
   - 背景：用戶改完內容重掃「沒變」，其實是快取外掛供舊頁（實案：Meta 84→72 字、LiteSpeed 供 13 小時前快取）。
   - 頁面由快取供應且快取齡 ≥60 分鐘 → 顯示「剛改過請先清快取再掃」；<60 分鐘不打擾。**即時抓當下頁面**（非掃描存檔），清完快取重整提示自動消失。
   - **誠實立場**：掃描讀快取版是「對的」（AI 爬蟲拿到的也是這份），文案不得把快取講成錯誤。
   - 已接：SEO / AEO / GEO / EEAT 四個 audit 詳情頁（深色）+ 改版 `AppHealth`（亮色）。改版新做體檢頁都要沿用。

## 1. 改版 app-shell 實作規範（`/app/*`）

- 新 UI 一律放 `src/components/appshell/`，樣式 scope 在 `.appshell` 底下（見 `appshell.css`），**亮色** token 對齊 `_design/redesign-app.html`（`#f4f5f7` / `#00003e` / `#ff6e34` / `#8298ff` / SEO `#2563eb` · AEO `#7c3aed` · GEO `#059669` · EEAT `#b45309`）。
- **加法原則**：只在 `/app/*` 底下新增，**不動任何現有路由/頁面/元件**。
- **沿用現有邏輯、不重寫 analyzer**：資料抓取沿用 `DashboardV2`（website + 四大 audit）、`AIVisibilityDashboard`（aivis 聚合 `normEngineResults` 等）、audit 頁 + `src/services/*` + `src/lib/*`。已完成的 `AppOverview.jsx` 是參考範例。
- **一站一品牌（1:1）**：aivis 靠 `aivis_brands.website_id` 解析；無連結品牌顯示「設定 aivis」空狀態。
- **`websites` 是「一頁一筆」**：「我的網站」等清單要**依正規化 host 分組去重**（同網域收成一張卡），站數算 **distinct host**。
- 「**內容缺口**」窄用＝只做 aivis-info 的「AI 回答知識題時引用了誰、你在不在名單」。

## 2. Web Interface Guidelines（設計稿沒畫到的品質細節，務必補上）

**互動 & 無障礙**
- 全鍵盤可操作；每個可聚焦元素有可見 focus ring（用 `:focus-visible`，別用 `:focus`）。
- 導覽一律 `<Link>`/`<a>`（可 Cmd/中鍵開新分頁），不要用 `button`/`div` 假裝連結。
- **分頁/展開/篩選狀態放進 URL**（deep-link）：網站體檢六分頁各有真 URL（`/health/seo…` 或 `?tab=seo`），重整/分享/上一頁不失真（也是 spec 的 URL 契約）。
- icon-only 按鈕給 `aria-label`；語意優先於 ARIA（用原生 `button`/`a`/`table`）。
- **不只靠顏色表意**：pass/fail、引用矩陣「有提到/沒提到」都要配文字或圖示（不是只有橘/灰）。
- 無 dead zone：看起來能點就能點；label 與控制項共用一個大點擊區；hit target ≥ 24px（手機 44px）。
- 非同步更新（toast/驗證）用 `aria-live="polite"` 播報。

**載入 & 狀態（每種都要設計，不留死路）**
- 六態：載入（skeleton，同最終版型避免位移）、空、稀疏、密集、錯誤——每態都給「下一步/復原」。
- 按鈕載入保留原文字＋spinner；載入/處理文字用單一刪節號字元「…」結尾（不是三個句點 `...`）。

**數字 & 文案**
- 比較用數字用 `font-variant-numeric: tabular-nums`。
- 阿拉伯數字（「8 個」不是「八個」）；數字與單位間留空格（`150 次`、`30 天`）。
- 標籤具體不含糊（「重新掃描這個網站」勝過「繼續」）。
- 錯誤訊息指路 + 正面語氣：講「怎麼修」而非只講「壞了」。
- 品牌/技術詞（ChatGPT、Claude、Gemini、AARK、網域…）包 `translate="no"`，避免瀏覽器自動翻譯弄壞。
- 引號用全形「」。
- （英文專屬的 Title Case / `&` over `and` / second person 不套用於中文 UI。）

**動畫**
- 尊重 `prefers-reduced-motion`（給 reduced 版）。
- 用 CSS、只動 `transform`/`opacity`（GPU 友善）；**絕不用 `transition: all`**，只列要動的屬性。
- SVG 動畫（雷達 sweep、儀表弧）：transform 套在 `<g>` wrapper + 設 `transform-box: fill-box; transform-origin: center;`（Safari 相容）。
- 動畫可被輸入中斷；不 autoplay 到干擾。

**設計 & 對比**
- `:hover`/`:active`/`:focus` 對比要比靜止態高。
- 圖表/分數色色盲友善且配文字（四大面向色、三引擎色都要能靠文字區分）。
- 巢狀圓角：子圓角 ≤ 父圓角；陰影用同色系（navy-tinted，沿用現有）。

**效能**
- 大清單（很多站、引用矩陣很多題）用 `content-visibility: auto` 或虛擬化；圖片給明確尺寸避免 CLS。

**表單（設定 aivis / 新增網站，若有）**
- 每個控制項有 `<label>`，點 label 能 focus；`placeholder` 給範例值、以「…」結尾。
- submit 送出前保持可按（別預先 disable）；送出中才 disable + spinner；錯誤顯示在欄位旁、送出時 focus 第一個錯誤。

## 3. 程式風格

- **每段 CSS 加中文註解。**
- match 周圍程式風格；**精簡優先**（YAGNI，見 CLAUDE.md 決策梯）；刻意簡化用 `ponytail:` 註解標記（含已知上限 + 升級路徑）。
- 不過度抽象、不為小功能加新依賴；但 trust boundary 輸入驗證、錯誤處理、安全、無障礙不偷懶。

## 4. 驗證 & 交付

- 跑 `npx vite build`，看到 `modules transformed ✓` 即通過（Windows 在 rolldown **壓縮**階段崩是**已知環境問題**、非程式錯，Vercel Linux 正常）；API 檔用 `node --check`。
- **不要 commit / push，除非使用者明確要求。** 改完停下讓人 review。
- 交付前對照本檔第 2 節「Web Interface Guidelines」自我檢查一遍。
