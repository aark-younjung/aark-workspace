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
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'
import { analyzeContent } from '../services/contentAnalyzer'
import { useGamification } from '../hooks/useGamification'
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

// ─── B1 假資料：今日任務（B2 phase 會接修復建議引擎產出真實 quest）───
const MOCK_QUESTS = [
  { id: 'q1', face: 'aeo', icon: '🤖', title: '補 FAQ Schema', desc: '14 篇文章缺 FAQ Schema、AI 引用率會提升 ~15%', est: 8, mins: 25, done: false },
  { id: 'q2', face: 'content', icon: '📝', title: '解鎖 2 篇句子型 H1', desc: '改 <h1> 為 <h2>、避免 SEO 標題權重稀釋', est: 4, mins: 10, done: false },
  { id: 'q3', face: 'eeat', icon: '⭐', title: '加作者署名', desc: '8 篇文章缺作者資訊、E-E-A-T 分數會 +6', est: 6, mins: 15, done: true },
]

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
        <TopBar website={website} navigate={navigate} />

        {/* ─── ✨ aivis Hero + Gamify Rail（grid 8:4） ─── */}
        <section className="grid lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-8">
            <AivisHero isPro={isPro} websiteName={website.name} overallScore={overallScore} />
          </div>
          <div className="lg:col-span-4">
            <GamifyRail gamify={gamify} />
          </div>
        </section>

        {/* ─── Notice strip（取代走馬燈、一格通知欄） ─── */}
        <NoticeStrip />

        {/* ─── Quest Section（今日任務 = Action Center） ─── */}
        <QuestSection quests={MOCK_QUESTS} />

        {/* ─── 站點體檢（5 Tab wrapper） ─── */}
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

        {/* ─── 修復工具箱（合併版單一入口） ─── */}
        <ToolBox websiteId={website.id} />

        {/* ─── 30 天進步曲線 ─── */}
        {trendData.length > 1 && <TrendChart trendData={trendData} />}

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
          fontSize: 13, color: 'rgba(255,255,255,0.6)',
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
        fontSize: 13, color: 'rgba(255,255,255,0.6)',
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

// 頁面 TopBar — 返回 + 網站名 + 重新檢測 / 匯出 PDF
function TopBar({ website, navigate }) {
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
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate(`/dashboard/${website.id}`)}
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
          title="切回舊版 Dashboard"
        >
          ← v1
        </button>
        <button
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
        >
          🔄 重新檢測
        </button>
        <button
          className="px-3 py-1.5 text-sm text-white/70 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"
        >
          📄 匯出 PDF
        </button>
      </div>
    </div>
  )
}

