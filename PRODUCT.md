# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **P0 主要客戶：台灣中小型數位行銷代理商**（5–30 人、有 SEO 服務線）。情境：要向客戶證明「SEO 之外還有 AI 這一仗」、需要多客戶管理與可轉賣的報告。他們的工作：拿檢測報告去說服客戶簽持續性服務。
- **P1 次要客戶：品牌主／電商老闆**。接觸過 SEO、想被 AI 推薦，但不懂程式碼；需要「照著步驟修」的手把手指引。
- 已驗證的異議（2026-08 第一筆冷市場回饋）：代理商會說「自己問 AI 就好」——產品必須展示趨勢線／多引擎統計等「自己問問不出來」的價值。

## Product Purpose

方舟 AI 雷達：台灣第一個 LLMO（AI 搜尋優化）監測平台。把「被 AI 推薦」拆成五個可量化訊號層——SEO、AEO、GEO、E-E-A-T、aivis（跨 LLM 引用率追蹤）——各自打分、合成總分，並給出可直接套用的修復步驟。成功＝用戶從一次性檢測轉成持續訂閱監測（AI 引用率天天在變，這是訂閱的理由）。

## Positioning

「Ahrefs / SEMrush 教代理商贏 Google，方舟 AI 雷達教代理商贏 ChatGPT。」鄰品抄不走的機制：(1) 實際拿用戶品牌去問 ChatGPT／Claude／Gemini 三引擎並統計提及率（不是猜、不是爬 SERP）；(2) 為台灣網站校準——繁中原生、懂 Rank Math、中文 meta 長度另計、台灣主機生態（LiteSpeed／fail2ban）容錯；(3) 不只診斷還給平台別修復碼（WordPress／Shopify／Wix／自架）。

## Operating Context

- 用戶入口：首頁輸入網址 → 未登入 value-first 快掃（免註冊先看分數）→ 註冊後完整診斷 → `/app` 工作區（總覽／AI 曝光監測／網站體檢／內容機會）。
- 代理商工作流：多站追蹤（Pro 15 站）→ PDF 報告轉賣客戶 → 週報 email。
- aivis 掃描消耗額度（Pro 150 次/月），四層題庫（core/rotating/brand/info）保統計效度；每週自動掃為 Pro/試用限定 opt-in。
- 金流：Phase 1 NewebPay（台灣、NT$、統一發票），Phase 2 Stripe Atlas（國際）。

## Capabilities and Constraints

- 三引擎限定：**只講 ChatGPT／Claude／Gemini**，不得宣稱 Perplexity／Grok（爬蟲/教育類 PerplexityBot 字樣可保留）。
- 檢測誠實邊界：單頁+站台層掃描，**不可暗示全站爬蟲**；aivis 頭條曝光率只用 core 題，brand/info 另計不灌分。
- 法律紅線（公平交易法）：不捏造數據/分數/統計/見證；不寫「保證上 AI 推薦」；不做「低品質/內容農場」負面標籤。
- 技術：React 19 + Vite 8 + Tailwind v4 + Supabase + Vercel Hobby（12 serverless functions 上限、只能 1 個 cron）。
- 現況（2026-08）：新版亮色 `/app` 已硬切為預設；首頁亮色鴿哥版在 `/home-v2` 並行驗收、正式 `/` 仍為暗色版；全站約 994 處深色假設 class 未清，亮色化須用 scoped 隔離手法。

## Brand Commitments

- 三層架構：產品「方舟 AI 雷達」／品牌母體「AARK」（念「阿克」）／營運公司「優勢方舟數位行銷」（發票、法律）。
- **鴿哥＝正式吉祥物**（2026-08-18 確認）：放出去偵察的信鴿、替你探 AI 有沒有看見你。首頁、空狀態、404、載入畫面、行銷素材都可用，之後的設計工作預設帶上它。資產：`public/img/pigeon-hero.png`。
- **品牌聲音＝誠實直白、不誇大、台灣在地人話**（2026-08-18 確認為正式承諾）：自我揭露式誠實（例「這次只掃這一頁，不代表全站」）是刻意的差異化，也呼應公平交易法紅線。所有文案照此基調。
- 新版視覺系統（亮色）：暖白 `#f4f5f7`／深藍墨 `#00003e`／橘 `#ff6e34` 唯一強調／periwinkle `#8298ff` 輔助；語意色 SEO 藍/AEO 紫/GEO 綠/E-E-A-T 琥珀/內容品質粉不隨主題變。
- CSS 一律加中文註解；後臺功能說明用中文選單名。

## Evidence on Hand

- 真實掃描資料：audit 表、anon_scan_events（未登入快掃日誌）、aivis_responses（三引擎原文＋來源）。公開 KPI 走 `/api/public-stats` 動態聚合（2026-05-11 起不用假數字）。
- **沒有的東西（不得捏造）**：客戶見證、案例研究、媒體報導、客戶 logo 牆。未來有真實見證才能上。
- 設計資產：鴿哥 PNG、雷達弧 wordmark（inline SVG）、高保真設計稿（首頁+儀表板）。

## Product Principles

1. **Value-first，不設登入牆**：先給分數再談註冊；鎖的是藥方不是診斷。
2. **誠實是機制不是口號**：檢測範圍、統計方法、額度消耗全部明示；寧可少講不誇大。
3. **不只診斷，給修法**：每個沒過的項目都要接「怎麼修」，並依平台給對應步驟。
4. **持續監測勝過一次體檢**：設計與文案都導向「AI 引用率天天在變」的訂閱心智。
5. **工具不把用戶擋在錯誤前面**：錯誤要可見（error_logs）、可行動（提示下一步），防呆優於報錯。

## Accessibility & Inclusion

現階段品牌視覺優先（亮橘 CTA 對比 2.79:1 未達 WCAG AA，2026-08-18 確認為**暫時狀態、之後要合規**）：新設計盡量兩全（結構、focus 狀態、reduced-motion、語意標記照做），品牌色與對比衝突時先報給用戶選，不擅自定案。未來接政府案／大客戶需可切換合規模式。
