/**
 * POST /api/gsc-data
 * 代理 Google Search Console API 請求
 *
 * Headers: Authorization: Bearer <google_access_token>
 * Body: { siteUrl, startDate?, endDate?, dimensions?, rowLimit? }
 */

function toGSCDate(dateStr) {
  const now = new Date()
  if (dateStr === 'today') return now.toISOString().split('T')[0]
  if (dateStr === 'yesterday') {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }
  const match = dateStr.match(/^(\d+)daysAgo$/)
  if (match) {
    const d = new Date(now); d.setDate(d.getDate() - parseInt(match[1]))
    return d.toISOString().split('T')[0]
  }
  return dateStr
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '缺少 Google access token' })
  }

  const accessToken = authHeader.slice(7)
  const {
    siteUrl,
    startDate = '30daysAgo',
    endDate = 'today',
    dimensions = ['date', 'query'],
    rowLimit = 500,
  } = req.body

  if (!siteUrl) return res.status(400).json({ error: 'siteUrl 必填' })

  try {
    const encodedUrl = encodeURIComponent(siteUrl)
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: toGSCDate(startDate),
          endDate: toGSCDate(endDate),
          dimensions,
          rowLimit,
          startRow: 0,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      const msg = data.error?.message || 'GSC API 錯誤'
      console.error('GSC API error:', msg)
      return res.status(response.status).json({ error: msg })
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('GSC proxy error:', err)
    return res.status(500).json({ error: err.message })
  }
}
