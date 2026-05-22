# /crawl-check 落地頁 — Design 交接文件

**對象：** Claude Design（接手做視覺強化）
**現況：** 功能骨架完成、樣式平實。資料流、API call、狀態判定全部接通，**動 logic 前先看本文件**。
**目標：** 把這頁變成「點社群文進來、30 秒被震撼、想註冊」的落地頁。

---

## 1. 頁面定位

**單一痛點落地頁** — 「你的網站被 ChatGPT 看得到嗎？」

- 不是首頁的縮小版，也不是 dashboard 的入口
- 目標訪客：**從 FB / Threads / LinkedIn anti-bot 痛點貼文點進來的人**，**還沒聽過我們**
- 對標市場：日本 aeo.washinmura.jp（但他們做 AEO 8 項評分，我們這頁專做 anti-bot 主動檢測，賽道不重疊）

**訪客旅程：**
1. 點社群文連結 → 進來
2. 一眼讀懂痛點問句（< 3 秒）
3. 輸入網址 → 看動畫掃描（30 秒，**這是視覺主角**）
4. 結論揭曉 → 驚訝/緊張
5. 看到 CTA「免費註冊看完整報告」→ 註冊

---

## 2. 元件樹

```
<CrawlCheck>
├── <Header>              minimal — 只放品牌 + login/register 連結
├── <main>
│   ├── <Hero>            痛點問句（h1）+ 副標
│   ├── <UrlForm>         輸入框 + 「開始檢測」按鈕
│   ├── <TerminalLog>     4 輪 fallback 動畫（視覺主角）
│   ├── <VerdictCard>     結論卡（icon + 標題 + summary + AI 影響評估）
│   ├── <CTABlock>        註冊 CTA（風險越高文案越緊急）
│   └── <ExplanationSection>  「為什麼 Ahrefs/SEMrush 都不檢這個」教育內容
└── <Footer>              minimal — 版權 + 回首頁連結
```

各區塊在 [src/pages/CrawlCheck.jsx](../src/pages/CrawlCheck.jsx) 都有 `{/* DESIGN: ... */}` 註解，**標出每塊的視覺自由度與建議方向**。

---

## 3. 狀態樹

```
url            string     用戶輸入
scanning       boolean    是否掃描中（按鈕 disable + log 動畫進行中）
animatedRounds Array<Round>  動畫累積中的 round result（每 600ms 多一筆，建議節奏可調）
result         Object | null  最終結論 { verdict, rounds, apiResponse }
errorMsg       string | null  網址格式錯 / 連線失敗時的訊息
```

**動畫節奏：** `STEP_DELAY = 600ms` 每行 log 出現的間隔。可調，建議 400-800ms 之間。

---

## 4. 結論狀態（VERDICTS）— 共 6 種

每種對應一組 `{ level, color, icon, title, summary, aiImpact, riskLevel }`：

| key | riskLevel | icon | title | 顏色 | 觸發條件（API 旗標組合） |
|---|---|---|---|---|---|
| `clean` | 0 | ✅ | 完全開放 | `T.pass` 綠 | Round 1 直接過、無 fallback |
| `ssl` | 1 | 🔒 | SSL 憑證鏈不完整 | `T.warn` 琥珀 | sslFallback=true |
| `ua` | 2 | 🟡 | 中等嚴格 anti-bot | `T.warn` 琥珀 | uaFallback=true, proxyFallback=false |
| `proxy` | 3 | 🟠 | 嚴格 anti-bot | `T.orange` 橘 | proxyFallback=true |
| `blocked` | 4 | 🔴 | 對 AI 完全隱形 | `T.fail` 紅 | antiBotBlocked=true |
| `network_error` | -1 | ⚠️ | 連線失敗 | `T.textMid` 灰 | 其他 fetch 失敗 |

**riskLevel 用法：** CTA 文案會依風險等級切換（≥3 「想知道完整修法？」、否則「想看完整 7 大檢測項？」）

**color 用 `T.*` token（[src/styles/v2-tokens.js](../src/styles/v2-tokens.js)）：** 不要 hardcode，方便品牌色未來統一改

---

## 5. 4 輪 fallback 的 status badge

`statusBadge()` 跟 `statusColor()` 對應 5 種 status：

| status | label | color | 何時出現 |
|---|---|---|---|
| `pass` | ✓ 通過 | `T.pass` | 該輪 HTTP 200 OK |
| `warn` | ⚠ 警告通過 | `T.warn` | 該輪用了 SSL 放寬才通過 |
| `fail` | ✗ 被擋 | `T.fail` | 該輪 HTTP 403/503/429 |
| `skip` | — 略過 | `T.textLow` | 前面輪已通過、不需嘗試 |
| `error` | ⚠ 錯誤 | `T.fail` | 連線層失敗（DNS / timeout 等） |

**標籤文案 + 顏色 Design 都可改**，但 **status key 字串不變**（外部程式 reference）。

---

## 6. 真實資料範例 — 用來 mockup 時可貼進去測

