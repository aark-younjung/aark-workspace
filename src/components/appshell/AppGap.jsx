import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { buildVisibilityModel } from './aivisData'
import { hostLabel } from '../../lib/url'

/**
 * 內容缺口 —— 窄用定義（spec 五之 2）：只做 aivis-info 的「AI 回答知識題時引用了誰、你在不在名單」。
 * 缺口 = AI 回答你領域的知識題時引用了別人、沒引用你 → 每一題就是一個具體的內容機會。
 * 資料沿用 AppVisibility 同一套查詢 + buildVisibilityModel 的 contentCitation（不重寫聚合）。
 * 誠實：引用來源全部來自真實 engine sources；沒資料就空狀態，不編造競品或機會。
 */
export default function AppGap() {
  const { websiteId } = useParams()
  const [state, setState] = useState({ loading: true, error: '', website: null, brand: null, prompts: [], responses: [], mentions: [] })

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
          if (!cancelled) setState({ loading: false, error: '', website: websiteResult.data, brand: null, prompts: [], responses: [], mentions: [] })
          return
        }

        const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
        const [promptResult, responseResult, mentionResult] = await Promise.all([
          supabase.from('aivis_prompts').select('*').eq('brand_id', brandResult.data.id).order('created_at'),
          supabase.from('aivis_responses')
            .select('id, prompt_id, run_index, raw_response, brand_mentioned, cost_usd, created_at, engine_results')
            .eq('brand_id', brandResult.data.id).gte('created_at', since).order('created_at', { ascending: false }),
          supabase.from('aivis_mentions').select('response_id, position, context, created_at')
            .eq('brand_id', brandResult.data.id).gte('created_at', since),
        ])
        const failed = [promptResult, responseResult, mentionResult].find(result => result.error)
        if (failed?.error) throw failed.error
        if (!cancelled) setState({
          loading: false, error: '', website: websiteResult.data, brand: brandResult.data,
          prompts: promptResult.data || [], responses: responseResult.data || [], mentions: mentionResult.data || [],
        })
      } catch (error) {
        console.error('AppGap load error:', error)
        if (!cancelled) setState({ loading: false, error: error.message || '內容缺口資料載入失敗', website: null, brand: null, prompts: [], responses: [], mentions: [] })
      }
    }
    if (websiteId) load()
    return () => { cancelled = true }
  }, [websiteId])

  // 沿用同一支聚合（90 天窗），只取 contentCitation（info 題引用）
  const citation = useMemo(() => state.brand
    ? buildVisibilityModel({ brand: state.brand, prompts: state.prompts, responses: state.responses, mentions: state.mentions, rangeDays: 90 }).contentCitation
    : null,
  [state.brand, state.prompts, state.responses, state.mentions])

  if (state.loading) return <div className="as-loading" aria-live="polite">載入中…</div>
  if (state.error || !state.website) return (
    <div className="as-empty" role="alert">
      <div className="e-t">內容缺口資料暫時讀不到</div>
      <div className="e-d">{state.error || '網站不存在，或你沒有權限查看。'}</div>
      <Link className="as-cta" to="/app/websites">回我的網站</Link>
    </div>
  )

  const title = state.website.name || hostLabel(state.website.url)
  const head = (
    <>
      <div className="as-ctx"><div className="as-switcher"><span className="lab">網站</span><span className="val">{title}</span></div></div>
      <div className="as-phead"><h2>內容缺口</h2><span className="sub">AI 回答你領域的知識題時，引用名單裡有沒有你</span></div>
    </>
  )

  // 空狀態一：尚未連結品牌 → 與 AppVisibility 同一條設定路
  if (!state.brand) return (
    <>
      {head}
      <div className="as-empty">
        <div className="e-t">設定 aivis 後才能分析內容缺口</div>
        <div className="e-d">內容缺口來自 aivis 的資訊題掃描（AI 回答知識題時引用了哪些網站）。先連結品牌才有資料。</div>
        <Link className="as-cta" to="/ai-visibility">設定 aivis →</Link>
      </div>
    </>
  )

  // 空狀態二：品牌沒設網域 → 無法判斷「引用的是不是你」（buildContentCitation 需要 ownHost）
  if (!state.brand.domain) return (
    <>
      {head}
      <div className="as-empty">
        <div className="e-t">品牌還沒設定網域</div>
        <div className="e-d">要判斷「AI 引用的來源是不是你的網站」，需要知道你的網域。到品牌管理補上網域後，重新掃描即可。</div>
        <Link className="as-cta" to={`/ai-visibility/${state.brand.id}`}>管理品牌 →</Link>
      </div>
    </>
  )

  // 空狀態三：有品牌有網域、但還沒有資訊題掃描結果
  if (!citation) return (
    <>
      {head}
      <div className="as-empty">
        <div className="e-t">還沒有資訊題掃描資料</div>
        <div className="e-d">資訊題（不含品牌名的知識問句）會隨每次 aivis 掃描一起跑。執行一次掃描後，這裡會顯示 AI 引用了誰、你在不在名單。</div>
        <Link className="as-cta" to={`/ai-visibility/${state.brand.id}`}>去掃描 →</Link>
      </div>
    </>
  )

  const gaps = citation.items.filter(item => !item.cited)
  const wins = citation.items.filter(item => item.cited)

  return (
    <>
      {head}

      {/* KPI：內容引用率（與 aivis 主頁同一個數字、同一套算法；不灌入頭條曝光率） */}
      <section className="as-gap-kpis" aria-label="內容引用指標">
        <div className="as-card as-gap-kpi">
          <div className="label">內容引用率 <span className="info" title="近 90 天最新一次掃描的資訊題中，AI 引用來源含你網域的比例。與品類曝光率分開計算、不互相灌分。">i</span></div>
          <div className="value num">{citation.rate}%</div>
          <p>{citation.total} 題知識題中，<b className="num">{citation.citedCount}</b> 題的 AI 引用名單裡有你的網站</p>
        </div>
        <div className="as-card as-gap-kpi">
          <div className="label">內容機會</div>
          <div className={`value num${gaps.length ? ' is-gap' : ''}`}>{gaps.length} 題</div>
          <p>{gaps.length ? 'AI 答這些題時引用了別人、沒引用你——每一題都是一篇內容的機會' : '目前掃描的知識題 AI 都有引用你，繼續保持內容更新'}</p>
        </div>
      </section>

      {/* 缺口清單：沒被引用的題目 = 具體的內容待辦；引用了誰全是真實 sources */}
      {gaps.length > 0 && (
        <section className="as-card as-gap-list">
          <h3>🕳️ 缺口 · AI 答了這些題，引用名單裡沒有你</h3>
          <ul>
            {gaps.map(item => (
              <li key={item.promptId}>
                <div className="q">{item.text}</div>
                <div className="meta">
                  <span className="tag miss">未被引用</span>
                  {item.others.length > 0
                    ? <span className="others">AI 引用了：{item.others.map(host => <code key={host} translate="no">{host}</code>)}</span>
                    : <span className="others none">這次回答沒有附引用來源</span>}
                </div>
                <div className="act">👉 寫一篇能直接回答這題的內容（首段給答案、補 FAQ schema），下次掃描看有沒有進引用名單</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 已被引用的題目：正向回饋，同時是「別弄丟」的清單 */}
      {wins.length > 0 && (
        <section className="as-card as-gap-list as-gap-wins">
          <h3>✅ 已被引用 · 這些題 AI 有引用你的網站</h3>
          <ul>
            {wins.map(item => (
              <li key={item.promptId}>
                <div className="q">{item.text}</div>
                <div className="meta"><span className="tag hit">已被引用</span>
                  {item.others.length > 0 && <span className="others">同題也被引用：{item.others.map(host => <code key={host} translate="no">{host}</code>)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 範圍誠實聲明：只講掃描過的資訊題，不宣稱全領域 */}
      <div className="as-gap-scope">
        📍 以上僅涵蓋 aivis 已掃描的 {citation.total} 題資訊題（近 90 天最新一次掃描）。AI 的引用會隨時間變動；不代表你的內容在所有知識題的表現。
      </div>
    </>
  )
}
