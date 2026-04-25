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

    const results = []

    for (let i = 1; i <= runs; i++) {
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
