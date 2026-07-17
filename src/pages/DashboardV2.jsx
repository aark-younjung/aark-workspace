/**
 * DashboardV2 — prototype-2b 設計實作（B1 phase）
 *
 * 結構（對齊 _prototypes/prototype-2b-dashboard-monitor-centric.html）：
 *   1. SiteHeader（共用）
 *   2. TopBar：返回 + 網站名 + 重新檢測 / 匯出 PDF
 *   3. ✨ aivis Hero（左大主視覺 + 右 gamify rail 三張卡）
 *   4. Notice strip（取代走馬燈、Dashboard 一格通知欄）
 *   5. Quest Section（今日任務 = 遊戲化 Action Center）
 *   6. 站點體檢 5 Tab wrapper（SEO / AEO / GEO / EEAT / 內容品質）
 *   7. 30 天進步曲線
 *   8. Footer
 *
 * B1 phase 範圍：
 *   - UI 骨架完整、樣式對齊 prototype-2b
 *   - gamification 用 mock 資料（level 5 青銅 / streak 5 / 3 個解鎖徽章）
 *   - 5 Tab 內容簡化（顯示分數 + drill-down link、完整 prototype-4 在 B3 補）
 *   - 砍永久早鳥 banner、砍走馬燈（這頁不引入）
 *   - 路由：/dashboard-v2/:id（舊版 /dashboard/:id 不影響）
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SiteHeader from '../components/v2/SiteHeader'
// 2026-06-06：公告從 BriefingCard 改成 SiteHeader 右上角 NotificationBell、Dashboard 不再單獨放卡片
// 2026-06-06：本週 AI 趨勢卡 — 用 aivis 累積資料反推「跨用戶 AI 提及 Top 5」、創造每週回訪動機
import WeeklyAITrendsCard from '../components/v2/WeeklyAITrendsCard'
import LeadingLaggingGuide from '../components/v2/LeadingLaggingGuide'
import BrandMentionsCard from '../components/v2/BrandMentionsCard'
// 2026-06-07：客戶提案 PDF 產生器（白標）— 代理商賺錢角度（5 AI 共識最大缺口）
import ClientReportModal from '../components/v2/ClientReportModal'
import LLMOChecklistModal from '../components/v2/LLMOChecklistModal'
import Footer from '../components/Footer'
import HeartbeatTrend from '../components/HeartbeatTrend'
import logoChatGPT from '../assets/engines/chatgpt.svg'
import logoClaude from '../assets/engines/claude.svg'
import logoPerplexity from '../assets/engines/perplexity.svg'
import logoGemini from '../assets/engines/gemini.svg'
import logoGrok from '../assets/engines/grok.svg'
import { T } from '../styles/v2-tokens'
import { analyzeContent } from '../services/contentAnalyzer'
import { analyzeSEO, fetchPageContent, parseHTML } from '../services/seoAnalyzer'
import { analyzeAEO } from '../services/aeoAnalyzer'
import { analyzeGEO } from '../services/geoAnalyzer'
import { analyzeEEAT } from '../services/eeatAnalyzer'
import { useGamification } from '../hooks/useGamification'
import { recordFixEvent } from '../lib/fixEvents'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'

// ─── 5 大面向色 token ───────────────────────────────────
const FACE_COLORS = {
  seo: '#3b82f6',
  aeo: '#8b5cf6',
  geo: '#10b981',
  eeat: '#f59e0b',
  content: '#ec4899',
}
const FACE_BG = {
  seo: 'rgba(59,130,246,0.18)',
  aeo: 'rgba(139,92,246,0.18)',
  geo: 'rgba(16,185,129,0.18)',
  eeat: 'rgba(245,158,11,0.18)',
  content: 'rgba(236,72,153,0.18)',
}
const FACE_BORDER = {
  seo: 'rgba(59,130,246,0.4)',
  aeo: 'rgba(139,92,246,0.4)',
  geo: 'rgba(16,185,129,0.4)',
  eeat: 'rgba(245,158,11,0.4)',
  content: 'rgba(236,72,153,0.4)',
}

// B2 上線後 gamification 從 useGamification hook 即時計算、不再用 MOCK

// Gap 2（2026-06-05）— Action Center 接真資料：從 4 大 audit 失敗項萃取 quest、按優先級排 top 3
// 之前是 MOCK_QUESTS 寫死 3 個；現在從 audit 真實結果動態產出
//
// quest 結構：{ id, face, icon, title, desc, est, mins, link, done, priority }
//   priority 越高越優先（10 為最高、1 為最低）— 用於 sort
//   done 目前一律 false（fix_events 表追 BulkScan finding 不追 audit check、之後可串）
function generateQuests({ seoAudit, aeoAudit, geoAudit, eeatAudit, websiteId }) {
  const quests = []

  // ── SEO（meta_tags / h1_structure / alt_tags / mobile / speed 是 JSONB、各自有 passed flag）
  if (seoAudit) {
    if (seoAudit.meta_tags && seoAudit.meta_tags.passed === false) {
      quests.push({ id: 'seo-meta', face: 'seo', priority: 9, icon: '🏷️',
        title: '修 Meta 標籤', desc: 'Title / Description 缺漏或不在建議字數內、Google SERP 顯示會殘缺',
        est: 8, mins: 15, link: `/seo-audit/${websiteId}`, done: false })
    }
    if (seoAudit.h1_structure && seoAudit.h1_structure.passed === false) {
      quests.push({ id: 'seo-h1', face: 'seo', priority: 8, icon: '📰',
        title: '修 H1 結構', desc: '頁面缺 H1 或多個 H1 — SEO 權重會被稀釋',
        est: 6, mins: 10, link: `/seo-audit/${websiteId}`, done: false })
    }
    if (seoAudit.alt_tags && seoAudit.alt_tags.passed === false) {
      quests.push({ id: 'seo-alt', face: 'seo', priority: 5, icon: '🖼️',
        title: '補圖片 alt 文字', desc: '無障礙 + SEO 兼顧、AI 也吃 alt 來理解圖片',
        est: 4, mins: 20, link: `/seo-audit/${websiteId}`, done: false })
    }
    if (seoAudit.bot_accessibility && seoAudit.bot_accessibility.passed === false) {
      quests.push({ id: 'seo-bot', face: 'seo', priority: 10, icon: '🚦',
        title: 'anti-bot／WAF 在擋 ChatGPT', desc: 'AI 爬蟲根本進不來、修這個分數會跳很多',
        est: 12, mins: 5, link: `/seo-audit/${websiteId}`, done: false })
    }
  }

  // ── AEO（boolean columns: json_ld / faq_schema / canonical / breadcrumbs / open_graph / question_headings）
  if (aeoAudit) {
    if (!aeoAudit.json_ld) {
      quests.push({ id: 'aeo-jsonld', face: 'aeo', priority: 10, icon: '📜',
        title: '加 JSON-LD 結構化資料', desc: 'AI 沒辦法理解你的頁面結構、修這個 AI 引用率會大幅提升',
        est: 12, mins: 30, link: `/aeo-audit/${websiteId}`, done: false })
    }
    if (!aeoAudit.faq_schema) {
      quests.push({ id: 'aeo-faq', face: 'aeo', priority: 9, icon: '🤖',
        title: '補 FAQ Schema', desc: aeoAudit.faq_visual
          ? '頁面有 FAQ 但缺 schema、AI 看不到你的問答'
          : 'AI 引用率會提升 ~15%、特別適合教學 / 服務內容',
        est: 8, mins: 25, link: `/aeo-audit/${websiteId}`, done: false })
    }
    if (!aeoAudit.open_graph) {
      quests.push({ id: 'aeo-og', face: 'aeo', priority: 6, icon: '🔗',
        title: '補 Open Graph 標籤', desc: 'FB / LINE / X 分享預覽會空白、social CTR 會差',
        est: 5, mins: 15, link: `/aeo-audit/${websiteId}`, done: false })
    }
    if (!aeoAudit.canonical) {
      quests.push({ id: 'aeo-canon', face: 'aeo', priority: 4, icon: '🔒',
        title: '加 Canonical 標籤', desc: '避免重複內容懲罰、告訴 AI 引用哪個 URL',
        est: 3, mins: 10, link: `/aeo-audit/${websiteId}`, done: false })
    }
  }

  // ── GEO（boolean: llms_txt / robots_ai / sitemap / json_ld_citation 等）
  if (geoAudit) {
    if (!geoAudit.llms_txt) {
      quests.push({ id: 'geo-llms', face: 'geo', priority: 9, icon: '🤖',
        title: '建 llms.txt', desc: '告訴 ChatGPT / Claude 怎麼讀你的網站、LLMO 必備',
        est: 6, mins: 10, link: `/geo-audit/${websiteId}`, done: false })
    }
    if (!geoAudit.robots_ai) {
      quests.push({ id: 'geo-robots', face: 'geo', priority: 10, icon: '🚦',
        title: '檢查 robots.txt 沒擋 AI 爬蟲', desc: 'GPTBot / Google-Extended 被擋的話 AI 完全找不到你',
        est: 10, mins: 5, link: `/geo-audit/${websiteId}`, done: false })
    }
    if (!geoAudit.sitemap) {
      quests.push({ id: 'geo-sitemap', face: 'geo', priority: 7, icon: '🗺️',
        title: '建 sitemap.xml', desc: '幫 AI 爬蟲快速發現所有頁面',
        est: 5, mins: 5, link: `/geo-audit/${websiteId}`, done: false })
    }
    if (!geoAudit.json_ld_citation) {
      quests.push({ id: 'geo-citation', face: 'geo', priority: 7, icon: '📚',
        title: '補 JSON-LD 引用訊號', desc: '加 author / publisher / datePublished、AI 判斷可信度',
        est: 6, mins: 20, link: `/geo-audit/${websiteId}`, done: false })
    }
  }

  // ── E-E-A-T（boolean: author_info / about_page / contact_page / privacy_policy / organization_schema / 等）
  if (eeatAudit) {
    if (!eeatAudit.organization_schema) {
      quests.push({ id: 'eeat-orgschema', face: 'eeat', priority: 8, icon: '🏢',
        title: '加 Organization Schema', desc: '告訴 Google 你是誰、品牌可信度核心訊號',
        est: 7, mins: 15, link: `/eeat-audit/${websiteId}`, done: false })
    }
    if (!eeatAudit.author_info) {
      quests.push({ id: 'eeat-author', face: 'eeat', priority: 6, icon: '⭐',
        title: '加作者署名', desc: '文章缺作者資訊、E-E-A-T 分數會 +6、AI 判斷你可信',
        est: 6, mins: 15, link: `/eeat-audit/${websiteId}`, done: false })
    }
    if (!eeatAudit.about_page) {
      quests.push({ id: 'eeat-about', face: 'eeat', priority: 5, icon: '👥',
        title: '建關於我們頁', desc: 'AI 找不到「你是誰」就不會推薦你',
        est: 5, mins: 30, link: `/eeat-audit/${websiteId}`, done: false })
    }
    if (!eeatAudit.privacy_policy) {
      quests.push({ id: 'eeat-privacy', face: 'eeat', priority: 4, icon: '🔐',
        title: '加隱私權政策', desc: 'AI 看你有沒有合規意識的訊號',
        est: 3, mins: 20, link: `/eeat-audit/${websiteId}`, done: false })
    }
  }

  // 按優先級降序、回傳 top 3（先做最關鍵的）
  return quests.sort((a, b) => b.priority - a.priority).slice(0, 3)
}

export default function DashboardV2() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isPro, isTrial, trialDaysRemaining } = useAuth()
  // B2: gamification 真資料 — 從用戶的 audits 反推 level/xp/streak/badges
  const gamify = useGamification(user?.id)
  // C2-C4: 比對 localStorage 上次看到的狀態、偵測 level up / 新解鎖徽章 / XP 增加
  //        delta 結果驅動 LevelUpOverlay + BadgeUnlockEffect 動畫
  const delta = useGamificationDelta(user?.id, gamify)

  const [website, setWebsite] = useState(null)
  const [seoAudit, setSeoAudit] = useState(null)
  const [aeoAudit, setAeoAudit] = useState(null)
  const [geoAudit, setGeoAudit] = useState(null)
  const [eeatAudit, setEeatAudit] = useState(null)
  const [seoHistory, setSeoHistory] = useState([])
  const [aeoHistory, setAeoHistory] = useState([])
  const [geoHistory, setGeoHistory] = useState([])
  const [eeatHistory, setEeatHistory] = useState([])
  const [contentScore, setContentScore] = useState(null)
  // B3: content tab 用的詳細資料
  const [contentLatest, setContentLatest] = useState(null)   // 最新一筆 content_audits 完整 row（含 heading/meta/aeo/eeat/multimedia JSONB）
  const [contentHistory, setContentHistory] = useState([])   // 30 天內所有 content_audits（給 sparkline + 月 stats）
  const [loading, setLoading] = useState(true)
  // Gap 1（2026-06-05）— 新用戶 onboarding 空狀態用、按下「開始第一次檢測」時用
  const [scanning, setScanning] = useState(false)
  // 2026-06-07：客戶提案 PDF Modal 開關
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  // 2026-06-08：LLMO 6 週執行清單 PDF modal 狀態（TopBar「📋 6 週清單」按鈕觸發）
  const [checklistModalOpen, setChecklistModalOpen] = useState(false)

  // 5 Tab nav active
  const [activeFace, setActiveFace] = useState('seo')

  // 載資料 — 同舊 Dashboard.jsx 的 fetchData 但更精簡
  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: w } = await supabase.from('websites').select('*').eq('id', id).single()
        if (cancelled) return
        if (!w) { setLoading(false); return }
        setWebsite(w)

        // 4 大 audit + history 平行抓
        const [seo, aeo, geo, eeat] = await Promise.all([
          supabase.from('seo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(20),
          supabase.from('aeo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(20),
          supabase.from('geo_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(10),
          supabase.from('eeat_audits').select('*').eq('website_id', id).order('created_at', { ascending: false }).limit(10),
        ])
        if (cancelled) return
        if (seo.data?.length) { setSeoAudit(seo.data[0]); setSeoHistory(seo.data.slice(0, 10).reverse()) }
        if (aeo.data?.length) { setAeoAudit(aeo.data[0]); setAeoHistory(aeo.data.slice(0, 10).reverse()) }
        if (geo.data?.length) { setGeoAudit(geo.data[0]); setGeoHistory(geo.data.slice(0, 10).reverse()) }
        if (eeat.data?.length){ setEeatAudit(eeat.data[0]); setEeatHistory(eeat.data.slice(0, 10).reverse()) }

        // 內容分數 — B3：抓最近 30 天歷史 + 最新一筆完整 row（含 JSONB）
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: hist } = await supabase
          .from('content_audits')
          .select('id, score, heading, word_count, meta, aeo, author, images, links, outbound, multimedia, readability, created_at')
          .eq('website_id', id)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
        if (cancelled) return

        if (hist && hist.length > 0) {
          const latest = hist[hist.length - 1]
          setContentLatest(latest)
          setContentHistory(hist)
          setContentScore(latest.score)
        } else {
          // 沒 cached 就跑一次 + 寫進去
          try {
            const r = await analyzeContent(w.url)
            if (r?.score != null && !cancelled) {
              const { data: inserted } = await supabase.from('content_audits').insert([{
                website_id: id,
                score: r.score,
                heading: r.heading,
                word_count: r.wordCount,
                meta: r.meta,
                aeo: r.aeo,
                author: r.author,
                images: r.images,
                links: r.links,
                outbound: r.outbound,
                multimedia: r.multimedia,
                readability: r.readability,
              }]).select().single()
              setContentScore(r.score)
              if (inserted) {
                setContentLatest(inserted)
                setContentHistory([inserted])
              }
            }
          } catch { /* swallow */ }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Gap 1（2026-06-05）— 新用戶 onboarding 的「開始第一次檢測」handler
  // 對齊 HomeDark.jsx 的 4 個 analyzer + insert pattern（line 425-496）、跑完 reload 重抓資料
  async function handleFirstScan() {
    if (!website?.url || scanning) return
    setScanning(true)
    try {
      const { html } = await fetchPageContent(website.url)
      const doc = parseHTML(html)
      const [seoResult, aeoResult, geoResult, eeatResult] = await Promise.all([
        analyzeSEO(website.url, doc).catch(() => null),
        analyzeAEO(website.url, doc).catch(() => null),
        analyzeGEO(website.url, doc).catch(() => null),
        analyzeEEAT(website.url, doc).catch(() => null),
      ])
      await Promise.allSettled([
        seoResult && supabase.from('seo_audits').insert([{
          website_id: id, score: seoResult.score,
          meta_tags: seoResult.meta_tags, h1_structure: seoResult.h1_structure,
          alt_tags: seoResult.alt_tags, mobile_compatible: seoResult.mobile_compatible,
          page_speed: seoResult.page_speed,
          ssl_chain: seoResult.ssl_chain, bot_accessibility: seoResult.bot_accessibility,
        }]),
        aeoResult && supabase.from('aeo_audits').insert([{
          website_id: id, score: aeoResult.score,
          json_ld: aeoResult.json_ld, faq_schema: aeoResult.faq_schema,
          faq_visual: aeoResult.faq_visual,
          canonical: aeoResult.canonical, breadcrumbs: aeoResult.breadcrumbs,
          open_graph: aeoResult.open_graph, question_headings: aeoResult.question_headings,
        }]),
        geoResult && supabase.from('geo_audits').insert([{
          website_id: id, score: geoResult.score,
          llms_txt: !!geoResult.llms_txt, robots_ai: !!geoResult.robots_ai,
          sitemap: !!geoResult.sitemap, open_graph: !!geoResult.open_graph,
          twitter_card: !!geoResult.twitter_card, json_ld_citation: !!geoResult.json_ld_citation,
          canonical: !!geoResult.canonical, https: !!geoResult.https,
        }]),
        eeatResult && supabase.from('eeat_audits').insert([{
          website_id: id, score: eeatResult.score,
          author_info: !!eeatResult.author_info, about_page: !!eeatResult.about_page,
          contact_page: !!eeatResult.contact_page, privacy_policy: !!eeatResult.privacy_policy,
          organization_schema: !!eeatResult.organization_schema, date_published: !!eeatResult.date_published,
          social_links: !!eeatResult.social_links, outbound_links: !!eeatResult.outbound_links,
        }]),
      ])
      // 簡單做法：reload 重抓資料、確保所有 state 都從 DB 拿最新（避免 race）
      window.location.reload()
    } catch (err) {
      console.error('First scan failed:', err)
      alert('檢測失敗，請稍後再試或回首頁重新輸入網址')
      setScanning(false)
    }
  }

  // 5 個分數彙整（從 audit 各自的 score 欄位 / contentScore state）
  const scores = {
    seo: seoAudit?.score || 0,
    aeo: aeoAudit?.score || 0,
    geo: geoAudit?.score || 0,
    eeat: eeatAudit?.score || 0,
    content: contentScore || 0,
  }
  // 加權平均（5 面向等權）
  const overallScore = Math.round((scores.seo + scores.aeo + scores.geo + scores.eeat + scores.content) / 5)

  // 趨勢資料 — SEO/AEO/GEO/EEAT 4 條線
  const trendData = seoHistory.map((s, i) => {
    const offset = seoHistory.length - 1 - i
    const aeo = aeoHistory[aeoHistory.length - 1 - offset]?.score || 0
    const geo = geoHistory[geoHistory.length - 1 - offset]?.score || 0
    const eeat = eeatHistory[eeatHistory.length - 1 - offset]?.score || 0
    return {
      name: new Date(s.created_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      SEO: s.score,
      AEO: aeo,
      GEO: geo,
      'E-E-A-T': eeat,
    }
  })

  // Loading state
  if (loading) {
    return (
      <PageBg>
        <SiteHeader />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mb-4"></div>
            <p className="text-white/60">載入儀表板中...</p>
          </div>
        </main>
      </PageBg>
    )
  }

  if (!website) {
    return (
      <PageBg>
        <SiteHeader />
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">找不到網站</h2>
            <Link to="/" className="text-teal-400 hover:text-teal-300 hover:underline">返回首頁</Link>
          </div>
        </main>
      </PageBg>
    )
  }

  return (
    <PageBg>
      <SiteHeader />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24">

        {/* ─── 試用倒數 banner（保留有用的） ─── */}
        {isTrial && trialDaysRemaining != null && trialDaysRemaining > 0 && (
          <div className="mb-4 p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-400/30 rounded-xl flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-white">
              ⏰ <span className="font-bold">Pro 試用</span> 還剩 <span className="font-mono text-amber-300 font-bold">{trialDaysRemaining}</span> 天
            </div>
            <Link to="/pricing" className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-lg hover:opacity-90">
              升級正式版
            </Link>
          </div>
        )}

        {/* ─── 頁面 TopBar：返回 + 網站名 + 動作按鈕 ─── */}
        <TopBar
          website={website}
          navigate={navigate}
          onExportPdf={() => setPdfModalOpen(true)}
          onChecklist={() => setChecklistModalOpen(true)}
          onRescan={handleFirstScan}
          rescanning={scanning}
        />

        {/* Gap 1（2026-06-05）— 還沒掃過任何網站 = 顯示 onboarding 空狀態、不渲染下方所有資料卡
            觸發條件：4 大 audit + content 全部 null（新用戶剛建 website 還沒跑分析） */}
        {!seoAudit && !aeoAudit && !geoAudit && !eeatAudit && !contentLatest ? (
          <EmptyState website={website} scanning={scanning} onScan={handleFirstScan} />
        ) : (
          <>
            {/* ─── ✨ aivis Hero + Gamify Rail（grid 8:4） ─── */}
            <section className="grid lg:grid-cols-12 gap-4 mb-6">
              <div className="lg:col-span-8">
                <AivisHero isPro={isPro} websiteName={website.name} overallScore={overallScore} trendData={trendData} />
              </div>
              <div className="lg:col-span-4">
                <GamifyRail gamify={gamify} />
              </div>
            </section>

            {/* ─── 30 天進步曲線：≥2 筆顯示真實折線（第一次掃完的心跳成形帶已嵌進上方 aivis Hero 卡片內） ─── */}
            {trendData.length > 1 && <TrendChart trendData={trendData} />}

            {/* ─── 站點體檢（5 Tab wrapper）— 移到第一屏：這是用戶掃完最想看的「答案」，排在 hero 正下方、馬上看得到 ─── */}
            <AuditSection
              scores={scores}
              activeFace={activeFace}
              setActiveFace={setActiveFace}
              website={website}
              seoAudit={seoAudit}
              aeoAudit={aeoAudit}
              geoAudit={geoAudit}
              eeatAudit={eeatAudit}
              contentLatest={contentLatest}
              contentHistory={contentHistory}
              isPro={isPro}
            />

            {/* ─── 公告改成 SiteHeader 鈴鐺、Dashboard 內不再放卡片（2026-06-06） ─── */}

            {/* ─── Audit 達標引導卡（2026-06-10）— 4 個訊號層平均 ≥ 85 時觸發
                  解決客戶痛點：「audit 100 但 AI 還是不提我」、明確說明 Leading vs Lagging 指標差異
                  內部不顯示時 component 自己 return null、不用條件包 ─── */}
            <LeadingLaggingGuide scores={scores} websiteName={website.name} />

            {/* ─── 品牌外部提及（2026-06-10 BETA）— LLMO 訊號鏈缺失的「外部曝光」維度
                  用 Google Custom Search API、抓網路上「品牌名」被提及次數 + Top 10 來源 + 操作建議
                  需 Vercel env 設 GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID、未設時 API 回 503、UI 顯示「未啟用」訊息 ─── */}
            <BrandMentionsCard defaultBrand={website.name || ''} defaultExcludeDomain={website.url || ''} />

            {/* ─── 本週 AI 趨勢卡（2026-06-06）— 用 aivis 跨用戶資料、創造每週回訪動機 ─── */}
            <WeeklyAITrendsCard />

            {/* ─── Quest Section（今日任務 = Action Center）— Gap 2（2026-06-05）接真資料 ─── */}
            <QuestSection quests={generateQuests({ seoAudit, aeoAudit, geoAudit, eeatAudit, websiteId: website.id })} />

            {/* ─── 修復工具箱（合併版單一入口） ─── */}
            <ToolBox websiteId={website.id} />

          </>
        )}

      </main>

      <Footer dark />

      {/* C3/C4: 升等 + 徽章解鎖動畫覆蓋層（觸發後 auto-dismiss） */}
      {delta.showLevelUp && (
        <LevelUpOverlay
          newLevel={delta.newLevel}
          newLevelName={delta.newLevelName}
          newEmoji={delta.newEmoji}
          onDone={delta.dismissLevelUp}
        />
      )}
      {delta.showBadgeUnlock && (
        <BadgeUnlockOverlay
          badges={delta.unlockedBadges}
          onDone={delta.dismissBadgeUnlock}
        />
      )}

      {/* 客戶提案 PDF Modal（2026-06-07）— TopBar「📄 匯出 PDF」按鈕觸發 */}
      <ClientReportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        data={{ website, seoAudit, aeoAudit, geoAudit, eeatAudit }}
      />

      {/* LLMO 6 週執行清單 Modal（2026-06-08）— TopBar「📋 6 週清單」按鈕觸發 */}
      {/* 把當下 4 大 audit 分數傳進去當 Week 0 起跑點、PDF 封面會顯示 */}
      <LLMOChecklistModal
        open={checklistModalOpen}
        onClose={() => setChecklistModalOpen(false)}
        data={{ website }}
        baselineScores={{
          seo: seoAudit?.score || 0,
          aeo: aeoAudit?.score || 0,
          geo: geoAudit?.score || 0,
          eeat: eeatAudit?.score || 0,
        }}
      />
    </PageBg>
  )
}

