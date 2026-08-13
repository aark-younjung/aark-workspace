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
