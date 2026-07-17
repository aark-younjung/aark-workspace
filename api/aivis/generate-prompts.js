/**
 * POST /api/aivis/generate-prompts
 * 給定 brand_id，請 Claude 根據品牌的產業/業務/簡介自動產出「三層題庫」，寫入 aivis_prompts：
 *   - core（固定核心）：品類問句、不含品牌名。每次掃描全跑，是頭條分數與趨勢線的基準
 *     （統計上＝固定樣本，才能有效比較「這週 vs 上週」）。
 *   - rotating（輪替池）：品類問句、不含品牌名。每次掃描隨機抽幾條，補覆蓋 / 抓盲點、防「應試化」。
 *   - brand（品牌詞）：帶品牌名。量「AI 認不認得你」，near-deterministic，掃描只跑 1 次、
 *     且【不計入頭條曝光率】（避免用品牌詞灌水分數）。
 *
 * 統計設計理由見對話：固定核心讓你「量得準、比得動」，輪替池讓你「不自欺」。
 *
 * Body / Query:
 *   brand_id          (必填) 品牌 UUID
 *   replace_existing  (選填，預設 true) — 「重新產生」語意
 *                     true（預設）→ 將舊 auto prompts 設為 is_active=false 再新增
 *                     false        → 直接追加，不動舊的
 *
 * Headers:
 *   Authorization: Bearer <supabase_access_token>  (必填)
 *
 * Env:
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 守衛：必須 Bearer token + 用戶為品牌擁有者 + is_pro 或 is_trial。
 *      防止無認證情況下，知道 brand_id 就能戳 Claude API 燒平台成本。
 */

import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

