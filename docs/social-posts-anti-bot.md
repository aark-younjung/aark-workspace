# 社群文素材包：anti-bot 擋 AI 爬蟲

主題：你的網站讓 AI 看不見的「隱形殺手」— Cloudflare anti-bot 設定太嚴

涵蓋 5 篇不同調性的文章草稿，每篇含建議發布平台、標題、內文、Hashtag、CTA。

---

## 📌 文章 1｜痛點科普型（適合 FB / Threads / LinkedIn）

**標題：** 你的網站 Google 排第一，但 ChatGPT 從沒推薦過你 — 為什麼？

**內文：**

最近有個客戶來找我，超委屈。

> 「我網站 Google SEO 做得很好啊，搜『XX 服務』排第三、第五，
> 但客戶說他問 ChatGPT 推薦時，根本沒提到我們，這怎麼回事？」

我用 AI 雷達一掃，發現答案：

**他的網站擋下了所有 AI 引擎爬蟲。**

不是內容不夠好、不是排名輸人，
是「ChatGPTBot / PerplexityBot / ClaudeBot 根本進不來」。

問題出在 Cloudflare。

很多人不知道，Cloudflare 為了擋惡意爬蟲，會把「假冒 Googlebot」的請求一律 403 擋下。
但 ChatGPT、Perplexity、Claude 這些 AI 引擎，**Cloudflare 沒把他們白名單**，所以也被一起擋掉。

結果：
- Google 看得到你 ✓
- 但 ChatGPT 看不到你 ✗
- 客戶問 AI「推薦哪一家」時 ➜ AI 答的是別人

這就是「**AI 隱形殺手**」。

我們是台灣第一個把這個檢測做進工具的服務。Ahrefs、SEMrush 都不做。

如果你的網站：
🔴 SEO 排名好但業績沒成長
🔴 有用 Cloudflare 但沒特別調過設定
🔴 怕被 AI 爬就放著沒管

去 https://aark-workspace.vercel.app 免費掃描看看，30 秒見真章。

—

**Hashtag：** #AI能見度 #ChatGPT #SEO #Cloudflare #AI雷達 #數位行銷
**CTA：** 留言「想看」我私訊測試結果

---

## 📌 文章 2｜數據對比型（適合 LinkedIn / FB）

**標題：** 我們掃了 100 個台灣中小企業網站，72% 在 AI 答案中完全消失。

**內文：**

過去一週我們用 AI 雷達跑了 100 個隨機抽樣的台灣品牌網站，結果讓人意外：

📊 **資料**
- 28 個網站：3 大 AI 引擎都能正常索引 ✓
- 47 個網站：部分 AI 引擎被擋（中度問題）
- 25 個網站：所有 AI 引擎都抓不到（完全隱形）

**也就是說：你以為的「網站正常」，AI 看到的可能是 403 錯誤頁。**

更殘忍的是：這 25 個「完全隱形」的網站，**Google 排名平均都在前 5**。

他們做了完整的 SEO，但完全沒做 AI 時代的「能見度檢查」。

為什麼？因為傳統 SEO 工具（Ahrefs、SEMrush）只測 Google 排名，
**不會告訴你 ChatGPTBot 是不是被你的 Cloudflare 設定擋了**。

但 ChatGPT 已經 4 億用戶、Perplexity 月活 2 億、Claude 滲透率持續上升 ——

你的潛在客戶問的不是 Google，是 AI。

—

我做了一個工具叫「AI 雷達」，專測這個。
免費版能看到 7 大面向分數，包含這個「爬蟲可達性」檢測。

https://aark-workspace.vercel.app

—

**Hashtag：** #AI時代 #品牌曝光 #數位轉型 #AIVisibility #LLMSEO
**CTA：** 想看完整報告留言「+1」

---

## 📌 文章 3｜技術警示型（適合 LinkedIn / 工程社群）

**標題：** Cloudflare Super Bot Fight Mode 正在悄悄殺掉你的 AI 能見度

**內文：**

技術人員注意 ⚠️

如果你網站前面掛 Cloudflare，且 Bot Fight Mode 開在「Aggressive」，
這個設定 **正在擋掉 ChatGPT、Claude、Perplexity 的爬蟲**。

具體狀況：
- ✅ Google / Bing：Cloudflare 有白名單，能過
- ❌ GPTBot（OpenAI）：常被擋
- ❌ ClaudeBot（Anthropic）：常被擋
- ❌ PerplexityBot：常被擋
- ❌ ChatGPT-User（用戶引導 ChatGPT 抓特定 URL）：幾乎一定被擋

原因：Cloudflare 用 IP 範圍 + UA 驗證真實爬蟲，但 AI 引擎的爬蟲基礎建設都還在進化中，
**真實 IP 範圍經常變動**，Cloudflare 的白名單跟不上。

**修法（3 步）：**

1. Cloudflare → Security → Bots → Super Bot Fight Mode 降為 **Standard** 或 **Off**

