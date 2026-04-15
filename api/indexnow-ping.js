export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    const baseUrl = url.replace(/\/$/, '')
    const sitemapUrl = encodeURIComponent(`${baseUrl}/sitemap.xml`)

    const [googleRes, bingRes] = await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' }),
      fetch(`https://www.bing.com/ping?sitemap=${sitemapUrl}`, { method: 'GET' }),
    ])

    res.json({
      success: true,
      google: googleRes.status === 'fulfilled' ? googleRes.value.status : 'error',
      bing: bingRes.status === 'fulfilled' ? bingRes.value.status : 'error',
      pingedAt: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
