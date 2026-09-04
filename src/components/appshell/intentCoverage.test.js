import assert from 'node:assert/strict'
import test from 'node:test'
import { INTENT_META, inferPromptIntent, buildIntentCoverage } from './aivisData.js'

const ctx = { brandName: '青山空間設計', competitors: ['雅司設計', '木耳設計'] }

test('已存的 intent 直接採用、不標記推測', () => {
  const r = inferPromptIntent({ text: '隨便什麼題', tier: 'core', intent: 'painpoint' }, ctx)
  assert.deepEqual(r, { intent: 'painpoint', inferred: false })
})

test('無效的 intent 值會退回推測，不會污染分類', () => {
  const r = inferPromptIntent({ text: '台北室內設計推薦哪一家？', tier: 'core', intent: 'garbage' }, ctx)
  assert.equal(r.intent, 'decision')
  assert.equal(r.inferred, true)
})

test('競品名稱優先於自家品牌名', () => {
  // 同時提到兩家時，這題問的是「比較」這件事
  const r = inferPromptIntent({ text: '青山空間設計跟雅司設計哪個好？', tier: 'core' }, ctx)
  assert.equal(r.intent, 'competitor')
})

test('brand tier 或內文含品牌名 → 品牌詞', () => {
  assert.equal(inferPromptIntent({ text: '評價如何？', tier: 'brand' }, ctx).intent, 'brand')
  assert.equal(inferPromptIntent({ text: '青山空間設計有做商空嗎？', tier: 'core' }, ctx).intent, 'brand')
})

test('info tier 直接算資訊詞', () => {
  assert.equal(inferPromptIntent({ text: '無關文字', tier: 'info' }, ctx).intent, 'info')
})

test('決策詞優先於資訊詞（「如何選」問的是決策）', () => {
  assert.equal(inferPromptIntent({ text: '台中室內設計費用大概多少？', tier: 'core' }, ctx).intent, 'decision')
  assert.equal(inferPromptIntent({ text: '室內設計公司推薦哪一間？', tier: 'core' }, ctx).intent, 'decision')
})

test('痛點詞辨識', () => {
  assert.equal(inferPromptIntent({ text: '老屋漏水一直修不好怎麼辦？', tier: 'rotating' }, ctx).intent, 'painpoint')
})

test('純知識問句 → 資訊詞', () => {
  assert.equal(inferPromptIntent({ text: '裝潢工期通常要多久？', tier: 'rotating' }, ctx).intent, 'info')
})

test('都沒命中 → 品類服務詞', () => {
  assert.equal(inferPromptIntent({ text: '台南商業空間設計公司', tier: 'core' }, ctx).intent, 'category')
})

test('覆蓋率統計整個題庫、不只算啟用中的題', () => {
  const prompts = [
    { text: '台南商業空間設計公司', tier: 'core', is_active: true },
    { text: '室內設計推薦哪一間？', tier: 'rotating', is_active: false },   // 池子題也要算
    { text: '評價如何？', tier: 'brand', is_active: false },
    { text: '裝潢工期通常要多久？', tier: 'info', is_active: false },
  ]
  const c = buildIntentCoverage({ prompts, ...ctx })
  assert.equal(c.total, 4)
  const byKey = Object.fromEntries(c.byIntent.map(i => [i.key, i.count]))
  assert.deepEqual(byKey, { brand: 1, competitor: 0, decision: 1, category: 1, painpoint: 0, info: 1 })
})

test('沒有競品題時，競品詞會列為盲區並附上該做什麼', () => {
  const c = buildIntentCoverage({ prompts: [{ text: '台南裝潢公司', tier: 'core' }], ...ctx })
  const keys = c.blindSpots.map(b => b.key)
  assert.ok(keys.includes('competitor'))
  const competitor = c.blindSpots.find(b => b.key === 'competitor')
  assert.ok(competitor.blindSpotHint.length > 0)
  assert.equal(c.coveredCount, 1)
  assert.equal(c.intentCount, INTENT_META.length)
})

test('舊題庫（沒有 intent 欄位）全部標記為推測', () => {
  const prompts = [{ text: '台南裝潢公司', tier: 'core' }, { text: '評價如何？', tier: 'brand' }]
  const c = buildIntentCoverage({ prompts, ...ctx })
  assert.equal(c.inferredCount, 2)
  assert.equal(c.inferredRatio, 100)
})

test('空題庫不炸、不出現 NaN', () => {
  const c = buildIntentCoverage({ prompts: [] })
  assert.equal(c.total, 0)
  assert.equal(c.inferredRatio, 0)
  assert.ok(c.byIntent.every(i => i.share === 0 && i.count === 0))
  assert.equal(c.blindSpots.length, INTENT_META.length)
})

test('沒設觀察名單時不會誤判競品詞', () => {
  const r = inferPromptIntent({ text: '雅司設計評價如何？', tier: 'core' }, { brandName: '青山空間設計', competitors: [] })
  assert.equal(r.intent, 'decision')   // 沒有名單就只能看字面，落到決策詞
})
