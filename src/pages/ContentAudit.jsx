import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { analyzeContent } from '../services/contentAnalyzer'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const CHECKS = [
  {
    id: 'h1',
    category: '內容結構',
    icon: '📖',
    label: '單一 H1 標題',
    desc: '每篇文章應只有一個 H1，清楚說明主題',
    get: r => r.heading.hasProperH1,
    detail: r => r.heading.h1Count === 0 ? '找不到 H1 標題' : r.heading.h1Count > 1 ? `有 ${r.heading.h1Count} 個 H1（應只有 1 個）` : `「${r.heading.h1Content?.slice(0, 40)}${r.heading.h1Content?.length > 40 ? '...' : ''}」`,
    fix: '確保文章只有一個主標題 <h1>，其他層級用 <h2>、<h3>',
  },
  {
    id: 'h2',
    category: '內容結構',
    icon: '🗂️',
    label: 'H2 段落結構',
    desc: '至少 2 個 H2 子標題，幫助 AI 理解文章架構',
    get: r => r.heading.hasH2Structure,
    detail: r => `目前有 ${r.heading.h2Count} 個 H2 標題`,
    fix: '將文章分成多個段落，每段用 <h2> 標題，建議至少 2 個',
  },
  {
    id: 'question',
    category: '內容結構',
    icon: '❓',
    label: '問句式標題',
    desc: '「什麼是...？」「如何...？」格式的標題最容易被 AI 引用為答案',
    get: r => r.heading.hasQuestionHeadings,
    detail: r => `目前有 ${r.heading.questionHeadings} 個問句式 H2/H3`,
    fix: '將部分子標題改為問句，例如「什麼是 SEO？」「如何提升排名？」',
  },
  {
    id: 'wordcount',
    category: '字數與深度',
    icon: '📝',
    label: '字數達 800 字以上',
    desc: 'AI 傾向引用有足夠深度的長篇內容',
    get: r => r.wordCount.isLongForm,
    detail: r => `目前約 ${r.wordCount.totalWords.toLocaleString()} 字${r.wordCount.isDeep ? '（優秀！超過 1500 字）' : ''}`,
    fix: '擴充文章內容，加入具體案例、數據或步驟說明，目標 800 字以上',
  },
  {
    id: 'directanswer',
    category: '字數與深度',
    icon: '💡',
    label: '首段直接給出答案',
    desc: 'AI 偏好在文章開頭就直接回答問題的寫法',
    get: r => r.aeo.hasDirectAnswer,
    detail: r => r.aeo.hasDirectAnswer ? '首段結構良好，適合被 AI 擷取' : '首段過長或過短，不易被 AI 擷取為直接答案',
    fix: '文章第一段（30–200 字）直接說明核心答案，之後再展開細節',
  },
  {
    id: 'title',
    category: 'Meta 標籤',
    icon: '🏷️',
    label: 'Meta 標題（30–60 字）',
    desc: '搜尋結果的第一印象，長度符合規範才不會被截斷',
    get: r => r.meta.hasTitleOptimal,
    detail: r => r.meta.title ? `「${r.meta.title.slice(0, 35)}${r.meta.title.length > 35 ? '...' : ''}」（${r.meta.titleLength} 字）` : '未設置 Meta 標題',
    fix: '設置 <title> 標籤，長度 30–60 字，將主要關鍵字放在前半段',
  },
  {
    id: 'desc',
    category: 'Meta 標籤',
    icon: '📄',
    label: 'Meta 描述（70–155 字）',
    desc: '搜尋結果摘要，好的描述能提升點擊率',
    get: r => r.meta.hasDescOptimal,
    detail: r => r.meta.description ? `${r.meta.descLength} 字` : '未設置 Meta 描述',
    fix: '在 <head> 加入 <meta name="description" content="..."，70–155 字，自然帶入關鍵字並加入行動呼籲',
  },
  {
    id: 'ogimage',
    category: 'Meta 標籤',
    icon: '🖼️',
    label: 'OG 圖片',
    desc: '社群分享時顯示的預覽圖，影響點擊意願',
    get: r => r.meta.hasOgImage,
    detail: r => r.meta.hasOgImage ? 'og:image 已設置' : '未設置 og:image',
    fix: '在 <head> 加入 <meta property="og:image" content="圖片網址">，建議尺寸 1200×630px',
  },
  {
    id: 'articleschema',
    category: 'AEO 結構化資料',
    icon: '📋',
    label: 'Article Schema',
    desc: '讓 Google 和 AI 明確知道這是一篇文章，並了解作者與發布時間',
    get: r => r.aeo.hasArticleSchema,
    detail: r => r.aeo.hasArticleSchema ? `已有 Article Schema${r.aeo.hasAuthorInSchema ? '（含作者資訊）' : '（缺少作者欄位）'}` : '未找到 Article / BlogPosting Schema',
    fix: '在 <head> 加入 JSON-LD Article schema，包含 headline、author、datePublished、image 欄位',
  },
  {
    id: 'faqschema',
    category: 'AEO 結構化資料',
    icon: '❔',
    label: 'FAQ Schema',
    desc: '讓 Google 在搜尋結果展開問答，AI 也更容易引用',
    get: r => r.aeo.hasFaqSchema,
    detail: r => r.aeo.hasFaqSchema ? 'FAQPage Schema 已存在' : '未找到 FAQPage Schema',
    fix: '在文章底部加入 FAQ 區塊，並以 FAQPage JSON-LD 標記，每個問答都包含 Question 和 Answer',
  },
  {
    id: 'author',
    category: '可信度（E-E-A-T）',
    icon: '👤',
    label: '作者資訊',
    desc: '顯示作者姓名或署名，增強 Google 對內容可信度的判斷',
    get: r => r.author.hasAuthorElement,
    detail: r => r.author.hasAuthorElement ? '找到作者資訊元素' : '找不到作者署名',
    fix: '在文章標題下方加入作者姓名，使用 <span class="author"> 或 <a rel="author">',
  },
  {
    id: 'date',
    category: '可信度（E-E-A-T）',
    icon: '📅',
    label: '發布日期',
    desc: '讓讀者和 AI 知道內容的時效性',
    get: r => r.author.hasPublishDate,
    detail: r => r.author.hasPublishDate ? '找到發布日期元素' : '找不到發布日期',
    fix: '在文章加入 <time datetime="2024-01-01"> 標籤標記發布日期',
  },
  {
    id: 'alttext',
    category: '可信度（E-E-A-T）',
    icon: '🖼️',
    label: '圖片 Alt 覆蓋率 ≥ 80%',
    desc: 'Alt 文字幫助 AI 理解圖片內容，也提升無障礙性',
    get: r => r.images.passed,
    detail: r => r.images.total === 0 ? '頁面沒有圖片' : `${r.images.withAlt}/${r.images.total} 張有 Alt（${r.images.coverage}%）`,
    fix: '為每張圖片加入描述性的 alt 屬性，例如 alt="2024年台北辦公室外觀"',
  },
  {
    id: 'internallinks',
    category: '可信度（E-E-A-T）',
    icon: '🔗',
    label: '內部連結（≥ 2 個）',
    desc: '連結到站內其他相關文章，幫助 AI 理解你網站的主題深度',
    get: r => r.links.hasInternalLinks,
    detail: r => `找到 ${r.links.internal} 個內部連結`,
    fix: '在文章內自然地連結到其他相關文章或頁面，建議至少 2–3 個',
  },
  {
    id: 'readability',
    category: '可讀性',
    icon: '✍️',
    label: '段落易讀（平均 ≤ 200 字）',
    desc: '段落過長不易閱讀，也不利於 AI 擷取重點',
    get: r => r.readability.hasGoodReadability,
    detail: r => r.readability.paragraphCount > 0 ? `平均段落長度 ${r.readability.avgLength} 字（${r.readability.paragraphCount} 個段落）` : '無法分析段落',
    fix: '每個段落控制在 150 字以內，一個段落只講一個重點',
  },
]

