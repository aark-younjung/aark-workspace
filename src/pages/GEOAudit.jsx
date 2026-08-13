import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeGEO } from '../services/geoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import { GlassCard, IssueBoard, IssueBoardSkeleton, AuditTopBar, ScoreHero, GEOSignature } from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import CacheFreshnessNote from '../components/CacheFreshnessNote'

const GEO_ACCENT = T.geo
const GEO_ACCENT2 = '#14b8a6'

const GEO_CHECKS = [
  {
    id: 'llms_txt',
    name: 'llms.txt',
    description: '網站根目錄是否有 /llms.txt 檔案，讓 ChatGPT、Claude、Perplexity 等 AI 工具能識別你的品牌與服務內容',
    icon: '🤖',
    priority: 'P1',
    recommendation: '在根目錄建立 /llms.txt，用自然語言描述你的品牌、服務與聯絡方式',
  },
  {
    id: 'robots_ai',
    name: 'AI 爬蟲開放性',
    description: '檢測 robots.txt 是否封鎖 GPTBot、PerplexityBot、Google-Extended 等主要 AI 爬蟲',
    icon: '🚦',
    priority: 'P1',
    recommendation: '確認 robots.txt 沒有 Disallow GPTBot 或 Google-Extended，允許 AI 爬蟲索引你的內容',
  },
  {
    id: 'sitemap',
    name: 'Sitemap.xml',
    description: '網站根目錄是否有 /sitemap.xml，幫助 AI 爬蟲發現並索引你的所有頁面',
    icon: '🗺️',
    priority: 'P2',
    recommendation: '建立並提交 sitemap.xml，確保所有重要頁面都被 AI 爬蟲發現',
  },
  {
    id: 'open_graph',
    name: 'Open Graph',
    description: '是否有完整的 og:title、og:description、og:image、og:url 標籤，AI 引用時作為內容摘要依據',
    icon: '🔗',
    priority: 'P2',
    recommendation: '為每個頁面添加完整的 Open Graph 標籤，讓 AI 引用時能呈現正確的標題與描述',
  },
  {
    id: 'twitter_card',
    name: 'Twitter Card',
    description: '是否有 twitter:card、twitter:title、twitter:image 標籤，強化 AI 摘要中的社群信號',
    icon: '🐦',
    priority: 'P3',
    recommendation: '添加 Twitter Card 標籤（twitter:card, twitter:title, twitter:image）',
  },
  {
    id: 'json_ld_citation',
    name: 'JSON-LD 引用信號',
    description: '結構化資料中是否包含 author、publisher、datePublished 等可信度資訊，讓 AI 判斷內容可信度',
    icon: '📜',
    priority: 'P2',
    recommendation: '在 JSON-LD 中加入 author（作者）、publisher（出版者）、datePublished（發布日期）',
  },
  {
    id: 'canonical',
    name: 'Canonical 標籤',
    description: '是否有 canonical 標籤，告訴 AI 正確的引用來源 URL，避免引用到重複頁面',
    icon: '🔒',
    priority: 'P1',
    recommendation: '在每個頁面 <head> 設置 <link rel="canonical" href="...">，確保 AI 引用正確 URL',
  },
  {
    id: 'https',
    name: 'HTTPS 安全連線',
    description: '網站是否使用 HTTPS，AI 傾向引用安全可信的來源',
    icon: '🔐',
    priority: 'P1',
    recommendation: '確保網站使用 HTTPS，向 AI 傳遞「此網站安全可信」的信號',
  },
  // P3 LLMO 深化（2026-06-05）— content freshness 訊號
  // LLM 在 retrieve / cite 時偏好「新鮮」內容（dateModified ≤ 365 天）
  // 暫不計入主分數、待 SQL ADD COLUMN lastmod_passed 後再升級為計分項
  {
    id: 'lastmod_passed',
    name: '內容新鮮度（lastmod）',
    description: '頁面是否標記最後修改時間 article:modified_time / dateModified / <time>，且距今 ≤ 365 天。LLM 引擎引用時優先選擇新鮮內容',
    icon: '🕒',
    priority: 'P1',
    recommendation: '用 Yoast / Rank Math 自動輸出 article:modified_time，或在 JSON-LD 加 dateModified。長期沒更新的頁面建議定期翻新內文（補新案例 / 新數據 / 新年度），LLM 比較願意引用',
    isNewSignal: true, // 標記為「新增訊號、暫不計分」
  },
]

