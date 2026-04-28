// 共用的檢測報告頂部 Hero 區（麵包屑列 + 分數總覽卡）
//   - AuditTopBar：返回 dashboard 麵包屑 + 重新檢測 / 匯出 PDF 按鈕
//   - ScoreHero：兩個 chip + 一行白話定位 + 大圓圈分數 + 7 日趨勢迷你圖 + 已通過/需修復兩格
//   - HeroSkeleton：載入中骨架
// 從 SEOAudit 抽出，供 AEO/GEO/EEAT/Content 四頁共用
import { Link } from 'react-router-dom'
import { T } from '../../styles/v2-tokens'

// =====================================================
// AuditTopBar — 頂部麵包屑列：返回 Dashboard + 重新檢測 + 匯出 PDF
// =====================================================
export function AuditTopBar({ websiteId, face, websiteUrl, onReanalyze, analyzing, accent, accent2 }) {
  return (
    <div style={{
      marginBottom: 16, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      {/* 麵包屑：返回 + 檢測報告 / 面向 / 網址 */}
      <Link to={`/dashboard/${websiteId}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
        padding: '9px 16px 9px 10px', borderRadius: 12,
        color: T.textMid, textDecoration: 'none', fontSize: 13, fontFamily: T.font,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'rgba(255,255,255,.05)', border: `1px solid ${T.cardBorder}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: T.textMid, lineHeight: 1,
        }}>‹</span>
        <span style={{ color: T.textMid }}>檢測報告</span>
        <span style={{ color: T.textLow }}>/</span>
        <span style={{ color: T.text, fontWeight: 600 }}>{face}</span>
        {websiteUrl && (
          <>
            <span style={{ color: T.textLow }}>/</span>
            <span style={{ color: T.text, fontFamily: T.mono, fontSize: 12 }}>{websiteUrl}</span>
          </>
        )}
      </Link>
      {/* 右側：重新檢測 + 匯出 PDF */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onReanalyze} disabled={analyzing} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
          color: T.text, fontSize: 13, fontWeight: 600,
          padding: '10px 18px', borderRadius: 12, cursor: analyzing ? 'not-allowed' : 'pointer',
          fontFamily: T.font, opacity: analyzing ? 0.6 : 1,
        }}>
          <span style={{
            fontSize: 13, display: 'inline-block',
            animation: analyzing ? 'spin .9s linear infinite' : 'none',
          }}>↻</span>
          {analyzing ? '檢測中…' : '重新檢測'}
        </button>
        <button onClick={() => window.print()} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: `linear-gradient(135deg, ${accent}, ${accent2 || accent})`,
          border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
          padding: '10px 18px', borderRadius: 12, cursor: 'pointer',
          fontFamily: T.font, boxShadow: `0 4px 14px ${accent}55`,
        }}>
          <span>📄</span>匯出 PDF
        </button>
      </div>
    </div>
  )
}

// =====================================================
// ScoreHero — chip + 標語 + 大圓圈分數 + 7 日趨勢 + 已通過/需修復兩格
// =====================================================
export function ScoreHero({
  face, subChip, tagline,
  score, passedCount, failedCount, total,
  recentAudits = [], accent,
}) {
  // recentAudits 是新→舊；翻成舊→新給趨勢線吃
  const trendData = recentAudits.slice().reverse().map(a => a.score ?? 0)
  const trendDelta = trendData.length >= 2
    ? trendData[trendData.length - 1] - trendData[0]
    : 0
  // 分數色階：>=80 綠、>=60 面向色、其他 警示橘
  const scoreColor = score >= 80 ? T.pass : score >= 60 ? accent : T.warn
  const deltaColor = trendDelta > 0 ? T.pass : trendDelta < 0 ? T.fail : T.textMid
  const deltaSign = trendDelta > 0 ? '+' : ''

  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* 上：兩個 chip + 一行白話定位 */}
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '.08em',
            background: accent + '1f', border: `1px solid ${accent}38`,
            padding: '3px 8px', borderRadius: 5,
          }}>{face}</span>
          {subChip && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: T.textMid, letterSpacing: '.04em',
              background: 'rgba(255,255,255,.04)', border: `1px solid ${T.cardBorder}`,
              padding: '3px 8px', borderRadius: 5,
            }}>{subChip}</span>
          )}
        </div>
        {tagline && (
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.55 }}>
            {tagline}
          </div>
        )}
      </div>

      {/* 中：分數圈 + 7 日趨勢迷你圖 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <ScoreCircle score={score} color={scoreColor} />
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 11, color: T.textLow, marginBottom: 4, letterSpacing: '.06em' }}>7 日趨勢</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: deltaColor,
            marginBottom: 8, fontFamily: T.font, letterSpacing: '-.01em',
          }}>
            {trendData.length >= 2 ? `${deltaSign}${trendDelta} 分` : '— 首次掃描'}
          </div>
          <Sparkline
            data={trendData.length >= 2 ? trendData : [score, score]}
            color={accent}
          />
        </div>
      </div>

      {/* 下：已通過 / 需修復 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{
          background: T.pass + '14', border: `1px solid ${T.pass}33`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>已通過</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: T.pass, fontFamily: T.font }}>{passedCount}</span>
            <span style={{ fontSize: 12, color: T.textLow }}>/ {total}</span>
          </div>
        </div>
        <div style={{
          background: failedCount > 0 ? T.fail + '14' : 'rgba(255,255,255,.03)',
          border: `1px solid ${failedCount > 0 ? T.fail + '33' : T.cardBorder}`,
          borderRadius: 12, padding: '12px 14px',
        }}>
          <div style={{ fontSize: 11, color: T.textMid, marginBottom: 4 }}>需修復</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: 24, fontWeight: 800,
              color: failedCount > 0 ? T.fail : T.textMid,
              fontFamily: T.font,
            }}>{failedCount}</span>
            <span style={{ fontSize: 12, color: T.textLow }}>
              {failedCount > 0 ? '項待處理' : '項，全部達標'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ScoreCircle — SVG 圓形進度，搭配中央分數
// =====================================================
function ScoreCircle({ score, color }) {
  const size = 150
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(score, 100)) / 100) * circumference
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset .8s ease-out',
            filter: `drop-shadow(0 0 8px ${color}aa)`,
          }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 38, fontWeight: 800, color: T.text,
          letterSpacing: '-.02em', fontFamily: T.font, lineHeight: 1,
        }}>{score}</div>
        <div style={{ fontSize: 10, color: T.textLow, marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  )
}

// =====================================================
// Sparkline — 7 日趨勢迷你折線 + 漸層填充
// =====================================================
function Sparkline({ data, color }) {
  if (!data?.length) return <div style={{ height: 40 }} />
  const max = Math.max(...data, 100)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100
    const y = 100 - ((v - min) / range) * 80 - 10
    return `${x},${y}`
  }).join(' ')
  const gradId = `audit-spark-grad-${color.replace('#', '')}`
  return (
    <svg width="100%" height="44" viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// =====================================================
// HeroSkeleton — 載入中骨架（給 ScoreHero 用）
// =====================================================
export function HeroSkeleton() {
  return (
    <div style={{
      background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
      borderRadius: T.rL, padding: 24, height: 320,
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ height: 14, width: '40%', background: 'rgba(255,255,255,.06)', borderRadius: 4 }} />
      <div style={{ height: 150, background: 'rgba(255,255,255,.04)', borderRadius: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ height: 56, background: 'rgba(255,255,255,.04)', borderRadius: 12 }} />
        <div style={{ height: 56, background: 'rgba(255,255,255,.04)', borderRadius: 12 }} />
      </div>
    </div>
  )
}
