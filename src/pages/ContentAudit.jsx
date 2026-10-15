import { useState } from 'react'
import { CONTENT_CHECKS } from '../data/contentChecks'
import { useAuth } from '../context/AuthContext'
import { analyzeContent } from '../services/contentAnalyzer'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import { ScoreHero, IssueBoard, ContentSignature, ArticleAnalysisTabs } from '../components/v2'

const CONTENT_ACCENT = '#ec4899' // 內容品質粉紅（與 Dashboard 第五分數一致）
const CONTENT_ACCENT2 = '#f472b6'


/**
 * /content-audit — ad-hoc 任意網址分析（公開、不需登入、不寫 DB）。
 *
 * 2026-09-08：原本綁定網站的 DB-backed 模式已搬到 components/appshell/AppContent.jsx
 * （亮色 app-shell，路由 /app/:websiteId/content），/content-audit/:id 改為轉址過去。
 * 這一支刻意**留在深色公開版**：它是公開頁 header/footer 連過來的獲客入口，
 * 未登入也能用，搬進 app-shell 等於把入口關進登入牆。
 *
 * 檢測項與 DB 轉換共用 data/contentChecks.js，兩種模式用同一份判定標準。
 */
export default function ContentAudit() {
  return <AdHocMode />
}

// =====================================================
// 模式 A — ad-hoc 任意 URL 分析（原本的 /content-audit）
//   保留任意文章分析能力：競品文、客戶文、外部文章
//   不寫 DB（沒 :id 就沒網站歸屬，寫進去是 orphan row）
// =====================================================
function AdHocMode() {
  const { isPro } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    let cleanUrl = url.trim()
    if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl

    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await analyzeContent(cleanUrl)
      setResult(data)
    } catch (err) {
      setError(err.message || '分析失敗，請確認網址是否正確')
    } finally {
      setLoading(false)
    }
  }

  const passedCount = result ? CONTENT_CHECKS.filter(c => c.get(result)).length : 0
  const checks = result ? CONTENT_CHECKS.map(c => ({
    id: c.id,
    name: c.label,
    icon: c.icon,
    priority: c.priority,
    passed: c.get(result),
    detail: c.detail(result),
    recommendation: c.fix,
  })) : []

  return (
    <PageBg>
      <SiteHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* 文章分析統一 tab — 沒 websiteId 時批次模式變灰並顯示提示 */}
        <ArticleAnalysisTabs active="single" websiteId={null} />

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full text-sm font-medium mb-5">
            📄 文章內容分析
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">讓你的文章被 AI 看見</h1>
          <p className="text-white/60 text-lg">輸入任一篇文章或頁面網址，立即分析 AI 能見度、AEO 友善度與內容品質</p>
        </div>

        {/* 輸入框 */}
        <form onSubmit={handleAnalyze} className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-sm mb-8">
          <label className="block text-sm font-medium text-white mb-2">文章或頁面網址</label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://yourblog.com/your-article"
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? '分析中...' : '開始分析'}
            </button>
          </div>
          {error && <p className="mt-3 text-red-400 text-sm">{error}</p>}
          <p className="mt-3 text-sm text-white/40">支援部落格文章、產品頁、服務介紹頁等任意公開網址・分析約需 10–20 秒</p>
        </form>

        {/* 載入動畫 */}
        {loading && (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-10 text-center shadow-sm mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
            <p className="text-white/70 font-medium">正在分析文章內容...</p>
            <p className="text-white/40 text-sm mt-1">檢查標題結構、字數、Meta 標籤、AEO 友善度等 15 項指標</p>
          </div>
        )}

        {/* 分析結果 */}
        {result && (
          <>
            <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
              <ScoreHero
                face="內容品質"
                subChip="文章分析"
                tagline={result.url}
                score={result.score}
                passedCount={passedCount}
                failedCount={CONTENT_CHECKS.length - passedCount}
                total={CONTENT_CHECKS.length}
                recentAudits={[]}
                accent={CONTENT_ACCENT}
              />
              <div style={{
                background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
                borderRadius: T.rL, padding: 24,
              }}>
                <ContentSignature result={result} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
              <div style={{ fontSize: 14, color: T.textLow }}>依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟</div>
            </div>
            <div style={{ marginBottom: 32 }}>
              <IssueBoard checks={checks} isPro={isPro} accent={CONTENT_ACCENT} accentGlow={`${CONTENT_ACCENT}28`} />
            </div>

            <div className="text-center">
              <button
                onClick={() => { setResult(null); setUrl('') }}
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                ← 分析其他文章
              </button>
            </div>
          </>
        )}

        {/* 說明區塊（未分析時） */}
        {!result && !loading && (
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            {[
              { icon: '🏗️', title: '內容結構', desc: '檢查 H1/H2/H3 層級、問句式標題，讓 AI 更容易理解文章架構' },
              { icon: '🤖', title: 'AEO 友善度', desc: '分析 FAQ Schema、直接回答段落，提升被 AI 引用為答案的機率' },
              { icon: '🏆', title: '可信度指標', desc: '確認作者資訊、發布日期、內部連結，強化 E-E-A-T 評分' },
            ].map((item, i) => (
              <div key={i} className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 text-center shadow-sm">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-white/60 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer dark />
    </PageBg>
  )
}

// 共用的暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 左上 155deg + 右下 335deg 雙漸層 + 雜訊）
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層光暈 — 從頁首左上往中央漸隱至純黑 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'var(--t-bg, linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%))',
        mixBlendMode: 'lighten',
      }} />
      {/* 下方青綠漸層光暈 — 從頁尾右下往左上擴散（335deg = 155deg 雙軸鏡像） */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒感疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
