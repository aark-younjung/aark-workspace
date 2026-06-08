/**
 * 平台 logo wall — 首頁信任訊號區塊
 *
 * 設計目的：讓潛在用戶第一眼看到「我用的平台他也支援」，降低決策摩擦
 * 對標：getautoseo.com 首頁的 9-CMS logo wall（這招 SaaS 標準操作）
 *
 * 設計原則：
 * - 單色（白 / 灰）統一視覺，避免彩色 logo 在暗色背景花
 * - SVG inline 寫死，零外部依賴、零網路請求
 * - 對應 [fixGuides.js PLATFORMS]：WordPress / Shopify / Wix / 自架 HTML
 *   保留誠實 — 列我們真的有修法指南的，沒做 Squarespace / Webflow / BigCommerce 之類就不秀
 */
import { T } from '../../styles/v2-tokens'

const LOGO_COLOR = 'rgba(255,255,255,0.75)'
const LOGO_HOVER = 'rgba(255,255,255,1)'

export default function PlatformLogoWall() {
  return (
    <section style={{
      padding: '48px 24px',
      maxWidth: 1180, margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 14, color: T.textLow, letterSpacing: '0.15em',
        textTransform: 'uppercase', marginBottom: 24, fontWeight: 600,
      }}>
        不論你用什麼平台 · 我們都有對應修法步驟
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 56, flexWrap: 'wrap',
        opacity: 0.85,
      }}>
        <LogoWordPress />
        <LogoShopify />
        <LogoWix />
        <LogoHTML />
      </div>

      <p style={{
        fontSize: 14, color: T.textLow, marginTop: 24, lineHeight: 1.6, maxWidth: 540, margin: '24px auto 0',
      }}>
        Pro 版的「修復碼產生器」會依你的平台給對應指引 — 不會只給你一段 code 叫你自己猜要塞哪。
      </p>
    </section>
  )
}

// ─── Logo SVG 元件（單色處理）─────────────────────

function LogoWordPress() {
  return (
    <LogoFrame label="WordPress">
      <svg width="36" height="36" viewBox="0 0 122.5 122.5" fill="none">
        <circle cx="61.25" cy="61.25" r="58.25" stroke={LOGO_COLOR} strokeWidth="6" />
        <path d="M8.7 61.25c0 20.79 12.08 38.76 29.6 47.27L13.25 39.66a52.31 52.31 0 0 0-4.55 21.59zm87.84-2.65c0-6.49-2.33-10.98-4.33-14.48-2.66-4.32-5.16-7.99-5.16-12.31 0-4.82 3.66-9.32 8.82-9.32.23 0 .45.03.68.04a52.21 52.21 0 0 0-35.55-13.66c-26.65 0-50.1 21.79-50.1 52.4 0 5.49 14.31 41.13 27.41 41.13 4.55 0 11.74-4.7 11.74-15.71 0-3.34-1.42-7.16-3.06-11.65-1.99-5.49-4.32-12.15-4.32-17.97 0-6.99 4.99-13.48 12.81-13.48 7.32 0 12.31 5.49 12.31 11.81 0 5.66-2.99 9.32-7.66 14.65-4.32 4.99-9.65 11.31-9.65 21.96 0 14.31 5.99 22.79 11.81 22.79.9 0 1.66-.08 2.35-.22a51.7 51.7 0 0 0 18.71-22.27c.16-.97.3-1.95.3-2.93 0-7.99-2.33-13.48-4.32-17.97a59.93 59.93 0 0 1-1.79-5.16z" fill={LOGO_COLOR} opacity="0.5"/>
        <text x="61.25" y="76" textAnchor="middle" fontSize="48" fontWeight="700" fill={LOGO_COLOR} fontFamily="Georgia, serif">W</text>
      </svg>
      WordPress
    </LogoFrame>
  )
}

function LogoShopify() {
  return (
    <LogoFrame label="Shopify">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M28.5 9.2c0-.2-.2-.4-.4-.4-.2 0-3-.2-3-.2s-2.4-2.3-2.6-2.6c-.2-.2-.6-.2-.8-.1l-1.3.4c-.2-.6-.5-1.3-.9-2-1.3-2.4-3.2-3.7-5.5-3.7-.2 0-.3 0-.5.1-.1-.1-.2-.2-.2-.3C12.5.7 11.4 0 10 0 7.3 0 4.7 2 2.5 5.5.9 8 .1 10.2 0 12c2.8.9 12.4 3.8 12.4 3.8 0 .1 6.3 1.9 6.3 1.9l9.8-2.1S28.5 9.4 28.5 9.2zM18.6 6.6l-2.1.6c0-1.5-.2-3.6-.9-5.4 2.2.4 3.2 2.9 3 4.8zM15.1 7.7l-4.5 1.4c.4-1.7 1.3-3.4 2.3-4.5.4-.4.9-.9 1.5-1.2.7 1.3 1 3 .7 4.3zM12.4 1c.5 0 .9.1 1.2.3-.6.3-1.2.7-1.7 1.3-1.4 1.5-2.5 3.8-2.9 5.9L5.2 9.7C5.9 6 8.9 1.1 12.4 1z" fill={LOGO_COLOR}/>
        <path d="M28.1 8.8c-.2 0-3-.2-3-.2s-2.4-2.3-2.6-2.6c-.1-.1-.2-.1-.3-.2L20.7 36l9.8-2.1S28.3 9 28.3 8.9c-.1-.1-.1-.1-.2-.1z" fill={LOGO_COLOR} opacity="0.6"/>
        <path d="M16.4 12.4l-1.1 4.2s-1.3-.6-2.8-.5c-2.2.1-2.2 1.5-2.2 1.8.1 1.9 5.1 2.3 5.4 6.7.2 3.5-1.8 5.9-4.8 6.1-3.5.2-5.5-1.8-5.5-1.8l.7-3.1s2 1.5 3.6 1.4c1 0 1.4-.9 1.4-1.6-.2-2.5-4.3-2.4-4.5-6.4-.2-3.4 2-6.9 6.9-7.2 1.9-.2 2.9.4 2.9.4z" fill="#fff"/>
      </svg>
      Shopify
    </LogoFrame>
  )
}

function LogoWix() {
  return (
    <LogoFrame label="Wix">
      <svg width="56" height="36" viewBox="0 0 96 36" fill="none">
        <text x="48" y="28" textAnchor="middle" fontSize="32" fontWeight="800" fill={LOGO_COLOR} fontFamily="Helvetica, Arial, sans-serif" letterSpacing="-1">WiX</text>
        <circle cx="80" cy="14" r="3" fill={LOGO_COLOR} />
      </svg>
      Wix
    </LogoFrame>
  )
}

function LogoHTML() {
  return (
    <LogoFrame label="自架 / HTML">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="2" y="2" width="32" height="32" rx="4" stroke={LOGO_COLOR} strokeWidth="2.5" fill="none" />
        <text x="18" y="24" textAnchor="middle" fontSize="14" fontWeight="700" fill={LOGO_COLOR} fontFamily="ui-monospace, monospace">{'</>'}</text>
      </svg>
      自架 HTML
    </LogoFrame>
  )
}

// 共用 frame：logo 上、label 下，hover 全亮
function LogoFrame({ children, label }) {
  // 第一個子節點 = SVG / 圖示，第二個 = 文字 label
  const [icon, text] = Array.isArray(children) ? children : [children, null]
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        transition: 'opacity .2s', cursor: 'default',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.85' }}
      title={label}
    >
      {icon}
      <div style={{
        fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '.02em',
      }}>
        {text}
      </div>
    </div>
  )
}
