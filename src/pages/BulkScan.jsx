/**
 * 批次文章掃描頁面（Pro 限定，Phase 1 簡單版）
 *
 * 流程：
 *   1. 用戶進來看到 hero 區（網站名 + 「開始批次掃描」按鈕）
 *   2. 按下後 POST /api/bulk-scan?action=start → 取得 jobId
 *   3. 進入「掃描中」UI，每 5 秒 poll /api/bulk-scan?action=status 看進度
 *   4. 進度跑完拉 /api/bulk-scan?action=results 展示結果
 *
 * Phase 1 UI：
 *   - 進度條 + 已掃描 / 總數
 *   - 完成後：聚合卡（按 problem 分組） + 簡單 URL 列表
 *
 * Phase 2-3 之後會加：FOMO 試一篇、修法建議分組、嚴重度過濾
 */
import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { GlassCard, ArticleAnalysisTabs, ScoreHero } from '../components/v2'
import { T } from '../styles/v2-tokens'
import { recordFixEvent } from '../lib/fixEvents'
import { buildClientReport, copyToClipboard, downloadMarkdown } from '../lib/clientReport'

const POLL_INTERVAL_MS = 5000  // 每 5 秒輪詢進度

// 主色 — 跟 /content-audit 同色（內容品質粉紅 #ec4899），統一「文章分析」家族視覺
const PAGE_ACCENT = '#ec4899'

