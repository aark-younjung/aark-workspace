// 執行：node --test src/services/reportVerdict.test.js
// 判語引擎：重點在「資料不支持的話一句都不能講出來」。
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVerdict } from './reportVerdict.js'

const row = (promptId, text, mentioned, withData = 3, hit = mentioned, observed = 3) =>
  ({ promptId, text, enginesMentioned: mentioned, enginesWithData: withData, hit, observed })

const aivis = ({ rows, prev = null, byEngine = [], prompts, observed = 18, hit = 6, rate = 33 }) => ({
  hasData: true,
  latest: { at: '2026-08-28T03:00:00Z', rows },
  previous: prev ? { at: '2026-08-20T03:00:00Z', rows: prev } : null,
  totals: { prompts: prompts ?? rows.length, observed, hit, rate, enginesUsed: 3 },
  influence: { byEngine },
  sessionCount: prev ? 2 : 1,
  rangeDays: 90,
})

const HIGH = { seo: 86, aeo: 88, geo: 88, eeat: 100 }   // 金鉑那種體質（平均 91）
const LOW = { seo: 40, aeo: 45, geo: 38, eeat: 50 }     // 平均 43

test('技術高分 + 提及率低 → 打出樞紐那句話', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 0)], rate: 10 }) })
  assert.equal(v.headline, '你的網站沒有問題，問題在網站以外。')
  assert.equal(v.techAvg, 91)   // (86+88+88+100)/4 = 90.5 → 四捨五入 91
})

test('技術高分 + 中等提及率（91 / 33%）→ 不可說「技術面在中段」', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 1)], rate: 33 }) })
  // 33% ≈ 三個引擎只有一個講到你，仍屬「多數 AI 不提你」
  assert.equal(v.headline, '你的網站沒有問題，問題在網站以外。')
  assert.equal(/技術面.*中段/.test(v.headline), false)
})

test('技術高分 + 提及率中間偏高（45%）→ 講「還只出現一部分」', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 2)], rate: 45 }) })
  assert.match(v.headline, /網站本身已經到位/)
})

test('技術低分 + 提及率低 → 先修網站', () => {
  const v = buildVerdict({ scores: LOW, aivis: aivis({ rows: [row('a', 'X', 0)], rate: 5 }) })
  assert.match(v.headline, /連把你的網站讀完整都有困難/)
})

test('技術低分 + 提及率高 → 靠站外撐著', () => {
  const v = buildVerdict({ scores: LOW, aivis: aivis({ rows: [row('a', 'X', 3)], rate: 80 }) })
  assert.match(v.headline, /靠站外內容撐著/)
})

test('沒有 aivis 資料時，絕不假裝知道 AI 推不推薦你', () => {
  const v = buildVerdict({ scores: HIGH, aivis: null })
  assert.match(v.headline, /這份報告還答不了/)
  assert.equal(v.rate, null)
  assert.equal(v.hasAivis, false)
  // 沒有實測就不該生出「最強的一題」「真正的缺口」「資源該放哪裡」
  assert.deepEqual(v.cards.map(c => c.title), ['目前最好的一塊'])
})

test('四層都不及格就不硬找好消息（不敷衍）', () => {
  const v = buildVerdict({ scores: { seo: 40, aeo: 45, geo: 38, eeat: 50 }, aivis: null })
  assert.equal(v.cards.find(c => c.title === '目前最好的一塊'), undefined)
})

test('最強的一題：全引擎命中才講「已經是 AI 講得出來的答案」', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'VW 隱藏功能', 3, 3, 3, 3), row('b', 'Y', 1)] }) })
  const card = v.cards.find(c => c.title === '最強的一題')
  assert.match(card.body, /VW 隱藏功能/)
  assert.match(card.body, /3 個引擎裡有 3 個/)
  assert.match(card.body, /已經是 AI 講得出來的答案/)
})

test('部分命中時不套用「全部命中」那句話', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 1)] }) })
  const card = v.cards.find(c => c.title === '最強的一題')
  assert.equal(/已經是 AI 講得出來的答案/.test(card.body), false)
  assert.match(card.body, /最有機會先擴大/)
})

test('連續兩次掛零 → 才敢說「重複的零不是波動」', () => {
  const rows = [row('a', '台南行車記錄器安裝', 0), row('b', 'X', 2)]
  const prev = [row('a', '台南行車記錄器安裝', 0), row('b', 'X', 1)]
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows, prev }) })
  const card = v.cards.find(c => c.title === '真正的缺口')
  assert.match(card.body, /連續兩次檢測/)
  assert.match(card.body, /重複的零不是/)
})

