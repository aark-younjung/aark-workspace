import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateAiCrawlers, parseRobotsGroups, rootAccessFor, freshnessTier, evaluateSnippetDirectives } from './geoAnalyzer.js'

// 這兩條是 2026-09-04 重寫的起因：舊版解析器在這兩種 robots.txt 上會對客戶說錯話。
test('子目錄 Disallow 不算封鎖整站（舊版假陽性）', () => {
  const robots = [
    'User-agent: GPTBot',
    'Disallow: /wp-admin/',
    'Disallow: /cart',
  ].join('\n')
  const result = evaluateAiCrawlers(robots)
  assert.equal(result.passed, true)
  assert.deepEqual(result.blocked, [])
})

test('User-agent: * 通擋會擋到所有 AI 爬蟲（舊版假陰性）', () => {
  const result = evaluateAiCrawlers('User-agent: *\nDisallow: /')
  assert.equal(result.passed, false)
  // 使用者觸發型（chatgpt-user）依設計不遵守 robots.txt，不列入被封鎖
  assert.ok(result.blocked.includes('gptbot'))
  assert.ok(result.blocked.includes('claudebot'))
  assert.ok(result.blocked.includes('google-extended'))
  assert.ok(!result.blocked.includes('chatgpt-user'))
})

test('具名 group 優先於萬用 group', () => {
  const robots = ['User-agent: *', 'Disallow: /', '', 'User-agent: GPTBot', 'Disallow:'].join('\n')
  const result = evaluateAiCrawlers(robots)
  assert.ok(!result.blocked.includes('gptbot'))   // 具名區塊放行
  assert.ok(result.blocked.includes('claudebot')) // 沒具名的仍被 * 擋住
})

test('同路徑 Allow 勝過 Disallow', () => {
  const result = evaluateAiCrawlers('User-agent: GPTBot\nDisallow: /\nAllow: /')
  assert.ok(!result.blocked.includes('gptbot'))
})

test('只擋不計分的爬蟲不影響分數', () => {
  const result = evaluateAiCrawlers('User-agent: CCBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /')
  assert.equal(result.passed, true)              // 三引擎沒被擋 → 通過
  assert.deepEqual(result.blocked.sort(), ['ccbot', 'perplexitybot'])
  assert.deepEqual(result.scoredBlocked, [])     // 但仍誠實回報給客戶看
})

test('擋掉 OAI-SearchBot 會扣分（舊版完全沒查這隻）', () => {
  const result = evaluateAiCrawlers('User-agent: OAI-SearchBot\nDisallow: /')
  assert.equal(result.passed, false)
  assert.deepEqual(result.scoredBlocked, ['oai-searchbot'])
})

test('連續 User-agent 行共用同一組規則', () => {
  const groups = parseRobotsGroups('User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /')
  assert.equal(groups.length, 1)
  assert.deepEqual(groups[0].agents, ['gptbot', 'claudebot'])
  assert.equal(rootAccessFor(groups, 'gptbot').blocked, true)
  assert.equal(rootAccessFor(groups, 'claudebot').matchedBy, 'named')
})

test('註解與空白 robots.txt 不會誤判', () => {
  assert.equal(evaluateAiCrawlers('# 全部開放\n').passed, true)
  assert.equal(evaluateAiCrawlers('').passed, true)
  assert.equal(rootAccessFor(parseRobotsGroups(''), 'gptbot').matchedBy, 'none')
})

test('內容新鮮度分級對齊引用研究的門檻', () => {
  assert.equal(freshnessTier(10), 'fresh')
  assert.equal(freshnessTier(90), 'fresh')
  assert.equal(freshnessTier(120), 'recent')
  assert.equal(freshnessTier(200), 'aging')
  assert.equal(freshnessTier(400), 'stale')
  assert.equal(freshnessTier(null), 'unknown')
})

// ── AI 摘要抑制指令（2026-09-04）─────────────────────────────
// Google：沒有 AI 專屬 opt-out，AI Overviews / AI Mode 的露出由這些 preview 指令決定。
test('沒有任何 robots meta → 通過', () => {
  const r = evaluateSnippetDirectives([], 0)
  assert.equal(r.passed, true)
  assert.deepEqual(r.directives, [])
})

test('nosnippet 會擋掉整頁的 AI 摘要', () => {
  const r = evaluateSnippetDirectives(['index, follow, nosnippet'], 0)
  assert.equal(r.passed, false)
  assert.equal(r.nosnippet, true)
})

test('max-snippet:0 等於不給摘要，負數則是不限制', () => {
  assert.equal(evaluateSnippetDirectives(['max-snippet:0'], 0).passed, false)
  assert.equal(evaluateSnippetDirectives(['max-snippet:-1'], 0).passed, true)
  assert.equal(evaluateSnippetDirectives(['max-snippet:160'], 0).passed, true)
})

test('noindex 直接讓頁面沒有引用資格', () => {
  const r = evaluateSnippetDirectives(['noindex'], 0)
  assert.equal(r.passed, false)
  assert.equal(r.noindex, true)
})

test('none 同時等於 noindex 與 nosnippet', () => {
  const r = evaluateSnippetDirectives(['none'], 0)
  assert.equal(r.noindex, true)
  assert.equal(r.nosnippet, true)
})

test('大小寫與空白不影響判定', () => {
  const r = evaluateSnippetDirectives(['NOSNIPPET ,  MAX-SNIPPET : 0'], 0)
  assert.equal(r.passed, false)
  assert.ok(r.directives.includes('max-snippet:0'))
})

test('googlebot meta 與 robots meta 一起看', () => {
  assert.equal(evaluateSnippetDirectives(['index', 'nosnippet'], 0).passed, false)
})

test('data-nosnippet 只遮區塊、不影響整頁資格但要回報', () => {
  const r = evaluateSnippetDirectives(['index, follow'], 3)
  assert.equal(r.passed, true)
  assert.equal(r.dataNosnippetCount, 3)
  assert.ok(r.directives.some(d => d.startsWith('data-nosnippet')))
})
