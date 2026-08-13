export const ENGINE_KEYS = ['chatgpt', 'claude', 'gemini']

export const ENGINE_META = {
  chatgpt: { label: 'ChatGPT', color: '#10a37f' },
  claude: { label: 'Claude', color: '#d97757' },
  gemini: { label: 'Gemini', color: '#4285f4' },
}

const DAY_MS = 86_400_000
const LATEST_SCAN_WINDOW_MS = 5 * 60 * 1000

// ponytail: 從 AIVisibilityDashboard.jsx 的 normEngineResults 抽成 app-shell 純函式；
// 仍保留舊資料的 Claude fallback，但 UI 契約只接受已定案的三個監測引擎。
export function normalizeEngineResults(response, mentionByResponseId = {}) {
  const raw = response?.engine_results
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    return Object.fromEntries(ENGINE_KEYS.filter(key => raw[key]).map(key => [key, raw[key]]))
  }
  return {
    claude: {
      mentioned: Boolean(response?.brand_mentioned),
      position: mentionByResponseId?.[response?.id]?.position ?? null,
      cost_usd: response?.cost_usd ?? null,
      raw: response?.raw_response ?? null,
    },
  }
}

function dayKey(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function normalizedHost(value) {
  if (!value) return ''
  try {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return String(value).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim()
  }
}

function hostMatches(candidate, ownHost) {
  return candidate === ownHost || candidate.endsWith(`.${ownHost}`) || ownHost.endsWith(`.${candidate}`)
}

function latestScanResponses(responses) {
  if (!responses.length) return []
  const valid = responses.filter(response => Number.isFinite(new Date(response.created_at).getTime()))
  if (!valid.length) return []
  const latest = Math.max(...valid.map(response => new Date(response.created_at).getTime()))
  return valid.filter(response => latest - new Date(response.created_at).getTime() <= LATEST_SCAN_WINDOW_MS)
}

function aggregateTier({ responses, tierOf, tier, mentionByResponseId }) {
  let total = 0
  let mentioned = 0
  for (const response of responses) {
    if (tierOf(response.prompt_id) !== tier) continue
    for (const result of Object.values(normalizeEngineResults(response, mentionByResponseId))) {
      total += 1
      if (result?.mentioned) mentioned += 1
    }
  }
  return { rate: total ? Math.round(mentioned / total * 100) : null, mentioned, total }
}

function buildMatrix({ prompts, latestResponses, tierOf, mentionByResponseId }) {
  const corePrompts = prompts.filter(prompt => tierOf(prompt.id) === 'core' && prompt.is_active !== false)
  return corePrompts.map(prompt => {
    const promptResponses = latestResponses.filter(response => response.prompt_id === prompt.id)
    const engines = Object.fromEntries(ENGINE_KEYS.map(key => {
      const values = promptResponses
        .map(response => normalizeEngineResults(response, mentionByResponseId)[key])
        .filter(Boolean)
      return [key, values.length ? values.some(value => value.mentioned) : null]
    }))
    return { promptId: prompt.id, text: prompt.text, engines }
  }).filter(item => Object.values(item.engines).some(value => value !== null))
}

function buildContentCitation({ brand, latestResponses, prompts, tierOf, mentionByResponseId }) {
  const ownHost = normalizedHost(brand?.domain)
  if (!ownHost) return null
  const infoPrompts = prompts.filter(prompt => tierOf(prompt.id) === 'info')
  const items = []

  for (const prompt of infoPrompts) {
    const promptResponses = latestResponses.filter(response => response.prompt_id === prompt.id)
    if (!promptResponses.length) continue
    const others = new Set()
    let cited = false
    for (const response of promptResponses) {
      const engines = normalizeEngineResults(response, mentionByResponseId)
      for (const engine of Object.values(engines)) {
        for (const source of engine?.sources || []) {
          const host = normalizedHost(source?.uri)
          if (!host) continue
          if (hostMatches(host, ownHost)) cited = true
          else others.add(host)
        }
      }
    }
    items.push({ promptId: prompt.id, text: prompt.text, cited, others: [...others].slice(0, 4) })
  }

  if (!items.length) return null
  const citedCount = items.filter(item => item.cited).length
  return { rate: Math.round(citedCount / items.length * 100), citedCount, total: items.length, items }
}

/**
 * 站卡/總覽用：一次算多個品牌的「品類推薦曝光率」（core 層、近 rangeDays 天）。
 * 沿用 buildVisibilityModel 同一套聚合（單一真相，與 AppVisibility 數字永遠一致）。
 * @returns Map(brandId → rate|null)  沒資料的品牌回 null（呈現「接資料中」，不捏造）
 */
export function coreExposureRates({ prompts = [], responses = [], rangeDays = 30 } = {}) {
  const brandIds = new Set([
    ...prompts.map(prompt => prompt.brand_id),
    ...responses.map(response => response.brand_id),
  ].filter(Boolean))
  const rates = new Map()
  for (const brandId of brandIds) {
    const model = buildVisibilityModel({
      brand: null, // 只取 exposure；contentCitation 需要 brand.domain、這裡用不到
      prompts: prompts.filter(prompt => prompt.brand_id === brandId),
      responses: responses.filter(response => response.brand_id === brandId),
      rangeDays,
    })
    rates.set(brandId, model.exposure.rate)
  }
  return rates
}

/**
 * 競品同題比較（2026-08-13 第一批 · 零額外掃描）：
 * 在「既有」的 AI 回答原文裡比對用戶自設的競品名稱（最多 3 個）——同一批題、同一個標準
 * （名稱沒被寫出來就算沒提到，跟自家品牌同規則）。誠實邊界：
 * - 只算「有存回答原文」的引擎回答（舊資料部分沒存 raw → 排除並以 basis 回報樣本數）
 * - 這是「提及率」不是市佔率；不做全自動品牌萃取（NER 亂猜違反誠實線）
 */
export function buildCompetitorComparison({ competitors = [], prompts = [], responses = [], mentions = [], rangeDays = 30, now = new Date() }) {
  const names = [...new Set(competitors.map(item => String(item || '').trim()).filter(Boolean))].slice(0, 3)
  if (!names.length) return null
  const tierByPromptId = Object.fromEntries(prompts.map(prompt => [prompt.id, prompt.tier || 'core']))
  const mentionByResponseId = Object.fromEntries(mentions.map(mention => [mention.response_id, mention]))
  const cutoff = new Date(now.getTime() - Math.max(1, rangeDays) * DAY_MS)

  let basis = 0        // 有原文可比對的引擎回答數（分母）
  let ownMentioned = 0
  const counts = Object.fromEntries(names.map(name => [name, 0]))
  for (const response of responses) {
    const time = new Date(response.created_at)
    if (Number.isNaN(time.getTime()) || time < cutoff || time > now) continue
    if ((tierByPromptId[response.prompt_id] || 'core') !== 'core') continue   // 只比核心品類題（同曝光率基準）
    for (const result of Object.values(normalizeEngineResults(response, mentionByResponseId))) {
      const text = typeof result?.raw === 'string' ? result.raw : ''
      if (!text) continue
      basis += 1
      if (result.mentioned) ownMentioned += 1
      const lower = text.toLowerCase()
      for (const name of names) {
        if (lower.includes(name.toLowerCase())) counts[name] += 1
      }
    }
  }

  if (!basis) return { basis: 0, own: null, rows: names.map(name => ({ name, mentioned: 0, rate: null, delta: null })) }
  const ownRate = Math.round(ownMentioned / basis * 100)
  const rows = names
    .map(name => {
      const rate = Math.round(counts[name] / basis * 100)
      return { name, mentioned: counts[name], rate, delta: rate - ownRate }
    })
    .sort((a, b) => b.rate - a.rate)
  return { basis, own: { rate: ownRate, mentioned: ownMentioned }, rows }
}

// ── 來源分類清單（2026-08-13 第二批 #5）──
// 原則：清單式判定、透明可解釋；刻意不做「低品質/內容農場」標籤（對特定網站下負面標籤有毀謗風險，
// 且無法機械驗證——Kuroma 有這功能、我們不跟）。清單不完整很正常，沒中的就標「一般網站」。
const SOCIAL_SOURCE_HOSTS = ['facebook.com', 'instagram.com', 'youtube.com', 'line.me', 'tiktok.com', 'threads.net', 'linkedin.com', 'x.com', 'twitter.com', 'pinterest.com']
// 台灣常見新聞媒體（+ 主要入口網）
const NEWS_SOURCE_HOSTS = ['udn.com', 'chinatimes.com', 'ltn.com.tw', 'ettoday.net', 'tvbs.com.tw', 'setn.com', 'storm.mg', 'cna.com.tw', 'businessweekly.com.tw', 'cw.com.tw', 'technews.tw', 'inside.com.tw', 'bnext.com.tw', 'yahoo.com', 'nownews.com', 'newtalk.tw']
// 論壇／UGC／部落格平台
const FORUM_SOURCE_HOSTS = ['ptt.cc', 'dcard.tw', 'mobile01.com', 'pixnet.net', 'medium.com', 'vocus.cc', 'blogspot.com', 'reddit.com', 'wordpress.com']
// 百科／知識庫
const WIKI_SOURCE_HOSTS = ['wikipedia.org', 'wikimedia.org', 'baike.baidu.com']

const SOURCE_CATEGORY_LABEL = {
  own: '你的網站', social: '社群', news: '新聞媒體', forum: '論壇・UGC', wiki: '百科', gov_edu: '政府・學術', general: '一般網站',
}

function matchHostList(host, list) {
  return list.some(domain => host === domain || host.endsWith(`.${domain}`))
}

// 來源網域分類：own 優先，再走清單；政府/學術看 TLD（.gov/.edu 系）
function classifySourceHost(host, ownHost) {
  if (ownHost && hostMatches(host, ownHost)) return 'own'
  if (matchHostList(host, SOCIAL_SOURCE_HOSTS)) return 'social'
  if (matchHostList(host, NEWS_SOURCE_HOSTS)) return 'news'
  if (matchHostList(host, FORUM_SOURCE_HOSTS)) return 'forum'
  if (matchHostList(host, WIKI_SOURCE_HOSTS)) return 'wiki'
  if (/\.(gov|edu)(\.[a-z]{2})?$/.test(host)) return 'gov_edu'
  return 'general'
}

export { SOURCE_CATEGORY_LABEL }

/**
 * 誰在影響 AI 的答案（來源影響力）：彙整既有回答附帶的「真實引用來源」網域，
 * 排出最常被 AI 當作答案根據的網站。全部來自結構化 sources、零猜測。
 * 同一個引擎回答內同網域只計一次（避免單回答洗版）。
 */
export function buildSourceInfluence({ brand, responses = [], rangeDays = 90, topN = 8, now = new Date() }) {
  const ownHost = normalizedHost(brand?.domain)
  const cutoff = new Date(now.getTime() - Math.max(1, rangeDays) * DAY_MS)
  const byHost = new Map()
  let answersWithSources = 0

  for (const response of responses) {
    const time = new Date(response.created_at)
    if (Number.isNaN(time.getTime()) || time < cutoff || time > now) continue
    for (const result of Object.values(normalizeEngineResults(response, {}))) {
      const sources = Array.isArray(result?.sources) ? result.sources : []
      if (!sources.length) continue
      answersWithSources += 1
      const hostsInAnswer = new Set(sources.map(source => normalizedHost(source?.uri)).filter(Boolean))
      for (const host of hostsInAnswer) {
        const entry = byHost.get(host) || { host, answers: 0, prompts: new Set() }
        entry.answers += 1
        entry.prompts.add(response.prompt_id)
        byHost.set(host, entry)
      }
    }
  }

  // 分類統計看「全部來源網域」（不只 top N），摘要才誠實
  const categoryCounts = {}
  for (const entry of byHost.values()) {
    const category = classifySourceHost(entry.host, ownHost)
    entry.category = category
    categoryCounts[category] = (categoryCounts[category] || 0) + 1
  }

  const items = [...byHost.values()]
    .sort((a, b) => b.answers - a.answers || a.host.localeCompare(b.host))
    .slice(0, topN)
    .map(entry => ({
      host: entry.host,
      answers: entry.answers,
      promptCount: entry.prompts.size,
      category: entry.category,
      isOwn: entry.category === 'own',
      isSocial: entry.category === 'social',
    }))
  return { answersWithSources, items, totalHosts: byHost.size, categoryCounts }
}

/**
 * AI 講錯你（事實監測台灣版 · 2026-08-13 第一批 #2）：
 * 拿「官方事實」（websites.org_schema_data：電話/地址/Email/網址）對照「品牌題的 AI 回答原文」，
 * 找 AI 有沒有把你的基本資料講錯。誠實邊界：
 * - 只比對「可機械驗證」的欄位；不用 LLM 猜語意（猜錯比不猜更傷信任）
 * - 「未提及」≠ 講錯——AI 沒講就標資料不足，不硬判
 * - 只有電話做「疑似有誤」判定（號碼可正規化精確比對）；地址/Email/網址只做「一致/未提及」
 */
const PHONE_CANDIDATE_RE = /\+?\d[\d\s()/-]{6,}\d/g

// 電話正規化：去非數字、+886/886 開頭轉 0 開頭（台灣慣用格式），比對才不會被格式差異騙
function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('886')) digits = `0${digits.slice(3)}`
  return digits
}