test('只有一次紀錄的掛零 → 措辭放軟，不下結構性結論', () => {
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 0)] }) })
  const card = v.cards.find(c => c.title === '這次沒進榜的題')
  assert.match(card.body, /還不能斷定是結構性問題/)
  assert.equal(v.cards.some(c => c.title === '真正的缺口'), false)
})

test('上次也沒掛零 → 不套用連續掛零的說法', () => {
  const rows = [row('a', 'X', 0)]
  const prev = [row('a', 'X', 2)]   // 上次有被提到，這次沒有＝可能是波動
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows, prev }) })
  assert.equal(v.cards.some(c => c.title === '真正的缺口'), false)
  assert.match(v.cards.find(c => c.title === '這次沒進榜的題').body, /還不能斷定/)
})

test('來源歸因：有讀官網的與不讀的並存時，講「換戰場」', () => {
  const byEngine = [
    { engine: 'chatgpt', answers: 6, ownAnswers: 4, hosts: [], totalHosts: 5 },
    { engine: 'claude', answers: 6, ownAnswers: 0, hosts: [], totalHosts: 4 },
    { engine: 'gemini', answers: 6, ownAnswers: 0, hosts: [], totalHosts: 3 },
  ]
  const card = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 1)], byEngine }) })
    .cards.find(c => c.title === '資源該放哪裡')
  assert.match(card.body, /ChatGPT 的回答裡讀到過你的官網/)
  assert.match(card.body, /Claude、Gemini 一次都沒有/)
  assert.match(card.body, /換戰場/)
})

test('來源歸因：全部引擎都沒讀到官網 → 講「先讓內容出現在 AI 會讀的地方」', () => {
  const byEngine = [
    { engine: 'chatgpt', answers: 6, ownAnswers: 0, hosts: [], totalHosts: 5 },
    { engine: 'claude', answers: 6, ownAnswers: 0, hosts: [], totalHosts: 4 },
  ]
  const card = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 0)], byEngine }) })
    .cards.find(c => c.title === '資源該放哪裡')
  assert.match(card.body, /一次都沒有出現你的官網/)
})

test('只有一個引擎有資料時不生來源判語（樣本太少）', () => {
  const byEngine = [{ engine: 'chatgpt', answers: 6, ownAnswers: 3, hosts: [], totalHosts: 5 }]
  const v = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 1)], byEngine }) })
  assert.equal(v.cards.some(c => c.title === '資源該放哪裡'), false)
})

test('封面方法摘要照實寫，沒有 aivis 就不提實測', () => {
  const withA = buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 1)], prev: [row('a', 'X', 0)] }) })
  assert.equal(withA.method, '技術檢測 31 個項目｜實際提問 1 題 × 3 個 AI ＝ 18 次｜含與上一次檢測的同題對照')
  const noA = buildVerdict({ scores: HIGH, aivis: null })
  assert.equal(noA.method, '技術檢測 31 個項目')
})

test('全部判語都不得出現誇大用語（公平交易法紅線）', () => {
  const byEngine = [
    { engine: 'chatgpt', answers: 6, ownAnswers: 4, hosts: [], totalHosts: 5 },
    { engine: 'claude', answers: 6, ownAnswers: 0, hosts: [], totalHosts: 4 },
  ]
  const cases = [
    buildVerdict({ scores: HIGH, aivis: aivis({ rows: [row('a', 'X', 3, 3, 3, 3)], prev: [row('a', 'X', 0)], byEngine }) }),
    buildVerdict({ scores: LOW, aivis: aivis({ rows: [row('a', 'X', 0)], prev: [row('a', 'X', 0)], byEngine, rate: 0 }) }),
    buildVerdict({ scores: HIGH, aivis: null }),
    buildVerdict({}),
  ]
  const banned = /保證|一定會|必定|大幅提升|立刻見效|穩上|包上|第一名/
  for (const v of cases) {
    const text = [v.headline, v.method, ...v.cards.map(c => `${c.title}${c.body}`)].join('')
    assert.equal(banned.test(text), false, `出現誇大用語：${text}`)
  }
})

test('完全沒資料不炸，且明說取不到資料', () => {
  const v = buildVerdict({})
  assert.match(v.headline, /沒有取得足夠的檢測資料/)
  assert.deepEqual(v.cards, [])
})
