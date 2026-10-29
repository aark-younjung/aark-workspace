/**
 * 報告判語引擎（2026-08-28）
 *
 * 為什麼要有這支：
 *   拆完同業給客戶的 10 頁報告後，最值得學的不是版面也不是文案技巧，是**判語**——
 *   把一頁數字收斂成「一句企業主可以轉述給老闆聽的話」。
 *   他們第 2 頁那句「技術面沒問題，問題在網站以外」，同時做到兩件事：
 *   讓客戶不防衛（不是你網站爛），又把問題移到他自己搞不定的地方（所以要買服務）。
 *   我們的報告有分數、有分母、有來源，卻從來沒有「所以呢」。
 *
 * 為什麼是程式產不是手寫：
 *   判語一旦手寫就會開始誇大，那正是公平交易法紅線與品牌承諾要擋的東西。
 *   這裡每一句都由實際數據推導，條件寫死、可單測、不可能講出資料不支持的話。
 *
 * 語氣守則（PRODUCT.md 品牌承諾「誠實直白、不誇大、台灣在地人話」）：
 *   - 不出現「保證」「一定」「大幅」「立刻見效」
 *   - 沒有 aivis 資料時不假裝知道 AI 推不推薦你，改講「這份報告還答不了」
 *   - 缺口一律講清楚是幾次觀測中的幾次，不用形容詞代替數字
 */

const LAYERS = [
  { key: 'seo', label: 'SEO', desc: '搜尋引擎地基' },
  { key: 'aeo', label: 'AEO', desc: '答案引擎引用' },
  { key: 'geo', label: 'GEO', desc: '生成式 AI 可讀性' },
  { key: 'eeat', label: 'E-E-A-T', desc: '可信度訊號' },
]

const ENGINE_LABEL = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' }

function avg(values) {
  const nums = values.filter(value => typeof value === 'number')
  return nums.length ? Math.round(nums.reduce((sum, n) => sum + n, 0) / nums.length) : null
}

/**
 * 一句話判語 —— 技術面與實測面的落差決定講什麼。
 * 這個交叉表是整份報告的樞紐：分數高但沒被提到，問題就不在網站裡，
 * 客戶會把力氣花在補標籤上，而那對他無效。
 */
function headlineOf(techAvg, rate) {
  if (techAvg == null) return '這次沒有取得足夠的檢測資料，先確認網站可被讀取再重跑一次。'
  if (rate == null) {
    return `技術體質 ${techAvg} 分。但「AI 會不會推薦你」是另一件事——這份報告還答不了，那要實際去問 AI 才知道。`
  }

  // 門檻取整數邊界，避免落到「哪一句都不像」的模糊地帶。
  // rateLow 設 35 而不是 20：三個引擎裡只有一個穩定講到你 ≈ 33%，那已經是
  // 「多數 AI 不會提到你」，不該被歸成中段（2026-08-28 用真實量級的資料試跑時發現的洞——
  // 技術 91 分配 33% 提及率，原本會掉進 fallback 說「技術面在中段」，跟 91 分自相矛盾）。
  const techHigh = techAvg >= 75
  const techLow = techAvg < 60
  const rateLow = rate <= 35
  const rateHigh = rate >= 60

  if (techHigh && rateLow) return '你的網站沒有問題，問題在網站以外。'
  if (techHigh && rateHigh) return '技術面與實際成績都在位——接下來的重點是守住，不是再優化網站。'
  if (techHigh) return '網站本身已經到位，但 AI 的回答裡你還只出現一部分——剩下的要往站外補。'
  if (techLow && rateLow) return 'AI 現在連把你的網站讀完整都有困難，要從這裡開始。'
  if (techLow && rateHigh) return '你目前是靠站外內容撐著；網站補起來，這個成績會更穩。'
  if (techLow) return '網站有幾項基礎沒補完，先把這些處理掉，後面的努力才不會漏掉。'
  if (rateLow) return '網站的基本盤堪用，但 AI 目前很少在回答裡講到你。'
  if (rateHigh) return '站外表現不錯，網站再補幾項就能兩邊都站穩。'
  return '技術面與 AI 實測都在中段——兩邊各有一塊沒補完。'
}

/** 好消息：分數最高的那一層。刻意先給好消息，客戶才聽得進後面的缺口。 */
function goodNewsOf(scores) {
  const ranked = LAYERS
    .map(layer => ({ ...layer, score: scores[layer.key] }))
    .filter(layer => typeof layer.score === 'number')
    .sort((a, b) => b.score - a.score)
  if (!ranked.length) return null
  const best = ranked[0]
  if (best.score < 60) return null   // 沒有一層及格就不硬找好消息（那會變成敷衍）
  return {
    title: '目前最好的一塊',
    body: `${best.label}（${best.desc}）拿到 ${best.score} 分，是四層裡最高的。這一層先不用動。`,
  }
}

