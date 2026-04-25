/**
 * POST /api/aivis/generate-prompts
 * 給定 brand_id，請 Claude 根據品牌的產業/業務/簡介自動產出 5 條
 * 中性、不含品牌名的產業問題 prompt，寫入 aivis_prompts。
 *
 * Body / Query:
 *   brand_id          (必填) 品牌 UUID
 *   replace_existing  (選填，預設 true) — 配合 10 條上限，「重新產生」語意
 *                     true（預設）→ 將舊 auto prompts 設為 is_active=false 再新增
 *                     false        → 直接追加，不動舊的（小心撞 10 條上限）
 *
 * Env:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 注意：Phase 2 暫無認證，Phase 2c 串前端時補上。
 */

import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const PROMPT_COUNT = 5

const PRICE_INPUT_PER_TOKEN = 1 / 1_000_000
const PRICE_OUTPUT_PER_TOKEN = 5 / 1_000_000

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const brandId = req.query.brand_id || req.body?.brand_id
  // 預設替換 auto prompts（語意 = 重新產生），避免撞 10 條上限
  const replaceExisting = (req.query.replace_existing ?? req.body?.replace_existing) !== 'false'

  if (!brandId) {
    return res.status(400).json({ error: 'brand_id is required' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Missing required environment variables' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 取品牌資料
    const { data: brand, error: brandErr } = await supabase
      .from('aivis_brands')
      .select('id, user_id, name, domain, industry, description')
      .eq('id', brandId)
      .single()

    if (brandErr || !brand) {
      return res.status(404).json({ error: 'Brand not found', detail: brandErr?.message })
    }

    // 組 meta prompt 請 Claude 生成
    const metaPrompt = buildMetaPrompt(brand, PROMPT_COUNT)
    const claudeRes = await callClaude(metaPrompt, ANTHROPIC_API_KEY)
    if (!claudeRes.ok) {
      return res.status(502).json({ error: 'Claude API error', detail: claudeRes.error })
    }

    // 解析 JSON
    const prompts = parsePromptsJson(claudeRes.text)
    if (!prompts || prompts.length === 0) {
      return res.status(502).json({
        error: 'Failed to parse Claude response as JSON',
        rawResponse: claudeRes.text,
      })
    }

    // 視需要先停用舊 auto prompts（軟刪除，保留歷史 responses）
    if (replaceExisting) {
      await supabase
        .from('aivis_prompts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('brand_id', brand.id)
        .eq('generated_by', 'auto')
    }

    // 批次寫入新 prompts
    const rows = prompts.map(text => ({
      user_id: brand.user_id,
      brand_id: brand.id,
      text,
      generated_by: 'auto',
      is_active: true,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('aivis_prompts')
      .insert(rows)
      .select('id, text, is_active, generated_by')

    if (insertErr) {
      return res.status(500).json({ error: 'Failed to insert prompts', detail: insertErr.message })
    }

    const cost =
      claudeRes.inputTokens * PRICE_INPUT_PER_TOKEN +
      claudeRes.outputTokens * PRICE_OUTPUT_PER_TOKEN

    return res.status(200).json({
      success: true,
      brand: brand.name,
      generated_count: inserted.length,
      replaced_existing: replaceExisting,
      cost_usd: cost,
      input_tokens: claudeRes.inputTokens,
      output_tokens: claudeRes.outputTokens,
      prompts: inserted,
    })

  } catch (err) {
    console.error('aivis/generate-prompts error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

// ---------------------- 工具函式 ----------------------

function buildMetaPrompt(brand, count) {
  const industry = brand.industry || '（未指定）'
  const description = brand.description || '（未提供）'
  const domain = brand.domain || '（未提供）'

  return `你是品牌 SEO 與 AEO（Answer Engine Optimization）專家。

【品牌資料】
- 名稱：${brand.name}
- 產業：${industry}
- 網域：${domain}
- 簡介：${description}

【任務】
請產出 ${count} 條「該品牌的目標客群可能會去問 AI（ChatGPT / Claude / Perplexity）的中性產業問題」。
這些問題會被用來測試該品牌是否會被 AI 主動推薦。

【嚴格要求】
1. 每條 prompt **不能提到品牌名稱**（必須中性，模擬一般使用者搜尋）。
2. 涵蓋多種切入角度（請至少包含以下幾種）：
   - 推薦類：「推薦幾家 / 哪些 / 有哪些值得...」
   - 比較類：「比較 / 哪一家更...」
   - 解決方案類：「如何解決 / 哪些公司能幫忙...」
   - 列表類：「台灣有哪些...」
   - 價格 / 規模類：「中小企業負擔得起的 / 預算內可選...」
3. 用繁體中文，貼近台灣使用者口吻。
4. 每條 30–60 字之間，避免過長或過短。

【輸出格式】
**只回傳一段 JSON，不要任何前後說明文字、不要 markdown code fence：**
{
  "prompts": [
    "問題 1...",
    "問題 2...",
    "問題 3...",
    "問題 4...",
    "問題 5..."
  ]
}`
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

function parsePromptsJson(text) {
  // Claude 偶爾會包進 ```json ... ``` 或多寫前後說明，盡量寬鬆抓出 JSON
  let cleaned = text.trim()

  // 去掉 markdown code fence
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  // 找第一個 { 跟最後一個 } 之間
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null

  const jsonStr = cleaned.slice(start, end + 1)
  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.prompts)) return null
    return parsed.prompts.filter(p => typeof p === 'string' && p.trim().length > 0)
  } catch {
    return null
  }
}
