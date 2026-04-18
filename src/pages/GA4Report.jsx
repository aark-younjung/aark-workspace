import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import { getGA4Summary, getGA4Channels, getGA4TopPages, getGA4Devices } from '../services/ga4Analyzer'
import { getPropertyId, isAuthenticated, initiateGoogleAuth } from '../services/googleAuth'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

// ── 基準值 ────────────────────────────────────────────────────
const BENCHMARKS = {
  bounceRate: { excellent: 30, good: 50, average: 70 },  // % 越低越好
  engagementRate: { excellent: 65, good: 45, average: 30 }, // % 越高越好
  newUserRatio: { high: 75, normal: 40 },
  ctr: { excellent: 5, good: 2 },
}

function rateColor(val, thresholds, lower = false) {
  if (lower) {
    if (val <= thresholds.excellent) return { color: '#10b981', label: '優秀' }
    if (val <= thresholds.good) return { color: '#3b82f6', label: '良好' }
    if (val <= thresholds.average) return { color: '#f59e0b', label: '普通' }
    return { color: '#ef4444', label: '需改善' }
  } else {
    if (val >= thresholds.excellent) return { color: '#10b981', label: '優秀' }
    if (val >= thresholds.good) return { color: '#3b82f6', label: '良好' }
    if (val >= thresholds.average) return { color: '#f59e0b', label: '普通' }
    return { color: '#ef4444', label: '需改善' }
  }
}

