---
target: /home-v2 首頁（HomeLight）
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 4
timestamp: 2026-08-18T07-46-15Z
slug: src-pages-homelight-jsx
---
# 設計健檢：/home-v2（HomeLight 亮色鴿哥版）

Method: A=獨立子代理（設計審查）／B=父層 inline 補跑（子代理撞 session 限制中止）
Surface mode: Persuade

## Design Health Score

| # | Heuristic | 分數 | Key issue |
|---|---|---|---|
| 1 | 系統狀態可見性 | 2 | 等待 30-60 秒只有一行靜態灰字；完成瞬間無捲動/無動畫/螢幕閱讀器靜默 |
| 2 | 貼近真實世界 | 3 | h1 是人話典範；但 AEO/GEO/E-E-A-T 縮寫對 P1 品牌主無解釋 |
| 3 | 使用者控制與自由 | 2 | 掃描中無法取消；「再掃一個」清掉全部；註冊後回不來 |
| 4 | 一致性與標準 | 3 | 頁內 token 紀律極佳；但每個出口（logo/register/login/footer）都掉回暗色舊版 |
| 5 | 錯誤預防 | 3 | normalizeUrl 補 protocol、ref 防重入都好；但 parse 失敗 fallback 回 truthy 垃圾繞過驗證 |
| 6 | 辨識而非回憶 | 2 | 分數無量尺無判語；柱色編「類別」不編「優劣」；失敗顯示「—」零解釋 |
| 7 | 彈性與效率 | n/a | 單一任務說服頁，加速器只會添噪音 |
| 8 | 美學與極簡 | 4 | 單一橘強調、區塊克制、留白層級真實有效——本頁最強項 |
| 9 | 錯誤復原 | 3 | 錯誤文案誠實給路＋role=alert；但內插原始英文技術訊息會破壞它 |
| 10 | 說明與文件 | n/a | 單任務頁；FAQ 刻意留在暗色版、頁尾有連結 |
| **總分** | | **22/32**（68.8%）| **Acceptable，逼近 Good** |

## Design Specificity 判決

**高度為此產品而作。** 雷達掃描弧 wordmark、鴿哥＋三圈漣漪、四訊號分數卡、「這次只掃這一頁，不代表全站」——隱喻從導覽貫穿到互動核心，換產品得整頁重做。唯一偏通用的是底部三欄條，但文案仍是產品限定。

**機械偵測**：detect.mjs 掃 HomeLight.jsx 與 homelight.css 皆 0 findings（exit 0）。已用對照組驗證非靜默跳過——同一偵測器掃 src/components/v2 吐出 4 類 findings（AgencyWaitlistModal 的 purple gradient ×2、IssueBoard 的 side-tab 左彩條、MetricSignatures 的 transition:width）。故本頁乾淨是真結果。

**瀏覽器視覺化**：本環境無瀏覽器自動化，無 overlay，fallback 為原始碼審查。

## What's Working

1. **文案是品牌承諾的介面化，不是口號**——在用戶最想放大解讀分數的瞬間主動降溫。
2. **視覺隱喻有系統性貫穿**——一個隱喻三個尺度（wordmark／hero 舞台／tagline 敘事）。
3. **防禦性工程密度高**——reduced-motion 全關、CSS scope 精準反制全域 !important、ref 防重入、aria-live/role=alert、noindex 卸載清理。

## Priority Issues

### [P1] 掃描完成是隱形事件
結果卡無聲出現在 hero 下方：無 scrollIntoView、無焦點管理、無揭示動畫，status 清成空字串使螢幕閱讀器靜默。手機必在視窗外。
Fix：完成時 scrollIntoView + 焦點移到卡片標題（tabIndex=-1）、status 改「✓ 掃描完成」、卡片淡入上移。
Command: $impeccable animate

### [P1] 30-60 秒等待是死畫面
唯一回饋是一行灰字，而現成的雷達舞台跟掃描狀態零連動。四個分析器在 Promise.all 裡本來就各自 resolve，素材都在卻沒用。
Fix：等待顯示四張骨架卡、每個分析器完成翻開一張；掃描中 hl-radar 漣漪加速/變橘。
Command: $impeccable animate

### [P1] 分數沒有意義層
純數字無量尺（/100？）、無判語、柱色編類別不編優劣（低分 GEO 仍是安心綠）、失敗顯示「—」。對「拿報告轉賣客戶」的 P0 代理商，這卡連轉述給客戶的一句話都給不出。
Fix：加 /100 分母＋一行判語；「—」加解釋；數字色依分數帶。
Command: $impeccable clarify

