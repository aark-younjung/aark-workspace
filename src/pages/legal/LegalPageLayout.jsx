import Footer from '../../components/Footer'
import SiteHeader from '../../components/v2/SiteHeader'
import { T } from '../../styles/v2-tokens'
import { GlassCard } from '../../components/v2'

/* 法律頁共用外殼：頂部漸層 + 雜訊 + SiteHeader + 標題 hero + 內容 GlassCard + Footer
 * 三個法律頁（Terms / Privacy / ConsumerRights）共用，避免重複寫三次背景 + header */
export default function LegalPageLayout({ title, subtitle, lastUpdated, children }) {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#000' }}>
      {/* 上方青綠漸層光暈 — 與 HomeDark 一致（155deg 左上亮、3000px 高度、lighten 混合） */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 下方青綠漸層光暈 — 從頁尾右下往左上擴散（335deg = 155deg 雙軸鏡像） */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 顆粒感疊層 — 與 HomeDark 一致 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12, mixBlendMode: 'overlay',
      }} />

      <SiteHeader />

      <main style={{ position: 'relative', zIndex: 10, maxWidth: 960, margin: '0 auto', padding: '48px 24px 64px' }}>
        {/* 標題 hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, color: T.text, marginBottom: 12, letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: '1.05rem', color: T.textMid, lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
              {subtitle}
            </p>
          )}
          {lastUpdated && (
            <p style={{ fontSize: '0.85rem', color: T.textLow, marginTop: 16 }}>
              最後更新日期：{lastUpdated}
            </p>
          )}
        </div>

        {/* 內容主體 */}
        <GlassCard color={T.orange} style={{ padding: '40px 32px' }}>
          <article className="legal-content" style={{ color: T.text }}>
            {children}
          </article>
        </GlassCard>

        {/* 底部聯絡 CTA */}
        <div style={{ textAlign: 'center', marginTop: 32, color: T.textMid, fontSize: '0.9rem' }}>
          對本政策有任何疑問？歡迎來信{' '}
          <a href="mailto:aark.younjung@gmail.com" style={{ color: T.orange, textDecoration: 'underline' }}>
            aark.younjung@gmail.com
          </a>
          {' '}或撥打客服電話 0952-555-365
        </div>
      </main>

      <Footer dark />

      {/* 法律頁內部排版 — h2/h3/p/ul 的字級與間距，避免每段 inline style */}
      <style>{`
        .legal-content h2 {
          font-size: 1.35rem; font-weight: 700; color: ${T.text};
          margin: 32px 0 14px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .legal-content h2:first-child { margin-top: 0; }
        .legal-content h3 {
          font-size: 1.05rem; font-weight: 600; color: ${T.text};
          margin: 20px 0 10px;
        }
        .legal-content p {
          font-size: 0.95rem; line-height: 1.75; color: ${T.textMid};
          margin: 0 0 12px;
        }
        .legal-content ul, .legal-content ol {
          font-size: 0.95rem; line-height: 1.8; color: ${T.textMid};
          margin: 0 0 16px; padding-left: 1.4rem;
        }
        .legal-content li { margin-bottom: 6px; }
        .legal-content strong { color: ${T.text}; font-weight: 600; }
        .legal-content a { color: ${T.orange}; text-decoration: underline; }
        .legal-content .highlight-box {
          background: rgba(251,146,60,0.08);
          border-left: 3px solid ${T.orange};
          padding: 14px 18px;
          margin: 16px 0;
          border-radius: 6px;
        }
        .legal-content .highlight-box p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  )
}
