import assert from 'node:assert/strict'
import test from 'node:test'
import { HEALTH_TABS, buildHealthChecks, healthAuditKeys, resolveHealthTab } from './healthData.js'

test('提供網站體檢六分頁與 audit 轉換函式', () => {
  assert.deepEqual(HEALTH_TABS.map(tab => tab.key), ['seo', 'aeo', 'geo', 'eeat', 'crawl', 'schema'])
  assert.equal(typeof buildHealthChecks, 'function')
})

test('未知分頁回到 seo，crawl 與 schema 宣告其既有資料依賴', () => {
  assert.equal(resolveHealthTab('unknown'), 'seo')
  assert.equal(resolveHealthTab('geo'), 'geo')
  assert.deepEqual(healthAuditKeys('crawl'), ['seo', 'geo'])
  assert.deepEqual(healthAuditKeys('schema'), ['aeo', 'geo', 'eeat'])
})

test('SEO 沿用既有欄位判定並保留 H1 修復情境', () => {
  const checks = buildHealthChecks('seo', {
    seo: {
      meta_tags: { titleContent: '短標題', descriptionContent: '' },
      h1_structure: { h1Count: 0 },
      alt_tags: { totalImages: 2, imagesWithoutAlt: 1, altCoverage: 50 },
      mobile_compatible: { hasViewport: true },
      page_speed: { loadTime: 4200, speedGrade: '慢' },
    },
  })

  assert.equal(checks.find(check => check.id === 'meta_title').passed, false)
  assert.equal(checks.find(check => check.id === 'meta_desc').detail, '未設置 Meta 描述')
  assert.equal(checks.find(check => check.id === 'h1_structure').scenario, 'missing')
  assert.equal(checks.find(check => check.id === 'alt_tags').passed, false)
  assert.equal(checks.find(check => check.id === 'mobile_compatible').passed, true)
  assert.equal(checks.find(check => check.id === 'page_speed').passed, false)
})

test('SEO partial audit 不把未執行的頁面檢查誤判失敗', () => {
  const checks = buildHealthChecks('seo', {
    seo: { bot_accessibility: { blocked: true } },
  })

  assert.equal(checks.find(check => check.id === 'meta_title').passed, true)
  assert.match(checks.find(check => check.id === 'meta_title').detail, /此次未檢測/)
  assert.equal(checks.find(check => check.id === 'bot_accessibility').passed, false)
})

test('AEO FAQ 有視覺內容但缺 schema 時顯示精準說明', () => {
  const checks = buildHealthChecks('aeo', {
    aeo: { json_ld: true, faq_schema: false, faq_visual: true },
  })

  assert.equal(checks.find(check => check.id === 'json_ld').passed, true)
  assert.equal(checks.find(check => check.id === 'faq_schema').passed, false)
  assert.match(checks.find(check => check.id === 'faq_schema').detail, /有 FAQ 區塊.*缺 FAQPage schema/)
})

test('爬蟲與 Schema 分頁只組合現有 audit 的對應檢測', () => {
  const audits = {
    seo: { ssl_chain: { passed: true }, bot_accessibility: { blocked: false } },
    aeo: { json_ld: true, faq_schema: false, canonical: true, breadcrumbs: false, open_graph: true },
    geo: { robots_ai: true, sitemap: true, llms_txt: false, json_ld_citation: true },
    eeat: { organization_schema: true },
  }
  const crawl = buildHealthChecks('crawl', audits)
  const schema = buildHealthChecks('schema', audits)

  assert.deepEqual(crawl.map(check => check.id), ['bot_accessibility', 'ssl_chain', 'robots_ai', 'sitemap', 'llms_txt'])
  assert.deepEqual(schema.map(check => check.id), ['json_ld', 'faq_schema', 'canonical', 'breadcrumbs', 'open_graph', 'json_ld_citation', 'organization_schema'])
})
