# LLMO 6 週執行清單

> **方舟 AI 雷達 · 代理商交付物**
> 把「想被 AI 推薦」這件抽象的事、拆成 6 週可以照做的具體動作。

---

## 為什麼是 6 週？

LLM 對網站的重新評估有滯後性：
- **搜尋型 AI（Perplexity / ChatGPT Search / Gemini）**：2-4 週看到效果
- **模型型 AI（純 ChatGPT 對話）**：2-8 週甚至更久（要等下一輪訓練）

6 週剛好涵蓋第一輪 AI 重新檢索的完整週期、是評估「方向對不對」的最短可信窗口。

> ⚠️ **常見誤會先排除**：跟 AI 對話「教它認識你品牌」、只會影響你自己帳號的對話、**對其他用戶 0 影響**。AI 不是學生、是檢索員 — 它每次答題重新去網路撿資料。要被別人問到時被推薦、必須改變網路上關於你的「證據總量」。

---

## Week 1：健檢 + 紅燈快修

**目標：把 Aark 5 訊號層所有「紅燈項目」清掉、拿到一個乾淨的起跑點。**

| 任務 | 預估時間 | 怎麼做 |
|---|---|---|
| 跑一次 Aark 完整檢測 | 5 分鐘 | Dashboard 點「🔄 重新檢測」 |
| 修 SEO 紅燈（通常是 Meta / H1 / Alt） | 1-3 小時 | 跟著「修復指南」逐項做 |
| 修 robots.txt（不要鎖 GPTBot / ClaudeBot / Perplexity） | 10 分鐘 | 直接在 `/robots.txt` 加 allow 規則 |
| 修 sitemap.xml（確保所有商品頁/內容頁都在裡面） | 30 分鐘 | WordPress 的話 Rank Math / Yoast 自動產 |
| 修「我已修好」按鈕記錄每筆修復 | 隨手 | 修完點一下、可以累積 +5 XP 看趨勢 |

**Week 1 驗收：** Aark 綜合分數 ≥ 70、所有紅燈轉黃/綠。

---

## Week 2：AI 爬蟲開放 + llms.txt

**目標：明確告訴所有 AI「你可以來抓我、這是我的主題地圖」。**

90% 的台灣中小企業網站在這步漏掉一條 AI 接觸點、完全沒理由。

### 任務 2.1：robots.txt 開放 AI 爬蟲

把這段加到 `robots.txt`（取代或追加在現有規則後）：

```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: cohere-ai
Allow: /
```

**注意：** 如果你**只想被 AI 搜尋引用但不想被當訓練資料**、可以擇優開放 `PerplexityBot` 但擋 `GPTBot`。一般中小企業建議全開、因為這時段曝光比擔心被「免費訓練」重要。

### 任務 2.2：建 llms.txt

在根目錄放一個 `/llms.txt`（純文字、不是 HTML）：

```
# {公司名稱}

> {一句話描述你在做什麼、賣什麼、給誰}

## 核心產品/服務

- [產品 A 名稱]({URL}) — 一句話描述
- [產品 B 名稱]({URL}) — 一句話描述

## 重要內容

- [服務據點]({URL})
- [常見問題]({URL})
- [關於我們]({URL})

## 聯絡方式

- Email: ...
- 電話: ...
- 地址: ...
```

這個檔案是給 AI 看的「網站索引」、跟給人看的 sitemap.xml 互補。**部分 AI（特別是 Perplexity）會優先抓這個檔來理解你**。

**Week 2 驗收：**
- `yourdomain.com/robots.txt` 開瀏覽器看得到 AI 爬蟲規則
- `yourdomain.com/llms.txt` 開瀏覽器看得到內容
- Aark 的 GEO 分數至少上升 15 分

---

## Week 3：結構化資料三件套（AEO 主戰場）

**目標：讓 AI 不只看到你、還能直接抓你的答案來回應用戶。**

這週是技術含量最高的一週、但完成後 AEO 分數通常會跳 30+ 分。

### 三件套：Organization / Product / FAQ

