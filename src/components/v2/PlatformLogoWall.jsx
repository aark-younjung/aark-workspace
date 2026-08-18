/**
 * 平台 logo wall — 首頁信任訊號區塊
 *
 * 設計目的：讓潛在用戶第一眼看到「我用的平台他也支援」，降低決策摩擦
 * 對標：getautoseo.com 首頁的 9-CMS logo wall（這招 SaaS 標準操作）
 *
 * 設計原則：
 * - 單色（白 / 灰）統一視覺，避免彩色 logo 在暗色背景花
 * - SVG inline 寫死，零外部依賴、零網路請求
 *   （2026-08-18 改用 Simple Icons 官方品牌 path——手繪近似 logo 在信任區塊反而扣分）
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
      <svg width="36" height="36" viewBox="0 0 24 24" fill={LOGO_COLOR} role="img" aria-label="WordPress">
        <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0" />
      </svg>
      WordPress
    </LogoFrame>
  )
}

function LogoShopify() {
  return (
    <LogoFrame label="Shopify">
      <svg width="36" height="36" viewBox="0 0 24 24" fill={LOGO_COLOR} role="img" aria-label="Shopify">
        <path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z" />
      </svg>
      Shopify
    </LogoFrame>
  )
}

function LogoWix() {
  return (
    <LogoFrame label="Wix">
      <svg width="56" height="36" viewBox="0 0 24 24" fill={LOGO_COLOR} role="img" aria-label="Wix">
        <path d="m0 7.354 2.113 9.292h.801a1.54 1.54 0 0 0 1.506-1.218l1.351-6.34a.171.171 0 0 1 .167-.137c.08 0 .15.058.167.137l1.352 6.34a1.54 1.54 0 0 0 1.506 1.218h.805l2.113-9.292h-.565c-.62 0-1.159.43-1.296 1.035l-1.26 5.545-1.106-5.176a1.76 1.76 0 0 0-2.19-1.324c-.639.176-1.113.716-1.251 1.365l-1.094 5.127-1.26-5.537A1.33 1.33 0 0 0 .563 7.354H0zm13.992 0a.951.951 0 0 0-.951.95v8.342h.635a.952.952 0 0 0 .951-.95V7.353h-.635zm1.778 0 3.158 4.66-3.14 4.632h1.325c.368 0 .712-.181.918-.486l1.756-2.59a.12.12 0 0 1 .197 0l1.754 2.59c.206.305.55.486.918.486h1.326l-3.14-4.632L24 7.354h-1.326c-.368 0-.712.181-.918.486l-1.772 2.617a.12.12 0 0 1-.197 0L18.014 7.84a1.108 1.108 0 0 0-.918-.486H15.77z" />
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