export function buildFactCheck({ orgData, brand, prompts = [], responses = [], rangeDays = 90, now = new Date() }) {
  const official = {
    telephone: String(orgData?.telephone || '').trim(),
    address: String(orgData?.address || '').trim(),
    email: String(orgData?.email || '').trim(),
    url: String(orgData?.url || brand?.domain || '').trim(),
  }
  if (!official.telephone && !official.address && !official.email && !official.url) return { noFacts: true }

  // 檢查對象＝品牌題（AI 描述你品牌的回答）；沒有品牌題就退回全部題（樣本少但誠實回報 basis）
  const tierByPromptId = Object.fromEntries(prompts.map(prompt => [prompt.id, prompt.tier || 'core']))
  const cutoff = new Date(now.getTime() - Math.max(1, rangeDays) * DAY_MS)
  const texts = []
  for (const response of responses) {
    const time = new Date(response.created_at)
    if (Number.isNaN(time.getTime()) || time < cutoff || time > now) continue
    if (tierByPromptId[response.prompt_id] !== 'brand') continue
    for (const result of Object.values(normalizeEngineResults(response, {}))) {
      if (typeof result?.raw === 'string' && result.raw) texts.push(result.raw)
    }
  }
  if (!texts.length) return { noFacts: false, basis: 0, facts: [] }

  const facts = []

  // 電話：可精確比對 → 一致／疑似有誤（列出 AI 寫的號碼）／未提及
  if (official.telephone) {
    const officialDigits = normalizePhone(official.telephone)
    let matchCount = 0
    const wrongSamples = new Set()
    for (const text of texts) {
      const candidates = (text.match(PHONE_CANDIDATE_RE) || [])
        .map(candidate => ({ shown: candidate.trim(), digits: normalizePhone(candidate) }))
        .filter(candidate => candidate.digits.length >= 8 && candidate.digits.length <= 12)
      if (!candidates.length) continue
      if (candidates.some(candidate => candidate.digits === officialDigits)) matchCount += 1
      else candidates.slice(0, 1).forEach(candidate => wrongSamples.add(candidate.shown))
    }
    facts.push({
      key: 'telephone', label: '電話', official: official.telephone,
      status: matchCount > 0 ? 'match' : wrongSamples.size > 0 ? 'conflict' : 'absent',
      matchCount, samples: [...wrongSamples].slice(0, 2),
    })
  }

  // 地址／Email／網址：只做「一致（有正確出現）／未提及」——自由文字的「講錯」判定太脆弱、不硬判
  const containment = [
    ['address', '地址', official.address, official.address.replace(/\s+/g, '')],
    ['email', 'Email', official.email, official.email.toLowerCase()],
    ['url', '官網網址', official.url, normalizedHost(official.url)],
  ]
  for (const [key, label, shown, needle] of containment) {
    if (!shown || !needle) continue
    let matchCount = 0
    for (const text of texts) {
      const haystack = key === 'address' ? text.replace(/\s+/g, '') : text.toLowerCase()
      if (haystack.includes(needle)) matchCount += 1
    }
    facts.push({ key, label, official: shown, status: matchCount > 0 ? 'match' : 'absent', matchCount, samples: [] })
  }

  return { noFacts: false, basis: texts.length, facts }
}