### [P1] 弱文字 token 對比 2.53:1（跨系統，比預估更差）
--ink-3 #9a9aad 在暖白 #f4f5f7 上僅 2.53:1（白卡上 2.76:1），連大字 AA 的 3.0 都不到。用於 input placeholder、信任訊號列、鴿哥 tagline、結果卡說明、頁尾共 8 處。此 token 來自共用 appshell.css，該檔另有 66 處引用——**這不是本頁問題，是整個新版設計系統的問題**，且不在已拍板的「亮橘 CTA」豁免範圍。
Fix：--ink-3 改 #6e6e82（暖白 4.57:1／白卡 4.98:1，同藍調色相、觀感幾乎不變）。
Command: $impeccable audit

### [P2] 註冊交接摔掉全部脈絡
URL 與四分數無持久化，/register 又是暗色舊版。用戶在意圖最高點被要求換視覺語言＋重新記憶＋重掃。
Fix：anon 結果寫 sessionStorage、註冊連結帶 ?url=、註冊後自動重掃直進 overview。
Command: $impeccable harden

### [P2] normalizeUrl fallback 繞過驗證防線
src/lib/url.js:65 catch 回傳 s.toLowerCase()（truthy），含空格等 parse 失敗輸入通過 !cleanUrl 檢查直奔 fetch，用戶收到嚇人網路錯誤而非友善提示。已直接讀碼確認。
Fix：catch 改回傳 ''。
Command: $impeccable harden

## Persona 紅旗

**Jordan（第一次用的小白）**：AEO/GEO/E-E-A-T 三縮寫零解釋、四數字不知滿分；「免費註冊看完整診斷」對他變成「註冊才能看懂」。輸入含空格會走 fallback 垃圾路徑收到包裝過的網路錯誤，以為產品壞掉。等待 30 秒只有小灰字，很可能滑走後錯過結果。

**Riley（找碴壓力測試者）**：連點被 ref 擋住、reduced-motion 全關——這兩處防得漂亮抓不到把柄。但：掃擋爬蟲的站時 analyzeSEO 產生的關鍵訊息（「你的網站擋下我們的爬蟲，AI 引擎也會被擋」＝最強銷售論點）被匿名卡丟棄，只剩 0 或「—」，可截圖發文嘲笑。點 logo/頁尾任一連結掉進暗色舊版。掃描中無法取消。對比檢查器會一起打 --ink-3 那批小字。

**Casey（單手滑手機）**：input 是 type="text"，缺 inputMode="url"/autoCapitalize="none"/autoCorrect="off"/spellCheck=false——iOS 鍵盤自動首字大寫＋自動改字，且無「.」快捷鍵。切去 LINE 再回來：畫面停在 hero、結果在視窗外、status 已清空、按鈕復原，合理結論是「剛剛沒按到」→ 再按一次重複消耗掃描。鴿哥 tagline nowrap 膠囊在 320px 貼邊極限。

## Minor Observations

- kicker 綠色 pulse 點暗示「即時連線中」，但此刻沒有任何 live 連線——與「不誇大」有微妙張力。
- hl-lede max-width:33ch 對中文全形字實際偏窄。
- 錯誤僅靠紅色無 icon（色盲少一線索）。
- 「再掃一個網址」同時清空 input；保留上一個 URL 讓用戶改字尾更順。
- 桌機 hero gap:20px 在 900-1000px 寬會略擠。
- 匿名掃描次數已記錄（bumpAnonScanCount）但 UI 無反映。

## Questions to Consider

1. **如果「等待」本身就是 demo 呢？** 逐一翻牌＋即時吐出發現（「找到 schema ✓」「FAQ 結構缺失 ✗」），30 秒死等變成 30 秒產品能力展演——順便正面回擊「自己問 AI 就好」：ChatGPT 給一段話，雷達給一張逐項清單。
2. **為什麼要用戶先付出才能看到產出長相？** Hero 放一份真實台灣品牌的快取掃描結果，訪客打字前就看到報告顆粒度。
3. **這頁在說服品牌主，但掏錢的是代理商——結果卡上有給代理商的氣味嗎？** 現在的漏斗對 P1 完整、對 P0 是斷的。
