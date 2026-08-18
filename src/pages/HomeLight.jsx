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
 */
export default function HomeLight() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [anonResult, setAnonResult] = useState(null)
  const scanInFlightRef = useRef(false)

  // 並行驗收路由不進搜尋索引（硬切換上 / 時移除這段）
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  async function handleSubmit(e) {
    e?.preventDefault?.()
    const rawUrl = (url ?? '').trim()
    if (!rawUrl) return
    if (scanInFlightRef.current) return   // 防重入（同步 ref 擋同一輪重複觸發）
    scanInFlightRef.current = true
    setLoading(true)
    setErrMsg('')
    setAnonResult(null)
    setStatus(user ? '正在建立網站記錄…' : '正在分析網站…')

    try {
      const cleanUrl = normalizeUrl(rawUrl)
      if (!cleanUrl) throw new Error('URL 格式錯誤，請確認網址（例：yourbrand.com）')

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
        await runFullScan({ websiteId, url: cleanUrl })
        navigate(`/app/${websiteId}/overview`)
        return
      }

      // 未登入：4 分析器共用同一份 doc（省 proxy 流量），不寫 audit 表
      setStatus('正在分析網站…約需 30 秒')
      const { html } = await fetchPageContent(cleanUrl)
      const doc = parseHTML(html)
      const [seo, aeo, geo, eeat] = await Promise.all([
        analyzeSEO(cleanUrl, doc).catch(() => null),
        analyzeAEO(cleanUrl, doc).catch(() => null),
        analyzeGEO(cleanUrl, doc).catch(() => null),
        analyzeEEAT(cleanUrl, doc).catch(() => null),
      ])
      const anon = {
        url: cleanUrl, name: new URL(cleanUrl).hostname,
        seo: seo?.score ?? null, aeo: aeo?.score ?? null,
        geo: geo?.score ?? null, eeat: eeat?.score ?? null,
      }
      setAnonResult(anon)
      bumpAnonScanCount()
      setStatus('')
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
    <div className="homelight">
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
          {status && <p className="hl-status" aria-live="polite">{status}</p>}
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

      {/* 未登入快掃結果：先給分數（value-first），完整診斷/保存引導註冊 */}
      {anonResult && (
        <section className="hl-anon">
          <div className="card">
            <div className="hd">
              <b>{anonResult.name}</b>
              <span>已完成單頁快掃——這次只掃這一頁，不代表全站</span>
            </div>
            <div className="row">
              {[
                ['SEO', anonResult.seo, 'var(--seo)'],
                ['AEO', anonResult.aeo, 'var(--aeo)'],
                ['GEO', anonResult.geo, 'var(--geo)'],
                ['E-E-A-T', anonResult.eeat, 'var(--eeat)'],
              ].map(([nm, n, c]) => (
                <div className="sc" key={nm}>
                  <div className="nm">{nm}</div>
                  <div className="n" style={{ color: c }}>{n ?? '—'}</div>
                </div>
              ))}
            </div>
            <p className="note">分數只是起點——哪幾項沒過、每一項怎麼修（含可直接貼上的修復碼），註冊後免費看完整診斷並保存紀錄。</p>
            <div className="acts">
              <Link to="/register" className="hl-btn hl-cta hl-sm">免費註冊看完整診斷</Link>
              <button type="button" className="hl-btn hl-ghost hl-sm" onClick={() => { setAnonResult(null); setUrl('') }}>再掃一個網址</button>
            </div>
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
