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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

// Haiku 4.5 定價（USD / token）
const PRICE_INPUT_PER_TOKEN = 1 / 1_000_000   // $1 / MTok
const PRICE_OUTPUT_PER_TOKEN = 5 / 1_000_000  // $5 / MTok

// 額度規則 — 與 [Pricing.jsx] 與 [AIVisibilityDashboard.jsx] 三邊同步
const AIVIS_QUOTA_PER_MONTH = 150   // Pro 內含本月免費額度
const AIVIS_HARD_CAP = 1000          // 每月查詢硬上限（內含 + Top-up 合計），Agency 推出後解除

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

    // 額度前置檢查：本月（calendar month）user-scope 已寫入幾次 aivis_responses
    // 之所以用「user-scope」不是「brand-scope」— 額度是 per-user per-month、跨品牌合計
    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const { count: monthCountRaw, error: countErr } = await supabase
      .from('aivis_responses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', prompt.user_id)
      .gte('created_at', monthStart.toISOString())

    if (countErr) {
      return res.status(500).json({ error: 'Failed to check monthly quota', detail: countErr.message })
    }
    const monthCount = monthCountRaw || 0

    // 已達硬上限 → 直接拒絕（連 1 次都不能跑）
    if (monthCount >= AIVIS_HARD_CAP) {
      return res.status(429).json({
        error: 'monthly_hard_cap_exceeded',
        message: `本月查詢已達硬上限 ${AIVIS_HARD_CAP} 次，請等下個月或聯繫 Agency 方案`,
        used: monthCount,
        hard_cap: AIVIS_HARD_CAP,
      })
    }

    const results = []
    let usedThisCall = 0           // 本次呼叫實際成功寫入幾筆，遞增後與 monthCount 合計判斷
    let topupConsumedThisCall = 0  // 本次呼叫從 Top-up 扣了幾次（給 client 顯示明細用）

    for (let i = 1; i <= runs; i++) {
      // 額度判斷（per-run，每次跑前先看下一筆會不會破線）
      const wouldBeNthQuery = monthCount + usedThisCall + 1

      // 破硬上限 → 中斷 loop（不能再跑，回傳已完成數）
      if (wouldBeNthQuery > AIVIS_HARD_CAP) {
        return res.status(429).json({
          error: 'monthly_hard_cap_exceeded',
          message: `本月查詢即將達硬上限 ${AIVIS_HARD_CAP} 次，已完成 ${i - 1} / ${runs} 次`,
          completed_runs: i - 1,
          used: monthCount + usedThisCall,
          hard_cap: AIVIS_HARD_CAP,
        })
      }

      // 已用完月內含 → 嘗試從 Top-up 扣 1 次
      if (wouldBeNthQuery > AIVIS_QUOTA_PER_MONTH) {
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

      // 呼叫 Claude Haiku
      const claudeRes = await callClaude(prompt.text, ANTHROPIC_API_KEY)
      if (!claudeRes.ok) {
        return res.status(502).json({
          error: 'Claude API error',
          detail: claudeRes.error,
          completedRuns: i - 1,
        })
      }

      const { text, inputTokens, outputTokens } = claudeRes
      const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN

      // 偵測品牌
      const mentioned = detectMention(text, brandName)
      const position = mentioned ? findListPosition(text, brandName) : null
      const context = mentioned ? extractContext(text, brandName) : null

      // 寫入 response
      const { data: response, error: respErr } = await supabase
        .from('aivis_responses')
        .insert({
          user_id: prompt.user_id,
          brand_id: prompt.brand_id,
          prompt_id: prompt.id,
          run_index: i,
          model: MODEL,
          raw_response: text,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
          brand_mentioned: mentioned,
        })
        .select('id')
        .single()

      if (respErr) {
        return res.status(500).json({ error: 'Failed to save response', detail: respErr.message })
      }

      // 寫入成功才算本次扣額成立（避免 Claude 失敗 / DB 失敗時誤扣）
      usedThisCall += 1

      // 有提到才寫 mention
      if (mentioned) {
        await supabase.from('aivis_mentions').insert({
          user_id: prompt.user_id,
          brand_id: prompt.brand_id,
          response_id: response.id,
          mentioned_name: brandName,
          is_target: true,
          position,
          context,
        })
      }

      results.push({ run: i, mentioned, position, cost_usd: cost })
    }

    const mentionedCount = results.filter(r => r.mentioned).length
    const totalCost = results.reduce((sum, r) => sum + r.cost_usd, 0)

    return res.status(200).json({
      success: true,
      brand: brandName,
      prompt: prompt.text,
      runs,
      mentioned_count: mentionedCount,
      mention_rate: mentionedCount / runs,
      total_cost_usd: totalCost,
      results,
      // 額度資訊（給前端 banner 即時更新用，免再打一次 count 查詢）
      quota: {
        used_after: monthCount + usedThisCall,
        quota_per_month: AIVIS_QUOTA_PER_MONTH,
        hard_cap: AIVIS_HARD_CAP,
        topup_consumed_this_call: topupConsumedThisCall,
      },
    })

  } catch (err) {
    console.error('aivis/fetch error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ---------------------- 工具函式 ----------------------

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
