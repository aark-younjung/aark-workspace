/**
 * 共用 aivis 掃描編排（2026-08-13 硬切前置 #3）
 * 從 AIVisibilityDashboard 的 runScan 抽出「四層題庫分流＋逐條打 /api/aivis/fetch」核心；
 * 額度攔截交給後端執法（fetch.js 會回明確錯誤），前端誠實顯示——不重複實作 Top-up 判斷。
 * 常數與 [AIVisibilityDashboard.jsx] 對齊；改動要兩邊同步（硬切收斂後只留這份）。
 */
export const PROMPT_CAP = 10                // 固定核心（core）啟用上限 — 趨勢基準不需太多題
export const SCAN_RUNS = 3                  // core / rotating 每條跑幾次取平均（brand/info 後端強制 1 次）
export const ROTATING_SAMPLE_PER_SCAN = 2   // 每次掃描從輪替池隨機抽幾條（抓盲點、防應試化）

/**
 * 四層題庫分流：決定這次掃描實際要送哪些題（與經典版 runScan 同邏輯）
 * core：啟用中的全送（固定樣本、趨勢基準）／rotating：隨機抽 N 條／brand、info：全送、每條 1 次
 */
export function buildScanTargets(prompts = []) {
  const tierOf = prompt => prompt.tier || 'core'
  const coreTargets = prompts.filter(prompt => tierOf(prompt) === 'core' && prompt.is_active)
  const rotatingPool = prompts.filter(prompt => tierOf(prompt) === 'rotating')
  const sampledRotating = [...rotatingPool].sort(() => Math.random() - 0.5).slice(0, ROTATING_SAMPLE_PER_SCAN)
  const brandTargets = prompts.filter(prompt => tierOf(prompt) === 'brand')
  const infoTargets = prompts.filter(prompt => tierOf(prompt) === 'info')
  return [
    ...coreTargets.map(prompt => ({ prompt, runs: SCAN_RUNS })),
    ...sampledRotating.map(prompt => ({ prompt, runs: SCAN_RUNS })),
    ...brandTargets.map(prompt => ({ prompt, runs: 1 })),
    ...infoTargets.map(prompt => ({ prompt, runs: 1 })),
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
