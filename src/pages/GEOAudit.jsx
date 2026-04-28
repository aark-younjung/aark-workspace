import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeGEO } from '../services/geoAnalyzer'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const GEO_CHECKS = [
  {
    id: 'llms_txt',
    name: 'llms.txt',
    description: '網站根目錄是否有 /llms.txt 檔案，讓 ChatGPT、Claude、Perplexity 等 AI 工具能識別你的品牌與服務內容',
    icon: '🤖',
    recommendation: '在根目錄建立 /llms.txt，用自然語言描述你的品牌、服務與聯絡方式'
  },
  {
    id: 'robots_ai',
    name: 'AI 爬蟲開放性',
    description: '檢測 robots.txt 是否封鎖 GPTBot、PerplexityBot、Google-Extended 等主要 AI 爬蟲',
    icon: '🚦',
    recommendation: '確認 robots.txt 沒有 Disallow GPTBot 或 Google-Extended，允許 AI 爬蟲索引你的內容'
  },
  {
    id: 'sitemap',
    name: 'Sitemap.xml',
    description: '網站根目錄是否有 /sitemap.xml，幫助 AI 爬蟲發現並索引你的所有頁面',
    icon: '🗺️',
    recommendation: '建立並提交 sitemap.xml，確保所有重要頁面都被 AI 爬蟲發現'
  },
  {
    id: 'open_graph',
    name: 'Open Graph',
    description: '是否有完整的 og:title、og:description、og:image、og:url 標籤，AI 引用時作為內容摘要依據',
    icon: '🔗',
    recommendation: '為每個頁面添加完整的 Open Graph 標籤，讓 AI 引用時能呈現正確的標題與描述'
  },
  {
    id: 'twitter_card',
    name: 'Twitter Card',
    description: '是否有 twitter:card、twitter:title、twitter:image 標籤，強化 AI 摘要中的社群信號',
    icon: '🐦',
    recommendation: '添加 Twitter Card 標籤（twitter:card, twitter:title, twitter:image）'
  },
  {
    id: 'json_ld_citation',
    name: 'JSON-LD 引用信號',
    description: '結構化資料中是否包含 author、publisher、datePublished 等可信度資訊，讓 AI 判斷內容可信度',
    icon: '📜',
    recommendation: '在 JSON-LD 中加入 author（作者）、publisher（出版者）、datePublished（發布日期）'
  },
  {
    id: 'canonical',
    name: 'Canonical 標籤',
    description: '是否有 canonical 標籤，告訴 AI 正確的引用來源 URL，避免引用到重複頁面',
    icon: '🔒',
    recommendation: '在每個頁面 <head> 設置 <link rel="canonical" href="...">，確保 AI 引用正確 URL'
  },
  {
    id: 'https',
    name: 'HTTPS 安全連線',
    description: '網站是否使用 HTTPS，AI 傾向引用安全可信的來源',
    icon: '🔐',
    recommendation: '確保網站使用 HTTPS，向 AI 傳遞「此網站安全可信」的信號'
  }
]