// ─── C2: useGamificationDelta hook ───────────────────────
// 用 localStorage 記錄「上次看到的 level / badges / XP」、本次載入時與當前 gamify 比對
// 偵測到 level 提升 → 觸發 LevelUpOverlay
// 偵測到有新解鎖徽章 → 觸發 BadgeUnlockOverlay
// 第一次造訪（lastSeen 不存在）不播動畫、只把當前狀態存下來當 baseline
function useGamificationDelta(userId, gamify) {
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showBadgeUnlock, setShowBadgeUnlock] = useState(false)
  const [unlockedBadges, setUnlockedBadges] = useState([])
  const [newLevel, setNewLevel] = useState(null)
  const [newLevelName, setNewLevelName] = useState(null)
  const [newEmoji, setNewEmoji] = useState(null)
  const processedRef = useRef(false) // 避免每次 re-render 都重新偵測 → 只在 gamify loading→loaded 那次做

  useEffect(() => {
    if (!userId) return
    if (gamify.loading) return
    if (processedRef.current) return
    processedRef.current = true

    const key = `aark-gamify-lastSeen-${userId}`
    let lastSeen = null
    try {
      const raw = localStorage.getItem(key)
      if (raw) lastSeen = JSON.parse(raw)
    } catch { /* ignore */ }

    if (!lastSeen) {
      // 首次造訪、不播動畫，只 baseline
      saveCurrent(key, gamify)
      return
    }

    // 偵測 level 提升
    if (gamify.level > lastSeen.level) {
      setNewLevel(gamify.level)
      setNewLevelName(gamify.levelName)
      setNewEmoji(gamify.emoji)
      setShowLevelUp(true)
    }

    // 偵測新解鎖徽章 — 對比 unlocked 狀態
    const oldUnlockedKeys = new Set((lastSeen.badges || []).filter(b => b.unlocked).map(b => b.key))
    const newlyUnlocked = (gamify.badges || []).filter(b => b.unlocked && !oldUnlockedKeys.has(b.key))
    if (newlyUnlocked.length > 0) {
      setUnlockedBadges(newlyUnlocked)
      // 先 level up 再 badge unlock — 沒升等就立刻播徽章
      if (!(gamify.level > lastSeen.level)) {
        setShowBadgeUnlock(true)
      }
    }

    // 不論有沒有播、都把當前存進 baseline（這次播完下次不再播相同事件）
    saveCurrent(key, gamify)
  }, [userId, gamify.loading, gamify.level, gamify.totalXp])

  const dismissLevelUp = () => {
    setShowLevelUp(false)
    // level up 收完、如果有 badge 等著、現在播
    if (unlockedBadges.length > 0) setShowBadgeUnlock(true)
  }
  const dismissBadgeUnlock = () => setShowBadgeUnlock(false)

  return {
    showLevelUp, newLevel, newLevelName, newEmoji,
    showBadgeUnlock, unlockedBadges,
    dismissLevelUp, dismissBadgeUnlock,
  }
}

