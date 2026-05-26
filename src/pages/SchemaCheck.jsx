/**
 * /schema-check 落地頁 — 「你的網站有哪些 Schema？AI 看得到嗎？」單一痛點檢測頁
 *
 * 用途：粉專廣告 / Threads 連結 / Builder 用戶痛點導流落地頁
 * 對標：Google Rich Results Test（太陽春、只看 Google 認的）+ schema.org Validator（太技術）
 * 差異化：中文 + 視覺友善 + 偵測「視覺有但缺 schema」的 case
 *
 * 設計原則：
 *   - 視覺單一焦點：minimal header + 單一輸入 + 動畫掃描 + 結果列表
 *   - 不需登入即可測試（降低 friction）
 *   - CTA 單一：要看完整修法 code → 免費註冊看 AEO 詳情頁
 *
 * ⚠️ 視覺現為「功能完整、樣式平實」的骨架版，後續可由 Claude Design 接手做視覺強化
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { T } from '../styles/v2-tokens'
import { normalizeUrl } from '../lib/url'
import { useAuth } from '../context/AuthContext'

// 常見且對 AI / SEO 有意義的 schema types — 用來分類偵測結果與推薦補上
// 來源：schema.org + Google Rich Results 支援清單，過濾出對 AI 引用 / SEO 顯示有實際影響的
const KEY_SCHEMA_TYPES = {
  Organization:    { label: 'Organization (組織)',        purpose: '告訴 AI 「我們是誰」— 對品牌引用至關重要',           priority: 'essential' },
  WebSite:         { label: 'WebSite (網站)',              purpose: '提供站名 / sitelink searchbox 等基本識別資訊',     priority: 'essential' },
  WebPage:         { label: 'WebPage (頁面)',              purpose: '單一頁面的元資料容器',                                priority: 'recommended' },
  Article:         { label: 'Article / BlogPosting (文章)', purpose: '文章內容主體 — 對 AI 引用文章內容很重要',          priority: 'recommended' },
  FAQPage:         { label: 'FAQPage (常見問題)',          purpose: 'AI 直接拆出 Q&A 引用 — 你的常見問題會被 AI 推薦',  priority: 'recommended' },
  BreadcrumbList:  { label: 'BreadcrumbList (麵包屑)',     purpose: '幫 Google 在搜尋結果顯示路徑',                       priority: 'recommended' },
  Product:         { label: 'Product (產品)',              purpose: '電商必備 — 價格 / 評分 / 庫存讓 Google 顯示豐富摘要', priority: 'context' },
  Service:         { label: 'Service (服務)',              purpose: '服務型網站告訴 AI 「我提供什麼」',                   priority: 'context' },
  LocalBusiness:   { label: 'LocalBusiness (在地商家)',    purpose: 'Google 在地商家面板必備 — 地址 / 營業時間 / 評分',  priority: 'context' },
  Person:          { label: 'Person (人物)',              purpose: 'E-E-A-T 重要 — 作者 / 創辦人身份建立',              priority: 'context' },
  Review:          { label: 'Review (評論)',              purpose: '個別評論',                                          priority: 'context' },
  AggregateRating: { label: 'AggregateRating (評分匯總)',  purpose: '星級評分 — Google 結果顯示星星',                   priority: 'context' },
  VideoObject:     { label: 'VideoObject (影片)',          purpose: '影片在 Google / YouTube 結果顯示縮圖摘要',          priority: 'context' },
  Event:           { label: 'Event (活動)',               purpose: '活動 / 講座 / 課程在 Google 結果顯示時間地點',     priority: 'context' },
  HowTo:           { label: 'HowTo (教學)',                purpose: 'AI 直接拆步驟引用',                                 priority: 'context' },
  Recipe:          { label: 'Recipe (食譜)',              purpose: '食譜在 Google 結果顯示星級 / 時間',                priority: 'context' },
  Course:          { label: 'Course (課程)',              purpose: '線上課程 / 教育機構',                              priority: 'context' },
  QAPage:          { label: 'QAPage (問答頁)',             purpose: '比 FAQPage 更聚焦單一問題 — 知識庫類網站適用',     priority: 'context' },
}

/**
 * 從 HTML 解析所有 JSON-LD schema
 * 回傳：{ types: [{type, valid, raw, source}], invalidCount, totalScripts }
 *   - 處理 @graph 巢狀（一個 script 內含多個 type）
 *   - 處理 @type 為 array（一個物件多個 type）
 *   - parse 失敗的 script 計入 invalidCount，但不會中斷整體解析
 */