const CATEGORIES = ['內容結構', '字數與深度', 'Meta 標籤', 'AEO 結構化資料', '可信度（E-E-A-T）', '可讀性']

function ScoreRing({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="128" height="128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <div className="text-4xl font-bold" style={{ color }}>{score}</div>
        <div className="text-xs text-white/60">/ 100</div>
      </div>
    </div>
  )
}

export default function ContentAudit() {
  const { isPro } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('全部')

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
      setActiveCategory('全部')
    } catch (err) {
      setError(err.message || '分析失敗，請確認網址是否正確')
    } finally {
      setLoading(false)
    }
  }

  const passedCount = result ? CHECKS.filter(c => c.get(result)).length : 0
  const failedChecks = result ? CHECKS.filter(c => !c.get(result)) : []

  const visibleChecks = activeCategory === '全部'
    ? CHECKS
    : CHECKS.filter(c => c.category === activeCategory)

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    if (!result) return acc
    const items = CHECKS.filter(c => c.category === cat)
    acc[cat] = { passed: items.filter(c => c.get(result)).length, total: items.length }
    return acc
  }, {})

  return (
    <PageBg>
      <SiteHeader />

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
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
          <p className="mt-3 text-xs text-white/40">支援部落格文章、產品頁、服務介紹頁等任意公開網址・分析約需 10–20 秒</p>
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
            {/* 總分卡 */}
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <ScoreRing score={result.score} />
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-xl font-bold text-white mb-1">
                    {result.score >= 70 ? '🎉 內容品質良好' : result.score >= 50 ? '⚠️ 有改善空間' : '🔴 需要優化'}
                  </h2>
                  <p className="text-white/60 text-sm mb-3 break-all">{result.url}</p>
                  <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                    <span className="px-3 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full text-sm font-medium">✅ 通過 {passedCount} 項</span>
                    <span className="px-3 py-1 bg-red-500/15 text-red-300 border border-red-500/30 rounded-full text-sm font-medium">❌ 待改善 {CHECKS.length - passedCount} 項</span>
                    <span className="px-3 py-1 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-full text-sm font-medium">📝 約 {result.wordCount.totalWords.toLocaleString()} 字</span>
                  </div>
                </div>
                {/* 分類快覽 */}
                <div className="grid grid-cols-3 sm:grid-cols-2 gap-2 flex-shrink-0">
                  {CATEGORIES.slice(0, 4).map(cat => {
                    const { passed, total } = categoryCounts[cat] || {}
                    const color = passed === total ? 'text-emerald-400' : passed >= total / 2 ? 'text-amber-400' : 'text-red-400'
                    return (
                      <div key={cat} className="text-center bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                        <div className={`text-lg font-bold ${color}`}>{passed}/{total}</div>
                        <div className="text-xs text-white/60 leading-tight">{cat.replace('（E-E-A-T）', '')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* 分類 Tab */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['全部', ...CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {cat === '全部' ? `全部（${CHECKS.length}）` : `${cat.replace('（E-E-A-T）', '')} ${categoryCounts[cat]?.passed}/${categoryCounts[cat]?.total}`}
                </button>
              ))}
            </div>

            {/* 檢測清單 */}
            <div className="space-y-3 mb-8">
              {visibleChecks.map(check => {
                const passed = check.get(result)
                return (
                  <div key={check.id} className={`bg-black/40 backdrop-blur-md border rounded-2xl p-5 shadow-sm ${passed ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${passed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {passed ? '✓' : '✗'}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span>{check.icon}</span>
                          <span className="font-semibold text-white text-sm">{check.label}</span>
                          <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded-full">{check.category}</span>
                        </div>
                        <p className="text-xs text-white/60 mb-1">{check.desc}</p>
                        <p className={`text-sm font-medium ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
                          {check.detail(result)}
                        </p>
                        {/* 修復建議 Pro 判斷 */}
                        {!passed && (
                          isPro ? (
                            <div className="mt-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                              <p className="text-xs text-orange-300 leading-relaxed">💡 {check.fix}</p>
                            </div>
                          ) : (
                            <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between gap-3">
                              <p className="text-xs text-white/40 blur-sm select-none flex-1 leading-relaxed">{check.fix}</p>
                              <Link to="/pricing" className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-1 rounded-full font-semibold flex-shrink-0 whitespace-nowrap">🔒 升級 Pro</Link>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 待改善重點（免費版提示 / Pro 版完整） */}
            {failedChecks.length > 0 && (
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-sm mb-6">
                <h3 className="font-bold text-white mb-4">🎯 優先改善項目</h3>
                {isPro ? (
                  <div className="space-y-3">
                    {failedChecks.slice(0, 5).map((check, i) => (
                      <div key={check.id} className="flex gap-3 p-3 bg-orange-500/10 rounded-xl border border-orange-500/30">
                        <span className="text-orange-500 font-bold flex-shrink-0">{i + 1}.</span>
                        <div>
                          <p className="font-medium text-white text-sm">{check.icon} {check.label}</p>
                          <p className="text-xs text-white/70 mt-0.5">{check.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="space-y-2 mb-4">
                      {failedChecks.slice(0, 3).map((check, i) => (
                        <div key={check.id} className="flex gap-2 items-center text-sm text-white/70">
                          <span className="text-red-400">•</span>
                          {check.icon} {check.label}
                        </div>
                      ))}
                      {failedChecks.length > 3 && (
                        <p className="text-sm text-white/40">⋯ 還有 {failedChecks.length - 3} 個項目需要改善</p>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl text-center">
                      <p className="text-sm font-semibold text-white mb-1">🔒 升級 Pro，查看每項的具體修復方法</p>
                      <p className="text-xs text-white/60 mb-3">包含步驟說明與可直接複製的程式碼</p>
                      <Link to="/pricing" className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-all">
                        升級 Pro 方案 →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 重新分析 */}
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
