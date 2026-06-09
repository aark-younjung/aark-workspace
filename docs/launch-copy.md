# 方舟 AI 雷達 — 上線公告文案集（2026-06-09）

正式上線文案、依管道分版。可直接複製、發前依實際情況微調。

---

## 1. NotificationBell（站內公告、已上線）

> **🎉 方舟 AI 雷達正式上線、早鳥 100 名首年 NT$990／月**
>
> 台灣第一個完整覆蓋 LLMO（5 訊號層）的監測平台正式對外開放。前 100 名付費用戶享早鳥首年 NT$990／月（年繳 NT$11,880、現省 22%）、4 週內或額滿截止。Pro 全功能 7 天免費試用 + 14 天無條件退款。

已加進 [src/components/v2/NotificationBell.jsx](../src/components/v2/NotificationBell.jsx) 的 HARDCODED_BRIEFINGS、所有訪客打開站就會看到。

---

## 2. Email 上線通知（給註冊過的試用 / 免費用戶）

**寄件人：** Aark · AI 雷達 <aark.younjung@gmail.com>
**主旨建議擇一：**
- 「方舟 AI 雷達正式上線、早鳥首年 NT$990／月（前 100 名）」
- 「台灣第一個 LLMO 監測平台正式對外開放、你 7 天免費試用準備好了」
- 「【上線通知】你註冊的 AI 雷達服務、今天起完整開放」

**內文（HTML / Plain text 兩版）：**

### Plain text 版

```
Hi {first_name}，

感謝你在我們還在 beta 階段就註冊了 Aark · 方舟 AI 雷達。

今天起、我們正式對外開放完整 Pro 服務。

【為什麼你應該現在升級】

方舟 AI 雷達是台灣第一個完整覆蓋 LLMO（Large Language Model
Optimization、業界俗稱「AI 搜尋優化」）的監測平台。我們把 LLMO
這把大傘拆成 5 個可量化訊號層、各自打分：

1. SEO — 傳統搜尋排名地基（Google 找得到你）
2. AEO — 答案引擎引用（AI 把你當答案）
3. GEO — 生成式 AI 推薦（ChatGPT / Perplexity 推你）
4. E-E-A-T — 可信度訊號（AI 判斷你值得引用）
5. aivis — 跨 5 個 LLM 引用率追蹤（結果驗證層）

簡單講：Ahrefs / SEMrush 教你贏 Google、Aark 教你贏 ChatGPT。

【早鳥優惠 — 前 100 名、4 週限定】

- 早鳥年繳：NT$11,880（月攤 NT$990）
- 一般年繳：NT$13,900（月攤 NT$1,158）、Pro 月繳 NT$1,490
- 早鳥首年省 NT$2,020 = 14% off
- 早鳥位於今天起 4 週內額滿即止
- 註冊年繳享 14 天無條件退款

【現在開始的兩條路】

A. 還沒試用過 Pro：7 天免費試用、不需信用卡
   → https://aark-workspace.vercel.app/pricing

B. 直接鎖定早鳥 NT$990／月（不用試用）
   → https://aark-workspace.vercel.app/pricing

【有問題嗎】

Email：aark.younjung@gmail.com（1-2 個工作天回覆）
LINE：（OA 籌備中、有最新消息會通知）

期待跟你在 AI 搜尋時代一起成長。

優勢方舟數位行銷
方舟 AI 雷達 Team
```

### HTML 版要點（給工程 / 設計用、實際 HTML 可後續做）

- Header：Aark logo（綠 wordmark + 雷達 dial）
- Hero：「正式上線」標題 + 「早鳥 NT$990／月」CTA 按鈕
- 5 訊號層用 5 個小卡片 / icon 排列
- CTA 兩顆並列：「免費試用 7 天」+「直接鎖定早鳥」
- Footer：unsubscribe + 公司資訊 + LINE QR code（OA 申請好後加）

---

## 3. Threads / Facebook（短版社群、180 字內）

