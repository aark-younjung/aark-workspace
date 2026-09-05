/**
 * Wayback（Archive.org）內容新鮮度佐證 —— 回答「這一頁實際上多久沒動過」
 *
 * 為什麼要有這個：
 *   我們的 lastmod 檢測讀的是網站「自己宣稱」的更新時間（article:modified_time、
 *   dateModified、<time>）。那個數字是可以造假的，而且常常不是故意的——很多 WordPress
 *   外掛每次載入就把 modified_time 寫成當下，於是每個頁面看起來都「今天剛更新」。
 *   拿那種數字跟客戶說「你的內容很新鮮」，是我們在幫他自我感覺良好。
 *
 * 做法：
 *   查 Archive.org 的 CDX API 拿這一頁的歷史快照，每筆帶一個內容雜湊（digest）。
 *   從最新一筆往回走，digest 一樣就代表內容沒變——第一次出現這個 digest 的時間，
 *   就是「內容最後一次真的改變」的時間。這是第三方留存的證據，不是網站的自我宣告。
 *
 * 誠實邊界（這幾條決定了它只能當佐證、不能計分）：
 *   1. Archive.org 對台灣中小企業網站的收錄很不平均，很多站根本沒被抓過。
 *      沒有資料只代表「查不到」，不代表網站有問題——所以這一項**不計分**。
 *   2. 頁面上的動態元素（廣告、時間戳、CSRF token）會讓每次快照的 digest 都不同，
 *      這種情況我們會低估「沒變」的長度。方向是安全的：會少講、不會誣賴。
 *   3. 快照數太少（< 3）時信心度標記為 low，UI 要照實說樣本不足。
 *   4. 掃描視窗只往回看固定筆數，如果整個視窗的 digest 都一樣，
 *      回報的是「至少從 X 起沒變」的下限，不是精確日期。
 */

const API_BASE = '/api/fetch-url'
const CDX_ENDPOINT = 'https://web.archive.org/cdx/search/cdx'
// 往回看幾筆快照。100 筆約 6KB，對熱門站約可回溯數年；撞到視窗邊界時回報下限而不是猜。
const WINDOW_LIMIT = 100
const MIN_SNAPSHOTS_FOR_VERDICT = 3
// 觸發「宣稱與實際不符」的門檻：宣稱 30 天內更新，但存檔期間內容至少半年沒動
const CLAIM_FRESH_DAYS = 30
const ACTUAL_STALE_DAYS = 180
// 最後一次存檔超過這麼久，就不拿它來反駁網站的宣稱——那段空窗期發生什麼事我們並不知道
const ARCHIVE_USABLE_DAYS = 120

// Archive.org 偶爾很慢。這是佐證資訊、不是掃描的必要條件——寧可放棄也不要拖長整趟掃描。
const WAYBACK_TIMEOUT_MS = 8000

const DAY_MS = 86_400_000

/** 判語裡要講清楚是「哪一段期間」沒變，不能讓人以為是到今天為止 */
function fmtDate(date) {
  return date instanceof Date ? date.toISOString().slice(0, 10) : '?'
}

/** CDX 的 timestamp 是 YYYYMMDDhhmmss（UTC） */
export function parseCdxTimestamp(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null
  const [, y, mo, d, h, mi, s] = match.map(Number)
  const time = Date.UTC(y, mo - 1, d, h, mi, s)
  return Number.isNaN(time) ? null : new Date(time)
}

/**
 * 解析 CDX 回傳的列。第一列是欄位名（output=json 的格式），其餘是資料。
 *
 * @param {Array<Array<string>>} rows
 * @param {Date} now
 * @returns {{archived:boolean, snapshotCount:number, lastSnapshot?:Date, lastSnapshotDays?:number,
 *            unchangedSince?:Date, unchangedDays?:number, atWindowEdge?:boolean, confidence?:'low'|'ok'}}
 */
export function parseWaybackRows(rows, now = new Date()) {
  if (!Array.isArray(rows) || rows.length === 0) return { archived: false, snapshotCount: 0 }

  // 丟掉表頭（第一列是 ['timestamp','digest'] 這種欄位名）與格式壞掉的列
  const data = rows
    .filter(row => Array.isArray(row) && row.length >= 2)
    .map(row => ({ time: parseCdxTimestamp(row[0]), digest: String(row[1] || '') }))
    .filter(row => row.time && row.digest)

  if (data.length === 0) return { archived: false, snapshotCount: 0 }

  // CDX 預設按時間正序，最後一筆是最新的
  const latest = data[data.length - 1]
  // 從最新往回走，digest 相同代表內容沒變
  let index = data.length - 1
  while (index > 0 && data[index - 1].digest === latest.digest) index -= 1

  const unchangedSince = data[index].time
  const atWindowEdge = index === 0 && data.length >= 2   // 整個視窗同一份內容 → 只能給下限

  return {
    archived: true,
    snapshotCount: data.length,
    lastSnapshot: latest.time,
    lastSnapshotDays: Math.floor((now.getTime() - latest.time.getTime()) / DAY_MS),
    unchangedSince,
    // ⚠️ 關鍵：用「最後一次存檔」減「內容變動時間」，不是用「現在」減。
    // 存檔停止之後的事我們沒有資料——把空窗期算成「確認沒變」是在講我們不知道的事。
    // （2026-09-05 用 a-ark.com.tw 真實資料抓到這個錯：最後存檔在 87 天前，
    //   舊算法會把那 87 天的空窗當成已確認沒變動。）
    observedUnchangedDays: Math.floor((latest.time.getTime() - unchangedSince.getTime()) / DAY_MS),
    // 目前這份內容被存檔過幾次。只有 1 次代表我們只看到一個時間點，
    // 說不出「持續多久沒變」——那種情況要閉嘴，不要生出「X 到 X 之間 0 天」這種廢話。
    currentVersionSnapshots: data.length - index,
    atWindowEdge,
    confidence: data.length < MIN_SNAPSHOTS_FOR_VERDICT ? 'low' : 'ok',
  }
}

