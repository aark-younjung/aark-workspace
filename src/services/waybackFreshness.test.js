import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCdxTimestamp, parseWaybackRows, waybackVerdict, checkWaybackFreshness } from './waybackFreshness.js'

const NOW = new Date('2026-09-05T00:00:00Z')
// 真實 CDX 格式：第一列是欄位名、時間正序、最後一筆最新（2026-09-05 對 example.com 實測確認）
const header = ['timestamp', 'digest']

test('CDX 時間戳解析', () => {
  assert.equal(parseCdxTimestamp('20260904020732').toISOString(), '2026-09-04T02:07:32.000Z')
  assert.equal(parseCdxTimestamp('not-a-timestamp'), null)
  assert.equal(parseCdxTimestamp(''), null)
})

test('表頭列會被濾掉、不當成資料', () => {
  const r = parseWaybackRows([header, ['20260901000000', 'AAA']], NOW)
  assert.equal(r.snapshotCount, 1)
})

test('同一個 digest 往回走＝內容沒變的起點', () => {
  const rows = [
    header,
    ['20250101000000', 'OLD'],
    ['20250601000000', 'NEW'],   // 內容在這天改變
    ['20260101000000', 'NEW'],
    ['20260901000000', 'NEW'],   // 最新
  ]
  const r = parseWaybackRows(rows, NOW)
  assert.equal(r.archived, true)
  assert.equal(r.snapshotCount, 4)
  assert.equal(r.unchangedSince.toISOString(), '2025-06-01T00:00:00.000Z')
  // 觀察到的沒變期間 = 最後存檔 - 變動時間（2025-06-01 → 2026-09-01），不是算到今天
  assert.equal(r.observedUnchangedDays, 457)
  assert.equal(r.lastSnapshotDays, 4)
  assert.equal(r.atWindowEdge, false)
})

test('整個視窗都同一份內容 → 標記為下限而不是精確日期', () => {
  const rows = [header, ['20240101000000', 'SAME'], ['20250101000000', 'SAME'], ['20260101000000', 'SAME']]
  const r = parseWaybackRows(rows, NOW)
  assert.equal(r.atWindowEdge, true)
  assert.equal(r.unchangedSince.toISOString(), '2024-01-01T00:00:00.000Z')
})

test('沒有存檔（CDX 回空陣列）不算錯誤', () => {
  const r = parseWaybackRows([], NOW)
  assert.deepEqual(r, { archived: false, snapshotCount: 0 })
})

test('快照太少標記為低信心', () => {
  const r = parseWaybackRows([header, ['20260101000000', 'A'], ['20260201000000', 'B']], NOW)
  assert.equal(r.confidence, 'low')
  assert.equal(parseWaybackRows([header, ['20260101000000', 'A'], ['20260201000000', 'B'], ['20260301000000', 'C']], NOW).confidence, 'ok')
})

test('沒被存檔時不下判斷、且明說不影響評分', () => {
  const v = waybackVerdict({ claimedDaysSince: 3, wayback: { archived: false } })
  assert.equal(v.kind, 'unarchived')
  assert.match(v.message, /不影響評分/)
})

test('樣本不足時不下判斷', () => {
  const v = waybackVerdict({ claimedDaysSince: 3, wayback: { archived: true, confidence: 'low', snapshotCount: 2 } })
  assert.equal(v.kind, 'low_confidence')
})

const freshArchive = {
  archived: true, confidence: 'ok', snapshotCount: 20, atWindowEdge: false,
  lastSnapshotDays: 10, observedUnchangedDays: 700,
  unchangedSince: new Date('2024-10-01T00:00:00Z'), lastSnapshot: new Date('2026-08-26T00:00:00Z'),
}

test('宣稱剛更新但內容長期沒動 → 點出不一致', () => {
  const v = waybackVerdict({ claimedDaysSince: 2, wayback: freshArchive })
  assert.equal(v.kind, 'claim_mismatch')
  assert.match(v.message, /700 天/)
  assert.match(v.message, /外掛/)          // 要講出常見原因，不能只指控
  assert.match(v.message, /2024-10-01 到 2026-08-26/)  // 講清楚是哪一段期間，不能讓人以為是到今天
})