// ── 建議引擎 ──────────────────────────────────────────────────
function generateRecommendations(summary, channels, pages, devices) {
  const recs = []
  const engRate = summary.sessions > 0 ? Math.round(summary.engagedSessions / summary.sessions * 100) : 0
  const newRate = summary.activeUsers > 0 ? Math.round(summary.newUsers / summary.activeUsers * 100) : 0
  const pvPerSession = summary.sessions > 0 ? (summary.pageViews / summary.sessions).toFixed(1) : 0

  // 跳出率
  if (summary.bounceRate > 70) {
    recs.push({
      priority: 'high', icon: '🚨', title: '跳出率過高，需立即改善首頁體驗',
      detail: `目前跳出率 ${summary.bounceRate.toFixed(1)}%，遠超產業平均（50–60%）。用戶進入後很快就離開，代表頁面內容與期待不符，或載入速度太慢。`,
      actions: ['檢查首頁載入速度（目標 < 3 秒）', '確保首屏能清楚說明你提供的價值', '加入明確的 CTA 按鈕引導用戶繼續瀏覽', '確認廣告或 SEO 關鍵字與落地頁面內容一致'],
    })
  } else if (summary.bounceRate > 50) {
    recs.push({
      priority: 'medium', icon: '⚠️', title: '跳出率偏高，建議優化內容相關性',
      detail: `目前跳出率 ${summary.bounceRate.toFixed(1)}%。部分流量可能來自與內容不符的來源，或頁面沒有足夠誘因讓用戶繼續探索。`,
      actions: ['檢視流量來源，過濾品質低的流量', '在文章末加入相關文章推薦', '改善頁面內部連結結構'],
    })
  } else {
    recs.push({
      priority: 'good', icon: '✅', title: `跳出率 ${summary.bounceRate.toFixed(1)}% 表現良好`,
      detail: '用戶到達後傾向繼續瀏覽，代表內容與來源流量高度匹配。',
      actions: ['持續監控，避免跳出率上升', '分析哪些頁面跳出率最低，複製其成功模式'],
    })
  }

  // 互動率
  if (engRate < 30) {
    recs.push({
      priority: 'high', icon: '📉', title: '互動率低，內容未能引起用戶行動',
      detail: `互動率僅 ${engRate}%（產業建議 ≥ 50%）。用戶雖然進入網站，但沒有產生有效互動（滾動、點擊、停留超過 10 秒）。`,
      actions: ['在頁面加入互動元素（影片、問卷、計算機工具）', '優化 CTA 按鈕的位置與文字', '確保行動裝置版本操作流暢', '縮短重要資訊的取得路徑'],
    })
  } else if (engRate < 50) {
    recs.push({
      priority: 'medium', icon: '💬', title: '互動率有提升空間',
      detail: `互動率 ${engRate}%，距離優秀水準（65%）還有差距。`,
      actions: ['在內容中加入問題引導讀者思考', '提供免費資源（電子書、模板）增加互動動機', '優化行動裝置閱讀體驗'],
    })
  }

  // 新用戶比例
  if (newRate > 80) {
    recs.push({
      priority: 'medium', icon: '🔄', title: '新用戶比例過高，回訪率不足',
      detail: `新用戶佔 ${newRate}%，代表你的網站吸引了很多新訪客，但留不住他們。品牌忠誠度和回訪意願需要加強。`,
      actions: ['建立 Email 訂閱機制，讓訪客留下聯絡方式', '規律發布高品質內容，建立回訪習慣', '設計會員制度或積分機制', '在社群媒體上維持互動'],
    })
  } else if (newRate < 30) {
    recs.push({
      priority: 'medium', icon: '📣', title: '新用戶比例偏低，需擴大觸及',
      detail: `新用戶佔 ${newRate}%，老用戶回訪多但缺乏新血。長期來看業務成長會受限。`,
      actions: ['增加 SEO 關鍵字覆蓋，觸及更多搜尋需求', '在新平台（Instagram、TikTok、LinkedIn）建立曝光', '投放廣告拓展新受眾', '與同業合作交換連結'],
    })
  }

  // 每次工作階段瀏覽頁數
  if (pvPerSession < 1.5) {
    recs.push({
      priority: 'medium', icon: '📄', title: '用戶瀏覽深度不足',
      detail: `平均每次工作階段僅瀏覽 ${pvPerSession} 頁，代表用戶看完一頁後就離開，沒有繼續探索網站其他內容。`,
      actions: ['在每篇文章底部加入 3–5 篇相關文章推薦', '優化網站導覽結構，讓重要頁面更易被發現', '在側欄展示熱門文章或分類', '建立內容系列，引導用戶按順序閱讀'],
    })
  }

  // 流量來源分析
  if (channels.length > 0) {
    const organicCh = channels.find(c => c.channel?.toLowerCase().includes('organic'))
    const directCh = channels.find(c => c.channel?.toLowerCase().includes('direct'))
    const totalSessions = channels.reduce((s, c) => s + c.sessions, 0)
    const organicPct = organicCh ? Math.round(organicCh.sessions / totalSessions * 100) : 0
    const directPct = directCh ? Math.round(directCh.sessions / totalSessions * 100) : 0

    if (directPct > 60) {
      recs.push({
        priority: 'medium', icon: '🔗', title: '過度依賴直接流量，SEO 有待加強',
        detail: `直接流量佔 ${directPct}%，代表大部分訪客是已知道你網站的老用戶。新用戶很難透過搜尋發現你。`,
        actions: ['建立完整的關鍵字策略，針對目標受眾的搜尋問題產出內容', '確保每篇文章都有優化的 Meta 標題和描述', '建立外部反向連結提升域名權威度'],
      })
    } else if (organicPct < 20) {
      recs.push({
        priority: 'medium', icon: '🔍', title: '自然搜尋流量偏低',
        detail: `自然搜尋流量僅佔 ${organicPct}%，SEO 效果有待提升。`,
        actions: ['定期發布針對長尾關鍵字的深度文章', '優化現有文章的標題結構和內部連結', '提交 Sitemap 到 Google Search Console'],
      })
    }
  }

  // 裝置分析
  if (devices.length > 0) {
    const mobile = devices.find(d => d.device === 'mobile')
    const totalDev = devices.reduce((s, d) => s + d.sessions, 0)
    const mobilePct = mobile ? Math.round(mobile.sessions / totalDev * 100) : 0
    if (mobilePct > 60 && mobile?.bounceRate > 70) {
      recs.push({
        priority: 'high', icon: '📱', title: '手機跳出率高，行動版體驗需優化',
        detail: `手機流量佔 ${mobilePct}%，但手機跳出率高達 ${mobile.bounceRate}%。這代表你的網站在手機上的體驗不佳，損失大量潛在客戶。`,
        actions: ['使用 Google Mobile-Friendly Test 測試', '確保按鈕夠大（建議 ≥ 44px）、文字清晰可讀', '減少手機版彈出視窗', '確認頁面在 3G 網路下也能快速載入'],
      })
    }
  }

  // 熱門頁面分析
  if (pages.length > 0) {
    const highBouncePage = pages.find(p => p.pageViews > 100 && p.bounceRate > 80)
    if (highBouncePage) {
      recs.push({
        priority: 'medium', icon: '📌', title: `重要頁面「${highBouncePage.title?.slice(0, 20) || highBouncePage.path}」跳出率過高`,
        detail: `此頁面有 ${highBouncePage.pageViews} 次瀏覽，但跳出率高達 ${highBouncePage.bounceRate}%，代表大量流量進入後立即離開，白白浪費了曝光機會。`,
        actions: ['重新審視此頁面的標題是否符合用戶期待', '在頁面加入明確的 CTA 和相關連結', '改善此頁面的視覺設計和內容結構'],
      })
    }
  }

  return recs.filter(r => r.priority !== 'good' || recs.filter(x => x.priority !== 'good').length < 3)
    .sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0))
}

