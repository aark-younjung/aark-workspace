import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import { GlassCard, IssueBoard, IssueBoardSkeleton, AuditTopBar, ScoreHero, HeroSkeleton, AEOSignature, OrgSchemaGenerator } from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const AEO_ACCENT = T.aeo
const AEO_ACCENT2 = '#6366f1'

const AEO_CHECKS = [
  {
    id: 'json_ld',
    name: 'JSON-LD 結構化資料',
    description: '驗證網頁是否含 Organization / WebSite 等基本 schema — 這是你交給 Google / AI 的「品牌報名表」。沒交 = AI 把你當「不存在的品牌」或跟同名競爭對手搞混（曾有母嬰品牌被誤認成大學縮寫的案例）',
    icon: '📋',
    priority: 'P1',
    recommendation: '使用 schema.org 標準添加 JSON-LD 標記，至少包含 WebSite 或 Organization schema',
  },
  {
    id: 'faq_schema',
    name: 'FAQ Schema',
    description: '檢測是否含有 FAQPage 或 QAPage 類型的結構化資料，直接影響 Google 精選摘要呈現',
    icon: '❓',
    priority: 'P1',
    recommendation: '為常見問題區塊添加 FAQPage schema，每個 Q&A 需包含 Question 和 Answer 節點',
  },
  {
    id: 'canonical',
    name: 'Canonical 標籤',
    description: '驗證 canonical 標籤是否正確設置，防止重複內容影響精選摘要排名',
    icon: '📌',  // 從 🔒 改成 📌 — 原本「鎖定」概念但跟 Pro lock icon 混淆，改用「釘住正確 URL」
    priority: 'P1',
    recommendation: '在所有頁面 <head> 設置正確的 <link rel="canonical" href="..."> 標籤',
  },
  {
    id: 'breadcrumbs',
    name: '麵包屑導航',
    description: '檢測 BreadcrumbList schema，幫助 Google 理解網站層級結構並在搜尋結果中顯示路徑',
    icon: '🍞',
    priority: 'P3',
    recommendation: '使用 schema.org BreadcrumbList 標記網站導航層級',
  },
  {
    id: 'open_graph',
    name: 'Open Graph',
    description: '驗證 Open Graph 標籤（og:title、og:description、og:image、og:url），影響 Google 搜尋預覽品質',
    icon: '🔗',
    priority: 'P2',
    recommendation: '添加完整的 og:title, og:description, og:image, og:url 四項標籤',
  },
  {
    id: 'question_headings',
    name: 'H2/H3 問句式標題',
    description: '檢測 H2/H3 標題是否以問句形式呈現，問答式內容更容易被 Google 選為精選摘要',
    icon: '💬',
    priority: 'P2',
    recommendation: '將部分 H2/H3 標題改為問句格式（例如「什麼是...？」「如何...？」）',
  },
  {
    id: 'meta_desc_length',
    name: 'Meta 描述長度',
    description: '檢測 Meta 描述是否在 120-160 字元範圍內，精簡描述更容易出現在 Google 精選摘要',
    icon: '📝',
    priority: 'P2',
    recommendation: '將 Meta 描述控制在 120-160 字元，簡潔說明頁面核心內容',
  },
  {
    id: 'structured_answer',
    name: '結構化答案段落',
    description: '檢測頁面是否包含清楚的問答格式內容（FAQ 區塊、問句段落、details/summary 元素）',
    icon: '📖',
    priority: 'P3',
    recommendation: '在頁面中加入 FAQ 區塊，或使用 Q&A 格式撰寫內容，首段直接給出答案',
  },
]

