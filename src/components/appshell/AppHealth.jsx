import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import IssueBoard from '../v2/IssueBoard'
import { HEALTH_TABS, buildHealthChecks, healthAuditKeys, resolveHealthTab } from './healthData'
import { isHomepage, HOMEPAGE_NOTES } from '../../lib/pageAudit'
import SiteWideSchemaProbe from '../SiteWideSchemaProbe'
import CacheFreshnessNote from '../CacheFreshnessNote'

const AUDIT_TABLES = {
  seo: 'seo_audits',
  aeo: 'aeo_audits',
  geo: 'geo_audits',
  eeat: 'eeat_audits',
}

const ACCENTS = {
  seo: '#2563eb',
  aeo: '#7c3aed',
  geo: '#059669',
  eeat: '#b45309',
  crawl: '#ff6e34',
  schema: '#8298ff',
}

export default function AppHealth() {
  const { websiteId, healthTab } = useParams()
  const { isPro } = useAuth()
  const selectedTab = resolveHealthTab(healthTab)
  const [state, setState] = useState({ loading: true, error: '', website: null, audits: {} })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState(current => ({ ...current, loading: true, error: '' }))
      try {
        const [websiteResult, ...auditResults] = await Promise.all([
          supabase.from('websites').select('id, name, url').eq('id', websiteId).single(),
          ...Object.values(AUDIT_TABLES).map(table => supabase
            .from(table)
            .select('*')
            .eq('website_id', websiteId)
            .order('created_at', { ascending: false })
            .limit(1)),
        ])
        if (websiteResult.error) throw websiteResult.error
        const failed = auditResults.find(result => result.error)
        if (failed?.error) throw failed.error

        const audits = Object.fromEntries(
          Object.keys(AUDIT_TABLES).map((key, index) => [key, auditResults[index].data?.[0] || null])
        )
        if (!cancelled) setState({ loading: false, error: '', website: websiteResult.data, audits })
      } catch (error) {
        console.error('AppHealth load error:', error)
        if (!cancelled) setState({ loading: false, error: error.message || '體檢資料載入失敗', website: null, audits: {} })
      }
    }

    if (websiteId) load()
    return () => { cancelled = true }
  }, [websiteId])

  if (healthTab !== selectedTab) {
    return <Navigate to={`/app/${websiteId}/health/${selectedTab}`} replace />
  }
  if (state.loading) return <div className="as-loading" aria-live="polite">載入中…</div>
  if (state.error || !state.website) return (
    <div className="as-empty" role={state.error ? 'alert' : undefined}>
      <div className="e-t">網站體檢資料暫時讀不到</div>
      <div className="e-d">{state.error || '網站不存在，或你沒有權限查看。'}</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const onHomepage = isHomepage(state.website.url)
  const checks = buildHealthChecks(selectedTab, state.audits, onHomepage)
  const hasRelevantAudit = healthAuditKeys(selectedTab).some(key => state.audits[key])
  const title = state.website.name || state.website.url
  // 站台層複查候選：首頁被標「正常化說明」的麵包屑/FAQ（即真的缺在首頁、可能做在別頁的那些）
  const siteWideProbeIds = onHomepage
    ? checks.filter(ch => HOMEPAGE_NOTES[ch.id] && ch.detail === HOMEPAGE_NOTES[ch.id]).map(ch => ch.id)
    : []

  return (
    <>
      <div className="as-ctx">
        <div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div>
      </div>
      <div className="as-phead"><h2>網站體檢</h2><span className="sub">讓 AI 找得到 {title} 的技術地基</span></div>

      <nav className="as-health-tabs" aria-label="網站體檢分類">
        {HEALTH_TABS.map(tab => {
          const score = tab.auditKey ? state.audits[tab.auditKey]?.score : null
          return (
            <Link
              key={tab.key}
              className={`as-health-tab${selectedTab === tab.key ? ' on' : ''}`}
              to={`/app/${websiteId}/health/${tab.key}`}
              aria-current={selectedTab === tab.key ? 'page' : undefined}
            >
              {tab.label}{score != null && <span className="b num">{score}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="as-health-scope">
        <span aria-hidden="true">📍</span>
        <span>本次檢測範圍：<b>這一頁</b>（{state.website.url}）+ 站台層檔案（robots.txt / sitemap / llms.txt）。FAQ、H1、Meta 是逐頁檢查；某項未通過不代表其他頁也沒有。</span>
      </div>

      {/* 快取新鮮度提示：頁面由快取外掛供應且 ≥1 小時，提醒「剛改過請先清快取再掃」（亮色版） */}
      <CacheFreshnessNote pageUrl={state.website.url} />

      {!hasRelevantAudit ? (
        <div className="as-empty">
          <div className="e-t">這個分類還沒有檢測資料</div>
          <div className="e-d">先從總覽執行單頁掃描；完成後，這裡才會顯示真實結果。</div>
          <Link className="as-cta" to={`/app/${websiteId}/overview`}>回總覽</Link>
        </div>
      ) : (
        <>
          <div className="as-health-board">
            <IssueBoard checks={checks} isPro={isPro} accent={ACCENTS[selectedTab]} />
          </div>

          {/* 站台層複查：首頁報「缺麵包屑/FAQ」時，自動去其他頁找一遍，避免冤枉「做在別頁」的用戶 */}
          {siteWideProbeIds.length > 0 && (
            <SiteWideSchemaProbe pageUrl={state.website.url} schemaIds={siteWideProbeIds} />
          )}

          {(selectedTab === 'crawl' || selectedTab === 'schema') && (
            <div className="as-health-tool">
              <div>
                <b>{selectedTab === 'crawl' ? '需要重新做爬蟲連線測試？' : '需要重新解析這一頁的 Schema？'}</b>
                <span>專項工具會即時連線網站；本頁只顯示已儲存的最近一次 audit 結果。</span>
              </div>
              <Link
                className="as-health-tool-link"
                to={selectedTab === 'crawl' ? '/crawl-check' : `/schema-check?url=${encodeURIComponent(state.website.url)}`}
              >
                開啟專項檢測 →
              </Link>
            </div>
          )}
        </>
      )}
    </>
  )
}
