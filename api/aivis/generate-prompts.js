/**
 * POST /api/aivis/generate-prompts
 * 給定 brand_id，請 Claude 根據品牌的產業/業務/簡介自動產出「四層題庫」，寫入 aivis_prompts：
 *   - core（固定核心）：品類問句、不含品牌名。每次掃描全跑，是頭條分數與趨勢線的基準
 *     （統計上＝固定樣本，才能有效比較「這週 vs 上週」）。
 *   - rotating（輪替池）：品類問句、不含品牌名。每次掃描隨機抽幾條，補覆蓋 / 抓盲點、防「應試化」。
 *   - brand（品牌詞）：帶品牌名。量「AI 認不認得你」，near-deterministic，掃描只跑 1 次、
 *     且【不計入頭條曝光率】（避免用品牌詞灌水分數）。
 *   - info（資訊型，Phase 2a）：知識/how-to 問句、不含品牌名。每次全掃，計分【不看被提及、改看
 *     「AI 這題的引用來源裡有沒有你的網域」】＝內容引用率，一樣【不計入頭條曝光率】、獨立呈現。
 *
 * 統計設計理由見對話：固定核心讓你「量得準、比得動」，輪替池讓你「不自欺」，資訊型量「內容有沒有被 AI 當來源」。
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
// 2026-09-04 由 1024 提高：每條題目從純字串變成 {q, intent} 物件、又多一層競品題，
// 21 條的輸出接近 1300 tokens，維持 1024 會被截斷、JSON 解析直接失敗。
const MAX_TOKENS = 2048

// 各層題庫數量（想改題量改這裡；同步影響每次掃描的額度花費，見 fetch.js / AIVisibilityDashboard.jsx）
// 每次掃描花費 = core×3 + 抽樣輪替×3 + brand×1 + info×1 + competitor×1
//   目前 6/6/2/5：6×3 + 2×3 + 2×1 + 5×1 = 31 次額度（月 150 額度約 4–5 掃/月）
//   有設競品觀察名單時再 +2×1 = 33（2026-09-04 新增；沒設名單就不產、不花額度）
const CORE_COUNT = 6      // 固定核心：品類問句、每次全跑、趨勢基準（2026-07-03 由 8 調降為 6 省成本）
const ROTATING_COUNT = 6  // 輪替池：品類問句、每次抽樣、抓覆蓋盲點
const BRAND_COUNT = 2     // 品牌詞：帶品牌名、另計、不進頭條分數
const COMPETITOR_COUNT = 2  // 競品詞：只有用戶設了觀察名單才產（2026-09-04）。掃描只跑 1 次、不進頭條分數
const INFO_COUNT = 5      // 資訊型：知識/how-to 問句、每次全掃、計分看「網域有沒有被引用」（Phase 2a、2026-07-13）

// 核心層啟用上限 —— DB 有 plpgsql trigger 在擋，這裡先算一次是為了在超出時給出
// 「該怎麼辦」的訊息，而不是把資料庫的原始錯誤丟給使用者。
// 改動須連同 services/aivisScanService.js 的 PROMPT_CAP 與 DB trigger 一起。
const PROMPT_CAP = 10

const PRICE_INPUT_PER_TOKEN = 1 / 1_000_000
const PRICE_OUTPUT_PER_TOKEN = 5 / 1_000_000

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const brandId = req.query.brand_id || req.body?.brand_id
  // 預設替換 auto prompts（語意 = 重新產生），避免撞核心啟用上限
  const replaceExisting = (req.query.replace_existing ?? req.body?.replace_existing) !== 'false'
  // 連「人工題」一起換掉（預設 false）。人工題＝使用者編輯過、generated_by 被標成 'user' 的題，
  // 重生刻意不覆蓋它們以保護手動修改 —— 但它們會一直佔著核心層的啟用上限，
  // 累積到滿之後重生就永遠失敗。這個參數是那條死路的出口，由前端問過使用者才帶上來。
  const replaceUser = (req.query.replace_user ?? req.body?.replace_user) === 'true'
     || (req.query.replace_user ?? req.body?.replace_user) === true

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
      .select('id, user_id, name, domain, industry, description, competitors')
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

    // 觀察名單（aivis_brands.competitors，用戶自設、最多 3 個）。沒設就不產競品題——
    // 硬掰一個競品名字出來測，量到的東西沒有意義，還會讓用戶以為那是我們幫他挑的對手。
    const competitors = Array.isArray(brand.competitors)
      ? brand.competitors.map(name => String(name || '').trim()).filter(Boolean).slice(0, 3)
      : []

    // 組 meta prompt 請 Claude 生成題庫（有觀察名單時多產一層競品題）
    const metaPrompt = buildMetaPrompt(brand, {
      core: CORE_COUNT, rotating: ROTATING_COUNT, brand: BRAND_COUNT, info: INFO_COUNT,
      competitor: competitors.length > 0 ? COMPETITOR_COUNT : 0,
    }, competitors)
    const claudeRes = await callClaude(metaPrompt, ANTHROPIC_API_KEY)
    if (!claudeRes.ok) {
      return res.status(502).json({ error: 'Claude API error', detail: claudeRes.error })
    }

    // 解析成 { core:[], rotating:[], brand:[], info:[], competitor:[] }，每條是 { text, intent }
    const tiered = parseTieredJson(claudeRes.text)
    const totalParsed = tiered
      ? tiered.core.length + tiered.rotating.length + tiered.brand.length + tiered.info.length + tiered.competitor.length
      : 0
    if (!tiered || totalParsed === 0) {
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

    // ── 上限預檢（2026-09-24）──
    // 上面只停用 auto 題。使用者編輯過的題會被標成 generated_by='user'，重生刻意不覆蓋它們
    // （保護手動修改），但它們會一直佔著核心層的啟用上限 —— 累積到 PROMPT_CAP 之後，
    // 新的核心題再也寫不進去，重生永遠失敗。
    // 舊行為是直接讓 DB trigger 擋下、把原始錯誤往前端丟：「每個品牌最多 10 條啟用中的
    // prompts（目前已 10 條）」。那句話沒告訴使用者「所以我該做什麼」，而唯一的解法
    // （手動去停用幾條）也不在那個畫面上。客戶只會看到一條死路。
    // 改成：先算清楚還剩幾個位子，不夠就回可讀的 409 並附上數字；
    // 前端問過使用者之後，可以帶 replace_user=true 回來，連人工題一起換掉。
    const activeResult = await supabase
      .from('aivis_prompts')
      .select('id, tier, generated_by')
      .eq('brand_id', brand.id)
      .eq('is_active', true)
    if (activeResult.error) {
      return res.status(500).json({ error: 'Failed to check prompt cap', detail: activeResult.error.message })
    }
    // 上限算的是核心層（與 PromptManager / AIVisibilityDashboard 的 coreActiveCount 同義）。
    // tier 可能是 null（2026-09-04 前的舊資料），一律當 core 看待 —— 與讀取端一致。
    const activeCore = (activeResult.data || []).filter(row => (row.tier || 'core') === 'core')
    const userAuthored = activeCore.filter(row => row.generated_by === 'user')
    const room = PROMPT_CAP - activeCore.length

    if (tiered.core.length > room) {
      if (!replaceUser) {
        return res.status(409).json({
          error: 'prompt_cap_would_exceed',
          detail: `核心題啟用上限 ${PROMPT_CAP} 條，目前已啟用 ${activeCore.length} 條`
            + `（其中 ${userAuthored.length} 條是你手動編輯過的，重生預設不會動它們），`
            + `只剩 ${Math.max(0, room)} 個位子，但這次要寫入 ${tiered.core.length} 條新核心題。`,
          cap: PROMPT_CAP,
          active_core: activeCore.length,
          user_authored: userAuthored.length,
          need: tiered.core.length,
          room: Math.max(0, room),
          hint: userAuthored.length > 0
            ? '可以帶 replace_user=true 連手動編輯過的題一起停用（不會刪除，之後仍可開回來），或自己先去停用幾條再重生。'
            : '請先停用幾條核心題再重生。',
        })
      }
      // 使用者同意了 —— 連人工題一起停用。是停用不是刪除，題目與歷史回答都留著，隨時可以開回來。
      const { error: deactErr } = await supabase
        .from('aivis_prompts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('brand_id', brand.id)
        .eq('is_active', true)
        .in('id', activeCore.map(row => row.id))
      if (deactErr) {
        return res.status(500).json({ error: 'Failed to free prompt slots', detail: deactErr.message })
      }
    }

    // 批次寫入新 prompts，各自帶 tier（三層分流的資料來源）
    // ⚠️ DB 有 plpgsql trigger 限制「每品牌啟用中的題數」（上限見 aivisScanService.js 的 PROMPT_CAP）。
    //    所以只有【核心】預設啟用（算進上限）；
    //    【輪替／品牌詞】放進「池子」但預設 is_active=false，不佔上限。
    //    掃描時前端照 tier 從池子抓（見 AIVisibilityDashboard runScan），不看 is_active，功能不受影響。
    // tier 決定掃描行為、intent 決定語意分類（見 components/appshell/aivisData.js 的 INTENT_META）。
    // 兩者正交：brand tier 一定是 brand intent，但 core tier 可能是 decision / category / painpoint。
    const base = { user_id: brand.user_id, brand_id: brand.id, generated_by: 'auto' }
    const toRow = (tier, isActive, fallbackIntent) => item => ({
      ...base,
      text: item.text,
      tier,
      is_active: isActive,
      // Claude 有標就用它標的；沒標（或標了無效值）就留 null，讀取端會用 inferPromptIntent 推測
      intent: item.intent || fallbackIntent || null,
    })
    const rows = [
      ...tiered.core.map(toRow('core', true, null)),
      ...tiered.rotating.map(toRow('rotating', false, null)),
      ...tiered.brand.map(toRow('brand', false, 'brand')),
      ...tiered.info.map(toRow('info', false, 'info')),               // 資訊型：池子、每次全掃、看網域引用
      ...tiered.competitor.map(toRow('competitor', false, 'competitor')), // 競品詞：池子、每次全掃、只跑 1 次
    ]

    // intent 欄位是 2026-09-04 才加的。若部署順序跑在 SQL 前面（或回滾到舊 schema），
    // 這裡會拿到 PGRST204 / "column ... does not exist" —— 那種情況下寧可少存一個標籤，
    // 也不要讓整個「重新產生題庫」功能掛掉（舊題庫沒有 intent 也能靠推測運作）。
    let { data: inserted, error: insertErr } = await supabase
      .from('aivis_prompts')
      .insert(rows)
      .select('id, text, is_active, generated_by, tier, intent')

    if (insertErr && /intent/i.test(insertErr.message || '')) {
      console.warn('[generate-prompts] aivis_prompts.intent 欄位不存在，退回不帶 intent 寫入：', insertErr.message)
      const fallbackRows = rows.map(({ intent, ...rest }) => rest)  // eslint-disable-line no-unused-vars
      const retry = await supabase
        .from('aivis_prompts')
        .insert(fallbackRows)
        .select('id, text, is_active, generated_by, tier')
      inserted = retry.data
      insertErr = retry.error
    }

    if (insertErr) {
      // 上限預檢照的是「核心層」的定義（與前端一致）。萬一 DB trigger 算的是別種口徑
      // （例如全部層一起算），預檢會放行、然後在這裡被擋 —— 那時也要給人話，不要把
      // 資料庫的原始訊息丟出去。
      if (/啟用中|prompt.*cap|最多\s*\d+\s*條/i.test(insertErr.message || '')) {
        return res.status(409).json({
          error: 'prompt_cap_would_exceed',
          detail: `資料庫擋下了這次寫入：${insertErr.message}`,
          cap: PROMPT_CAP,
          hint: '請先停用幾條題目再重生；或帶 replace_user=true 讓系統連手動編輯過的題一起停用。',
        })
      }
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
        info: tiered.info.length,
        competitor: tiered.competitor.length,
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

function buildMetaPrompt(brand, counts, competitors = []) {
  const industry = brand.industry || '（未指定）'
  const description = brand.description || '（未提供）'
  const domain = brand.domain || '（未提供）'

  // 競品題只有在用戶設了觀察名單時才產（counts.competitor > 0）
  const competitorSection = counts.competitor > 0
    ? `
- **competitor（競品詞，${counts.competitor} 條）**：**必須同時出現「${brand.name}」與下列其中一個競品名稱**：${competitors.join('、')}。
  例如「${brand.name} 跟 ${competitors[0]} 哪個好？」「${competitors[0]} 和 ${brand.name} 差在哪？」。
  這組量的是「客戶在比價時，AI 站在誰那邊」——商業價值最高的一類。`
    : ''

  const competitorJson = counts.competitor > 0
    ? `,
  "competitor": [{ "q": "${brand.name} 跟 ${competitors[0]} 哪個好？", "intent": "competitor" }]`
    : ''

  return `你是品牌 SEO 與 AEO（Answer Engine Optimization）專家，熟悉台灣中小企業老闆會怎麼問 AI。

【品牌資料】
- 名稱：${brand.name}
- 產業：${industry}
- 網域：${domain}
- 簡介：${description}

【任務】
請產出下列各組問題。這些問題會被送進 ChatGPT / Claude / Gemini，測試該品牌的 AI 能見度。

【各組定義】
- **core（固定核心，${counts.core} 條）**：該品牌目標客群「最常問、最具代表性」的品類問句。這組會被長期固定、每次都測，用來追蹤趨勢——所以要選最穩定、最核心的問法。**絕對不能出現品牌名稱。**
- **rotating（輪替池，${counts.rotating} 條）**：同樣是品類問句，但要**更長尾、更多樣**——不同地區、不同預算、不同痛點、不同業種的變化題，用來擴大覆蓋、抓核心題測不到的盲點。**絕對不能出現品牌名稱**，且不要和 core 重複。
- **brand（品牌詞，${counts.brand} 條）**：**必須包含品牌名稱「${brand.name}」**，例如「${brand.name} 評價如何？」「${brand.name} 有什麼服務？」。這組用來量「AI 認不認得這個品牌」，是獨立指標。
- **info（資訊型，${counts.info} 條）**：**知識/how-to 問句，不是找推薦、也絕不含品牌名**。是這個產業的**潛在客人在購買前會問的資訊題**——AI 回答時，很可能會引用這個品牌部落格/衛教文章當來源。例如英文補教會問「如何快速提升英文口說？」「多益怎麼準備？」；醫美會問「電波拉皮術後要注意什麼？」「音波拉提可以維持多久？」。**要問「怎麼做/為什麼/多久/幾歲/如何選」這類，而不是「推薦哪家」。**${competitorSection}

【core 與 rotating 的共同要求（品類問句）】
1. 像真人在搜尋框打字的口吻，不是產業分析師寫的題目。
2. 兩組合計要涵蓋下列切角，每種至少 1 條：
   - **地區型**：帶具體台灣地區（台南 / 高雄 / 台中 / 桃園 / 新北），例：「台南有哪些不錯的 ___ 公司？」
   - **預算型**：帶具體預算，例：「預算 10 萬以內想做 ___，有推薦的公司嗎？」
   - **痛點型**：從具體商業痛點切入、不點名解決方案，例：「IG 一直沒人追蹤，有沒有公司可以幫忙？」
   - **業種型**：從客戶行業切入，例：「餐廳老闆想做行銷該找什麼公司？」
   - **比較/列表型**：「台灣有哪些...」或「___ 哪一家比較好」

**【最重要的一條：每一題都要問得出「公司名字」】**
這個題庫是拿來量「AI 有沒有講出這個品牌」的。如果一條題目的答案是一套判斷方法、
一份挑選指南、或一個產業分類，那它連競品的名字都不會出現 —— 那條題目量到的是 0，
但那個 0 不代表品牌沒有能見度，只代表這題問錯了。這種題目必須避免。

所以：
- **禁止**「應該找哪一類公司」「該怎麼挑選」「要注意什麼」這種問方法的句型（那是 info 組的事）。
- 每一條 core 與 rotating 都要讓 AI 自然地列出**具體公司／品牌名稱**。情境可以鋪陳，
  但句子要落在「有推薦嗎？」「有哪幾家？」「請列出名單」這類明確要名字的收尾。
- 痛點型與預算型一樣要收在要名單的問法上，例：
  「IG 一直沒人追蹤，台南有哪幾家公司可以幫忙代操？」（✅ 要名單）
  而不是「IG 一直沒人追蹤該怎麼辦？」（❌ 問方法，不會有公司名）
3. 用繁體中文 + 台灣口語（「找哪家」「值得推薦」「有沒有人推」），不要用「請問」「敬請」這種太正式的詞。
4. 每條 25–70 字，貼近真人打字的長度；結尾用「？」。
   （2026-09-24 由 55 放寬到 70：情境型題目要先鋪陳處境、又要收在「有哪幾家？」的問法上，
   55 字經常寫不完，逼出來的結果就是砍掉要名單的收尾、變成問方法的題目。）

【意圖標籤（intent）】
每一條題目都要標一個 intent，只能用下列六個代號之一：
- \`decision\`：推薦哪家、價格費用、評價、哪個比較好 —— 購買意圖最明確
- \`category\`：描述服務或品類本身（常帶地區），沒有明顯比較或痛點語氣
- \`painpoint\`：從具體困擾切入、不點名解決方案
- \`info\`：知識、how-to、注意事項、要多久
- \`brand\`：含「${brand.name}」
- \`competitor\`：同時含「${brand.name}」與競品名稱

**core 與 rotating 合計，intent 必須至少各出現 1 條 \`decision\`、\`category\`、\`painpoint\`**——
題庫如果缺掉其中一類，客戶在購買旅程的那一段就是量不到的盲區。

【輸出格式】
**只回傳一段 JSON，不要任何前後說明文字、不要 markdown code fence。每條題目都是 { "q": 問題文字, "intent": 意圖代號 } 物件：**
{
  "core": [{ "q": "問題...？", "intent": "decision" }],
  "rotating": [{ "q": "問題...？", "intent": "painpoint" }],
  "brand": [{ "q": "${brand.name} ...？", "intent": "brand" }],
  "info": [{ "q": "如何...？", "intent": "info" }]${competitorJson}
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

// 解析題庫 JSON → { core:[], rotating:[], brand:[], info:[], competitor:[] }
// 每筆正規化成 { text, intent }。刻意同時吃三種形狀，因為 LLM 的輸出格式不能當成保證：
//   1. { "core": [{ "q": "...", "intent": "decision" }] }  ← 2026-09-04 起的正式格式
//   2. { "core": ["..."] }                                  ← 舊格式，intent 留 null 由讀取端推測
//   3. { "prompts": ["..."] }                               ← 更舊的單層格式，整批當 core
const VALID_INTENTS = ['brand', 'competitor', 'decision', 'category', 'painpoint', 'info']

export function parseTieredJson(text) {
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
      .map(item => {
        if (typeof item === 'string') return { text: item.trim(), intent: null }
        if (item && typeof item === 'object') {
          const text = String(item.q || item.text || '').trim()
          const intent = VALID_INTENTS.includes(item.intent) ? item.intent : null
          return { text, intent }
        }
        return { text: '', intent: null }
      })
      .filter(item => item.text.length > 0)

    // 舊格式相容
    if (Array.isArray(parsed.prompts) && !parsed.core) {
      return { core: clean(parsed.prompts), rotating: [], brand: [], info: [], competitor: [] }
    }
    return {
      core: clean(parsed.core),
      rotating: clean(parsed.rotating),
      brand: clean(parsed.brand),
      info: clean(parsed.info),
      competitor: clean(parsed.competitor),
    }
  } catch {
    return null
  }
}