/** 最強的一題：被最多引擎講出來的那題。這是唯一「已被驗證有效」的路，可複製。 */
function strongestOf(aivis) {
  if (!aivis?.hasData) return null
  const ranked = [...aivis.latest.rows]
    .filter(row => row.enginesMentioned > 0)
    .sort((a, b) => b.enginesMentioned - a.enginesMentioned || b.hit - a.hit)
  if (!ranked.length) return null
  const top = ranked[0]
  const all = top.enginesMentioned === top.enginesWithData
  return {
    title: '最強的一題',
    body: `「${top.text}」這一題，${top.enginesWithData} 個引擎裡有 ${top.enginesMentioned} 個講出你的名字（${top.hit} / ${top.observed} 次觀測）。`
      + (all
        ? '全部命中代表這個題目上，你已經是 AI 講得出來的答案之一——這條路走通了一次，可以複製到其他同類題目。'
        : '這是目前最有機會先擴大的一題。'),
  }
}

/**
 * 真正的缺口：優先取「連續兩次都掛零」的題（重複的零才是訊號，單次是雜訊）。
 * 沒有上一場就退而取本次全掛零的題，但措辭要跟著放軟。
 */
function gapOf(aivis) {
  if (!aivis?.hasData) return null
  const zeroNow = aivis.latest.rows.filter(row => row.enginesMentioned === 0)
  if (!zeroNow.length) return null

  if (aivis.previous) {
    const prevById = Object.fromEntries(aivis.previous.rows.map(row => [row.promptId, row]))
    const persistent = zeroNow.filter(row => prevById[row.promptId]?.enginesMentioned === 0)
    if (persistent.length) {
      const observed = persistent.reduce((sum, row) => sum + row.observed, 0)
      return {
        title: '真正的缺口',
        body: `${persistent.map(row => `「${row.text}」`).join('、')}——這 ${persistent.length} 題連續兩次檢測、合計 ${observed} 次觀測，一次都沒有被提到。`
          + '單次沒被提到可能是波動，重複的零不是。這幾題通常不是網站本身的問題，而是 AI 回答這類問題時取材的地方沒有你的內容。',
      }
    }
  }

  return {
    title: '這次沒進榜的題',
    body: `${zeroNow.map(row => `「${row.text}」`).join('、')} 這 ${zeroNow.length} 題，本次檢測沒有任何引擎提到你。`
      + '只有一次紀錄還不能斷定是結構性問題——下一次檢測會知道是波動還是真的進不去。',
  }
}

/** 來源歸因的一句話：哪個引擎讀你的官網、哪個不讀，直接決定資源往哪放。 */
function sourceInsightOf(aivis) {
  const byEngine = (aivis?.influence?.byEngine || []).filter(engine => engine.answers > 0)
  if (byEngine.length < 2) return null
  const reads = byEngine.filter(engine => engine.ownAnswers > 0)
  const ignores = byEngine.filter(engine => engine.ownAnswers === 0)
  if (!reads.length && !ignores.length) return null

  if (reads.length && ignores.length) {
    return {
      title: '資源該放哪裡',
      body: `${reads.map(e => ENGINE_LABEL[e.engine]).join('、')} 的回答裡讀到過你的官網，`
        + `${ignores.map(e => ENGINE_LABEL[e.engine]).join('、')} 一次都沒有。`
        + '會讀官網的引擎，官網做好就有用；不讀官網的那幾個，網站做到滿分也進不去名單——那一塊要換戰場。',
    }
  }
  if (!reads.length) {
    return {
      title: '資源該放哪裡',
      body: `${byEngine.length} 個引擎的回答來源裡，一次都沒有出現你的官網。`
        + '這代表現階段把力氣全放在網站上，很難改變 AI 的回答——要先讓你的內容出現在 AI 會去讀的地方。',
    }
  }
  return {
    title: '資源該放哪裡',
    body: `${reads.map(e => ENGINE_LABEL[e.engine]).join('、')} 都讀得到你的官網——官網這條線正在替你工作，值得繼續投。`,
  }
}

/** 封面用的方法摘要：先講清楚做了什麼、範圍多大，客戶才會信後面的話。 */
function methodOf(techCount, aivis) {
  const parts = [`技術檢測 ${techCount} 個項目`]
  if (aivis?.hasData) {
    parts.push(`實際提問 ${aivis.totals.prompts} 題 × ${aivis.totals.enginesUsed} 個 AI ＝ ${aivis.totals.observed} 次`)
    if (aivis.previous) parts.push('含與上一次檢測的同題對照')
  }
  return parts.join('｜')
}

/**
 * 產生整份報告的判語組。
 * @param {{scores:{seo,aeo,geo,eeat}, aivis:object|null, techCount:number}} input
 */
export function buildVerdict({ scores = {}, aivis = null, techCount = 31 } = {}) {
  const techAvg = avg([scores.seo, scores.aeo, scores.geo, scores.eeat])
  const rate = aivis?.hasData ? aivis.totals.rate : null
  return {
    techAvg,
    rate,
    techCount,
    headline: headlineOf(techAvg, rate),
    cards: [goodNewsOf(scores), strongestOf(aivis), gapOf(aivis), sourceInsightOf(aivis)].filter(Boolean),
    method: methodOf(techCount, aivis),
    hasAivis: !!aivis?.hasData,
  }
}