function saveCurrent(key, gamify) {
  try {
    localStorage.setItem(key, JSON.stringify({
      level: gamify.level,
      totalXp: gamify.totalXp,
      badges: (gamify.badges || []).map(b => ({ key: b.key, unlocked: b.unlocked })),
      savedAt: new Date().toISOString(),
    }))
  } catch { /* ignore quota */ }
}

// ─── C3: LevelUpOverlay ─────────────────────────────────
// 對齊 prototype-3-repair-flow.html 第 568-625 行 .levelup-overlay 設計
// 全螢黑遮罩 + 中央 emoji 翻轉 360° + 銀色光環炸開 + LEVEL UP 大字
// 3 秒後自動 fade out 並呼叫 onDone
function LevelUpOverlay({ newLevel, newLevelName, newEmoji, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        animation: 'levelup-fade 3s ease-out forwards',
      }}
    >
      {/* 光環炸開 */}
      <div style={{
        position: 'absolute',
        width: 800, height: 800,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(184,197,208,0.4), transparent 60%)',
        animation: 'levelup-burst 2s ease-out forwards',
        pointerEvents: 'none',
      }} />

      {/* Emoji 翻轉 */}
      <div style={{
        fontSize: 140,
        filter: 'drop-shadow(0 8px 40px rgba(184,197,208,0.7))',
        marginBottom: 16,
        zIndex: 2,
        animation: 'levelup-emoji-flip 1.4s cubic-bezier(0.22,1,0.36,1) forwards',
      }}>{newEmoji}</div>

      {/* LEVEL UP 大字 */}
      <div style={{ zIndex: 2, textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #b8c5d0, white, #b8c5d0)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          marginBottom: 6,
        }}>LEVEL UP!</div>
        <div style={{ fontSize: 18, color: '#b8c5d0', fontWeight: 700, letterSpacing: '0.05em' }}>
          {newLevelName} · Lv.{newLevel}
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(255,255,255,0.6)',
          marginTop: 14,
          background: 'rgba(255,255,255,0.05)',
          padding: '8px 16px',
          borderRadius: 20,
          display: 'inline-block',
        }}>
          點任何地方關閉
        </div>
      </div>

      <style>{`
        @keyframes levelup-fade {
          0% { opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes levelup-burst {
          0% { transform: scale(0); opacity: 0; }
          30% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes levelup-emoji-flip {
          0%   { transform: rotateY(0deg) scale(0); opacity: 0; }
          20%  { transform: rotateY(0deg) scale(1.2); opacity: 1; }
          50%  { transform: rotateY(180deg) scale(1.2); opacity: 1; }
          60%  { transform: rotateY(360deg) scale(1.4); }
          100% { transform: rotateY(360deg) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ─── C4: BadgeUnlockOverlay ─────────────────────────────
// 對齊 prototype-3 第 397-455 行的 badge unlock 動畫
// 顯示一個或多個解鎖徽章、emoji bounce in + 16 顆彩色粒子放射、3 秒後 dismiss
function BadgeUnlockOverlay({ badges, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  const COLORS = ['#22c55e', '#fbbf24', '#3b82f6', '#ec4899', '#a78bfa']
  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        animation: 'badge-fade 4s ease-out forwards',
        padding: 32,
      }}
    >
      <div style={{
        fontSize: 18, color: '#fcd34d',
        letterSpacing: '0.05em', fontWeight: 700,
        marginBottom: 24,
      }}>🎉 解鎖新徽章！</div>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        {badges.map((b, i) => (
          <div key={b.key} style={{ position: 'relative', textAlign: 'center' }}>
            {/* 徽章本體 */}
            <div style={{
              width: 120, height: 120,
              borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))',
              border: '2px solid rgba(34,197,94,0.5)',
              boxShadow: '0 0 40px rgba(34,197,94,0.4)',
              display: 'grid', placeItems: 'center',
              fontSize: 64,
              animation: `badge-reveal 0.9s cubic-bezier(0.16,1.4,0.3,1) ${i * 200}ms forwards`,
              opacity: 0,
            }}>{b.emoji}</div>
            <div style={{
              marginTop: 12,
              fontSize: 15, fontWeight: 700,
              color: 'white',
              opacity: 0,
              animation: `badge-label-fade 0.6s ease-out ${i * 200 + 500}ms forwards`,
            }}>{b.label}</div>
            {/* 16 顆五彩粒子 */}
            {Array.from({ length: 16 }, (_, idx) => {
              const angle = (idx / 16) * Math.PI * 2
              const dist = 70 + Math.random() * 30
              return (
                <span
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: 60, top: 60,
                    width: 7, height: 7,
                    borderRadius: '50%',
                    background: COLORS[idx % COLORS.length],
                    boxShadow: `0 0 8px ${COLORS[idx % COLORS.length]}`,
                    opacity: 0,
                    '--cx': `${Math.cos(angle) * dist}px`,
                    '--cy': `${Math.sin(angle) * dist}px`,
                    animation: `badge-confetti 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 200 + 100}ms forwards`,
                    pointerEvents: 'none',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 36,
        fontSize: 14, color: 'rgba(255,255,255,0.6)',
        background: 'rgba(255,255,255,0.05)',
        padding: '8px 16px',
        borderRadius: 20,
      }}>點任何地方關閉</div>

      <style>{`
        @keyframes badge-fade {
          0% { opacity: 0; }
          6% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes badge-reveal {
          0%   { transform: scale(0) rotate(-180deg); opacity: 0; }
          60%  { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes badge-label-fade {
          to { opacity: 1; }
        }
        @keyframes badge-confetti {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          20%  { transform: translate(0,0) scale(1.5); opacity: 1; }
          100% { transform: translate(var(--cx), var(--cy)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

// 共用暗色背景 — 對齊 HomeDark / BulkScan 的青綠雙漸層 + 雜訊
function PageBg({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 下方青綠漸層 */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒雜訊疊層 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.14,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )
}

// 頁面 TopBar — 返回 + 網站名 + 重新檢測 / 匯出 PDF / 6 週清單
// 2026-06-08：原本「重新檢測」按鈕沒掛 onClick、點下去沒反應 — 接上 handleFirstScan
// 2026-06-08：新增「📋 6 週清單」按鈕、產 LLMO 執行清單 PDF（代理商交付物）
function TopBar({ website, navigate, onExportPdf, onChecklist, onRescan, rescanning }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-white/60 hover:text-white"
        >
          ← 回首頁
        </button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-white truncate">{website.name || website.url}</h1>
          <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white/70 truncate font-mono">
            {website.url}
          </a>
        </div>
      </div>
      {/* 2026-06-09 手機 QA：4 顆按鈕在 375px 寬會把整個 TopBar 撐到第二行很醜。
          手機（< sm = 640px）只顯示 emoji + tooltip、桌面才補完整文字。
          「切回舊版」是最低用率、手機直接隱藏（用 URL /dashboard-legacy/:id 也可進去）。 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate(`/dashboard-legacy/${website.id}`)}
          className="hidden sm:inline-block px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
          title="切回舊版 Dashboard（不適應新版時用）"
        >
          ← 切回舊版
        </button>
        <button
          onClick={onRescan}
          disabled={rescanning}
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          title="重跑 SEO / AEO / GEO / E-E-A-T 4 大 audit、寫入新一筆紀錄"
        >
          {rescanning ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span className="hidden sm:inline">檢測中…</span>
            </>
          ) : (
            <>🔄<span className="hidden sm:inline ml-1">重新檢測</span></>
          )}
        </button>
        <button
          onClick={onExportPdf}
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
          title="產生客戶提案 PDF（白標、可填代理商署名）"
        >
          📄<span className="hidden sm:inline ml-1">匯出 PDF</span>
        </button>
        <button
          onClick={onChecklist}
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
          title="產生 LLMO 6 週執行清單 PDF — 把抽象 LLMO 概念轉成客戶可照做的 6 週清單、含 robots.txt / llms.txt / Schema 模板"
        >
          📋<span className="hidden sm:inline ml-1">6 週清單</span>
        </button>
      </div>
    </div>
  )
}

// aivis Hero — 主視覺左大區
// 2026-06-06 改：拿掉所有 mock 數據（47 / 12% / 18% / sparkline 都是 hardcoded、所有網站長一樣很糟）
// 改成「實查 aivis_brands」+ 3 種狀態：
//   1. loading — 抓資料中
//   2. no_brands — 用戶沒設定追蹤品牌、顯示設定 CTA
//   3. has_brands — 用戶有設品牌、列出來、給「看完整監測」入口
// aivis 真實提及率資料需要等到 aivis monitoring run 才有、目前先讓用戶能正確進入設定流程
function AivisHero({ isPro, websiteName, overallScore, trendData = [] }) {
  const { user } = useAuth()
  const [brands, setBrands] = useState(null) // null = loading, [] = no brands, [...] = has brands

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase
      .from('aivis_brands')
      .select('id, name, domain')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) console.warn('aivis brands load error:', error.message)
        if (!cancelled) setBrands(data || [])
      })
    return () => { cancelled = true }
  }, [user?.id])

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 sm:p-7" style={{
      background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(0,0,0,0.5))',
      border: '1px solid rgba(249,115,22,0.3)',
      minHeight: 280,
    }}>
      {/* 角落光暈 */}
      <div className="absolute -top-20 -right-12 w-72 h-72 pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(249,115,22,0.25), transparent 60%)',
      }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🎯</span>
          <h2 className="text-2xl font-bold text-white">AI 曝光監測 <span className="text-orange-300 text-lg font-normal">(aivis)</span></h2>
          <span className="ml-auto text-sm uppercase tracking-wider px-3 py-1 rounded-full bg-orange-500/25 border border-orange-400/50 text-orange-200 font-bold">
            {isPro ? 'Pro 核心' : '🔒 Pro 功能'}
          </span>
        </div>
        <p className="text-base text-white/65 mb-1">追蹤你在 ChatGPT / Claude / Perplexity / Gemini / Grok 的真實提及率</p>
        <p className="text-sm text-white/45 mb-6"><span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 font-semibold text-sm">LLMO 結果驗證層</span> · 跟 SEO / AEO / GEO / E-E-A-T 4 訊號層合成總分</p>

        {/* 心跳脈動「趨勢成形中」帶：嵌在 hero 卡片內（用戶指定位置）。第一次掃完（trendData ≤1 筆）顯示、
            真實 30 天折線（≥2 筆）改放在 hero 下方。bare = 去外框、融入卡片當「生命徵象帶」。 */}
        {trendData.length <= 1 && (
          <div className="mb-6">
            <HeartbeatTrend
              bare
              title=""
              footer={
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                  ✅ 已完成首次掃描 — 趨勢會隨你每次<span style={{ color: '#FFC24B', fontWeight: 700 }}>「重新檢測」</span>累積（目前手動更新）。AI 答案天天在變，建議每週回來掃一次，走勢就會成形。
                </p>
              }
            />
          </div>
        )}

        {/* 5 AI 引擎 chips（真實 logo）— 白底圓角磚確保深色/淺色 logo 都看得見（Grok 黑、ChatGPT 已改深色） */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {[
            { name: 'ChatGPT',    logo: logoChatGPT },
            { name: 'Claude',     logo: logoClaude },
            { name: 'Perplexity', logo: logoPerplexity },
            { name: 'Gemini',     logo: logoGemini },
            { name: 'Grok',       logo: logoGrok },
          ].map((e, i) => (
            <div key={i} className="text-center p-2 rounded-lg" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div className="mx-auto mb-1.5 flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 9, background: '#fff' }}>
                <img src={e.logo} alt={e.name} style={{ width: 22, height: 22, display: 'block' }} />
              </div>
              <div className="text-sm text-white/55">{e.name}</div>
              <div className="text-sm font-mono text-white/35">—</div>
            </div>
          ))}
        </div>

        {/* 3 種狀態：loading / no_brands / has_brands */}
        {brands === null ? (
          <div className="text-sm text-white/40 py-2">載入中…</div>
        ) : brands.length === 0 ? (
          // 用戶還沒設定追蹤品牌 — 顯示明確 CTA
          <div className="rounded-xl p-5" style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(249,115,22,0.25)',
          }}>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl flex-shrink-0">📡</span>
              <div className="flex-1">
                <div className="text-base font-bold text-white mb-1">尚未啟用 aivis 追蹤</div>
                <p className="text-sm text-white/55 leading-relaxed">
                  {isPro
                    ? '設定你想追蹤的品牌名稱（例：金鉑先生、kimbo3899）、aivis 會每天問 5 個 AI 引擎、看你被提及幾次。'
                    : 'aivis 是 Pro 核心功能 — 追蹤品牌在 5 個 AI 引擎的真實提及率，升 Pro 解鎖。'}
                </p>
              </div>
            </div>
            <Link
              to={isPro ? '/ai-visibility' : '/pricing'}
              className="block w-full text-center px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-xl hover:opacity-90 shadow-lg shadow-orange-500/30"
            >
              {isPro ? '設定追蹤品牌 →' : '升 Pro 解鎖 aivis →'}
            </Link>
          </div>
        ) : (
          // 用戶有設定品牌 — 列出 + 「看完整監測」入口
          <div className="rounded-xl p-5" style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(249,115,22,0.25)',
          }}>
            <div className="text-sm text-white/55 mb-3">追蹤中的品牌（{brands.length}）</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {brands.slice(0, 6).map(b => (
                <span key={b.id} className="text-sm px-3 py-1.5 rounded-full text-white" style={{
                  background: 'rgba(249,115,22,0.15)',
                  border: '1px solid rgba(249,115,22,0.35)',
                }}>
                  {b.name}
                </span>
              ))}
              {brands.length > 6 && (
                <span className="text-sm px-3 py-1.5 rounded-full text-white/55 bg-white/5 border border-white/10">
                  +{brands.length - 6} 個
                </span>
              )}
            </div>
            <Link
              to="/ai-visibility"
              className="block w-full text-center px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-xl hover:opacity-90 shadow-lg shadow-orange-500/30"
            >
              看完整監測數據 →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// 右側 Gamify Rail — Level 卡 + Streak 卡 + Badges 卡
function GamifyRail({ gamify }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Level 卡 */}
      <div className="relative overflow-hidden rounded-2xl p-4" style={{
        background: 'linear-gradient(135deg, rgba(205,127,50,0.15), rgba(0,0,0,0.4))',
        border: '1px solid rgba(205,127,50,0.35)',
      }}>
        <div className="absolute -top-16 -right-10 w-48 h-48 pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(205,127,50,0.2), transparent 60%)',
        }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl drop-shadow-lg">{gamify.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{gamify.levelName}</span>
                <span className="text-sm px-2 py-0.5 rounded-full font-mono font-bold" style={{
                  background: 'rgba(205,127,50,0.2)',
                  color: '#e0a16a',
                }}>Lv.{gamify.level}</span>
              </div>
              <div className="text-sm text-white/45 mt-0.5">下一級還差 {gamify.xpToNext} 分</div>
            </div>
          </div>
          {/* 進度條 — 用 progressPct 而非 xp（白銀以上 tier 的 xp ≠ progressPct）*/}
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${gamify.progressPct ?? 0}%`,
                background: 'linear-gradient(90deg, #cd7f32, #e0a16a)',
                boxShadow: '0 0 8px rgba(205,127,50,0.4)',
              }}
            />
          </div>
          <div className="flex justify-between text-sm text-white/45 font-mono">
            <span>{gamify.xp}/{gamify.totalXp} XP</span>
            <span className="text-white font-bold">{gamify.progressPct ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Streak 卡 */}
      <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.12), rgba(0,0,0,0.4))',
        border: '1px solid rgba(251,146,60,0.25)',
      }}>
        <span className="text-3xl drop-shadow-lg" style={{ filter: 'drop-shadow(0 0 8px rgba(251,146,60,0.6))' }}>🔥</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono text-orange-400 leading-none">{gamify.streak}</span>
            <span className="text-sm text-white/55">天</span>
          </div>
          <div className="text-sm text-white/55">連續進步</div>
        </div>
      </div>

      {/* Badges 卡 */}
      <div className="rounded-2xl p-3.5" style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm uppercase tracking-widest text-white/45 font-bold">徽章</span>
          <span className="text-sm text-white/55 font-mono">
            {gamify.badges.filter(b => b.unlocked).length} / {gamify.badges.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {gamify.badges.map((b, i) => (
            <BadgeCell key={i} badge={b} />
          ))}
        </div>
      </div>
    </div>
  )
}

// 徽章單一格子 + hover popover（2026-06-06）— 顯示徽章名稱 + 達標條件
// 注意：grayscale filter 只套在 emoji span、不影響 tooltip 子層
function BadgeCell({ badge }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="aspect-square rounded-lg flex items-center justify-center text-xl transition relative cursor-help"
      style={{
        background: badge.unlocked ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${badge.unlocked ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {/* 套濾鏡的 emoji 區（grayscale + opacity 只套在這層、不影響 tooltip） */}
      <span style={{
        opacity: badge.unlocked ? 1 : 0.3,
        filter: badge.unlocked ? 'none' : 'grayscale(1)',
      }}>
        {badge.emoji}
      </span>
      {!badge.unlocked && (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-white/25 bg-black/30 rounded-lg">🔒</span>
      )}
      {/* hover popover — 顯示徽章名稱 + 達標條件 */}
      {hover && (
        <div
          className="absolute z-30 bottom-full left-1/2 mb-2 -translate-x-1/2 w-48 pointer-events-none"
          style={{
            background: 'rgba(10, 12, 16, 0.96)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div className="text-sm font-bold text-white mb-1">
            {badge.unlocked ? '✓ ' : '🔒 '}{badge.label}
          </div>
          <div className="text-sm text-white/65 leading-relaxed">
            <span className="text-white/40">達標：</span>{badge.criteria}
          </div>
          {/* 小三角箭頭指向徽章 */}
          <div
            className="absolute left-1/2 top-full -translate-x-1/2"
            style={{
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid rgba(10, 12, 16, 0.96)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// （2026-06-06）內嵌的 WeeklyBriefingCard + BRIEFINGS 已抽到 src/components/v2/BriefingCard.jsx
// 跟 HomeDark / AIVisibilityDashboard 共用同一個元件、避免重複代碼

// Notice strip — 一格通知欄、取代走馬燈
function NoticeStrip() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3 text-sm" style={{
      background: 'rgba(24,197,144,0.1)',
      border: '1px solid rgba(24,197,144,0.3)',
    }}>
      <span className="text-base">📡</span>
      <div className="flex-1 text-white/75">
        <strong className="text-white">aivis 升級到 5 引擎</strong> · 新增 Gemini 監測。對所有 Pro 用戶自動生效、Top-up 餘額不變
      </div>
      <button onClick={() => setDismissed(true)} className="text-white/40 hover:text-white/70 text-lg leading-none w-6 h-6 flex items-center justify-center">×</button>
    </div>
  )
}

// Gap 1（2026-06-05）— 新用戶 onboarding 空狀態
// 觸發：用戶剛建 website、4 大 audit + content 都還沒跑
// 設計重點：(1) 不要看起來像「產品壞掉」 (2) 給單一明確 CTA (3) 預告 60 秒後會看到什麼
function EmptyState({ website, scanning, onScan }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-10 mb-6">
      {/* 上：歡迎 + 網站名 */}
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm font-mono mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          首次設定 · 還沒檢測過
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
          歡迎使用方舟 AI 雷達
        </h2>
        <p className="text-base text-white/65 leading-relaxed">
          <span className="text-white font-mono break-all">{website.name || website.url}</span> 還沒有檢測紀錄。<br />
          按下方按鈕、60 秒給你完整 <span className="text-emerald-300 font-semibold">AI 能見度報告</span>。
        </p>
      </div>

      {/* 中：3 步驟說明（告訴用戶接下來會發生什麼、降低未知感） */}
      <div className="grid sm:grid-cols-3 gap-3 mb-10 max-w-4xl mx-auto">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <div className="text-xl font-mono font-bold text-emerald-300 mb-3">01</div>
          <div className="text-white font-bold mb-1.5">爬取你的網站</div>
          <div className="text-sm text-white/55 leading-relaxed">抓 HTML / sitemap / robots.txt、分析 5 大訊號層</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <div className="text-xl font-mono font-bold text-emerald-300 mb-3">02</div>
          <div className="text-white font-bold mb-1.5">產出 5 維度分數</div>
          <div className="text-sm text-white/55 leading-relaxed">SEO · AEO · GEO · E-E-A-T · 內容品質，各自打分</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
          <div className="text-xl font-mono font-bold text-emerald-300 mb-3">03</div>
          <div className="text-white font-bold mb-1.5">給你「今日該修」清單</div>
          <div className="text-sm text-white/55 leading-relaxed">按優先級排好的具體行動、含平台別修法步驟</div>
        </div>
      </div>

      {/* 下：主 CTA 按鈕 + 安心話 */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onScan}
          disabled={scanning}
          className="px-8 py-3.5 rounded-xl font-bold text-lg bg-emerald-500 hover:bg-emerald-400 text-black transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {scanning ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
              檢測中…
            </>
          ) : (
            <>🚀 開始第一次檢測</>
          )}
        </button>
        <p className="text-sm text-white/40">
          {scanning
            ? '正在跑 5 個訊號層，可關閉視窗、跑完回來看結果'
            : '約 60 秒、可關閉視窗，跑完回來看結果'}
        </p>
      </div>
    </section>
  )
}

// Quest Section — 今日任務（遊戲化 Action Center）
// Gap 2（2026-06-05）改：quests 從 generateQuests() 動態產出、按優先級排 Top 3
//   - 全部都通過時顯示「無待修」慶祝狀態（非空陣列就跳過）
//   - 「去修」按鈕從 <button> 換成 <Link to={q.link}>、點下去跳對應 audit 頁
function QuestSection({ quests }) {
  const totalEst = quests.filter(q => !q.done).reduce((sum, q) => sum + q.est, 0)

  // 全部通過 = 顯示慶祝狀態而不是空白卡（避免「產品看起來壞了」感）
  if (quests.length === 0) {
    return (
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'rgba(34,197,94,0.05)',
        border: '1px solid rgba(34,197,94,0.2)',
      }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎉</span>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1">本日無待修</h3>
            <p className="text-sm text-white/55">所有 LLMO 訊號層都通過了 — 再來檢查一次或等下次掃描看看新變化</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          ⚡ 今日該修 Top {quests.length}
        </h3>
        <div className="text-sm text-white/50">
          完成可拿 <strong className="text-emerald-300 font-mono">+{totalEst} 分</strong>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quests.map(q => (
          <div key={q.id} className="rounded-xl p-3.5" style={{
            background: q.done ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${q.done ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
            opacity: q.done ? 0.7 : 1,
          }}>
            <div className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{q.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-base font-bold text-white">{q.done ? '✅ ' : ''}{q.title}</span>
                </div>
                <p className="text-sm text-white/55 leading-relaxed">{q.desc}</p>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-300 font-bold font-mono">+{q.est}分</span>
                    <span className="text-white/40">~{q.mins} 分鐘</span>
                  </div>
                  {!q.done && q.link && (
                    <Link to={q.link} className="px-2 py-1 rounded text-sm font-bold transition hover:opacity-80" style={{
                      background: `${FACE_BG[q.face]}`,
                      color: FACE_COLORS[q.face],
                      border: `1px solid ${FACE_BORDER[q.face]}`,
                    }}>
                      去修 →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// 站點體檢 5 Tab wrapper — 對齊 prototype-2b 第 1493 行 audit-unified 設計
// 含：站點體檢總分（大數字）+ 五角雷達 mini + 5 Tab nav + Tab body
function AuditSection({ scores, activeFace, setActiveFace, website, seoAudit, aeoAudit, geoAudit, eeatAudit, contentLatest, contentHistory, isPro }) {
  const tabs = [
    { key: 'seo',     label: 'SEO',     score: scores.seo },
    { key: 'aeo',     label: 'AEO',     score: scores.aeo },
    { key: 'geo',     label: 'GEO',     score: scores.geo },
    { key: 'eeat',    label: 'E-E-A-T', score: scores.eeat },
    { key: 'content', label: '內容品質', score: scores.content },
  ]
  // 站點體檢總分 = 5 個 face 平均
  const overallScore = Math.round((scores.seo + scores.aeo + scores.geo + scores.eeat + scores.content) / 5)
  return (
    <section className="mb-6 relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="absolute -top-32 -right-12 w-80 h-80 pointer-events-none" style={{
        background: `radial-gradient(circle, ${FACE_BG[activeFace] || 'rgba(255,255,255,0.05)'}, transparent 60%)`,
      }} />

      <div className="relative z-10">
        {/* Section head */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">📊 站點體檢</h2>
            {/* P1 同步：LLMO 訊號層的 4+1 標籤、表明這 5 個 tab 是 LLMO 的子訊號層 */}
            <span className="text-sm px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 font-semibold">
              LLMO 4 訊號層 + aivis 結果驗證
            </span>
          </div>
          <span className="text-sm text-white/45 font-mono">{website.url}</span>
        </div>

        {/* ─── 站點體檢總分 + 五角雷達 mini（對齊 prototype-2b 1493-1521） ─── */}
        {/* 手機：改直向堆疊（分數在上、雷達置中在下），避免固定 220px 雷達把文字擠成一字一行 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6 p-5 rounded-xl" style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* 左：大數字 + 副標（桌機才 flex-1 撐開把雷達推到右邊；手機不 flex-1 免影響直向排版）*/}
          <div className="flex items-center gap-4 sm:flex-1 sm:min-w-0">
            <div className="text-6xl font-black font-mono text-white leading-none shrink-0" style={{
              background: 'linear-gradient(135deg, #18c590, #10b981)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
              {overallScore}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-white">站點體檢總分</h3>
              <div className="text-sm text-white/55 mb-1">5 大面向綜合 · 站點層級</div>
              <div className="text-sm text-emerald-300 font-bold">↑ 比上週 +5 分</div>
            </div>
          </div>
          {/* 右：五角雷達 mini SVG（手機置中）*/}
          <div className="self-center sm:self-auto shrink-0"><PentaRadar scores={scores} size={220} /></div>
        </div>

        {/* Tab nav — 5 個 face 切換 */}
        <div className="flex gap-1 p-1 mb-5 rounded-xl overflow-x-auto" style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFace(tab.key)}
              className="flex-1 min-w-[120px] py-3 px-4 rounded-lg transition flex flex-col items-center gap-1"
              style={{
                background: activeFace === tab.key ? FACE_BG[tab.key] : 'transparent',
                color: activeFace === tab.key ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeFace === tab.key ? `0 0 0 1px ${FACE_BORDER[tab.key]}` : 'none',
              }}
            >
              <span className="text-sm font-semibold whitespace-nowrap">{tab.label}</span>
              <span className="text-sm font-mono font-bold" style={{
                color: activeFace === tab.key ? FACE_COLORS[tab.key] : 'rgba(255,255,255,0.4)',
              }}>{tab.score || 0}</span>
            </button>
          ))}
        </div>

        {/* Tab body — 4 個 audit face 走 AuditTabBody 簡化版；content face 走 ContentTabPanel 完整版（prototype-4 對齊） */}
        {activeFace === 'content' ? (
          <ContentTabPanel
            score={scores.content}
            website={website}
            contentLatest={contentLatest}
            contentHistory={contentHistory}
            isPro={isPro}
          />
        ) : (
          <AuditTabBody
            face={activeFace}
            scores={scores}
            website={website}
            seoAudit={seoAudit}
            aeoAudit={aeoAudit}
            geoAudit={geoAudit}
            eeatAudit={eeatAudit}
            isPro={isPro}
          />
        )}
      </div>
    </section>
  )
}

// 5 軸雷達 — 對齊正式版 Dashboard.jsx 1023-1095 的 Recharts RadarChart 設定
// 含三層：100 分滿分外框 / 80 分合格虛線基準 / 本站表現實心翠綠
function PentaRadar({ scores, size = 220 }) {
  const radarData = [
    { subject: 'SEO',     score: scores.seo,     target: 80, fullMark: 100 },
    { subject: 'AEO',     score: scores.aeo,     target: 80, fullMark: 100 },
    { subject: 'GEO',     score: scores.geo,     target: 80, fullMark: 100 },
    { subject: 'E-E-A-T', score: scores.eeat,    target: 80, fullMark: 100 },
    { subject: '內容',     score: scores.content, target: 80, fullMark: 100 },
  ]
  // 軸標籤的顏色 lookup（中文 subject → face color）
  const subjectColor = {
    'SEO': FACE_COLORS.seo, 'AEO': FACE_COLORS.aeo, 'GEO': FACE_COLORS.geo,
    'E-E-A-T': FACE_COLORS.eeat, '內容': FACE_COLORS.content,
  }
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={(props) => {
              const { payload, x, y, textAnchor } = props
              const color = subjectColor[payload.value] || '#fff'
              return (
                <text x={x} y={y} textAnchor={textAnchor} fill={color} fontSize={12} fontWeight={700}>
                  {payload.value}
                </text>
              )
            }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 14, fill: 'rgba(255,255,255,0.4)' }} />
          {/* 100 分外框 — 顯式外圈、把雷達圖視覺框起來 */}
          <Radar name="100 分滿分線" dataKey="fullMark"
            stroke="rgba(255,255,255,0.5)" fill="none" strokeWidth={1} dot={false} isAnimationActive={false}
          />
          {/* 80 分合格基準虛線 */}
          <Radar name="合格基準（80 分）" dataKey="target"
            stroke="rgba(255,255,255,0.55)" fill="rgba(255,255,255,0.04)"
            strokeDasharray="5 4" strokeWidth={1.25} dot={false} isAnimationActive={false}
          />
          {/* 本站表現 — 翠綠實心 + 5 個 face 色點 */}
          <Radar name="本站表現" dataKey="score"
            stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              const color = subjectColor[payload.subject] || '#10b981'
              return <circle cx={cx} cy={cy} r={5} fill={color} stroke="#0a0e14" strokeWidth={2} />
            }}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 14, color: '#fff' }}
            formatter={(v) => [`${v} 分`, '得分']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Tab body — B1 簡化版（B3 phase 會把內容品質 Tab 換成 prototype-4 完整內容）
function AuditTabBody({ face, scores, website, seoAudit, aeoAudit, geoAudit, eeatAudit, isPro }) {
  const score = scores[face] || 0
  const faceColor = FACE_COLORS[face]

  // 各 face 的 drill-down 路徑
  const drillPath = {
    seo: `/seo-audit/${website.id}`,
    aeo: `/aeo-audit/${website.id}`,
    geo: `/geo-audit/${website.id}`,
    eeat: `/eeat-audit/${website.id}`,
    content: `/content-audit/${website.id}`,
  }[face]

  // 各 face 的標題與描述
  const faceMeta = {
    seo:     { name: 'SEO 搜尋優化',     desc: '讓 Google 搜尋找到你',          icon: '🔍' },
    aeo:     { name: 'AEO 答案引擎優化',  desc: '讓 AI 直接回答關於你',          icon: '🤖' },
    geo:     { name: 'GEO 生成式引擎優化', desc: '讓 AI 生成式搜尋引用你',       icon: '🌐' },
    eeat:    { name: 'E-E-A-T 可信度',    desc: '建立品牌專業度與可信度',         icon: '🏆' },
    content: { name: '內容品質',         desc: '文章結構與 AI 引用適合度',       icon: '📝' },
  }[face]

  // 判定文字（簡化版、B3 phase 補完整）
  const verdict = score >= 80 ? '優異' : score >= 60 ? '良好' : score >= 40 ? '尚可' : '需改善'
  const verdictColor = score >= 80 ? '#86efac' : score >= 60 ? '#a7f3d0' : score >= 40 ? '#fcd34d' : '#fca5a5'

  // 內容品質 Tab — B3 phase 會接 prototype-4 完整 panel；B1 phase 簡化版
  return (
    <div className="grid sm:grid-cols-3 gap-5 items-center">
      {/* 左：分數圓環 */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className="relative w-32 h-32 mb-3">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={faceColor} strokeWidth="8"
              strokeDasharray={`${(score / 100) * 264} 264`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${faceColor}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white font-mono leading-none">{score}</span>
            <span className="text-sm text-white/45 mt-1">/ 100</span>
          </div>
        </div>
        <span className="text-sm font-bold" style={{ color: verdictColor }}>{verdict}</span>
      </div>

      {/* 中：說明 + 主要指標 */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <span>{faceMeta.icon}</span>
          {faceMeta.name}
        </h3>
        <p className="text-sm text-white/55 mb-3 leading-relaxed">{faceMeta.desc}</p>
        <div className="text-sm text-white/45 space-y-1">
          <p>📅 上次掃描：{(seoAudit || aeoAudit || geoAudit || eeatAudit)?.created_at ? new Date((seoAudit || aeoAudit || geoAudit || eeatAudit).created_at).toLocaleDateString('zh-TW') : '尚無資料'}</p>
          <p>📊 主要拖分項：請進詳細頁看完整 14 項檢測</p>
        </div>
      </div>

      {/* 右：drill-down CTA */}
      <div className="flex flex-col gap-2">
        <Link
          to={drillPath}
          className="block rounded-xl p-4 text-center transition hover:scale-[1.02]"
          style={{
            background: `linear-gradient(135deg, ${FACE_BG[face]}, rgba(0,0,0,0.4))`,
            border: `1px solid ${FACE_BORDER[face]}`,
          }}
        >
          <div className="text-sm text-white/55 mb-1">點開查看</div>
          <div className="text-base font-bold text-white">完整 {faceMeta.name} 報告 →</div>
        </Link>
        {face === 'content' && (
          <Link
            to={`/bulk-scan/${website.id}`}
            className="block rounded-xl p-3 text-center transition hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(0,0,0,0.4))',
              border: '1px solid rgba(249,115,22,0.3)',
            }}
          >
            <div className="text-sm text-orange-200">
              📂 {isPro ? '批次掃描全站 200 篇' : 'Pro 解鎖批次掃描'}
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── B3: 內容品質 Tab 完整 panel（對齊 prototype-4） ─────────
// 結構：
//   1. Hero strip — 圓環分數 + 30 天 sparkline + 月 stats
//   2. 2 個入口卡 — 📄 單篇文章分析 / 📂 批次掃描全站
//   3. 15 項檢測 breakdown grid（5 分類 × 3 項）
//   4. 底部 CTA bar
function ContentTabPanel({ score, website, contentLatest, contentHistory, isPro }) {
  const CONTENT_COLOR = FACE_COLORS.content   // pink #ec4899
  const safeScore = score || 0
  const ringPct = (safeScore / 100) * 100

  // ── Hero strip：sparkline 從 contentHistory 即時算 ──
  // 至少需要 2 個點才畫線；少於 2 點時用空狀態
  const sparkPoints = useMemo(() => {
    if (!contentHistory || contentHistory.length < 1) return []
    // 把分數陣列 normalize 到 SVG viewBox (0-300 x, 0-60 y)
    const xs = contentHistory.map((h, i) => (i / Math.max(1, contentHistory.length - 1)) * 300)
    const minS = Math.min(...contentHistory.map(h => h.score), 0)
    const maxS = Math.max(...contentHistory.map(h => h.score), 100)
    const range = Math.max(1, maxS - minS)
    const ys = contentHistory.map(h => 60 - ((h.score - minS) / range) * 50 - 5)  // 留 5px margin
    return contentHistory.map((_, i) => ({ x: xs[i], y: ys[i] }))
  }, [contentHistory])

  const sparkPath = sparkPoints.length >= 2
    ? sparkPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
    : null
  const sparkAreaPath = sparkPath
    ? `${sparkPath} L ${sparkPoints[sparkPoints.length - 1].x},60 L 0,60 Z`
    : null

  // 月增幅：本月平均 vs 上月平均
  const monthlyDelta = useMemo(() => {
    if (!contentHistory || contentHistory.length < 2) return null
    const now = Date.now()
    const cutoff = now - 30 * 24 * 60 * 60 * 1000  // 30 天前
    const lastMonth = contentHistory.filter(h => new Date(h.created_at).getTime() > cutoff && new Date(h.created_at).getTime() < cutoff + 15 * 24 * 60 * 60 * 1000)
    const thisMonth = contentHistory.filter(h => new Date(h.created_at).getTime() >= cutoff + 15 * 24 * 60 * 60 * 1000)
    if (!lastMonth.length || !thisMonth.length) return null
    const lastAvg = lastMonth.reduce((s, h) => s + (h.score || 0), 0) / lastMonth.length
    const thisAvg = thisMonth.reduce((s, h) => s + (h.score || 0), 0) / thisMonth.length
    return Math.round(thisAvg - lastAvg)
  }, [contentHistory])

  const monthAnalyzedCount = contentHistory?.length || 0
  const passedCount = (contentHistory || []).filter(h => (h.score || 0) >= 80).length
  const needFixCount = monthAnalyzedCount - passedCount

  // ── 15 項檢測 — 從 contentLatest 的 JSONB 欄位推狀態 ──
  // 因 JSONB 結構不一定每個 field 都有 score/passed flag，這裡用「欄位存在 + score >=80」當 pass 估算
  // B3b（之後）可以對 analyzeContent 輸出 schema 做更精確的解析
  const categories = useMemo(() => buildCheckCategories(contentLatest, safeScore), [contentLatest, safeScore])

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero strip：圓環 + sparkline + 月 stats ── */}
      <div className="rounded-xl p-5 grid sm:grid-cols-[auto_1fr_auto] gap-6 items-center" style={{
        background: 'linear-gradient(135deg, rgba(236,72,153,0.10), rgba(236,72,153,0.02))',
        border: '1px solid rgba(236,72,153,0.25)',
      }}>
        {/* 左：圓環分數 */}
        <div className="flex flex-col items-center min-w-[130px]">
          <div className="relative w-[100px] h-[100px]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={CONTENT_COLOR} strokeWidth="8"
                strokeDasharray={`${(ringPct / 100) * 264} 264`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${CONTENT_COLOR}80)` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white font-mono leading-none">{safeScore}</span>
              <span className="text-sm text-white/45 mt-1">/ 100</span>
            </div>
          </div>
          <div className="text-sm text-white/55 mt-2 tracking-wider">內容品質得分</div>
        </div>

        {/* 中：30 天 sparkline */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-white/55">過去 30 天分數變化</span>
            {monthlyDelta != null && (
              <span className="text-sm font-bold font-mono" style={{
                color: monthlyDelta >= 0 ? '#86efac' : '#fca5a5',
              }}>
                {monthlyDelta >= 0 ? '▲' : '▼'} {monthlyDelta >= 0 ? '+' : ''}{monthlyDelta} vs 上半月
              </span>
            )}
          </div>
          {sparkPath ? (
            <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="w-full" style={{ height: 60 }}>
              <defs>
                <linearGradient id="contentSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CONTENT_COLOR} stopOpacity="0.4"/>
                  <stop offset="100%" stopColor={CONTENT_COLOR} stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={sparkAreaPath} fill="url(#contentSparkGrad)" />
              <path d={sparkPath} fill="none" stroke={CONTENT_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx={sparkPoints[sparkPoints.length - 1].x} cy={sparkPoints[sparkPoints.length - 1].y} r="3.5" fill={CONTENT_COLOR} stroke="white" strokeWidth="1.5"/>
            </svg>
          ) : (
            <div className="h-[60px] flex items-center justify-center text-sm text-white/40">
              還沒有歷史資料 — 跑幾次內容分析就會出現曲線
            </div>
          )}
        </div>

        {/* 右：月 stats */}
        <div className="text-right border-l border-white/10 pl-5">
          <div className="text-sm text-white/55 mb-1">本月已分析</div>
          <div className="font-mono font-black text-2xl leading-none text-white">
            {monthAnalyzedCount} <span className="text-base text-white/60 font-bold">筆</span>
          </div>
          <div className="text-sm text-white/45 mt-1">{passedCount} 通過 · {needFixCount} 待修</div>
        </div>
      </div>

      {/* ── 兩個入口卡 ── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* 單篇 */}
        <Link to={`/content-audit/${website.id}`} className="block rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div className="absolute -top-12 -right-8 w-48 h-48 pointer-events-none opacity-70" style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.18), transparent 60%)',
          }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📄</span>
              <span className="text-sm font-bold px-2 py-1 rounded-full" style={{
                background: 'rgba(236,72,153,0.18)', color: '#f9a8d4',
              }}>免費版可用</span>
            </div>
            <div className="text-base font-bold text-white mb-1">單篇文章分析</div>
            <div className="text-sm text-white/60 leading-relaxed mb-3">貼一個 URL、跑 15 項檢測。適合一篇一篇優化重點文章。</div>
            <div className="flex items-center justify-between text-sm text-white/45 pt-3 border-t border-white/10">
              <span>最近分析：<strong className="text-white font-mono">{monthAnalyzedCount}</strong> 筆</span>
              <span className="text-sm font-bold" style={{ color: '#f9a8d4' }}>立即分析 →</span>
            </div>
          </div>
        </Link>

        {/* 批次 */}
        <Link to={`/bulk-scan/${website.id}`} className="block rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-lg relative overflow-hidden" style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${isPro ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.1)'}`,
          opacity: isPro ? 1 : 0.7,
        }}>
          <div className="absolute -top-12 -right-8 w-48 h-48 pointer-events-none opacity-70" style={{
            background: 'radial-gradient(circle, rgba(249,115,22,0.18), transparent 60%)',
          }} />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">📂</span>
              <span className="text-sm font-bold px-2 py-1 rounded-full" style={{
                background: isPro ? 'rgba(249,115,22,0.18)' : 'rgba(184,197,208,0.15)',
                color: isPro ? '#fdba74' : 'rgba(255,255,255,0.6)',
              }}>{isPro ? 'Pro 專屬' : 'Pro 鎖'}</span>
            </div>
            <div className="text-base font-bold text-white mb-1">批次掃描全站</div>
            <div className="text-sm text-white/60 leading-relaxed mb-3">sitemap 一次掃 200 篇、每篇都有「複製貼回」修復建議。盤整大規模文章站。</div>
            <div className="flex items-center justify-between text-sm text-white/45 pt-3 border-t border-white/10">
              <span>{isPro ? '上次掃描：見頁面內' : '升級 Pro 解鎖'}</span>
              <span className="text-sm font-bold" style={{ color: isPro ? '#fdba74' : 'rgba(255,255,255,0.45)' }}>看完整報告 →</span>
            </div>
          </div>
        </Link>
      </div>

      {/* ── 15 項檢測 breakdown grid ── */}
      <div>
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">🔍 本站近期 15 項檢測通過率</h3>
          <span className="text-sm text-white/55">
            <strong className="text-pink-300 font-mono font-black">{Math.round((safeScore / 100) * 100)}%</strong> 通過率
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <div key={cat.key} className="rounded-lg p-3" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span className="text-base">{cat.emoji}</span>{cat.name}
                </span>
                <span className="text-sm font-bold font-mono px-2 py-0.5 rounded-full" style={{
                  background: cat.tone === 'pass' ? 'rgba(34,197,94,0.15)' : cat.tone === 'warn' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                  color: cat.tone === 'pass' ? '#86efac' : cat.tone === 'warn' ? '#fcd34d' : '#fca5a5',
                }}>{cat.rate}%</span>
              </div>
              <div className="flex flex-col gap-1">
                {cat.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm" style={{
                    color: it.status === 'pass' ? '#86efac' : it.status === 'warn' ? '#fcd34d' : '#fca5a5',
                  }}>
                    <span className="text-white/70">{it.name}</span>
                    <span>{it.status === 'pass' ? '✓' : it.status === 'warn' ? '⚠' : '✗'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 底部 CTA bar ── */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{
        background: 'linear-gradient(135deg, rgba(24,197,144,0.08), rgba(24,197,144,0.02))',
        border: '1px solid rgba(24,197,144,0.25)',
      }}>
        <div className="text-sm text-white/65 flex-1 min-w-[200px]">
          💡 {needFixCount > 0
            ? <>本期有 <strong className="text-white">{needFixCount} 筆</strong>待修內容、批次掃描可以一次看到所有問題</>
            : <>本期所有分析都通過！繼續維持高品質內容</>}
        </div>
        <div className="flex gap-2">
          <Link to={`/bulk-scan/${website.id}`} className="px-3 py-1.5 text-sm font-bold rounded-md whitespace-nowrap" style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>📂 看待修清單</Link>
          <Link to={`/bulk-scan/${website.id}`} className="px-3 py-1.5 text-sm font-bold rounded-md text-white whitespace-nowrap" style={{
            background: 'linear-gradient(135deg, #18c590, #0d7a58)',
            boxShadow: '0 4px 12px rgba(24,197,144,0.3)',
          }}>🚀 重新批次掃描</Link>
        </div>
      </div>

    </div>
  )
}

