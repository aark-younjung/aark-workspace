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
import { GlassCard } from '../components/v2'
import { T } from '../styles/v2-tokens'

const POLL_INTERVAL_MS = 5000  // 每 5 秒輪詢進度

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

  async function handleStart() {
    if (starting) return
    setStarting(true)
    setError(null)
    try {
      const session = (await supabase.auth.getSession()).data?.session
      if (!session) throw new Error('未登入')
      const r = await fetch('/api/bulk-scan?action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ websiteId }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`)
      // 立刻拉一次 job
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
    pollTimer.current = setInterval(async () => {
      if (!job?.id) return
      try {
        const session = (await supabase.auth.getSession()).data?.session
        if (!session) return
        const r = await fetch(`/api/bulk-scan?action=status&jobId=${job.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await r.json()
        if (r.ok) setJob(data)
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

  // Pro / Trial 守衛 — 未通過顯示 upsell card 引導到 /pricing
  if (!isPro && !isTrial) {
    return (
      <PageWrap>
        <GlassCard color={T.orange} style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🪪</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 8 }}>批次文章掃描（Pro 限定）</h2>
          <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.75, marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
            一鍵掃描你網站全部文章（最多 200 篇），找出哪些頁面缺 H1、缺 schema、Meta 過短等問題 — 不用一篇一篇手動檢查。
          </p>
          <Link to="/pricing" style={proButtonStyle}>升級 Pro 解鎖 →</Link>
        </GlassCard>
      </PageWrap>
    )
  }

  return (
    <PageWrap>
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

      {/* 沒 job 或上次失敗 / 取消 → 顯示開始按鈕 */}
      {(!job || ['failed', 'cancelled'].includes(job.status)) && (
        <GlassCard color={T.aeo} style={{ padding: 28 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
            {job ? '重新批次掃描' : '開始批次掃描'}
          </h3>
          <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 16 }}>
            我們會抓你網站的 sitemap.xml，找出所有文章 URL（最多 200 篇，依 sitemap `&lt;lastmod&gt;` 倒序，最新先掃），
            逐篇分析 7 項文章層級檢測：H1 / Meta 標題 / Meta 描述 / Open Graph / JSON-LD schema / 字數 / canonical。
            預估時長 25-30 分鐘，過程中可關閉視窗，掃完回來看結果。
          </p>
          {job?.status === 'failed' && job?.error_message && (
            <div style={{ padding: 10, background: 'rgba(239,68,68,0.08)', borderLeft: `3px solid ${T.fail}`, borderRadius: 4, marginBottom: 16, fontSize: 12, color: '#fca5a5' }}>
              上次失敗：{job.error_message}
            </div>
          )}
          <button onClick={handleStart} disabled={starting} style={primaryButtonStyle}>
            {starting ? '啟動中...' : '🚀 開始掃描全站文章'}
          </button>
        </GlassCard>
      )}

      {/* 進行中 → 進度條 */}
      {job && ['discovering', 'scanning'].includes(job.status) && (
        <GlassCard color={T.aeo} style={{ padding: 28 }}>
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
        background: `linear-gradient(90deg, ${T.aeo}, #a855f7)`,
        transition: 'width 1s ease',
      }} />
    </div>
  )
}

function ResultsView({ job, results, onRescan, starting }) {
  const agg = job.aggregate || {}
  const byType = agg.problems_by_type || {}
  const offenders = agg.top_offenders || []

  // sortedProblems：把 byType { id: count } 排序成陣列
  const sortedProblems = Object.entries(byType)
    .map(([id, count]) => ({ id, count, label: PROBLEM_LABELS[id] || id, severity: PROBLEM_SEVERITY[id] || 'low' }))
    .sort((a, b) => b.count - a.count)

  return (
    <>
      {/* 總結卡 */}
      <GlassCard color={T.aeo} style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 4 }}>✅ 掃描完成</h3>
            <p style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6 }}>
              共掃描 <strong style={{ color: T.text }}>{agg.total_results || 0}</strong> 篇文章，
              其中 <strong style={{ color: T.warn }}>{agg.total_with_problems || 0}</strong> 篇有問題、
              <strong style={{ color: T.pass }}>{(agg.total_results || 0) - (agg.total_with_problems || 0)}</strong> 篇通過。
              {job.capped > 0 && <span style={{ color: T.warn }}> （網站超過 200 篇，少 {job.capped} 篇沒掃）</span>}
            </p>
          </div>
          <button onClick={onRescan} disabled={starting} style={secondaryButtonStyle}>
            {starting ? '啟動中...' : '🔄 重新掃描'}
          </button>
        </div>
      </GlassCard>

      {/* 按 problem 分組 — 知道全站有幾篇是同一問題 */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12, marginTop: 24 }}>📊 全站問題統計</h2>
      <GlassCard color={T.aeo} style={{ padding: 20, marginBottom: 20 }}>
        {sortedProblems.length === 0 ? (
          <p style={{ fontSize: 14, color: T.pass, textAlign: 'center', padding: 12 }}>🎉 沒有發現問題！全站文章都通過 7 項檢測</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedProblems.map(({ id, count, label, severity }) => (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                background: severity === 'high' ? 'rgba(239,68,68,0.08)' : severity === 'medium' ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)',
                borderLeft: `3px solid ${severity === 'high' ? T.fail : severity === 'medium' ? T.warn : T.textLow}`,
                borderRadius: 6,
              }}>
                <span style={{ fontSize: 13, color: T.text }}>{SEVERITY_ICON[severity]} {label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{count} 篇</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* 最有問題的 10 篇 */}
      {offenders.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12 }}>🔥 最需要修的 10 篇</h2>
          <GlassCard color={T.aeo} style={{ padding: 16, marginBottom: 20 }}>
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
      <GlassCard color={T.aeo} style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 600, overflowY: 'auto' }}>
          {(results.results || []).map((r, i) => (
            <UrlRow key={i} result={r} />
          ))}
        </div>
      </GlassCard>
    </>
  )
}

function UrlRow({ result }) {
  const probs = result.findings?.problems || []
  const isDone = result.status === 'done'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 10px',
      background: isDone && probs.length === 0 ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
      borderRadius: 4,
    }}>
      <a href={result.url} target="_blank" rel="noopener noreferrer" style={{
        fontSize: 11, color: T.textMid, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: 'none', marginRight: 8,
      }}>{result.url}</a>
      <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
        {!isDone ? (
          <span style={{ color: T.fail }}>❌ {result.error_message || '失敗'}</span>
        ) : probs.length === 0 ? (
          <span style={{ color: T.pass }}>✅ 通過</span>
        ) : (
          <span style={{ color: T.warn }}>⚠️ {probs.length} 問題</span>
        )}
      </span>
    </div>
  )
}

function PageWrap({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      <SiteHeader />
      <main style={{ position: 'relative', zIndex: 10, maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px', fontFamily: T.font }}>
        {children}
      </main>
      <Footer dark />
    </div>
  )
}

// ─────────── 樣式常數 ───────────

const primaryButtonStyle = {
  padding: '12px 28px', fontSize: 14, fontWeight: 700,
  background: `linear-gradient(135deg, ${T.aeo}, #a855f7)`,
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