export default function AEOAudit() {
  const { id } = useParams()
  const { isPro } = useAuth()
  const [website, setWebsite] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)

      const { data: aeoData } = await supabase
        .from('aeo_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).single()
      setAeoAudit(aeoData)

      // 近 7 筆分數，給 ScoreHero 7 日趨勢迷你圖用
      const { data: recentData } = await supabase
        .from('aeo_audits').select('score, created_at').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(7)
      setRecentAudits(recentData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheckStatus = (checkId) => {
    if (!aeoAudit) return 'unknown'
    return aeoAudit[checkId] ? 'pass' : 'fail'
  }

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeAEO(website.url)
      await supabase.from('aeo_audits').insert([{
        website_id: id,
        score: result.score,
        json_ld: result.json_ld,
        faq_schema: result.faq_schema,
        faq_visual: result.faq_visual,   // 2026-05-25 新增：頁面有視覺 FAQ 但缺 schema → 修法引導
        canonical: result.canonical,
        breadcrumbs: result.breadcrumbs,
        open_graph: result.open_graph,
        question_headings: result.question_headings,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  const passedCount = AEO_CHECKS.filter(check => getCheckStatus(check.id) === 'pass').length
  const totalCount = AEO_CHECKS.length
  const score = Math.round((passedCount / totalCount) * 100)

  // 把 AEO_CHECKS 與 audit 結果合併成 IssueBoard 需要的形狀（passed + detail）
  // 特殊處理 faq_schema：若 faq_visual=true 但 faq_schema=false → 用更精準的 detail 訊息引導用戶補 schema
  // 這樣用戶看到「有 FAQ 但 AI 看不到」而非籠統的「缺 FAQ schema」
  const checks = AEO_CHECKS.map(c => {
    const passed = getCheckStatus(c.id) === 'pass'
    let detail = c.description
    if (c.id === 'faq_schema' && !passed && aeoAudit?.faq_visual) {
      detail = '⚠️ 偵測到你的頁面有 FAQ 區塊（標題或多個 Q/A 內容）但缺 FAQPage schema — 對「人類訪客」可見、但 ChatGPT / Claude / Perplexity 等 AI 引擎抓不到。請把 Q&A 包成 JSON-LD 結構化資料，AI 才能直接引用。'
    }
    return { ...c, passed, detail }
  })

  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <div className="flex items-center justify-center relative z-10" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.aeo }}></div>
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
            face="AEO"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={T.aeo}
            accent2={AEO_ACCENT2}
          />

          {/* 分數總覽 Hero（左 5：右 7 兩欄，與 SEO 同款） */}
          <div className="v2-hero-grid" style={{ marginBottom: 32 }}>
            <ScoreHero
              face="AEO"
              subChip="LLMO 訊號層 ②"
              tagline="Answer Engine Optimization — 讓 AI 把你當答案、引用你的內容（精選摘要、問答框、Siri / Google AI）"
              score={score}
              passedCount={passedCount}
              failedCount={totalCount - passedCount}
              total={totalCount}
              recentAudits={recentAudits}
              accent={T.aeo}
            />
            <div style={{
              background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
              borderRadius: T.rL, padding: 24,
            }}>
              <AEOSignature audit={aeoAudit} brandName={website?.name} />
            </div>
          </div>

          {/* 詳細檢測項目（看板式 IssueBoard）— 與 SEO 同款 */}
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
            <div style={{ fontSize: 12, color: T.textLow }}>依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟</div>
          </div>
          <div style={{ marginBottom: 32 }}>
            {!aeoAudit ? <IssueBoardSkeleton /> : <IssueBoard checks={checks} isPro={isPro} accent={AEO_ACCENT} accentGlow={`${AEO_ACCENT}28`} />}
          </div>

          {/* 個人化 Organization Schema 產生器 — Pro 限定（免費版顯示 upsell card）
              位置選擇：IssueBoard 後、/schema-check 微入口前 — 用戶看完「缺什麼 schema」立刻看到「我可以幫你生」
              對應 YouTube 影片教用戶用 ChatGPT 生 code 的痛點，我們直接做成永久儲存 + 一鍵複製的工具 */}
          <div style={{ marginBottom: 24 }}>
            <OrgSchemaGenerator />
          </div>

          {/* /schema-check 微入口 — 既有用戶 cross-link 到獨立 schema 健檢工具
              定位：AEO 8 項是「策展過的關鍵 schema」，/schema-check 是「完整 schema 全覽」 */}
          {website?.url && (
            <div style={{
              background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.cardBorder}`,
              borderRadius: T.rL, padding: '16px 20px', marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 22 }}>🔬</span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                  想看你網站上所有 Schema 一覽？
                </div>
                <div style={{ fontSize: 11, color: T.textLow, lineHeight: 1.5 }}>
                  AEO 這頁列出 8 項關鍵 schema；Schema 健檢工具會掃出你網站**所有** JSON-LD，列出 type / 來源 / 對 AI 引用的意義
                </div>
              </div>
              <Link to={`/schema-check?url=${encodeURIComponent(website.url)}`} style={{
                fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 6,
                background: T.aeo + '22', color: T.aeo,
                border: `1px solid ${T.aeo}55`, textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}>用 Schema 健檢工具 →</Link>
            </div>
          )}

          {/* AI 搜尋優化建議 */}
          <div className="mt-8">
            <GlassCard color={T.aeo} style={{ padding: 32 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold" style={{ color: T.text }}>🚀 AI 搜尋優化建議</h3>
                {!isPro && (
                  <span
                    className="text-sm px-2 py-1 rounded-full font-semibold"
                    style={{ background: T.orange + '26', color: '#fdba74' }}
                  >Pro 功能</span>
                )}
              </div>
              {isPro ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>補齊所有缺少的 Open Graph 標籤</li>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>建立網站的 LLMs.txt 檔案</li>
                      <li className="flex items-start gap-2"><span style={{ color: T.aeo }}>•</span>修復 canonical 標籤問題</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                    <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>建立完整的 JSON-LD 結構化資料</li>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>為常見問題頁面添加 FAQ Schema</li>
                      <li className="flex items-start gap-2"><span style={{ color: '#6366f1' }}>•</span>優化麵包屑導航結構</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm mb-4" style={{ color: T.textMid }}>升級 Pro 方案，取得根據你網站現況量身訂製的優化路線圖</p>
                  <Link
                    to="/pricing"
                    className="inline-block px-6 py-2.5 text-white text-sm font-semibold rounded-xl transition-all shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${T.aeo}, #6366f1)`,
                      boxShadow: `0 8px 24px ${T.aeo}40`,
                    }}
                  >
                    🔒 升級 Pro 解鎖完整建議
                  </Link>
                </div>
              )}
            </GlassCard>
          </div>
        </main>
      </div>
      <Footer dark />
    </PageBg>
  )
}

// 共用的暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 左上 155deg + 右下 335deg 雙漸層 + 雜訊）
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層光暈 — 從頁首左上往中央漸隱至純黑 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
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
