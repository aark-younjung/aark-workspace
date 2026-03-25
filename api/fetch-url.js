/**
 * Serverless Function - 網站內容抓取
 * 解決 CORS 跨域問題
 */

export default async function handler(req, res) {
  // 允許所有來源
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // 處理預檢請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: '缺少 URL 參數' })
    }

    // 驗證 URL
    let targetUrl
    try {
      targetUrl = new URL(url)
    } catch {
      return res.status(400).json({ error: '無效的 URL' })
    }

    // 使用 allorigins.win 代理服務（從伺服器端繞過 CORS）
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl.toString())}`
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20000) // 20秒超時
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `HTTP ${response.status}` })
    }

    const html = await response.text()

    // 返回內容
    return res.status(200).json({
      success: true,
      url: targetUrl.toString(),
      content: html,
      status: response.status
    })

  } catch (error) {
    console.error('Fetch error:', error)
    return res.status(500).json({
      error: '抓取失敗',
      message: error.message
    })
  }
}
