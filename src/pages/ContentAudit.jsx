import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { analyzeContent } from '../services/contentAnalyzer'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import {
  AuditTopBar, ScoreHero, HeroSkeleton,
  IssueBoard, IssueBoardSkeleton, ContentSignature,
  ArticleAnalysisTabs,
} from '../components/v2'

const CONTENT_ACCENT = '#ec4899' // 內容品質粉紅（與 Dashboard 第五分數一致）
const CONTENT_ACCENT2 = '#f472b6'

const CHECKS = [
  {
    id: 'h1', category: '內容結構', icon: '📖',
    label: '單一 H1 標題', priority: 'P1',
    desc: '每篇文章應只有一個 H1，清楚說明主題',
    get: r => r.heading.hasProperH1,
    detail: r => r.heading.h1Count === 0 ? '找不到 H1 標題' : r.heading.h1Count > 1 ? `有 ${r.heading.h1Count} 個 H1（應只有 1 個）` : `「${r.heading.h1Content?.slice(0, 40)}${r.heading.h1Content?.length > 40 ? '...' : ''}」`,
    fix: '確保文章只有一個主標題 <h1>，其他層級用 <h2>、<h3>',
  },
  {
    id: 'h2', category: '內容結構', icon: '🗂️',
    label: 'H2 段落結構', priority: 'P2',
    desc: '至少 2 個 H2 子標題，幫助 AI 理解文章架構',
    get: r => r.heading.hasH2Structure,
    detail: r => `目前有 ${r.heading.h2Count} 個 H2 標題`,
    fix: '將文章分成多個段落，每段用 <h2> 標題，建議至少 2 個',
  },
  {
    id: 'question', category: '內容結構', icon: '❓',
    label: '問句式標題', priority: 'P2',
    desc: '「什麼是...？」「如何...？」格式的標題最容易被 AI 引用為答案',
    get: r => r.heading.hasQuestionHeadings,
    detail: r => `目前有 ${r.heading.questionHeadings} 個問句式 H2/H3`,
    fix: '將部分子標題改為問句，例如「什麼是 SEO？」「如何提升排名？」',
  },
  {
    id: 'wordcount', category: '字數與深度', icon: '📝',
    label: '字數達 800 字以上', priority: 'P1',
    desc: 'AI 傾向引用有足夠深度的長篇內容',
    get: r => r.wordCount.isLongForm,
    detail: r => `目前約 ${r.wordCount.totalWords.toLocaleString()} 字${r.wordCount.isDeep ? '（優秀！超過 1500 字）' : ''}`,
    fix: '擴充文章內容，加入具體案例、數據或步驟說明，目標 800 字以上',
  },
  {
    id: 'directanswer', category: '字數與深度', icon: '💡',
    label: '首段直接給出答案', priority: 'P1',
    desc: 'AI 偏好在文章開頭就直接回答問題的寫法',
    get: r => r.aeo.hasDirectAnswer,
    detail: r => r.aeo.hasDirectAnswer ? '首段結構良好，適合被 AI 擷取' : '首段過長或過短，不易被 AI 擷取為直接答案',
    fix: '文章第一段（30–200 字）直接說明核心答案，之後再展開細節',
  },
  {
    id: 'title', category: 'Meta 標籤', icon: '🏷️',
    label: 'Meta 標題（30–60 字）', priority: 'P1',
    desc: '搜尋結果的第一印象，長度符合規範才不會被截斷',
    get: r => r.meta.hasTitleOptimal,
    detail: r => r.meta.title ? `「${r.meta.title.slice(0, 35)}${r.meta.title.length > 35 ? '...' : ''}」（${r.meta.titleLength} 字）` : '未設置 Meta 標題',
    fix: '設置 <title> 標籤，長度 30–60 字，將主要關鍵字放在前半段',
  },
  {
    id: 'desc', category: 'Meta 標籤', icon: '📄',
    label: 'Meta 描述（70–155 字）', priority: 'P1',
    desc: '搜尋結果摘要，好的描述能提升點擊率',
    get: r => r.meta.hasDescOptimal,
    detail: r => r.meta.description ? `${r.meta.descLength} 字` : '未設置 Meta 描述',
    fix: '在 <head> 加入 <meta name="description" content="..."，70–155 字，自然帶入關鍵字並加入行動呼籲',
  },
  {
    id: 'ogimage', category: 'Meta 標籤', icon: '🖼️',
    label: 'OG 圖片', priority: 'P3',
    desc: '社群分享時顯示的預覽圖，影響點擊意願',
    get: r => r.meta.hasOgImage,
    detail: r => r.meta.hasOgImage ? 'og:image 已設置' : '未設置 og:image',
    fix: '在 <head> 加入 <meta property="og:image" content="圖片網址">，建議尺寸 1200×630px',
  },
  {
    id: 'articleschema', category: 'AEO 結構化資料', icon: '📋',
    label: 'Article Schema', priority: 'P1',
    desc: '讓 Google 和 AI 明確知道這是一篇文章，並了解作者與發布時間',
    get: r => r.aeo.hasArticleSchema,
    detail: r => r.aeo.hasArticleSchema ? `已有 Article Schema${r.aeo.hasAuthorInSchema ? '（含作者資訊）' : '（缺少作者欄位）'}` : '未找到 Article / BlogPosting Schema',
    fix: '在 <head> 加入 JSON-LD Article schema，包含 headline、author、datePublished、image 欄位',
  },
  {
    id: 'faqschema', category: 'AEO 結構化資料', icon: '❔',
    label: 'FAQ Schema', priority: 'P2',
    desc: '讓 Google 在搜尋結果展開問答，AI 也更容易引用',
    get: r => r.aeo.hasFaqSchema,
    detail: r => r.aeo.hasFaqSchema ? 'FAQPage Schema 已存在' : '未找到 FAQPage Schema',
    fix: '在文章底部加入 FAQ 區塊，並以 FAQPage JSON-LD 標記，每個問答都包含 Question 和 Answer',
  },
  {
    id: 'author', category: '可信度（E-E-A-T）', icon: '👤',
    label: '作者資訊', priority: 'P2',
    desc: '顯示作者姓名或署名，增強 Google 對內容可信度的判斷',
    get: r => r.author.hasAuthorElement,
    detail: r => r.author.hasAuthorElement ? '找到作者資訊元素' : '找不到作者署名',
    fix: '在文章標題下方加入作者姓名，使用 <span class="author"> 或 <a rel="author">',
  },
  {
    id: 'date', category: '可信度（E-E-A-T）', icon: '📅',
    label: '發布日期', priority: 'P2',
    desc: '讓讀者和 AI 知道內容的時效性',
    get: r => r.author.hasPublishDate,
    detail: r => r.author.hasPublishDate ? '找到發布日期元素' : '找不到發布日期',
    fix: '在文章加入 <time datetime="2024-01-01"> 標籤標記發布日期',
  },
  {
    id: 'alttext', category: '可信度（E-E-A-T）', icon: '🖼️',
    label: '圖片 Alt 覆蓋率 ≥ 80%', priority: 'P2',
    desc: 'Alt 文字幫助 AI 理解圖片內容，也提升無障礙性',
    get: r => r.images.passed,
    detail: r => r.images.total === 0 ? '頁面沒有圖片' : `${r.images.withAlt}/${r.images.total} 張有 Alt（${r.images.coverage}%）`,
    fix: '為每張圖片加入描述性的 alt 屬性，例如 alt="2024年台北辦公室外觀"',
  },
  {
    id: 'internallinks', category: '可信度（E-E-A-T）', icon: '🔗',
    label: '內部連結（≥ 2 個）', priority: 'P3',
    desc: '連結到站內其他相關文章，幫助 AI 理解你網站的主題深度',
    get: r => r.links.hasInternalLinks,
    detail: r => `找到 ${r.links.internal} 個內部連結`,
    fix: '在文章內自然地連結到其他相關文章或頁面，建議至少 2–3 個',
  },
  {
    id: 'readability', category: '可讀性', icon: '✍️',
    label: '段落易讀（平均 ≤ 200 字）', priority: 'P2',
    desc: '段落過長不易閱讀，也不利於 AI 擷取重點',
    get: r => r.readability.hasGoodReadability,
    detail: r => r.readability.paragraphCount > 0 ? `平均段落長度 ${r.readability.avgLength} 字（${r.readability.paragraphCount} 個段落）` : '無法分析段落',
    fix: '每個段落控制在 150 字以內，一個段落只講一個重點',
  },
]

