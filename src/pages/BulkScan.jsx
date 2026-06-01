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
    try {
      const session = (await supabase.auth.getSession()).data?.session
      if (!session) throw new Error('未登入')
      const r = await fetch('/api/bulk-scan?action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ websiteId, mode }),
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
      if (r.ok) setResults(data)
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
        <ResultsView job={job} results={results} onRescan={handleStart} starting={starting} />
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

function ResultsView({ job, results, onRescan, starting }) {
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

      {/* 重新掃描按鈕 — 只 Pro 顯示（Free 用戶不能再 sample，要升級才能重掃） */}
      {!isSample && (
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onRescan} disabled={starting} style={secondaryButtonStyle}>
            {starting ? '啟動中...' : '🔄 重新掃描全站'}
          </button>
        </div>
      )}

      {/* 最有問題的 10 篇 */}
      {offenders.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12 }}>🔥 最需要修的 10 篇</h2>
          <GlassCard color={PAGE_ACCENT} style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {offenders.map((o, i) => (
                <a key={i} href={o.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.cardBorder}`,
                  borderRadius: 6, textDecoration: 'none',
                }}>
                  <span style={{ fontSize: 12, color: T.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{o.url}</span>
                  <span style={{ fontSize: 11, color: T.fail, whiteSpace: 'nowrap' }}>
                    {SEVERITY_ICON[o.severity]} {o.problemCount} 個問題
                  </span>
                </a>
              ))}
            </div>
          </GlassCard>
        </>
      )}

      {/* 全部結果列表（簡單版 — 之後 Phase 3 加 filter / sort） */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12, marginTop: 24 }}>📋 全部結果（{results.results?.length || 0}）</h2>
      <GlassCard color={PAGE_ACCENT} style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
          {(results.results || []).map((r, i) => (
            <UrlRow key={i} result={r} />
          ))}
        </div>
      </GlassCard>
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

function UrlRow({ result }) {
  const probs = result.findings?.problems || []
  const isDone = result.status === 'done'
  const hasProblems = isDone && probs.length > 0
  const [expanded, setExpanded] = useState(false)

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
      {hasProblems && expanded && (
        <ul style={{
          margin: '6px 0 4px 16px', padding: 0, listStyle: 'none',
          fontSize: 11, color: T.textMid, lineHeight: 1.6,
        }}>
          {probs.map((p, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span>{SEVERITY_ICON[p.severity] || '⚪'}</span>
              <span>{p.label || PROBLEM_LABELS[p.id] || p.id}</span>
            </li>
          ))}
        </ul>
      )}
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
  no_article_schema: '缺 Article schema',
  thin_content: '文章內容過少（< 200 字）',
  short_content: '文章較短（< 300 字）',
  missing_canonical: '缺 canonical 標籤',
}
const PROBLEM_SEVERITY = {
  missing_h1: 'high', multiple_h1: 'medium',
  missing_meta_title: 'high', short_meta_title: 'medium', long_meta_title: 'low',
  missing_meta_desc: 'high', short_meta_desc: 'medium', long_meta_desc: 'low',
  missing_og: 'medium', incomplete_og: 'low',
  no_json_ld: 'high', no_article_schema: 'medium',
  thin_content: 'high', short_content: 'low',
  missing_canonical: 'low',
}
const SEVERITY_ICON = { high: '🔴', medium: '🟡', low: '⚪' }