test('存檔太舊就不拿來反駁客戶——空窗期我們沒有資料', () => {
  const v = waybackVerdict({
    claimedDaysSince: 2,
    wayback: { ...freshArchive, lastSnapshotDays: 400 },
  })
  assert.equal(v.kind, 'archive_outdated')
  assert.match(v.message, /400 天前/)
})

test('宣稱舊、實際也舊 → 不重複懲罰，只做佐證', () => {
  const v = waybackVerdict({ claimedDaysSince: 900, wayback: freshArchive })
  assert.equal(v.kind, 'corroborated')
})

test('沒有 lastmod 可比時仍回報實際變動時間', () => {
  const v = waybackVerdict({ claimedDaysSince: null, wayback: { ...freshArchive, atWindowEdge: true } })
  assert.equal(v.kind, 'corroborated')
  assert.match(v.message, /至少/)   // 撞到視窗邊界要說「至少」
})

test('查詢成功：解析代理回傳的 CDX 原文', async () => {
  const fake = async () => ({
    ok: true,
    json: async () => ({ success: true, content: JSON.stringify([header, ['20260101000000', 'X'], ['20260201000000', 'X'], ['20260301000000', 'X']]) }),
  })
  const r = await checkWaybackFreshness('https://example.com', { now: NOW, fetchImpl: fake })
  assert.equal(r.archived, true)
  assert.equal(r.snapshotCount, 3)
})

test('查詢會走 /api/fetch-url 代理、並把 CDX 網址正確編碼', async () => {
  let called = ''
  const fake = async url => { called = url; return { ok: true, json: async () => ({ success: true, content: '[]' }) } }
  await checkWaybackFreshness('https://example.com/a?b=1', { now: NOW, fetchImpl: fake })
  assert.ok(called.startsWith('/api/fetch-url?url='))
  const inner = decodeURIComponent(called.split('?url=')[1])
  assert.ok(inner.startsWith('https://web.archive.org/cdx/search/cdx?'))
  assert.ok(inner.includes(encodeURIComponent('https://example.com/a?b=1')))
})

test('沒存檔的網域回空陣列 → archived:false，不是錯誤', async () => {
  const fake = async () => ({ ok: true, json: async () => ({ success: true, content: '[]' }) })
  const r = await checkWaybackFreshness('https://nope.tw', { now: NOW, fetchImpl: fake })
  assert.deepEqual(r, { archived: false, snapshotCount: 0 })
})

test('代理失敗 / 壞掉的 JSON 都回 unknown，不讓掃描失敗', async () => {
  const fail = async () => ({ ok: false, json: async () => ({ error: 'boom' }) })
  assert.deepEqual(await checkWaybackFreshness('https://x.tw', { fetchImpl: fail }), { archived: false, unknown: true })

  const garbage = async () => ({ ok: true, json: async () => ({ success: true, content: '<html>not json</html>' }) })
  assert.deepEqual(await checkWaybackFreshness('https://x.tw', { fetchImpl: garbage }), { archived: false, unknown: true })

  const throws = async () => { throw new Error('network down') }
  assert.deepEqual(await checkWaybackFreshness('https://x.tw', { fetchImpl: throws }), { archived: false, unknown: true })
})

test('目前版本只有一份存檔 → 不生出「X 到 X 之間 0 天」這種廢話', () => {
  // a-ark.com.tw 2026-09-05 實測就是這個情況：最後一筆的 digest 跟前一筆不同
  const v = waybackVerdict({
    claimedDaysSince: 2,
    wayback: {
      archived: true, confidence: 'ok', snapshotCount: 28, lastSnapshotDays: 87,
      currentVersionSnapshots: 1, observedUnchangedDays: 0,
      unchangedSince: new Date('2026-06-09T00:00:00Z'), lastSnapshot: new Date('2026-06-09T00:00:00Z'),
    },
  })
  assert.equal(v.kind, 'single_capture')
  assert.match(v.message, /無法判斷/)
})

test('parseWaybackRows 會算出目前版本的存檔次數', () => {
  const rows = [header, ['20250101000000', 'A'], ['20260101000000', 'B'], ['20260601000000', 'B']]
  assert.equal(parseWaybackRows(rows, NOW).currentVersionSnapshots, 2)
  assert.equal(parseWaybackRows([header, ['20260601000000', 'Z']], NOW).currentVersionSnapshots, 1)
})