// 三層題庫數量（想改題量改這裡；同步影響每次掃描的額度花費，見 fetch.js / AIVisibilityDashboard.jsx）
// 每次掃描花費 ≈ core×3 + 抽樣輪替×3 + brand×1（brand 只跑 1 次）。
// 目前 6/6/2：每掃 ≈ 6×3 + 2×3 + 2×1 = 26 次額度（月 150 額度約 5–6 掃/月）。
const CORE_COUNT = 6      // 固定核心：品類問句、每次全跑、趨勢基準（2026-07-03 由 8 調降為 6 省成本）
const ROTATING_COUNT = 6  // 輪替池：品類問句、每次抽樣、抓覆蓋盲點
const BRAND_COUNT = 2     // 品牌詞：帶品牌名、另計、不進頭條分數

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

  // 守衛 1：必須帶 Supabase Bearer token，否則任何知道 brand_id 的人都能戳 Claude API 燒成本
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' })
  }
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !authUser) {
    return res.status(401).json({ error: 'Invalid or expired token', detail: authErr?.message })
  }

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

    // 守衛 2：用戶必須是品牌擁有者（防 A 用戶用自己的 token 幫 B 用戶的品牌刷 prompts）
    if (brand.user_id !== authUser.id) {
      return res.status(403).json({ error: 'You do not own this brand' })
    }

    // 守衛 3：品牌擁有者必須是 Pro 或試用期內（aivis 是 Pro 專屬功能）
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('is_pro, is_trial')
      .eq('id', authUser.id)
      .maybeSingle()
    if (profileErr) {
      return res.status(500).json({ error: 'Failed to fetch profile', detail: profileErr.message })
    }
    if (!profile?.is_pro && !profile?.is_trial) {
      return res.status(403).json({ error: 'AI 曝光監測為 Pro 功能，請先升級或啟用 7 天免費試用' })
    }

    // 組 meta prompt 請 Claude 生成三層題庫
    const metaPrompt = buildMetaPrompt(brand, { core: CORE_COUNT, rotating: ROTATING_COUNT, brand: BRAND_COUNT })
    const claudeRes = await callClaude(metaPrompt, ANTHROPIC_API_KEY)
    if (!claudeRes.ok) {
      return res.status(502).json({ error: 'Claude API error', detail: claudeRes.error })
    }

    // 解析成 { core:[], rotating:[], brand:[] }
    const tiered = parseTieredJson(claudeRes.text)
    if (!tiered || (tiered.core.length + tiered.rotating.length + tiered.brand.length) === 0) {
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

    // 批次寫入新 prompts，各自帶 tier（三層分流的資料來源）
    // ⚠️ DB 有「每品牌最多 10 條啟用」硬限制。所以只有【核心】預設啟用（算進 10 條上限）；
    //    【輪替／品牌詞】放進「池子」但預設 is_active=false，不佔上限。
    //    掃描時前端照 tier 從池子抓（見 AIVisibilityDashboard runScan），不看 is_active，功能不受影響。
    const base = { user_id: brand.user_id, brand_id: brand.id, generated_by: 'auto' }
    const rows = [
      ...tiered.core.map(text => ({ ...base, text, tier: 'core', is_active: true })),
      ...tiered.rotating.map(text => ({ ...base, text, tier: 'rotating', is_active: false })),
      ...tiered.brand.map(text => ({ ...base, text, tier: 'brand', is_active: false })),
    ]

    const { data: inserted, error: insertErr } = await supabase
      .from('aivis_prompts')
      .insert(rows)
      .select('id, text, is_active, generated_by, tier')

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
      by_tier: {
        core: tiered.core.length,
        rotating: tiered.rotating.length,
        brand: tiered.brand.length,
      },
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

function buildMetaPrompt(brand, counts) {
  const industry = brand.industry || '（未指定）'
  const description = brand.description || '（未提供）'
  const domain = brand.domain || '（未提供）'

  return `你是品牌 SEO 與 AEO（Answer Engine Optimization）專家，熟悉台灣中小企業老闆會怎麼問 AI。

【品牌資料】
- 名稱：${brand.name}
- 產業：${industry}
- 網域：${domain}
- 簡介：${description}

【任務】
請產出三組問題，分別放進 core / rotating / brand。這些問題會被送進 ChatGPT / Claude / Gemini，測試該品牌會不會被 AI 主動推薦。

【三組定義】
- **core（固定核心，${counts.core} 條）**：該品牌目標客群「最常問、最具代表性」的品類問句。這組會被長期固定、每次都測，用來追蹤趨勢——所以要選最穩定、最核心的問法。**絕對不能出現品牌名稱。**
- **rotating（輪替池，${counts.rotating} 條）**：同樣是品類問句，但要**更長尾、更多樣**——不同地區、不同預算、不同痛點、不同業種的變化題，用來擴大覆蓋、抓核心題測不到的盲點。**絕對不能出現品牌名稱**，且不要和 core 重複。
- **brand（品牌詞，${counts.brand} 條）**：**必須包含品牌名稱「${brand.name}」**，例如「${brand.name} 評價如何？」「${brand.name} 有什麼服務？」。這組用來量「AI 認不認得這個品牌」，是獨立指標。

【core 與 rotating 的共同要求（品類問句）】
1. 像真人在搜尋框打字的口吻，不是產業分析師寫的題目。
2. 兩組合計要涵蓋下列切角，每種至少 1 條：
   - **地區型**：帶具體台灣地區（台南 / 高雄 / 台中 / 桃園 / 新北），例：「台南有哪些不錯的 ___ 公司？」
   - **預算型**：帶具體預算，例：「預算 10 萬以內想做 ___，有推薦的公司嗎？」
   - **痛點型**：從具體商業痛點切入、不點名解決方案，例：「IG 一直沒人追蹤，有沒有公司可以幫忙？」
   - **業種型**：從客戶行業切入，例：「餐廳老闆想做行銷該找什麼公司？」
   - **比較/列表型**：「台灣有哪些...」或「___ 哪一家比較好」（最像分析師，整體最多 2 條）
3. 用繁體中文 + 台灣口語（「找哪家」「值得推薦」「有沒有人推」），不要用「請問」「敬請」這種太正式的詞。
4. 每條 25–55 字，貼近一句話搜尋的長度；結尾用「？」。

【輸出格式】
**只回傳一段 JSON，不要任何前後說明文字、不要 markdown code fence：**
{
  "core": ["問題...", "..."],
  "rotating": ["問題...", "..."],
  "brand": ["${brand.name} ...？", "..."]
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

// 解析三層題庫 JSON → { core:[], rotating:[], brand:[] }
// 相容舊格式：若回傳的是 { prompts:[...] }，整批視為 core（不至於解析失敗）。
function parseTieredJson(text) {
  // Claude 偶爾會包進 ```json ... ``` 或多寫前後說明，盡量寬鬆抓出 JSON
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null

  const jsonStr = cleaned.slice(start, end + 1)
  try {
    const parsed = JSON.parse(jsonStr)
    const clean = arr => (Array.isArray(arr) ? arr : [])
      .filter(p => typeof p === 'string' && p.trim().length > 0)
      .map(p => p.trim())
    // 舊格式相容
    if (Array.isArray(parsed.prompts) && !parsed.core) {
      return { core: clean(parsed.prompts), rotating: [], brand: [] }
    }
    return { core: clean(parsed.core), rotating: clean(parsed.rotating), brand: clean(parsed.brand) }
  } catch {
    return null
  }
}
