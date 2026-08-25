import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/errorLog'
import { buildSiteCards, formatLastScan } from './siteData'
import { coreExposureRates } from './aivisData'

const AUDIT_TABLES = {
  seo: 'seo_audits',
  aeo: 'aeo_audits',
  geo: 'geo_audits',
  eeat: 'eeat_audits',
}

export default function AppSites() {
  const { user, siteLimit, tierName } = useAuth()
  const [state, setState] = useState({ loading: true, error: '', cards: [] })
  const [busyHost, setBusyHost] = useState(null)   // 正在刪除中的 host（擋重複點擊）
  const cancelledRef = useRef(false)   // loadSites 也被 deleteSite 手動呼叫，用 ref 取代原本的 effect-scoped cancelled

  // 讀「我的網站」清單（依 host 分組 + aivis 曝光率）。抽成可重複呼叫的函式：
  // 掛載時跑一次，刪除發現「部分刪除」時也要靠它重新整批讀出 DB 真實狀態。
  const loadSites = useCallback(async () => {
    if (!user) {
      if (!cancelledRef.current) setState({ loading: false, error: '', cards: [] })
      return
    }

    setState(current => ({ ...current, loading: true, error: '' }))
    try {
      // websites 是「一頁一筆」；這裡必須先抓完整 row，再於 UI 層依 host 分組。
      const websiteResult = await supabase
        .from('websites')
        .select('id, name, url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (websiteResult.error) throw websiteResult.error

      const websites = websiteResult.data || []
      if (websites.length === 0) {
        if (!cancelledRef.current) setState({ loading: false, error: '', cards: [] })
        return
      }

      const websiteIds = websites.map(website => website.id)
      const [seo, aeo, geo, eeat, brands] = await Promise.all([
        ...Object.values(AUDIT_TABLES).map(table => supabase
          .from(table)
          .select('website_id, score, created_at')
          .in('website_id', websiteIds)
          .order('created_at', { ascending: false })),
        supabase
          .from('aivis_brands')
          .select('id, name, website_id')
          .in('website_id', websiteIds),
      ])
      const failed = [seo, aeo, geo, eeat, brands].find(result => result.error)
      if (failed?.error) throw failed.error

      const cards = buildSiteCards({
        websites,
        brands: brands.data || [],
        audits: {
          seo: seo.data || [],
          aeo: aeo.data || [],
          geo: geo.data || [],
          eeat: eeat.data || [],
        },
      })

      // 站卡 aivis 分數：對「有連結品牌」的卡，抓近 30 天題庫+回應、算品類推薦曝光率
      // （與 AppVisibility 同一支聚合，數字永遠一致；沒掃描資料的品牌回 null → 顯示「接資料中」）
      const brandIds = cards.map(card => card.brandId).filter(Boolean)
      if (brandIds.length) {
        const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
        const [promptResult, responseResult] = await Promise.all([
          supabase.from('aivis_prompts').select('id, brand_id, tier, is_active').in('brand_id', brandIds),
          supabase.from('aivis_responses')
            .select('id, brand_id, prompt_id, brand_mentioned, created_at, engine_results')
            .in('brand_id', brandIds).gte('created_at', since),
        ])
        if (!promptResult.error && !responseResult.error) {
          const rates = coreExposureRates({ prompts: promptResult.data || [], responses: responseResult.data || [], rangeDays: 30 })
          for (const card of cards) {
            if (card.brandId) card.aivisRate = rates.get(card.brandId) ?? null
          }
        }
      }
      if (!cancelledRef.current) setState({ loading: false, error: '', cards })
    } catch (error) {
      console.error('AppSites load error:', error)
      if (!cancelledRef.current) setState({ loading: false, error: error.message || '網站資料載入失敗', cards: [] })
    }
  }, [user])

  useEffect(() => {
    cancelledRef.current = false
    loadSites()
    return () => { cancelledRef.current = true }
  }, [loadSites])

  // 刪除「我的網站」——整組網域底下所有 websites row 一起刪（同 host 分組邏輯，只刪代表列
  // 會讓卡片消失後又因剩餘 row 重新冒出來、看起來像沒刪掉）。2026-06-19 舊版曾有此功能、
  // 硬切轉址到 /app 時漏搬，這裡補回。RLS 需允許 owner 刪自己的站（已於當時建好 policy）。
  //
  // 2026-08-18 實案：用戶回報同網域多頁的卡片砍掉後，其中一頁的網址還在——查碼確認
  // websiteIds 分組本身是對的，問題在 supabase .delete() 對「有呼叫、無 error」跟「真的每一列
  // 都被刪掉」是兩件事：若 RLS 擋掉其中幾列，Postgres 不會回報 error，只會悄悄不刪那幾列，
  // 樂觀更新卻照樣把整張卡從畫面上拿掉，讓用戶以為刪乾淨了。改用 .select('id') 拿回「實際被
  // 刪掉的列」比對筆數，兜不起來就不信任樂觀更新、改重新整批讀一次讓畫面反映 DB 真實狀態，
  // 並記進 error_logs（後台看得到，不再是「靜默失敗」）。
  async function deleteSite(card) {
    const scopeNote = card.pageCount > 1
      ? `\n這個網域底下共有 ${card.pageCount} 筆頁面紀錄，刪除會把整組一起移除`
      : ''
    if (!confirm(`確定要刪除「${card.name}」嗎？${scopeNote}\n所有掃描紀錄會一併移除，無法復原。`)) return
    setBusyHost(card.host)
    const { data, error } = await supabase.from('websites').delete().in('id', card.websiteIds).select('id')
    if (error) {
      console.error('[AppSites] delete website error:', error)
      alert(`刪除失敗：${error.message || '請稍後再試'}`)
      setBusyHost(null)
      return
    }
    const deletedCount = data?.length ?? 0
    if (deletedCount < card.websiteIds.length) {
      console.error('[AppSites] partial delete:', { host: card.host, requested: card.websiteIds, deletedCount })
      logError({
        source: 'app_sites_delete',
        message: `只刪除 ${deletedCount}/${card.websiteIds.length} 筆（可能是 RLS 擋掉部分列）`,
        userId: user?.id,
        detail: { host: card.host, websiteIds: card.websiteIds },
      })
      alert(`只刪除了 ${deletedCount}／${card.websiteIds.length} 筆頁面紀錄，可能是權限問題。已重新整理清單，若還有殘留請再刪一次或聯絡客服。`)
      await loadSites()
      setBusyHost(null)
      return
    }
    setState(current => ({ ...current, cards: current.cards.filter(c => c.host !== card.host) }))
    setBusyHost(null)
  }

  if (state.loading) return <div className="as-loading" aria-live="polite">載入中…</div>

  if (!user) return (
    <div className="as-empty">
      <div className="e-t">請先登入</div>
      <div className="e-d">登入後才能查看你追蹤的網站。</div>
      <Link className="as-cta" to="/login" state={{ from: '/app/websites' }}>前往登入</Link>
    </div>
  )

  const used = state.cards.length
  const remaining = Math.max(0, siteLimit - used)

  return (
    <>
      <div className="as-phead as-sites-head">
        <h2>我的網站</h2>
        <span className="sub">已追蹤 <span className="num">{used}</span> / <span className="num">{siteLimit}</span> 站（{tierName}）· 點任一張卡進入該站的總覽與監測</span>
        <Link className="as-cta as-sites-add" to={remaining > 0 ? '/' : '/pricing'}>
          {remaining > 0 ? '＋ 新增網站' : '查看方案'}
        </Link>
      </div>

      {state.error ? (
        <div className="as-empty" role="alert">
          <div className="e-t">網站資料暫時讀不到</div>
          <div className="e-d">{state.error}。請重新整理，或稍後再試。</div>
        </div>
      ) : state.cards.length === 0 ? (
        <div className="as-empty">
          <div className="e-t">還沒有追蹤網站</div>
          <div className="e-d">新增第一個網站後，這裡會顯示 AI 能見度、技術體質與最後掃描時間。</div>
          <Link className="as-cta" to="/">＋ 新增網站</Link>
        </div>
      ) : (
        <div className="as-sites">
          {state.cards.map(card => (
            <Link
              key={card.host}
              className="as-sitecard"
              to={`/app/${card.websiteId}/overview`}
              aria-label={`開啟 ${card.name} 總覽`}
            >
              <div className="s-nm">{card.name}</div>
              {/* 站名就是網域時不重複顯示第二行（例：portaly.cc / portaly.cc 疊字很吵） */}
              {card.name !== card.host && <div className="s-url" title={card.host}>{card.host}</div>}
              <div className="s-row">
                <div className="s-metric">
                  <div className="m-l">AI 能見度</div>
                  {/* 已接 coreExposureRates 共用聚合（近 30 天品類推薦曝光率）；沒掃描資料仍誠實顯示「接資料中」 */}
                  {card.aivisState !== 'linked' ? (
                    <div className="m-v is-setup">設定 aivis</div>
                  ) : card.aivisRate == null ? (
                    <div className="m-v is-pending" title="品牌已連結，完成一次 aivis 掃描後顯示曝光率">接資料中</div>
                  ) : (
                    <div className="m-v num is-score" title="近 30 天品類推薦曝光率（core 題）">{card.aivisRate}%</div>
                  )}
                </div>
                <div className="s-metric">
                  <div className="m-l">技術體質</div>
                  {card.technicalScore == null ? (
                    <div className="m-v is-pending" title={`四面向已有 ${card.technicalReadyCount} / 4 筆資料`}>接資料中</div>
                  ) : (
                    <div className="m-v num is-score">{card.technicalScore}</div>
                  )}
                </div>
              </div>
              <div className="s-foot">
                <span>
                  最後掃描：{formatLastScan(card.lastScannedAt)}
                  {/* 同網域多筆頁面紀錄時明講出來——刪除鈕會一次刪掉這裡講的全部筆數 */}
                  {card.pageCount > 1 && <span className="s-pages"> · 共 {card.pageCount} 頁</span>}
                </span>
                <span className="s-foot-r">
                  <button
                    type="button"
                    className="s-del"
                    disabled={busyHost === card.host}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); deleteSite(card) }}
                    title={card.pageCount > 1
                      ? `刪除會移除這個網域底下全部 ${card.pageCount} 筆頁面的掃描紀錄，無法復原`
                      : '刪除這個網站的所有掃描紀錄，無法復原'}
                    aria-label={`刪除 ${card.name}`}
                  >{busyHost === card.host ? '…' : '🗑'}</button>
                  <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          ))}

          {remaining > 0 && (
            <Link className="as-addsite" to="/" aria-label={`新增追蹤網站，還可再加 ${remaining} 站`}>
              <span>
                <span className="plus" aria-hidden="true">＋</span>
                <span className="add-label">新增追蹤網站</span>
                <span className="add-note">還可再加 <span className="num">{remaining}</span> 站</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </>
  )
}
