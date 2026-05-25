# /schema-check 落地頁 — Design 交接文件

**對象：** Claude Design（接手做視覺強化）
**現況：** 功能骨架完成、樣式平實。資料流、解析邏輯、結果分類全部接通，**動 logic 前先看本文件**。
**目標：** 把這頁變成「點社群文進來、30 秒看到 schema 全圖、想註冊看修法」的落地頁。

姊妹頁：[/crawl-check](../src/pages/CrawlCheck.jsx)（anti-bot 痛點）與 [/schema-check](../src/pages/SchemaCheck.jsx)（本頁，schema 痛點）共用「免註冊單一輸入工具」格局，視覺風格建議呼應但不必一模一樣。

---

## 1. 頁面定位

**單一痛點落地頁** — 「你的網站有哪些 Schema？AI 看得到嗎？」

- 目標訪客：
  - **Builder 用戶**（Wix / Webflow / Hostinger Builder）不知道自己有沒有自動產生 schema
  - **SEO 顧問**要快速 audit 客戶網站
  - **開發者**驗證自己加的 JSON-LD 對不對
  - **AEO 學習者**想知道 schema 是什麼、怎麼做
- 對標市場：
  - Google Rich Results Test（太陽春、只看 Google 認的 type、純英文）
  - schema.org Validator（太技術、無修法引導）
  - 我們的差異化：**中文 + 視覺友善 + 偵測「視覺有但缺 schema」+ 直接連 Pro 修法 code**

---

## 2. 元件樹

```
<SchemaCheck>
├── <Header>              minimal — 品牌 + login/register
├── <main>
│   ├── <Hero>            標題 + 副標
│   ├── <UrlForm>         輸入 + 「開始檢測」按鈕
│   ├── <ScanLogs>        動畫式掃描 log（5 行，每 600ms 出一行）
│   ├── <VerdictCard>     結論卡（總覽：N 種 schema、X 個 invalid、視覺 FAQ 警告）
│   ├── <FoundSchemasList>  ✅ 偵測到的 schema 列表
│   ├── <MissingEssentialsList>  ❌ 強烈建議補上的基本款
│   ├── <CTABlock>        註冊 CTA（看完整修法）
│   └── <ExplanationSection>  「為什麼 Schema 對 AI 重要」教育
└── <Footer>              minimal — 含 /crawl-check cross-link
```

---

## 3. 狀態樹

```
url            string     用戶輸入（支援 ?url=xxx query 預填）
scanning       boolean    掃描中（按鈕 disable + log 動畫）
logs           string[]   動畫累積中的 log 行
result         Object | null  最終結論 { foundTypeDetail, missingEssentials, hasVisualFaq, totalScripts, invalidCount, cleanUrl }
errorMsg       string | null  錯誤訊息（網址錯、fetch 失敗等）
```

---

## 4. result 物件 schema

```ts
{
  foundTypeDetail: Array<{
    name: string,          // schema type name, e.g. "Organization"
    meta: { label, purpose, priority } | null,  // null 表示偵測到但不在 KEY_SCHEMA_TYPES 清單
    sources: string[],     // ['script #1', 'script #2 @graph[0]'] 等
  }>,
  missingEssentials: Array<{
    name: string,          // 強烈建議補的 type name
    meta: { label, purpose, priority: 'essential' },
  }>,
  hasVisualFaq: boolean,   // 視覺有 FAQ 但缺 FAQPage/QAPage schema
  totalScripts: number,    // 偵測到幾個 <script type="application/ld+json">
  invalidCount: number,    // 其中幾個 JSON parse 失敗
  cleanUrl: string,        // normalizeUrl 後的 URL
}
```

---

## 5. KEY_SCHEMA_TYPES 清單（17 個常見且對 AI/SEO 有意義的 type）

來源：schema.org + Google Rich Results 支援清單，過濾出「對 AI 引用 / SEO 顯示」有實際影響的：

| Type | 優先級 | 用途 |
|---|---|---|
| Organization | essential | 告訴 AI「我們是誰」 |
| WebSite | essential | 站名 / sitelink searchbox |
| WebPage | recommended | 單一頁面元資料 |
| Article / BlogPosting | recommended | 文章內容 |
| FAQPage | recommended | AI 直接拆 Q&A 引用 |
| BreadcrumbList | recommended | 搜尋結果路徑顯示 |
| Product | context | 電商必備（價格/評分/庫存）|
| Service | context | 服務型網站 |
| LocalBusiness | context | 在地商家面板 |
| Person | context | E-E-A-T 作者/創辦人 |
| Review | context | 個別評論 |
| AggregateRating | context | 星級評分 |
| VideoObject | context | 影片摘要 |
| Event | context | 活動/講座 |
| HowTo | context | 教學步驟 |
| Recipe | context | 食譜 |
| Course | context | 線上課程 |
| QAPage | context | 知識庫類 |

