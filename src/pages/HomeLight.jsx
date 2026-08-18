import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { normalizeUrl } from '../lib/url'
import { trackPixelCustom } from '../lib/pixel'
import { getAnonSessionId, bumpAnonScanCount } from '../lib/anonSession'
import { fetchPageContent, parseHTML, analyzeSEO } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { runFullScan } from '../services/scanService'
import { logError } from '../lib/errorLog'
import '../styles/homelight.css'

/** 四面向卡：版面順序固定；翻開順序＝分析器真實完成順序（不排演、不假裝） */
const ASPECTS = [
  { key: 'seo', label: 'SEO', color: 'var(--seo)' },
  { key: 'aeo', label: 'AEO', color: 'var(--aeo)' },
  { key: 'geo', label: 'GEO', color: 'var(--geo)' },
  { key: 'eeat', label: 'E-E-A-T', color: 'var(--eeat)' },
]
const IDLE_PHASES = { seo: null, aeo: null, geo: null, eeat: null }
const prefersReduce = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * 新版首頁（亮色鴿哥版）— 2026-08-18 並行驗收路由 /home-v2
 *
 * 視覺：照高保真設計稿「① 首頁」半邊 1:1 實作（暖白·深藍·橘·鴿哥）。
 * 功能（真流程、非展示稿）：
 * - 未登入：value-first 快掃——4 分析器瀏覽器端跑、不寫 audit 表，
 *   inline 給分數 + anon_scan_events 日誌 + Pixel 事件（與 HomeDark 同規格）
 * - 登入：找/建 websites row → runFullScan（唯一權威 service）→ 進 /app 新版總覽
 * 硬切前刻意不搬：我的網站列表、排行榜內嵌、FAQ（暗色版還在 / 撐著；
 * 硬切時再決定去留）。並行期掛 noindex，不跟正式首頁搶 SEO。
 *
 * 等待畫面（2026-08-18 critique B）：結果卡在按下按鈕當下就以「骨架態」出現，
 * 四個分析器誰先 resolve 誰就先翻開自己那張——30-60 秒的死畫面變成逐項展演，
 * 而且翻牌節奏＝系統真實進度，沒有假排演（誠實線）。
 */
