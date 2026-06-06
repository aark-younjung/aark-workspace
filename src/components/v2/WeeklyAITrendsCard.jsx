/**
 * WeeklyAITrendsCard — 本週 AI 趨勢卡（2026-06-06 v2）
 *
 * 設計動機：朋友建議「加入夯關鍵字 / AI 搜尋口語、促進每日回訪」。
 * v2 升級：A+C 混搭設計
 *   - 上半 [C] 個人化區（only Pro + 有追蹤品牌）：你追蹤的品牌本週表現 + 變化
 *   - 下半 [A] 公共趨勢區（all visitors）：全平台 AI 提及 Top 5
 *
 * 用戶體驗分層：
 *   訪客 / Free       → 只看下半（產生 FOMO）
 *   Pro + 有品牌      → 看上半 + 下半（個人對標業界）
 *   Pro + 沒設品牌    → 下半 + 「設定追蹤」CTA
 *
 * 個人化區資料來源：直接 supabase（user-scoped RLS）
 * 公共區資料來源：/api/public?action=aivis-trends（cross-user service role）
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { INDUSTRIES } from '../../lib/industries'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
const STORAGE_KEY_INDUSTRIES = 'aark_trends_industries'

export default function WeeklyAITrendsCard() {
  const { user, isPro } = useAuth()
  const [publicData, setPublicData] = useState(null)
  const [personalData, setPersonalData] = useState(null) // { brands: [{ name, count, change_pct }], hasBrands: bool }
  const [loading, setLoading] = useState(true)
  // 行業 filter（2026-06-07 Phase A）— localStorage 記住用戶選擇、跨 session 保留
  const [selectedIndustries, setSelectedIndustries] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_INDUSTRIES)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  function toggleIndustry(slug) {
    setSelectedIndustries(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
      try { localStorage.setItem(STORAGE_KEY_INDUSTRIES, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function clearIndustries() {
    setSelectedIndustries([])
    try { localStorage.removeItem(STORAGE_KEY_INDUSTRIES) } catch {}
  }

  // 公共趨勢資料（A 區、訪客也能看、依 selectedIndustries filter）
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const url = selectedIndustries.length > 0
      ? `/api/public?action=aivis-trends&industries=${encodeURIComponent(selectedIndustries.join(','))}`
      : '/api/public?action=aivis-trends'
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return
        setPublicData(d)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedIndustries])

  // 個人化趨勢資料（C 區、僅登入用戶、依 selectedIndustries filter）
  useEffect(() => {
    if (!user?.id) {
      setPersonalData(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        // 1. 用戶的追蹤品牌列表（行業有 filter 就 narrow、沒就全拉）
        let brandsQuery = supabase
          .from('aivis_brands')
          .select('id, brand_name, industries')
          .eq('user_id', user.id)
        if (selectedIndustries.length > 0) {
          brandsQuery = brandsQuery.overlaps('industries', selectedIndustries)
        }
        const { data: brands } = await brandsQuery
        if (cancelled) return
        if (!brands || brands.length === 0) {
          // hasBrands 判斷拿掉 industry filter 後是否真的有品牌
          if (selectedIndustries.length > 0) {
            const { data: allBrands } = await supabase
              .from('aivis_brands')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
            setPersonalData({ brands: [], hasBrands: (allBrands?.length || 0) > 0, filteredOut: (allBrands?.length || 0) > 0 })
          } else {
            setPersonalData({ brands: [], hasBrands: false })
          }
          return
        }
        const brandIds = brands.map(b => b.id)

        const now = new Date()
        const thisWeekStart = new Date(now.getTime() - MS_PER_WEEK)
        const lastWeekStart = new Date(now.getTime() - 2 * MS_PER_WEEK)

        // 2. 並行抓本週 + 上週 mentions
        const [thisWeek, lastWeek] = await Promise.all([
          supabase
            .from('aivis_mentions')
            .select('brand_id')
            .in('brand_id', brandIds)
            .gte('created_at', thisWeekStart.toISOString()),
          supabase
            .from('aivis_mentions')
            .select('brand_id')
            .in('brand_id', brandIds)
            .gte('created_at', lastWeekStart.toISOString())
            .lt('created_at', thisWeekStart.toISOString()),
        ])
        if (cancelled) return

        // 3. 計算每個品牌的本週 vs 上週
        const thisCount = {}
        ;(thisWeek.data || []).forEach(m => {
          thisCount[m.brand_id] = (thisCount[m.brand_id] || 0) + 1
        })
        const lastCount = {}
        ;(lastWeek.data || []).forEach(m => {
          lastCount[m.brand_id] = (lastCount[m.brand_id] || 0) + 1
        })

        const items = brands
          .map(b => {
            const count = thisCount[b.id] || 0
            const prev = lastCount[b.id] || 0
            let change_pct = null
            if (prev > 0) change_pct = Math.round(((count - prev) / prev) * 100)
            else if (count > 0) change_pct = 100
            return { name: b.brand_name, count, change_pct }
          })
          .sort((a, b) => b.count - a.count)

        setPersonalData({ brands: items, hasBrands: true })
      } catch (err) {
        console.error('Personal aivis trends failed:', err)
        if (!cancelled) setPersonalData({ brands: [], hasBrands: false })
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, selectedIndustries])

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div className="text-sm text-white/40">📡 載入本週 AI 趨勢…</div>
      </section>
    )
  }

  const hasPublicData = publicData && (publicData.totalResponses > 0 || publicData.topMentions?.length > 0)
  // 個人化區是否要顯示：登入 + 有追蹤品牌
  const showPersonal = user && personalData?.hasBrands

  // 平台還沒累積資料時的空狀態
  if (!hasPublicData && !showPersonal) {
    return (
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.08), rgba(0,0,0,0.3))',
        border: '1px solid rgba(249,115,22,0.25)',
      }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">📡</span>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white mb-1">本週 AI 趨勢資料蒐集中</h3>
            <p className="text-sm text-white/55 leading-relaxed mb-3">
              aivis 還在累積初期、暫時沒有跨用戶趨勢可顯示。
              設定追蹤品牌後、aivis 會每天問 5 個 AI 引擎、本週起就有數據。
            </p>
            <Link
              to="/ai-visibility"
              className="inline-block px-4 py-2 rounded-lg text-sm font-bold text-orange-300 hover:text-orange-200 border border-orange-400/40 hover:border-orange-400/70 transition"
            >
              設定追蹤 →
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.06), rgba(0,0,0,0.3))',
      border: '1px solid rgba(249,115,22,0.22)',
    }}>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            🔥 本週 AI 趨勢
          </h3>
          {publicData && (
            <span className="text-xs font-mono text-white/40">
              {publicData.range.from} ~ {publicData.range.to}
            </span>
          )}
        </div>
        <Link to="/ai-visibility" className="text-xs text-orange-300 hover:text-orange-200 font-bold">
          看完整 aivis →
        </Link>
      </div>

      {/* 行業 filter chip row（2026-06-07 Phase A）— 預設「全部」、點 chip 多選 toggle、localStorage 記憶 */}
      <div className="flex flex-wrap gap-1.5 mb-4 items-center">
        <button
          onClick={clearIndustries}
          className="text-xs px-2.5 py-1 rounded-full font-bold transition"
          style={{
            background: selectedIndustries.length === 0 ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.04)',
            border: selectedIndustries.length === 0 ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.1)',
            color: selectedIndustries.length === 0 ? '#fdba74' : 'rgba(255,255,255,0.55)',
          }}
        >
          全部
        </button>
        {INDUSTRIES.map(ind => {
          const active = selectedIndustries.includes(ind.slug)
          return (
            <button
              key={ind.slug}
              onClick={() => toggleIndustry(ind.slug)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition inline-flex items-center gap-1"
              style={{
                background: active ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.04)',
                border: active ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.1)',
                color: active ? '#fdba74' : 'rgba(255,255,255,0.6)',
              }}
            >
              <span>{ind.emoji}</span>
              <span>{ind.name}</span>
            </button>
          )
        })}
        {selectedIndustries.length > 0 && (
          <span className="text-xs text-white/40 ml-1">
            已選 {selectedIndustries.length} 個行業
          </span>
        )}
      </div>

      {/* ───────── C 個人化區（有 Pro + 設品牌才顯示）───────── */}
      {showPersonal && (
        <div className="mb-4 rounded-xl p-4" style={{
          background: 'rgba(34,197,94,0.06)',
          border: '1px solid rgba(34,197,94,0.25)',
        }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold uppercase tracking-widest">
              你的品牌
            </span>
            <span className="text-xs text-white/45">追蹤中 {personalData.brands.length} 個 · 本週表現</span>
          </div>
          {personalData.brands.length === 0 ? (
            <p className="text-sm text-white/50">本週還沒有任何 AI 提及紀錄、跑下一輪 aivis 試試</p>
          ) : (
            <ol className="space-y-2">
              {personalData.brands.map((b, i) => {
                const rank = i + 1
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
                const change = b.change_pct
                return (
                  <li key={b.name} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 text-center text-base font-bold" style={{
                      color: rank <= 3 ? '#86efac' : 'rgba(255,255,255,0.55)',
                    }}>{medal}</span>
                    <span className="flex-1 text-sm text-white font-bold truncate">{b.name}</span>
                    <span className="text-xs text-white/55 font-mono whitespace-nowrap">
                      {b.count.toLocaleString()} 次
                    </span>
                    {change != null && (
                      <span
                        className="text-xs font-bold font-mono whitespace-nowrap min-w-[3rem] text-right"
                        style={{ color: change > 0 ? '#86efac' : change < 0 ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}
                      >
                        {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change)}%
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}

      {/* 登入但沒設品牌 → 提示「設追蹤解鎖個人趨勢」 */}
      {user && personalData && !personalData.hasBrands && (
        <div className="mb-4 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap" style={{
          background: 'rgba(34,197,94,0.05)',
          border: '1px dashed rgba(34,197,94,0.3)',
        }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-emerald-300">解鎖你的個人 AI 趨勢</div>
            <p className="text-xs text-white/55 mt-0.5">
              {isPro ? '設定追蹤品牌、aivis 會每天問 5 個 AI、本週起就有你的排名變化' : 'aivis 是 Pro 核心功能 — 升 Pro 解鎖品牌追蹤'}
            </p>
          </div>
          <Link
            to={isPro ? '/ai-visibility' : '/pricing'}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-300 hover:text-emerald-200 border border-emerald-400/40 hover:border-emerald-400/70 whitespace-nowrap"
          >
            {isPro ? '設定追蹤 →' : '升級 Pro →'}
          </Link>
        </div>
      )}

      {/* ───────── A 公共趨勢區（訪客也看得到）───────── */}
      {hasPublicData && (
        <>
          {/* 規模感 */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-white/55">
            <span>本週全平台 AI 引擎共回應</span>
            <strong className="text-white font-mono text-sm">{publicData.totalResponses.toLocaleString()}</strong>
            <span>次 · 提及品牌</span>
            <strong className="text-white font-mono text-sm">{publicData.totalMentions.toLocaleString()}</strong>
            <span>次</span>
          </div>

          {/* Engine chips */}
          {Object.keys(publicData.engineBreakdown || {}).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(publicData.engineBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([engine, count]) => (
                  <span key={engine} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 font-mono">
                    {engine} · {count.toLocaleString()}
                  </span>
                ))}
            </div>
          )}

          {/* Top 5 全平台 */}
          {publicData.topMentions.length > 0 && (
            <div className="rounded-xl p-4" style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(249,115,22,0.18)',
            }}>
              <div className="text-xs text-white/50 mb-3 font-bold uppercase tracking-widest">
                本週全平台 AI 最常提及的品牌
              </div>
              <ol className="space-y-2">
                {publicData.topMentions.map((m, i) => {
                  const rank = i + 1
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
                  const change = m.change_pct
                  return (
                    <li key={m.name} className="flex items-center gap-3">
                      <span className="flex-shrink-0 w-8 text-center text-base font-bold" style={{
                        color: rank <= 3 ? '#fdba74' : 'rgba(255,255,255,0.55)',
                      }}>{medal}</span>
                      <span className="flex-1 text-sm text-white font-bold truncate">{m.name}</span>
                      <span className="text-xs text-white/55 font-mono whitespace-nowrap">
                        {m.count.toLocaleString()} 次
                      </span>
                      {change != null && (
                        <span
                          className="text-xs font-bold font-mono whitespace-nowrap min-w-[3rem] text-right"
                          style={{ color: change > 0 ? '#86efac' : change < 0 ? '#fca5a5' : 'rgba(255,255,255,0.4)' }}
                        >
                          {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change)}%
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </>
      )}

      {/* Footer 小字 — 解釋資料來源 */}
      <p className="mt-3 text-[11px] text-white/35 leading-relaxed">
        💡 {showPersonal ? '個人區來自你的 aivis 追蹤；' : ''}
        全平台統計來自 Aark aivis 監測累積（跨用戶匿名）— 涵蓋 ChatGPT / Claude / Perplexity / Gemini / GLM 5 個 AI 引擎、每 5 分鐘更新。
      </p>
    </section>
  )
}
