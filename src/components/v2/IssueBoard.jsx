import { useState } from 'react'
import { Link } from 'react-router-dom'
import { T } from '../../styles/v2-tokens'
import { FIX_GUIDES, PLATFORMS } from '../../data/fixGuides'

const KEYFRAMES = `
.v2-issue-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 1100px) { .v2-issue-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .v2-issue-board { grid-template-columns: 1fr; } }
.v2-issue-fix-panel { animation: v2FadeUp .25s ease-out; }
@keyframes v2FadeUp { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
`

export default function IssueBoard({ checks, isPro, accent = T.seo, accentGlow }) {
  const [expanded, setExpanded] = useState(null)
  const lanes = [
    { id: 'P1', title: '立即修復', sub: '1–2 週內',  c: T.fail,  glow: 'rgba(239,68,68,.16)' },
    { id: 'P2', title: '本月內',   sub: '1–3 個月', c: T.warn,  glow: 'rgba(245,158,11,.14)' },
    { id: 'P3', title: '季度規劃', sub: '3 個月後', c: accent,  glow: accentGlow || 'rgba(59,130,246,.14)' },
    { id: 'OK', title: '已通過',   sub: '維持現狀',  c: T.pass,  glow: 'rgba(16,185,129,.12)' },
  ]
  const grouped = lanes.map(l => ({
    ...l,
    items: checks.filter(c => l.id === 'OK' ? c.passed : (!c.passed && c.priority === l.id)),
  }))
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="v2-issue-board">
        {grouped.map(lane => (
          <IssueLane key={lane.id}
            lane={lane}
            expandedId={expanded}
            onToggle={(id) => setExpanded(expanded === id ? null : id)}
            isPro={isPro} />
        ))}
      </div>
    </>
  )
}

