/**
 * GSC 數據分析服務
 * 透過 /api/gsc-data Vercel proxy 串接 Google Search Console API
 */

import { getAccessToken } from './googleAuth'

function parseGSCResponse(response) {
  if (!response.rows || response.rows.length === 0) {
    return { summary: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, timeline: [], topQueries: [] }
  }

  const summary = { clicks: 0, impressions: 0, ctr: 0, position: 0 }
  const dateMap = new Map()
  const queryMap = new Map()

  response.rows.forEach(row => {
    const keys = row.keys || []
    const date = keys[0] || ''
    const query = keys[1] || ''
    const { clicks = 0, impressions = 0, ctr = 0, position = 0 } = row

    summary.clicks += clicks
    summary.impressions += impressions

    if (date) {
      if (!dateMap.has(date)) {
        dateMap.set(date, { clicks: 0, impressions: 0, ctrValues: [], positionValues: [] })
      }
      const d = dateMap.get(date)
      d.clicks += clicks
      d.impressions += impressions
      d.ctrValues.push(ctr)
      d.positionValues.push(position)
    }

    if (query) {
      if (!queryMap.has(query)) {
        queryMap.set(query, { clicks: 0, impressions: 0, ctr: 0, position: 0, positionValues: [] })
      }
      const q = queryMap.get(query)
      q.clicks += clicks
      q.impressions += impressions
      q.positionValues.push(position)
    }
  })

  const timeline = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.ctrValues.length > 0
        ? Math.round(data.ctrValues.reduce((a, b) => a + b, 0) / data.ctrValues.length * 10000) / 10000
        : 0,
      position: data.positionValues.length > 0
        ? Math.round(data.positionValues.reduce((a, b) => a + b, 0) / data.positionValues.length * 100) / 100
        : 0,
    }))

  const topQueries = Array.from(queryMap.entries())
    .map(([query, data]) => ({
      query,
      clicks: data.clicks,
      impressions: data.impressions,
      ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
      position: data.positionValues.length > 0
        ? data.positionValues.reduce((a, b) => a + b, 0) / data.positionValues.length
        : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 20)

  if (summary.impressions > 0) summary.ctr = summary.clicks / summary.impressions
  if (timeline.length > 0) {
    summary.position = timeline.reduce((sum, d) => sum + d.position, 0) / timeline.length
  }

  return { summary, timeline, topQueries }
}

async function gscRequest(siteUrl, dimensions, rowLimit, options = {}) {
  const token = getAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')
  const res = await fetch('/api/gsc-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      siteUrl,
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
      dimensions,
      rowLimit,
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'GSC fetch failed') }
  return res.json()
}

export async function getGSCTopPages(siteUrl, options = {}) {
  const raw = await gscRequest(siteUrl, ['page'], 50, options)
  if (!raw.rows) return []
  return raw.rows.map(row => ({
    page: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))
}

export async function getGSCDevices(siteUrl, options = {}) {
  const raw = await gscRequest(siteUrl, ['device'], 5, options)
  if (!raw.rows) return []
  return raw.rows.map(row => ({
    device: row.keys[0],
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }))
}

export async function getGSCSummary(siteUrl, options = {}) {
  if (!siteUrl) throw new Error('GSC Site URL is required')

  const token = getAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const res = await fetch('/api/gsc-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      siteUrl,
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'GSC fetch failed')
  }

  const response = await res.json()
  const { summary, timeline, topQueries } = parseGSCResponse(response)

  return {
    siteUrl,
    period: {
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    },
    clicks: summary.clicks,
    impressions: summary.impressions,
    ctr: Math.round(summary.ctr * 10000) / 10000,
    position: Math.round(summary.position * 100) / 100,
    timeline,
    topQueries,
    fetchedAt: new Date().toISOString(),
  }
}