/**
 * AI 怎麼描述你（觀感 Lite v1 · 2026-08-13 第二批 #1）：
 * 逐引擎摘引「品牌題回答」的原話——優先挑含品牌名的那一句，並保留完整回答供展開查驗（防黑箱）。
 * 誠實邊界：v1 不做機器情緒判定（keyword 猜情緒容易冤枉 AI、違反誠實線）；
 * 只呈現「AI 真的說了什麼」，情緒標註等接 LLM 彙整（後端）再上。
 */
export function buildBrandVoice({ brandName = '', prompts = [], responses = [], rangeDays = 90, now = new Date() }) {
  const tierByPromptId = Object.fromEntries(prompts.map(prompt => [prompt.id, prompt.tier || 'core']))
  const cutoff = new Date(now.getTime() - Math.max(1, rangeDays) * DAY_MS)
  const latestByEngine = {}

  for (const response of responses) {
    const time = new Date(response.created_at)
    if (Number.isNaN(time.getTime()) || time < cutoff || time > now) continue
    if (tierByPromptId[response.prompt_id] !== 'brand') continue
    const engines = normalizeEngineResults(response, {})
    for (const key of ENGINE_KEYS) {
      const raw = typeof engines[key]?.raw === 'string' ? engines[key].raw.trim() : ''
      if (!raw) continue
      const existing = latestByEngine[key]
      if (!existing || response.created_at > existing.at) {
        latestByEngine[key] = { engine: key, raw, at: response.created_at }
      }
    }
  }

  return ENGINE_KEYS
    .filter(key => latestByEngine[key])
    .map(key => {
      const item = latestByEngine[key]
      // 摘句：優先「含品牌名」的第一句；沒有就取開頭第一句（照樣是原話、不改寫）
      const sentences = item.raw.split(/(?<=[。！？!?])\s*|\n+/).map(part => part.trim()).filter(Boolean)
      const hit = brandName ? sentences.find(part => part.includes(brandName)) : null
      const quote = (hit || sentences[0] || item.raw).slice(0, 160)
      return { ...item, quote, hasBrandName: Boolean(hit) }
    })
}

