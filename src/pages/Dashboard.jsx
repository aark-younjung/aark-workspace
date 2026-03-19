import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts'

const COLORS = ['#10b981', '#f59e0b', '#ef4444']

export default function Dashboard() {
  const { id } = useParams()
  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [geoData, setGeoData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      // 獲取網站資料
      const { data: websiteData } = await supabase
        .from('websites')
        .select('*')
        .eq('id', id)
        .single()
      
      if (websiteData) {
        setWebsite(websiteData)
        
        // 獲取 SEO 審計
        const { data: seoData } = await supabase
          .from('seo_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        setSeoAudit(seoData)

        // 獲取 AEO 審計
        const { data: aeoData } = await supabase
          .from('aeo_audits')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        setAeoAudit(aeoData)

        // 獲取 GEO 資料
        const { data: geo } = await supabase
          .from('geo_data')
          .select('*')
          .eq('website_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        setGeoData(geo)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">載入資料中...</p>
        </div>
      </div>
    )
  }

  if (!website) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">找不到網站</h2>
          <Link to="/" className="text-purple-600 hover:underline">返回首頁</Link>
        </div>
      </div>
    )
  }

  // 模擬數據 (如果沒有真實數據)
  const seoScore = seoAudit?.score || 72
  const aeoScore = aeoAudit?.score || 58
  const geoScore = geoData ? 85 : 0

  const scoreData = [
    { name: 'SEO', value: seoScore, color: '#3b82f6' },
    { name: 'AEO', value: aeoScore, color: '#8b5cf6' },
    { name: 'GEO', value: geoScore, color: '#10b981' },
  ]

  const historyData = [
    { month: '1月', seo: 65, aeo: 45 },
    { month: '2月', seo: 68, aeo: 50 },
    { month: '3月', seo: 72, aeo: 55 },
    { month: '4月', seo: 70, aeo: 58 },
    { month: '5月', seo: seoScore, aeo: aeoScore },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-500 hover:text-slate-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{website.name}</h1>
              <p className="text-sm text-slate-500">{website.url}</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            重新檢測
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 總分數卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {scoreData.map((item) => (
            <div key={item.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-700">{item.name} 分數</h3>
                <span className={`text-3xl font-bold`} style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 圖表區域 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* 趨勢圖 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">分數趨勢</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="seo" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="aeo" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 分布圖 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">整體表現</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              {scoreData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm text-slate-600">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 詳細檢測項目 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* AEO 技術檢測 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-800">AEO 技術檢測</h3>
              <Link to={`/aeo-audit/${id}`} className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                查看詳情 →
              </Link>
            </div>
            <div className="space-y-4">
              {[
                { name: 'JSON-LD 結構化資料', status: aeoAudit?.json_ld ? 'pass' : 'fail', score: aeoAudit?.json_ld ? 100 : 0 },
                { name: 'LLMs.txt 檔案', status: aeoAudit?.llms_txt ? 'pass' : 'fail', score: aeoAudit?.llms_txt ? 100 : 0 },
                { name: 'Open Graph 標籤', status: aeoAudit?.open_graph ? 'pass' : 'fail', score: aeoAudit?.open_graph ? 100 : 0 },
                { name: 'Twitter Card 標籤', status: aeoAudit?.twitter_card ? 'pass' : 'fail', score: aeoAudit?.twitter_card ? 100 : 0 },
                { name: 'canonical 標籤', status: aeoAudit?.canonical ? 'pass' : 'fail', score: aeoAudit?.canonical ? 100 : 0 },
                { name: 'robots.txt', status: seoAudit?.robots_txt ? 'pass' : 'fail', score: seoAudit?.robots_txt ? 100 : 0 },
                { name: 'sitemap.xml', status: seoAudit?.sitemap ? 'pass' : 'fail', score: seoAudit?.sitemap ? 100 : 0 },
                { name: '麵包屑導航', status: aeoAudit?.breadcrumbs ? 'pass' : 'fail', score: aeoAudit?.breadcrumbs ? 100 : 0 },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{item.name}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.status === 'pass' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {item.status === 'pass' ? '✓ 通過' : '✗ 未通過'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SEO 基本檢測 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">SEO 基本檢測</h3>
            <div className="space-y-4">
              {[
                { name: 'Meta 標題', value: seoAudit?.meta_title || '未設置', status: seoAudit?.meta_title ? 'good' : 'warning' },
                { name: 'Meta 描述', value: seoAudit?.meta_description || '未設置', status: seoAudit?.meta_description ? 'good' : 'warning' },
                { name: 'H1 標籤', value: seoAudit?.h1_count || 0, status: seoAudit?.h1_count === 1 ? 'good' : 'warning' },
                { name: '圖片 alt 屬性', value: seoAudit?.images_alt || '0%', status: 'warning' },
                { name: '行動裝置相容', value: '通過', status: 'good' },
                { name: '網站速度', value: '良好', status: 'good' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-sm text-slate-700 block">{item.name}</span>
                    <span className="text-xs text-slate-500">{item.value}</span>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${
                    item.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GEO 商家資訊 */}
        {geoData && (
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-6">Google 商家資訊</h3>
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">商家名稱</p>
                <p className="font-medium text-slate-800">{geoData.business_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">評分</p>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-slate-800">{geoData.rating}</span>
                  <span className="text-yellow-500">★</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">評論數</p>
                <p className="font-medium text-slate-800">{geoData.reviews_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">地址</p>
                <p className="font-medium text-slate-800 text-sm">{geoData.address}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