```
🎉 方舟 AI 雷達正式上線了。

台灣第一個完整覆蓋 LLMO（AI 搜尋優化）的監測平台、
把 SEO / AEO / GEO / E-E-A-T / aivis 5 訊號層拆開打分、
讓你看到 ChatGPT / Perplexity / Claude 為什麼推薦你、
或為什麼不推薦你。

🐣 早鳥 100 名首年 NT$990／月、限 4 週
✨ Pro 全功能 7 天免費試用、不需信用卡

aark-workspace.vercel.app

#LLMO #AI搜尋 #SEO #AEO #GEO #AI雷達
```

---

## 4. LinkedIn（B2B 較長版、給代理商看）

```
做 SEO 這幾年最大的變化、不是演算法、是用戶習慣。

越來越多人不滑 Google 搜尋結果、直接問 ChatGPT / Perplexity / Gemini。
而傳統 SEO 工具 — Ahrefs / SEMrush / Rank Math — 看不到這個世界。

今天、Aark · 方舟 AI 雷達正式上線、補上這個盲區。

我們做的事：把「AI 搜尋時代的優化」拆成 5 個可量化訊號層：
• SEO（讓 Google 找到你）
• AEO（讓 AI 把你當答案）
• GEO（讓生成式 AI 推薦你）
• E-E-A-T（讓 AI 判斷你值得引用）
• aivis（每天監測你在 5 個 LLM 的實際引用率）

設計給數位行銷代理商和 in-house 行銷團隊用、白標 PDF、Top 5 行動建議、
LLMO 6 週執行清單（含 robots.txt / Schema / llms.txt 完整模板）。

🐣 早鳥：前 100 名首年 NT$990／月（4 週限定）
✨ Pro 7 天免費試用、14 天無條件退款

aark-workspace.vercel.app

#LLMO #DigitalMarketing #SEO #AIVisibility #B2BSaaS
```

---

## 5. Threads / X 超短版（用於 quote tweet 或回覆）

```
方舟 AI 雷達正式上線。
台灣第一個完整覆蓋 LLMO 5 訊號層的監測平台。
早鳥前 100 名首年 NT$990／月、4 週內或額滿截止。
aark-workspace.vercel.app
```

---

## 6. 給認識的代理商朋友（私訊 / 私 Email）

```
嘿 {name}、

跟你分享一下我這幾個月在做的東西。

我們做了一個叫「方舟 AI 雷達」的工具、專門幫網站做 LLMO
（簡單講就是讓 ChatGPT / Perplexity / Gemini 推薦你的網站）。
今天正式上線、想說先跟你打聲招呼。

你如果做代理商業務、應該會用得上幾個東西：
1. 白標 PDF 報告（可填代理商署名、直接交付客戶）
2. LLMO 6 週執行清單（給客戶 6 週逐週做、有 robots.txt /
   Schema / llms.txt 完整模板）
3. aivis 跨 5 個 LLM 引用率監測

早鳥前 100 名首年 NT$990／月、限 4 週、你有興趣可以先試用 7 天。

aark-workspace.vercel.app

有任何反饋直接私訊我、不客氣。
```

---

## 發佈節奏建議

| 時間 | 動作 |
|---|---|
| **Day 0（今天）** | 站內鈴鐺公告（已上）+ 私訊 5-10 位認識的代理商朋友（用版本 6） |
| **Day 1** | Email 給註冊用戶（版本 2）+ Threads 公告（版本 3） |
| **Day 2-3** | Facebook 個人 + 公司粉專（版本 3 + 自加截圖）+ LinkedIn（版本 4）|
| **Day 7** | 第一週成果回顧、發進度（早鳥位剩 X 個、X 個代理商試用中等） |
| **Week 2-4** | 早鳥倒數計時、每週發一次稀缺性提醒 |

## 訊息一致性檢查表

- [ ] 所有版本「早鳥」價格 = NT$990／月 / NT$11,880／年
- [ ] 都提「前 100 名」「4 週限定」「Pro 7 天試用」「年繳 14 天退款」
- [ ] URL 統一用 https://aark-workspace.vercel.app（之後切 app.a-ark.com.tw 時要全替換）
- [ ] 不要寫「免費版有 aivis」（aivis 是 Pro-only、寫錯會引爭議）
- [ ] 早鳥 1/100 已售（yuppy0912）— 對外文案可選擇強調 vs 不提