// DB row → analyzeContent() return shape（給 ScoreHero / IssueBoard / ContentSignature 共用）
// 欄位對應 content_audits.sql + analyzeContent() output
function dbRowToResult(row, websiteUrl) {
  if (!row) return null
  return {
    url: websiteUrl,
    score: row.score,
    heading: row.heading,
    wordCount: row.word_count,
    meta: row.meta,
    aeo: row.aeo,
    author: row.author,
    images: row.images,
    links: row.links,
    outbound: row.outbound,
    multimedia: row.multimedia,
    readability: row.readability,
    readingMinutes: row.reading_minutes,
  }
}

export default function ContentAudit() {
  const { id } = useParams()
  // 兩種模式由 URL 是否帶 :id 決定
  //   - 模式 A（ad-hoc）：無 :id，使用者輸入任意 URL 分析，不寫 DB
  //   - 模式 B（DB-backed）：有 :id，綁定 websites 表的網站，吃 cached + 趨勢、寫 DB
  return id ? <DetailMode websiteId={id} /> : <AdHocMode />
}

// =====================================================
// 模式 B — DB-backed 詳情頁（從 Dashboard 第 5 張卡點進來）
//   仿 SEOAudit / AEOAudit / GEOAudit / EEATAudit 的 UX：
//   - AuditTopBar（返回 Dashboard + 重新檢測）
//   - ScoreHero 帶 recentAudits 顯示 7 日趨勢迷你圖
//   - 首次進來自動跑 analyzeContent + insert（lazy first-run）
// =====================================================
function DetailMode({ websiteId }) {
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [result, setResult] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadFromDb() }, [websiteId])

  async function loadFromDb() {
    setLoading(true)
    setError('')
    setNotFound(false)
    try {
      // 1. 拉網站本體（取 url 用於分析 + 顯示）
      const { data: websiteData, error: wErr } = await supabase
        .from('websites').select('*').eq('id', websiteId).single()
      if (wErr || !websiteData) {
        setNotFound(true)
        return
      }
      setWebsite(websiteData)

      // 2. 拉最新一筆 + 最近 7 筆（給 ScoreHero 趨勢迷你圖）
      const { data: rows } = await supabase
        .from('content_audits')
        .select('*')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(7)
      const list = rows || []
      setRecentAudits(list.map(r => ({ score: r.score, created_at: r.created_at })))

      if (list.length > 0) {
        // 已有 cached → 直接用，不重跑
        setResult(dbRowToResult(list[0], websiteData.url))
      } else {
        // 首次進來、DB 空 → lazy first-run（跟 SEO/AEO/GEO/EEAT 詳情頁一致 UX）
        await runAndInsert(websiteData)
      }
    } catch (err) {
      console.error('Error loading content audit:', err)
      setError(err.message || '載入失敗')
    } finally {
      setLoading(false)
    }
  }

  async function runAndInsert(websiteData) {
    const target = websiteData || website
    if (!target?.url) return
    const data = await analyzeContent(target.url)
    if (!data?.score && data?.score !== 0) {
      throw new Error('分析未回傳分數')
    }
    await supabase.from('content_audits').insert([{
      website_id: websiteId,
      score: data.score,
      heading: data.heading,
      word_count: data.wordCount,
      meta: data.meta,
      aeo: data.aeo,
      author: data.author,
      images: data.images,
      links: data.links,
      outbound: data.outbound,
      multimedia: data.multimedia,
      readability: data.readability,
      reading_minutes: data.readingMinutes,
    }])
    setResult(data)
    // refetch recent 趨勢（包含剛 insert 的這筆）
    const { data: rows } = await supabase
      .from('content_audits')
      .select('score, created_at')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(7)
    setRecentAudits(rows || [])
  }

  async function handleReanalyze() {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    setError('')
    try {
      await runAndInsert(website)
    } catch (err) {
      console.error('Error reanalyzing:', err)
      setError(err.message || '檢測失敗，請稍後再試')
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  if (notFound) {
    return (
      <PageBg>
        <SiteHeader />
        <main style={{ maxWidth: 720, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 8 }}>找不到這個網站</h1>
          <p style={{ color: T.textMid, marginBottom: 24 }}>網站可能已刪除，或你沒有存取權限。</p>
          <Link to="/" style={{
            display: 'inline-block', padding: '12px 24px',
            background: CONTENT_ACCENT, color: '#fff',
            borderRadius: 12, textDecoration: 'none', fontWeight: 700,
          }}>返回首頁</Link>
        </main>
        <Footer dark />
      </PageBg>
    )
  }

  const passedCount = result ? CHECKS.filter(c => c.get(result)).length : 0
  const checks = result ? CHECKS.map(c => ({
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
      <div className="relative z-10">
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>

          <AuditTopBar
            websiteId={websiteId}
            face="內容品質"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={CONTENT_ACCENT}
            accent2={CONTENT_ACCENT2}
          />

          {/* 文章分析統一 tab（B 方案 IA）— 讓「單篇」跟「批次」感覺是同個功能不同模式 */}
          <ArticleAnalysisTabs active="single" websiteId={websiteId} />

          <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
            {loading ? (
              <>
                <HeroSkeleton />
                <HeroSkeleton />
              </>
            ) : (
              <>
                <ScoreHero
                  face="內容品質"
                  subChip="文章分析"
                  tagline={website?.url}
                  score={result?.score ?? 0}
                  passedCount={passedCount}
                  failedCount={CHECKS.length - passedCount}
                  total={CHECKS.length}
                  recentAudits={recentAudits}
                  accent={CONTENT_ACCENT}
                />
                <div style={{
                  background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
                  borderRadius: T.rL, padding: 24,
                }}>
                  {result ? <ContentSignature result={result} /> : null}
                </div>
              </>
            )}
          </div>

          {error && (
            <div style={{
              marginBottom: 24, padding: 16,
              background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.4)',
              borderRadius: 12, color: '#fca5a5', fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
            <div style={{ fontSize: 14, color: T.textLow }}>
              依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟
            </div>
          </div>
          <div style={{ marginBottom: 32 }}>
            {loading ? (
              <IssueBoardSkeleton />
            ) : (
              <IssueBoard checks={checks} isPro={isPro} accent={CONTENT_ACCENT} accentGlow={`${CONTENT_ACCENT}28`} />
            )}
          </div>
        </main>
      </div>
      <Footer dark />
    </PageBg>
  )
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

  const passedCount = result ? CHECKS.filter(c => c.get(result)).length : 0
  const checks = result ? CHECKS.map(c => ({
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
                failedCount={CHECKS.length - passedCount}
                total={CHECKS.length}
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
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
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
