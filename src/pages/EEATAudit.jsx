import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { analyzeEEAT } from '../services/eeatAnalyzer'

const EEAT_CHECKS = [
  {
    id: 'author_info',
    name: '作者資訊',
    description: '頁面是否有可識別的作者姓名或署名，Google 與 AI 透過作者資訊判斷內容的「經驗（Experience）」與「專業度（Expertise）」',
    icon: '✍️',
    recommendation: '在文章或頁面中加入作者姓名，可使用 <span itemprop="author"> 或 JSON-LD 的 "author" 欄位標記作者資訊'
  },
  {
    id: 'about_page',
    name: '關於我們頁面',
    description: '網站是否有「關於我們」頁面，幫助 Google 與 AI 了解網站背後的品牌或組織，強化「權威性（Authoritativeness）」',
    icon: '🏢',
    recommendation: '建立 /about 或 /about-us 頁面，說明公司背景、使命與核心服務，並在導航列加入連結'
  },
  {
    id: 'contact_page',
    name: '聯絡方式',
    description: '是否有聯絡頁面或可見的聯絡方式（email、電話），讓訪客和搜尋引擎確認網站是真實存在的機構',
    icon: '📞',
    recommendation: '建立 /contact 頁面，提供 email 或電話，或在頁尾加入 <a href="mailto:..."> 聯絡資訊'
  },
  {
    id: 'privacy_policy',
    name: '隱私權政策',
    description: '是否有隱私權政策頁面，是合規與信任的基本要求，影響「可信度（Trustworthiness）」評估',
    icon: '🔏',
    recommendation: '建立 /privacy-policy 頁面，說明資料收集與使用方式，並在頁尾加入連結'
  },
  {
    id: 'organization_schema',
    name: 'Organization Schema',
    description: '是否有 Organization 或 LocalBusiness 結構化資料，讓 Google 與 AI 明確識別網站的品牌身份與行業類別',
    icon: '🏷️',
    recommendation: '在 JSON-LD 中加入 Organization schema，包含 name、url、logo、contactPoint 等欄位'
  },
  {
    id: 'date_published',
    name: '內容發布日期',
    description: '是否標示文章或內容的發布/更新日期，讓 AI 評估內容的「新鮮度」與「時效性」，優先引用近期更新的內容',
    icon: '📅',
    recommendation: '在 JSON-LD 加入 datePublished 和 dateModified，或使用 <time datetime="..."> 標記發布時間'
  },
  {
    id: 'social_links',
    name: '社群媒體連結',
    description: '是否有連結到品牌的社群媒體帳號（Facebook、Instagram、LinkedIn 等），強化品牌的跨平台「權威性」',
    icon: '📱',
    recommendation: '在頁首或頁尾加入品牌的社群媒體連結，並確保各平台的品牌名稱一致'
  },
  {
    id: 'outbound_links',
    name: '外部權威連結',
    description: '是否有連結到外部可信來源（至少 2 個），引用外部資料可強化內容的「專業度」與「可信度」',
    icon: '🔗',
    recommendation: '在內容中引用並連結到官方資料、研究報告或知名媒體，使用 target="_blank" 開新分頁'
  }
]

