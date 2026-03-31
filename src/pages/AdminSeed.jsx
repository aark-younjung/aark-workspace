import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SEED_SITES = [
  { name: 'ONIBUS COFFEE',        url: 'https://onibuscoffee.com',       category: '咖啡', seo: 58, aeo: 42, geo: 38, eeat: 52 },
  { name: 'Leaves Coffee Roasters', url: 'https://leavescoffee.jp',      category: '咖啡', seo: 54, aeo: 38, geo: 35, eeat: 48 },
  { name: 'Kurasu',                url: 'https://kurasu.kyoto',           category: '咖啡', seo: 62, aeo: 50, geo: 44, eeat: 55 },
  { name: 'Tasse Coffee Roastery', url: 'https://tasse-coffee.jp',       category: '咖啡', seo: 50, aeo: 35, geo: 30, eeat: 44 },
  { name: "Comme'N TOKYO",         url: 'https://commen.jp',             category: '烘焙', seo: 55, aeo: 40, geo: 33, eeat: 50 },
  { name: 'PANYA Artisan Bakery',  url: 'https://panya-bakery.com',      category: '烘焙', seo: 48, aeo: 32, geo: 28, eeat: 42 },
  { name: 'HERZ',                  url: 'https://www.herz-bag.jp',       category: '皮革', seo: 60, aeo: 44, geo: 40, eeat: 58 },
  { name: 'Kanmi.',                url: 'https://www.kanmi.jp',          category: '皮革', seo: 56, aeo: 41, geo: 36, eeat: 53 },
  { name: 'SLOW',                  url: 'https://www.slow-web.com',      category: '皮革', seo: 52, aeo: 38, geo: 34, eeat: 49 },
  { name: 'North Candles',         url: 'https://northcandles.jp',       category: '蠟燭', seo: 46, aeo: 30, geo: 26, eeat: 40 },
  { name: '松井蝋燭工場',           url: 'https://www.candle-jap.com',   category: '蠟燭', seo: 44, aeo: 28, geo: 24, eeat: 55 },
  { name: 'haccoba',               url: 'https://haccoba.com',           category: '釀造', seo: 63, aeo: 48, geo: 42, eeat: 57 },
  { name: 'blablahospital',        url: 'https://blablahospital.com',    category: '時尚', seo: 57, aeo: 45, geo: 38, eeat: 46 },
  { name: 'TAG STATIONERY',        url: 'https://store.tagstationery.jp',category: '文具', seo: 53, aeo: 36, geo: 31, eeat: 47 },
  { name: 'ex. Flower Shop',       url: 'https://www.ex-flower.com',    category: '花藝', seo: 59, aeo: 43, geo: 37, eeat: 51 },
  { name: 'Florist IGUSA',         url: 'https://florist-igusa.com',     category: '花藝', seo: 45, aeo: 29, geo: 25, eeat: 43 },
  { name: 'The Little Shop of Flowers', url: 'https://store.thelittleshopofflowers.jp', category: '花藝', seo: 50, aeo: 34, geo: 30, eeat: 46 },
  { name: 'TNCA Ceramics',         url: 'https://tnca.tokyo',            category: '陶藝', seo: 47, aeo: 31, geo: 27, eeat: 44 },
  { name: 'Studio RAN',            url: 'https://studioran.tokyo',       category: '設計', seo: 61, aeo: 47, geo: 41, eeat: 53 },
  { name: 'Nid Tokyo',             url: 'https://store.nid-tokyo.com',   category: '選物', seo: 55, aeo: 39, geo: 33, eeat: 48 },
]

// 產生三個時間點（3個月前、1個月前、最近）
const genTimes = () => {
  const now = Date.now()
  return [
    new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(now - Math.floor(Math.random() * 7 * 24 * 60) * 60000).toISOString(),
  ]
}

// 依時間點產生分數（早期低、逐漸提升）
const scoreAt = (final, t) => {
  const deltas = [-Math.floor(Math.random() * 18 + 8), -Math.floor(Math.random() * 8 + 2), 0]
  return Math.max(10, final + deltas[t])
}