// 從 content_audits 最新一筆 row 推 15 項分組狀態
// 邏輯：每個 category 看對應 JSONB 欄位是否「夠」、產出 pass/warn/fail tone + per-item status
// 沒資料時走「估算」— 用 overallScore 推每個 category 的通過率
function buildCheckCategories(contentLatest, overallScore) {
  // 把 JSONB 欄位 → 3 個 item 的狀態
  // 約定：對應 field 存在且看起來 OK → pass；無資料 → 用 score 估算
  const hasData = !!contentLatest

  // 用 score 估算 fallback：score 越高、pass 越多
  const estimate = (offset = 0) => {
    const s = (overallScore || 0) + offset
    if (s >= 80) return 'pass'
    if (s >= 60) return 'warn'
    return 'fail'
  }

  function tone(items) {
    const passCount = items.filter(it => it.status === 'pass').length
    const rate = Math.round((passCount / items.length) * 100)
    return {
      rate,
      tone: rate >= 80 ? 'pass' : rate >= 60 ? 'warn' : 'fail',
    }
  }

  // 結構（heading / word_count / readability）
  const heading = hasData ? contentLatest.heading : null
  const wc = hasData ? contentLatest.word_count : null
  const structItems = [
    { name: 'H1 唯一性',  status: heading?.h1_count === 1 ? 'pass' : heading?.h1_count > 1 ? 'fail' : estimate() },
    { name: '標題層級',   status: heading?.proper_hierarchy ? 'pass' : estimate(-5) },
    { name: '字數充足',   status: typeof wc === 'number' ? (wc >= 300 ? 'pass' : wc >= 200 ? 'warn' : 'fail') : estimate() },
  ]
  const structTone = tone(structItems)

  // Meta（title / desc / canonical）
  const meta = hasData ? contentLatest.meta : null
  const metaItems = [
    { name: 'Title 長度',       status: meta?.title_ok ? 'pass' : estimate() },
    { name: 'Description 字數', status: meta?.desc_ok ? 'pass' : estimate(-5) },
    { name: 'Canonical',        status: meta?.has_canonical ? 'pass' : estimate(10) },
  ]
  const metaTone = tone(metaItems)

  // AEO
  const aeo = hasData ? contentLatest.aeo : null
  const aeoItems = [
    { name: 'FAQ Schema',     status: aeo?.has_faq_schema ? 'pass' : 'fail' },
    { name: 'OG 完整',         status: aeo?.has_og ? 'pass' : estimate() },
    { name: 'Article Schema',  status: aeo?.has_article_schema ? 'pass' : estimate(-10) },
  ]
  const aeoTone = tone(aeoItems)

  // E-E-A-T
  const author = hasData ? contentLatest.author : null
  const images = hasData ? contentLatest.images : null
  const outbound = hasData ? contentLatest.outbound : null
  const eeatItems = [
    { name: '作者署名',    status: author?.has_byline ? 'pass' : estimate(-5) },
    { name: '圖片 alt',     status: images?.alt_rate >= 0.8 ? 'pass' : images?.alt_rate >= 0.5 ? 'warn' : estimate() },
    { name: '外部引用',    status: outbound?.count > 0 ? 'pass' : estimate(5) },
  ]
  const eeatTone = tone(eeatItems)

  // 多媒體
  const multimedia = hasData ? contentLatest.multimedia : null
  const readability = hasData ? contentLatest.readability : null
  const mediaItems = [
    { name: '圖片數量',    status: images?.count >= 3 ? 'pass' : images?.count >= 1 ? 'warn' : 'fail' },
    { name: '影片嵌入',    status: multimedia?.has_video ? 'pass' : estimate(-5) },
    { name: '可讀性',      status: readability?.score >= 60 ? 'pass' : readability?.score >= 40 ? 'warn' : estimate() },
  ]
  const mediaTone = tone(mediaItems)

  return [
    { key: 'structure', emoji: '🏗️', name: '結構',  items: structItems, ...structTone },
    { key: 'meta',      emoji: '🏷️', name: 'Meta',  items: metaItems,   ...metaTone },
    { key: 'aeo',       emoji: '🤖', name: 'AEO',   items: aeoItems,    ...aeoTone },
    { key: 'eeat',      emoji: '⭐', name: 'E-E-A-T', items: eeatItems, ...eeatTone },
    { key: 'media',     emoji: '🎬', name: '多媒體', items: mediaItems, ...mediaTone },
  ]
}

