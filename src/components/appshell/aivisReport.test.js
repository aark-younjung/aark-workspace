// 執行：node --test src/components/appshell/aivisReport.test.js
// 客戶報告聚合（buildAivisReport / groupScanSessions）與來源歸因分引擎的單測。
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAivisReport, groupScanSessions, buildSourceInfluence } from './aivisData.js'

const NOW = new Date('2026-08-28T12:00:00Z')
const brand = { id: 'b1', name: '金鉑先生車用品', domain: 'kimbo3899.com.tw' }

const prompts = [
  { id: 'c1', brand_id: 'b1', text: '台南汽車影音推薦', tier: 'core', is_active: true },
  { id: 'c2', brand_id: 'b1', text: '台南行車記錄器安裝 推薦', tier: 'core', is_active: true },
  { id: 'c3', brand_id: 'b1', text: '停用的題', tier: 'core', is_active: false },
  { id: 'b9', brand_id: 'b1', text: '金鉑先生是誰', tier: 'brand', is_active: true },
  { id: 'i9', brand_id: 'b1', text: '環景機怎麼裝', tier: 'info', is_active: true },
]

/** 造一筆回應：engines = { key: [mentioned, sources[], raw] } */
function res(id, promptId, createdAt, engines) {
  const engine_results = {}
  for (const [key, [mentioned, sources = [], raw = '']] of Object.entries(engines)) {
    engine_results[key] = { mentioned, position: mentioned ? 2 : null, sources, raw }
  }
  return { id, prompt_id: promptId, created_at: createdAt, engine_results, raw_response: '' }
}

const src = (...hosts) => hosts.map(h => ({ uri: `https://${h}/x`, title: h }))

// 最新一場：08-28 10:00 前後；上一場：08-20
const responses = [
  res('r1', 'c1', '2026-08-28T10:00:00Z', {
    chatgpt: [true, src('kimbo3899.com.tw', 'carnews.com'), '推薦金鉑先生車用品，位於台南東區，專做環景機安裝'],
    claude: [false, src('mobile01.com')],
    gemini: [false, src('facebook.com')],
  }),
  res('r2', 'c1', '2026-08-28T10:03:00Z', {
    chatgpt: [true, src('kimbo3899.com.tw')],
    claude: [false, src('mobile01.com', 'ptt.cc')],
    gemini: [false, src('facebook.com')],
  }),
  res('r3', 'c2', '2026-08-28T10:06:00Z', {
    chatgpt: [false, src('mobile01.com')],
    claude: [false, src('mobile01.com')],
    gemini: [false, src('vertexaisearch.cloud.google.com', 'facebook.com')],
  }),
  // brand / info 題同一場——不該進 core 分母
  res('r4', 'b9', '2026-08-28T10:08:00Z', { chatgpt: [true, src('kimbo3899.com.tw')] }),
  res('r5', 'i9', '2026-08-28T10:09:00Z', { claude: [true, src('mobile01.com')] }),
  // 上一場（8 天前）
  res('r6', 'c1', '2026-08-20T09:00:00Z', { chatgpt: [false, src('mobile01.com')], claude: [false, []], gemini: [false, []] }),
  res('r7', 'c2', '2026-08-20T09:04:00Z', { chatgpt: [false, []], claude: [false, []], gemini: [false, []] }),
]

test('groupScanSessions 依 20 分鐘間隔切場，最新在最前', () => {
  const sessions = groupScanSessions(responses)
  assert.equal(sessions.length, 2)
  assert.equal(sessions[0].responses.length, 5)   // 08-28 那批
  assert.equal(sessions[1].responses.length, 2)   // 08-20 那批
  assert.ok(new Date(sessions[0].endedAt) > new Date(sessions[1].endedAt))
})

test('沒有資料回 hasData:false，不產生空殼報告', () => {
  assert.equal(buildAivisReport({ brand, prompts, responses: [], now: NOW }).hasData, false)
  assert.equal(buildAivisReport().hasData, false)
})

