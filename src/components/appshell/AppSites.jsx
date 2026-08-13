import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
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

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!user) {
        setState({ loading: false, error: '', cards: [] })
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
          if (!cancelled) setState({ loading: false, error: '', cards: [] })
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
        if (!cancelled) setState({ loading: false, error: '', cards })
      } catch (error) {
        console.error('AppSites load error:', error)
        if (!cancelled) setState({ loading: false, error: error.message || '網站資料載入失敗', cards: [] })
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

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
              <div className="s-foot"><span>最後掃描：{formatLastScan(card.lastScannedAt)}</span><span aria-hidden="true">→</span></div>
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