function parseAllSchemas(html) {
  // 用 DOMParser 解析 HTML — 比 regex 穩、處理巢狀引號等 edge case
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  const types = []
  let invalidCount = 0

  scripts.forEach((script, scriptIdx) => {
    const raw = script.textContent || ''
    try {
      const data = JSON.parse(raw)
      // 抓出所有 type — 處理 3 種結構
      const extractTypes = (obj) => {
        if (!obj || typeof obj !== 'object') return []
        const t = obj['@type']
        if (Array.isArray(t)) return t
        if (typeof t === 'string') return [t]
        return []
      }
      // (1) 頂層 @type
      const topLevelTypes = extractTypes(data)
      topLevelTypes.forEach(t => types.push({ type: t, valid: true, source: `script #${scriptIdx + 1}`, raw }))
      // (2) @graph 陣列裡的每個 type
      if (Array.isArray(data['@graph'])) {
        data['@graph'].forEach((item, graphIdx) => {
          extractTypes(item).forEach(t => types.push({
            type: t, valid: true, source: `script #${scriptIdx + 1} @graph[${graphIdx}]`, raw,
          }))
        })
      }
    } catch {
      invalidCount++
      types.push({ type: '(parse error)', valid: false, source: `script #${scriptIdx + 1}`, raw: raw.slice(0, 200) })
    }
  })

  return { types, invalidCount, totalScripts: scripts.length }
}

/**
 * 視覺 FAQ 偵測 — 跟 aeoAnalyzer.js 同一套 heuristic
 * 用來在「沒 FAQPage schema」時提示用戶「但你有視覺 FAQ → 該補 schema」
 */
function detectVisualFaq(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const FAQ_HEADING_RE = /常見問題|FAQ|Q\s*[&＆]\s*A|Q\s*and\s*A|Frequently\s+Asked\s+Questions|問與答/i
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="faq" i], [id*="faq" i]')
  let hasFaqHeading = false
  for (const h of headings) {
    if (FAQ_HEADING_RE.test(h.textContent || '') || FAQ_HEADING_RE.test(h.getAttribute('id') || '') || FAQ_HEADING_RE.test(h.getAttribute('class') || '')) {
      hasFaqHeading = true; break
    }
  }
  const detailsCount = doc.querySelectorAll('details').length
  let questionLikeCount = 0
  if (hasFaqHeading) {
    const paragraphs = doc.querySelectorAll('p, dt, summary, strong, li, h3, h4, h5')
    for (const p of paragraphs) {
      const text = (p.textContent || '').trim()
      if (text.length > 0 && text.length < 80 && /[？?]$/.test(text)) {
        questionLikeCount++
        if (questionLikeCount >= 3) break
      }
    }
  }
  return (hasFaqHeading && questionLikeCount >= 3) || detailsCount >= 3
}

