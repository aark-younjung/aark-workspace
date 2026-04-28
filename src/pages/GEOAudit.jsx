import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeGEO } from '../services/geoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import { GlassCard, IssueBoard, IssueBoardSkeleton, AuditTopBar, ScoreHero } from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const GEO_ACCENT = T.geo
const GEO_ACCENT2 = '#14b8a6'

const GEO_CHECKS = [
  {
    id: 'llms_txt',
    name: 'llms.txt',
    description: '網站根目錄是否有 /llms.txt 檔案，讓 ChatGPT、Claude、Perplexity 等 AI 工具能識別你的品牌與服務內容',
    icon: '🤖',
    priority: 'P1',
    recommendation: '在根目錄建立 /llms.txt，用自然語言描述你的品牌、服務與聯絡方式',
  },
  {
    id: 'robots_ai',
    name: 'AI 爬蟲開放性',
    description: '檢測 robots.txt 是否封鎖 GPTBot、PerplexityBot、Google-Extended 等主要 AI 爬蟲',
    icon: '🚦',
    priority: 'P1',
    recommendation: '確認 robots.txt 沒有 Disallow GPTBot 或 Google-Extended，允許 AI 爬蟲索引你的內容',
  },
  {
    id: 'sitemap',
    name: 'Sitemap.xml',
    description: '網站根目錄是否有 /sitemap.xml，幫助 AI 爬蟲發現並索引你的所有頁面',
    icon: '🗺️',
    priority: 'P2',
    recommendation: '建立並提交 sitemap.xml，確保所有重要頁面都被 AI 爬蟲發現',
  },
  {
    id: 'open_graph',
    name: 'Open Graph',
    description: '是否有完整的 og:title、og:description、og:image、og:url 標籤，AI 引用時作為內容摘要依據',
    icon: '🔗',
    priority: 'P2',
    recommendation: '為每個頁面添加完整的 Open Graph 標籤，讓 AI 引用時能呈現正確的標題與描述',
  },
  {
    id: 'twitter_card',
    name: 'Twitter Card',
    description: '是否有 twitter:card、twitter:title、twitter:image 標籤，強化 AI 摘要中的社群信號',
    icon: '🐦',
    priority: 'P3',
    recommendation: '添加 Twitter Card 標籤（twitter:card, twitter:title, twitter:image）',
  },
  {
    id: 'json_ld_citation',
    name: 'JSON-LD 引用信號',
    description: '結構化資料中是否包含 author、publisher、datePublished 等可信度資訊，讓 AI 判斷內容可信度',
    icon: '📜',
    priority: 'P2',
    recommendation: '在 JSON-LD 中加入 author（作者）、publisher（出版者）、datePublished（發布日期）',
  },
  {
    id: 'canonical',
    name: 'Canonical 標籤',
    description: '是否有 canonical 標籤，告訴 AI 正確的引用來源 URL，避免引用到重複頁面',
    icon: '🔒',
    priority: 'P1',
    recommendation: '在每個頁面 <head> 設置 <link rel="canonical" href="...">，確保 AI 引用正確 URL',
  },
  {
    id: 'https',
    name: 'HTTPS 安全連線',
    description: '網站是否使用 HTTPS，AI 傾向引用安全可信的來源',
    icon: '🔐',
    priority: 'P1',
    recommendation: '確保網站使用 HTTPS，向 AI 傳遞「此網站安全可信」的信號',
  },
]

export default function GEOAudit() {
  const { id } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
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

      // 近 7 筆分數，給 ScoreHero 7 日趨勢迷你圖用
      const { data: recentData } = await supabase
        .from('geo_audits').select('score, created_at').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(7)
      setRecentAudits(recentData || [])
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

  // 把 GEO_CHECKS 與 audit 結果合併成 IssueBoard 需要的形狀（passed + detail）
  const checks = GEO_CHECKS.map(c => ({
    ...c,
    passed: getCheckStatus(c.id) === 'pass',
    detail: c.description,
  }))

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
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>
          {/* 頂部麵包屑列：返回 Dashboard + 重新檢測 + 匯出 PDF（與 SEO 同款） */}
          <AuditTopBar
            websiteId={id}
            face="GEO"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={T.geo}
            accent2={GEO_ACCENT2}
          />

          {/* 分數總覽 Hero（與 SEO 同款，單欄） */}
          <div style={{ marginBottom: 32 }}>
            <ScoreHero
              face="GEO"
              subChip="技術檢測"
              tagline="Generative Engine Optimization — 生成式 AI 引用優化"
              score={score}
              passedCount={passedCount}
              failedCount={totalCount - passedCount}
              total={totalCount}
              recentAudits={recentAudits}
              accent={T.geo}
            />
          </div>

          {/* 詳細檢測項目（看板式 IssueBoard）— 與 SEO 同款 */}
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
            <div style={{ fontSize: 12, color: T.textLow }}>依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟</div>
          </div>
          <div style={{ marginBottom: 32 }}>
            {!geoAudit ? <IssueBoardSkeleton /> : <IssueBoard checks={checks} isPro={isPro} accent={GEO_ACCENT} accentGlow={`${GEO_ACCENT}28`} />}
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