test('矩陣只收 core 且啟用中的題，停用題與 brand/info 不進來', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  assert.equal(report.hasData, true)
  assert.deepEqual(report.latest.rows.map(r => r.promptId), ['c1', 'c2'])
})

test('每一格都帶分母：c1 的 ChatGPT 是 2 次觀測 2 次提到', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const c1 = report.latest.rows.find(r => r.promptId === 'c1')
  assert.equal(c1.engines.chatgpt.runs, 2)
  assert.equal(c1.engines.chatgpt.mentioned, 2)
  assert.equal(c1.engines.claude.mentioned, 0)
  assert.equal(c1.enginesMentioned, 1)
  assert.equal(c1.enginesWithData, 3)
})

test('總計只算 core：6 次觀測（c1 三引擎×2 輪 = 6）+ c2 三引擎×1 輪 = 9，命中 2', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  assert.equal(report.totals.observed, 9)
  assert.equal(report.totals.hit, 2)
  assert.equal(report.totals.rate, 22)
  assert.equal(report.totals.prompts, 2)
})

test('抓得到 AI 原話節錄，且節錄含品牌名', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const c1 = report.latest.rows.find(r => r.promptId === 'c1')
  assert.match(c1.engines.chatgpt.snippet, /金鉑先生車用品/)
})

test('沒提到的引擎不硬湊原話', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const c1 = report.latest.rows.find(r => r.promptId === 'c1')
  assert.equal(c1.engines.claude.snippet, '')
})

test('前後對照抓到上一場，且看得出 c1 從 0 個引擎變 1 個', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  assert.ok(report.previous)
  const prevC1 = report.previous.rows.find(r => r.promptId === 'c1')
  const nowC1 = report.latest.rows.find(r => r.promptId === 'c1')
  assert.equal(prevC1.enginesMentioned, 0)
  assert.equal(nowC1.enginesMentioned, 1)
})

test('只有一場掃描時 previous 為 null（不假裝有對照）', () => {
  const one = responses.filter(r => r.created_at.startsWith('2026-08-28'))
  assert.equal(buildAivisReport({ brand, prompts, responses: one, now: NOW }).previous, null)
})

test('來源歸因分引擎：ChatGPT 讀到官網、Claude 只讀 Mobile01', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const byEngine = Object.fromEntries(report.influence.byEngine.map(e => [e.engine, e]))
  assert.ok(byEngine.chatgpt.hosts.some(h => h.host === 'kimbo3899.com.tw' && h.isOwn))
  assert.equal(byEngine.chatgpt.ownAnswers, 2)
  assert.equal(byEngine.claude.ownAnswers, 0)
  assert.equal(byEngine.claude.hosts[0].host, 'mobile01.com')
})

test('Gemini 的 grounding 轉址網域被排除，不會混進來源名單', () => {
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const gemini = report.influence.byEngine.find(e => e.engine === 'gemini')
  assert.equal(gemini.hosts.some(h => h.host.includes('vertexaisearch')), false)
  assert.ok(gemini.hosts.some(h => h.host === 'facebook.com'))
})

test('來源歸因排除 info 題（知識題來源性質不同，混進去會誤導）', () => {
  // i9 只被 Claude 引用 mobile01；把 info 也算進去的話 claude 的 answers 會是 3
  const report = buildAivisReport({ brand, prompts, responses, now: NOW })
  const claude = report.influence.byEngine.find(e => e.engine === 'claude')
  assert.equal(claude.answers, 3)   // c1 兩輪 + c2 一輪，i9 不算
})

test('buildSourceInfluence 舊回傳鍵沒被破壞（儀表板仍在用）', () => {
  const out = buildSourceInfluence({ brand, responses, rangeDays: 90, now: NOW })
  assert.ok(Array.isArray(out.items))
  assert.equal(typeof out.answersWithSources, 'number')
  assert.equal(typeof out.totalHosts, 'number')
  assert.ok(out.categoryCounts)
  assert.ok(Array.isArray(out.byEngine))
})