優先級三層的意義：
- **essential** — 缺了就會在「缺漏的基本款」區提醒（目前只 Organization + WebSite）
- **recommended** — 不主動提醒，但偵測到會在「偵測到的 schema」區強調 purpose
- **context** — 依網站類型而定（電商才需要 Product），不主動推

---

## 6. 視覺自由發揮的部分 ✅

| 元件 | 自由發揮空間 |
|---|---|
| **整頁背景** | 全頁漸層、雷達/節點動畫、scanline、noise overlay、grain texture |
| **Hero** | h1 字體 / 動畫進場 / 配 illustration（schema icons cluster？）/ social proof |
| **UrlForm** | input glow 動畫、按鈕 gradient、submitting 動畫 |
| **ScanLogs**（動畫主角） | monospace 字、深底框、每行 typing effect、scanline overlay、cursor blink、可加結束「scan complete」flourish |
| **VerdictCard** | N 種 schema 大數字 + 進度條 / 圓形圖、視覺 FAQ 警告可用浮現動畫 |
| **FoundSchemasList** | schema type chip 用 icon、purpose 用 tooltip、sources 用展開 details |
| **MissingEssentialsList** | 紅色警示色、加 "click to learn" 連結 |
| **CTABlock** | 按鈕加 hover glow、加緊急感 chip、可加 social proof tagline |
| **ExplanationSection** | 折疊 accordion、illustration（AI 引擎 logo row）|

---

## 7. 視覺不要動的部分 ⛔

- `parseAllSchemas()` 解析邏輯 — 不要碰
- `detectVisualFaq()` heuristic — 不要碰
- `handleScan()` 的 API call + state 更新 — 不要碰
- `KEY_SCHEMA_TYPES` 物件結構（key, label, purpose, priority 三個欄位）— 文案可改、結構不變
- 路由 `/schema-check` — 不要改
- ?url= query param 預填邏輯 — 不要動

---

## 8. 真實資料範例（mockup 用）

### 8.1 一個 schema 都沒有（很差的 case）
```json
{
  "foundTypeDetail": [],
  "missingEssentials": [
    { "name": "Organization", "meta": { "label": "Organization (組織)", "purpose": "...", "priority": "essential" } },
    { "name": "WebSite", "meta": { "label": "WebSite (網站)", "purpose": "...", "priority": "essential" } }
  ],
  "hasVisualFaq": true,
  "totalScripts": 0,
  "invalidCount": 0
}
```

### 8.2 中等網站（有基本款，缺 FAQ）
```json
{
  "foundTypeDetail": [
    { "name": "Organization", "meta": {...}, "sources": ["script #1"] },
    { "name": "WebSite", "meta": {...}, "sources": ["script #1"] }
  ],
  "missingEssentials": [],
  "hasVisualFaq": true,
  "totalScripts": 1,
  "invalidCount": 0
}
```

### 8.3 完整網站（有 @graph 巢狀，多個 type）
```json
{
  "foundTypeDetail": [
    { "name": "Organization", "sources": ["script #1 @graph[0]"] },
    { "name": "WebSite", "sources": ["script #1 @graph[1]"] },
    { "name": "BreadcrumbList", "sources": ["script #2"] },
    { "name": "FAQPage", "sources": ["script #3"] }
  ],
  "missingEssentials": [],
  "hasVisualFaq": true,
  "totalScripts": 3,
  "invalidCount": 0
}
```

---

## 9. 動畫時序建議

```
0s         用戶按「開始檢測」
0s-3s      5 條 log 行依序浮現（每 600ms 一條）
3.2s       result reveal — VerdictCard + lists 依序 fade-in
4s+        CTA + 教育區進場
```

`logs` 是動畫式 push（每 600ms append 一條），`result` 在動畫跑完後一次 reveal。

---

## 10. 完成後請更新

- 把 `{/* DESIGN: ... */}` 註解刪掉（已完成的部分）
- 在 [WORKLOG.md](../WORKLOG.md) 頂端加紀錄
- 如果有改 KEY_SCHEMA_TYPES 結構，在這份文件補註

---

**完成標準：** 從手機跟桌機分別開 `/schema-check`，輸入幾個案例網站（如 hcdn 案例 soileng.com.tw / 全功能網站 aark.com.tw / 純 HTML 範例），整個動畫 + 結果 + CTA 流暢、有 wow factor、想點註冊。
