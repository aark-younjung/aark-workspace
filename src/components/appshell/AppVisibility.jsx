import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { hostLabel } from '../../lib/url'
import { aivisQuotaFor } from '../../lib/limits'
import { buildVisibilityModel, buildCompetitorComparison, buildSourceInfluence, ENGINE_KEYS, ENGINE_META } from './aivisData'

const RANGE_OPTIONS = [
  { days: 7, label: '本週' },
  { days: 30, label: '近 30 天' },
  { days: 90, label: '近 90 天' },
]

const MENTION_CATEGORY = {
  news: '新聞', forum: '論壇', social: '社群', blog: '部落格', wiki: '知識庫', other: '其他',
}

function formatScanTime(value) {
  if (!value) return '尚無掃描資料'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function metricValue(value) {
  return value == null ? '接資料中' : `${value}%`
}

function TrendLine({ data }) {
  const points = data
    .map((item, index) => item.rate == null ? null : {
      x: data.length === 1 ? 50 : index / (data.length - 1) * 100,
      y: 42 - item.rate / 100 * 36,
      rate: item.rate,
    })
    .filter(Boolean)

  if (!points.length) return <div className="as-vis-trend-empty">完成至少一次核心品類題掃描後顯示趨勢</div>

  const d = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  return (
    <svg className="as-vis-spark" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="品類推薦曝光率趨勢">
      <path className="area" d={`${d} L ${points.at(-1).x} 47 L ${points[0].x} 47 Z`} />
      <path className="line" d={d} />
      {points.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="1.3"><title>{point.rate}%</title></circle>)}
    </svg>
  )
}

function EngineMark({ engine }) {
  const meta = ENGINE_META[engine]
  return <span className="as-vis-engine-mark" style={{ '--engine-color': meta.color }} aria-hidden="true">{meta.label.slice(0, 1)}</span>
}