### 6.1 verdict = 'clean'（aark.com.tw 之類正常網站）
```json
{
  "verdict": "clean",
  "rounds": [
    { "id": "r1", "ua": "Googlebot", "label": "Googlebot UA", "hint": "Google 搜尋引擎爬蟲身份", "status": "pass", "detail": "HTTP 200 通過" },
    { "id": "r2", "ua": "Chrome", "label": "Chrome + 完整指紋", "hint": "模擬真人瀏覽器（含 Sec-Ch-Ua 指紋頭）", "status": "skip", "detail": "前輪已通過、不需嘗試" },
    { "id": "r3", "ua": "Bingbot", "label": "Bingbot UA", "hint": "Bing 搜尋引擎爬蟲身份", "status": "skip", "detail": "前輪已通過、不需嘗試" },
    { "id": "r4", "ua": "AllOrigins", "label": "AllOrigins proxy", "hint": "第三方 IP 出口繞 Cloudflare", "status": "skip", "detail": "前輪已通過、不需嘗試" }
  ]
}
```

### 6.2 verdict = 'ua'（iseeu.tw — 真實有測過、Cloudflare 中度嚴格）
```json
{
  "verdict": "ua",
  "rounds": [
    { "id": "r1", "status": "fail", "detail": "HTTP 403 被擋" },
    { "id": "r2", "status": "pass", "detail": "瀏覽器指紋身份通過" },
    { "id": "r3", "status": "skip", "detail": "前輪已通過、不需嘗試" },
    { "id": "r4", "status": "skip", "detail": "前輪已通過、不需嘗試" }
  ]
}
```

### 6.3 verdict = 'blocked'（極嚴 anti-bot）
```json
{
  "verdict": "blocked",
  "rounds": [
    { "id": "r1", "status": "fail", "detail": "HTTP 403 被擋" },
    { "id": "r2", "status": "fail", "detail": "HTTP 403 被擋" },
    { "id": "r3", "status": "fail", "detail": "HTTP 403 被擋" },
    { "id": "r4", "status": "fail", "detail": "HTTP 403 被擋" }
  ]
}
```

---

## 7. 視覺自由發揮的部分 ✅

| 元件 | 自由發揮空間 |
|---|---|
| **整頁背景** | 可加全頁漸層、雷達 SVG 動畫、scanline、noise overlay、grain texture 等 |
| **Hero** | h1 字體 / 動畫進場 / 配 illustration / 加副標的 chip / 加 social proof |
| **UrlForm** | input glow 動畫、按鈕 gradient、submitting 動畫 |
| **TerminalLog**（**視覺主角**） | <li> monospace 字、深底 + 邊框、每行 slide-in fade-in、status icon 自訂 SVG、加 typing effect、scanline overlay、玻璃擬態、glitch、cursor blink |
| **VerdictCard** | 大 icon 加動畫進場、進度條 / 風險量計、verdict.color 漸層、可加 sparkles 或 emit particle |
| **CTABlock** | 按鈕加 hover glow、加緊急感 chip（如「3 個免費網站額度」）、加 social proof tagline |
| **ExplanationSection** | 折疊 accordion、左右並排 illustration、AI bot logo row（ChatGPT/Claude/Perplexity） |

---

## 8. 視覺不要動的部分 ⛔

**邏輯 / 資料 / 路由相關，動到會壞：**

- `deriveRoundStates()` 反推邏輯 — 不要碰
- `handleScan()` 的 API call + state 更新 — 不要碰
- VERDICTS 物件的 **key 字串**（clean / ssl / ua / proxy / blocked / network_error）— 文案 / 顏色可改，key 不變
- ROUNDS 陣列的 **id 字串**（r1 / r2 / r3 / r4）— 可改 label / hint，id 不變
- status key 字串（pass / warn / fail / skip / error）— 可改 label / 顏色，key 不變
- `normalizeUrl` 那行 — 不要動
- 路由 `/crawl-check` — 不要改
- `riskLevel` 數字 — 不要改（決定 CTA 文案分支）

---

## 9. 動畫時序建議

```
0s         用戶按「開始檢測」
0s-0.6s    第 1 輪 log 浮現（emoji icon + label + status + detail）
0.6s-1.2s  第 2 輪
1.2s-1.8s  第 3 輪
1.8s-2.4s  第 4 輪
2.4s-3.0s  結論卡浮現（建議 fade-in + slide-up + icon scale animation）
3.0s+      CTA 卡浮現（建議晚一拍出現增加閱讀引導）
```

**STEP_DELAY 在 [CrawlCheck.jsx](../src/pages/CrawlCheck.jsx) 第 153 行**，可調 400-1000ms。

---

## 10. 行動裝置考量

- 整頁 max-width 720px（桌機看起來不會太寬，手機本來就要塞）
- UrlForm 在 mobile 是 column（input 上、按鈕下）— 目前 flex-wrap 已處理
- TerminalLog 在 mobile 字會擠，建議字級可以調小但保持 monospace
- 結論卡的大 icon 在 mobile 可從 36px 縮到 28px

---

## 11. 完成後請更新

- 把 `{/* DESIGN: ... */}` 註解刪掉（已完成的部分）
- 在 [WORKLOG.md](../WORKLOG.md) 頂端加一筆紀錄你做了什麼
- 如果有改動 ROUNDS / VERDICTS 結構，在這份文件補註

有疑問可在 PR 留言、或回主要開發者（Claude Code）澄清。

---

**完成標準：** 從手機跟桌機分別開 `/crawl-check`，輸入 iseeu.tw（會觸發 verdict='ua'），整個動畫 + 結論 + CTA 流暢、有 wow factor、想點註冊。