export default function GEOAudit() {
  const { id } = useParams()
  const [website, setWebsite] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)

      const { data: geoData } = await supabase
        .from('geo_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setGeoAudit(geoData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheckStatus = (checkId) => {
    if (!geoAudit) return 'unknown'
    return geoAudit[checkId] ? 'pass' : 'fail'
  }

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeGEO(website.url)
      await supabase.from('geo_audits').insert([{
        website_id: id,
        score: result.score,
        llms_txt: result.llms_txt,
        robots_ai: result.robots_ai,
        sitemap: result.sitemap,
        open_graph: result.open_graph,
        twitter_card: result.twitter_card,
        json_ld_citation: result.json_ld_citation,
        canonical: result.canonical,
        https: result.https,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  const passedCount = GEO_CHECKS.filter(check => getCheckStatus(check.id) === 'pass').length
  const totalCount = GEO_CHECKS.length
  const score = geoAudit ? geoAudit.score : Math.round((passedCount / totalCount) * 100)

  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <div className="flex items-center justify-center relative z-10" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.geo }}></div>
            <p style={{ color: T.textMid }}>載入資料中...</p>
          </div>
        </div>
        <Footer dark />
      </PageBg>
    )
  }

  return (
    <PageBg>
      <SiteHeader />
      <div className="relative z-10">
        {/* 頁內標題列：返回箭頭 + GEO 標題 + 網址（取代原獨立 header） */}
        <div className="max-w-7xl mx-auto px-6 pt-8">
          <div className="flex items-center gap-4 mb-6">
            <Link to={`/dashboard/${id}`} className="transition-colors hover:opacity-80" style={{ color: T.textMid }} aria-label="返回 Dashboard">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: T.text }}>GEO 技術檢測</h1>
                {/* GEO 綠色強調膠囊 */}
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
                  padding: '3px 8px', borderRadius: 5,
                  background: `linear-gradient(90deg, ${T.geo}33, #14b8a633)`,
                  color: T.geo, border: `1px solid ${T.geo}55`,
                }}>GEO</span>
              </div>
              <p className="text-sm mt-1" style={{ color: T.textMid }}>Generative Engine Optimization — 生成式 AI 引用優化</p>
              {website?.url && <p className="text-xs mt-1" style={{ color: T.textLow }}>{website.url}</p>}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-6 pb-8">
          {/* 總覽分數卡 */}
          <GlassCard color={T.geo} style={{ padding: 32, marginBottom: 32 }}>
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: T.text }}>GEO 技術檢測得分</h2>
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-5xl font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${T.geo}, #14b8a6)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >{score}</span>
                  <span style={{ color: T.textMid }}>/ 100</span>
                </div>
                <p className="mt-2" style={{ color: T.textMid }}>通過 {passedCount} / {totalCount} 項檢測</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReanalyze}
                  disabled={analyzing}
                  className="px-6 py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${T.geo}, #14b8a6)`,
                    boxShadow: `0 8px 24px ${T.geo}40`,
                  }}
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      分析中...
                    </>
                  ) : '重新檢測'}
                </button>
                <Link
                  to={`/dashboard/${id}`}
                  className="px-6 py-3 rounded-xl transition-all font-medium"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${T.cardBorder}`,
                    color: T.text,
                  }}
                >
                  返回總覽
                </Link>
              </div>
            </div>

            {/* 進度條 */}
            <div className="mt-8">
              <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${T.geo}, #14b8a6)` }}
                />
              </div>
            </div>
          </GlassCard>

          {/* 檢測項目列表 */}
          <div className="grid md:grid-cols-2 gap-6">
            {GEO_CHECKS.map((check) => {
              const status = getCheckStatus(check.id)
              const statusColor = status === 'pass' ? T.pass : status === 'fail' ? T.fail : null
              return (
                <GlassCard key={check.id} color={statusColor} style={{ padding: 24 }}>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{check.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className="font-semibold" style={{ color: T.text }}>{check.name}</h3>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                          style={{
                            background: status === 'pass' ? T.pass + '26' : status === 'fail' ? T.fail + '26' : 'rgba(255,255,255,0.06)',
                            color: status === 'pass' ? '#86efac' : status === 'fail' ? '#fca5a5' : T.textMid,
                          }}
                        >
                          {status === 'pass' ? '✓ 通過' : status === 'fail' ? '✗ 未通過' : '⏳ 未知'}
                        </span>
                      </div>
                      <p className="text-sm mb-4" style={{ color: T.textMid }}>{check.description}</p>
                      {status === 'fail' && (
                        <div
                          className="p-3 rounded-lg"
                          style={{ background: T.geo + '14', border: `1px solid ${T.geo}33` }}
                        >
                          <p className="text-xs font-medium mb-1" style={{ color: '#6ee7b7' }}>💡 建議優化</p>
                          <p className="text-sm" style={{ color: T.textMid }}>{check.recommendation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </div>

          {/* 生成式 AI 優化建議 */}
          <div className="mt-8">
            <GlassCard color={T.geo} style={{ padding: 32 }}>
              <h3 className="text-xl font-bold mb-4" style={{ color: T.text }}>🤖 提升 AI 引用率的建議</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                  <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>建立 /llms.txt 描述品牌與服務內容</li>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>確認 robots.txt 未封鎖主要 AI 爬蟲</li>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>補齊 Open Graph 與 Twitter Card 標籤</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                  <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>在 JSON-LD 中加入 author、publisher、datePublished</li>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>建立並提交完整的 sitemap.xml</li>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>確保所有頁面有正確的 canonical 標籤</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </div>
        </main>
      </div>
      <Footer dark />
    </PageBg>
  )
}

// 共用的暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 上方青綠漸層光暈 + 雜訊）
// 註：頁面高度通常不及首頁，下方漸層會壓到上半部反而互蓋，故捨棄只保留上方
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
