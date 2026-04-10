/**
 * GA4 數據分析服務
 * 透過 /api/ga4-data Vercel proxy 串接 Google Analytics 4 Data API
 */

import { getAccessToken } from './googleAuth'

function parseGA4Response(response) {
  if (!response.rows || response.rows.length === 0) {
    return {
      summary: { sessions: 0, activeUsers: 0, bounceRate: 0, pageViews: 0, newUsers: 0, engagedSessions: 0 },
      timeline: []
    }
  }

  const summary = { sessions: 0, activeUsers: 0, bounceRate: 0, pageViews: 0, newUsers: 0, engagedSessions: 0 }

  const timeline = response.rows.map(row => {
    const dateStr = row.dimensionValues[0].value
    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`

    const metrics = {
      sessions: parseInt(row.metricValues[0].value) || 0,
      activeUsers: parseInt(row.metricValues[1].value) || 0,
      bounceRate: parseFloat(row.metricValues[2].value) || 0,
      pageViews: parseInt(row.metricValues[3].value) || 0,
      newUsers: parseInt(row.metricValues[4].value) || 0,
      engagedSessions: parseInt(row.metricValues[5].value) || 0,
    }

    summary.sessions += metrics.sessions
    summary.activeUsers += metrics.activeUsers
    summary.pageViews += metrics.pageViews
    summary.newUsers += metrics.newUsers
    summary.engagedSessions += metrics.engagedSessions

    return { date: formattedDate, ...metrics }
  })

  if (timeline.length > 0) {
    summary.bounceRate = timeline.reduce((sum, d) => sum + d.bounceRate, 0) / timeline.length
  }

  return { summary, timeline }
}

async function ga4Request(propertyId, reportType, options = {}) {
  const token = getAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')
  const res = await fetch('/api/ga4-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      propertyId,
      reportType,
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    }),
  })
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'GA4 fetch failed') }
  return res.json()
}

export async function getGA4Channels(propertyId, options = {}) {
  const raw = await ga4Request(propertyId, 'channels', options)
  if (!raw.rows) return []
  return raw.rows.map(row => ({
    channel: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value) || 0,
    activeUsers: parseInt(row.metricValues[1].value) || 0,
    newUsers: parseInt(row.metricValues[2].value) || 0,
    bounceRate: Math.round(parseFloat(row.metricValues[3].value) * 100) || 0,
    engagedSessions: parseInt(row.metricValues[4].value) || 0,
  }))
}

export async function getGA4TopPages(propertyId, options = {}) {
  const raw = await ga4Request(propertyId, 'pages', options)
  if (!raw.rows) return []
  return raw.rows.map(row => ({
    path: row.dimensionValues[0].value,
    title: row.dimensionValues[1].value,
    pageViews: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
    bounceRate: Math.round(parseFloat(row.metricValues[2].value) * 100) || 0,
    avgDuration: Math.round(parseFloat(row.metricValues[3].value)),
    engagedSessions: parseInt(row.metricValues[4].value) || 0,
  }))
}

export async function getGA4Devices(propertyId, options = {}) {
  const raw = await ga4Request(propertyId, 'devices', options)
  if (!raw.rows) return []
  return raw.rows.map(row => ({
    device: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
    bounceRate: Math.round(parseFloat(row.metricValues[2].value) * 100) || 0,
  }))
}

export async function getGA4Summary(propertyId, options = {}) {
  if (!propertyId) throw new Error('GA4 Property ID is required')

  const token = getAccessToken()
  if (!token) throw new Error('NOT_AUTHENTICATED')

  const res = await fetch('/api/ga4-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      propertyId,
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'GA4 fetch failed')
  }

  const response = await res.json()
  const { summary, timeline } = parseGA4Response(response)

  return {
    propertyId,
    period: {
      startDate: options.startDate || '30daysAgo',
      endDate: options.endDate || 'today',
    },
    sessions: summary.sessions,
    activeUsers: summary.activeUsers,
    bounceRate: Math.round(summary.bounceRate * 100) / 100,
    pageViews: summary.pageViews,
    newUsers: summary.newUsers,
    engagedSessions: summary.engagedSessions,
    avgSessionDuration: summary.sessions > 0
      ? Math.round((summary.engagedSessions / summary.sessions) * 100)
      : 0,
    timeline,
    fetchedAt: new Date().toISOString(),
  }
}
