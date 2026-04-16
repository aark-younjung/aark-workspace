import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { getGSCSummary, getGSCTopPages, getGSCDevices } from '../services/gscAnalyzer'
import { getSiteUrl, isAuthenticated, initiateGoogleAuth } from '../services/googleAuth'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

// ── 建議引擎 ──────────────────────────────────────────────────
function generateRecommendations(summary, topPages, devices) {
  const recs = []
  const { clicks, impressions, ctr, position, topQueries = [] } = summary

  // CTR 分析
  const ctrPct = Math.round(ctr * 100)
  if (ctrPct < 1) {
    recs.push({
      priority: 'high', icon: '📉', title: '點擊率過低（< 1%），標題和摘要亟需優化',
      detail: `目前搜尋點擊率僅 ${ctrPct}%。即使曝光數高，用戶看到你的標題後選擇不點擊，代表 Meta 標題或描述未能引發興趣，或搜尋意圖不匹配。`,
      actions: [
        '重寫高曝光頁面的 Meta 標題，加入數字、年份或情感詞（例：「2025 年最完整指南」）',
        '確保 Meta 描述清楚傳達頁面價值，並包含一個行動召喚',
        '在搜尋結果中加入 FAQ Schema、評分 Schema 以顯示豐富摘要（Rich Snippet）',
        '確認頁面標題與用戶搜尋意圖高度一致，避免誤導性標題',
      ],
    })
  } else if (ctrPct < 3) {
    recs.push({
      priority: 'medium', icon: '⚠️', title: `點擊率 ${ctrPct}% 有提升空間`,
      detail: '產業平均點擊率約 3–5%。你的標題和描述能進一步優化，讓更多人點擊。',
      actions: [
        '測試不同的標題格式（問句式、列表式、數據式）',
        '加入結構化資料（HowTo、FAQ）讓搜尋結果更吸引人',
        '確保每個頁面都有獨特且有說服力的 Meta 描述（120–155 字元）',
      ],
    })
  } else {
    recs.push({
      priority: 'good', icon: '✅', title: `點擊率 ${ctrPct}% 表現良好`,
      detail: '你的標題和摘要有效吸引用戶點擊，搜尋意圖匹配度高。',
      actions: ['持續監控高曝光但點擊率下降的頁面', '將成功的標題模式應用到其他頁面'],
    })
  }

  // 平均排名分析
  if (position > 20) {
    recs.push({
      priority: 'high', icon: '🏔️', title: '平均排名超過第 2 頁，需要提升整體 SEO 權威度',
      detail: `目前平均排名第 ${position.toFixed(1)} 名，大部分關鍵字排在第 2–3 頁。90% 的點擊集中在第 1 頁，這意味著現在幾乎沒有自然流量潛力。`,
      actions: [
        '建立高品質反向連結（白帽 Link Building），提升網域權威度（DA）',
        '深化現有內容，將短文擴充為 2000+ 字的完整指南',
        '專注長尾關鍵字，這類關鍵字競爭少、排名快',
        '確保技術 SEO 無誤（Core Web Vitals、索引設定、Sitemap）',
      ],
    })
  } else if (position > 10) {
    recs.push({
      priority: 'medium', icon: '📍', title: `平均排名第 ${position.toFixed(1)} 名，接近第 1 頁`,
      detail: '你的關鍵字主要排在第 1–2 頁之間。進一步優化可以讓更多頁面突破第 10 名進入第 1 頁，帶來大幅流量增長。',
      actions: [
        '找出排名第 11–15 名的關鍵字，優先投入資源衝進第 1 頁',
        '更新舊文章內容，加入最新數據和範例',
        '增加文章的 Schema 標記（Article、HowTo、FAQPage）',
        '加強內部連結，將高權威頁面的連結指向排名偏低的目標頁',
      ],
    })
  }

  // 機會關鍵字分析（排名 4–15，曝光 > 100）
  const opportunityKWs = topQueries.filter(q => q.position >= 4 && q.position <= 15 && q.impressions >= 100)
  if (opportunityKWs.length > 0) {
    const topOpp = opportunityKWs.sort((a, b) => b.impressions - a.impressions).slice(0, 3)
    recs.push({
      priority: 'high', icon: '🎯', title: `發現 ${opportunityKWs.length} 個「快速突破」機會關鍵字`,
      detail: `這些關鍵字排名在第 4–15 名，曝光量高但還沒有穩定進入前 3 名。稍加優化就能帶來顯著的流量增長。\n\n重點關鍵字：${topOpp.map(q => `「${q.query}」(排名 ${q.position.toFixed(0)}，${q.impressions} 次曝光)`).join('、')}`,
      actions: [
        '針對這些關鍵字的頁面進行 On-Page SEO 強化（H1 標題、首段、圖片 Alt）',
        '增加 500–1000 字的補充內容，覆蓋相關子問題',
        '從其他高權威頁面建立內部連結到這些目標頁',
        '建立 2–3 條高品質外部反向連結到這些頁面',
      ],
    })
  }

  // 低點擊率但高曝光關鍵字
  const lowCTRKWs = topQueries.filter(q => q.impressions >= 200 && (q.ctr * 100) < 2)
  if (lowCTRKWs.length > 0) {
    const topLow = lowCTRKWs.sort((a, b) => b.impressions - a.impressions).slice(0, 3)
    recs.push({
      priority: 'medium', icon: '🔤', title: `${lowCTRKWs.length} 個高曝光關鍵字點擊率低落`,
      detail: `這些關鍵字有大量曝光但鮮少被點擊，代表搜尋結果頁面的標題或描述吸引力不足。\n\n重點：${topLow.map(q => `「${q.query}」(曝光 ${q.impressions}，CTR ${(q.ctr * 100).toFixed(1)}%)`).join('、')}`,
      actions: [
        '重寫這些頁面的 Meta 標題，使其更具吸引力或解決性',
        '優化 Meta 描述，明確說明進入頁面後能獲得什麼',
        '考慮加入結構化資料讓搜尋結果顯示更豐富的資訊',
      ],
    })
  }

  // 曝光量分析
  if (impressions < 500) {
    recs.push({
      priority: 'high', icon: '👁️', title: '整體曝光量低，索引範圍和內容量需要擴充',
      detail: `過去 30 天曝光量僅 ${impressions.toLocaleString()} 次，代表你的網站在 Google 搜尋中出現的頻率很低。這通常是因為內容量不足或技術 SEO 問題阻礙了索引。`,
      actions: [
        '提交 XML Sitemap 到 Google Search Console 確保所有頁面被索引',
        '每週至少發布 1–2 篇針對目標關鍵字的新內容',
        '確認 robots.txt 沒有意外封鎖重要頁面',
        '使用 Google 索引測試工具確認頁面已被索引',
      ],
    })
  } else if (impressions < 5000) {
    recs.push({
      priority: 'medium', icon: '📊', title: '曝光量成長空間大，可透過擴充內容提升',
      detail: `目前曝光 ${impressions.toLocaleString()} 次，有很大的成長空間。擴充關鍵字覆蓋範圍是快速提升曝光的有效方式。`,
      actions: [
        '進行關鍵字研究，找出目標受眾還在搜尋但你尚未覆蓋的問題',
        '建立 FAQ 頁面、比較頁面（A vs B）等高搜尋量頁面類型',
        '針對長尾關鍵字建立專項文章',
      ],
    })
  }

  // 裝置分析
  if (devices.length > 0) {
    const mobile = devices.find(d => d.device === 'MOBILE' || d.device === 'mobile')
    if (mobile) {
      const total = devices.reduce((s, d) => s + d.clicks, 0)
      const mPct = Math.round(mobile.clicks / total * 100)
      if (mPct > 60 && (mobile.ctr * 100) < (ctr * 100 * 0.7)) {
        recs.push({
          priority: 'medium', icon: '📱', title: '手機搜尋點擊率明顯低於桌機',
          detail: `手機流量佔 ${mPct}%，但手機點擊率低於桌機 30% 以上。可能是在手機搜尋結果中的標題被截斷，或頁面行動體驗不佳導致用戶猶豫點擊。`,
          actions: [
            '確保 Meta 標題在手機上不超過 60 字元',
            '測試頁面的行動友善性（Google Mobile-Friendly Test）',
            '優化行動版頁面速度（< 3 秒）',
          ],
        })
      }
    }
  }

  // 熱門頁面的 CTR 機會
  if (topPages.length > 0) {
    const topPage = topPages[0]
    if (topPage.impressions > 100 && (topPage.ctr * 100) < 3) {
      recs.push({
        priority: 'medium', icon: '🏆', title: `流量最高頁面「${topPage.page?.slice(-30)}」點擊率仍有提升空間`,
        detail: `這是你流量最多的頁面（${topPage.clicks} 次點擊，${topPage.impressions} 次曝光），但 CTR 僅 ${(topPage.ctr * 100).toFixed(1)}%。優化此頁面的標題和描述會有最大回報。`,
        actions: [
          '重寫此頁面的 Meta 標題（加入年份、數字或最強賣點）',
          '優化 Meta 描述（確保包含主要關鍵字 + 行動召喚）',
          '加入 FAQ Schema 讓搜尋結果更豐富',
        ],
      })
    }
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, good: 2 }
    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1)
  })
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4']