export default function GEOAudit() {
  const { id } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)

      const { data: geoData } = await supabase
        .from('geo_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setGeoAudit(geoData)

      // 近 7 筆分數，給 ScoreHero 7 日趨勢迷你圖用
      const { data: recentData } = await supabase
        .from('geo_audits').select('score, created_at').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(7)
      setRecentAudits(recentData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheckStatus = (checkId) => {
    if (!geoAudit) return 'unknown'
    return geoAudit[checkId] ? 'pass' : 'fail'
  }

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeGEO(website.url)
      await supabase.from('geo_audits').insert([{
        website_id: id,
        score: result.score,
        llms_txt: result.llms_txt,
        robots_ai: result.robots_ai,
        sitemap: result.sitemap,
        open_graph: result.open_graph,
        twitter_card: result.twitter_card,
        json_ld_citation: result.json_ld_citation,
        canonical: result.canonical,
        https: result.https,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  // 分數計算：isNewSignal 標記的訊號暫不計入分母（lastmod 等新訊號、待 schema migration 後再升級）
  const scoredChecks = GEO_CHECKS.filter(c => !c.isNewSignal)
  const passedCount = scoredChecks.filter(check => getCheckStatus(check.id) === 'pass').length
  const totalCount = scoredChecks.length
  const score = geoAudit ? geoAudit.score : Math.round((passedCount / totalCount) * 100)

  // 把 GEO_CHECKS 與 audit 結果合併成 IssueBoard 需要的形狀（passed + detail）
  const checks = GEO_CHECKS.map(c => ({
    ...c,
    passed: getCheckStatus(c.id) === 'pass',
    detail: c.description,
  }))

  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <div className="flex items-center justify-center relative z-10" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.geo }}></div>
            <p style={{ color: T.textMid }}>載入資料中...</p>
          </div>
        </div>
        <Footer dark />
      </PageBg>
    )
  }

  return (
    <PageBg>
      <SiteHeader />
      <div className="relative z-10">
        <main style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 24px 64px', fontFamily: T.font }}>
          {/* 頂部麵包屑列：返回 Dashboard + 重新檢測 + 匯出 PDF（與 SEO 同款） */}
          <AuditTopBar
            websiteId={id}
            face="GEO"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={T.geo}
            accent2={GEO_ACCENT2}
          />

          {/* 快取新鮮度提示：頁面由快取外掛供應且 ≥1 小時，提醒「剛改過請先清快取再掃」 */}
          <CacheFreshnessNote pageUrl={website?.url} dark />

          {/* 分數總覽 Hero（左 5：右 7 兩欄，與 SEO 同款） */}
          <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
            <ScoreHero
              face="GEO"
              subChip="LLMO 訊號層 ③"
              tagline="Generative Engine Optimization — 讓 ChatGPT、Perplexity、Gemini 在長篇回答中推薦你（LLMO 重疊度最高的一層）"
              score={score}
              passedCount={passedCount}
              failedCount={totalCount - passedCount}
              total={totalCount}
              recentAudits={recentAudits}
              accent={T.geo}
            />
            <div style={{
              background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
              borderRadius: T.rL, padding: 24,
            }}>
              <GEOSignature audit={geoAudit} isPro={isPro} />
            </div>
          </div>

          {/* 詳細檢測項目（看板式 IssueBoard）— 與 SEO 同款 */}
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
            <div style={{ fontSize: 14, color: T.textLow }}>依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟</div>
          </div>
          <div style={{ marginBottom: 32 }}>
            {!geoAudit ? <IssueBoardSkeleton /> : <IssueBoard checks={checks} isPro={isPro} accent={GEO_ACCENT} accentGlow={`${GEO_ACCENT}28`} />}
          </div>

          {/* llms.txt 自動生成 + 代管 — 對標 washinmura.jp，免費功能不 Pro-gate */}
          <div style={{ marginBottom: 32 }}>
            <LlmsTxtSection websiteId={id} websiteUrl={website?.url} />
          </div>

          {/* 爬蟲訪問日誌 — 顯示誰來讀過你的代管 llms.txt（對標 washinmura wow factor） */}
          <div style={{ marginBottom: 32 }}>
            <CrawlerVisitsSection websiteId={id} />
          </div>

          {/* 生成式 AI 優化建議 */}
          <div className="mt-8">
            <GlassCard color={T.geo} style={{ padding: 32 }}>
              <h3 className="text-xl font-bold mb-4" style={{ color: T.text }}>🤖 提升 AI 引用率的建議</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                  <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>建立 /llms.txt 描述品牌與服務內容</li>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>確認 robots.txt 未封鎖主要 AI 爬蟲</li>
                    <li className="flex items-start gap-2"><span style={{ color: T.geo }}>•</span>補齊 Open Graph 與 Twitter Card 標籤</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                  <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>在 JSON-LD 中加入 author、publisher、datePublished</li>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>建立並提交完整的 sitemap.xml</li>
                    <li className="flex items-start gap-2"><span style={{ color: '#14b8a6' }}>•</span>確保所有頁面有正確的 canonical 標籤</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          </div>
        </main>
      </div>
      <Footer dark />
    </PageBg>
  )
}

