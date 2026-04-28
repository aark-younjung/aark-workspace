// SEO 專屬右側 Hero 面板：Google SERP 預覽 + Core Web Vitals
//   - 從 SEOAudit 抽出，與 ScoreHero 並排作為兩欄 hero 的右側
//   - SERP 預覽：模擬 Google 搜尋結果列（圈頭 + 站名 + URL + 藍字標題 + 描述）
//   - Core Web Vitals：LCP（從 page_speed.loadTime 推算）+ INP / CLS（尚未量測，顯示 —）
import { T } from '../../styles/v2-tokens'

const KEYFRAMES = `
.v2-cwv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
@media (max-width: 540px) { .v2-cwv-grid { grid-template-columns: 1fr; } }
`

export default function SerpAndVitals({ website, audit, loadTime }) {
  const url = website?.url || ''
  // 去掉 protocol + 結尾斜線，給 SERP URL 列顯示用
  const hostname = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const title = audit?.meta_tags?.titleContent || website?.name || hostname || '尚無標題'
  const description = audit?.meta_tags?.descriptionContent || '尚無 Meta 描述，建議於 <head> 加入 <meta name="description">。'
  const siteName = website?.name || hostname || '網站'

  // LCP：用 loadTime 近似（< 2.5s 通過、其他失敗）
  const lcpSec = loadTime ? loadTime / 1000 : null
  const lcpStatus = lcpSec === null ? null : (lcpSec < 2.5 ? 'pass' : 'fail')
  const lcpColor = lcpStatus === null ? T.textLow : (lcpStatus === 'pass' ? T.pass : T.fail)
  // 進度條填充比：以 4s 為滿格上限
  const lcpRatio = lcpSec === null ? 0 : Math.min(lcpSec / 4, 1)

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        background: 'rgba(1,8,14,.6)', border: `1px solid ${T.cardBorder}`,
        borderRadius: T.rL, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* SERP 預覽 */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.textMid,
            letterSpacing: '.12em', marginBottom: 12,
          }}>GOOGLE SERP 預覽</div>
          <div style={{
            background: 'rgba(0,0,0,.4)', border: `1px solid ${T.cardBorder}`,
            borderRadius: 14, padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: T.orange, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#fff',
              }}>
                {(siteName || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: T.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{siteName}</div>
                <div style={{
                  fontSize: 11, color: T.textLow, fontFamily: T.mono,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{url || '—'}</div>
              </div>
            </div>
            <div style={{
              fontSize: 16, color: '#93c5fd', fontWeight: 600,
              marginBottom: 6, lineHeight: 1.35,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{title}</div>
            <div style={{
              fontSize: 12, color: T.textMid, lineHeight: 1.55,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>{description}</div>
          </div>
        </div>

        {/* Core Web Vitals */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.textMid,
            letterSpacing: '.12em', marginBottom: 12,
          }}>CORE WEB VITALS</div>
          <div className="v2-cwv-grid">
            <CWVMetric
              label="LCP"
              value={lcpSec !== null ? `${lcpSec.toFixed(1)}s` : '—'}
              target="目標 < 2.5s"
              status={lcpStatus}
              color={lcpColor}
              fillRatio={lcpRatio}
            />
            {/* INP / CLS：目前 analyzer 未量測，先以 — 顯示，避免假數據 */}
            <CWVMetric label="INP" value="—" target="目標 < 200ms" status={null} color={T.textLow} fillRatio={0} note="尚未量測" />
            <CWVMetric label="CLS" value="—" target="目標 < 0.10" status={null} color={T.textLow} fillRatio={0} note="尚未量測" />
          </div>
        </div>
      </div>
    </>
  )
}

// 單一 Core Web Vitals 指標格
function CWVMetric({ label, value, target, status, color, fillRatio, note }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: `1px solid ${status ? color + '33' : T.cardBorder}`,
      borderRadius: 12, padding: '14px 14px 12px', minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: T.textMid, letterSpacing: '.1em',
        }}>{label}</span>
        {status && (
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: status === 'pass' ? T.pass : T.fail, lineHeight: 1,
          }}>{status === 'pass' ? '✓' : '×'}</span>
        )}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: T.text,
        letterSpacing: '-.02em', marginBottom: 4, fontFamily: T.font, lineHeight: 1.1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textLow, marginBottom: 8 }}>
        {note ? `${target} · ${note}` : target}
      </div>
      <div style={{
        height: 4, background: 'rgba(255,255,255,.06)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(fillRatio * 100, 100)}%`, height: '100%',
          background: color, borderRadius: 2,
          transition: 'width .6s ease-out',
        }} />
      </div>
    </div>
  )
}