function fmt(n, decimals = 0) {
  if (n == null) return '—'
  return Number(n).toLocaleString('zh-TW', { maximumFractionDigits: decimals })
}

function KpiCard({ label, value, sub, color = '#3b82f6', badge, badgeColor }) {
  return (
    <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: badgeColor + '20', color: badgeColor }}>
            {badge}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

const TABS = [
  { id: 'overview', label: '總覽' },
  { id: 'trend', label: '趨勢' },
  { id: 'keywords', label: '關鍵字' },
  { id: 'pages', label: '熱門頁面' },
  { id: 'recs', label: '建議' },
]

export default function GSCReport() {
  const { id } = useParams()
  const { isDark } = useTheme()
  const [website, setWebsite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [devices, setDevices] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [pageSort, setPageSort] = useState('clicks')
  const [kwSort, setKwSort] = useState('clicks')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: w } = await supabase.from('websites').select('*').eq('id', id).single()
        setWebsite(w)
        if (!isAuthenticated()) { setError('NOT_AUTHENTICATED'); setLoading(false); return }
        const siteUrl = getSiteUrl(id)
        if (!siteUrl) { setError('NO_SITE_URL'); setLoading(false); return }
        const [s, pg, dv] = await Promise.all([
          getGSCSummary(siteUrl),
          getGSCTopPages(siteUrl).catch(() => []),
          getGSCDevices(siteUrl).catch(() => []),
        ])
        setSummary(s); setTopPages(pg); setDevices(dv)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const bg = isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={bg}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">載入 GSC 數據中…</p>
      </div>
    </div>
  )

  if (error === 'NOT_AUTHENTICATED') return (
    <div className="min-h-screen flex items-center justify-center" style={bg}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">🔐</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">需要 Google 授權</h2>
        <p className="text-slate-600 text-sm mb-6">請先在儀表板連結 Google 帳號，才能查看 Search Console 數據。</p>
        <div className="flex gap-3 justify-center">
          <Link to={`/dashboard/${id}`} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm hover:bg-orange-600">
            返回儀表板
          </Link>
          <button onClick={initiateGoogleAuth} className="px-4 py-2 bg-white/60 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-white">
            連結 Google
          </button>
        </div>
      </div>
    </div>
  )

  if (error === 'NO_SITE_URL') return (
    <div className="min-h-screen flex items-center justify-center" style={bg}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">🌐</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">尚未設定 GSC 網站</h2>
        <p className="text-slate-600 text-sm mb-6">請在儀表板設定 Search Console 網站網址（例：sc-domain:yourdomain.com）。</p>
        <Link to={`/dashboard/${id}`} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm hover:bg-orange-600">
          返回儀表板設定
        </Link>
      </div>
    </div>
  )

  if (error && error !== 'NOT_AUTHENTICATED' && error !== 'NO_SITE_URL') return (
    <div className="min-h-screen flex items-center justify-center" style={bg}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">載入失敗</h2>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <Link to={`/dashboard/${id}`} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm hover:bg-orange-600">
          返回儀表板
        </Link>
      </div>
    </div>
  )

  if (!summary) return null

  const ctrPct = Math.round(summary.ctr * 100 * 100) / 100
  const recs = generateRecommendations(summary, topPages, devices)
  const highRecs = recs.filter(r => r.priority === 'high').length

  // 裝置分佈 for Pie
  const totalDevClicks = devices.reduce((s, d) => s + d.clicks, 0)
  const devicePie = devices.map(d => ({
    name: d.device,
    value: d.clicks,
    pct: totalDevClicks > 0 ? Math.round(d.clicks / totalDevClicks * 100) : 0,
  }))

  // 關鍵字分類
  const opportunities = (summary.topQueries || [])
    .filter(q => q.position >= 4 && q.position <= 15 && q.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
  const lowCTR = (summary.topQueries || [])
    .filter(q => q.impressions >= 100 && q.ctr * 100 < 2)
    .sort((a, b) => b.impressions - a.impressions)
  const sortedKWs = [...(summary.topQueries || [])].sort((a, b) => b[kwSort] - a[kwSort])
  const sortedPages = [...topPages].sort((a, b) => b[pageSort] - a[pageSort])

  return (
    <div className="min-h-screen" style={bg}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />
      <div className="relative max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/dashboard/${id}`} className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1">
            ← 返回儀表板
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔎</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Google Search Console 詳細報告</h1>
              <p className="text-slate-500 text-sm">{website?.url || summary.siteUrl} · 過去 30 天</p>
            </div>
          </div>
          {highRecs > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-sm text-red-700">
              <span>🚨</span>
              <span>發現 <strong>{highRecs}</strong> 個需立即處理的問題</span>
              <button onClick={() => setActiveTab('recs')} className="underline font-medium">查看建議 →</button>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard label="總點擊數" value={fmt(summary.clicks)} sub="自然搜尋點擊" color="#3b82f6" />
          <KpiCard label="總曝光數" value={fmt(summary.impressions)} sub="搜尋結果出現次數" color="#8b5cf6" />
          <KpiCard
            label="平均點擊率"
            value={`${ctrPct}%`}
            sub="點擊 ÷ 曝光"
            color={ctrPct >= 5 ? '#10b981' : ctrPct >= 2 ? '#3b82f6' : '#ef4444'}
            badge={ctrPct >= 5 ? '優秀' : ctrPct >= 2 ? '良好' : '需改善'}
            badgeColor={ctrPct >= 5 ? '#10b981' : ctrPct >= 2 ? '#3b82f6' : '#ef4444'}
          />
          <KpiCard
            label="平均排名"
            value={`#${summary.position.toFixed(1)}`}
            sub="越低越好"
            color={summary.position <= 5 ? '#10b981' : summary.position <= 10 ? '#3b82f6' : summary.position <= 20 ? '#f59e0b' : '#ef4444'}
            badge={summary.position <= 5 ? '前 5 名' : summary.position <= 10 ? '第 1 頁' : summary.position <= 20 ? '第 2 頁' : '第 3 頁+'}
            badgeColor={summary.position <= 5 ? '#10b981' : summary.position <= 10 ? '#3b82f6' : summary.position <= 20 ? '#f59e0b' : '#ef4444'}
          />
        </div>

        {/* Health Bars */}
        <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5 mb-8">
          <h3 className="font-semibold text-slate-700 mb-4">SEO 健康指標</h3>
          <div className="space-y-4">
            {[
              {
                label: 'CTR 健康度', val: Math.min(ctrPct, 10),
                max: 10, color: ctrPct >= 5 ? '#10b981' : ctrPct >= 2 ? '#3b82f6' : '#ef4444',
                sub: `${ctrPct}% → 目標 ≥ 3%`,
              },
              {
                label: '排名健康度', val: Math.max(0, 30 - summary.position),
                max: 29, color: summary.position <= 5 ? '#10b981' : summary.position <= 10 ? '#3b82f6' : summary.position <= 20 ? '#f59e0b' : '#ef4444',
                sub: `平均第 ${summary.position.toFixed(1)} 名 → 目標前 5 名`,
              },
              {
                label: '曝光量健康度', val: Math.min(summary.impressions, 10000),
                max: 10000, color: summary.impressions >= 5000 ? '#10b981' : summary.impressions >= 1000 ? '#3b82f6' : summary.impressions >= 500 ? '#f59e0b' : '#ef4444',
                sub: `${fmt(summary.impressions)} 次 → 目標 ≥ 5,000 次/月`,
              },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-400">{item.sub}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, (item.val / item.max) * 100)}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white/40 text-slate-600 hover:bg-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: 總覽 ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 裝置分佈 */}
            {devicePie.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-700 mb-4">搜尋裝置分佈</h3>
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie data={devicePie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                        {devicePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [fmt(v) + ' 點擊', '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {devicePie.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-slate-700 capitalize">{d.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-slate-800">{d.pct}%</span>
                          <span className="text-xs text-slate-400 ml-2">({fmt(d.value)} 點擊)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 機會關鍵字摘要 */}
            {opportunities.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-700">🎯 快速突破機會（排名 4–15）</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{opportunities.length} 個關鍵字</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">這些關鍵字離第 1 頁只差一步，優化它們可快速提升流量。</p>
                <div className="space-y-2">
                  {opportunities.slice(0, 5).map((q, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white/50 rounded-xl">
                      <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎯'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{q.query}</div>
                        <div className="text-xs text-slate-400">曝光 {fmt(q.impressions)} 次 · 點擊 {fmt(q.clicks)} 次</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-amber-600">#{q.position.toFixed(0)}</div>
                        <div className="text-xs text-slate-400">目前排名</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: 趨勢 ── */}
        {activeTab === 'trend' && (
          <div className="space-y-6">
            {summary.timeline.length > 0 ? (
              <>
                <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">點擊 & 曝光趨勢</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={summary.timeline}>
                      <defs>
                        <linearGradient id="gClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gImpr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={l => `日期：${l}`} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="clicks" name="點擊數" stroke="#3b82f6" fill="url(#gClicks)" strokeWidth={2} dot={false} />
                      <Area yAxisId="right" type="monotone" dataKey="impressions" name="曝光數" stroke="#8b5cf6" fill="url(#gImpr)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                  <h3 className="font-semibold text-slate-700 mb-4">CTR & 平均排名趨勢</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={summary.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                      <YAxis yAxisId="right" orientation="right" reversed tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v, name) => name === 'CTR' ? [`${(v * 100).toFixed(2)}%`, name] : [v.toFixed(1), name]}
                        labelFormatter={l => `日期：${l}`}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="ctr" name="CTR" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="position" name="平均排名" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-400 mt-2 text-center">平均排名：數字越小代表排名越好（右側 Y 軸已翻轉）</p>
                </div>
              </>
            ) : (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-10 text-center text-slate-400">
                <div className="text-4xl mb-3">📊</div>
                <p>尚無趨勢數據，請確認 GSC 已連結且有數據</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: 關鍵字 ── */}
        {activeTab === 'keywords' && (
          <div className="space-y-6">
            {/* 機會關鍵字 */}
            {opportunities.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎯</span>
                  <h3 className="font-semibold text-slate-700">快速突破機會關鍵字</h3>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{opportunities.length} 個</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">排名 4–15 名，稍加優化即可進入前 3 名帶來大量流量</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 text-slate-500 font-medium">關鍵字</th>
                        <th className="text-right py-2 text-slate-500 font-medium">排名</th>
                        <th className="text-right py-2 text-slate-500 font-medium">曝光</th>
                        <th className="text-right py-2 text-slate-500 font-medium">點擊</th>
                        <th className="text-right py-2 text-slate-500 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((q, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-white/40">
                          <td className="py-2.5 font-medium text-slate-800">{q.query}</td>
                          <td className="text-right py-2.5">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">#{q.position.toFixed(0)}</span>
                          </td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.impressions)}</td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.clicks)}</td>
                          <td className="text-right py-2.5 text-slate-600">{(q.ctr * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 低 CTR 關鍵字 */}
            {lowCTR.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔤</span>
                  <h3 className="font-semibold text-slate-700">高曝光但點擊率低落的關鍵字</h3>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{lowCTR.length} 個</span>
                </div>
                <p className="text-sm text-slate-500 mb-4">這些關鍵字有大量曝光機會，但標題或描述不夠吸引人，需要優化</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 text-slate-500 font-medium">關鍵字</th>
                        <th className="text-right py-2 text-slate-500 font-medium">曝光</th>
                        <th className="text-right py-2 text-slate-500 font-medium">點擊</th>
                        <th className="text-right py-2 text-slate-500 font-medium">CTR</th>
                        <th className="text-right py-2 text-slate-500 font-medium">排名</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowCTR.slice(0, 10).map((q, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-white/40">
                          <td className="py-2.5 font-medium text-slate-800">{q.query}</td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.impressions)}</td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.clicks)}</td>
                          <td className="text-right py-2.5">
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">{(q.ctr * 100).toFixed(1)}%</span>
                          </td>
                          <td className="text-right py-2.5 text-slate-600">#{q.position.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 全部關鍵字 */}
            {sortedKWs.length > 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-700">所有關鍵字（前 20 名）</h3>
                  <div className="flex gap-1">
                    {['clicks', 'impressions', 'position'].map(k => (
                      <button
                        key={k}
                        onClick={() => setKwSort(k)}
                        className={`px-3 py-1 rounded-lg text-xs ${kwSort === k ? 'bg-orange-500 text-white' : 'bg-white/60 text-slate-600 hover:bg-white'}`}
                      >
                        {k === 'clicks' ? '點擊' : k === 'impressions' ? '曝光' : '排名'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 text-slate-500 font-medium">#</th>
                        <th className="text-left py-2 text-slate-500 font-medium">關鍵字</th>
                        <th className="text-right py-2 text-slate-500 font-medium">點擊</th>
                        <th className="text-right py-2 text-slate-500 font-medium">曝光</th>
                        <th className="text-right py-2 text-slate-500 font-medium">CTR</th>
                        <th className="text-right py-2 text-slate-500 font-medium">排名</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedKWs.map((q, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-white/40">
                          <td className="py-2.5 text-slate-400 text-xs">{i + 1}</td>
                          <td className="py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{q.query}</td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.clicks)}</td>
                          <td className="text-right py-2.5 text-slate-600">{fmt(q.impressions)}</td>
                          <td className="text-right py-2.5 text-slate-500">{(q.ctr * 100).toFixed(1)}%</td>
                          <td className="text-right py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              q.position <= 3 ? 'bg-green-100 text-green-700' :
                              q.position <= 10 ? 'bg-blue-100 text-blue-700' :
                              q.position <= 20 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                            }`}>#{q.position.toFixed(0)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: 熱門頁面 ── */}
        {activeTab === 'pages' && (
          <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-700">熱門頁面（按自然搜尋）</h3>
              <div className="flex gap-1">
                {['clicks', 'impressions', 'position'].map(k => (
                  <button
                    key={k}
                    onClick={() => setPageSort(k)}
                    className={`px-3 py-1 rounded-lg text-xs ${pageSort === k ? 'bg-orange-500 text-white' : 'bg-white/60 text-slate-600 hover:bg-white'}`}
                  >
                    {k === 'clicks' ? '點擊' : k === 'impressions' ? '曝光' : '排名'}
                  </button>
                ))}
              </div>
            </div>
            {sortedPages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">暫無頁面數據</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 text-slate-500 font-medium">#</th>
                      <th className="text-left py-2 text-slate-500 font-medium">頁面路徑</th>
                      <th className="text-right py-2 text-slate-500 font-medium">點擊</th>
                      <th className="text-right py-2 text-slate-500 font-medium">曝光</th>
                      <th className="text-right py-2 text-slate-500 font-medium">CTR</th>
                      <th className="text-right py-2 text-slate-500 font-medium">排名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPages.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-white/40">
                        <td className="py-2.5 text-slate-400 text-xs">{i + 1}</td>
                        <td className="py-2.5 max-w-[220px]">
                          <a
                            href={p.page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline truncate text-xs font-mono block"
                            title={p.page}
                          >
                            {p.page}
                          </a>
                        </td>
                        <td className="text-right py-2.5 font-medium text-slate-800">{fmt(p.clicks)}</td>
                        <td className="text-right py-2.5 text-slate-600">{fmt(p.impressions)}</td>
                        <td className="text-right py-2.5 text-slate-500">{(p.ctr * 100).toFixed(1)}%</td>
                        <td className="text-right py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.position <= 3 ? 'bg-green-100 text-green-700' :
                            p.position <= 10 ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>#{p.position.toFixed(0)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: 建議 ── */}
        {activeTab === 'recs' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">根據你的 GSC 數據，以下是優先建議（高優先 → 中優先）：</p>
            {recs.length === 0 && (
              <div className="bg-white/40 backdrop-blur-md border border-white/60 rounded-2xl p-10 text-center text-slate-400">
                <div className="text-4xl mb-3">🎉</div>
                <p>目前找不到明顯問題，繼續保持！</p>
              </div>
            )}
            {recs.map((rec, i) => (
              <div
                key={i}
                className={`bg-white/40 backdrop-blur-md border rounded-2xl p-5 ${
                  rec.priority === 'high' ? 'border-red-200' :
                  rec.priority === 'good' ? 'border-green-200' :
                  'border-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{rec.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-800">{rec.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'good' ? 'bg-green-100 text-green-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {rec.priority === 'high' ? '高優先' : rec.priority === 'good' ? '保持良好' : '中優先'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 whitespace-pre-line">{rec.detail}</p>
                    <div className="space-y-1.5">
                      {rec.actions.map((a, j) => (
                        <div key={j} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-orange-500 mt-0.5 flex-shrink-0">→</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
