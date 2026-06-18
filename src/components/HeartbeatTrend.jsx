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
}) {
  const W = 800
  // 單一心跳節拍：x 比例 → 相對基線的位移（負=往上）
  const beat = [[0, 0], [0.22, 0], [0.30, -7], [0.36, 0], [0.43, 9], [0.48, -58], [0.52, 20], [0.57, 0], [0.72, -16], [0.84, 0], [1, 0]]
  const BEATS = 4, beatW = W / BEATS, baseStart = 152, drift = 18  // 每拍基線往上抬 = 曲折但整體上揚
  const pts = []
  for (let i = 0; i < BEATS; i++) {
    const base = baseStart - i * drift
    for (const [f, dy] of beat) {
      if (i > 0 && f === 0) continue  // 拍與拍的接點不重複
      pts.push([i * beatW + f * beatW, base + dy])
    }
  }
  const ecgPath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const peaks = Array.from({ length: BEATS }, (_, i) => [i * beatW + 0.48 * beatW, (baseStart - i * drift) - 58]) // R 波峰

  return (
    <section style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, padding: 22, marginBottom: 24, ...cardStyle,
    }}>
      {/* HTML 徽章小點用 CSS scale 沒問題（非 SVG）；心跳節奏「lub-dub」 */}
      <style>{`@keyframes hbBadge{0%,100%{transform:scale(.75);opacity:.5}12%{transform:scale(1.25);opacity:1}26%{transform:scale(.9);opacity:.7}40%{transform:scale(1.12);opacity:.95}54%{transform:scale(.75);opacity:.5}}`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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

        {/* 綠色虛線底（平滑上揚參考線） */}
        <path d={`M0,168 C 260,150 560,108 ${W},72`} fill="none" stroke={GREEN} strokeWidth="2"
          strokeDasharray="7 8" strokeLinecap="round" opacity="0.45" />

        {/* 橘黃發光心跳線 */}
        <path id="hbLine" d={ecgPath} fill="none" stroke={ORANGE} strokeWidth="2.6"
          strokeLinejoin="round" strokeLinecap="round" filter="url(#hbGlow)" />

        {/* R 波峰發光點：心跳脈動（SVG animate、避開 CSS scale 踩坑） */}
        {peaks.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} fill={ORANGE_HI} filter="url(#hbGlow)">
            <animate attributeName="r" values="2.5;5.5;3;5;2.5" dur="1.4s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;1;0.7;0.95;0.5" dur="1.4s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* 沿心跳線跑動的脈動點（心電監視器掃描感） */}
        <circle r="5.5" fill={ORANGE_HI} filter="url(#hbGlow)">
          <animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#hbLine" /></animateMotion>
        </circle>

        <text x={W - 6} y="16" fontSize="11" fill="rgba(255,255,255,0.4)" textAnchor="end">示意 · 持續掃描後顯示真實趨勢</text>
      </svg>

      {footer && <div style={{ marginTop: 12 }}>{footer}</div>}
    </section>
  )
}