export default function BulkScan() {
  const { id: websiteId } = useParams()
  const { user, isPro, isTrial } = useAuth()
  const [website, setWebsite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState(null)        // 當前進行/完成的 job
  const [results, setResults] = useState(null) // job 完成後的詳細 results
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  const pollTimer = useRef(null)

  // mount 拉 website + 最新的 job（如果有進行中或最近完成的）
  useEffect(() => {
    if (!user?.id || !websiteId) return
    fetchInitialData()
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [user?.id, websiteId])

  // job 變化時：scanning 中啟動 poll、done 時拉 results
  useEffect(() => {
    if (!job) return
    if (['discovering', 'scanning'].includes(job.status)) {
      startPolling()
    } else {
      stopPolling()
      if (job.status === 'done' && !results) fetchResults(job.id)
    }
  }, [job?.status])

  async function fetchInitialData() {
    setLoading(true)
    try {
      const { data: site } = await supabase
        .from('websites').select('id, url, name').eq('id', websiteId).single()
      setWebsite(site)

      // 找最近的 job（任何狀態）
      const { data: recentJob } = await supabase
        .from('bulk_scan_jobs')
        .select('*')
        .eq('website_id', websiteId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (recentJob) setJob(recentJob)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // mode: 'sample' (Free 試掃 3 篇) / 'full' (Pro 200 篇全掃)
  // 預設沒帶 mode = backend 自動依用戶身份決定（Free → sample / Pro → full）
  async function handleStart(mode) {
    if (starting) return
    setStarting(true)
    setError(null)
    // 防呆：若被當成 onClick handler 直接綁、第一個參數會是 React event 物件
    // → JSON.stringify(event) 會撞循環結構炸掉。強制只接 string 型別 mode
    const safeMode = typeof mode === 'string' ? mode : undefined
    try {
      const session = (await supabase.auth.getSession()).data?.session
      if (!session) throw new Error('未登入')
      const r = await fetch('/api/bulk-scan?action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ websiteId, mode: safeMode }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      const { data: newJob } = await supabase
        .from('bulk_scan_jobs').select('*').eq('id', data.jobId).single()
      setJob(newJob)
      setResults(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  function startPolling() {
    if (pollTimer.current) return
    // 用戶在這頁時，每次 poll 順便戳一下 worker — 不依賴 Vercel cron（Hobby 只能每小時）
    // worker idempotent：只處理 pending 工作；前端戳 + cron 保險 = 最快推進
    pollTimer.current = setInterval(async () => {
      if (!job?.id) return
      try {
        const session = (await supabase.auth.getSession()).data?.session
        if (!session) return

        // 並行：poll status + 戳 worker（沒有先後依賴）
        const [statusRes] = await Promise.allSettled([
          fetch(`/api/bulk-scan?action=status&jobId=${job.id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          // 戳 worker — 不需要驗證 / 不需要等結果
          fetch('/api/cron-bulk-scan').catch(() => {}),
        ])

        if (statusRes.status === 'fulfilled') {
          const data = await statusRes.value.json()
          if (statusRes.value.ok) setJob(data)
        }
      } catch { /* ignore network blip */ }
    }, POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  async function fetchResults(jobId) {
    try {
      const session = (await supabase.auth.getSession()).data?.session
      if (!session) return
      const r = await fetch(`/api/bulk-scan?action=results&jobId=${jobId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await r.json()
      if (r.ok) {
        setResults(data)
        // 同步把 API 回傳的 fresh aggregate 寫回外層 job state
        // 避免 UI 卡在舊的 cached aggregate（例如重新掃描後外層 job 還是舊資料）
        if (data?.job) setJob(prev => ({ ...prev, ...data.job }))
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function handleCancel() {
    if (!job?.id) return
    if (!confirm('確定要取消批次掃描？已掃描的結果會保留。')) return
    try {
      const session = (await supabase.auth.getSession()).data?.session
      const r = await fetch('/api/bulk-scan?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ jobId: job.id }),
      })
      if (r.ok) {
        setJob({ ...job, status: 'cancelled' })
        stopPolling()
      }
    } catch (e) { setError(e.message) }
  }

  if (loading) return <PageWrap>載入中...</PageWrap>

  // 不再 hard-lock Pro — Free 可以跑「試掃 3 篇」sample。Pro 守衛留在 backend handleStart
  const isProUser = isPro || isTrial

  return (
    <PageWrap>
      {/* 文章分析統一 tab — 跟 /content-audit 用同一個元件，視覺一致 */}
      <ArticleAnalysisTabs active="bulk" websiteId={websiteId} />

      {/* Hero — 網站資訊 + 主動作按鈕 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Link to={`/dashboard/${websiteId}`} style={{ color: T.textMid, fontSize: 13, textDecoration: 'none' }}>← 回 Dashboard</Link>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, marginBottom: 4 }}>批次文章掃描</h1>
        <p style={{ fontSize: 14, color: T.textMid }}>{website?.url}</p>
      </div>

      {error && (
        <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', border: `1px solid ${T.fail}55`, borderRadius: 8, color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* 沒 job 或上次失敗 / 取消 → 顯示開始按鈕（Pro / Free 不同 UX） */}
      {(!job || ['failed', 'cancelled'].includes(job.status)) && (
        isProUser ? (
          /* Pro 版：直接「開始掃描全站」按鈕 */
          <GlassCard color={PAGE_ACCENT} style={{ padding: 28 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              {job ? '重新批次掃描' : '開始批次掃描'}
            </h3>
            <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 16 }}>
              我們會抓你網站的 sitemap.xml，找出所有文章 URL（最多 200 篇，依 sitemap lastmod 倒序、最新先掃），
              逐篇分析 7 項文章層級檢測：H1 / Meta 標題 / Meta 描述 / Open Graph / JSON-LD schema / 字數 / canonical。
              預估時長 25-30 分鐘，過程中可關閉視窗，掃完回來看結果。
            </p>
            {job?.status === 'failed' && job?.error_message && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', borderLeft: `3px solid ${T.fail}`, borderRadius: 4, marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
                上次失敗：{job.error_message}
              </div>
            )}
            <button onClick={() => handleStart('full')} disabled={starting} style={primaryButtonStyle}>
              {starting ? '啟動中...' : '🚀 開始掃描全站文章'}
            </button>
          </GlassCard>
        ) : (
          /* Free 版：FOMO 試掃 3 篇 + 看完結果再升級
             文案聚焦「具體得到什麼」— 對標 GetAutoSEO「Get 3 Articles + 30-day Content Plan」這種具體承諾 */
          <GlassCard color={PAGE_ACCENT} style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>
                免費掃出你最近 3 篇文章的 SEO 漏洞
              </h3>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                background: 'rgba(168,85,247,0.25)', color: '#e9d5ff', letterSpacing: '.05em',
              }}>免費</span>
            </div>
            <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 14 }}>
              我們會抓你網站 sitemap、找出你網站的全部文章 → 挑最近發布的 3 篇免費跑完整檢測。
              你會看到：
            </p>
            <ul style={{ fontSize: 12, color: T.textMid, lineHeight: 1.8, marginBottom: 16, paddingLeft: 18 }}>
              <li>📊 <strong style={{ color: T.text }}>你網站總共幾篇文章</strong>（sitemap 自動發現）</li>
              <li>🔍 那 3 篇實際缺了哪些 SEO 要素（H1 / Meta / Schema / OG / 字數 / canonical）</li>
              <li>🛠 每個問題對應的修法步驟 — 不論你用 WordPress / Shopify / Wix / 自架 HTML</li>
            </ul>
            {job?.status === 'failed' && job?.error_message && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', borderLeft: `3px solid ${T.fail}`, borderRadius: 4, marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
                上次失敗：{job.error_message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => handleStart('sample')} disabled={starting} style={primaryButtonStyle}>
                {starting ? '啟動中...' : '🎁 免費試跑 3 篇看結果'}
              </button>
              <Link to="/pricing" style={{
                ...secondaryButtonStyle, textDecoration: 'none', display: 'inline-block',
              }}>升級 Pro 一次掃完全部 →</Link>
            </div>
            <p style={{ fontSize: 11, color: T.textLow, marginTop: 12 }}>
              ℹ️ 每個網站僅可免費試跑 1 次。想看完整 200 篇結果請升級 Pro。
            </p>
          </GlassCard>
        )
      )}

      {/* 進行中 → 進度條 */}
      {job && ['discovering', 'scanning'].includes(job.status) && (
        <GlassCard color={PAGE_ACCENT} style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
              {job.status === 'discovering' ? '🔍 抓取 sitemap 中...' : '⏳ 掃描中'}
            </h3>
            <button onClick={handleCancel} style={cancelButtonStyle}>取消</button>
          </div>

          {job.status === 'scanning' && (
            <>
              <ProgressBar scanned={job.scanned_count} failed={job.failed_count} total={job.total_urls} />
              <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: T.textMid, flexWrap: 'wrap' }}>
                <span>✅ 已掃描 <strong style={{ color: T.text }}>{job.scanned_count}</strong> / {job.total_urls}</span>
                {job.failed_count > 0 && <span>❌ 失敗 <strong style={{ color: T.fail }}>{job.failed_count}</strong></span>}
                {job.capped > 0 && <span style={{ color: T.warn }}>⚠️ 你網站文章超過 200，本次只掃前 200（少 {job.capped} 筆）</span>}
              </div>
              <p style={{ fontSize: 11, color: T.textLow, marginTop: 12 }}>
                提示：每分鐘掃 ~8 篇，剩餘約 {Math.max(1, Math.ceil((job.total_urls - job.scanned_count - job.failed_count) / 8))} 分鐘。可關閉視窗稍後回來看結果。
              </p>
            </>
          )}
        </GlassCard>
      )}

      {/* 完成 → 聚合結果 + 列表 */}
      {job?.status === 'done' && results && (
        <ResultsView job={job} results={results} onRescan={handleStart} starting={starting} websiteId={websiteId} userId={user?.id} website={website} />
      )}
    </PageWrap>
  )
}

// ─────────── 子元件 ───────────

function ProgressBar({ scanned, failed, total }) {
  const pct = total > 0 ? Math.round(((scanned + failed) / total) * 100) : 0
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden', height: 14 }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: `linear-gradient(90deg, ${PAGE_ACCENT}, #f472b6)`,
        transition: 'width 1s ease',
      }} />
    </div>
  )
}

function ResultsView({ job, results, onRescan, starting, websiteId, userId, website }) {
  const agg = job.aggregate || {}
  const byType = agg.problems_by_type || {}
  const offenders = agg.top_offenders || []
  const totalScanned = agg.total_results || 0
  const totalProblems = agg.total_with_problems || 0
  const totalPassed = totalScanned - totalProblems
  // 「全站文章通過率」分數 — 多少 % 篇文章 0 問題 = 分數
  const score = totalScanned > 0 ? Math.round(totalPassed / totalScanned * 100) : 0

  // Phase 2 — 區分 sample（Free 試掃 3 篇）vs full（Pro 完整掃）
  const isSample = job.kind === 'sample'
  const discoveredCount = job.discovered_count || totalScanned
  const lockedCount = Math.max(0, discoveredCount - totalScanned)

  // sortedProblems：依「受影響篇數」遞減排序
  const sortedProblems = Object.entries(byType)
    .map(([id, count]) => ({ id, count, label: PROBLEM_LABELS[id] || id, severity: PROBLEM_SEVERITY[id] || 'low' }))
    .sort((a, b) => b.count - a.count)

  return (
    <>
      {/* Sample mode 加大型升級 CTA — 放在 hero 上方最顯眼位置 */}
      {isSample && lockedCount > 0 && <SampleUpsellBanner discoveredCount={discoveredCount} scanned={totalScanned} locked={lockedCount} />}

      {/* 兩欄 Hero（左 ScoreHero + 右 問題分佈拆解）— 跟單篇模式視覺一致 */}
      <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
        <ScoreHero
          face={isSample ? '試掃樣本' : '批次掃描'}
          subChip={isSample ? `已掃 ${totalScanned} / 共 ${discoveredCount} 篇` : `${totalScanned} 篇`}
          tagline={isSample
            ? `這 ${totalScanned} 篇樣本的通過率 — ${totalPassed} 篇 0 問題、${totalProblems} 篇待修。剩下 ${lockedCount} 篇升 Pro 解鎖`
            : `全站文章通過率 — ${totalPassed} 篇 0 問題、${totalProblems} 篇待修${job.capped > 0 ? `（你網站超過 200 篇，少 ${job.capped} 篇沒掃）` : ''}`}
          score={score}
          passedCount={totalPassed}
          failedCount={totalProblems}
          total={totalScanned}
          recentAudits={[]}
          accent={PAGE_ACCENT}
        />
        <ProblemBreakdown sortedProblems={sortedProblems} totalScanned={totalScanned} />
      </div>

      {/* 「快照時效」提示 banner — 用戶常常在 WP 改完後困惑「為什麼掃描結果還是舊的」
          這條 banner 明確告訴他們：results 是快照、線上可能已不同、要重掃才知道 */}
      <StaleSnapshotBanner finishedAt={job.finished_at} onRescan={onRescan} starting={starting} isSample={isSample} />

      {/* Q2d: 累積 ≥3 個 fix_event 後、顯示「重掃看下一輪 Top 20」綠色 banner */}
      <RescanHintBanner
        websiteId={websiteId} userId={userId}
        finishedAt={job.finished_at}
        onRescan={onRescan} starting={starting} isSample={isSample}
      />

      {/* 常見誤解 FAQ — 用戶常困惑「我看不到 X、為什麼掃到？」、預先列出來、減少誤判 bug 的回報 */}
      <CommonMisunderstandingsPanel />

      {/* 重新掃描按鈕 — 只 Pro 顯示（Free 用戶不能再 sample，要升級才能重掃）
          注：banner 內也已有「重新掃描」按鈕、這顆作為次要備援（右上角習慣性位置） */}
      {!isSample && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          {/* Agency #2: 給客戶報告匯出 — 把 finding 整理成可寄給客戶的 markdown */}
          <ClientReportButton website={website} results={results} job={job} />
          <button onClick={() => onRescan('full')} disabled={starting} style={secondaryButtonStyle}>
            {starting ? '啟動中...' : '🔄 重新掃描全站'}
          </button>
        </div>
      )}

      {/* 最有問題的 10 篇 — 用 UrlRow 渲染（跟底下列表同款、可展開看完整 finding + 修復建議 + 「我已修好」按鈕）
          這樣用戶不用再滑到底下找這 10 篇的修復方法 */}
      {offenders.length > 0 && (() => {
        // offenders 只有 {url, problemCount, severity}、用 url 對回 results.results 拿完整 finding 細節
        const offenderResults = offenders
          .map(o => (results.results || []).find(r => r.url === o.url))
          .filter(Boolean)
        if (offenderResults.length === 0) return null
        return (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>🔥 最需要修的 {offenderResults.length} 篇</h2>
            <p style={{ fontSize: 12, color: T.textLow, marginBottom: 12 }}>
              點開每一列展開 finding 詳細 + 修復建議 + 一鍵複製 HTML，修完按「✓ 我已修好」記錄 +5 XP
            </p>
            <GlassCard color={PAGE_ACCENT} style={{ padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {offenderResults.map((r, i) => (
                  <UrlRow key={i} result={r} websiteId={websiteId} userId={userId} />
                ))}
              </div>
            </GlassCard>
          </>
        )
      })()}

      {/* 全部結果列表 — Q2 預設折疊（用戶要求：先聚焦 Top 20、避免被 200 篇壓力嚇到）*/}
      <FullResultsList results={results} websiteId={websiteId} userId={userId} />
    </>
  )
}

// Sample 模式專屬：大型「N 篇待解鎖」升級 banner，放結果頁最上方第一眼看到
// 設計重點：對比「你網站有 487 篇」vs「我們只掃了 3 篇」，落差感觸發升級
function SampleUpsellBanner({ discoveredCount, scanned, locked }) {
  return (
    <div style={{
      marginBottom: 24,
      borderRadius: 14,
      padding: '22px 24px',
      background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(139,92,246,0.10) 50%, rgba(0,0,0,0.4))',
      border: '1px solid rgba(168,85,247,0.5)',
      boxShadow: '0 8px 32px rgba(168,85,247,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 36 }}>🔒</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>
            你網站總共 <span style={{ color: '#c4b5fd' }}>{discoveredCount}</span> 篇文章 — 還有 <span style={{ color: '#fbbf24' }}>{locked}</span> 篇待解鎖
          </div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>
            目前你看到的是 <strong style={{ color: T.text }}>{scanned} 篇樣本</strong>的分析結果。升級 Pro 可一次掃描全部 {discoveredCount > 200 ? '200' : discoveredCount} 篇（{discoveredCount > 200 ? '上限' : '完整'}），找出每篇的具體問題 + 完整修法。
          </div>
        </div>
        <Link to="/pricing" style={{
          padding: '12px 22px', fontSize: 14, fontWeight: 700,
          background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
          color: 'white', borderRadius: 10, textDecoration: 'none', fontFamily: T.font,
          whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(168,85,247,0.4)',
        }}>升級 Pro 解鎖全部 →</Link>
      </div>
    </div>
  )
}

// 右欄：問題分佈拆解 — 視覺仿 ContentSignature「內容品質拆解」
// 每條問題顯示：name + 受影響篇數 + 進度條（% 占 totalScanned）+ 嚴重度色
function ProblemBreakdown({ sortedProblems, totalScanned }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24,
    }}>
      <div style={{
        fontSize: 10, color: T.textLow, letterSpacing: '.1em',
        textTransform: 'uppercase', marginBottom: 14, fontWeight: 700,
      }}>
        問題分佈拆解
      </div>
      {sortedProblems.length === 0 ? (
        <p style={{ fontSize: 14, color: T.pass, textAlign: 'center', padding: '20px 0' }}>
          🎉 全站文章都通過 7 項檢測
        </p>
      ) : (
        <div style={{
          background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 10, padding: '14px 18px',
        }}>
          {sortedProblems.map((p, i) => {
            const pct = totalScanned > 0 ? Math.round(p.count / totalScanned * 100) : 0
            // 顏色依「受影響 %」三階：< 30% 綠（小範圍、易修）/ 30-60 橘（中）/ > 60 紅（大範圍、急修）
            // 跟單篇模式 ContentSignature 視覺一致 — 綠 = 好、紅 = 待急救
            const col = pct < 30 ? '#10b981' : pct < 60 ? '#f59e0b' : '#ef4444'
            return (
              <div key={p.id} style={{
                padding: '10px 0',
                borderBottom: i === sortedProblems.length - 1 ? 'none' : '1px solid rgba(255,255,255,.04)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'baseline', marginBottom: 5,
                }}>
                  <span style={{ fontSize: 11.5, color: T.text }}>{p.label}</span>
                  <span style={{
                    fontSize: 11, color: T.text, fontFamily: T.mono, fontWeight: 700,
                  }}>{p.count} 篇</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    flex: 1, height: 3,
                    background: 'rgba(255,255,255,.05)', borderRadius: 2,
                  }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, background: col,
                      borderRadius: 2, boxShadow: `0 0 6px ${col}88`,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 9.5, color: T.textLow, minWidth: 70, textAlign: 'right',
                  }}>{pct}% 篇受影響</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function UrlRow({ result, websiteId, userId }) {
  const probs = result.findings?.problems || []
  const isDone = result.status === 'done'
  const hasProblems = isDone && probs.length > 0
  const [expanded, setExpanded] = useState(false)
  // B5: 追蹤這個 URL 內哪些 finding 已被用戶按過「我已修好」
  //     用 Set 存 finding 的 problem.id（同 URL 多個同 id finding 共用一個 fixed 狀態，這個 case 罕見）
  const [fixedSet, setFixedSet] = useState(new Set())
  const [fixingId, setFixingId] = useState(null) // 哪個 finding 正在 insert（防重複點）
  const [scorePopAt, setScorePopAt] = useState(null) // finding id of last successful fix — 給 +5 XP 動畫

  return (
    <div style={{
      padding: '6px 10px',
      background: isDone && probs.length === 0 ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
      borderRadius: 4,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: hasProblems ? 'pointer' : 'default',
      }}
      onClick={() => hasProblems && setExpanded(v => !v)}>
        <a href={result.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{
          fontSize: 11, color: T.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: 'none', marginRight: 8,
        }}>{result.url}</a>
        <span style={{ fontSize: 11, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
          {!isDone ? (
            <span style={{ color: T.fail }}>❌ {result.error_message || '失敗'}</span>
          ) : probs.length === 0 ? (
            <span style={{ color: T.pass }}>✅ 通過</span>
          ) : (
            <>
              <span style={{ color: T.warn }}>⚠️ {probs.length} 問題</span>
              <span style={{ color: T.textLow, fontSize: 10 }}>{expanded ? '▾' : '▸'}</span>
            </>
          )}
        </span>
      </div>
      {/* Q2/Bug B: WP 後台編輯路徑提示 — 告訴用戶這個 URL 要去 WP 哪裡編輯（特別針對 /shop/ / locations.kml 等特殊 URL）*/}
      {hasProblems && expanded && result.findings?.wp_admin_hint && (
        <WpAdminHintBanner hint={result.findings.wp_admin_hint} />
      )}
      {hasProblems && expanded && (
        <ul style={{
          margin: '8px 0 4px 16px', padding: 0, listStyle: 'none',
          fontSize: 11, color: T.textMid, lineHeight: 1.6,
        }}>
          {probs.map((p, i) => {
            const tip = PROBLEM_FIX_TIPS[p.id]
            return (
              <li key={i} style={{
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: i === probs.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>{SEVERITY_ICON[p.severity] || '⚪'}</span>
                  <span style={{ fontWeight: 600, color: T.text }}>{p.label || PROBLEM_LABELS[p.id] || p.id}</span>
                  {p.fix_owner && <FixOwnerChip owner={p.fix_owner} />}
                </div>
                {/* multi_h1 — 顯示每個 H1 的內容卡片 + 建議動作（worker 已在 findings.problems[].h1_details 拆好） */}
                {Array.isArray(p.h1_details) && p.h1_details.length > 0 && (
                  <div style={{ marginTop: 6, marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.h1_details.map((d, di) => (
                      <H1DetailCard key={di} detail={d} />
                    ))}
                  </div>
                )}
                {/* Stage 2: meta_title / meta_desc / canonical 等 finding 帶 suggestion 物件時、渲染建議區塊 */}
                {p.suggestion && (
                  <div style={{ marginTop: 6, marginLeft: 20 }}>
                    <SuggestionBlock suggestion={p.suggestion} />
                  </div>
                )}
                {tip && (
                  <div style={{
                    marginTop: 4, marginLeft: 20,
                    fontSize: 11, color: T.textMid, lineHeight: 1.65,
                    padding: '6px 10px',
                    background: 'rgba(236,72,153,0.06)',          // 粉紅微底（呼應文章分析家族色）
                    borderLeft: '2px solid rgba(236,72,153,0.4)',
                    borderRadius: 4,
                  }}>
                    <strong style={{ color: '#f9a8d4' }}>💡 怎麼修：</strong>{tip}
                  </div>
                )}
                {/* B5: 我已修好按鈕 — 寫 fix_event 進 DB、給 +5 XP（gamification 累計、可能觸發升等 / 徽章解鎖）*/}
                <FixDoneButton
                  isFixed={fixedSet.has(`${i}-${p.id}`)}
                  isFixing={fixingId === `${i}-${p.id}`}
                  showPop={scorePopAt === `${i}-${p.id}`}
                  onClick={async () => {
                    const key = `${i}-${p.id}`
                    if (fixedSet.has(key) || fixingId) return
                    if (!userId) {
                      alert('請先登入才能記錄修復')
                      return
                    }
                    setFixingId(key)
                    try {
                      await recordFixEvent({
                        userId,
                        websiteId,
                        findingId: p.id,
                        url: result.url,
                        source: 'bulk_scan',
                      })
                      setFixedSet(prev => new Set(prev).add(key))
                      setScorePopAt(key)
                      setTimeout(() => setScorePopAt(prev => prev === key ? null : prev), 1600)
                    } catch (err) {
                      console.error('recordFixEvent error:', err)
                      alert('記錄失敗 — 可能是 fix_events 表還沒建。請聯絡客服或檢查 Supabase Dashboard')
                    } finally {
                      setFixingId(null)
                    }
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// multi_h1 警告展開時的每個 H1 詳情卡 — 顯示內容預覽 + 分類 chip + 建議動作說明
// detail 結構：{ index, text, full_length, kind: 'empty'|'sentence'|'short', suggested_action: 'keep'|'change_to_p'|'change_to_h2'|'delete', reason }
function H1DetailCard({ detail }) {
  const { index, text, full_length, kind, suggested_action, reason, is_duplicate } = detail
  // 不同建議動作對應不同顏色：保留=綠、改 h2=藍、改 p=粉、刪除=橘
  const actionStyle = {
    keep:          { label: '✅ 保留',         color: '#86efac', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)' },
    change_to_h2:  { label: '🔵 改成 <h2>',    color: '#93c5fd', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.35)' },
    change_to_p:   { label: '🔴 改成 <p>',     color: '#fca5a5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)' },
    delete:        { label: '❌ 直接刪整行',    color: '#fdba74', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.35)' },
  }[suggested_action] || { label: suggested_action, color: T.textMid, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' }

  // kind chip 顏色：empty 橘灰、sentence 粉、short 中性
  const kindChip = {
    empty:    { text: '空 H1',           bg: 'rgba(249,115,22,0.15)', color: '#fdba74' },
    sentence: { text: `句子型 ${full_length} 字`, bg: 'rgba(236,72,153,0.15)', color: '#f9a8d4' },
    short:    { text: `短標題 ${full_length} 字`,  bg: 'rgba(255,255,255,0.06)', color: T.textMid },
  }[kind] || { text: kind, bg: 'rgba(255,255,255,0.06)', color: T.textMid }

  return (
    <div style={{
      padding: '8px 10px',
      background: actionStyle.bg,
      borderLeft: `2px solid ${actionStyle.border}`,
      borderRadius: 4,
      fontSize: 11,
      lineHeight: 1.6,
    }}>
      {/* 標頭：H1#N + 分類 chip + 重複 chip（若 is_duplicate） + 建議動作 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: T.text }}>H1#{index}</span>
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 3,
          background: kindChip.bg, color: kindChip.color,
        }}>{kindChip.text}</span>
        {is_duplicate && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: 'rgba(251,191,36,0.18)', color: '#fcd34d',
            fontWeight: 700,
          }}>🔁 內容重複</span>
        )}
        <span style={{ fontWeight: 600, color: actionStyle.color, fontSize: 11 }}>{actionStyle.label}</span>
      </div>
      {/* 內容預覽（空 H1 不顯示）— 用 monospace 強調是原 HTML 的可辨識片段 */}
      {kind !== 'empty' && (
        <div style={{
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 3,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          color: T.textMid,
          fontSize: 10.5,
          marginBottom: 4,
          wordBreak: 'break-all',
        }}>
          {text.length > 120 ? text.slice(0, 120) + '…' : text}
        </div>
      )}
      {/* 原因說明 */}
      <div style={{ color: T.textLow, fontSize: 10.5 }}>{reason}</div>
    </div>
  )
}

// Agency #2: 給客戶報告按鈕 + modal — 把 finding 整理成 markdown、可一鍵複製或下載
// 點按鈕 → 跳 modal → 預覽 markdown + 兩顆 CTA（複製到剪貼簿 / 下載 .md 檔）
function ClientReportButton({ website, results, job }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!website || !results) return null

  const md = buildClientReport({
    websiteUrl: website.url,
    websiteName: website.name,
    results: results.results || [],
    scanDate: job?.finished_at,
    agencyName: '優勢方舟數位行銷',
  })

  const handleCopy = async () => {
    await copyToClipboard(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const handleDownload = () => {
    const safeName = (website.name || 'site').replace(/[^\w一-龥]+/g, '-')
    const date = new Date().toISOString().slice(0, 10)
    downloadMarkdown(`AI雷達報告-${safeName}-${date}.md`, md)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 20px',
          fontSize: 13,
          fontWeight: 700,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.10))',
          color: '#c4b5fd',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: T.font,
        }}
      >
        📤 給客戶報告
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 760,
              maxHeight: '85vh',
              background: 'linear-gradient(135deg, rgba(8,71,115,0.95), rgba(0,0,0,0.95))',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 14,
              padding: 24,
              display: 'flex', flexDirection: 'column',
              fontFamily: T.font,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>📤 給客戶報告</h2>
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', border: 'none',
                color: T.textMid, fontSize: 22, cursor: 'pointer',
              }}>×</button>
            </div>
            {/* 說明 */}
            <p style={{ fontSize: 12, color: T.textMid, marginBottom: 12, lineHeight: 1.6 }}>
              把這次掃描結果整理成<strong style={{ color: 'white' }}>客戶能讀懂的 markdown 報告</strong>。
              已自動分類「客戶要 WP 後台處理」「需寫內容」「我們已用 SEO 外掛處理」三段、不需技術背景就能看。
            </p>
            {/* Preview */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 11.5,
              lineHeight: 1.7,
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 14,
            }}>{md}</div>
            {/* CTA buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleDownload}
                style={{
                  padding: '10px 16px',
                  fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)',
                  color: T.text,
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: T.font,
                }}
              >📥 下載 .md 檔</button>
              <button
                onClick={handleCopy}
                style={{
                  padding: '10px 18px',
                  fontSize: 13, fontWeight: 700,
                  background: copied
                    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                    : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: T.font,
                  boxShadow: '0 4px 14px rgba(139,92,246,0.4)',
                }}
              >{copied ? '✅ 已複製' : '📋 複製到剪貼簿'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Agency #1: 修復者權限 chip — 給 agency 一眼分辨「自己用 SEO 外掛就能解」vs「要請客戶開 WP 後台幫忙」
// fix_owner 是後端 tagFixOwners 標的、跟 PROBLEM_FIX_TIPS 互補
const FIX_OWNER_META = {
  seo_plugin: {
    label: '🛠️ SEO 外掛可解',
    bg: 'rgba(16,185,129,0.15)', color: '#86efac', border: 'rgba(16,185,129,0.4)',
    title: '你 / 客戶的 Rank Math 或 Yoast 帳號就能改、不用動 WP 後台',
  },
  wp_admin: {
    label: '🔑 需 WP 後台',
    bg: 'rgba(251,191,36,0.15)', color: '#fcd34d', border: 'rgba(251,191,36,0.4)',
    title: '需要 WP 編輯器改文章 / 商品 / 頁面內容 — 如果你是 agency 沒 admin 權、得請客戶處理或要授權',
  },
  content_writer: {
    label: '✍️ 需要寫內容',
    bg: 'rgba(236,72,153,0.15)', color: '#f9a8d4', border: 'rgba(236,72,153,0.4)',
    title: '不是設定問題、是要實際撰寫文字（字數不夠等）— 通常請客戶或文案人員處理',
  },
}
function FixOwnerChip({ owner }) {
  const meta = FIX_OWNER_META[owner]
  const [open, setOpen] = useState(false)
  if (!meta) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 999,
          background: meta.bg, color: meta.color,
          border: `1px solid ${meta.border}`,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: T.font,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        {meta.label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>{open ? '▴' : '▾'}</span>
      </button>
      {/* 點開後的浮動說明小框 — absolutely positioned 避免擠壓行內排版 */}
      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 280, maxWidth: 360,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.95)',
            border: `1px solid ${meta.border}`,
            borderRadius: 8,
            fontSize: 11,
            color: T.text,
            lineHeight: 1.6,
            zIndex: 50,
            fontWeight: 400,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontWeight: 700, color: meta.color, marginBottom: 4 }}>
            {meta.label}
          </div>
          {meta.title}
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', top: 4, right: 6,
              background: 'transparent', border: 'none',
              color: T.textMid, fontSize: 14, cursor: 'pointer',
              padding: 0, lineHeight: 1,
            }}
          >×</button>
        </span>
      )}
    </span>
  )
}

// 常見誤解 FAQ panel — 預先列出 5 種「看起來像 bug、其實是網站特殊狀況」的情境
// 設計動機：用戶反覆把這幾類狀況回報為 bug、實際上是 WP/主題/外掛行為
// 預設折疊（不擋掉重點）、用戶展開後可以對照自己的狀況
function CommonMisunderstandingsPanel() {
  const [open, setOpen] = useState(false)
  const cases = [
    {
      symptom: '我編輯器 Ctrl+F 找 `<h1>` 只看到 1 個、但掃描說有 2 個',
      cause: 'WordPress 主題在渲染時會自動在你的內容前加一個「文章標題」的 `<h1>`、編輯器看不到（不在文章 body）',
      verify: '右鍵網頁 → 檢視原始碼 → Ctrl+F 搜 `<h1` 看實際渲染後幾個',
    },
    {
      symptom: '我編輯器只寫 1 個 H1、但掃描說 2-3 個內容相同的 H1',
      cause: '兩種最常見原因：\n（A）**WooCommerce 商品頁** — 你可能在「商品簡述」+「商品說明」兩個欄位都貼了相同內容 → 商品頁渲染 2 次 → 找下方的「商品簡述」欄位清空\n（B）**WPBakery / Elementor 響應式雙版本** — 同個 heading 渲染成桌面 + 手機兩份、CSS 只 hide 不 unmount、DOM 還是兩個（Google 也看到兩個）',
      verify: '右鍵 → 檢視原始碼 → 搜 `<h1` → 看是不是 2 個內容一模一樣。如果是商品頁、優先檢查 WooCommerce「商品簡述」欄位（可能在頁面下方、要從右上「顯示選項」打開）',
    },
    {
      symptom: '我已經修了、但掃描結果還是顯示舊問題',
      cause: '`findings` 是「上次掃描那一刻」的快照、不會自動 re-eval、修完線上之後 DB 還是舊資料',
      verify: '按頁面上方「🔄 重新掃描全站」、或等下次自動掃 → 新一輪會反映',
    },
    {
      symptom: '我看 Rank Math 後台「Meta 描述」明明是 130 字、但掃描說 477 字',
      cause: 'Rank Math 後台「Title 模板」可能有 hardcode 後綴 (如 `| 台南汽車影音改裝 | ...`)、後台只算 `%title% %sep% %sitename%` 變數部分、hardcode 段沒計入',
      verify: '右鍵 → 檢視原始碼 → 搜 `name="description"` → 看實際渲染的 content="..." 內容',
    },
    {
      symptom: '我 WP 後台找不到對應的編輯位置（如 /shop/、/locations.kml）',
      cause: '/shop/ 是 WooCommerce archive、不是普通 page；/locations.kml 是 Rank Math Local SEO 外掛產的 XML、不是給編輯的',
      verify: '每個 URL 展開時上方藍色「🗺️ WP 後台位置」banner 會告訴你具體去哪改',
    },
  ]
  return (
    <div style={{
      marginBottom: 18,
      padding: '12px 16px',
      background: 'rgba(139,92,246,0.06)',
      border: '1px solid rgba(139,92,246,0.25)',
      borderRadius: 10,
      fontSize: 13,
    }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 18 }}>🤔</span>
        <span style={{ flex: 1, color: T.text }}>
          <strong>掃描結果跟我看到的不一樣？</strong>
          <span style={{ color: T.textLow, marginLeft: 8, fontSize: 12 }}>5 種常見狀況、開啟前先確認</span>
        </span>
        <span style={{ color: T.textLow, fontSize: 11 }}>{open ? '▾ 收起' : '▸ 展開'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(139,92,246,0.2)' }}>
          {cases.map((c, i) => (
            <details key={i} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', color: T.text, fontWeight: 600, padding: '4px 0' }}>
                {i + 1}. {c.symptom}
              </summary>
              <div style={{ marginLeft: 16, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, fontSize: 12, whiteSpace: 'pre-line' }}>
                <div style={{ marginBottom: 4, color: T.textMid }}>
                  <strong style={{ color: '#c4b5fd' }}>原因：</strong>{c.cause}
                </div>
                <div style={{ color: T.textMid }}>
                  <strong style={{ color: '#86efac' }}>怎麼驗證：</strong>{c.verify}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

// Q2/Bug B: WP 後台編輯路徑提示 — 從 finding.wp_admin_hint 展開
// hint 結構：{ where, plugin?, steps: string[], note? }
// 用戶常常困惑「這個 URL 要去 WP 哪裡編輯」（特別是 /shop/ / locations.kml / homepage）
// 在 UrlRow 展開的 finding 列表上方顯示一條藍色 info banner、一次性告訴用戶後續找法
function WpAdminHintBanner({ hint }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      margin: '8px 0 4px 16px',
      padding: '8px 12px',
      background: 'rgba(59,130,246,0.08)',
      border: '1px solid rgba(59,130,246,0.3)',
      borderRadius: 6,
      fontSize: 11,
      color: T.textMid,
      lineHeight: 1.6,
    }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14 }}>🗺️</span>
        <span style={{ flex: 1 }}>
          <strong style={{ color: '#93c5fd' }}>WP 後台位置：</strong>{hint.where}
          {hint.plugin && <span style={{ color: T.textLow }}> · 需要 {hint.plugin}</span>}
        </span>
        <span style={{ color: T.textLow, fontSize: 10 }}>{open ? '▾ 收起步驟' : '▸ 展開步驟'}</span>
      </div>
      {open && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(59,130,246,0.15)' }}>
          <ol style={{ margin: 0, paddingLeft: 20, color: T.text }}>
            {(hint.steps || []).map((s, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{s}</li>
            ))}
          </ol>
          {hint.note && (
            <div style={{
              marginTop: 6,
              padding: '4px 8px',
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 4,
              fontSize: 10,
              color: '#fcd34d',
            }}>💡 {hint.note}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Q2: 全部結果列表 — 預設折疊（指數降低用戶面對 200 篇的壓力）、按鈕展開才顯示全部
// 設計取捨：保留資料可訪問性、但 default 收起來讓用戶聚焦 Top 20
function FullResultsList({ results, websiteId, userId }) {
  const [expanded, setExpanded] = useState(false)
  const total = results.results?.length || 0
  if (total === 0) return null
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: 0 }}>📋 全部結果（{total}）</h2>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
            color: T.textMid,
            border: `1px solid ${T.cardBorder}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: T.font,
          }}
        >
          {expanded ? '▴ 收起全部' : `▾ 展開看全部 ${total} 篇`}
        </button>
      </div>
      {expanded ? (
        <GlassCard color={PAGE_ACCENT} style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
            {(results.results || []).map((r, i) => (
              <UrlRow key={i} result={r} websiteId={websiteId} userId={userId} />
            ))}
          </div>
        </GlassCard>
      ) : (
        <p style={{ fontSize: 12, color: T.textLow, marginBottom: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px dashed ${T.cardBorder}`, borderRadius: 8 }}>
          💡 先聚焦上面的 Top 20、修完按「重新掃描」會顯示下一輪 Top 20。要看全部 {total} 篇按右上「展開」
        </p>
      )}
    </>
  )
}

// Q2d: 「修了 N 個 finding、重掃看下一輪 Top 20」banner
// 條件：當前 job 完成後、用戶針對這個 website 累積了 fix_events、提示重掃看新狀態
function RescanHintBanner({ websiteId, userId, finishedAt, onRescan, starting, isSample }) {
  const [recentFixCount, setRecentFixCount] = useState(0)

  useEffect(() => {
    if (!websiteId || !userId || !finishedAt) return
    let cancelled = false
    async function check() {
      const { data } = await supabase
        .from('fix_events')
        .select('id', { count: 'exact' })
        .eq('website_id', websiteId)
        .eq('user_id', userId)
        .gt('created_at', finishedAt)
      if (!cancelled) setRecentFixCount(data?.length || 0)
    }
    check()
    return () => { cancelled = true }
  }, [websiteId, userId, finishedAt])

  // 至少 3 個 fix_event 才顯示（避免一兩個就嘮叨）
  if (recentFixCount < 3 || isSample) return null

  return (
    <div style={{
      marginBottom: 18,
      padding: '14px 18px',
      background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.04))',
      border: '1px solid rgba(34,197,94,0.4)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 22 }}>🎉</span>
      <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: T.text, lineHeight: 1.6 }}>
        你已經修了 <strong style={{ color: '#86efac' }}>{recentFixCount} 個 finding</strong>！
        <strong style={{ color: T.text }}>重新掃描</strong>確認效果、並看下一輪 Top 20 該修什麼。
      </div>
      <button
        onClick={() => onRescan('full')}
        disabled={starting}
        style={{
          padding: '8px 16px',
          fontSize: 12,
          fontWeight: 700,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          color: 'white',
          border: 'none',
          borderRadius: 7,
          cursor: starting ? 'not-allowed' : 'pointer',
          opacity: starting ? 0.5 : 1,
          fontFamily: T.font,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
        }}
      >
        {starting ? '啟動中...' : '🔄 立刻重新掃描'}
      </button>
    </div>
  )
}

// 快照時效提示 banner — 告訴用戶「這次掃描的結果是快照、線上可能已不同」
// 解決重複痛點：用戶在 WP 改完後回來看 BulkScan 結果頁、誤以為「修了沒生效」
// （實際上是 findings JSONB 不會自動 re-compute、要重掃才會更新）
function StaleSnapshotBanner({ finishedAt, onRescan, starting, isSample }) {
  if (!finishedAt) return null
  const minsAgo = Math.floor((Date.now() - new Date(finishedAt)) / 60000)
  // 5 分鐘內視為新鮮、不顯示提示（避免用戶剛掃完就被嚇到）
  if (minsAgo < 5) return null

  const ago = minsAgo < 60 ? `${minsAgo} 分鐘前` : minsAgo < 60 * 24 ? `${Math.floor(minsAgo / 60)} 小時前` : `${Math.floor(minsAgo / (60 * 24))} 天前`

  return (
    <div style={{
      marginBottom: 18,
      padding: '12px 16px',
      background: 'rgba(251,191,36,0.08)',
      border: '1px solid rgba(251,191,36,0.3)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 18 }}>📸</span>
      <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>
        這是 <strong style={{ color: T.text }}>{ago}</strong> 跑的掃描快照、可能與你網站上的<strong style={{ color: T.text }}>當前狀態不一致</strong>。
        如果你已經修了某些 finding、按右邊重新掃描才能確認修復生效。
      </div>
      {!isSample && (
        <button
          onClick={() => onRescan('full')}
          disabled={starting}
          style={{
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: '#000',
            border: 'none',
            borderRadius: 7,
            cursor: starting ? 'not-allowed' : 'pointer',
            opacity: starting ? 0.5 : 1,
            fontFamily: T.font,
            whiteSpace: 'nowrap',
          }}
        >
          {starting ? '啟動中...' : '🔄 立刻重掃確認'}
        </button>
      )}
    </div>
  )
}

// B5: 我已修好按鈕 — 三狀態（待修 / 修復中 / 已修復）+ 浮起 +5 XP 動畫 + 粒子放射
// isFixed：DB 已寫入完成、按鈕變綠色「已記錄修復 +5 XP」
// isFixing：點完還在 await insert、按鈕變 disable + 文字「記錄中...」
// showPop：剛剛 insert 成功、播放 1.6s 的 +5 XP 浮起動畫 + 同步 12 顆粒子四散
function FixDoneButton({ isFixed, isFixing, showPop, onClick }) {
  // C1: 粒子配置 — 12 顆、隨機散開、不同角度與距離增加自然感
  // 用 useMemo 避免每次重 render 重算（不過 popup 一次性、影響小）
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + (Math.PI / 24) // 略偏離正軸
    const dist = 38 + Math.random() * 22
    return {
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist,
      delay: Math.random() * 80,
    }
  })
  return (
    <div style={{ marginTop: 6, marginLeft: 20, position: 'relative' }}>
      <button
        onClick={onClick}
        disabled={isFixed || isFixing}
        style={{
          padding: '6px 14px',
          fontSize: 11,
          fontWeight: 700,
          background: isFixed
            ? 'rgba(34,197,94,0.18)'
            : isFixing
              ? 'rgba(255,255,255,0.08)'
              : 'linear-gradient(135deg, rgba(20,184,166,0.18), rgba(20,184,166,0.08))',
          color: isFixed ? '#86efac' : isFixing ? T.textMid : '#5eead4',
          border: `1px solid ${isFixed ? 'rgba(34,197,94,0.5)' : 'rgba(20,184,166,0.4)'}`,
          borderRadius: 6,
          cursor: (isFixed || isFixing) ? 'default' : 'pointer',
          fontFamily: T.font,
        }}
      >
        {isFixed
          ? '✅ 已記錄修復 +5 XP'
          : isFixing
            ? '⏳ 記錄中...'
            : '✓ 我已修好 → 記錄修復'}
      </button>
      {/* +5 XP 浮起動畫 + 12 顆綠粒子放射（C1） */}
      {showPop && (
        <>
          <span style={{
            position: 'absolute',
            left: 110, top: 0,
            fontSize: 16,
            fontWeight: 900,
            color: '#86efac',
            textShadow: '0 0 12px rgba(34,197,94,0.8)',
            pointerEvents: 'none',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            animation: 'bulkscan-score-pop 1.6s cubic-bezier(0.16,1,0.3,1) forwards',
            zIndex: 2,
          }}>+5 XP</span>
          {/* 粒子層 — 從按鈕中央放射 */}
          <div style={{
            position: 'absolute',
            left: 130, top: 12,
            width: 0, height: 0,
            pointerEvents: 'none',
            zIndex: 1,
          }}>
            {particles.map((p, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: 0, top: 0,
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px rgba(34,197,94,0.8)',
                  opacity: 0,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  animation: `bulkscan-particle-fly 1.2s cubic-bezier(0.16,1,0.3,1) ${p.delay}ms forwards`,
                }}
              />
            ))}
          </div>
        </>
      )}
      <style>{`
        @keyframes bulkscan-score-pop {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          15%  { transform: translateY(-6px) scale(1.3); opacity: 1; }
          60%  { transform: translateY(-32px) scale(1.4); opacity: 1; }
          100% { transform: translateY(-70px) scale(1); opacity: 0; }
        }
        @keyframes bulkscan-particle-fly {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          20%  { transform: translate(0, 0) scale(1.4); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// Stage 2: meta_title / meta_desc / canonical 等 finding 的建議區塊
// suggestion 結構：{ kind, current?, current_len?, suggested?, suggested_len?, code_snippet?, note? }
function SuggestionBlock({ suggestion }) {
  const { current, current_len, suggested, suggested_len, code_snippet, note } = suggestion
  // 追蹤剛剛複製的是哪一個按鈕（'text' = 改後純文字 / 'code' = HTML tag），這樣每顆按鈕的 ✅ 提示獨立
  const [copiedKey, setCopiedKey] = useState(null)

  function handleCopy(key, value) {
    if (!value) return
    const fallback = () => {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    try {
      navigator.clipboard.writeText(value).catch(fallback)
    } catch { fallback() }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(prev => prev === key ? null : prev), 1800)
  }

  // 純文字複製鈕（給「改後」/「建議內容」用 — 給只能貼純文字的 SEO 外掛欄位）
  function MiniCopyBtn({ value, copiedFlag }) {
    return (
      <button
        onClick={() => handleCopy('text', value)}
        style={{
          padding: '1px 6px', fontSize: 9.5, fontWeight: 600,
          background: copiedFlag ? 'rgba(16,185,129,0.25)' : 'rgba(16,185,129,0.12)',
          color: copiedFlag ? '#86efac' : '#a7f3d0',
          border: `1px solid ${copiedFlag ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.35)'}`,
          borderRadius: 3, cursor: 'pointer', fontFamily: T.font,
          marginLeft: 6, verticalAlign: 'middle',
        }}
      >{copiedFlag ? '✅' : '📋'} {copiedFlag ? '已複製' : '複製文字'}</button>
    )
  }

  return (
    <div style={{
      padding: '8px 10px',
      background: 'rgba(20,184,166,0.08)',           // 青綠微底（呼應主題色）
      borderLeft: '2px solid rgba(20,184,166,0.4)',
      borderRadius: 4,
      fontSize: 11,
      lineHeight: 1.6,
    }}>
      {/* 改前 / 改後對照（只有 current+suggested 都存在才顯示） */}
      {current && suggested && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          <div>
            <span style={{ color: T.textLow, fontSize: 10 }}>改前 {current_len ? `(${current_len} 字)` : ''}</span>
            <div style={{
              padding: '3px 8px', borderRadius: 3,
              background: 'rgba(239,68,68,0.08)',
              color: T.textMid,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 10.5,
              marginTop: 2,
              wordBreak: 'break-all',
            }}>{current}</div>
          </div>
          <div>
            <span style={{ color: '#86efac', fontSize: 10 }}>
              改後 {suggested_len ? `(${suggested_len} 字)` : ''}
              <MiniCopyBtn value={suggested} copiedFlag={copiedKey === 'text'} />
            </span>
            <div style={{
              padding: '3px 8px', borderRadius: 3,
              background: 'rgba(16,185,129,0.10)',
              color: T.text,
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: 10.5,
              marginTop: 2,
              wordBreak: 'break-all',
            }}>{suggested}</div>
          </div>
        </div>
      )}
      {/* 純建議（無 current 對照、例如 missing_meta_desc / missing_canonical） */}
      {!current && suggested && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: '#86efac', fontSize: 10 }}>
            建議內容 {suggested_len ? `(${suggested_len} 字)` : ''}
            <MiniCopyBtn value={suggested} copiedFlag={copiedKey === 'text'} />
          </span>
          <div style={{
            padding: '3px 8px', borderRadius: 3,
            background: 'rgba(16,185,129,0.10)',
            color: T.text,
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 10.5,
            marginTop: 2,
            wordBreak: 'break-all',
          }}>{suggested}</div>
        </div>
      )}
      {/* 可複製的 code snippet — 顯示完整 HTML tag 給用戶貼回 */}
      {code_snippet && (
        <div style={{ marginBottom: note ? 6 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: T.textLow, fontSize: 10 }}>{'複製這段貼到 <head>'}</span>
            <button
              onClick={() => handleCopy('code', code_snippet)}
              style={{
                padding: '2px 8px', fontSize: 10, fontWeight: 600,
                background: copiedKey === 'code' ? 'rgba(16,185,129,0.25)' : 'rgba(20,184,166,0.18)',
                color: copiedKey === 'code' ? '#86efac' : '#5eead4',
                border: `1px solid ${copiedKey === 'code' ? 'rgba(16,185,129,0.5)' : 'rgba(20,184,166,0.5)'}`,
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: T.font,
              }}
            >
              {copiedKey === 'code' ? '✅ 已複製' : '📋 複製整段 HTML'}
            </button>
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 3,
            background: 'rgba(0,0,0,0.35)',
            color: '#a7f3d0',
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 10.5,
            // 多行模板（OG / Schema）保留換行 + 縮排；單行短 tag 也能正常顯示
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 280,
            overflowY: 'auto',
          }}>{code_snippet}</div>
        </div>
      )}
      {/* 擇一提示 — 只有同時提供「純文字」+「HTML tag」兩種複製選項時才顯示，避免用戶兩個都做造成重複 tag */}
      {suggested && code_snippet && (
        <div style={{
          marginBottom: note ? 6 : 0,
          padding: '4px 8px',
          background: 'rgba(251,191,36,0.10)',
          borderRadius: 3,
          color: '#fcd34d',
          fontSize: 10,
          lineHeight: 1.55,
        }}>
          💡 兩個複製按鈕<strong>擇一使用</strong>：用 SEO 外掛（Rank Math / Yoast）的話複製「文字」貼進外掛欄位；自己改主題 HTML 的話複製「整段 HTML」貼到 {'<head>'}。<strong>不要兩個都做</strong>會產生重複的 tag
        </div>
      )}
      {/* 說明文字 */}
      {note && <div style={{ color: T.textLow, fontSize: 10.5 }}>{note}</div>}
    </div>
  )
}

// 共用暗色背景（與 ContentAudit / SEOAudit / HomeDark 同款青綠雙漸層 + 雜訊）
function PageWrap({ children }) {
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

      <SiteHeader />
      <main style={{ position: 'relative', zIndex: 10, maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>
        {children}
      </main>
      <Footer dark />
    </div>
  )
}

// ─────────── 樣式常數 ───────────

const primaryButtonStyle = {
  padding: '12px 28px', fontSize: 14, fontWeight: 700,
  background: `linear-gradient(135deg, ${PAGE_ACCENT}, #f472b6)`,
  color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: T.font,
}
const secondaryButtonStyle = {
  padding: '10px 20px', fontSize: 13, fontWeight: 600,
  background: 'rgba(255,255,255,0.05)', color: T.text,
  border: `1px solid ${T.cardBorder}`, borderRadius: 8, cursor: 'pointer', fontFamily: T.font,
}
const cancelButtonStyle = {
  padding: '6px 14px', fontSize: 12,
  background: 'rgba(239,68,68,0.1)', color: '#fca5a5',
  border: `1px solid ${T.fail}55`, borderRadius: 6, cursor: 'pointer', fontFamily: T.font,
}
const proButtonStyle = {
  display: 'inline-block', padding: '12px 28px', fontSize: 14, fontWeight: 700,
  background: `linear-gradient(135deg, ${T.orange}, #f59e0b)`,
  color: 'white', borderRadius: 10, textDecoration: 'none', fontFamily: T.font,
}

// ─────────── 問題 label / severity 對照（跟 cron-bulk-scan.js 的 problem id 同步）───────────

const PROBLEM_LABELS = {
  missing_h1: '頁面沒有 H1 標題',
  multiple_h1: '頁面有多個 H1（應只有 1 個）',
  missing_meta_title: '缺 <title> 標題',
  short_meta_title: '標題過短（< 20 字）',
  long_meta_title: '標題過長（> 70 字，Google SERP 會截斷）',
  missing_meta_desc: '缺 Meta 描述',
  short_meta_desc: 'Meta 描述過短（< 50 字）',
  long_meta_desc: 'Meta 描述過長（> 200 字）',
  missing_og: '完全沒有 Open Graph 標籤',
  incomplete_og: 'Open Graph 不完整',
  no_json_ld: '完全沒有 JSON-LD 結構化資料',
  no_article_schema: '文章頁缺 Article schema',
  no_product_schema: '商品頁缺 Product schema',
  thin_content: '文章內容過少（< 200 字）',
  short_content: '文章較短（< 300 字）',
  missing_canonical: '缺 canonical 標籤',
}
const PROBLEM_SEVERITY = {
  missing_h1: 'high', multiple_h1: 'medium',
  missing_meta_title: 'high', short_meta_title: 'medium', long_meta_title: 'low',
  missing_meta_desc: 'high', short_meta_desc: 'medium', long_meta_desc: 'low',
  missing_og: 'medium', incomplete_og: 'low',
  no_json_ld: 'high', no_article_schema: 'medium', no_product_schema: 'medium',
  thin_content: 'high', short_content: 'low',
  missing_canonical: 'low',
}
const SEVERITY_ICON = { high: '🔴', medium: '🟡', low: '⚪' }

// 每個 problem 對應的「怎麼修」短提示 — 一兩句白話，不用看完整 fix guide 也能動手
// 對應到 fixGuides.js 的完整修法，但這裡是濃縮版（UrlRow 展開時 inline 顯示）
const PROBLEM_FIX_TIPS = {
  missing_h1:
    '用你的 page builder（Elementor / WPBakery / Divi）打開頁面 → 找最大標題那個 widget → 「HTML 標籤」改 H1 → 更新。Gutenberg 編輯器：標題用「標題 1」格式',
  multiple_h1:
    '進文章編輯 → 切「程式碼編輯器」→ Ctrl+F 搜 <h1>。注意：WP 主題會自動加 1 個文章標題 H1（編輯器看不到），所以正確的剩 1 個 H1 = 編輯器裡 0 個。空 H1（<h1></h1>，page builder 殘留）直接整行刪；有文字的 H1 改成 <h2> 或 <h3>',

  missing_meta_title:
    '安裝 Yoast SEO 或 Rank Math 外掛 → 編輯文章 → 下方 SEO 區塊「SEO 標題」欄位填 30-60 字含主關鍵字',
  short_meta_title:
    '標題太短搜尋引擎判定資訊量不足。擴充到 30-60 字、含主關鍵字 + 品牌名',
  long_meta_title:
    'Google SERP 通常截斷 60 字後內容。壓縮到 30-60 字，重要關鍵字放前段',

  missing_meta_desc:
    'Yoast SEO / Rank Math → 編輯文章 → SEO 區塊「Meta 描述」欄位填 70-155 字，包含目標關鍵字 + 行動呼籲',
  short_meta_desc:
    'Meta 描述太短 Google 會自動補抓內容、不一定符合你的訴求。擴充到 70-155 字',
  long_meta_desc:
    'Google SERP 通常只顯示前 155 字。壓縮到 70-155 字，重要訊息放前段',

  missing_og:
    'Yoast SEO 或 Rank Math（二選一）→ 編輯文章 → 「社群」(Yoast) 或「Social」(Rank Math) 分頁 → 填 Facebook / X 標題、描述、圖片 1200×630px',
  incomplete_og:
    'OG 必要三要素：og:title / og:description / og:image。缺哪個用 Yoast / Rank Math 補上即可',

  no_json_ld:
    '最快：用 AI 雷達 Pro 的「個人化 Organization Schema 產生器」一鍵生 code（在 AEO 詳情頁下方）。或安裝 Rank Math / Schema Pro 外掛自動加',
  no_article_schema:
    'Rank Math 免費版有「Article Schema」設定 — 編輯文章 → 切「Schema」分頁 → 套用 Article 範本 → 自動補完作者、日期、圖片',
  no_product_schema:
    'WooCommerce / Shopify 預設會自動產 Product schema。若沒有：Rank Math 「Schema」分頁套 Product 範本、或用 Yoast Local SEO（付費）。確認價格、庫存、評論欄位都有填。',

  thin_content:
    '文章太短 AI 跟 Google 都視為「薄內容」、引用機率低。擴充到 300+ 字，加入實例、數據、步驟說明',
  short_content:
    '建議擴充到 300+ 字，分段落 + 加案例 / 數據 / FAQ 區塊提升深度',

  missing_canonical:
    'Yoast SEO / Rank Math 預設會自動加 canonical — 安裝任一個即可。要手動只發生在多語言互指或分頁/篩選頁',
}