function IssueLane({ lane, expandedId, onToggle, isPro }) {
  return (
    <div style={{
      background: 'rgba(1,8,14,.55)',
      border: `1px solid ${lane.c}33`,
      borderRadius: T.rL, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
      boxShadow: `inset 0 1px 0 0 ${lane.glow}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
          padding: '4px 8px', borderRadius: 5,
          background: lane.c + '26', color: lane.c, border: `1px solid ${lane.c}55`,
        }}>{lane.id}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{lane.title}</div>
          <div style={{ fontSize: 10, color: T.textLow }}>{lane.sub}</div>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 800, color: lane.c, fontFamily: T.font,
          minWidth: 22, textAlign: 'right',
        }}>{lane.items.length}</span>
      </div>

      {lane.items.length === 0 ? (
        <div style={{
          fontSize: 11, color: T.textLow, textAlign: 'center',
          padding: '20px 8px', border: `1px dashed ${T.cardBorder}`,
          borderRadius: 10, lineHeight: 1.55,
        }}>{lane.id === 'OK' ? '尚無通過項目' : '此優先度無待修項'}</div>
      ) : (
        lane.items.map(check => (
          <IssueCard key={check.id}
            check={check}
            lane={lane}
            isOpen={expandedId === check.id}
            onToggle={() => onToggle(check.id)}
            isPro={isPro} />
        ))
      )}
    </div>
  )
}

function IssueCard({ check, lane, isOpen, onToggle, isPro }) {
  const canExpand = !check.passed
  return (
    <div style={{
      background: 'rgba(0,0,0,.35)',
      border: `1px solid ${isOpen ? lane.c + '88' : T.cardBorder}`,
      borderRadius: 12, overflow: 'hidden',
      transition: 'border-color .2s',
    }}>
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        style={{
          all: 'unset',
          width: '100%', boxSizing: 'border-box',
          padding: 12, cursor: canExpand ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: 6,
          fontFamily: T.font,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{check.icon}</span>
          <span style={{
            fontSize: 13, fontWeight: 700, color: T.text,
            flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{check.name}</span>
          {canExpand && (
            <span style={{
              fontSize: 16, color: lane.c, lineHeight: 1,
              transform: isOpen ? 'rotate(45deg)' : 'rotate(0)',
              transition: 'transform .2s',
            }}>+</span>
          )}
        </div>
        {check.detail && (
          <div style={{
            fontSize: 11, color: T.textMid, lineHeight: 1.55,
            paddingLeft: 24,
          }}>{check.detail}</div>
        )}
      </button>

      {isOpen && canExpand && (
        <div className="v2-issue-fix-panel" style={{
          borderTop: `1px solid ${lane.c}33`,
          background: 'rgba(255,255,255,.02)', padding: 14,
        }}>
          {isPro
            ? <IssueFixPanel check={check} lane={lane} />
            : <IssueLockCTA lane={lane} />}
        </div>
      )}
    </div>
  )
}

function IssueFixPanel({ check, lane }) {
  const guide = FIX_GUIDES[check.id]
  const availablePlatforms = guide
    ? PLATFORMS.filter(p => guide.platforms?.[p.id])
    : []
  const [activePlatform, setActivePlatform] = useState(availablePlatforms[0]?.id || 'html')
  const platformData = guide?.platforms?.[activePlatform]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 12, color: T.textMid, lineHeight: 1.7,
        padding: '10px 12px', background: 'rgba(255,255,255,.03)',
        border: `1px solid ${T.cardBorder}`, borderRadius: 8,
      }}>
        <span style={{ color: lane.c, fontWeight: 700 }}>建議：</span>
        {guide?.summary || check.recommendation}
      </div>

      {availablePlatforms.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availablePlatforms.map(p => (
              <button key={p.id} type="button"
                onClick={() => setActivePlatform(p.id)}
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  background: activePlatform === p.id ? lane.c + '22' : 'rgba(255,255,255,.03)',
                  color: activePlatform === p.id ? lane.c : T.textMid,
                  border: `1px solid ${activePlatform === p.id ? lane.c + '55' : T.cardBorder}`,
                  fontFamily: T.font, transition: 'all .15s',
                }}>{p.label}</button>
            ))}
          </div>

          {platformData?.steps && (
            <ol style={{
              margin: 0, paddingLeft: 22,
              fontSize: 12, color: T.textMid, lineHeight: 1.75,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {platformData.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}

          {platformData?.code && (
            <pre style={{
              margin: 0, padding: 12, fontSize: 11, lineHeight: 1.6,
              background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
              borderRadius: 8, color: '#cbd5e1', fontFamily: T.mono,
              overflow: 'auto', whiteSpace: 'pre',
            }}>{platformData.code}</pre>
          )}
        </>
      )}

      {availablePlatforms.length === 0 && (
        <div style={{ fontSize: 11, color: T.textLow, fontStyle: 'italic' }}>
          目前無平台別操作步驟，可參考上方建議自行調整。
        </div>
      )}
    </div>
  )
}

function IssueLockCTA({ lane }) {
  return (
    <Link to="/pricing" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(0,0,0,.3)',
      border: `1px dashed ${lane.c}55`, borderRadius: 8,
      padding: '12px 14px', textDecoration: 'none',
      transition: 'all .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = lane.c + '12' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,.3)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>
          🔒 升級 Pro 解鎖修復指南
        </div>
        <div style={{ fontSize: 10, color: T.textLow, lineHeight: 1.5 }}>
          含 WordPress / Shopify / Wix / 自架 HTML 平台別操作步驟與程式碼
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 5,
        background: T.orange + '26', color: '#fdba74', whiteSpace: 'nowrap',
        border: `1px solid ${T.orange}40`,
      }}>升級 →</span>
    </Link>
  )
}

export function IssueBoardSkeleton() {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="v2-issue-board">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            background: 'rgba(1,8,14,.55)', border: `1px solid ${T.cardBorder}`,
            borderRadius: T.rL, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200,
          }}>
            <div style={{
              height: 22,
              background: 'rgba(255,255,255,.06)', borderRadius: 5,
              width: '60%', marginBottom: 8,
            }} />
            <div style={{
              height: 60, background: 'rgba(255,255,255,.04)',
              borderRadius: 10,
            }} />
            <div style={{
              height: 60, background: 'rgba(255,255,255,.04)',
              borderRadius: 10,
            }} />
          </div>
        ))}
      </div>
    </>
  )
}