// aivis Hero — 主視覺左大區（B1：mock 本月引用次數 + 30 天 sparkline、真資料 B2 補）
// 對齊 prototype-2b 第 1300-1340 行 aivis-spotlight 設計
function AivisHero({ isPro, websiteName, overallScore }) {
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
            Pro 核心
          </span>
        </div>
        <p className="text-base text-white/65 mb-5">{websiteName} 在 5 個 AI 引擎的真實提及率</p>

        {/* ─── 本月引用次數 + 30 天 sparkline（aivis-spotlight from prototype-2b） ─── */}
        <div className="grid sm:grid-cols-2 gap-5 mb-5">
          {/* 大數字 */}
          <div className="rounded-xl p-4" style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(249,115,22,0.18)',
          }}>
            <div className="text-sm text-white/55 mb-1">本月引用次數</div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-5xl font-black font-mono text-white leading-none">{isPro ? '47' : '?'}</span>
              {isPro && <span className="text-sm font-bold text-emerald-300">▲ +12 次 vs 上月</span>}
            </div>
            <div className="text-sm text-white/45">{isPro ? '勝過 73% 同行品牌' : '升 Pro 看完整數據'}</div>
          </div>

          {/* 30 天 sparkline */}
          <div className="rounded-xl p-4" style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(249,115,22,0.18)',
          }}>
            <div className="text-sm text-white/55 mb-2">📈 30 天引用曲線</div>
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="w-full" style={{ height: 60 }}>
              <defs>
                <linearGradient id="aivisGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.5"/>
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid */}
              <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              {/* Area */}
              <path d="M 0,68 L 12,66 L 24,62 L 36,60 L 48,58 L 60,55 L 72,52 L 84,48 L 96,46 L 108,43 L 120,40 L 132,38 L 144,35 L 156,32 L 168,30 L 180,28 L 192,26 L 204,22 L 216,20 L 228,16 L 240,14 L 252,12 L 264,10 L 276,8 L 288,6 L 300,4 L 300,80 L 0,80 Z" fill="url(#aivisGrad)"/>
              {/* Line */}
              <path d="M 0,68 L 12,66 L 24,62 L 36,60 L 48,58 L 60,55 L 72,52 L 84,48 L 96,46 L 108,43 L 120,40 L 132,38 L 144,35 L 156,32 L 168,30 L 180,28 L 192,26 L 204,22 L 216,20 L 228,16 L 240,14 L 252,12 L 264,10 L 276,8 L 288,6 L 300,4" fill="none" stroke="#f97316" strokeWidth="2.5"/>
              {/* End point glow */}
              <circle cx="300" cy="4" r="4" fill="#f97316">
                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite"/>
              </circle>
            </svg>
            <div className="flex justify-between text-sm text-white/40 mt-1">
              <span>30 天前 · 3 次</span>
              <span>本週 · 14 次</span>
              <span>今天</span>
            </div>
          </div>
        </div>

        {/* 5 AI 引擎 chips */}
        <div className="grid grid-cols-5 gap-2 mb-5">
          {[
            { name: 'ChatGPT',     emoji: '💬', pct: 12 },
            { name: 'Claude',      emoji: '🟣', pct: 18 },
            { name: 'Perplexity',  emoji: '🔎', pct: 8 },
            { name: 'Gemini',      emoji: '✨', pct: 14 },
            { name: 'GLM',         emoji: '🧠', pct: 6 },
          ].map((e, i) => (
            <div key={i} className="text-center p-2 rounded-lg" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div className="text-2xl mb-1">{e.emoji}</div>
              <div className="text-sm text-white/55">{e.name}</div>
              <div className="text-sm font-bold text-orange-300 font-mono">{isPro ? `${e.pct}%` : '🔒'}</div>
            </div>
          ))}
        </div>

        {/* 平均提及率 + CTA */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-white/55 mb-1">平均提及率（30 天）</div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white font-mono">{isPro ? '11.6' : '?'}</span>
              <span className="text-xl text-white/40 font-mono">%</span>
              {isPro && <span className="text-sm font-bold text-emerald-300">▲ +2.3</span>}
            </div>
          </div>
          <Link
            to="/ai-visibility"
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-xl hover:opacity-90 shadow-lg shadow-orange-500/30"
          >
            {isPro ? '看完整監測 →' : '升 Pro 解鎖 →'}
          </Link>
        </div>
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
            <div
              key={i}
              title={b.label}
              className="aspect-square rounded-lg flex items-center justify-center text-xl transition relative"
              style={{
                background: b.unlocked ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${b.unlocked ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.1)'}`,
                opacity: b.unlocked ? 1 : 0.3,
                filter: b.unlocked ? 'none' : 'grayscale(1)',
              }}
            >
              {b.emoji}
              {!b.unlocked && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-white/25 bg-black/30 rounded-lg">🔒</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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

// Quest Section — 今日任務（遊戲化 Action Center）
function QuestSection({ quests }) {
  const totalEst = quests.filter(q => !q.done).reduce((sum, q) => sum + q.est, 0)
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          ⚡ 今日任務
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
                  {!q.done && (
                    <button className="px-2 py-1 rounded text-sm font-bold transition" style={{
                      background: `${FACE_BG[q.face]}`,
                      color: FACE_COLORS[q.face],
                      border: `1px solid ${FACE_BORDER[q.face]}`,
                    }}>
                      去修 →
                    </button>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">📊 站點體檢</h2>
          <span className="text-sm text-white/45 font-mono">{website.url}</span>
        </div>

        {/* ─── 站點體檢總分 + 五角雷達 mini（對齊 prototype-2b 1493-1521） ─── */}
        <div className="flex items-center gap-5 mb-6 flex-wrap p-5 rounded-xl" style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* 左：大數字 + 副標 */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="text-6xl font-black font-mono text-white leading-none" style={{
              background: 'linear-gradient(135deg, #18c590, #10b981)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}>
              {overallScore}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">站點體檢總分</h3>
              <div className="text-sm text-white/55 mb-1">5 大面向綜合 · 站點層級</div>
              <div className="text-sm text-emerald-300 font-bold">↑ 比上週 +5 分</div>
            </div>
          </div>
          {/* 右：五角雷達 mini SVG */}
          <PentaRadar scores={scores} size={220} />
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
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
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
            contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 12, color: '#fff' }}
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
// B1 用靜態卡片、B2 phase 接真的「點開 → 模態 → 填表 → 產出 code」流程
function ToolBox({ websiteId }) {
  const tools = [
    { emoji: '🪪', name: 'Organization Schema', desc: '品牌報名表、永久儲存',     to: '/schema-check' },
    { emoji: '📋', name: 'FAQ Schema',          desc: '問答結構化資料',           to: '/schema-check' },
    { emoji: '📄', name: 'llms.txt',            desc: 'AI 爬蟲索引引導',          to: '/crawl-check' },
    { emoji: '📰', name: 'Article Schema',      desc: '文章結構化',               to: `/bulk-scan/${websiteId}` },
  ]
  return (
    <section className="mb-6 rounded-2xl p-5 sm:p-6" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          🛠 修復工具箱 <span className="text-sm font-normal text-white/55">· 合併單一入口</span>
        </h3>
        <Link to={`/bulk-scan/${websiteId}`} className="text-sm text-white/55 hover:text-white">
          查看所有工具 →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tools.map((t, i) => (
          <Link
            key={i}
            to={t.to}
            className="rounded-xl p-4 transition hover:scale-[1.02] block"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="text-3xl mb-2">{t.emoji}</div>
            <div className="text-base font-bold text-white mb-1">{t.name}</div>
            <div className="text-sm text-white/55 leading-relaxed">{t.desc}</div>
          </Link>
        ))}
      </div>
    </section>
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
              contentStyle={{ background: '#000', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontSize: 12 }}
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