/**
 * 把「網站宣稱的更新時間」跟「Archive.org 看到的實際變動」對起來。
 *
 * 只有在證據夠硬的時候才開口說不一致：快照數足夠、宣稱很新、實際很舊。
 * 反過來（宣稱很舊但實際有變）不報——那通常只是站方忘了更新 meta，不是欺騙，
 * 而且我們的 lastmod 檢測已經扣過分了，再講一次是重複懲罰。
 */
export function waybackVerdict({ claimedDaysSince = null, wayback = null } = {}) {
  if (!wayback?.archived) {
    return { kind: 'unarchived', message: 'Archive.org 沒有這一頁的存檔，無法佐證實際更新時間（不影響評分）' }
  }
  if (wayback.confidence === 'low') {
    return { kind: 'low_confidence', message: `Archive.org 只有 ${wayback.snapshotCount} 份存檔，樣本不足以判斷實際更新頻率` }
  }

  // 存檔太舊就不拿來反駁。我們只知道「到最後一次存檔為止」的事，
  // 之後客戶做了什麼我們沒有資料——用過期資料指控客戶說謊是最糟的錯。
  if (wayback.lastSnapshotDays > ARCHIVE_USABLE_DAYS) {
    return {
      kind: 'archive_outdated',
      message: `Archive.org 最後一次存檔是 ${wayback.lastSnapshotDays} 天前，這之後的變動沒有資料可以佐證`,
    }
  }

  // 目前版本只被存檔過一次 → 我們只有一個時間點，說不出「持續多久沒變」
  if ((wayback.currentVersionSnapshots ?? 2) <= 1) {
    return {
      kind: 'single_capture',
      message: `Archive.org 對目前這版內容只有一份存檔（${fmtDate(wayback.lastSnapshot)}），無法判斷內容持續多久沒有變動`,
    }
  }

  const bound = wayback.atWindowEdge ? '至少' : ''
  const span = `${fmtDate(wayback.unchangedSince)} 到 ${fmtDate(wayback.lastSnapshot)}`
  if (claimedDaysSince !== null && claimedDaysSince <= CLAIM_FRESH_DAYS && wayback.observedUnchangedDays >= ACTUAL_STALE_DAYS) {
    return {
      kind: 'claim_mismatch',
      message: `網站標示 ${claimedDaysSince} 天前更新，但 Archive.org 的存檔顯示 ${span} 之間（${bound} ${wayback.observedUnchangedDays} 天）內容沒有實質變動`
        + '——常見原因是 SEO 外掛每次載入都把更新時間寫成當下。AI 引用時看的是內容本身，不是這個標記。',
    }
  }
  return {
    kind: 'corroborated',
    message: `Archive.org 的存檔顯示 ${span} 之間（${bound} ${wayback.observedUnchangedDays} 天）內容沒有實質變動`,
  }
}

/**
 * 查一頁的 Wayback 新鮮度。走既有的 /api/fetch-url 代理（不另開 Vercel function）。
 * 任何失敗都回 { archived:false, unknown:true }——這是佐證資訊，不該讓掃描失敗。
 */
export async function checkWaybackFreshness(pageUrl, { now = new Date(), fetchImpl = fetch } = {}) {
  try {
    const cdxUrl = `${CDX_ENDPOINT}?url=${encodeURIComponent(pageUrl)}`
      + `&output=json&fl=timestamp,digest&filter=statuscode:200&limit=-${WINDOW_LIMIT}`
    const response = await fetchImpl(`${API_BASE}?url=${encodeURIComponent(cdxUrl)}`, {
      signal: AbortSignal.timeout(WAYBACK_TIMEOUT_MS),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success) return { archived: false, unknown: true }

    const body = String(payload.content || '').trim()
    if (!body) return { archived: false, snapshotCount: 0 }   // 沒有存檔時 CDX 回空字串
    return parseWaybackRows(JSON.parse(body), now)
  } catch {
    return { archived: false, unknown: true }
  }
}

/**
 * 把判語轉成 UI 提示（形狀與 lib/renderMode.js 的 renderModeNotice 一致）。
 *
 * 刻意只在「宣稱很新、實際很舊」時才開口——其他情況回 null 什麼都不顯示。
 * 「內容確實很久沒更新」這件事 lastmod 檢測已經講過了，這裡再講一次是重複囉嗦；
 * 這個提示唯一的獨特價值，是點出那個用戶自己看不到的落差。
 */
export function waybackNotice(verdict) {
  if (verdict?.kind !== 'claim_mismatch') return null
  return {
    tone: 'warn',
    title: '你的網站標示「最近更新」，但內容其實沒有變',
    lines: [
      verdict.message,
      '這不是你的錯——很多 SEO 外掛預設每次載入就把更新時間改成當下，看起來每頁都很新。',
      'AI 判斷內容新不新鮮時看的是內容本身，不是這個標記。要讓 AI 願意引用，得真的動內容（補新案例、新數據、新年度），改標記沒有用。',
    ],
  }
}