export default function SchemaCheck() {
  const [searchParams] = useSearchParams()
  // 預填邏輯：?url=xxx 帶過來時自動填入輸入框（給 AEO 詳情頁微入口用）
  const [url, setUrl] = useState(searchParams.get('url') || '')
  const [scanning, setScanning] = useState(false)
  const [logs, setLogs] = useState([])           // 動畫式掃描 log
  const [result, setResult] = useState(null)     // { foundTypes, missingEssentials, hasVisualFaq, totalScripts, invalidCount }
  const [errorMsg, setErrorMsg] = useState(null)
  const timersRef = useRef([])
  // 偵測登入狀態 — 已登入時 CTA 切換為「進首頁掃描」而非「免費註冊」
  const { user } = useAuth()

  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  async function handleScan(e) {
    e?.preventDefault()
    if (!url || scanning) return
    setScanning(true)
    setResult(null)
    setErrorMsg(null)
    setLogs([])
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const cleanUrl = normalizeUrl(url)
    if (!cleanUrl) {
      setErrorMsg('網址格式錯誤')
      setScanning(false)
      return
    }

    // 動畫式 log（模擬掃描過程，給用戶感覺工具有在工作）
    const pushLog = (text, delay) => {
      const t = setTimeout(() => setLogs(prev => [...prev, text]), delay)
      timersRef.current.push(t)
    }
    pushLog(`▸ 嘗試連線 ${cleanUrl}`, 200)
    pushLog(`▸ 解析 HTML <head> + <body>`, 800)
    pushLog(`▸ 搜尋 <script type="application/ld+json"> 標籤`, 1400)
    pushLog(`▸ 解析 JSON-LD 結構 + @graph 巢狀`, 2000)
    pushLog(`▸ 比對 schema.org 標準 type 清單`, 2600)

    try {
      const apiResp = await fetch(`/api/fetch-url?url=${encodeURIComponent(cleanUrl)}`)
      const data = await apiResp.json()
      if (!apiResp.ok || !data.success) {
        setErrorMsg(data.hint || data.error || '抓取失敗，請確認網址後重試')
        setScanning(false)
        return
      }

      const { types, invalidCount, totalScripts } = parseAllSchemas(data.content)
      const hasVisualFaq = detectVisualFaq(data.content)

      // 把所有偵測到的 type 去重 + 標記是否在 KEY_SCHEMA_TYPES 清單
      const foundTypeNames = [...new Set(types.filter(t => t.valid).map(t => t.type))]
      const foundTypeDetail = foundTypeNames.map(name => ({
        name,
        meta: KEY_SCHEMA_TYPES[name] || null,    // null 表示有偵測到但不在我們清單（未知 / 罕見 type）
        sources: types.filter(t => t.type === name).map(t => t.source),
      }))

      // 推薦補上的 essential（Organization、WebSite 等基本款）
      const missingEssentials = Object.entries(KEY_SCHEMA_TYPES)
        .filter(([name, meta]) => meta.priority === 'essential' && !foundTypeNames.includes(name))
        .map(([name, meta]) => ({ name, meta }))

      // 等動畫跑完再 reveal
      const t = setTimeout(() => {
        setResult({ foundTypeDetail, missingEssentials, hasVisualFaq, totalScripts, invalidCount, cleanUrl })
        setScanning(false)
      }, 3200)
      timersRef.current.push(t)
    } catch (err) {
      console.error('SchemaCheck error:', err)
      setErrorMsg('掃描失敗，請稍後重試')
      setScanning(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: T.font }}>
      {/* DESIGN: minimal header */}
      <header style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 10,
      }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontWeight: 700 }}>AI 雷達</Link>
        <div style={{ display: 'flex', gap: 12 }}>
          {user ? (
            <Link to="/" style={{ color: T.text, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>回首頁 →</Link>
          ) : (
            <>
              <Link to="/login" style={{ color: T.textMid, textDecoration: 'none', fontSize: 13 }}>登入</Link>
              <Link to="/register" style={{ color: T.text, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>免費註冊</Link>
            </>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 96px' }}>
        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.3, marginBottom: 12 }}>
            你的網站有哪些 Schema？AI 看得到嗎？
          </h1>
          <p style={{ color: T.textMid, fontSize: 15, lineHeight: 1.6 }}>
            30 秒掃描你的網站 JSON-LD 結構化資料，列出所有偵測到的 schema type、缺漏的必備項，並標出「視覺有但 AI 看不到」的 FAQ 內容。
          </p>
        </section>

        {/* URL 輸入 */}
        <form onSubmit={handleScan} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="輸入網址，例如 example.com"
              disabled={scanning}
              style={{
                flex: 1, minWidth: 240, padding: '14px 18px', fontSize: 15,
                background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.cardBorder}`,
                borderRadius: T.rM, color: T.text, outline: 'none', fontFamily: T.font,
              }}
            />
            <button
              type="submit"
              disabled={!url || scanning}
              style={{
                padding: '14px 28px', fontSize: 15, fontWeight: 700,
                background: scanning ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${T.aeo}, #a855f7)`,
                color: 'white', border: 'none', borderRadius: T.rM,
                cursor: scanning ? 'wait' : 'pointer', opacity: !url ? 0.5 : 1,
              }}
            >{scanning ? '掃描中...' : '開始檢測'}</button>
          </div>
          {errorMsg && <p style={{ color: T.fail, fontSize: 13, marginTop: 10 }}>⚠️ {errorMsg}</p>}
        </form>

        {/* DESIGN: 終端機式掃描動畫 */}
        {(scanning || logs.length > 0) && (
          <section style={{
            background: 'rgba(0,0,0,0.55)', border: `1px solid ${T.cardBorder}`,
            borderRadius: T.rL, padding: 20, marginBottom: 24,
            fontFamily: T.mono, fontSize: 13,
          }}>
            <div style={{ color: T.textMid, marginBottom: 12, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ── Schema 掃描中 ──
            </div>
            {logs.map((line, i) => (
              <div key={i} style={{ color: T.textMid, marginBottom: 4 }}>{line}</div>
            ))}
            {scanning && (
              <div style={{ color: T.textLow, marginTop: 4 }}>
                <span style={{ animation: 'blink 1s infinite' }}>▊</span>
              </div>
            )}
          </section>
        )}

        {/* 結果 */}
        {result && (
          <>
            {/* 結論卡 — 總覽 */}
            <section style={{
              background: 'rgba(0,0,0,0.5)',
              border: `1px solid ${result.foundTypeDetail.length > 0 ? T.aeo : T.warn}55`,
              borderRadius: T.rL, padding: 24, marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, color: T.textLow, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                檢測結論
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 8 }}>
                偵測到 <span style={{ color: T.aeo }}>{result.foundTypeDetail.length}</span> 種 Schema type
                {result.totalScripts > 0 && <span style={{ fontSize: 14, color: T.textLow, fontWeight: 400 }}>（共 {result.totalScripts} 個 JSON-LD script）</span>}
              </div>
              {result.invalidCount > 0 && (
                <div style={{ color: T.warn, fontSize: 13, marginBottom: 6 }}>
                  ⚠️ {result.invalidCount} 個 script 解析失敗（可能 JSON 語法錯，AI 引擎抓不到）
                </div>
              )}
              {result.hasVisualFaq && !result.foundTypeDetail.some(t => t.name === 'FAQPage' || t.name === 'QAPage') && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: T.rM,
                  background: T.warn + '15', border: `1px solid ${T.warn}55`,
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  <strong style={{ color: T.warn }}>⚠️ 你的頁面有 FAQ 區塊但沒包成 FAQPage schema</strong><br />
                  <span style={{ color: T.textMid }}>對人類訪客可見，但 ChatGPT / Claude / Perplexity 抓不到。建議把 Q&A 包成 JSON-LD。</span>
                </div>
              )}
            </section>

            {/* 偵測到的 schema 列表 */}
            {result.foundTypeDetail.length > 0 && (
              <section style={{
                background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.cardBorder}`,
                borderRadius: T.rL, padding: 20, marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12, letterSpacing: '.05em' }}>
                  ✅ 偵測到的 Schema
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.foundTypeDetail.map(t => (
                    <div key={t.name} style={{
                      padding: '10px 12px', borderRadius: T.rM,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${T.cardBorder}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.aeo, fontFamily: T.mono }}>{t.name}</span>
                        {t.meta && (
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                            background: T.aeo + '22', color: T.aeo,
                          }}>{t.meta.label}</span>
                        )}
                        {!t.meta && (
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)', color: T.textLow,
                          }}>非常見 type</span>
                        )}
                      </div>
                      {t.meta && (
                        <div style={{ fontSize: 11, color: T.textMid, marginTop: 4, lineHeight: 1.5 }}>{t.meta.purpose}</div>
                      )}
                      <div style={{ fontSize: 10, color: T.textLow, marginTop: 4, fontFamily: T.mono }}>
                        位置：{t.sources.join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 缺漏的 essential */}
            {result.missingEssentials.length > 0 && (
              <section style={{
                background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.warn}55`,
                borderRadius: T.rL, padding: 20, marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: T.warn, marginBottom: 12, letterSpacing: '.05em' }}>
                  ❌ 強烈建議補上的基本款
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {result.missingEssentials.map(m => (
                    <div key={m.name} style={{
                      padding: '10px 12px', borderRadius: T.rM,
                      background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: T.mono }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: T.textMid, marginTop: 4, lineHeight: 1.5 }}>{m.meta.purpose}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA — 依登入狀態切換文案 + 連結
                未登入：免費註冊 → /register
                已登入：直接跳首頁掃描 → / */}
            <section style={{
              background: `linear-gradient(135deg, ${T.aeo}22, ${T.aivis}22)`,
              border: `1px solid ${T.aeo}55`,
              borderRadius: T.rL, padding: 24, marginBottom: 24, textAlign: 'center',
            }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                想要每個 Schema 的修法 code？
              </h2>
              <p style={{ color: T.textMid, fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>
                {user ? (
                  <>跑完整 AEO 分析會給你 schema 清單 + 缺漏建議。<br />
                  <strong style={{ color: T.text }}>基本款 schema（Organization / WebSite / OG / Canonical）修法 code 免費開放</strong>；<br />
                  進階 schema（FAQPage / BreadcrumbList / Product 等）含 WordPress / Shopify / Wix / 自架 HTML 平台別範例為 Pro 限定。</>
                ) : (
                  <>免費註冊用 AI 雷達跑完整 AEO 分析，<strong style={{ color: T.text }}>基本款 schema 修法 code 免費開放</strong>。<br />
                  進階 schema（FAQPage / BreadcrumbList 等）+ 平台別範例（WP / Shopify / Wix / HTML）為 Pro 限定。</>
                )}
              </p>
              <Link to={user ? '/' : '/register'} style={{
                display: 'inline-block', padding: '14px 36px', fontSize: 15, fontWeight: 700,
                background: `linear-gradient(135deg, ${T.aeo}, #a855f7)`, color: 'white',
                borderRadius: T.rM, textDecoration: 'none',
              }}>{user ? '回首頁掃描你的網站 →' : '免費註冊 → 看完整修法'}</Link>
              {!user && (
                <div style={{ marginTop: 12, fontSize: 11, color: T.textLow }}>
                  30 秒註冊・不需信用卡・3 個免費網站額度
                </div>
              )}
            </section>
          </>
        )}

        {/* 教育型內容 — 用「報名表」比喻講為什麼 Organization Schema 是品牌存活的關鍵 */}
        <section style={{
          background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.cardBorder}`,
          borderRadius: T.rL, padding: 24, marginTop: 32,
          color: T.textMid, fontSize: 13, lineHeight: 1.75,
        }}>
          <h3 style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            🧐 為什麼缺 Organization Schema = AI 把你當「不存在的品牌」？
          </h3>
          <p style={{ marginBottom: 12 }}>
            想像 Schema 是<strong style={{ color: T.text }}>你交給 Google / AI 引擎的「品牌報名表」</strong>。
            上面寫著你是誰、做什麼、網址、地址、聯絡方式、社群連結。
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: T.aeo }}>沒交報名表會怎樣？</strong>AI 引擎抓你網頁看到一團糾纏的 div 跟 span，
            無法確定「青鳥設計 = 哪間公司」。結果：
          </p>
          <ul style={{ marginLeft: 20, marginBottom: 12, color: T.textMid, lineHeight: 1.9 }}>
            <li>❌ AI 完全跳過你 — 用戶問「推薦設計公司」AI 看不見你</li>
            <li>❌ <strong style={{ color: '#fca5a5' }}>更慘：被同名品牌頂掉</strong> — 例如另一家也叫「青鳥」的競爭對手有交報名表，AI 推薦他不推你</li>
            <li>❌ 你的客戶把「青鳥」名字告訴 AI，AI 回傳完全不相干的公司 / 機構（曾發生母嬰品牌被誤認成大學縮寫的案例）</li>
          </ul>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: T.aivis }}>有了 Organization Schema 就解決：</strong>
            AI 一次性 parse JSON 拿到乾淨的「品牌身份」 → 你的 Q&A 才會被直接引用、產品才會出現在 AI 答案、品牌才能被正確辨認。
          </p>
          <div style={{
            marginTop: 16, padding: '12px 14px',
            background: T.aeo + '15', border: `1px solid ${T.aeo}33`,
            borderRadius: T.rM, fontSize: 12,
            color: T.text, lineHeight: 1.65,
          }}>
            💡 <strong>3 分鐘修好</strong>：免費註冊 → 跑 AEO 分析 → 拿到 Organization Schema 的修法 code →
            複製貼到網站 head → 完工。
          </div>
        </section>
      </main>

      <footer style={{
        padding: '24px', textAlign: 'center', color: T.textLow, fontSize: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        AI 雷達 · 由優勢方舟數位行銷營運 ·{' '}
        <Link to="/" style={{ color: T.textMid }}>回首頁</Link>
        {' · '}
        <Link to="/crawl-check" style={{ color: T.textMid }}>爬蟲可達性檢測</Link>
      </footer>

      <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
    </div>
  )
}