export default function HomeLight() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [anonResult, setAnonResult] = useState(null)
  const [scanTarget, setScanTarget] = useState(null)   // 掃描中就要有站名可顯示（卡先出現、分數後到）
  const [phases, setPhases] = useState(IDLE_PHASES)    // null＝該面向還在跑（骨架）；物件＝已翻開
  const scanInFlightRef = useRef(false)
  const resultRef = useRef(null)
  const headRef = useRef(null)

  const doneCount = ASPECTS.filter(a => phases[a.key]).length

  // 單一面向回報：分析器 resolve（或失敗）就翻開它那張卡，不等其他三個
  const markPhase = (key, result) =>
    setPhases(prev => ({ ...prev, [key]: { score: result?.score ?? null } }))

  function resetScan() {
    setAnonResult(null); setScanTarget(null); setPhases(IDLE_PHASES)
    setStatus(''); setErrMsg(''); setUrl('')
  }

  // 並行驗收路由不進搜尋索引（硬切換上 / 時移除這段）
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  // 掃描一開始就把骨架卡帶進視窗——手機上它必定落在 hero 下方，看不到就白翻了
  useEffect(() => {
    if (!loading) return
    resultRef.current?.scrollIntoView({ behavior: prefersReduce() ? 'auto' : 'smooth', block: 'nearest' })
  }, [loading])

  // 掃描完成：焦點移到卡片標題（螢幕閱讀器不再靜默）＋確保整張卡在視窗內
  useEffect(() => {
    if (!anonResult) return
    headRef.current?.focus?.({ preventScroll: true })
    resultRef.current?.scrollIntoView({ behavior: prefersReduce() ? 'auto' : 'smooth', block: 'nearest' })
  }, [anonResult])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    const rawUrl = (url ?? '').trim()
    if (!rawUrl) return
    if (scanInFlightRef.current) return   // 防重入（同步 ref 擋同一輪重複觸發）
    scanInFlightRef.current = true
    setLoading(true)
    setErrMsg('')
    setAnonResult(null)
    setPhases(IDLE_PHASES)
    setStatus(user ? '正在建立網站記錄…' : '正在分析網站…')

    try {
      const cleanUrl = normalizeUrl(rawUrl)
      if (!cleanUrl) throw new Error('URL 格式錯誤，請確認網址（例：yourbrand.com）')
      setScanTarget({ url: cleanUrl, name: new URL(cleanUrl).hostname })

      if (user) {
        // 登入：websites 以「URL + user_id」為鍵，找不到才建
        const { data: existing } = await supabase
          .from('websites').select('id')
          .eq('url', cleanUrl).eq('user_id', user.id).maybeSingle()
        let websiteId = existing?.id
        if (!websiteId) {
          const { data: newSite, error: siteError } = await supabase
            .from('websites')
            .insert([{ url: cleanUrl, name: new URL(cleanUrl).hostname, user_id: user.id }])
            .select().single()
          if (siteError) throw siteError
          websiteId = newSite.id
        }
        setStatus('正在分析網站…約需 30–60 秒')
        // onProgress：登入路徑走共用 service，同樣逐面向翻牌（兩條路徑的等待畫面一致）
        await runFullScan({ websiteId, url: cleanUrl, onProgress: markPhase })
        setStatus('✓ 掃描完成，正在開啟報告…')
        navigate(`/app/${websiteId}/overview`)
        return
      }

      // 未登入：4 分析器共用同一份 doc（省 proxy 流量），不寫 audit 表
      setStatus('正在分析網站…約需 30 秒')
      const { html } = await fetchPageContent(cleanUrl)
      const doc = parseHTML(html)
      // 各自回報（成功或失敗都翻牌）；Promise.all 仍等四個到齊才組最終結果
      const flip = (key, promise) => promise.then(
        r => { markPhase(key, r); return r },
        () => { markPhase(key, null); return null },
      )
      const [seo, aeo, geo, eeat] = await Promise.all([
        flip('seo', analyzeSEO(cleanUrl, doc)),
        flip('aeo', analyzeAEO(cleanUrl, doc)),
        flip('geo', analyzeGEO(cleanUrl, doc)),
        flip('eeat', analyzeEEAT(cleanUrl, doc)),
      ])
      const anon = {
        url: cleanUrl, name: new URL(cleanUrl).hostname,
        seo: seo?.score ?? null, aeo: aeo?.score ?? null,
        geo: geo?.score ?? null, eeat: eeat?.score ?? null,
      }
      setAnonResult(anon)
      bumpAnonScanCount()
      setStatus('✓ 掃描完成——四個面向的分數已列在下方')
      trackPixelCustom('AnonScanComplete', { content_name: anon.name })
      // 後臺日誌（fire-and-forget；boolean 旗標留診斷線索，與 HomeDark 同格式）
      const flags = o => o ? Object.fromEntries(
        Object.entries(o).filter(([, v]) => typeof v === 'boolean')
      ) : null
      const base = { url: anon.url, name: anon.name, seo: anon.seo, aeo: anon.aeo, geo: anon.geo, eeat: anon.eeat }
      supabase.from('anon_scan_events').insert({
        ...base,
        session_id: getAnonSessionId(),
        details: { seo: flags(seo), aeo: flags(aeo), geo: flags(geo), eeat: flags(eeat) },
      }).then(({ error }) => {
        if (error) console.warn('anon_scan_events insert failed:', error.message)
      })
    } catch (error) {
      setStatus('')
      setScanTarget(null)
      setPhases(IDLE_PHASES)
      const detail = error?.message || String(error)
      setErrMsg(`分析中斷：${detail}——如果多次失敗，可能是對方主機擋了自動請求，稍後再試或換一頁掃。`)
      logError({ source: 'homelight_scan', message: detail, userId: user?.id, detail: { url: rawUrl } })
    } finally {
      scanInFlightRef.current = false
      setLoading(false)
    }
  }

  const check = (
    <svg className="tk" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5" /></svg>
  )

  return (
    <div className={`homelight${loading ? ' is-scanning' : ''}`}>
      {/* 頂部導覽：雷達弧 wordmark + 登入/註冊（登入者直接進儀表板） */}
      <header className="hl-nav">
        <Link to="/" className="hl-wm">
          <svg className="hl-mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
            <circle cx="17" cy="17" r="15.5" fill="none" stroke="rgba(0,0,62,.12)" />
            <circle cx="17" cy="17" r="10" fill="none" stroke="rgba(0,0,62,.12)" />
            <circle cx="17" cy="17" r="4.5" fill="none" stroke="rgba(0,0,62,.12)" />
            <g className="sweep"><path d="M17 17 L17 1.5 A15.5 15.5 0 0 1 30 9 Z" fill="#ff6e34" opacity=".9" /></g>
            <circle cx="17" cy="17" r="2.4" fill="#00003e" />
          </svg>
          <div><div className="name">方舟 AI 雷達</div><div className="sub">Powered by AARK</div></div>
        </Link>
        <div className="r">
          {user ? (
            <Link to="/app/websites" className="hl-btn hl-cta hl-sm">進入儀表板</Link>
          ) : (
            <>
              <Link to="/login" className="hl-btn hl-ghost hl-sm">登入</Link>
              <Link to="/register" className="hl-btn hl-cta hl-sm">免費註冊</Link>
            </>
          )}
        </div>
      </header>

      {/* Hero：左文案 + 掃描入口、右鴿哥雷達舞台 */}
      <section className="hl-hero">
        <div>
          <span className="hl-kick"><span className="live" />涵蓋 ChatGPT · Claude · Gemini</span>
          <h1>ChatGPT 推不推薦<br /><span className="hl">你的品牌？</span></h1>
          <p className="hl-lede">別人問 AI「推薦哪一家」時，你在不在名單上？<b>方舟 AI 雷達幫你量出來</b>——輸入網址，30 秒先看你的 AI 能見度分數。</p>
          <form className="hl-scan" onSubmit={handleSubmit}>
            <svg className="globe" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>
            <input
              type="text" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="輸入你的網址，例如 yourbrand.com" aria-label="網址" disabled={loading}
            />
            <button type="submit" className="hl-btn hl-cta" disabled={loading}>
              {loading ? '分析中…' : '免費檢測 →'}
            </button>
          </form>
          {/* 常駐 live region：不隨文字清空而卸載，否則「完成」那一刻螢幕閱讀器是靜默的 */}
          <p className="hl-status" aria-live="polite">{status}</p>
          {errMsg && <p className="hl-status err" role="alert">{errMsg}</p>}
          <div className="hl-trust">
            <span>{check}免註冊先看分數</span>
            <span>{check}繁中原生</span>
            <span>{check}開統一發票</span>
          </div>
        </div>

        <div className="hl-stage">
          <div className="hl-halo" />
          <svg className="hl-radar" viewBox="0 0 400 400" aria-hidden="true">
            <circle cx="200" cy="200" r="70" /><circle cx="200" cy="200" r="120" /><circle cx="200" cy="200" r="170" />
            <circle className="live l1" cx="200" cy="200" r="170" />
            <circle className="live l2" cx="200" cy="200" r="170" />
            <circle className="live l3" cx="200" cy="200" r="170" />
          </svg>
          <img className="hl-pigeon" src="/img/pigeon-hero.png" alt="方舟 AI 雷達的信鴿吉祥物" width="410" height="461" />
          <span className="hl-tagline">🕊 <b>放出去偵察的信鴿</b>，替你探 AI 有沒有看見你</span>
        </div>
      </section>

      {/* 掃描等待 → 結果：同一張卡，骨架態逐格翻開（等待即展演；未登入完成後引導註冊） */}
      {(loading || anonResult) && (
        <section className="hl-anon">
          <div className="card" ref={resultRef}>
            <div className="hd">
              <b tabIndex={-1} ref={headRef}>{anonResult?.name || scanTarget?.name || '準備掃描'}</b>
              <span>
                {anonResult
                  ? '已完成單頁快掃——這次只掃這一頁，不代表全站'
                  : `掃描中 · ${doneCount}/4 個面向已完成`}
              </span>
            </div>
            <div className="row">
              {ASPECTS.map(({ key, label, color }) => {
                const phase = phases[key]
                return (
                  <div className="sc" key={key}>
                    <div className={`fl${phase ? ' is-open' : ''}`}>
                      {/* 正面＝骨架：這個面向還在跑 */}
                      <div className="fc front" aria-hidden={!!phase}>
                        <div className="nm">{label}</div>
                        <div className="skel" />
                      </div>
                      {/* 背面＝翻開後的分數（分析器失敗顯示 —） */}
                      <div className="fc back" aria-hidden={!phase}>
                        <div className="nm">{label}</div>
                        <div className="n" style={{ color }}>{phase?.score ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {anonResult ? (
              <div className="hl-done">
                <p className="note">分數只是起點——哪幾項沒過、每一項怎麼修（含可直接貼上的修復碼），註冊後免費看完整診斷並保存紀錄。</p>
                <div className="acts">
                  <Link to="/register" className="hl-btn hl-cta hl-sm">免費註冊看完整診斷</Link>
                  <button type="button" className="hl-btn hl-ghost hl-sm" onClick={resetScan}>再掃一個網址</button>
                </div>
              </div>
            ) : (
              <p className="note">四個面向分開跑——誰先跑完就先翻開誰，不用等全部結束。</p>
            )}
          </div>
        </section>
      )}

      {/* 三大差異化（設計稿原文案） */}
      <section className="hl-foot">
        <div className="hl-fgrid">
          <div className="hl-fitem"><div className="ft"><span className="dot" />不只找出問題，還幫你修</div><p className="fd">每個沒過的項目，給你能直接貼上網站的修復碼（WordPress / Shopify / 自架）。</p></div>
          <div className="hl-fitem"><div className="ft"><span className="dot" />實際去問 3 大 AI</div><p className="fd">真的拿你的品牌去問 ChatGPT、Claude、Gemini「推薦哪一家」，看你有沒有被講出來。</p></div>
          <div className="hl-fitem"><div className="ft"><span className="dot" />為台灣網站校準</div><p className="fd">繁中原生、懂 Rank Math 與中文長度——不是把國際工具硬套在台灣站上。</p></div>
        </div>
      </section>

      {/* 頁尾：常用導覽 + 公司列 */}
      <footer className="hl-bottom">
        <div className="in">
          <Link to="/pricing">定價</Link>
          <Link to="/faq">常見問題</Link>
          <Link to="/showcase">排行榜</Link>
          <Link to="/content-audit">文章分析</Link>
          <span className="co">方舟 AI 雷達｜由優勢方舟數位行銷營運</span>
        </div>
      </footer>
    </div>
  )
}
