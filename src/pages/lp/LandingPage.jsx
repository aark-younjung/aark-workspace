/**
 * FB 廣告落地頁 — /lp/:variant（2026-06-13）
 *
 * 三個 variant 共用此模板（文案在 lpContent.js）：
 *   /lp/google-vs-ai  → A 組（品牌主）
 *   /lp/ai-site-check → C 組（AI 建站族群）
 *   /lp/agency        → B 組（代理商候補）
 *
 * 落地頁鐵律（與首頁的差異就是存在理由）：
 *   1. message match — 第一屏延續廣告大標話術
 *   2. 無導覽列、無逃生門 — 只有一個 CTA
 *   3. 掃描漏斗：未登入者留 URL（sessionStorage.lp_pending_url）→ /register
 *      → 註冊完回首頁，HomeDark 會自動把網址帶入輸入框
 *   4. Pixel：CTA 觸發 Lead 事件（pixel.js，沒設 ID 時靜默）
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AarkMark from '../../components/v2/AarkMark'
import AgencyWaitlistModal from '../../components/v2/AgencyWaitlistModal'
import { trackPixel } from '../../lib/pixel'
import { LP_VARIANTS } from './lpContent'

// 行內分段標色（color: null=白 / green=品牌青綠 / red=警示紅）
const SEG_COLOR = { green: '#18c590', red: '#ef4444' }

export default function LandingPage() {
  const { variant } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [stats, setStats] = useState(null)

  const content = LP_VARIANTS[variant]

  // 社會證明 KPI — 與首頁同一個公開端點
  useEffect(() => {
    fetch('/api/public?action=stats')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data) setStats(data) })
      .catch(() => {})
  }, [])

  // 未知 variant → 回首頁（防亂打網址 404 體驗）
  if (!content) return <Navigate to="/" replace />

  // 掃描漏斗：記下待掃網址 + Lead 事件 → 已登入直接回首頁（自動帶入）、未登入去註冊
  const handleScanSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    trackPixel('Lead', { content_name: `lp_${variant}` })
    sessionStorage.setItem('lp_pending_url', url.trim())
    navigate(user ? '/' : '/register')
  }

  // 代理商候補（次要 CTA）：Lead 事件單獨標記、與掃描 Lead 區分以利成效分析
  const handleWaitlist = () => {
    trackPixel('Lead', { content_name: 'lp_agency_waitlist' })
    setWaitlistOpen(true)
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: '#000' }}>
      {/* 品牌青綠漸層背景（與 HomeDark / Register 同一組） */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none z-0"
        style={{
          height: '1600px',
          background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
          mixBlendMode: 'lighten',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pt-10 pb-16 max-w-2xl mx-auto w-full">
        {/* 頂部：logo 列（純識別、不是導覽 — 落地頁不給逃生門） */}
        <div className="flex items-center gap-2.5 self-start mb-14">
          <AarkMark size={28} />
          <span className="text-white font-bold text-lg tracking-wide">方舟 AI 雷達</span>
        </div>

        {/* 徽章 */}
        <span
          className="px-3 py-1 rounded-full text-xs font-medium mb-6 border"
          style={{ color: '#18c590', borderColor: 'rgba(24,197,144,0.4)', background: 'rgba(24,197,144,0.08)' }}
        >
          {content.badge}
        </span>

        {/* 大標 — 延續廣告話術（message match 核心） */}
        <h1 className="text-center font-black leading-tight mb-6" style={{ fontSize: 'clamp(28px, 6vw, 44px)' }}>
          {content.headline.map((line, li) => (
            <span key={li} className="block">
              {line.map((seg, si) => (
                <span key={si} style={{ color: seg.c ? SEG_COLOR[seg.c] : '#fff' }}>{seg.t}</span>
              ))}
            </span>
          ))}
        </h1>

        {/* 副標 */}
        <p className="text-center text-base leading-relaxed mb-10 max-w-lg" style={{ color: '#94a3b8' }}>
          {content.sub}
        </p>

        {/* 主 CTA — 所有 variant 都以掃描框開場（agency 也是：先體驗、後申請） */}
        <form onSubmit={handleScanSubmit} className="w-full max-w-md flex flex-col sm:flex-row gap-3 mb-10">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={content.inputPlaceholder}
            className="flex-1 px-5 py-3.5 rounded-xl text-white placeholder-slate-500 outline-none border"
            style={{ background: 'rgba(15,23,42,0.8)', borderColor: 'rgba(148,163,184,0.25)' }}
          />
          <button
            type="submit"
            className="px-6 py-3.5 rounded-xl font-bold whitespace-nowrap transition-transform hover:scale-105"
            style={{ background: '#18c590', color: '#011520' }}
          >
            {content.cta}
          </button>
        </form>

        {/* 三行賣點（scan variant 用） */}
        {content.bullets && (
          <ul className="space-y-3 mb-12">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#cbd5e1' }}>
                <span style={{ color: '#18c590' }}>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* agency variant：三步流程 + 次要候補 CTA（熱流量直達出口） */}
        {content.steps && (
          <div className="w-full max-w-md mb-12">
            <div className="space-y-4 mb-10">
              {content.steps.map((s, i) => (
                <div key={i} className="flex items-start gap-4 rounded-xl border p-4"
                  style={{ background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(148,163,184,0.15)' }}>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: 'rgba(24,197,144,0.15)', color: '#18c590' }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-white font-semibold text-sm mb-0.5">{s.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm mb-3" style={{ color: '#94a3b8' }}>準備好接案了？</p>
              <button
                onClick={handleWaitlist}
                className="px-8 py-3.5 rounded-xl font-bold border transition-colors hover:bg-white/5"
                style={{ color: '#18c590', borderColor: 'rgba(24,197,144,0.45)', background: 'transparent' }}
              >
                {content.waitlistCta}
              </button>
              <p className="text-xs mt-3" style={{ color: '#64748b' }}>{content.waitlistNote}</p>
            </div>
          </div>
        )}

        {/* 社會證明（公開 stats 端點、載不到就不顯示） */}
        {stats && (
          <p className="text-xs" style={{ color: '#64748b' }}>
            已為 {Number(stats.brands || 0).toLocaleString()} 個品牌完成 {Number(stats.scans || 0).toLocaleString()} 次 AI 能見度掃描
          </p>
        )}
      </div>

      {/* 迷你 footer — 法遵連結（廣告審核需要隱私權頁可達） */}
      <footer className="relative z-10 text-center pb-6 text-xs space-x-4" style={{ color: '#475569' }}>
        <span>方舟 AI 雷達 · 優勢方舟數位行銷</span>
        <a href="/terms" className="underline hover:text-slate-300">服務條款</a>
        <a href="/privacy" className="underline hover:text-slate-300">隱私權政策</a>
      </footer>

      {/* 代理商候補 modal（重用 Pricing 同一顆） */}
      <AgencyWaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} />
    </div>
  )
}
