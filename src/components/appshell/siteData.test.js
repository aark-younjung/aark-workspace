import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSiteCards, formatLastScan } from './siteData.js'

test('提供依 host 整理網站卡片資料的函式', () => {
  assert.equal(typeof buildSiteCards, 'function')
})

test('同網域不同頁與 www 變體只產生一張卡', () => {
  const cards = buildSiteCards({
    websites: [
      { id: 'home', name: '首頁', url: 'https://www.Example.com/', created_at: '2026-08-01T00:00:00Z' },
      { id: 'about', name: '關於', url: 'https://example.com/about?utm=1', created_at: '2026-08-02T00:00:00Z' },
      { id: 'other', name: '另一站', url: 'https://other.tw/', created_at: '2026-08-03T00:00:00Z' },
    ],
    brands: [],
    audits: {},
  })

  assert.equal(cards.length, 2)
  assert.deepEqual(cards.map(card => card.host).sort(), ['example.com', 'other.tw'])
  assert.equal(cards.find(card => card.host === 'example.com').pageCount, 2)
})

test('代表 website 優先採用已連結 aivis 品牌的 row 與品牌名', () => {
  const [card] = buildSiteCards({
    websites: [
      { id: 'home', name: '網站首頁', url: 'https://example.com', created_at: '2026-08-01T00:00:00Z' },
      { id: 'brand-page', name: '服務頁', url: 'https://example.com/services/seo', created_at: '2026-08-02T00:00:00Z' },
    ],
    brands: [{ id: 'brand-1', name: '方舟品牌', website_id: 'brand-page' }],
    audits: {},
  })

  assert.equal(card.websiteId, 'brand-page')
  assert.equal(card.name, '方舟品牌')
  assert.equal(card.aivisState, 'linked')
})

test('技術體質採同 host 四面向各自最新分數平均，掃描時間採全部 audit 最新一筆', () => {
  const [card] = buildSiteCards({
    websites: [
      { id: 'home', name: '首頁', url: 'https://example.com', created_at: '2026-08-01T00:00:00Z' },
      { id: 'page', name: '內頁', url: 'https://example.com/page', created_at: '2026-08-02T00:00:00Z' },
    ],
    brands: [],
    audits: {
      seo: [
        { website_id: 'home', score: 60, created_at: '2026-08-03T00:00:00Z' },
        { website_id: 'page', score: 80, created_at: '2026-08-06T00:00:00Z' },
      ],
      aeo: [{ website_id: 'home', score: 70, created_at: '2026-08-04T00:00:00Z' }],
      geo: [{ website_id: 'page', score: 90, created_at: '2026-08-05T00:00:00Z' }],
      eeat: [{ website_id: 'home', score: 60, created_at: '2026-08-07T00:00:00Z' }],
    },
  })

  assert.equal(card.technicalScore, 75)
  assert.equal(card.lastScannedAt, '2026-08-07T00:00:00Z')
})

test('四面向不完整時不把缺少資料當 0 分', () => {
  const [card] = buildSiteCards({
    websites: [{ id: 'home', name: '首頁', url: 'https://example.com' }],
    brands: [],
    audits: { seo: [{ website_id: 'home', score: 88, created_at: '2026-08-03T00:00:00Z' }] },
  })

  assert.equal(card.technicalScore, null)
  assert.equal(card.technicalReadyCount, 1)
})

test('最後掃描時間用台灣讀者可理解的相對時間，無資料時明確標示', () => {
  const now = new Date('2026-08-08T08:00:00Z')
  assert.equal(formatLastScan(null, now), '尚未掃描')
  assert.equal(formatLastScan('2026-08-08T06:00:00Z', now), '2 小時前')
  assert.equal(formatLastScan('2026-08-06T08:00:00Z', now), '2 天前')
})
