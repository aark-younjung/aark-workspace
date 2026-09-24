/**
 * 共用 aivis 掃描編排（2026-08-13 硬切前置 #3）
 * 從 AIVisibilityDashboard 的 runScan 抽出「四層題庫分流＋逐條打 /api/aivis/fetch」核心；
 * 額度攔截交給後端執法（fetch.js 會回明確錯誤），前端誠實顯示——不重複實作 Top-up 判斷。
 * 常數與 [AIVisibilityDashboard.jsx] 對齊；改動要兩邊同步（硬切收斂後只留這份）。
 */
// 固定核心（core）啟用上限 — 趨勢基準不需太多題。
// ⚠️ 想改這個數字的話，光改 JS 沒有用：DB 端有 plpgsql trigger 在強制同一個上限
//    （WORKLOG 2026-04「aivis-prompt-limit.sql」，SQL 檔照慣例已刪），沒同步改的話
//    使用者啟用第 11 條會被資料庫 check_violation 打回、前端跳「切換失敗」。
//    另外成本會連動：單次掃描的核心題額度 = 本數字 × SCAN_RUNS。
//    2026-09-23 曾短暫改成 15，評估過 DB 工與額度成本後改回 10。
//    同名常數在 AIVisibilityDashboard.jsx 也有一份，要兩邊同步。
export const PROMPT_CAP = 10
export const SCAN_RUNS = 3                  // core / rotating 每條跑幾次取平均（brand/info 後端強制 1 次）
export const ROTATING_SAMPLE_PER_SCAN = 2   // 每次掃描從輪替池隨機抽幾條（抓盲點、防應試化）

/**
 * 題庫分流：決定這次掃描實際要送哪些題（與經典版 runScan 同邏輯）
 * core：啟用中的全送（固定樣本、趨勢基準）／rotating：隨機抽 N 條／
 * brand、info、competitor：全送、每條 1 次
 *
 * 2026-09-04 加入 competitor（競品詞）。它跟 brand 一樣不進頭條曝光率——
 * 曝光率的分母是 core，見 aivisData.js 的 aggregateTier。
 */
export function buildScanTargets(prompts = []) {
  const tierOf = prompt => prompt.tier || 'core'
  const coreTargets = prompts.filter(prompt => tierOf(prompt) === 'core' && prompt.is_active)
  const rotatingPool = prompts.filter(prompt => tierOf(prompt) === 'rotating')
  const sampledRotating = [...rotatingPool].sort(() => Math.random() - 0.5).slice(0, ROTATING_SAMPLE_PER_SCAN)
  const brandTargets = prompts.filter(prompt => tierOf(prompt) === 'brand')
  const infoTargets = prompts.filter(prompt => tierOf(prompt) === 'info')
  const competitorTargets = prompts.filter(prompt => tierOf(prompt) === 'competitor')
  return [
    ...coreTargets.map(prompt => ({ prompt, runs: SCAN_RUNS })),
    ...sampledRotating.map(prompt => ({ prompt, runs: SCAN_RUNS })),
    ...brandTargets.map(prompt => ({ prompt, runs: 1 })),
    ...infoTargets.map(prompt => ({ prompt, runs: 1 })),
    ...competitorTargets.map(prompt => ({ prompt, runs: 1 })),
  ]
}

/**
 * 逐條執行掃描。onProgress(done, total) 給進度 UI；任何一條失敗即丟出（附後端訊息，額度不足也在此）。
 * @returns {{ mentioned, runs, rate }} 本次合計（僅供完成 toast；正式數據以重載後 DB 為準）
 */
export async function runAivisScan({ prompts, onProgress }) {
  const targets = buildScanTargets(prompts)
  if (!targets.length) throw new Error('沒有可掃描的題目——請先啟用至少一條核心題')

  let mentioned = 0
  let runs = 0
  for (let index = 0; index < targets.length; index += 1) {
    const { prompt, runs: promptRuns } = targets[index]
    onProgress?.(index + 1, targets.length)
    const response = await fetch(`/api/aivis/fetch?prompt_id=${prompt.id}&runs=${promptRuns}`, { method: 'POST' })
    const json = await response.json()
    if (!response.ok || !json.success) {
      throw new Error([json.error, json.detail, json.message].filter(Boolean).join(' — ') || '掃描失敗')
    }
    mentioned += json.mentioned_count || 0
    runs += json.runs || 0
  }
  return { mentioned, runs, rate: runs ? Math.round(mentioned / runs * 100) : 0 }
}

/**
 * 重新產生題庫（2026-09-24 從經典版抽出來共用）
 *
 * 經典版與新版 app-shell 都要能重生，而「撞到啟用上限要問使用者」這段邏輯不該寫兩份 ——
 * 一份改了另一份沒改，使用者看到的行為就會隨著他從哪個畫面進來而不同。
 * 這裡只負責打 API 並把結果分類；確認框長什麼樣、toast 怎麼顯示留給各自的 UI。
 *
 * 回傳 { kind: 'ok' | 'cap' | 'error', ... }：
 *   ok    → generated（新題數）
 *   cap   → 撞到核心題啟用上限，info 帶 cap / active_core / user_authored / need / room / detail，
 *           UI 問過使用者之後用 replaceUser: true 再呼叫一次
 *   error → message（已把 error 與 detail 串好，detail 才是真正的原因）
 */
export async function regenerateAivisPrompts({ supabase, brandId, replaceUser = false }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { kind: 'error', message: '請先登入' }

  const url = `/api/aivis/generate-prompts?brand_id=${brandId}${replaceUser ? '&replace_user=true' : ''}`
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  const json = await response.json().catch(() => ({}))

  if (response.status === 409 && json?.error === 'prompt_cap_would_exceed') {
    return { kind: 'cap', info: json }
  }
  if (!response.ok || !json.success) {
    return {
      kind: 'error',
      message: [json.error, json.detail].filter(Boolean).join(' — ') || '產生失敗',
    }
  }
  return { kind: 'ok', generated: json.generated_count }
}

/**
 * 撞到上限時要對使用者說的話（兩個畫面共用，避免講法不一致）。
 * 刻意把數字念出來 —— 「滿了」不是資訊，「差幾條、其中幾條是你自己編的」才是。
 * 也刻意強調「停用不是刪除」，那是使用者最怕的事。
 */
export function capConfirmText(info = {}) {
  const head = info.detail || '核心題的啟用數已達上限。'
  const body = info.user_authored > 0
    ? `要連那 ${info.user_authored} 條手動編輯過的題一起停用嗎？
`
      + '（是停用不是刪除 —— 題目和歷史回答都留著，之後隨時可以開回來）'
    : '要先停用目前啟用中的核心題，再寫入新題嗎？'
  return `${head}

${body}`
}
