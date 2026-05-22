/**
 * /website-summary/:id — 公開網站摘要頁
 *
 * 設計目的：TOP 8 排行榜點進來看的「對外公開版」，只顯示 5 大面向總分與小幅敘述，
 * 不顯示具體哪幾項通過 / 不通過、不顯示問題說明與修復建議
 * （那些屬於網主的私密診斷細節）。
 *
 * 隱私分層：
 *   /website-summary/:id  — 公開、只顯示分數彙總（本頁）
 *   /dashboard/:id        — 登入後的完整分析（網主自己看）
 *
 * 對未登入訪客也可看（公開頁），但末尾 CTA 引導註冊 + 加入自己網站。
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { T } from '../styles/v2-tokens'
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { GlassCard } from '../components/v2'

const FACES = [
  { id: 'seo',     name: 'SEO',     color: '#3b82f6', desc: '搜尋優化（傳統 Google 排名因素）' },
  { id: 'aeo',     name: 'AEO',     color: '#8b5cf6', desc: '答案引擎優化（精選摘要 / 結構化資料）' },
  { id: 'geo',     name: 'GEO',     color: '#10b981', desc: '生成引擎優化（AI 引用率）' },
  { id: 'eeat',    name: 'E-E-A-T', color: '#f59e0b', desc: '經驗・專業・權威・信任（Google 品質評估）' },
  { id: 'content', name: '內容品質', color: '#ec4899', desc: '可讀性 / 結構 / 多媒體完整度' },
]

function scoreColor(s) {
  if (s == null) return '#475569'
  if (s >= 70) return '#10b981'
  if (s >= 40) return '#f59e0b'
  return '#ef4444'
}

export default function WebsiteSummary() {
  const { id } = useParams()
  const [website, setWebsite] = useState(null)
  const [scores, setScores] = useState({})  // { seo, aeo, geo, eeat, content }
  const [scanCount, setScanCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      // 1. 拉 website 基本資料（額外取 is_public_optout / is_test_site 判斷可不可看）
      const { data: w } = await supabase
        .from('websites')
        .select('id, name, url, created_at, is_public_optout, is_test_site')
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      if (!w || w.is_public_optout || w.is_test_site) {
        // opt-out 或測試網站直接視為不存在（給外部訪客看不見）
        setNotFound(true)
        setLoading(false)
        return
      }
      setWebsite(w)

      // 2. 並行拉 5 大面向最新分數 + 總掃描次數
      const [seoRes, aeoRes, geoRes, eeatRes, contentRes, countRes] = await Promise.all([
        supabase.from('seo_audits').select('score, created_at').eq('website_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('aeo_audits').select('score, created_at').eq('website_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('geo_audits').select('score, created_at').eq('website_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('eeat_audits').select('score, created_at').eq('website_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('content_audits').select('score, created_at').eq('website_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('seo_audits').select('*', { count: 'exact', head: true }).eq('website_id', id),
      ])
      if (cancelled) return
      setScores({
        seo:     seoRes.data?.score ?? null,
        aeo:     aeoRes.data?.score ?? null,
        geo:     geoRes.data?.score ?? null,
        eeat:    eeatRes.data?.score ?? null,
        content: contentRes.data?.score ?? null,
      })
      setScanCount(countRes.count || 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  const validScores = Object.values(scores).filter(s => s != null)
  const totalScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null
  const hostname = (() => {
    try { return new URL(website?.url || '').hostname.replace(/^www\./, '') } catch { return website?.url || '' }
  })()

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: T.font }}>
      <SiteHeader />

      <main className="max-w-4xl mx-auto px-4 py-12">
        {loading ? (
          <p className="text-center text-slate-400 py-20">載入中⋯</p>
        ) : notFound ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-3">🔍</p>
            <p className="text-slate-300 text-lg mb-2">找不到這個網站的公開摘要</p>
            <p className="text-slate-500 text-sm mb-6">可能網站不存在，或網主選擇不在排行榜公開</p>
            <Link to="/" className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-semibold">回首頁</Link>
          </div>
        ) : (
          <>
            {/* 標題區 */}
            <div className="mb-8 text-center">
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-2">AI 能見度公開摘要</p>
              <h1 className="text-3xl font-bold mb-1" style={{ color: T.text }}>{website.name || hostname}</h1>
              <a href={website.url} target="_blank" rel="noopener noreferrer"
                className="text-slate-500 text-sm hover:text-orange-400 transition-colors">
                {hostname} →
              </a>
              <p className="text-slate-600 text-xs mt-3">
                累計掃描 <strong className="text-slate-400">{scanCount}</strong> 次
              </p>
            </div>

            {/* 總分大圓 */}
            {totalScore != null && (
              <div className="mb-8 flex justify-center">
                <GlassCard style={{ padding: 28, textAlign: 'center', maxWidth: 280 }}>
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">綜合 AI 能見度</p>
                  <div className="text-7xl font-black mb-1" style={{ color: scoreColor(totalScore) }}>
                    {totalScore}
                  </div>
                  <p className="text-slate-500 text-xs">／ 100 分</p>
                </GlassCard>
              </div>
            )}

            {/* 5 大面向卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
              {FACES.map(face => {
                const s = scores[face.id]
                return (
                  <GlassCard key={face.id} style={{ padding: 18, textAlign: 'center' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: face.color }}>{face.name}</p>
                    <div className="text-3xl font-black mb-1" style={{ color: scoreColor(s) }}>
                      {s != null ? s : '—'}
                    </div>
                    <p className="text-slate-600 text-[10px] leading-tight">{face.desc}</p>
                  </GlassCard>
                )
              })}
            </div>

            {/* 隱私說明 + CTA */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-center">
              <p className="text-slate-300 text-sm mb-2">
                🔒 這是公開摘要頁，<strong>只顯示總分</strong>，不公開具體哪些檢測項通過或未通過。
              </p>
              <p className="text-slate-500 text-xs mb-5">
                完整分析報告（含 30+ 檢測項、修復建議、修復碼）只有網主登入後可看
              </p>
              <Link
                to="/register"
                className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg text-white text-sm font-semibold transition-colors"
              >
                免費註冊・分析你自己的網站 →
              </Link>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}