// 修復工具箱 — 合併單一入口（對齊 prototype-2b 第 1613-1641）
// 4 個產生器：Organization Schema / FAQ Schema / llms.txt / Article Schema
// Gap 3（2026-06-05）改：點卡開 modal + 「我已修好」按鈕、寫 fix_event 給用戶 +5 XP
function ToolBox({ websiteId }) {
  const { user } = useAuth()
  const [activeTool, setActiveTool] = useState(null) // null | tool object

  const tools = [
    { emoji: '🪪', name: 'Organization Schema', desc: '品牌報名表、永久儲存',
      longDesc: '告訴 Google / AI「你是誰」的核心 schema — 公司名、logo、聯絡方式。一次設定、全站套用，E-E-A-T 分數會跳很多。LLMO 必備。',
      findingId: 'tool_org_schema', to: '/schema-check' },
    { emoji: '📋', name: 'FAQ Schema', desc: '問答結構化資料',
      longDesc: '把網頁上的常見問題包成 schema.org FAQPage 格式 — AI 引用率會提升 ~15%，特別適合教學 / 服務介紹頁。',
      findingId: 'tool_faq_schema', to: '/schema-check' },
    { emoji: '📄', name: 'llms.txt', desc: 'AI 爬蟲索引引導',
      longDesc: '在網站根目錄放一個 /llms.txt 文件、告訴 ChatGPT / Claude / Perplexity 怎麼讀你的網站。LLMO 業界新標準。',
      findingId: 'tool_llms_txt', to: '/crawl-check' },
    { emoji: '📰', name: 'Article Schema', desc: '文章結構化',
      longDesc: '為文章頁加 Article schema、含 author / datePublished / headline — AI 在引用時會知道作者是誰、文章寫於何時。',
      findingId: 'tool_article_schema', to: `/bulk-scan/${websiteId}` },
  ]

  return (
    <>
      <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            🛠 修復工具箱 <span className="text-sm font-normal text-white/55">· 點下去看怎麼用</span>
          </h3>
          <Link to={`/bulk-scan/${websiteId}`} className="text-sm text-white/55 hover:text-white">
            查看所有工具 →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tools.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTool(t)}
              className="rounded-xl p-4 transition hover:scale-[1.02] block text-left"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="text-3xl mb-2">{t.emoji}</div>
              <div className="text-base font-bold text-white mb-1">{t.name}</div>
              <div className="text-sm text-white/55 leading-relaxed">{t.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {activeTool && (
        <ToolModal
          tool={activeTool}
          websiteId={websiteId}
          userId={user?.id}
          onClose={() => setActiveTool(null)}
        />
      )}
    </>
  )
}

