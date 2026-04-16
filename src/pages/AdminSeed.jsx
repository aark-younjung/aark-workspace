import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SEED_SITES = [
  { name: '彩泥窯',            url: 'https://saideigama.com',          category: '陶芸', seo: 48, aeo: 28, geo: 22, eeat: 55 },
  { name: '出西窯',            url: 'https://www.shussai.jp',          category: '陶芸', seo: 52, aeo: 30, geo: 24, eeat: 62 },
  { name: '東京窯志舎',        url: 'https://www.yousisha.jp',         category: '陶芸', seo: 44, aeo: 25, geo: 20, eeat: 50 },
  { name: '染司よしおか',      url: 'https://textiles-yoshioka.com',   category: '染織', seo: 55, aeo: 32, geo: 26, eeat: 68 },
  { name: '京藍染師 松崎 陸',  url: 'https://matsuzakiriku.com',       category: '染織', seo: 42, aeo: 22, geo: 18, eeat: 52 },
  { name: '亀屋良長',          url: 'https://kameya-yoshinaga.com',    category: '和菓子', seo: 60, aeo: 38, geo: 30, eeat: 70 },
  { name: '御菓子司 紅谷三宅', url: 'https://beniyamiyake.com',        category: '和菓子', seo: 46, aeo: 26, geo: 20, eeat: 58 },
  { name: '革工房むくり',      url: 'https://kobo-mukuri.com',         category: '革工芸', seo: 50, aeo: 30, geo: 24, eeat: 54 },
  { name: '水谷醤油醸造場',    url: 'https://www.mizutani-shoyu.com',  category: '醸造', seo: 45, aeo: 24, geo: 19, eeat: 65 },
  { name: '松本醤油商店',      url: 'https://www.hatsukari.co.jp',     category: '醸造', seo: 53, aeo: 28, geo: 22, eeat: 63 },
  { name: '杉原酒造',          url: 'https://www.sugiharasake.jp',     category: '酒蔵', seo: 49, aeo: 27, geo: 21, eeat: 67 },
  { name: '鈴木盛久工房',      url: 'https://suzukimorihisa.com',      category: '鉄器', seo: 56, aeo: 33, geo: 25, eeat: 72 },
  { name: '有喜屋',            url: 'https://www.ukiya.co.jp',         category: '蕎麦', seo: 58, aeo: 35, geo: 28, eeat: 64 },
  { name: '手打ち蕎麦汐見',    url: 'https://www.sobashiomi.com',      category: '蕎麦', seo: 40, aeo: 20, geo: 16, eeat: 55 },
  { name: 'すすむ屋茶店',      url: 'https://susumuya.com',            category: '茶', seo: 62, aeo: 40, geo: 32, eeat: 60 },
  { name: '妙香園',            url: 'https://myokoen.com',             category: '茶', seo: 54, aeo: 29, geo: 23, eeat: 66 },
  { name: 'ブックスキューブリック', url: 'https://bookskubrick.jp',    category: '書店', seo: 63, aeo: 42, geo: 34, eeat: 58 },
  { name: 'エカワ珈琲店',      url: 'https://www.ekawacoffee.jp',      category: '珈琲', seo: 47, aeo: 26, geo: 21, eeat: 52 },
  { name: 'お宿 野の花',       url: 'https://www.oyado-nonohana.com',  category: '旅館', seo: 51, aeo: 29, geo: 23, eeat: 61 },
  { name: '御幸荘 花結び',     url: 'https://www.hanamusubi.co.jp',    category: '旅館', seo: 57, aeo: 34, geo: 27, eeat: 66 },
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
    <div className="min-h-screen  p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Seed Tool</h1>
        <p className="text-white/60 text-sm mb-6">寫入 20 個日本小品牌網站的模擬分析數據（每站 3 輪歷史記錄）</p>

        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-2 text-sm text-white/60 mb-4">
            {SEED_SITES.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-white/80 font-mono text-xs w-4">{i + 1}</span>
                <span className="text-white">{s.name}</span>
                <span className="text-white/60 text-xs">{s.category}</span>
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
              <div key={i} className={`mb-0.5 ${l.type === 'success' ? 'text-green-400' : l.type === 'error' ? 'text-red-400' : 'text-white/60'}`}>
                <span className="text-white/80 mr-2">{l.ts}</span>{l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
