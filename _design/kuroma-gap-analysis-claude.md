# Kuroma 對標分析 — Claude 獨立版（供與 Codex 版對照）

> 2026-08-13。方法：抓 kuroma.ai 官網實查功能（非憑印象），逐項對照 [feature-inventory.md](./feature-inventory.md)，依 (a)已有 (b)部分有 (c)沒有該做 (d)沒有不該做 標記。
> ⚠️ 本檔是「二層驗證」的第一層——**Codex 分析回來前不要拿本檔餵他**，兩份獨立產出才有對照價值。

## Kuroma 實查功能清單（來源：kuroma.ai，2026-08-13）

7 引擎掃描（ChatGPT/Perplexity/Gemini/Claude/Grok/Google AI Overviews/AI Mode）・每掃最多 8 個「合成買家 persona」（不同決策風格與意圖）・visibility/sentiment/mention rate/rank 四指標・**Grounding 事實查核層**（AI 說法 vs 網路來源交叉比對＝幻覺偵測 Fact Watch）・**競品 mention share＋citation influence（kingmaker）圖**・內容缺口（對手贏你的題）・142 市場/51 產業 benchmark・AI Readiness 0–100（19 因子/4 類）・免費層 1 品牌**雙週自動監測**・免註冊首掃・可分享 scorecard・定價 $39/79/249/699 月（2/5/10/20 品牌）。

## 逐項判定

| Kuroma 功能 | 判定 | 說明 |
|---|---|---|
| 7 引擎 | **(b)** | 我們刻意 3 引擎（7/17 定案：成本＋誠實）。Grok/Perplexity 維持不上；**Google AI Overviews 可評估**（台灣搜尋主流、體驗≠Gemini）→ P3 |
| 合成買家 persona 題庫 | **(c)** | 我們四層題庫是統計效度設計、沒有「買家意圖」維度。借鏡：generate-prompts 加 persona 軸（價格敏感/在地/比較型/急件），純 prompt 層改動、不動引擎 → **P1** |
| sentiment（AI 怎麼講你） | **(c)** | 可對**既存** raw_response 離線標註（正/中/負），零額外掃描成本 → P2 |
| rank/位置 | (b) | aivis_mentions 有 position，呈現未做滿 |
| **Grounding／幻覺偵測** | **(c)** | 高價值＋合我們「監測＋修」策略：比對 raw_response 與品牌事實（org_schema_data/網站 meta），抓「AI 講錯你」（地址錯/倒閉謠言）→ 接修復側（修正來源內容）。台灣中小企業真痛點 → **P1** |
| **競品 mention share／citation influence** | **(c)** | 我們最大弱項（弱項1）。關鍵洞察：**Kuroma 是從同一批 AI 回答裡萃取「還推薦了誰」——零額外 API 成本**。我們的 responses 已存完整回答，補一支結構化萃取就有競品層。誠實線：標示為「AI 回答中出現的其他品牌」（實際文字萃取、非猜測）→ **P1（最高 ROI）** |
| 內容缺口（對手贏你的題） | (b) | AppGap 已有「引用了誰、你不在」；差「品牌提及版缺口」（上一項做完自然有） |
| 142 市場/51 產業 benchmark | **(d)** | 要跨客戶資料規模；台灣優先策略不對齊。等量夠再說 |
| AI Readiness 19 因子 | **(a)** | 我們 4+1 面向共 48+15 項、更深。差的是「單一綜合分＋可分享」呈現（下一項） |
| 可分享 scorecard | **(c)** | 成長迴路（代理商拿去給客戶看＝自帶傳播）。我們有 website-summary 但非圖卡式 → P2 |
| 免註冊首掃 | **(a)** | value-first 已有 |
| **免費層雙週自動監測** | **(c)⚠️** | 撞既有決策（weekly scan 延後、卡 Vercel 超時）。但 Kuroma 把自動監測放**免費層**當留存鉤子、而我們全產品零自動化＝趨勢線永遠難成形（喚回實驗也證實回訪要靠 email 推）。建議把證據擺上桌**重議**：小規模「免費 1 站雙週自動掃」走現有 cron＋job queue 可繞超時 → 用戶拍板 |
| Scan→Verify→Benchmark→Improve 流程 | (a)/(b) | Improve 我們更強（修復碼/平台指南/llms.txt 代管 vs 他們只給 fix list）——**這是我們的刀，該在行銷面講大聲** |

## 建議修改名單（P1/P2/P3 各 ≤3）

**P1（高 ROI、零或低邊際成本、補最大弱項）**
1. **競品提及萃取**：從既有 aivis 回答結構化抽「AI 推薦了哪些品牌」→ mention share ＋「同類領先者」卡接真資料（現在是 placeholder）。零額外 API 成本。
2. **AI 亂講偵測（Fact Watch 式）**：raw_response vs 品牌事實比對，抓錯誤陳述＋給修復建議。差異化＋接修復側。
3. **persona 化題庫**：題庫生成加買家意圖維度，報告說服力大增，純 prompt 層。

**P2**
1. sentiment 離線標註（吃既存回應）
2. 分享圖卡成績單（代理商傳播迴路)
3. 重議「免費 1 站雙週自動掃」（證據：Kuroma 免費層標配；技術路徑：既有 cron＋queue）

**P3**
1. Google AI Overviews 引擎評估（成本/TOS 先查）
2. 市場/產業 benchmark（等跨客戶資料規模）

## 我們對 Kuroma 的既有優勢（分析不能只看缺）

修復側深度（給 code、平台指南、代管 llms.txt、外掛路線圖 vs 他們 fix list）・台灣在地校準（中文門檻/Rank Math/LiteSpeed/LINE）・技術檢測深度（63 項 vs 19 因子）・在地金流 NT$/NewebPay・內容品質 15 項＋批次掃描。定價帶接近（Pro NT$1,490 ≈ $46 vs Kuroma $39–79）。