const CHANNEL_COLORS = {
  'Organic Search': '#10b981', 'Direct': '#3b82f6', 'Organic Social': '#8b5cf6',
  'Referral': '#f59e0b', 'Email': '#06b6d4', 'Paid Search': '#ef4444',
  'Unassigned': '#94a3b8', 'default': '#6366f1',
}
const PIE_COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#ef4444','#94a3b8']

export default function GA4Report() {
  const { id } = useParams()
  const { isDark } = useTheme()
  const [website, setWebsite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [channels, setChannels] = useState([])
  const [pages, setPages] = useState([])
  const [devices, setDevices] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: w } = await supabase.from('websites').select('*').eq('id', id).single()
        setWebsite(w)
        if (!isAuthenticated()) { setError('NOT_AUTHENTICATED'); setLoading(false); return }
        const pid = getPropertyId(id)
        if (!pid) { setError('NO_PROPERTY'); setLoading(false); return }
        const [s, ch, pg, dv] = await Promise.all([
          getGA4Summary(pid),
          getGA4Channels(pid).catch(() => []),
          getGA4TopPages(pid).catch(() => []),
          getGA4Devices(pid).catch(() => []),
        ])
        setSummary(s); setChannels(ch); setPages(pg); setDevices(dv)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600">載入 GA4 數據中...</p>
      </div>
    </div>
  )

  if (error === 'NOT_AUTHENTICATED') return (
    <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">🔑</div>
        <h2 className="font-bold text-slate-800 mb-2">需要 Google 授權</h2>
        <p className="text-slate-500 text-sm mb-5">請先在儀表板連接 Google 帳號</p>
        <button onClick={initiateGoogleAuth} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-semibold mr-3">連接 Google</button>
        <Link to={`/dashboard/${id}`} className="text-slate-500 text-sm">← 返回儀表板</Link>
      </div>
    </div>
  )

  if (error === 'NO_PROPERTY') return (
    <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="font-bold text-slate-800 mb-2">尚未設定 GA4 Property ID</h2>
        <p className="text-slate-500 text-sm mb-5">請回儀表板設定 GA4 Property ID</p>
        <Link to={`/dashboard/${id}`} className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-semibold">← 返回設定</Link>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="bg-white/60 backdrop-blur-md rounded-2xl p-8 max-w-sm text-center border border-white/60">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <Link to={`/dashboard/${id}`} className="text-orange-500 text-sm">← 返回儀表板</Link>
      </div>
    </div>
  )

  const engRate = summary.sessions > 0 ? Math.round(summary.engagedSessions / summary.sessions * 100) : 0
  const newRate = summary.activeUsers > 0 ? Math.round(summary.newUsers / summary.activeUsers * 100) : 0
  const pvPerSession = summary.sessions > 0 ? (summary.pageViews / summary.sessions).toFixed(1) : 0
  const recs = generateRecommendations(summary, channels, pages, devices)
  const totalChSessions = channels.reduce((s, c) => s + c.sessions, 0)

  const TABS = [
    { id: 'overview', label: '總覽', icon: '📊' },
    { id: 'trends', label: '趨勢', icon: '📈' },
    { id: 'channels', label: '流量來源', icon: '🔀' },
    { id: 'pages', label: '熱門頁面', icon: '📄' },
    { id: 'recs', label: `建議 (${recs.length})`, icon: '💡' },
  ]

  return (
    <div className="min-h-screen relative" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, opacity: 0.25, mixBlendMode: 'overlay' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <header className="relative sticky top-0 z-40 border-b border-white/40 backdrop-blur-md bg-white/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/dashboard/${id}`} className="text-slate-500 hover:text-slate-700 text-sm transition-colors">← 返回儀表板</Link>
            <span className="text-slate-300">|</span>
            <div>
              <span className="font-bold text-slate-800">📊 GA4 流量深度分析</span>
              {website && <span className="text-slate-500 text-sm ml-2">{website.name}</span>}
            </div>
          </div>
          <span className="text-xs text-slate-400">過去 30 天</span>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8">

        {/* KPI 卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: '工作階段', value: summary.sessions.toLocaleString(), sub: 'Sessions', color: '#3b82f6' },
            { label: '活躍用戶', value: summary.activeUsers.toLocaleString(), sub: 'Active Users', color: '#8b5cf6' },
            { label: '網頁瀏覽', value: summary.pageViews.toLocaleString(), sub: 'Page Views', color: '#06b6d4' },
            { label: '跳出率', value: `${summary.bounceRate.toFixed(1)}%`, sub: rateColor(summary.bounceRate, BENCHMARKS.bounceRate, true).label, color: rateColor(summary.bounceRate, BENCHMARKS.bounceRate, true).color },
            { label: '互動率', value: `${engRate}%`, sub: rateColor(engRate, BENCHMARKS.engagementRate).label, color: rateColor(engRate, BENCHMARKS.engagementRate).color },
            { label: '頁/工作階段', value: pvPerSession, sub: '內容深度', color: '#f59e0b' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm">
              <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
              <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs mt-0.5" style={{ color: kpi.color }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* 指標健康條 */}
        <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-5 shadow-sm mb-6">
          <h3 className="font-semibold text-slate-800 mb-4">指標健康度</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: '跳出率', value: summary.bounceRate.toFixed(1) + '%', desc: '產業平均 50–60%', score: Math.max(0, 100 - summary.bounceRate), ...rateColor(summary.bounceRate, BENCHMARKS.bounceRate, true) },
              { label: '互動率', value: engRate + '%', desc: '建議目標 ≥ 50%', score: engRate, ...rateColor(engRate, BENCHMARKS.engagementRate) },
              { label: '新用戶比例', value: newRate + '%', desc: '30–75% 為健康範圍', score: newRate > 80 ? 60 : newRate < 20 ? 50 : 85, color: newRate > 80 || newRate < 20 ? '#f59e0b' : '#10b981', label2: newRate > 80 ? '偏高' : newRate < 20 ? '偏低' : '正常' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{item.value} · {item.label || item.label2}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: item.color }} />
                </div>
                <div className="text-xs text-slate-400">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab 導覽 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-orange-500 text-white' : 'bg-white/50 text-slate-600 hover:bg-white/80'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: 總覽 ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 裝置分布 */}
            {devices.length > 0 && (
              <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-4">裝置分布</h3>
                <div className="grid grid-cols-3 gap-4">
                  {devices.map((d, i) => {
                    const pct = totalChSessions > 0 ? Math.round(d.sessions / summary.sessions * 100) : 0
                    const icons = { mobile: '📱', desktop: '💻', tablet: '📟' }
                    return (
                      <div key={i} className="text-center p-4 bg-white/60 rounded-xl border border-orange-50">
                        <div className="text-2xl mb-2">{icons[d.device] || '💻'}</div>
                        <div className="text-lg font-bold text-slate-800">{pct}%</div>
                        <div className="text-sm text-slate-500 capitalize">{d.device}</div>
                        <div className="text-xs text-slate-400 mt-1">{d.sessions.toLocaleString()} 工作階段</div>
                        <div className="text-xs mt-1" style={{ color: rateColor(d.bounceRate, BENCHMARKS.bounceRate, true).color }}>
                          跳出率 {d.bounceRate}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 新舊用戶 */}
            <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">新用戶 vs 回訪用戶</h3>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-600">新用戶</span>
                    <span className="font-medium">{newRate}% · {summary.newUsers.toLocaleString()} 人</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${newRate}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-600">回訪用戶</span>
                    <span className="font-medium">{100 - newRate}% · {(summary.activeUsers - summary.newUsers).toLocaleString()} 人</span>
                  </div>
                  <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${100 - newRate}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {newRate > 75 ? '⚠️ 回訪率偏低，建議加強內容訂閱和再行銷策略' :
                 newRate < 30 ? '⚠️ 新用戶偏少，建議擴大 SEO 和社群曝光' :
                 '✅ 新舊用戶比例健康，代表既有流量又有品牌黏著度'}
              </p>
            </div>
          </div>
        )}

        {/* ── Tab: 趨勢 ── */}
        {activeTab === 'trends' && summary.timeline?.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">流量趨勢（近 30 天）</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={summary.timeline}>
                  <defs>
                    <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={d => `日期：${d}`} formatter={(v, n) => [v.toLocaleString(), n === 'sessions' ? '工作階段' : '活躍用戶']} />
                  <Legend formatter={v => v === 'sessions' ? '工作階段' : '活躍用戶'} />
                  <Area type="monotone" dataKey="sessions" stroke="#3b82f6" fill="url(#gradSessions)" strokeWidth={2} />
                  <Area type="monotone" dataKey="activeUsers" stroke="#8b5cf6" fill="url(#gradUsers)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">跳出率趨勢</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={summary.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${(v * 100).toFixed(1)}%`, '跳出率']} />
                  <Line type="monotone" dataKey="bounceRate" stroke="#ef4444" strokeWidth={2} dot={false}
                    tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab: 流量來源 ── */}
        {activeTab === 'channels' && (
          <div className="space-y-6">
            {channels.length > 0 ? (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-800 mb-4">流量來源分布</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={channels} dataKey="sessions" nameKey="channel" cx="50%" cy="50%" outerRadius={80} label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {channels.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v.toLocaleString() + ' 工作階段', n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-800 mb-4">各來源跳出率比較</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={channels} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="channel" tick={{ fontSize: 11 }} width={100} />
                        <Tooltip formatter={v => [`${v}%`, '跳出率']} />
                        <Bar dataKey="bounceRate" radius={[0, 4, 4, 0]}>
                          {channels.map((c, i) => <Cell key={i} fill={c.bounceRate > 70 ? '#ef4444' : c.bounceRate > 50 ? '#f59e0b' : '#10b981'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-orange-100">
                    <h3 className="font-semibold text-slate-800">流量來源詳細數據</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-orange-50/50">
                        <tr>
                          {['來源管道', '工作階段', '活躍用戶', '新用戶', '跳出率', '互動率'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-50">
                        {channels.map((c, i) => {
                          const pct = Math.round(c.sessions / totalChSessions * 100)
                          const chEngRate = c.sessions > 0 ? Math.round(c.engagedSessions / c.sessions * 100) : 0
                          return (
                            <tr key={i} className="hover:bg-orange-50/30">
                              <td className="px-4 py-3 font-medium text-slate-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  {c.channel}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">{c.sessions.toLocaleString()} <span className="text-slate-400 text-xs">({pct}%)</span></td>
                              <td className="px-4 py-3 text-slate-600">{c.activeUsers.toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-600">{c.newUsers.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className="font-medium" style={{ color: rateColor(c.bounceRate, BENCHMARKS.bounceRate, true).color }}>{c.bounceRate}%</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium" style={{ color: rateColor(chEngRate, BENCHMARKS.engagementRate).color }}>{chEngRate}%</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : <div className="text-center py-12 text-slate-400">無流量來源資料</div>}
          </div>
        )}

        {/* ── Tab: 熱門頁面 ── */}
        {activeTab === 'pages' && (
          <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-orange-100">
              <h3 className="font-semibold text-slate-800">熱門頁面 Top 20</h3>
              <p className="text-xs text-slate-400 mt-0.5">依瀏覽量排序・標紅代表跳出率 ≥ 70% 需要注意</p>
            </div>
            {pages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50/50">
                    <tr>
                      {['#', '頁面', '瀏覽量', '用戶數', '跳出率', '平均停留（秒）'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {pages.map((p, i) => (
                      <tr key={i} className={`hover:bg-orange-50/30 ${p.bounceRate > 70 ? 'bg-red-50/20' : ''}`}>
                        <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-slate-800 truncate text-xs">{p.title || p.path}</div>
                          <div className="text-slate-400 text-xs truncate">{p.path}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{p.pageViews.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600">{p.users.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-sm" style={{ color: rateColor(p.bounceRate, BENCHMARKS.bounceRate, true).color }}>{p.bounceRate}%</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.avgDuration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-center py-12 text-slate-400">無頁面資料</div>}
          </div>
        )}

        {/* ── Tab: 建議 ── */}
        {activeTab === 'recs' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
              💡 以下建議根據你的 GA4 實際數據自動生成，依優先級排序。
            </div>
            {recs.map((rec, i) => (
              <div key={i} className={`bg-white/60 backdrop-blur-md border rounded-2xl p-6 shadow-sm ${rec.priority === 'high' ? 'border-red-200' : rec.priority === 'good' ? 'border-green-200' : 'border-orange-200'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0">{rec.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-800">{rec.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${rec.priority === 'high' ? 'bg-red-100 text-red-600' : rec.priority === 'good' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        {rec.priority === 'high' ? '優先處理' : rec.priority === 'good' ? '表現良好' : '建議改善'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">{rec.detail}</p>
                  </div>
                </div>
                <div className="ml-9">
                  <p className="text-xs font-semibold text-slate-500 mb-2">具體行動：</p>
                  <ul className="space-y-1">
                    {rec.actions.map((a, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-orange-400 flex-shrink-0 mt-0.5">→</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