export default function EEATAudit() {
  const { id } = useParams()
  const [website, setWebsite] = useState(null)
  const [eeatAudit, setEeatAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

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

  // 付費狀態（目前固定 false，待會員系統完成後改為動態判斷）
  const isPro = false

  const passedCount = EEAT_CHECKS.filter(c => getCheckStatus(c.id) === 'pass').length
  const score = eeatAudit ? eeatAudit.score : Math.round((passedCount / EEAT_CHECKS.length) * 100)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-slate-600">載入資料中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to={`/dashboard/${id}`} className="text-white/70 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">E-E-A-T 可信度檢測</h1>
              <p className="text-white/80 text-sm">Experience · Expertise · Authoritativeness · Trustworthiness</p>
              <p className="text-white/60 text-xs mt-1">{website?.url}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 總覽卡片 */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-2">E-E-A-T 可信度得分</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  {score}
                </span>
                <span className="text-slate-500">/ 100</span>
              </div>
              <p className="text-slate-500 mt-2">通過 {passedCount} / {EEAT_CHECKS.length} 項檢測</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReanalyze} disabled={analyzing}
                className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {analyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    分析中...
                  </>
                ) : '重新檢測'}
              </button>
              <Link to={`/dashboard/${id}`}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium">
                返回總覽
              </Link>
            </div>
          </div>
          <div className="mt-8">
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>

        {/* 四個維度說明 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Experience', desc: '內容來自真實經驗', icon: '🌟' },
            { label: 'Expertise', desc: '具備專業知識', icon: '🎓' },
            { label: 'Authoritativeness', desc: '在領域中具權威', icon: '🏆' },
            { label: 'Trustworthiness', desc: '網站安全且可信', icon: '🛡️' },
          ].map(({ label, desc, icon }) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-slate-100 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-sm font-semibold text-slate-700">{label}</div>
              <div className="text-xs text-slate-400 mt-1">{desc}</div>
            </div>
          ))}
        </div>

        {/* 檢測項目列表 */}
        <div className="grid md:grid-cols-2 gap-6">
          {EEAT_CHECKS.map((check) => {
            const status = getCheckStatus(check.id)
            return (
              <div key={check.id}
                className={`bg-white rounded-2xl p-6 shadow-sm border-2 transition-all ${
                  status === 'pass' ? 'border-green-200 bg-green-50/30'
                  : status === 'fail' ? 'border-red-200 bg-red-50/30'
                  : 'border-slate-100'}`}>
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{check.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-800">{check.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        status === 'pass' ? 'bg-green-100 text-green-700'
                        : status === 'fail' ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'}`}>
                        {status === 'pass' ? '✓ 通過' : status === 'fail' ? '✗ 未通過' : '⏳ 未知'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{check.description}</p>
                    {status === 'fail' && (
                      <div className="relative rounded-lg overflow-hidden">
                        {/* 模糊預覽層 */}
                        <div className={`p-3 bg-orange-50 ${!isPro ? 'blur-sm select-none pointer-events-none' : ''}`}>
                          <p className="text-xs font-medium text-orange-700 mb-1">💡 建議優化</p>
                          <p className="text-sm text-orange-600">{check.recommendation}</p>
                        </div>
                        {/* 付費鎖定覆蓋層 */}
                        {!isPro && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-md border border-orange-200">
                              <span className="text-base">🔒</span>
                              <span className="text-xs font-semibold text-slate-700">升級 Pro 解鎖修改建議</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 優化行動計畫（付費功能） */}
        <div className="mt-8 rounded-2xl border-2 border-dashed border-orange-200 overflow-hidden">
          {/* 標題列 */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">🛡️ E-E-A-T 優化行動計畫</h3>
              <p className="text-white/70 text-sm mt-1">依影響力排序的具體修復步驟與時程規劃</p>
            </div>
            {!isPro && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-semibold border border-white/30">
                🔒 Pro 功能
              </span>
            )}
          </div>

          {isPro ? (
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">短期目標 (1-2週)</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2"><span className="text-orange-500">•</span>建立或更新「關於我們」與「聯絡我們」頁面</li>
                    <li className="flex items-start gap-2"><span className="text-orange-500">•</span>在頁尾加入隱私權政策連結</li>
                    <li className="flex items-start gap-2"><span className="text-orange-500">•</span>在頁尾加入品牌社群媒體連結</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-3">中期目標 (1-3月)</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2"><span className="text-amber-500">•</span>加入 Organization JSON-LD 結構化資料</li>
                    <li className="flex items-start gap-2"><span className="text-amber-500">•</span>在每篇文章標示作者與發布日期</li>
                    <li className="flex items-start gap-2"><span className="text-amber-500">•</span>內容中引用並連結外部權威來源</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative bg-gradient-to-br from-orange-50 to-amber-50">
              {/* 模糊預覽 */}
              <div className="p-8 blur-sm select-none pointer-events-none">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-3">短期目標 (1-2週)</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2"><span className="text-orange-500">•</span>建立或更新「關於我們」與「聯絡我們」頁面</li>
                      <li className="flex items-start gap-2"><span className="text-orange-500">•</span>在頁尾加入隱私權政策連結</li>
                      <li className="flex items-start gap-2"><span className="text-orange-500">•</span>在頁尾加入品牌社群媒體連結</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-3">中期目標 (1-3月)</h4>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2"><span className="text-amber-500">•</span>加入 Organization JSON-LD 結構化資料</li>
                      <li className="flex items-start gap-2"><span className="text-amber-500">•</span>在每篇文章標示作者與發布日期</li>
                      <li className="flex items-start gap-2"><span className="text-amber-500">•</span>內容中引用並連結外部權威來源</li>
                    </ul>
                  </div>
                </div>
              </div>
              {/* 升級 CTA 覆蓋層 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center bg-white/90 backdrop-blur-sm rounded-2xl px-10 py-8 shadow-lg border border-orange-100 max-w-sm mx-4">
                  <div className="text-4xl mb-3">🔒</div>
                  <h4 className="text-lg font-bold text-slate-800 mb-2">升級 Pro 解鎖完整建議</h4>
                  <p className="text-sm text-slate-500 mb-5">包含優先順序排序、具體修復步驟、時程規劃，以及每月自動掃描通知</p>
                  <button className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-md">
                    升級 Pro 方案 →
                  </button>
                  <p className="text-xs text-slate-400 mt-3">NT$2,000 / 月 · 隨時取消</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
