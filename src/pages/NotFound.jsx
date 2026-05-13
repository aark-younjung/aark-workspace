import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import SiteHeader from '../components/v2/SiteHeader'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

// 404 頁面：取代原本「任何錯誤 URL 都 silent Navigate to /」的死路徑
// 沿用 LegalPageLayout 同款背景（雙端青綠漸層 + 雜訊）+ SiteHeader + Footer，視覺與其他頁一致
export default function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 頂部漸層 */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 底部漸層 */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 雜訊 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12, mixBlendMode: 'overlay',
      }} />

      <SiteHeader />

      <main style={{ position: 'relative', zIndex: 10, maxWidth: 720, margin: '0 auto', padding: '80px 24px 64px' }}>
        <GlassCard color={T.orange} style={{ padding: '56px 32px', textAlign: 'center' }}>
          {/* 巨大 404 數字 — 橘紅漸層 */}
          <div style={{
            fontSize: 'clamp(5rem, 14vw, 9rem)',
            fontWeight: 900,
            lineHeight: 1,
            background: `linear-gradient(135deg, ${T.orange}, #f59e0b)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 16,
            letterSpacing: '-0.04em',
          }}>404</div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: T.text, marginBottom: 12 }}>
            找不到這個頁面
          </h1>

          <p style={{ fontSize: '1rem', color: T.textMid, lineHeight: 1.7, maxWidth: 480, margin: '0 auto 32px' }}>
            這個網址可能不存在、已被移除，或您剛剛點到的連結已失效。
            您可以回到首頁開始新的 AI 能見度分析，或從下面的常用連結繼續探索。
          </p>

          {/* 主要 CTA */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 36 }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 28px',
                background: 'linear-gradient(135deg, #f97316, #f59e0b)',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 12,
                textDecoration: 'none',
                boxShadow: '0 8px 20px rgba(249,115,22,0.3)',
              }}
            >
              ← 回到首頁分析
            </Link>
            <Link
              to="/pricing"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 28px',
                background: 'rgba(255,255,255,0.06)',
                color: T.text,
                fontWeight: 600,
                borderRadius: 12,
                textDecoration: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              查看方案 →
            </Link>
          </div>

          {/* 常用連結 4 顆 — 給用戶 escape hatch */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
            <div style={{ fontSize: '0.85rem', color: T.textLow, marginBottom: 12 }}>或前往：</div>
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.95rem' }}>
              <Link to="/showcase" style={{ color: T.orange, textDecoration: 'underline' }}>排行榜</Link>
              <Link to="/compare" style={{ color: T.orange, textDecoration: 'underline' }}>競品比較</Link>
              <Link to="/content-audit" style={{ color: T.orange, textDecoration: 'underline' }}>文章分析</Link>
              <Link to="/faq" style={{ color: T.orange, textDecoration: 'underline' }}>常見問題</Link>
            </div>
          </div>
        </GlassCard>

        {/* 底部聯絡 */}
        <div style={{ textAlign: 'center', marginTop: 32, color: T.textMid, fontSize: '0.9rem' }}>
          覺得這個頁面不該消失？歡迎回報 →{' '}
          <a href="mailto:aark.younjung@gmail.com" style={{ color: T.orange, textDecoration: 'underline' }}>
            aark.younjung@gmail.com
          </a>
        </div>
      </main>

      <Footer dark />
    </div>
  )
}
