import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { useAuth } from '../context/AuthContext'
import { T } from '../styles/v2-tokens'
import { GlassCard, IssueBoard, IssueBoardSkeleton, AuditTopBar, ScoreHero } from '../components/v2'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'

const EEAT_ACCENT = T.eeat
const EEAT_ACCENT2 = T.orange

const EEAT_CHECKS = [
  {
    id: 'author_info',
    name: '作者資訊',
    description: '頁面是否有可識別的作者姓名或署名，Google 與 AI 透過作者資訊判斷內容的「經驗（Experience）」與「專業度（Expertise）」',
    icon: '✍️',
    priority: 'P1',
    recommendation: '在文章或頁面中加入作者姓名，可使用 <span itemprop="author"> 或 JSON-LD 的 "author" 欄位標記作者資訊',
  },
  {
    id: 'about_page',
    name: '關於我們頁面',
    description: '網站是否有「關於我們」頁面，幫助 Google 與 AI 了解網站背後的品牌或組織，強化「權威性（Authoritativeness）」',
    icon: '🏢',
    priority: 'P1',
    recommendation: '建立 /about 或 /about-us 頁面，說明公司背景、使命與核心服務，並在導航列加入連結',
  },
  {
    id: 'contact_page',
    name: '聯絡方式',
    description: '是否有聯絡頁面或可見的聯絡方式（email、電話），讓訪客和搜尋引擎確認網站是真實存在的機構',
    icon: '📞',
    priority: 'P1',
    recommendation: '建立 /contact 頁面，提供 email 或電話，或在頁尾加入 <a href="mailto:..."> 聯絡資訊',
  },
  {
    id: 'privacy_policy',
    name: '隱私權政策',
    description: '是否有隱私權政策頁面，是合規與信任的基本要求，影響「可信度（Trustworthiness）」評估',
    icon: '🔏',
    priority: 'P2',
    recommendation: '建立 /privacy-policy 頁面，說明資料收集與使用方式，並在頁尾加入連結',
  },
  {
    id: 'organization_schema',
    name: 'Organization Schema',
    description: '是否有 Organization 或 LocalBusiness 結構化資料，讓 Google 與 AI 明確識別網站的品牌身份與行業類別',
    icon: '🏷️',
    priority: 'P2',
    recommendation: '在 JSON-LD 中加入 Organization schema，包含 name、url、logo、contactPoint 等欄位',
  },
  {
    id: 'date_published',
    name: '內容發布日期',
    description: '是否標示文章或內容的發布/更新日期，讓 AI 評估內容的「新鮮度」與「時效性」，優先引用近期更新的內容',
    icon: '📅',
    priority: 'P2',
    recommendation: '在 JSON-LD 加入 datePublished 和 dateModified，或使用 <time datetime="..."> 標記發布時間',
  },
  {
    id: 'social_links',
    name: '社群媒體連結',
    description: '是否有連結到品牌的社群媒體帳號（Facebook、Instagram、LinkedIn 等），強化品牌的跨平台「權威性」',
    icon: '📱',
    priority: 'P3',
    recommendation: '在頁首或頁尾加入品牌的社群媒體連結，並確保各平台的品牌名稱一致',
  },
  {
    id: 'outbound_links',
    name: '外部權威連結',
    description: '是否有連結到外部可信來源（至少 2 個），引用外部資料可強化內容的「專業度」與「可信度」',
    icon: '🔗',
    priority: 'P3',
    recommendation: '在內容中引用並連結到官方資料、研究報告或知名媒體，使用 target="_blank" 開新分頁',
  },
]

