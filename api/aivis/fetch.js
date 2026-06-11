/**
 * POST /api/aivis/fetch
 * 對指定的 prompt 呼叫 Claude Haiku N 次（預設 3 次），
 * 寫入 aivis_responses，並偵測品牌提及寫入 aivis_mentions。
 *
 * Body / Query:
 *   prompt_id   (必填) 要執行的 prompt UUID
 *   runs        (選填) 重複次數，預設 3，上限 5
 *
 * Env:
 *   ANTHROPIC_API_KEY          — Anthropic Console 申請的 API key
 *   SUPABASE_URL               — Supabase 專案 URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role（後端用，繞過 RLS）
 *
 * 注意：Phase 2 為驗證後端串接，暫未加用戶認證；
 *       Phase 2c 串前端時會改要求 Supabase Bearer token。
 */

import { createClient } from '@supabase/supabase-js'
import { isTestEmail } from '../_lib/test-detect.js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

// Haiku 4.5 定價（USD / token）
const PRICE_INPUT_PER_TOKEN = 1 / 1_000_000   // $1 / MTok
const PRICE_OUTPUT_PER_TOKEN = 5 / 1_000_000  // $5 / MTok

// ─── Gemini 整合（2026-06-10 加；2026-06-11 換模型；2026-06-11 加 Google Search 接地） ───
// 跨 LLM 覆蓋率 + 接地：每條 prompt 的第 1 次 run 打 Gemini（同時 Claude），存進同筆 row 的 engine_results。
// 接地（grounding）：請求帶 tools:[{google_search:{}}]，讓 Gemini 即時上網查 → 答案貼近用戶在
//   Gemini App 看到的（當前資料 + 引用來源），不再只靠訓練知識。回傳 groundingMetadata 帶來源。
//   這才是 aivis 的核心價值：客戶優化網站後，接地版分數才會動（純訓練知識幾乎不變）。
// 模型：gemini-2.5-flash（GA、支援接地；flash-lite 不一定支援）。1M context。
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const GEMINI_PRICE_INPUT_PER_TOKEN = 0.30 / 1_000_000    // $0.30 / MTok（gemini-2.5-flash）
const GEMINI_PRICE_OUTPUT_PER_TOKEN = 2.50 / 1_000_000   // $2.50 / MTok（gemini-2.5-flash）
// 接地搜尋計費：Gemini 2.5 = $35 / 1,000 次（每天前 1,500 次免費；此處按全額記帳給成本可見度）
const GEMINI_GROUNDING_PRICE_PER_SEARCH = 35 / 1_000

