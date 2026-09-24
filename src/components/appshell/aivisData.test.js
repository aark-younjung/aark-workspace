import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ENGINE_KEYS,
  buildVisibilityModel,
  normalizeEngineResults,
} from './aivisData.js'

const prompts = [
  { id: 'core-1', text: '台北有哪些推薦的代書？', tier: 'core', is_active: true },
  { id: 'rotating-1', text: '買房要找誰辦過戶？', tier: 'rotating', is_active: false },
  { id: 'brand-1', text: '方舟代書是誰？', tier: 'brand', is_active: false },
  { id: 'info-1', text: '房屋過戶要準備什麼？', tier: 'info', is_active: false },
]

function response(id, promptId, createdAt, engineResults, extra = {}) {
  return { id, prompt_id: promptId, created_at: createdAt, engine_results: engineResults, ...extra }
}

test('監測引擎固定為 ChatGPT、Claude、Gemini', () => {
  assert.deepEqual(ENGINE_KEYS, ['chatgpt', 'claude', 'gemini'])
  assert.deepEqual(Object.keys(normalizeEngineResults({
    engine_results: {
      chatgpt: { mentioned: true },
      perplexity: { mentioned: true },
      gemini: { mentioned: false },
    },
  })), ['chatgpt', 'gemini'])
})

test('舊資料沒有 engine_results 時沿用主欄合成 Claude 結果', () => {
  assert.deepEqual(normalizeEngineResults({
    id: 'legacy',
    brand_mentioned: true,
    raw_response: '舊回應',
    cost_usd: 0.02,
  }, { legacy: { position: 2 } }), {
    claude: { mentioned: true, position: 2, cost_usd: 0.02, raw: '舊回應' },
  })
})

test('頭條曝光率與趨勢只算 core，排除 rotating、brand、info', () => {
  const model = buildVisibilityModel({
    brand: { name: '方舟代書', domain: 'https://aark.tw' },
    prompts,
    responses: [
      response('c1', 'core-1', '2026-08-08T02:00:00Z', {
        chatgpt: { mentioned: true }, claude: { mentioned: false }, gemini: { mentioned: true },
      }),
      response('r1', 'rotating-1', '2026-08-08T02:00:00Z', { chatgpt: { mentioned: true } }),
      response('b1', 'brand-1', '2026-08-08T02:00:00Z', { chatgpt: { mentioned: true } }),
      response('i1', 'info-1', '2026-08-08T02:00:00Z', { chatgpt: { mentioned: true } }),
    ],
    mentions: [],
    rangeDays: 7,
    now: new Date('2026-08-08T08:00:00Z'),
  })

  assert.equal(model.exposure.rate, 67)
  assert.equal(model.exposure.mentioned, 2)
  assert.equal(model.exposure.total, 3)
  assert.equal(model.trend.find(day => day.key === '2026-08-08').rate, 67)
})

test('品牌詞認得率獨立統計，不灌入品類曝光率', () => {
  const model = buildVisibilityModel({
    brand: { name: '方舟代書', domain: 'aark.tw' }, prompts,
    responses: [response('b1', 'brand-1', '2026-08-08T02:00:00Z', {
      chatgpt: { mentioned: true }, claude: { mentioned: false },
    })],
    mentions: [], rangeDays: 7, now: new Date('2026-08-08T08:00:00Z'),
  })

  assert.equal(model.exposure.rate, null)
  assert.deepEqual(model.brandRecognition, { rate: 50, mentioned: 1, total: 2 })
})

test('引用矩陣只列最新五分鐘批次的 core 題與三引擎真實狀態', () => {
  const model = buildVisibilityModel({
    brand: { name: '方舟代書', domain: 'aark.tw' }, prompts,
    responses: [
      response('old', 'core-1', '2026-08-08T01:00:00Z', { chatgpt: { mentioned: false } }),
      response('new', 'core-1', '2026-08-08T02:00:00Z', {
        chatgpt: { mentioned: true }, claude: { mentioned: false },
      }),
    ],
    mentions: [], rangeDays: 7, now: new Date('2026-08-08T08:00:00Z'),
  })

  assert.deepEqual(model.matrix, [{
    promptId: 'core-1',
    text: '台北有哪些推薦的代書？',
    engines: { chatgpt: true, claude: false, gemini: null },
  }])
})

test('長掃描不會漏題：每條核心題各自取自己最近一次，與別題跑多久無關', () => {
  // 迴歸測試（2026-09-24）：一次掃描 15 題、31 次帶搜尋的 API 呼叫，整輪遠超過 5 分鐘。
  // 舊版拿「全部回應中最新的一筆」當基準往前抓 5 分鐘，先跑完的題目會掉出視窗、
  // 在引用矩陣上安靜消失（實案：啟用 6 條、矩陣只剩 2 條）。
  const prompts2 = [
    { id: 'core-1', text: '台北有哪些推薦的代書？', tier: 'core', is_active: true },
    { id: 'core-2', text: '新北有哪些推薦的代書？', tier: 'core', is_active: true },
  ]
  const model = buildVisibilityModel({
    brand: { name: '方舟代書', domain: 'aark.tw' },
    prompts: prompts2,
    responses: [
      // core-1 在掃描一開始就跑完，比最後一筆早了 20 分鐘
      response('a', 'core-1', '2026-08-08T02:00:00Z', { chatgpt: { mentioned: true } }),
      // core-2 是整輪的最後一題
      response('b', 'core-2', '2026-08-08T02:20:00Z', { chatgpt: { mentioned: false } }),
    ],
    mentions: [], rangeDays: 7, now: new Date('2026-08-08T08:00:00Z'),
  })

  assert.equal(model.matrix.length, 2, '兩條核心題都要出現在矩陣上')
  assert.equal(model.matrix.find(item => item.promptId === 'core-1').engines.chatgpt, true)
  assert.equal(model.matrix.find(item => item.promptId === 'core-2').engines.chatgpt, false)
})

test('內容引用率沿用 info 題最新批次來源，以正規化網域判定是否在名單', () => {
  const model = buildVisibilityModel({
    brand: { name: '方舟代書', domain: 'https://www.aark.tw/service' }, prompts,
    responses: [response('i1', 'info-1', '2026-08-08T02:00:00Z', {
      gemini: { mentioned: false, sources: [
        { uri: 'https://blog.aark.tw/article', title: '方舟文章' },
        { uri: 'https://example.com/guide', title: '外部文章' },
      ] },
    })],
    mentions: [], rangeDays: 7, now: new Date('2026-08-08T08:00:00Z'),
  })

  assert.equal(model.contentCitation.rate, 100)
  assert.equal(model.contentCitation.items[0].cited, true)
  assert.deepEqual(model.contentCitation.items[0].others, ['example.com'])
})