// Gap 3（2026-06-05）— ToolBox 工具卡點下去後的 modal
// 顯示工具完整說明 + 兩個 CTA：「去用工具」（新分頁開實際 generator）+「我已修好」（寫 fix_event +5 XP）
function ToolModal({ tool, websiteId, userId, onClose }) {
  const [state, setState] = useState('idle') // idle | recording | done | error

  async function handleDone() {
    if (state !== 'idle') return
    if (!userId) { alert('請先登入'); return }
    setState('recording')
    try {
      await recordFixEvent({
        userId,
        websiteId,
        findingId: tool.findingId,
        source: 'toolbox',
      })
      setState('done')
      // 1.5 秒後自動關閉、讓用戶看到成功訊息
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      console.error('recordFixEvent failed:', err)
      setState('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full rounded-2xl p-7"
        style={{
          background: 'linear-gradient(180deg, #0a0c10 0%, #050608 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center text-xl"
          aria-label="關閉"
        >×</button>

        {/* 工具資訊 */}
        <div className="text-5xl mb-4">{tool.emoji}</div>
        <h3 className="text-2xl font-bold text-white mb-2">{tool.name}</h3>
        <p className="text-base text-white/70 mb-3">{tool.desc}</p>
        <p className="text-sm text-white/50 mb-7 leading-relaxed">{tool.longDesc}</p>

        {/* 2 個 CTA */}
        <div className="flex flex-col gap-2.5">
          <Link
            to={tool.to}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-400 text-black text-center transition"
          >
            去用這個工具 → 新分頁開
          </Link>
          {/* 2026-06-07：idle 用琥珀色（待辦感）、done 用綠色（完成感）— 跟 BulkScan FixDoneButton 一致 */}
          <button
            onClick={handleDone}
            disabled={state !== 'idle'}
            className="px-5 py-3 rounded-xl font-bold text-base border transition disabled:opacity-60"
            style={{
              background:
                state === 'done'  ? 'rgba(34,197,94,0.18)'
              : state === 'error' ? 'rgba(239,68,68,0.15)'
              : state === 'recording' ? 'rgba(255,255,255,0.04)'
              : 'rgba(251,191,36,0.18)', // idle 琥珀
              borderColor:
                state === 'done'  ? 'rgba(34,197,94,0.5)'
              : state === 'error' ? 'rgba(239,68,68,0.5)'
              : state === 'recording' ? 'rgba(255,255,255,0.15)'
              : 'rgba(251,191,36,0.45)',
              color:
                state === 'done'  ? '#86efac'
              : state === 'error' ? '#fca5a5'
              : state === 'recording' ? 'rgba(255,255,255,0.7)'
              : '#fcd34d', // idle 琥珀文字
            }}
          >
            {state === 'idle' && '✓ 我已修好 (+5 XP)'}
            {state === 'recording' && '記錄中…'}
            {state === 'done' && '🎉 +5 XP 已入帳！'}
            {state === 'error' && '⚠️ 記錄失敗、再試一次'}
          </button>
        </div>

        {/* 小提醒 */}
        <p className="mt-5 pt-4 border-t border-white/8 text-sm text-white/40 leading-relaxed">
          💡 「我已修好」會記錄一筆修復事件、給你 +5 XP。記得修完後回 Dashboard 按「重新檢測」、看新分數有沒有跳。
        </p>
      </div>
    </div>
  )
}

// 30 天進步曲線
function TrendChart({ trendData }) {
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        📈 過去 30 天進步軌跡
      </h3>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={trendData}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 14 }}
              labelStyle={{ color: '#fff' }}
            />
            <Line type="monotone" dataKey="SEO"     stroke={FACE_COLORS.seo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="AEO"     stroke={FACE_COLORS.aeo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="GEO"     stroke={FACE_COLORS.geo}  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="E-E-A-T" stroke={FACE_COLORS.eeat} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
