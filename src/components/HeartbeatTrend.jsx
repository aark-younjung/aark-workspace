/**
 * HeartbeatTrend — 心跳脈動「趨勢成形中」示意圖（共用）（2026-06-19）
 *
 * 為什麼：掃完第一次、資料點太少畫不出真趨勢時，原本趨勢區一片空白、留不住新客戶。
 *   用 ECG 心電圖風格當視覺勾子——上下曲折、整體上揚的橘黃發光心跳線。
 *
 * 兩處使用：
 *   - DashboardV2（SEO 網站儀表板）：第一次掃完（trendData ≤1 筆）
 *   - AIVisibilityDashboard（AI 曝光監測）：掃 1-2 天（daysWithData <3）
 *
 * 視覺：橘黃發光心跳線（R 波大尖峰 + S 波回落 + T 波小丘、每拍基線往上抬）
 *   + R 波峰脈動發光點 + 沿線跑動的脈動點（監視器掃描感）+ 綠色虛線上揚底參考線。
 *   純示意動畫、非真數據（右上明標「示意」）。
 *   脈動點一律用 SVG <animate>（不用 CSS scale——SVG transform-origin 會跑位，專案踩坑）。
 *
 * 注意：filter/path 用固定 id（hbGlow / hbLine）。同一頁只會有一個實例，故不會撞 id。
 *
 * Props：title / subtitle / footer(node) / action(node，右上額外按鈕) / cardStyle(覆蓋卡片樣式)
 *   / bare(去掉外層卡片框，融入別的容器當「生命徵象帶」用，例：嵌進 aivis Hero 卡片內)
 *   title 傳空字串可隱藏標題（bare 嵌入時常用、避免與外層卡片標題重複）。
 */
const ORANGE = '#FF9D2E'      // 發光心跳線
const ORANGE_HI = '#FFC24B'   // 高光點 / 橘黃
const GREEN = '#18c590'       // 綠色虛線底（品牌青綠）

export default function HeartbeatTrend({
  title = '📈 過去 30 天進步軌跡',
  subtitle,
  footer,
  action,
  cardStyle,
  bare = false,
}) {
  const W = 800, DUR = 3.6 // 掃描一輪秒數（畫線與掃描點共用、確保同步）
  // 不規律心跳：每拍寬度/基線/振幅都不同 → 上下起伏不規律、整體仍向上（中間有小回落、更像真實波形）
  const beatDefs = [
    { w: 150, base: 150, amp: 52 },
    { w: 185, base: 134, amp: 36 },
    { w: 140, base: 142, amp: 66 },  // 基線小回落 + 大尖峰
    { w: 175, base: 110, amp: 44 },
    { w: 150, base: 92, amp: 58 },
  ] // 寬度合計 = 800
  // 單拍形狀：x 比例 → R 波振幅倍率（負=往上）。R 大尖峰 -1.0、S 回落 +0.34、T 小丘 -0.27。
  const shape = [[0, 0], [0.20, 0], [0.29, -0.12], [0.35, 0], [0.42, 0.16], [0.47, -1.0], [0.51, 0.34], [0.56, 0], [0.70, -0.27], [0.83, 0], [1, 0]]
  const pts = []
  let bx = 0
  beatDefs.forEach((b, bi) => {
    shape.forEach(([f, fac], si) => {
      if (bi > 0 && si === 0) return  // 拍與拍接點不重複
      pts.push([bx + f * b.w, b.base + fac * b.amp])
    })
    bx += b.w
  })
  const ecgPath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  // bare：去掉外層卡片框，融入別的容器（例：嵌進 aivis Hero 卡片內）
  const sectionStyle = bare
    ? { width: '100%', ...cardStyle }
    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 22, marginBottom: 24, ...cardStyle }

  return (
    <section style={sectionStyle}>
      {/* HTML 徽章小點用 CSS scale 沒問題（非 SVG）；心跳節奏「lub-dub」 */}
      <style>{`@keyframes hbBadge{0%,100%{transform:scale(.75);opacity:.5}12%{transform:scale(1.25);opacity:1}26%{transform:scale(.9);opacity:.7}40%{transform:scale(1.12);opacity:.95}54%{transform:scale(.75);opacity:.5}}`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: title || subtitle ? 14 : 8 }}>
        <div>
          {title && <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>}
          {subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: `${ORANGE}22`, border: `1px solid ${ORANGE}66`, color: ORANGE_HI }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, display: 'inline-block', animation: 'hbBadge 1.4s ease-in-out infinite' }} />
            趨勢成形中
          </span>
          {action}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 200`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <filter id="hbGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* 綠色虛線「軌跡」：完整顯示整條波形（預示掃描點將經過的路徑） */}
        <path d={ecgPath} fill="none" stroke={GREEN} strokeWidth="2"
          strokeDasharray="6 7" strokeLinecap="round" opacity="0.4" />

        {/* 橘黃發光線：被掃描點「畫」出來 — pathLength 正規化 + stroke-dashoffset 100→0，
            與下方 animateMotion 同 DUR、同走弧長 → 掃描點領在橘線最前端、點還沒到的地方不出現橘線 */}
        <path id="hbLine" d={ecgPath} fill="none" stroke={ORANGE} strokeWidth="2.8"
          pathLength="100" strokeDasharray="100 100" strokeLinejoin="round" strokeLinecap="round" filter="url(#hbGlow)">
          <animate attributeName="stroke-dashoffset" values="100;0" dur={`${DUR}s`} repeatCount="indefinite" />
        </path>

        {/* 領頭的掃描點（心電監視器掃描感）：沿線跑、領著畫出橘線 */}
        <circle r="6" fill={ORANGE_HI} filter="url(#hbGlow)">
          <animateMotion dur={`${DUR}s`} repeatCount="indefinite"><mpath href="#hbLine" /></animateMotion>
        </circle>

        <text x={W - 6} y="16" fontSize="11" fill="rgba(255,255,255,0.4)" textAnchor="end">示意 · 持續掃描後顯示真實趨勢</text>
      </svg>

      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </section>
  )
}
