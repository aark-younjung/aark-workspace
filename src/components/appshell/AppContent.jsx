import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { IssueBoard, IssueBoardSkeleton, ContentSignature } from '../v2'
import { analyzeContent } from '../../services/contentAnalyzer'
import { CONTENT_CHECKS, dbRowToResult } from '../../data/contentChecks'
import { hostLabel } from '../../lib/url'
import SiteSwitcher from './SiteSwitcher'
import CacheFreshnessNote from '../CacheFreshnessNote'

/**
 * 文章分析（單篇）— app-shell 亮色版（2026-09-08）
 *
 * 搬遷理由：這個工具原本住在 /content-audit/:id，用的是 PageBg + SiteHeader + Footer 的
 * 深色公開站版型。使用者從亮色的「內容機會」點進來，會整個掉出新版介面、連左側選單都不見。
 * 四大體檢頁在 2026-08-14 硬切時已經做過同樣的搬遷（/geo-audit/:id → /app/:id/health/geo），
 * 文章分析當時漏掉了，這裡補上。
 *
 * ⚠️ 只搬「綁定網站」的模式。/content-audit（不帶 :id）的 ad-hoc 任意網址分析要留在公開深色版——
 * 那是公開頁 header/footer 連過去的獲客入口，未登入也能用，搬進 app-shell 等於關進登入牆。
 *
 * 檢測項定義（CONTENT_CHECKS）與 DB 轉換（dbRowToResult）沿用 pages/ContentAudit.jsx，
 * 兩種模式共用同一份判定標準——複製一份遲早會兩邊不一致。
 * （抽在 data/ 而不是留在頁面檔：元件檔只該匯出元件，eslint 的 react-refresh 規則會擋。）
 */
export default function AppContent() {
  const { websiteId } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [result, setResult] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setNotFound(false)
      try {
        const { data: websiteData, error: wErr } = await supabase
          .from('websites').select('*').eq('id', websiteId).single()
        if (wErr || !websiteData) {
          if (!cancelled) setNotFound(true)
          return
        }
        if (cancelled) return
        setWebsite(websiteData)

        const { data: rows } = await supabase
          .from('content_audits').select('*')
          .eq('website_id', websiteId)
          .order('created_at', { ascending: false })
          .limit(7)
        if (cancelled) return

        const list = rows || []
        setRecentAudits(list.map(row => ({ score: row.score, created_at: row.created_at })))
        if (list.length > 0) {
          setResult(dbRowToResult(list[0], websiteData.url))
        } else {
          // 首次進來、DB 空 → lazy first-run（與四大體檢詳情頁一致的 UX）
          await runAndInsert(websiteData)
        }
      } catch (err) {
        console.error('AppContent load error:', err)
        if (!cancelled) setError(err.message || '載入失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (websiteId) load()
    return () => { cancelled = true }
    // runAndInsert 只讀 websiteId，重建不影響行為；列進相依會造成每次 render 重跑載入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId])

  async function runAndInsert(websiteData) {
    const target = websiteData || website
    if (!target?.url) return
    const data = await analyzeContent(target.url)
    if (!data?.score && data?.score !== 0) throw new Error('分析未回傳分數')

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

    const { data: rows } = await supabase
      .from('content_audits').select('score, created_at')
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
      console.error('AppContent reanalyze error:', err)
      // 亮色殼沒有 alert 慣例：錯誤直接顯示在頁面上（誠實透傳原因）
      setError(err.message || '檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) return <div className="as-loading" aria-live="polite">載入中…</div>
  if (notFound) return (
    <div className="as-empty">
      <div className="e-t">找不到這個網站</div>
      <div className="e-d">網站可能已刪除，或你沒有存取權限。</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const title = website?.name || hostLabel(website?.url || '')
  const passedCount = result ? CONTENT_CHECKS.filter(check => check.get(result)).length : 0
  const checks = result ? CONTENT_CHECKS.map(check => ({
    id: check.id,
    name: check.label,
    icon: check.icon,
    priority: check.priority,
    passed: check.get(result),
    detail: check.detail(result),
    recommendation: check.fix,
  })) : []

  return (
    <>
      <div className="as-ctx"><SiteSwitcher websiteId={websiteId} currentTitle={title} /></div>
      <div className="as-phead">
        <h2>首頁內容分析</h2>
        <span className="sub">看 {title} 首頁的內容還要補什麼</span>
      </div>

      {/* 單篇 / 批次分頁：沿用網站體檢的分頁樣式，讓兩種模式感覺是同一個功能 */}
      <nav className="as-health-tabs" aria-label="內容分析模式">
        <span className="as-health-tab on" aria-current="page">
          首頁分析{result?.score != null && <span className="b num">{result.score}</span>}
        </span>
        <Link className="as-health-tab" to={`/bulk-scan/${websiteId}`}>批次掃描</Link>
      </nav>

      {/* 歷次分數：原本深色版靠 ScoreHero 的迷你趨勢圖呈現，亮色殼沒有那個元件——
          與其默默砍掉這個資訊，用一行文字照實列出來。只有兩次以上才顯示（一個點不成趨勢）。
          由舊到新排列，讓箭頭方向跟時間方向一致。 */}
      {recentAudits.length >= 2 && (
        <div className="as-content-trend">
          歷次分數（舊 → 新）：
          {[...recentAudits].reverse().map((audit, index) => (
            <span key={audit.created_at || index}>
              {index > 0 && <i aria-hidden="true"> → </i>}
              <b>{audit.score}</b>
            </span>
          ))}
        </div>
      )}

      <div className="as-health-scope">
        <span aria-hidden="true">📍</span>
        <span>本次分析範圍：<b>這一頁</b>（{website?.url}）。要一次看全站文章，用上面的「批次掃描」。</span>
      </div>

      <CacheFreshnessNote pageUrl={website?.url} />

      <div className="as-phead">
        <span className="sub">
          {result
            ? `${CONTENT_CHECKS.length} 項內容檢測，目前通過 ${passedCount} 項`
            : '尚未有分析結果'}
        </span>
        <button type="button" className="as-cta as-rescan" onClick={handleReanalyze} disabled={analyzing} aria-live="polite">
          {analyzing ? '分析中…' : '🔄 重新分析'}
        </button>
      </div>

      {error && <div className="as-pm-notice warn" role="alert">{error}</div>}

      {analyzing && !result ? (
        <IssueBoardSkeleton />
      ) : (
        <div className="as-health-board">
          <IssueBoard checks={checks} isPro={isPro} accent="#ec4899" />
        </div>
      )}

      {/* 內容品質 5 維度拆解。元件是 v2 深色卡，靠 .as-content-signature 重定義顏色變數翻成亮色（見 appshell.css） */}
      {result && (
        <div className="as-content-signature"><ContentSignature result={result} /></div>
      )}
    </>
  )
}
