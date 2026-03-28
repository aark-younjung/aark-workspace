/**
 * POST /api/ga4-data
 * 代理 Google Analytics 4 Data API 請求
 *
 * Headers: Authorization: Bearer <google_access_token>
 * Body: { propertyId, startDate?, endDate? }
 */

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
  const { propertyId, startDate = '30daysAgo', endDate = 'today' } = req.body

  if (!propertyId) return res.status(400).json({ error: 'propertyId 必填' })

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'bounceRate' },
            { name: 'screenPageViews' },
            { name: 'newUsers' },
            { name: 'engagedSessions' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      const msg = data.error?.message || 'GA4 API 錯誤'
      console.error('GA4 API error:', msg)
      return res.status(response.status).json({ error: msg })
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('GA4 proxy error:', err)
    return res.status(500).json({ error: err.message })
  }
}