function BrandMentions({ brand }) {
  const [state, setState] = useState({ loading: false, error: '', result: null })

  async function search() {
    if (!brand?.name || state.loading) return
    setState({ loading: true, error: '', result: null })
    try {
      const params = new URLSearchParams({ action: 'brand-mentions', brand: brand.name, num: '10' })
      if (brand.domain) params.set('excludeDomain', brand.domain)
      const response = await fetch(`/api/public?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result?.message || '品牌提及查詢失敗')
      setState({ loading: false, error: '', result })
    } catch (error) {
      setState({ loading: false, error: error.message || '品牌提及查詢失敗', result: null })
    }
  }

  return (
    <section className="as-card as-vis-mentions">
      <div className="as-vis-section-head">
        <div><h3>品牌外部提及</h3><span className="as-vis-beta">BETA</span></div>
        <button className="as-vis-line-button" type="button" onClick={search} disabled={state.loading}>
          {state.loading ? '查詢中…' : '查詢品牌提及'}
        </button>
      </div>
      <p>量的是全網第三方來源有沒有談到 {brand.name}，例如新聞、論壇、目錄。這是站外信任訊號；需管理員啟用查詢服務。</p>
      {state.error && <div className="as-vis-inline-state" role="alert">{state.error}</div>}
      {!state.result && !state.error && <div className="as-vis-inline-state">尚未查詢 · 不會在載入頁面時自動消耗 API</div>}
      {state.result && (
        <div className="as-vis-mention-results" aria-live="polite">
          <b>找到 {state.result.totalResults} 個第三方來源</b>
          {state.result.items?.length ? state.result.items.map((item, index) => (
            <a key={`${item.link}-${index}`} href={item.link} target="_blank" rel="noreferrer" className="as-vis-mention-item">
              <span className="src">{item.displayLink || item.title}</span>
              <span className="title">{item.title}</span>
              <span className="tag">{MENTION_CATEGORY[item.category] || '其他'}</span>
            </a>
          )) : <div className="as-vis-inline-state">本次查詢沒有找到可驗證的第三方來源。</div>}
        </div>
      )}
    </section>
  )
}

export default function AppVisibility() {
  const { websiteId } = useParams()
  const { isPro, isTrial, user } = useAuth()
  const [rangeDays, setRangeDays] = useState(7)
  const [state, setState] = useState({ loading: true, error: '', website: null, brand: null, prompts: [], responses: [], mentions: [], monthQueries: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState(current => ({ ...current, loading: true, error: '' }))
      try {
        const websiteResult = await supabase.from('websites').select('id, name, url').eq('id', websiteId).single()
        if (websiteResult.error) throw websiteResult.error
        const brandResult = await supabase.from('aivis_brands').select('*').eq('website_id', websiteId).maybeSingle()
        if (brandResult.error) throw brandResult.error
        if (!brandResult.data) {
          if (!cancelled) setState({ loading: false, error: '', website: websiteResult.data, brand: null, prompts: [], responses: [], mentions: [], monthQueries: null })
          return
        }

        const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
        const monthStart = new Date()
        monthStart.setUTCDate(1)
        monthStart.setUTCHours(0, 0, 0, 0)
        const [promptResult, responseResult, mentionResult, monthResult] = await Promise.all([
          supabase.from('aivis_prompts').select('*').eq('brand_id', brandResult.data.id).order('created_at'),
          supabase.from('aivis_responses')
            .select('id, prompt_id, run_index, raw_response, brand_mentioned, cost_usd, created_at, engine_results')
            .eq('brand_id', brandResult.data.id).gte('created_at', since).order('created_at', { ascending: false }),
          supabase.from('aivis_mentions').select('response_id, position, context, created_at')
            .eq('brand_id', brandResult.data.id).gte('created_at', since),
          user?.id
            ? supabase.from('aivis_responses').select('id', { count: 'exact', head: true })
              .eq('user_id', user.id).gte('created_at', monthStart.toISOString())
            : Promise.resolve({ count: null, error: null }),
        ])
        const failed = [promptResult, responseResult, mentionResult].find(result => result.error)
        if (failed?.error) throw failed.error
        if (!cancelled) setState({
          loading: false, error: '', website: websiteResult.data, brand: brandResult.data,
          prompts: promptResult.data || [], responses: responseResult.data || [], mentions: mentionResult.data || [],
          monthQueries: monthResult.error ? null : monthResult.count,
        })
      } catch (error) {
        console.error('AppVisibility load error:', error)
        if (!cancelled) setState({ loading: false, error: error.message || 'AI 曝光資料載入失敗', website: null, brand: null, prompts: [], responses: [], mentions: [], monthQueries: null })
      }
    }
    if (websiteId) load()
    return () => { cancelled = true }
  }, [websiteId, user?.id])

  const model = useMemo(() => buildVisibilityModel({
    brand: state.brand,
    prompts: state.prompts,
    responses: state.responses,
    mentions: state.mentions,
    rangeDays,
  }), [state.brand, state.prompts, state.responses, state.mentions, rangeDays])

  // 競品同題比較（觀察名單存在 aivis_brands.competitors；零額外掃描、既有回答原文比對）
  const comparison = useMemo(() => buildCompetitorComparison({
    competitors: state.brand?.competitors || [],
    prompts: state.prompts,
    responses: state.responses,
    mentions: state.mentions,
    rangeDays,
  }), [state.brand?.competitors, state.prompts, state.responses, state.mentions, rangeDays])

  // 來源影響力（誰在影響 AI 的答案）：既有回答附帶的真實引用來源彙整
  const influence = useMemo(() => buildSourceInfluence({
    brand: state.brand,
    responses: state.responses,
    rangeDays,
  }), [state.brand, state.responses, rangeDays])

  // 競品觀察名單編輯器（單一逗號分隔輸入、最多 3 個）
  const [compEditor, setCompEditor] = useState({ open: false, value: '', busy: false, error: '' })
  async function saveCompetitors(event) {
    event.preventDefault()
    const names = [...new Set(compEditor.value.split(/[,，、]/).map(item => item.trim()).filter(Boolean))].slice(0, 3)
    setCompEditor(current => ({ ...current, busy: true, error: '' }))
    const { error } = await supabase.from('aivis_brands').update({ competitors: names }).eq('id', state.brand.id)
    if (error) {
      // 欄位還沒建（需跑 SQL）或 RLS 未開放更新 → 誠實顯示原因，不默默失敗
      const hint = /column|competitors/i.test(error.message) ? '（資料表尚未新增 competitors 欄位，請先在 Supabase 跑一次 SQL）' : ''
      setCompEditor(current => ({ ...current, busy: false, error: `${error.message}${hint}` }))
      return
    }
    setState(current => ({ ...current, brand: { ...current.brand, competitors: names } }))
    setCompEditor({ open: false, value: '', busy: false, error: '' })
  }

  if (state.loading) return <div className="as-loading" aria-live="polite">載入中…</div>
  if (state.error || !state.website) return (
    <div className="as-empty" role="alert">
      <div className="e-t">AI 曝光監測資料暫時讀不到</div>
      <div className="e-d">{state.error || '網站不存在，或你沒有權限查看。'}</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const title = state.website.name || hostLabel(state.website.url)
  if (!state.brand) return (
    <>
      <div className="as-ctx"><div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div></div>
      <div className="as-phead"><h2>AI 曝光監測</h2><span className="sub">真的拿你的品牌去問 3 大 AI</span></div>
      <div className="as-empty">
        <div className="e-t">設定 aivis 後才能開始監測</div>
        <div className="e-d">這個網站尚未透過 aivis_brands.website_id 連結品牌。設定後才會顯示 ChatGPT／Claude／Gemini 的真實結果。</div>
        <Link className="as-cta" to="/ai-visibility">設定 aivis →</Link>
      </div>
    </>
  )

  return (
    <>
      <div className="as-ctx"><div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div></div>
      <div className="as-phead as-vis-phead">
        <h2>AI 曝光監測</h2><span className="sub">真的拿 {state.brand.name} 去問 3 大 AI</span>
        <div className="as-seg" aria-label="監測期間">
          {RANGE_OPTIONS.map(option => <button key={option.days} className={rangeDays === option.days ? 'on' : ''} type="button" onClick={() => setRangeDays(option.days)} aria-pressed={rangeDays === option.days}>{option.label}</button>)}
        </div>
        <Link className="as-cta as-vis-rescan" to={`/ai-visibility/${state.brand.id}`}>管理／重新掃描</Link>
      </div>

      {/* 旗艦 KPI：核心品類題與兩個誠實分開的軸 */}
      <section className="as-vis-kpis" aria-label="AI 曝光指標">
        <div className="as-card as-vis-kpi as-vis-kpi-main">
          <div className="label">品類推薦曝光率 <span className="info" title="只算不含品牌名的 core 固定題；品牌詞、資訊題與輪替題都不灌入。">i</span></div>
          <div className={`value num${model.exposure.rate == null ? ' pending' : ''}`}>{metricValue(model.exposure.rate)}</div>
          {model.exposure.delta != null && <span className={`delta${model.exposure.delta < 0 ? ' down' : ''}`}>{model.exposure.delta > 0 ? '↑' : model.exposure.delta < 0 ? '↓' : '—'} {Math.abs(model.exposure.delta)}</span>}
          <p>{model.exposure.total ? `${model.exposure.total} 個核心題引擎回答中，${model.exposure.mentioned} 個提到你的品牌` : '完成核心品類題掃描後，這裡才會顯示真實曝光率。'}</p>
          <TrendLine data={model.trend} />
          <div className="as-vis-engine-rates">
            {model.perEngine.map(engine => <span key={engine.key}><span translate="no">{ENGINE_META[engine.key].label}</span> <b className="num">{metricValue(engine.rate)}</b></span>)}
          </div>
        </div>
        <div className="as-card as-vis-kpi">
          <div className="label">本月掃描用量</div>
          <div className={`value small num${state.monthQueries == null ? ' pending' : ''}`}>{state.monthQueries == null ? '接資料中' : <>{state.monthQueries} <small>/ {aivisQuotaFor({ isTrial })} 次</small></>}</div>
          <p>依目前帳號跨品牌的本月 aivis 查詢筆數</p>
          <div className="as-vis-usage"><i style={{ width: `${Math.min(100, (state.monthQueries ?? 0) / aivisQuotaFor({ isTrial }) * 100)}%` }} /></div>
        </div>
        <div className="as-card as-vis-kpi">
          <div className="label">同類領先者 {comparison && comparison.basis > 0 && <span className="as-vis-beta">BETA</span>}</div>
          {comparison && comparison.basis > 0 ? (() => {
            // 領先者＝自己＋觀察名單中提及率最高者（同一批回答、同一標準）
            const contenders = [{ name: state.brand.name, rate: comparison.own.rate, you: true }, ...comparison.rows]
            const leader = contenders.slice().sort((a, b) => b.rate - a.rate)[0]
            return (
              <>
                <div className="value small num">{leader.rate}%</div>
                <p>
                  <b translate="no">{leader.name}</b>{leader.you ? '（你）目前領先觀察名單 🎉' : ` 領先你 ${leader.rate - comparison.own.rate} 個百分點`}
                  ，明細見下方競品同題比較。
                </p>
              </>
            )
          })() : (
            <>
              <div className="value small pending">{state.brand.competitors?.length ? '接資料中' : '未設定'}</div>
              <p>
                {state.brand.competitors?.length
                  ? '觀察名單已設定；等本期掃描有可比對的回答原文後顯示。'
                  : '設定競品觀察名單（最多 3 個），用同一批 AI 回答比較提及率——不猜、不捏造。'}
                {' '}<a href="#vis-competitors" className="as-vis-anchor">設定 →</a>
              </p>
            </>
          )}
        </div>
      </section>

      {/* 引用矩陣：只列最新一次掃描的核心品類題 */}
      <section className="as-card as-vis-matrix">
        <div className="as-vis-section-head"><div><h3>引用矩陣 · 誰在哪一題被 AI 提到</h3></div><span className="as-vis-time">最近掃描：{formatScanTime(model.latestScanAt)}</span></div>
        <p className="note">只列核心品類題（不含品牌名）。品牌詞題與資訊題另計，不灌入曝光率。</p>
        {model.matrix.length ? (
          <div className="as-vis-table-wrap"><table>
            <thead><tr><th className="question">品類問句</th>{ENGINE_KEYS.map(key => <th key={key}><span className="engine"><EngineMark engine={key} /><span translate="no">{ENGINE_META[key].label}</span></span></th>)}</tr></thead>
            <tbody>{model.matrix.map(row => <tr key={row.promptId}><td className="question">{row.text}</td>{ENGINE_KEYS.map(key => {
              const value = row.engines[key]
              const label = value == null ? '無資料' : value ? '有提到你' : '沒提到'
              return <td key={key}><span className={`as-vis-cell ${value == null ? 'none' : value ? 'hit' : 'miss'}`} title={label} aria-label={`${ENGINE_META[key].label}：${label}`}>{value == null ? '—' : value ? '✓' : '×'}</span></td>
            })}</tr>)}</tbody>
          </table></div>
        ) : <div className="as-vis-inline-state">最新一批掃描還沒有核心品類題結果。</div>}
      </section>

      {/* 品牌與內容刻意另計 */}
      <section className="as-vis-honest">
        <div className="as-card"><div className="title">品牌詞認得率 <span>另計</span></div><div className={`value num${model.brandRecognition ? '' : ' pending'}`}>{metricValue(model.brandRecognition?.rate)}</div><p>直接問「{state.brand.name} 是誰」時，AI 答得出來的比率。量 AI 認不認得你，刻意不併入曝光率。</p></div>
        <div className="as-card"><div className="title">內容引用率 <span>另計</span></div><div className={`value num citation${model.contentCitation ? '' : ' pending'}`}>{metricValue(model.contentCitation?.rate)}</div><p>回答知識型問題時，引用來源裡出現你網域的比率。<Link to={`/app/${websiteId}/gap`}>→ 看內容缺口</Link></p></div>
      </section>

      {/* 競品同題比較（2026-08-13 第一批）：觀察名單 × 既有回答原文比對——零額外掃描、同一標準 */}
      <section className="as-card as-vis-compare" id="vis-competitors">
        <div className="as-vis-section-head">
          <div><h3>競品同題比較</h3><span className="as-vis-beta">BETA</span></div>
          <button type="button" className="as-vis-line-button" onClick={() => setCompEditor(current => ({ ...current, open: !current.open, value: (state.brand.competitors || []).join(', ') }))}>
            {state.brand.competitors?.length ? '編輯觀察名單' : '＋ 設定觀察名單'}
          </button>
        </div>

        {compEditor.open && (
          <form className="as-vis-comp-editor" onSubmit={saveCompetitors}>
            <label htmlFor="comp-input">競品名稱（最多 3 個，用逗號分隔；用 AI 回答會寫出的正式名稱效果最好）</label>
            <div className="row">
              <input
                id="comp-input"
                type="text"
                value={compEditor.value}
                onChange={event => setCompEditor(current => ({ ...current, value: event.target.value }))}
                placeholder="例：品牌甲, 品牌乙…"
              />
              <button className="as-cta" type="submit" disabled={compEditor.busy}>{compEditor.busy ? '儲存中…' : '儲存名單'}</button>
            </div>
            {compEditor.error && <div className="err" role="alert">{compEditor.error}</div>}
          </form>
        )}

        {!state.brand.competitors?.length ? (
          <div className="as-vis-inline-state">設定觀察名單後，我們會在<b>同一批真實 AI 回答</b>裡比對競品名稱——同題、同標準、不多花掃描額度。</div>
        ) : !comparison || comparison.basis === 0 ? (
          <div className="as-vis-inline-state">本期（{rangeDays} 天內）沒有可比對的回答原文——執行一次掃描後，這裡會顯示同題比較。</div>
        ) : (
          <>
            <div className="as-vis-compare-row you">
              <span translate="no">{state.brand.name}（你）</span>
              <div className="bar"><i style={{ width: `${comparison.own.rate}%` }} /></div>
              <b className="num">{comparison.own.rate}%</b>
            </div>
            {comparison.rows.map(row => (
              <div className="as-vis-compare-row" key={row.name}>
                <span translate="no">{row.name}</span>
                <div className="bar"><i className="rival" style={{ width: `${row.rate}%` }} /></div>
                <b className="num">{row.rate}%</b>
                <span className={`as-vis-delta ${row.delta > 0 ? 'ahead' : row.delta < 0 ? 'behind' : 'even'}`}>
                  {row.delta > 0 ? `領先你 +${row.delta}` : row.delta < 0 ? `落後你 ${row.delta}` : '與你持平'}
                </span>
              </div>
            ))}
            <p className="foot">
              方法：近 {rangeDays} 天核心品類題、共 <b className="num">{comparison.basis}</b> 個「有原文」的引擎回答中做名稱比對；
              名稱沒被寫出即算未提及（與你的品牌同一標準）。這是提及率、不是市佔率。
            </p>
          </>
        )}
      </section>

      {/* 誰在影響 AI 的答案（來源影響力）：既有回答附帶的真實引用來源彙整——零猜測 */}
      <section className="as-card as-vis-influence">
        <div className="as-vis-section-head"><div><h3>誰在影響 AI 的答案</h3><span className="as-vis-beta">BETA</span></div></div>
        {influence.items.length === 0 ? (
          <div className="as-vis-inline-state">本期回答沒有附引用來源（部分引擎或較舊掃描不回傳來源）。</div>
        ) : (
          <>
            <ol className="as-vis-src-list">
              {influence.items.map((item, index) => (
                <li key={item.host}>
                  <span className="rank num">{index + 1}</span>
                  <span className="host" translate="no">{item.host}</span>
                  {item.isOwn && <span className="stag own">你的網站</span>}
                  {item.isSocial && <span className="stag">社群</span>}
                  <span className="cnt num">被引用於 {item.promptCount} 題 · {item.answers} 個回答</span>
                </li>
              ))}
            </ol>
            <p className="foot">
              來自近 {rangeDays} 天 <b className="num">{influence.answersWithSources}</b> 個附引用來源的引擎回答（全題型）。
              這些網站正在替 AI「背書答案」——上榜卻不是你，就是內容機會的方向。
            </p>
          </>
        )}
      </section>

      <BrandMentions brand={state.brand} />
    </>
  )
}