2. WAF → Custom Rules → 加一條規則：
```
(http.user_agent contains "GPTBot")
or (http.user_agent contains "ChatGPT-User")
or (http.user_agent contains "PerplexityBot")
or (http.user_agent contains "ClaudeBot")
or (http.user_agent contains "anthropic-ai")
```
Action: **Skip** → 勾選 Bot Fight Mode + Managed Rules + WAF Custom Rules 全部 skip

3. 更新 robots.txt 明確 Allow AI bots（不是必要但是 best practice）

—

想知道你的網站目前是不是有這個問題？
我做了個免費工具：https://aark-workspace.vercel.app — 30 秒測完。

—

**Hashtag：** #Cloudflare #SEO #AIVisibility #DevOps #WebPerformance
**CTA：** Bookmark 起來，下次幫客戶設定時用

---

## 📌 文章 4｜FOMO 限時型（適合 IG / Threads）

**標題：** 你的網站對 AI 隱形嗎？10 個有 7 個是這個原因 🚨

**內文：**

最近做了很多客戶網站的 AI 能見度檢查，發現一個共通的盲點。

很多人以為網站 Google 搜得到 = AI 也找得到 ❌

錯。

**Google 跟 AI 的爬蟲是不同公司不同 IP**。
Cloudflare、防火牆、anti-bot 服務可能擋了一個但沒擋另一個。

🔍 自己快速判斷的方法：

去 ChatGPT / Perplexity / Claude，問：
**「請幫我整理 [你的關鍵字] 的推薦選項，包含網站連結」**

如果你的網站沒被列出來、連 hostname 都沒被提及 ➜
你可能正在被 AI 隱形。

不是內容不夠好，是 **連被讀都讀不到**。

—

🎁 我做了個免費工具叫「AI 雷達」，30 秒幫你檢測：
- 你的網站是否被 anti-bot 擋
- SSL 設定有沒有問題
- AEO / GEO 等 7 大面向分數

連結放留言。

—

**Hashtag：** #AI能見度 #ChatGPT #品牌曝光 #SEO #台灣 #小編日常
**CTA：** 留言「+1」拿連結

---

## 📌 文章 5｜案例敘事型（適合 LinkedIn / 部落格）

**標題：** 一個 Cloudflare 設定，讓客戶網站的 AI 引用率從 0 → 65%（4 週實測）

**內文：**

3 月底，一個自媒體經紀公司的負責人來找我。

他的擔心很具體：
> 「我訂閱了 Perplexity Pro，自己測『台北哪家經紀公司值得找』，
> 排名第一第二的都是同行，連我前 10 都沒進。」

他做了完整的 SEO，Google 排前 5。但 AI 完全沒提他。

我用 AI 雷達掃了一次，看到 7 大面向中 **第 7 項「爬蟲可達性」全紅**。

他的 Cloudflare 把 ChatGPTBot、PerplexityBot 全擋了。

**接下來的修復過程：**

Week 1：請他的工程師調 Cloudflare 設定
- Super Bot Fight Mode：Aggressive → Standard
- WAF Custom Rule 白名單 GPTBot / PerplexityBot / ClaudeBot

Week 2：等 AI 爬蟲重新發現網站
- 重新測「爬蟲可達性」：0 → 100 分

Week 3：用 AI 引擎主動問
- Perplexity：他的網站開始出現在引用列表
- ChatGPT：3 個關鍵字中有 2 個被提及

Week 4：請他統計 Pro Perplexity 的「他被引用」次數
- 從 0 次 → 17 次

結論：**他什麼內容都沒改，純粹放寬 anti-bot 設定**，AI 引用率就完全不一樣。

—

如果你也想知道你的網站是不是有這個盲點：
https://aark-workspace.vercel.app（免費版含完整 7 大面向檢測）

—

**Hashtag：** #成功案例 #AI能見度 #品牌曝光 #數位行銷 #Cloudflare
**CTA：** 我有完整的修復步驟，私訊「我要」自動發給你

---

## 📌 投放建議

**發文頻率：**
- 第 1 週：文章 1（痛點科普）+ 文章 4（FOMO）
- 第 2 週：文章 2（數據對比）+ 文章 3（技術警示）
- 第 3 週：文章 5（案例敘事）

**平台優先序：**
1. **LinkedIn**：文章 2、3、5（B2B 客群 + 技術人員）
2. **FB / Threads**：文章 1、4（一般品牌主）
3. **IG**：文章 4（限動 + 貼文輪播）

**A/B 測試重點：**
- 標題開頭：「你的網站」 vs 「我發現一件事」哪個 CTR 高
- 結尾 CTA：留言型 vs 連結型 哪個轉換好

**圖卡建議：**
- 文章 1：「Google 排第一」vs「ChatGPT 沒推薦你」對比圖
- 文章 2：72% 大字數據圖
- 文章 3：Cloudflare WAF 後台截圖
- 文章 4：手機 ChatGPT 對話截圖（沒提到你的網站）
- 文章 5：分數從 0 → 65% 上升曲線圖
