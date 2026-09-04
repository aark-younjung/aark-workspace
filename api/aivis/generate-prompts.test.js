import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTieredJson } from './generate-prompts.js'

// LLM 的輸出格式不能當成保證——這裡把三種會真的出現的形狀都釘住。
test('正式格式：{q, intent} 物件', () => {
  const r = parseTieredJson(JSON.stringify({
    core: [{ q: '台南裝潢推薦哪一家？', intent: 'decision' }],
    rotating: [{ q: '老屋翻新一直找不到人怎麼辦？', intent: 'painpoint' }],
    brand: [{ q: '青山空間設計評價？', intent: 'brand' }],
    info: [{ q: '裝潢工期多久？', intent: 'info' }],
    competitor: [{ q: '青山跟雅司哪個好？', intent: 'competitor' }],
  }))
  assert.equal(r.core[0].text, '台南裝潢推薦哪一家？')
  assert.equal(r.core[0].intent, 'decision')
  assert.equal(r.competitor.length, 1)
})

test('舊格式：純字串陣列 → intent 留 null 交給讀取端推測', () => {
  const r = parseTieredJson(JSON.stringify({ core: ['台南裝潢公司？'], rotating: [], brand: [], info: [] }))
  assert.deepEqual(r.core, [{ text: '台南裝潢公司？', intent: null }])
  assert.deepEqual(r.competitor, [])
})

test('更舊的單層格式 { prompts: [...] } 整批當 core', () => {
  const r = parseTieredJson(JSON.stringify({ prompts: ['A？', 'B？'] }))
  assert.equal(r.core.length, 2)
  assert.equal(r.core[0].intent, null)
})

test('無效的 intent 值被丟掉、不寫進 DB 污染分類', () => {
  const r = parseTieredJson(JSON.stringify({ core: [{ q: 'X？', intent: '亂寫的' }] }))
  assert.equal(r.core[0].intent, null)
})

test('包在 markdown code fence 裡也要解得出來', () => {
  const raw = '```json\n{"core":[{"q":"A？","intent":"category"}]}\n```'
  assert.equal(parseTieredJson(raw).core[0].intent, 'category')
})

test('前後多寫說明文字仍抓得到 JSON', () => {
  const raw = '好的，以下是題庫：\n{"core":["A？"]}\n希望對你有幫助！'
  assert.equal(parseTieredJson(raw).core.length, 1)
})

test('空字串題目被濾掉', () => {
  const r = parseTieredJson(JSON.stringify({ core: [{ q: '   ', intent: 'decision' }, 'B？'] }))
  assert.equal(r.core.length, 1)
  assert.equal(r.core[0].text, 'B？')
})

test('不是 JSON 就回 null，不要吐半殘的結果', () => {
  assert.equal(parseTieredJson('抱歉我無法完成這個請求'), null)
  assert.equal(parseTieredJson('{壞掉的 json'), null)
})