export function buildVisibilityModel({
  brand,
  prompts = [],
  responses = [],
  mentions = [],
  rangeDays = 7,
  now = new Date(),
}) {
  const tierByPromptId = Object.fromEntries(prompts.map(prompt => [prompt.id, prompt.tier || 'core']))
  const tierOf = promptId => tierByPromptId[promptId] || 'core'
  const mentionByResponseId = Object.fromEntries(mentions.map(mention => [mention.response_id, mention]))
  const cutoff = new Date(now.getTime() - Math.max(1, rangeDays) * DAY_MS)
  const rangedResponses = responses.filter(response => {
    const time = new Date(response.created_at)
    return !Number.isNaN(time.getTime()) && time >= cutoff && time <= now
  })
  const latestResponses = latestScanResponses(rangedResponses)
  const exposure = aggregateTier({ responses: rangedResponses, tierOf, tier: 'core', mentionByResponseId })
  const brandRecognition = aggregateTier({ responses: rangedResponses, tierOf, tier: 'brand', mentionByResponseId })

  const perEngine = ENGINE_KEYS.map(key => {
    let total = 0
    let mentioned = 0
    for (const response of rangedResponses) {
      if (tierOf(response.prompt_id) !== 'core') continue
      const result = normalizeEngineResults(response, mentionByResponseId)[key]
      if (!result) continue
      total += 1
      if (result.mentioned) mentioned += 1
    }
    return { key, total, mentioned, rate: total ? Math.round(mentioned / total * 100) : null }
  })

  const byDay = {}
  for (const response of rangedResponses) {
    if (tierOf(response.prompt_id) !== 'core') continue
    const key = dayKey(response.created_at)
    if (!key) continue
    if (!byDay[key]) byDay[key] = { total: 0, mentioned: 0 }
    for (const result of Object.values(normalizeEngineResults(response, mentionByResponseId))) {
      byDay[key].total += 1
      if (result?.mentioned) byDay[key].mentioned += 1
    }
  }

  const trend = []
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let offset = rangeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(utcToday - offset * DAY_MS)
    const key = date.toISOString().slice(0, 10)
    const stat = byDay[key] || { total: 0, mentioned: 0 }
    trend.push({ key, total: stat.total, rate: stat.total ? Math.round(stat.mentioned / stat.total * 100) : null })
  }

  const dataDays = trend.filter(day => day.total > 0)
  const delta = dataDays.length >= 2 ? dataDays.at(-1).rate - dataDays.at(-2).rate : null

  return {
    exposure: { ...exposure, delta },
    brandRecognition: brandRecognition.total ? brandRecognition : null,
    perEngine,
    trend,
    matrix: buildMatrix({ prompts, latestResponses, tierOf, mentionByResponseId }),
    contentCitation: buildContentCitation({ brand, latestResponses, prompts, tierOf, mentionByResponseId }),
    latestScanAt: latestResponses.length
      ? latestResponses.reduce((latest, response) => response.created_at > latest ? response.created_at : latest, latestResponses[0].created_at)
      : null,
  }
}