/**
 * llms.txt 自動生成 + 代管區塊 — 對標 washinmura.jp 的免費代管功能
 *
 * 用戶看到的價值：
 *   1. 我們已根據你的網站資料自動生成 llms.txt 標準格式
 *   2. 預覽完整內容
 *   3. 兩種接到自己網站的方式：
 *      (a) 下載 .txt 檔，上傳到網站 root（最簡單）
 *      (b) 在 robots.txt 加 LLM-Sitemap 指向我們代管 URL（不用改網站）
 */
export function LlmsTxtSection({ websiteId, websiteUrl }) {   // 2026-08-14 導出：AppHealth GEO 分頁沿用（轉址後工具不失所）
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)   // 'url' | 'content' | null
  // 驗證用戶網站 root 的 llms.txt 是否真的上傳成功 — 避免「以為上傳了但其實 404」的踩坑
  // status: 'idle' | 'checking' | 'live' | 'not_found' | 'invalid' | 'error'
  const [verify, setVerify] = useState({ status: 'idle', detail: '' })
  // 對外 URL：合併到 /api/public?action=llms&id=... 是因為 Vercel Hobby 12 function 上限
  // 用戶 robots.txt LLM-Sitemap 指向這個 URL 完全可以，AI bot 會跟著走
  const hostedUrl = `${window.location.origin}/api/public?action=llms&id=${websiteId}`

  useEffect(() => {
    let cancelled = false
    // X-AARK-Internal header 讓 endpoint 跳過 visit log（避免 preview 污染統計）
    fetch(`/api/public?action=llms&id=${websiteId}`, { headers: { 'X-AARK-Internal': 'true' } })
      .then(r => r.text())
      .then(text => { if (!cancelled) { setContent(text); setLoading(false) } })
      .catch(() => { if (!cancelled) { setContent('生成失敗，請重整頁面再試'); setLoading(false) } })
    return () => { cancelled = true }
  }, [websiteId])

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1800)
    })
  }

  // 驗證用戶網站 root 的 /llms.txt 真實 HTTP 狀態 — 透過 /api/fetch-url 走後端避免 CORS
  // 規則：success + content.length > 30 + 像 llms.txt 格式（含 # heading 或 > blockquote）才算 live
  // 中間態看似 200 但 content 是 HTML 的 builder 404 頁、或全空 body 都會被擋掉
  async function handleVerify() {
    if (!websiteUrl) {
      setVerify({ status: 'error', detail: '無法取得網站 URL' })
      return
    }
    setVerify({ status: 'checking', detail: '' })
    try {
      const targetUrl = websiteUrl.replace(/\/$/, '') + '/llms.txt'
      const r = await fetch(`/api/fetch-url?url=${encodeURIComponent(targetUrl)}`)
      const data = await r.json()
      if (!data.success) {
        // fetch-url 自己 wrap 過 error，可能是 HTTP 404 或其他
        setVerify({
          status: 'not_found',
          detail: data.error === 'HTTP 404' || data.status === 404
            ? '檔案不存在（HTTP 404）— 上傳失敗或路徑錯了'
            : `${data.error || '抓取失敗'}${data.hint ? '：' + data.hint : ''}`,
        })
        return
      }
      const body = data.content || ''
      // 偵測 builder 攔截：用戶 builder 的 404 頁通常是完整 HTML、開頭含 <!DOCTYPE 或 <html
      const looksLikeHtml = /^\s*<(?:!doctype|html)/i.test(body)
      const looksLikeLlms = /^#\s/m.test(body) || /^>\s/m.test(body) || /^User-agent:/im.test(body)
      if (body.length < 30) {
        setVerify({ status: 'invalid', detail: `檔案存在但內容太短（${body.length} bytes）— 可能上傳了空檔` })
      } else if (looksLikeHtml) {
        setVerify({ status: 'invalid', detail: '檔案存在但內容是 HTML — 你的 builder 把 /llms.txt 路徑指向錯頁（builder 404 攔截）' })
      } else if (!looksLikeLlms) {
        setVerify({ status: 'invalid', detail: '檔案存在但不像 llms.txt 標準格式（缺 # 標題 / > 描述）— 可能上傳錯檔' })
      } else {
        setVerify({ status: 'live', detail: `✅ HTTP 200 · ${body.length} bytes · 格式正確` })
      }
    } catch (err) {
      setVerify({ status: 'error', detail: err.message || '驗證失敗，請重試' })
    }
  }

  function downloadFile() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'llms.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <GlassCard color={T.geo} style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>📄</span>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
          llms.txt 自動生成（已根據你的最新檢測資料）
        </h3>
        <span style={{
          fontSize: 14, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
          background: T.geo + '26', color: T.geo, border: `1px solid ${T.geo}55`,
        }}>免費功能</span>
      </div>
      <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginBottom: 16 }}>
        我們已自動生成符合 <a href="https://llmstxt.org/" target="_blank" rel="noopener noreferrer" style={{ color: T.geo, textDecoration: 'underline' }}>llmstxt.org 標準</a> 的 llms.txt 給你 — 這份檔案告訴 ChatGPT、Claude、Perplexity 等 AI 引擎你的網站結構、歡迎哪些 AI 爬蟲、可引用內容在哪。下方有兩種接到你網站的方式。
      </p>

      {/* 代管 URL + 複製按鈕 */}
      <div style={{
        background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.cardBorder}`,
        borderRadius: T.rM, padding: '10px 14px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 14, color: T.textLow, letterSpacing: '.05em' }}>代管 URL</span>
        <code style={{
          flex: 1, minWidth: 200, fontSize: 14, fontFamily: T.mono, color: T.text,
          overflow: 'auto', whiteSpace: 'nowrap',
        }}>{hostedUrl}</code>
        <button
          type="button"
          onClick={() => copyToClipboard(hostedUrl, 'url')}
          style={{
            fontSize: 14, fontWeight: 600, padding: '5px 12px', borderRadius: 5,
            background: copied === 'url' ? T.pass + '33' : 'rgba(255,255,255,0.05)',
            color: copied === 'url' ? T.pass : T.text,
            border: `1px solid ${copied === 'url' ? T.pass + '55' : T.cardBorder}`,
            cursor: 'pointer', fontFamily: T.font,
          }}
        >{copied === 'url' ? '✓ 已複製' : '複製連結'}</button>
      </div>

      {/* 預覽區 — 顯示生成出來的 llms.txt 內容 */}
      <div style={{
        background: 'rgba(0,0,0,0.55)', border: `1px solid ${T.cardBorder}`,
        borderRadius: T.rM, padding: 14, marginBottom: 14,
        maxHeight: 280, overflow: 'auto',
      }}>
        <pre style={{
          margin: 0, fontSize: 14, lineHeight: 1.65,
          color: T.textMid, fontFamily: T.mono, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{loading ? '載入中...' : content}</pre>
      </div>

      {/* 動作按鈕 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          onClick={downloadFile}
          disabled={loading || !content}
          style={{
            fontSize: 14, fontWeight: 700, padding: '10px 18px', borderRadius: T.rM,
            background: `linear-gradient(135deg, ${T.geo}, #14b8a6)`,
            color: 'white', border: 'none', cursor: 'pointer', fontFamily: T.font,
            opacity: loading ? 0.5 : 1,
          }}
        >⬇ 下載 llms.txt</button>
        <button
          type="button"
          onClick={() => copyToClipboard(content, 'content')}
          disabled={loading || !content}
          style={{
            fontSize: 14, fontWeight: 600, padding: '10px 18px', borderRadius: T.rM,
            background: copied === 'content' ? T.pass + '22' : 'rgba(255,255,255,0.05)',
            color: copied === 'content' ? T.pass : T.text,
            border: `1px solid ${copied === 'content' ? T.pass + '55' : T.cardBorder}`,
            cursor: 'pointer', fontFamily: T.font,
            opacity: loading ? 0.5 : 1,
          }}
        >{copied === 'content' ? '✓ 已複製內容' : '複製內容'}</button>
        {/* 驗證 llms.txt 是否真的活著 — 避免用戶踩「以為上傳成功但 builder 404」的坑（soileng 案例）*/}
        <button
          type="button"
          onClick={handleVerify}
          disabled={verify.status === 'checking' || !websiteUrl}
          style={{
            fontSize: 14, fontWeight: 600, padding: '10px 18px', borderRadius: T.rM,
            background: 'rgba(255,255,255,0.05)',
            color: T.text,
            border: `1px solid ${T.cardBorder}`,
            cursor: verify.status === 'checking' ? 'wait' : 'pointer',
            fontFamily: T.font,
          }}
          title="實際打你網站 root 的 /llms.txt 看真實 HTTP 狀態"
        >
          {verify.status === 'checking' ? '🔍 驗證中…' : '🔍 驗證上傳是否成功'}
        </button>
      </div>

      {/* 驗證結果 banner — 依 status 不同色 + 不同 icon */}
      {verify.status !== 'idle' && verify.status !== 'checking' && (
        <div style={{
          marginBottom: 18, padding: '12px 14px', borderRadius: T.rM,
          fontSize: 14, lineHeight: 1.6,
          background: verify.status === 'live'
            ? `${T.pass}15`
            : verify.status === 'invalid' || verify.status === 'not_found'
            ? `${T.warn}15`
            : `${T.fail}15`,
          border: `1px solid ${
            verify.status === 'live'
              ? T.pass + '55'
              : verify.status === 'invalid' || verify.status === 'not_found'
              ? T.warn + '55'
              : T.fail + '55'
          }`,
          color: T.text,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {verify.status === 'live' && <>🟢 llms.txt 已成功上線</>}
            {verify.status === 'not_found' && <>🟡 llms.txt 不存在</>}
            {verify.status === 'invalid' && <>🟡 llms.txt 存在但內容有問題</>}
            {verify.status === 'error' && <>🔴 驗證時發生錯誤</>}
          </div>
          <div style={{ color: T.textMid }}>
            檢測 URL：<code style={{ fontFamily: T.mono, fontSize: 14 }}>{websiteUrl?.replace(/\/$/, '')}/llms.txt</code>
          </div>
          <div style={{ color: T.textMid, marginTop: 4 }}>{verify.detail}</div>
          {(verify.status === 'not_found' || verify.status === 'invalid') && (
            <div style={{ color: T.textLow, marginTop: 8, fontStyle: 'italic' }}>
              💡 替代方案：在你網站的 robots.txt 加 <code style={{ fontFamily: T.mono }}>LLM-Sitemap: {hostedUrl}</code>，不用改 root 檔案就能讓 AI 爬蟲讀到。
            </div>
          )}
        </div>
      )}

      {/* 怎麼接到網站的兩種方式 */}
      <details style={{ fontSize: 14, color: T.textMid, lineHeight: 1.75 }}>
        <summary style={{ cursor: 'pointer', color: T.text, fontWeight: 600, marginBottom: 8 }}>
          ▶ 怎麼把這個 llms.txt 接到我的網站？
        </summary>
        <div style={{ paddingLeft: 16, paddingTop: 8 }}>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: T.text }}>方法 1：下載 → 上傳到網站 root（推薦，標準做法）</strong><br />
            按上方「⬇ 下載 llms.txt」拿到檔案，透過 FTP / cPanel / WP-FTP 等工具上傳到你網站根目錄。完成後訪客和爬蟲都能透過 <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 6px', borderRadius: 3, fontFamily: T.mono, fontSize: 14 }}>你的網域/llms.txt</code> 存取。
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong style={{ color: T.text }}>方法 2：在 robots.txt 加 LLM-Sitemap 指向（不用改網站內容）</strong><br />
            在你網站的 robots.txt 加一行：
          </p>
          <pre style={{
            margin: '0 0 12px 0', padding: 10, fontSize: 14, lineHeight: 1.5,
            background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.cardBorder}`,
            borderRadius: 6, color: '#cbd5e1', fontFamily: T.mono, overflow: 'auto',
          }}>{`LLM-Sitemap: ${hostedUrl}`}</pre>
          <p style={{ marginBottom: 12 }}>
            這是 emerging convention — 越來越多 AI 工具會讀 robots.txt 的這欄找 llms.txt。優點：不用改你網站內容，連結指向我們代管的 URL，未來 audit 跑新版自動跟進更新。
          </p>
          <p style={{ color: T.textLow, fontSize: 14, paddingTop: 8, borderTop: `1px solid ${T.cardBorder}` }}>
            💡 兩種方式可以並行 — 方法 1 確保 LLM 直接讀到，方法 2 是備援 + 自動更新。每次你在 AI 雷達重跑 audit，這份 llms.txt 都會自動帶入最新資料。
          </p>
        </div>
      </details>
    </GlassCard>
  )
}

/**
 * 爬蟲訪問日誌區塊 — 顯示誰來讀過代管 llms.txt
 *
 * 60 秒自動 refresh（對標 washinmura.jp 的「live tracker」體驗）
 * AI bot visit 用彩色 chip + bot name，一般訪問淡灰
 *
 * 限制（要對用戶誠實）：
 *   - 只記「對代管 llms.txt 的訪問」，不是用戶網站本身
 *   - 多數 AI bot 不會主動讀 llms.txt，要等用戶把 LLM-Sitemap 寫進 robots.txt
 *     或下載放網站 root 才會被 AI 引擎發現
 */
function CrawlerVisitsSection({ websiteId }) {
  const [visits, setVisits] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchVisits() {
      try {
        // RLS 確保只有 owner / admin 能讀
        const { data } = await supabase
          .from('crawler_visits')
          .select('id, user_agent, is_ai_bot, bot_name, source, created_at')
          .eq('website_id', websiteId)
          .order('created_at', { ascending: false })
          .limit(30)
        if (!cancelled) {
          setVisits(data || [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) { setVisits([]); setLoading(false) }
      }
    }
    fetchVisits()
    // 60 秒 polling — 對標 washinmura「live tracker」體驗
    const t = setInterval(fetchVisits, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [websiteId])

  const aiBotCount = (visits || []).filter(v => v.is_ai_bot).length
  const totalCount = (visits || []).length
  // 過去 24 小時 AI bot 訪問
  const now = Date.now()
  const last24hAiBot = (visits || []).filter(v => v.is_ai_bot && (now - new Date(v.created_at).getTime()) < 86400000).length

  return (
    <GlassCard color={T.geo} style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }}>📡</span>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text }}>
          AI 爬蟲訪問日誌
        </h3>
        <span style={{
          fontSize: 14, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
          background: T.geo + '26', color: T.geo, border: `1px solid ${T.geo}55`,
        }}>每 60 秒更新</span>
      </div>
      <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginBottom: 16 }}>
        顯示誰來讀過你的代管 llms.txt。AI 引擎（GPTBot / ClaudeBot / PerplexityBot 等）會自動標彩色 chip。
        {totalCount === 0 && (
          <><br /><strong style={{ color: T.warn }}>目前還沒有訪問紀錄</strong> — 把 llms.txt 接到你網站（用上方教學「方法 2」最快），AI 引擎下次來爬就會被記錄。</>
        )}
      </p>

      {/* KPI chips */}
      {totalCount > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <KPIChip label="總訪問次數" value={totalCount} color={T.textMid} />
          <KPIChip label="AI 爬蟲訪問" value={aiBotCount} color={T.geo} />
          <KPIChip label="24 小時內 AI 訪問" value={last24hAiBot} color={T.pass} />
        </div>
      )}

      {/* Visit timeline */}
      {loading ? (
        <p style={{ fontSize: 14, color: T.textLow }}>載入中...</p>
      ) : visits && visits.length > 0 ? (
        <div style={{
          background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.cardBorder}`,
          borderRadius: T.rM, maxHeight: 320, overflow: 'auto',
        }}>
          {visits.map(v => (
            <div key={v.id} style={{
              padding: '10px 14px', borderBottom: `1px solid ${T.cardBorder}`,
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 14, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                background: v.is_ai_bot ? T.geo + '26' : 'rgba(255,255,255,0.05)',
                color: v.is_ai_bot ? T.geo : T.textLow,
                border: `1px solid ${v.is_ai_bot ? T.geo + '55' : T.cardBorder}`,
                fontFamily: T.mono,
              }}>
                {v.is_ai_bot ? '🤖 AI BOT' : '👤 OTHER'}
              </span>
              {v.is_ai_bot && (
                <span style={{ fontSize: 14, color: T.text, fontWeight: 600 }}>
                  {v.bot_name}
                </span>
              )}
              <span style={{
                fontSize: 14, color: T.textLow, fontFamily: T.mono,
                flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={v.user_agent}>
                {v.user_agent || '(no user agent)'}
              </span>
              <span style={{ fontSize: 14, color: T.textLow, fontFamily: T.mono }}>
                {formatRelativeTime(v.created_at)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: 28, textAlign: 'center', fontSize: 14, color: T.textLow,
          background: 'rgba(0,0,0,0.4)', border: `1px dashed ${T.cardBorder}`,
          borderRadius: T.rM,
        }}>
          📭 還沒有任何爬蟲訪問紀錄
        </div>
      )}

      <p style={{ fontSize: 14, color: T.textLow, lineHeight: 1.6, marginTop: 12, fontStyle: 'italic' }}>
        ⓘ 此日誌只記錄對「我們代管的 llms.txt」的訪問。要追蹤對你整個網站的訪問，需要在伺服器端裝 log forwarder（Pro 功能規劃中）。
      </p>
    </GlassCard>
  )
}

function KPIChip({ label, value, color }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: T.rM,
      background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`,
      display: 'flex', alignItems: 'baseline', gap: 8,
    }}>
      <span style={{ fontSize: 14, color: T.textMid }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: T.font }}>{value}</span>
    </div>
  )
}

function formatRelativeTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return `${Math.floor(diff)} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  return `${Math.floor(diff / 86400)} 天前`
}

// 共用的暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 左上 155deg + 右下 335deg 雙漸層 + 雜訊）
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層光暈 — 從頁首左上往中央漸隱至純黑 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'var(--t-bg, linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%))',
        mixBlendMode: 'lighten',
      }} />
      {/* 下方青綠漸層光暈 — 從頁尾右下往左上擴散（335deg = 155deg 雙軸鏡像） */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒感疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