#### A. Organization Schema（首頁放一次就夠）
告訴 AI「你是誰、做什麼的、可信度怎樣」。直接複製這個模板改：

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "{公司名稱}",
  "url": "{首頁 URL}",
  "logo": "{Logo URL}",
  "description": "{一句話描述}",
  "sameAs": [
    "{Facebook URL}",
    "{Instagram URL}",
    "{LINE 官方帳號 URL}"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "{電話}",
    "contactType": "customer service",
    "areaServed": "TW"
  }
}
</script>
```

#### B. Product Schema（每個商品頁一份）
電商必加。WordPress + WooCommerce 通常會自動產、但要檢查是否完整。重點欄位：`name` / `image` / `description` / `brand` / `offers.price` / `offers.priceCurrency` / `aggregateRating`。

#### C. FAQ Schema（核心內容頁加上）
**這是 AI 引用率最高的 schema 類型** — AI 答題時會直接把 FAQ 條目當答案塞進回應。

```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "{問題：用客戶會問的語氣寫}",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "{答案：直接、具體、含關鍵字}"
    }
  }]
}
</script>
```

**Week 3 驗收：**
- 用 [Google Rich Results Test](https://search.google.com/test/rich-results) 確認 3 種 schema 都通過
- Aark 的 AEO 分數 ≥ 75
- 翻 5 個核心頁、每個都至少有 1 種 schema

---

## Week 4：內容權威化（E-E-A-T）

**目標：讓 AI 認為你「值得引用」、而不是隨便一個賣家。**

E-E-A-T = Experience（經驗）/ Expertise（專業）/ Authoritativeness（權威）/ Trustworthiness（信任）。AI 在選引用來源時會偷偷比這個。

### 任務 4.1：作者 / 公司資訊頁

- [ ] About 頁：寫「為什麼是我們、做多久了、服務多少人、創辦故事」
- [ ] Contact 頁：實體地址、電話、Email、Google Maps 嵌入
- [ ] 隱私權政策頁（這條也是 Schema 的 trust signal）
- [ ] 服務條款頁
- [ ] 作者署名：部落格文章每篇都要有作者 bio + 大頭照

### 任務 4.2：內容深度升級

挑 3 篇核心頁面、用「**回答客戶會搜的問題**」的思路改寫：

| 改寫前 | 改寫後 |
|---|---|
| 「精選車用 Android 安卓主機」 | 「Honda HRV 環景安卓主機推薦 — 2026 版本完整安裝指南 + 價格」 |
| 「最新優惠」 | 「車用安卓盒子怎麼選？5 個避雷重點 + 安裝店家推薦」 |
| 「商品介紹」 | 「Toyota 安卓機升級必看：4 種主流主機規格比較」 |

**判斷標準：** 標題裡有沒有「具體車型 + 問題 / 比較 / 推薦」這類關鍵字組合。

**Week 4 驗收：**
- Aark 的 E-E-A-T 分數 ≥ 70
- 至少有 3 篇權威長文（≥ 1500 字、附作者 bio、附 FAQ schema）

---

## Week 5：外部訊號鋪設 + 修正 AI 錯誤認知

**目標：讓「不在你網站上」的 AI 也能找到你的對的資訊。**

AI 訓練/檢索時、會抓很多第三方平台。要被 AI 引用、單靠自己網站不夠、得在 **AI 會去的地方** 也有你的對的資訊。

### 任務 5.1：第三方平台鋪設

挑 3-5 個你產業對應的平台、發內容：

| 產業 | 主要平台 |
|---|---|
| 一般消費品 / 3C | Mobile01、PTT、Dcard、Threads |
| 美食/餐飲 | Google Maps、IG、Threads、Yelp |
| 美業 / 健身 | IG、Threads、Google Maps |
| B2B 服務 | LinkedIn、Medium、自家部落格 + SEO |
| 旅遊 | Tripadvisor、KKday/Klook 商家頁 |
| 製造業 / 工業 | 公司官網 + LinkedIn + 行業協會目錄 |

**重點不是發廣告、是發「對潛在客戶有用的內容」、自然帶到你品牌。**

### 任務 5.2：Google 商家檔案（Google Business Profile）

實體店家必做。已有的去檢查、沒有的建立：
- [ ] 名稱、地址、電話、官網 URL 正確
- [ ] 營業時間填完整
- [ ] 至少 10 張照片
- [ ] 鼓勵真實客戶留 review

**這個資料 Google 直接餵給 Gemini / Google AI Overviews、命中率非常高。**

### 任務 5.3：修正 AI 對你品牌的錯誤認知（如果有）

如果你跑 aivis 監測時、發現 AI 對你品牌有錯誤資訊（地址錯、產品錯、把競品當你）、按這個順序處理：

**Step 1：找到 AI 引用的來源**
打開 Perplexity、問同一個問題、看右側列出的「Sources」是哪些網頁。**那些就是錯誤的源頭。**

**Step 2：對應修法**

| 來源類型 | 修法 |
|---|---|
| Wikipedia | 直接編輯（Wikipedia 帳號免費註冊） |
| PTT / Mobile01 / 巴哈 | 在原帖回覆糾正（或聯絡版主） |
| 新聞 / 媒體 | 寫信給編輯要求更正 |
| 別人的部落格 | 留言或直接聯絡作者 |
| 你自己的網站 | 立刻改 + 加上正確版 Schema |
| Google 商家檔案 | 「建議編輯」或在後台直接改 |

**Step 3：用「對的訊號」蓋過「錯的訊號」**
如果錯誤資訊散落太多地方修不完、就在自己網站建一個「品牌事實」頁（含 Organization Schema + FAQ Schema）、明確列出公司名、地址、產品線、創立年份 — 持續輸出正確版內容、6-8 週後 AI 會慢慢轉向。

**Step 4：直接回報給 AI 廠商**
重大錯誤（特別是涉及人身、品牌名譽）走官方回報：
- ChatGPT：對話框右下角 👎 + 「報告問題」
- Perplexity：點 source 旁的 Report
- Gemini：「提供意見回饋」→「不正確」

這條命中率不高、但是免費的、有時間順手做。

**⚠️ 法律手段（嚴重侵權時用）：** 持續產出毀謗 / 不實侵權的 AI 內容、可以寄存證信函給該 AI 公司、或走個資法 / 名譽權民事。歐盟用戶可援 GDPR Article 17「被遺忘權」。

**Week 5 驗收：**
- 至少 3 個第三方平台有你品牌的正確內容
- Google 商家檔案完整度 100%
- 如果有 AI 錯誤、至少修到 1 個源頭

---

## Week 6：aivis 啟動 + 6 週驗收

**目標：把「有沒有真的被 AI 推薦」這件事從感覺轉成數字。**

前 5 週都是施工、Week 6 是驗收。

### 任務 6.1：開啟 aivis 監測

在方舟 AI 雷達 Dashboard → AI 曝光監測：
1. 加入你的品牌名（中文 / 英文都加）
2. 加入 5-10 個你客戶會問 AI 的問題（不要塞品牌名、要塞需求語句）
   - 例：「最推薦的車用安卓機品牌？」（不是「金鉑先生車機評價」）
   - 例：「台南最好的鋼琴老師？」（不是「XX 音樂教室」）
   - 例：「FOC 馬達哪家品牌好？」（不是「XX 公司」）

aivis 會每 20 分鐘輪詢 5 個 LLM（ChatGPT / Gemini / Claude / Perplexity / Grok）、看你品牌被提到的次數。

### 任務 6.2：6 週成果驗收

|  | Week 0 起跑 | Week 6 目標 |
|---|---|---|
| Aark 綜合分數 | _____ | +20 以上 |
| AEO 分數 | _____ | ≥ 75 |
| GEO 分數 | _____ | ≥ 75 |
| 自然搜尋流量 | _____ | +20% |
| AI 引用率（aivis） | 0 / 10 | ≥ 3 / 10 |
| 至少 1 個 AI 主動引用你網站 | ❌ | ✅ |

### 任務 6.3：下一個 6 週的規劃

照 Week 6 數字、決定下一階段：
- **超過目標** → 把策略複製到第二、三個產品線 / 服務線
- **接近目標** → 同一套再跑 6 週、深化
- **遠低於目標** → 回 Week 1 重新檢查紅燈、可能有結構性問題（網站速度太慢、被 Google 降權、被 AI 爬蟲擋住等）

---

## 附錄 A：必用工具清單

| 工具 | 用途 | 費用 |
|---|---|---|
| **方舟 AI 雷達** | 5 訊號層即時健檢 + aivis 引用率監測 | 試用版免費、Pro NT$1,490/月 |
| Google Search Console | 看 Google 實際排名與流量 | 免費 |
| Google Rich Results Test | 驗證 Schema 正確性 | 免費 |
| Perplexity | 看 AI 引用來源、模擬潛在客戶體驗 | 免費版即可 |
| Schema.org Validator | Schema 完整性檢查 | 免費 |
| Wikipedia | 修正 AI 錯誤認知的核心戰場 | 免費（需註冊帳號編輯） |

---

## 附錄 B：常見錯覺與真相

| 直覺以為 | 實際真相 |
|---|---|
| 「我跟 AI 講 100 次它就會記住」 | 只記在你個人帳號、對其他用戶 0 影響 |
| 「AI 會自己找到我」 | AI 只會找到「Google 找得到 + Schema 結構化好 + 第三方有提到」的網站 |
| 「LLMO 跟 SEO 是兩件事」 | LLMO 包含 SEO、SEO 是 LLMO 的地基層、不是替代關係 |
| 「Schema 是給開發者玩的」 | Schema 是 AI 抓答案的主要來源、是 AEO 命脈 |
| 「6 週應該夠看到效果」 | 搜尋型 AI 是、模型型 AI 要 2-8 週甚至更久、要分開看 |
| 「不開放 AI 爬蟲才不會被免費訓練」 | 對中小企業是錯誤平衡、擋掉的曝光損失遠大於避免被訓練的好處 |

---

**本清單由 {代理商名稱} 提供 · 技術監測：方舟 AI 雷達**
**Powered by AARK · 由優勢方舟數位行銷研發**