export default function AdminSeed() {
  const [log, setLog] = useState([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  const addLog = (msg, type = 'info') => setLog(prev => [...prev, { msg, type, ts: new Date().toLocaleTimeString() }])

  const runSeed = async () => {
    setRunning(true)
    setLog([])
    setDone(false)

    for (const site of SEED_SITES) {
      addLog(`▶ 處理 ${site.name}...`)

      // 確認或建立 website 記錄
      const { data: existing } = await supabase.from('websites').select('id').eq('url', site.url).maybeSingle()
      let websiteId = existing?.id

      if (!websiteId) {
        const { data, error } = await supabase.from('websites').insert([{ name: site.name, url: site.url }]).select().single()
        if (error) { addLog(`  ✗ 建立失敗: ${error.message}`, 'error'); continue }
        websiteId = data.id
        addLog(`  ✓ 網站建立完成`, 'success')
      } else {
        addLog(`  ℹ 已存在，跳過建立`)
      }

      const times = genTimes()

      // 寫入 3 輪 audit 記錄
      for (let t = 0; t < 3; t++) {
        const seo = scoreAt(site.seo, t)
        const aeo = scoreAt(site.aeo, t)
        const geo = scoreAt(site.geo, t)
        const eeat = scoreAt(site.eeat, t)
        const ts = times[t]

        await supabase.from('seo_audits').insert([{
          website_id: websiteId, score: seo, created_at: ts,
          meta_tags: { titleLength: 45, descriptionLength: 120 },
          h1_structure: { count: 1 }, alt_tags: { coverage: seo > 55 ? 80 : 50 },
          mobile_compatible: seo > 50, page_speed: { loadTime: 2200 - seo * 10 }
        }])
        await supabase.from('aeo_audits').insert([{
          website_id: websiteId, score: aeo, created_at: ts,
          json_ld: aeo > 45, faq_schema: aeo > 50, canonical: aeo > 35,
          breadcrumbs: aeo > 40, open_graph: aeo > 38, question_headings: aeo > 42
        }])
        await supabase.from('geo_audits').insert([{
          website_id: websiteId, score: geo, created_at: ts,
          llms_txt: geo > 45, robots_ai: geo > 38, sitemap: geo > 30,
          open_graph: geo > 35, twitter_card: geo > 40, json_ld_citation: geo > 42,
          canonical: geo > 32, https: true
        }])
        await supabase.from('eeat_audits').insert([{
          website_id: websiteId, score: eeat, created_at: ts,
          author_info: eeat > 55, about_page: eeat > 42, contact_page: eeat > 40,
          privacy_policy: eeat > 45, organization_schema: eeat > 58,
          date_published: eeat > 48, social_links: eeat > 44, outbound_links: eeat > 50
        }])
      }

      addLog(`  ✓ 3 輪分析記錄寫入完成 (SEO:${site.seo} AEO:${site.aeo} GEO:${site.geo})`, 'success')
      await new Promise(r => setTimeout(r, 200))
    }

    addLog('🎉 全部完成！', 'success')
    setRunning(false)
    setDone(true)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Seed Tool</h1>
        <p className="text-slate-400 text-sm mb-6">寫入 20 個日本小品牌網站的模擬分析數據（每站 3 輪歷史記錄）</p>

        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-400 mb-4">
            {SEED_SITES.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-slate-600 font-mono text-xs w-4">{i + 1}</span>
                <span className="text-white">{s.name}</span>
                <span className="text-slate-500 text-xs">{s.category}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={runSeed}
          disabled={running || done}
          className="w-full py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
        >
          {running ? '⏳ 執行中...' : done ? '✅ 已完成' : '🚀 開始寫入種子資料'}
        </button>

        {log.length > 0 && (
          <div className="bg-black rounded-xl p-4 font-mono text-xs max-h-96 overflow-y-auto">
            {log.map((l, i) => (
              <div key={i} className={`mb-0.5 ${l.type === 'success' ? 'text-green-400' : l.type === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                <span className="text-slate-600 mr-2">{l.ts}</span>{l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