// 額度規則 — 與 [Pricing.jsx] 與 [AIVisibilityDashboard.jsx] 三邊同步
const AIVIS_QUOTA_PER_MONTH = 150   // Pro 內含本月免費額度
const AIVIS_HARD_CAP = 1000          // 每月查詢硬上限（內含 + Top-up 合計），Agency 推出後解除
// 7 天試用期：總額度 50 次（不是每月，是整個 7 天試用期內合計），不可用 Top-up 加購
// 設 50 而非更多是防止 bot 註冊試用帳號刷大量 AI 掃描；正常用戶 7 天試 50 次足夠評估產品
const AIVIS_QUOTA_PER_TRIAL = 50

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // 為了 curl 測試方便，GET / POST 都吃
  const promptId = req.query.prompt_id || req.body?.prompt_id
  const runs = Math.min(Number(req.query.runs || req.body?.runs || 3), 5)

  if (!promptId) {
    return res.status(400).json({ error: 'prompt_id is required' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  // Gemini 為「選用」— 沒設 GEMINI_API_KEY 就只跑 Claude（向下相容）
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  const useGemini = !!GEMINI_API_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 取 prompt + brand 名稱
    const { data: prompt, error: promptErr } = await supabase
      .from('aivis_prompts')
      .select('id, user_id, brand_id, text, is_active, aivis_brands(name, domain)')
      .eq('id', promptId)
      .single()

    if (promptErr || !prompt) {
      return res.status(404).json({ error: 'Prompt not found', detail: promptErr?.message })
    }
    if (!prompt.is_active) {
      return res.status(400).json({ error: 'Prompt is disabled' })
    }

    const brandName = prompt.aivis_brands?.name
    if (!brandName) {
      return res.status(400).json({ error: 'Brand not linked to this prompt' })
    }

    // 拉用戶 profile 看是否為試用用戶 — 試用期額度與付費 Pro 不同（50 vs 150）
    // 試用期計算起始也不一樣：付費 Pro 用 calendar month，試用用 trial_started_at
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_pro, is_trial, trial_started_at, email')
      .eq('id', prompt.user_id)
      .maybeSingle()

    if (profileErr) {
      return res.status(500).json({ error: 'Failed to fetch profile', detail: profileErr.message })
    }

    // 測試帳號（email 在 TEST_EMAILS 名單內）→ aivis 額度無上限、且免 Pro 守衛。
    // 給內部 QA / 自己壓測用，不影響真實付費客戶。新增測試帳號只要把 email 加進 TEST_EMAILS env。
    const isTestAccount = isTestEmail(profile?.email)

    // 守衛：aivis 是 Pro 專屬功能；非 Pro 且非試用 → 403 拒絕（測試帳號豁免）
    // 防免費用戶（含 curl/Postman 繞 UI）直接戳 API 刷 AI 額度，造成商業模式失效 + 燒 Claude API 成本
    const isTrial = !!profile?.is_trial && !!profile?.trial_started_at
    if (!profile?.is_pro && !isTrial && !isTestAccount) {
      return res.status(403).json({ error: 'AI 曝光監測為 Pro 功能，請先升級或啟用 7 天免費試用' })
    }

    const quotaLimit = isTrial ? AIVIS_QUOTA_PER_TRIAL : AIVIS_QUOTA_PER_MONTH
    // 試用期硬上限 = quota（不開放 Top-up），付費 Pro 硬上限 = 1000；測試帳號 = 無上限（Infinity）
    const hardCap = isTestAccount ? Infinity : (isTrial ? AIVIS_QUOTA_PER_TRIAL : AIVIS_HARD_CAP)

    // 計數起始：試用期從 trial_started_at 起算（整個 7 天試用期合計），付費 Pro 從本月 1 日 UTC 起算
    let countSinceIso
    if (isTrial) {
      countSinceIso = profile.trial_started_at
    } else {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)
      countSinceIso = monthStart.toISOString()
    }

    // 額度 = aivis_responses 筆數（1 次掃描 1 筆、Gemini 結果存同筆的額外欄、不另開 row、不影響計數）
    const { count: monthCountRaw, error: countErr } = await supabase
      .from('aivis_responses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', prompt.user_id)
      .gte('created_at', countSinceIso)

    if (countErr) {
      return res.status(500).json({ error: 'Failed to check monthly quota', detail: countErr.message })
    }
    const monthCount = monthCountRaw || 0

    // 已達硬上限 → 直接拒絕（連 1 次都不能跑）
    if (monthCount >= hardCap) {
      return res.status(429).json({
        error: isTrial ? 'trial_quota_exhausted' : 'monthly_hard_cap_exceeded',
        message: isTrial
          ? `試用期 AI 曝光監測額度 ${AIVIS_QUOTA_PER_TRIAL} 次已用完，升級 Pro 訂閱即可恢復每月 150 次`
          : `本月查詢已達硬上限 ${AIVIS_HARD_CAP} 次，請等下個月或聯繫 Agency 方案`,
        used: monthCount,
        hard_cap: hardCap,
        is_trial: isTrial,
      })
    }

    const results = []
    let usedThisCall = 0           // 本次呼叫實際成功寫入幾筆，遞增後與 monthCount 合計判斷
    let topupConsumedThisCall = 0  // 本次呼叫從 Top-up 扣了幾次（給 client 顯示明細用）
    // 2026-06-10 Gemini 診斷：追蹤後端到底有沒有讀到 key / 呼叫成功 / 錯誤
    // 2026-06-11：geminiQuotaExhausted — 429/配額耗盡單獨標記，前端顯示專屬提示
    let geminiAttempts = 0, geminiOkCount = 0, geminiLastError = null, geminiQuotaExhausted = false

    for (let i = 1; i <= runs; i++) {
      // 額度判斷（per-run，每次跑前先看下一筆會不會破線）
      const wouldBeNthQuery = monthCount + usedThisCall + 1

      // 破硬上限 → 中斷 loop（不能再跑，回傳已完成數）
      // 試用用戶：hardCap = quota = 50，沒有 Top-up 路徑可走
      if (wouldBeNthQuery > hardCap) {
        return res.status(429).json({
          error: isTrial ? 'trial_quota_exhausted' : 'monthly_hard_cap_exceeded',
          message: isTrial
            ? `試用期 AI 曝光監測額度 ${AIVIS_QUOTA_PER_TRIAL} 次即將用完，已完成 ${i - 1} / ${runs} 次，升級 Pro 訂閱即可恢復每月 150 次`
            : `本月查詢即將達硬上限 ${AIVIS_HARD_CAP} 次，已完成 ${i - 1} / ${runs} 次`,
          completed_runs: i - 1,
          used: monthCount + usedThisCall,
          hard_cap: hardCap,
          is_trial: isTrial,
        })
      }

      // 已用完內含額度 → 嘗試從 Top-up 扣 1 次（試用用戶 + 測試帳號跳過此路徑）
      if (!isTrial && !isTestAccount && wouldBeNthQuery > AIVIS_QUOTA_PER_MONTH) {
        const { data: consumed, error: consumeErr } = await supabase
          .rpc('aivis_consume_topup_credit', { p_user_id: prompt.user_id })

        if (consumeErr) {
          return res.status(500).json({
            error: 'Failed to consume topup credit',
            detail: consumeErr.message,
            completed_runs: i - 1,
          })
        }

        // RPC 回 false = 沒可用 Top-up credit → 拒絕
        if (consumed !== true) {
          return res.status(429).json({
            error: 'monthly_quota_exhausted',
            message: `本月內含 ${AIVIS_QUOTA_PER_MONTH} 次已用完且無 Top-up 餘額，已完成 ${i - 1} / ${runs} 次`,
            completed_runs: i - 1,
            used: monthCount + usedThisCall,
            quota_per_month: AIVIS_QUOTA_PER_MONTH,
          })
        }
        topupConsumedThisCall += 1
      }

      // 2026-06-10：Claude + Gemini 並行呼叫、單寫一筆 row（Claude 主欄 + Gemini 額外欄）
      // 設計：1 次掃描 = 1 筆 aivis_responses（維持「1 row = 1 scan」不變、dashboard / 額度全部沿用）
      //   Claude 失敗 → 整個 run 視為失敗、不扣 quota（主引擎）
      //   Gemini 失敗 → 只記 console、engine_results.gemini 不寫（額外資料、不影響 run）
      // 2026-06-11：Gemini 每條 prompt 只問 1 次（i===1）省 ⅔ 免費配額 —
      //   Gemini 是次要引擎、要的是「有沒有被提到」的訊號、不像 Claude 要跑 3 次取平均。
      const shouldCallGemini = useGemini && i === 1
      const [claudeRes, geminiRes] = await Promise.all([
        callClaude(prompt.text, ANTHROPIC_API_KEY),
        shouldCallGemini ? callGemini(prompt.text, GEMINI_API_KEY) : Promise.resolve(null),
      ])

      if (!claudeRes.ok) {
        return res.status(502).json({
          error: 'Claude API error',
          detail: claudeRes.error,
          completedRuns: i - 1,
        })
      }

      // ─── Claude 結果（主、寫既有欄位、扣 quota） ───
      const claudeCost = claudeRes.inputTokens * PRICE_INPUT_PER_TOKEN + claudeRes.outputTokens * PRICE_OUTPUT_PER_TOKEN
      const claudeMentioned = detectMention(claudeRes.text, brandName)
      const claudePosition = claudeMentioned ? findListPosition(claudeRes.text, brandName) : null
      const claudeContext = claudeMentioned ? extractContext(claudeRes.text, brandName) : null

      // ─── Gemini 結果（額外引擎、已接地） ───
      let geminiMentioned = null
      let geminiCost = 0
      let geminiPosition = null
      let geminiText = null
      let geminiSources = null
      if (shouldCallGemini) geminiAttempts += 1
      if (geminiRes && geminiRes.ok) {
        geminiOkCount += 1
        // 成本 = token + 接地搜尋（每次搜尋約 $0.035）
        geminiCost = geminiRes.inputTokens * GEMINI_PRICE_INPUT_PER_TOKEN
          + geminiRes.outputTokens * GEMINI_PRICE_OUTPUT_PER_TOKEN
          + (geminiRes.searchCount || 0) * GEMINI_GROUNDING_PRICE_PER_SEARCH
        geminiMentioned = detectMention(geminiRes.text, brandName)
        geminiPosition = geminiMentioned ? findListPosition(geminiRes.text, brandName) : null
        geminiText = geminiRes.text
        geminiSources = geminiRes.sources || []
      } else if (geminiRes && !geminiRes.ok) {
        geminiLastError = geminiRes.error
        // 429 / 配額耗盡單獨標記 — 前端 toast 顯示「配額用完」而非泛泛「呼叫失敗」
        if (geminiRes.status === 429 || /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(geminiRes.error || '')) {
          geminiQuotaExhausted = true
        }
        console.warn(`Gemini call failed for run ${i}:`, geminiRes.error)
      }

      // ─── engine_results JSONB（2026-06-10 路線 B：可擴充 N 引擎） ───
      // 1 row = 1 scan、所有引擎結果存同一筆的 engine_results。之後加 ChatGPT/Perplexity
      // 只要在這多塞一個 key、dashboard 自動列出、不用改 schema 也不用改 UI。
      //   結構：{ <engine>: { mentioned, position, cost_usd, raw } }
      // 主欄（model / raw_response / brand_mentioned / cost_usd）仍寫 Claude — 給額度計數、
      // mention 表、舊資料相容用（Claude = 主引擎）。
      const engineResults = {
        claude: {
          mentioned: claudeMentioned,
          position: claudePosition,
          cost_usd: claudeCost,
          raw: claudeRes.text,
        },
      }
      if (geminiRes && geminiRes.ok) {
        engineResults.gemini = {
          mentioned: geminiMentioned,
          position: geminiPosition,
          cost_usd: geminiCost,
          raw: geminiText,
          sources: geminiSources,   // 接地引用來源 [{ uri, title }]
        }
      }

      // 單寫一筆：Claude 在主欄 + engine_results JSONB
      const { data: row, error: insErr } = await supabase
        .from('aivis_responses')
        .insert({
          user_id: prompt.user_id,
          brand_id: prompt.brand_id,
          prompt_id: prompt.id,
          run_index: i,
          model: MODEL,
          raw_response: claudeRes.text,
          input_tokens: claudeRes.inputTokens,
          output_tokens: claudeRes.outputTokens,
          cost_usd: claudeCost,
          brand_mentioned: claudeMentioned,
          engine_results: engineResults,
        })
        .select('id')
        .single()

      if (insErr) {
        return res.status(500).json({ error: 'Failed to save response', detail: insErr.message })
      }

      // 寫入成功才算扣 quota（1 row = 1 scan）
      usedThisCall += 1

      // mention 表只記 Claude（主引擎、avgPos 等沿用既有邏輯不被 Gemini 汙染）
      if (claudeMentioned) {
        await supabase.from('aivis_mentions').insert({
          user_id: prompt.user_id,
          brand_id: prompt.brand_id,
          response_id: row.id,
          mentioned_name: brandName,
          is_target: true,
          position: claudePosition,
          context: claudeContext,
        })
      }

      // results 同時記錄兩個 engine 的結果（給 client 顯示用）
      results.push({
        run: i,
        claude: { mentioned: claudeMentioned, position: claudePosition, cost_usd: claudeCost },
        // 沒呼叫 Gemini 的 run（i>1、或 useGemini=false）→ null，不計入成功/失敗統計
        gemini: !shouldCallGemini ? null
          : (geminiRes && geminiRes.ok
            ? { mentioned: geminiMentioned, cost_usd: geminiCost }
            : { error: geminiRes?.error || 'failed' }),
      })
    }

    // 2026-06-10：分別算 Claude / Gemini 的提及次數與成本
    // results 每筆是一個 run、含 claude + gemini 兩個 sub-result
    const claudeMentionedCount = results.filter(r => r.claude?.mentioned).length
    const geminiMentionedCount = results.filter(r => r.gemini?.mentioned).length
    const geminiSuccessRuns = results.filter(r => r.gemini && !r.gemini.error).length
    const claudeCostTotal = results.reduce((sum, r) => sum + (r.claude?.cost_usd || 0), 0)
    const geminiCostTotal = results.reduce((sum, r) => sum + (r.gemini?.cost_usd || 0), 0)

    return res.status(200).json({
      success: true,
      brand: brandName,
      prompt: prompt.text,
      runs,
      // 主指標：Claude（向下相容、之前的 dashboard 看這兩個欄位）
      mentioned_count: claudeMentionedCount,
      mention_rate: claudeMentionedCount / runs,
      total_cost_usd: claudeCostTotal + geminiCostTotal,
      // 跨 LLM 分項（2026-06-10 新增、給 dashboard 顯示「Claude vs Gemini」對照）
      by_engine: {
        claude: {
          mentioned_count: claudeMentionedCount,
          mention_rate: claudeMentionedCount / runs,
          cost_usd: claudeCostTotal,
        },
        gemini: useGemini ? {
          mentioned_count: geminiMentionedCount,
          mention_rate: geminiSuccessRuns > 0 ? geminiMentionedCount / geminiSuccessRuns : 0,
          success_runs: geminiSuccessRuns,
          cost_usd: geminiCostTotal,
        } : null,
      },
      results,
      // 額度資訊（給前端 banner 即時更新用，免再打一次 count 查詢）
      quota: {
        used_after: monthCount + usedThisCall,
        quota_per_month: quotaLimit,
        hard_cap: hardCap,
        topup_consumed_this_call: topupConsumedThisCall,
        is_trial: isTrial,
      },
      // 2026-06-10 Gemini 診斷：key_present=後端有沒有讀到 GEMINI_API_KEY、attempts/ok=呼叫次數、last_error=最後錯誤
      // 2026-06-11：quota_exhausted=429/配額耗盡（前端顯示「配額用完」專屬提示）
      gemini_status: {
        key_present: useGemini,
        attempts: geminiAttempts,
        ok: geminiOkCount,
        last_error: geminiLastError,
        quota_exhausted: geminiQuotaExhausted,
      },
    })

  } catch (err) {
    console.error('aivis/fetch error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ---------------------- 工具函式 ----------------------

// 小睡（給 429/503 退避用）
const sleep = ms => new Promise(r => setTimeout(r, ms))

// 呼叫 Gemini API（2026-06-10）— 跟 Claude 同一個 prompt、增加跨 LLM 覆蓋率
// 失敗回 {ok:false, error, status?}、Gemini 失敗不會擋 Claude 主流程
// 2026-06-11：429（配額/速率）、503（過載）短暫退避重試 maxRetries 次 —
//   撐過短暫的每分鐘速率尖峰（RPM）。注意：若是「當日免費額度耗盡」這種硬上限、
//   重試也不會過、但退避成本小（最多 ~0.8s）。逾時/網路錯誤不重試（避免拖爆 function 時限）。
async function callGemini(promptText, apiKey, maxRetries = 1) {
  let lastError = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          // 接地：讓 Gemini 自行決定要不要 Google 搜尋、搜幾次（current models 用 google_search）
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: MAX_TOKENS },
        }),
        signal: AbortSignal.timeout(30000),
      })

      // 429 / 503 → 短暫退避後重試；最後一次仍失敗才回傳錯誤（帶 status 給上層判斷配額）
      if (r.status === 429 || r.status === 503) {
        const errText = await r.text()
        lastError = `HTTP ${r.status}: ${errText.slice(0, 300)}`
        if (attempt < maxRetries) { await sleep(800 * (attempt + 1)); continue }
        return { ok: false, error: lastError, status: r.status }
      }

      if (!r.ok) {
        const errText = await r.text()
        return { ok: false, error: `HTTP ${r.status}: ${errText.slice(0, 300)}`, status: r.status }
      }

      const data = await r.json()
      const cand = data.candidates?.[0]
      // 答案可能拆成多個 text part（接地後常見）→ 全部接起來
      const text = (cand?.content?.parts || []).map(p => p.text).filter(Boolean).join('') || ''
      // 接地來源：groundingMetadata.groundingChunks[].web.{uri,title}；搜尋次數用 webSearchQueries 估
      const gm = cand?.groundingMetadata || {}
      const sources = (gm.groundingChunks || [])
        .map(c => (c.web ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null))
        .filter(Boolean)
      const searchCount = (gm.webSearchQueries || []).length
      return {
        ok: true,
        text,
        sources,
        searchCount,
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      }
    } catch (err) {
      // 逾時 / 網路錯誤不重試（每次最多 30s、重試會拖爆 function 時限）
      return { ok: false, error: err.message }
    }
  }
  return { ok: false, error: lastError || 'unknown error' }
}

async function callClaude(promptText, apiKey) {
  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: promptText }],
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!r.ok) {
      const errText = await r.text()
      return { ok: false, error: `HTTP ${r.status}: ${errText}` }
    }

    const data = await r.json()
    const text = data.content?.[0]?.text || ''
    return {
      ok: true,
      text,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function detectMention(text, brandName) {
  return text.toLowerCase().includes(brandName.toLowerCase())
}

// 嘗試找出品牌在編號清單中的第幾項（找不到就回 null）
function findListPosition(text, brandName) {
  const lines = text.split('\n')
  let lastNumber = null
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)、]/)
    if (m) lastNumber = parseInt(m[1], 10)
    if (line.toLowerCase().includes(brandName.toLowerCase())) {
      return lastNumber
    }
  }
  return null
}

// 取出品牌附近 ±80 字的上下文
function extractContext(text, brandName, padding = 80) {
  const idx = text.toLowerCase().indexOf(brandName.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - padding)
  const end = Math.min(text.length, idx + brandName.length + padding)
  return text.substring(start, end).trim()
}