export default function EEATAudit() {
  const { id } = useParams()
  const { isPro, user } = useAuth()
  const [website, setWebsite] = useState(null)
  const [eeatAudit, setEeatAudit] = useState(null)
  const [recentAudits, setRecentAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => { fetchData() }, [id])

  const fetchData = async () => {
    try {
      const { data: websiteData } = await supabase
        .from('websites').select('*').eq('id', id).single()
      setWebsite(websiteData)

      const { data: eeatData } = await supabase
        .from('eeat_audits').select('*').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      setEeatAudit(eeatData)

      // 近 7 筆分數，給 ScoreHero 7 日趨勢迷你圖用
      const { data: recentData } = await supabase
        .from('eeat_audits').select('score, created_at').eq('website_id', id)
        .order('created_at', { ascending: false }).limit(7)
      setRecentAudits(recentData || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheckStatus = (checkId) => {
    if (!eeatAudit) return 'unknown'
    return eeatAudit[checkId] ? 'pass' : 'fail'
  }

  const handleReanalyze = async () => {
    if (!website?.url || analyzing) return
    setAnalyzing(true)
    try {
      const result = await analyzeEEAT(website.url)
      await supabase.from('eeat_audits').insert([{
        website_id: id,
        score: result.score,
        author_info: result.author_info,
        about_page: result.about_page,
        contact_page: result.contact_page,
        privacy_policy: result.privacy_policy,
        organization_schema: result.organization_schema,
        date_published: result.date_published,
        social_links: result.social_links,
        outbound_links: result.outbound_links,
      }])
      fetchData()
    } catch (error) {
      console.error('Error:', error)
      alert('檢測失敗，請稍後再試')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleUpgrade = async () => {
    if (!user) {
      alert('請先登入再升級 Pro 方案')
      return
    }
    setUpgrading(true)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          returnUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || '建立付款頁面失敗，請稍後再試')
      }
    } catch {
      alert('連線失敗，請稍後再試')
    } finally {
      setUpgrading(false)
    }
  }

  // 把 EEAT_CHECKS 與 audit 結果合併成 IssueBoard 需要的形狀（passed + detail）
  const checks = EEAT_CHECKS.map(c => ({
    ...c,
    passed: getCheckStatus(c.id) === 'pass',
    detail: c.description,
  }))
  const passedCount = EEAT_CHECKS.filter(c => getCheckStatus(c.id) === 'pass').length
  const score = eeatAudit ? eeatAudit.score : Math.round((passedCount / EEAT_CHECKS.length) * 100)

  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <div className="flex items-center justify-center relative z-10" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: T.eeat }}></div>
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
            face="E-E-A-T"
            websiteUrl={website?.url}
            onReanalyze={handleReanalyze}
            analyzing={analyzing}
            accent={T.eeat}
            accent2={T.orange}
          />

          {/* 分數總覽 Hero（與 SEO 同款，單欄） */}
          <div style={{ marginBottom: 32 }}>
            <ScoreHero
              face="E-E-A-T"
              subChip="可信度檢測"
              tagline="Experience · Expertise · Authoritativeness · Trustworthiness — Google 評估網站可信度的四維度"
              score={score}
              passedCount={passedCount}
              failedCount={EEAT_CHECKS.length - passedCount}
              total={EEAT_CHECKS.length}
              recentAudits={recentAudits}
              accent={T.eeat}
            />
          </div>

          {/* E-E-A-T 四個維度說明 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Experience', desc: '內容來自真實經驗', icon: '🌟' },
              { label: 'Expertise', desc: '具備專業知識', icon: '🎓' },
              { label: 'Authoritativeness', desc: '在領域中具權威', icon: '🏆' },
              { label: 'Trustworthiness', desc: '網站安全且可信', icon: '🛡️' },
            ].map(({ label, desc, icon }) => (
              <GlassCard key={label} style={{ padding: 16, textAlign: 'center' }}>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-semibold" style={{ color: T.text }}>{label}</div>
                <div className="text-xs mt-1" style={{ color: T.textMid }}>{desc}</div>
              </GlassCard>
            ))}
          </div>

          {/* 詳細檢測項目（看板式 IssueBoard）— 與 SEO 同款 */}
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 4 }}>詳細檢測項目</h2>
            <div style={{ fontSize: 12, color: T.textLow }}>依優先度分組：立即修復 / 本月內 / 季度規劃 / 已通過。點任一卡可展開修復步驟</div>
          </div>
          <div style={{ marginBottom: 32 }}>
            {!eeatAudit ? <IssueBoardSkeleton /> : <IssueBoard checks={checks} isPro={isPro} accent={EEAT_ACCENT} accentGlow={`${EEAT_ACCENT}28`} />}
          </div>

          {/* 優化行動計畫（付費功能） */}
          <div className="mt-8">
            <GlassCard color={T.eeat} style={{ overflow: 'hidden' }}>
              {/* 標題列 — eeat→orange 漸層 */}
              <div
                className="px-8 py-5 flex items-center justify-between"
                style={{ background: `linear-gradient(90deg, ${T.eeat}, ${T.orange})` }}
              >
                <div>
                  <h3 className="text-lg font-bold text-white">🛡️ E-E-A-T 優化行動計畫</h3>
                  <p className="text-white/80 text-sm mt-1">依影響力排序的具體修復步驟與時程規劃</p>
                </div>
                {!isPro && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-semibold border border-white/30 backdrop-blur-sm">
                    🔒 Pro 功能
                  </span>
                )}
              </div>

              {isPro ? (
                <div className="p-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                      <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                        <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>建立或更新「關於我們」與「聯絡我們」頁面</li>
                        <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>在頁尾加入隱私權政策連結</li>
                        <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>在頁尾加入品牌社群媒體連結</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                      <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                        <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>加入 Organization JSON-LD 結構化資料</li>
                        <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>在每篇文章標示作者與發布日期</li>
                        <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>內容中引用並連結外部權威來源</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* 模糊預覽 */}
                  <div className="p-8 blur-sm select-none pointer-events-none">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-3" style={{ color: T.text }}>短期目標 (1-2週)</h4>
                        <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                          <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>建立或更新「關於我們」與「聯絡我們」頁面</li>
                          <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>在頁尾加入隱私權政策連結</li>
                          <li className="flex items-start gap-2"><span style={{ color: T.eeat }}>•</span>在頁尾加入品牌社群媒體連結</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-3" style={{ color: T.text }}>中期目標 (1-3月)</h4>
                        <ul className="space-y-2 text-sm" style={{ color: T.textMid }}>
                          <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>加入 Organization JSON-LD 結構化資料</li>
                          <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>在每篇文章標示作者與發布日期</li>
                          <li className="flex items-start gap-2"><span style={{ color: T.orange }}>•</span>內容中引用並連結外部權威來源</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  {/* 升級 CTA 覆蓋層 */}
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div
                      className="text-center rounded-2xl px-10 py-8 max-w-sm mx-4 backdrop-blur-xl"
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        border: `1px solid ${T.eeat}55`,
                        boxShadow: `0 8px 36px ${T.eeat}26`,
                      }}
                    >
                      <div className="text-4xl mb-3">🔒</div>
                      <h4 className="text-lg font-bold mb-2" style={{ color: T.text }}>升級 Pro 解鎖完整建議</h4>
                      <p className="text-sm mb-5" style={{ color: T.textMid }}>包含優先順序排序、具體修復步驟、時程規劃，以及每月自動掃描通知</p>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgrading}
                        className="w-full px-6 py-3 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          background: `linear-gradient(135deg, ${T.eeat}, ${T.orange})`,
                          boxShadow: `0 8px 24px ${T.eeat}40`,
                        }}
                      >
                        {upgrading ? '跳轉中...' : '升級 Pro 方案 →'}
                      </button>
                      <p className="text-xs mt-3" style={{ color: T.textLow }}>NT$1,490 / 月 · 隨時取消</p>
                    </div>
                  </div>
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

// 共用的暗色背景 wrapper（與首頁 HomeDark 同款：黑底 + 上方青綠漸層光暈 + 雜訊）
// 註：頁面高度通常不及首頁，下方漸層會壓到上半部反而互蓋，故捨棄只保留上方
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}
