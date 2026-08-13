import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { T } from '../../styles/v2-tokens'
import { FIX_GUIDES, PLATFORMS } from '../../data/fixGuides'

const KEYFRAMES = `
.v2-issue-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 1100px) { .v2-issue-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .v2-issue-board { grid-template-columns: 1fr; } }
.v2-issue-fix-panel { animation: v2FadeUp .25s ease-out; }
@keyframes v2FadeUp { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@media print {
  .v2-issue-board { grid-template-columns: 1fr !important; }
  .v2-issue-fix-panel { animation: none !important; page-break-inside: avoid; }
  .v2-issue-board > div { page-break-inside: auto; }
  .v2-issue-board > div > div { page-break-inside: avoid; break-inside: avoid; }
}
`

export default function IssueBoard({ checks, isPro, accent = T.seo, accentGlow }) {
  const [expanded, setExpanded] = useState(null)
  // 列印 / 匯出 PDF 時自動展開所有可展開卡片，避免 PDF 沒有修復建議內容
  const [printMode, setPrintMode] = useState(false)
  useEffect(() => {
    const onBefore = () => flushSync(() => setPrintMode(true))
    const onAfter = () => setPrintMode(false)
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
    }
  }, [])
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
            isPro={isPro}
            printMode={printMode} />
        ))}
      </div>
    </>
  )
}

function IssueLane({ lane, expandedId, onToggle, isPro, printMode }) {
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
          fontSize: 14, fontWeight: 800, letterSpacing: '.08em',
          padding: '4px 8px', borderRadius: 5,
          background: lane.c + '26', color: lane.c, border: `1px solid ${lane.c}55`,
        }}>{lane.id}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{lane.title}</div>
          <div style={{ fontSize: 14, color: T.textLow }}>{lane.sub}</div>
        </div>
        <span style={{
          fontSize: 14, fontWeight: 800, color: lane.c, fontFamily: T.font,
          minWidth: 22, textAlign: 'right',
        }}>{lane.items.length}</span>
      </div>

      {lane.items.length === 0 ? (
        <div style={{
          fontSize: 14, color: T.textLow, textAlign: 'center',
          padding: '20px 8px', border: `1px dashed ${T.cardBorder}`,
          borderRadius: 10, lineHeight: 1.55,
        }}>{lane.id === 'OK' ? '尚無通過項目' : '此優先度無待修項'}</div>
      ) : (
        lane.items.map(check => (
          <IssueCard key={check.id}
            check={check}
            lane={lane}
            isOpen={printMode || expandedId === check.id}
            onToggle={() => onToggle(check.id)}
            isPro={isPro} />
        ))
      )}
    </div>
  )
}

function IssueCard({ check, lane, isOpen, onToggle, isPro }) {
  // 「未通過」一律可展開；「通過但有警告」（如 bot_accessibility uaFallback）也允許展開看修法
  const canExpand = !check.passed || check.warning
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
            fontSize: 14, fontWeight: 700, color: T.text,
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
            fontSize: 14, color: T.textMid, lineHeight: 1.55,
            paddingLeft: 24,
          }}>{check.detail}</div>
        )}
      </button>

      {isOpen && canExpand && (
        <div className="v2-issue-fix-panel" style={{
          borderTop: `1px solid ${lane.c}33`,
          background: 'rgba(255,255,255,.02)', padding: 14,
        }}>
          {/* 部分 essentials（json_ld / canonical / open_graph / llms_txt）標 freeForAll
              對所有用戶開放完整修法 code，免註冊就能看；其餘 schema/E-E-A-T 仍 Pro 限定。
              這是「give first」策略：基本款先給、進階/平台別範例留 Pro */}
          {(isPro || FIX_GUIDES[check.id]?.freeForAll)
            ? <IssueFixPanel check={check} lane={lane} />
            : <IssueLockCTA check={check} lane={lane} />}
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
  // 兩階段選擇：先抓平台、再看是否有 scenarios（多情境，例如 H1 missing vs too_many）
  // 有 scenarios 且 check 帶了 scenario 就用對應的；沒指定就用 scenarios 的第一個；
  // 平台沒拆 scenarios（大部分 check）就直接讀 platforms[id]。維持向後相容。
  const rawPlatform = guide?.platforms?.[activePlatform]
  let platformData = rawPlatform
  let scenarioTitle = null
  if (rawPlatform?.scenarios) {
    const scenarioKey = check.scenario && rawPlatform.scenarios[check.scenario]
      ? check.scenario
      : Object.keys(rawPlatform.scenarios)[0]
    platformData = rawPlatform.scenarios[scenarioKey]
    scenarioTitle = platformData?.title
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontSize: 14, color: T.textMid, lineHeight: 1.7,
        padding: '10px 12px', background: 'rgba(255,255,255,.03)',
        border: `1px solid ${T.cardBorder}`, borderRadius: 8,
      }}>
        <span style={{ color: lane.c, fontWeight: 700 }}>建議：</span>
        {guide?.summary || check.recommendation}
      </div>

      {/* featured 推薦自家工具 — 比較吸睛的綠色底色，鼓勵用戶用內建工具取代複雜外掛流程 */}
      {guide?.featured && (
        <div style={{
          fontSize: 14, color: T.textMid, lineHeight: 1.75,
          padding: '10px 12px',
          background: 'rgba(16,185,129,0.08)',      // 翠綠微底（呼應 GEO 主色但更淺）
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8,
        }}>
          <div style={{ color: '#10b981', fontWeight: 700, marginBottom: 4 }}>
            {guide.featured.title}
          </div>
          <div>{guide.featured.body}</div>
        </div>
      )}

      {/* 排查線索區塊 — 用戶若回報「我明明已經修好卻被判失敗」，提供 3 種常見假陰性情境 */}
      {guide?.troubleshooting && (
        <div style={{
          fontSize: 14, color: T.textMid, lineHeight: 1.75,
          padding: '10px 12px',
          background: 'rgba(251,191,36,0.06)',     // 琥珀色微底
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 8,
        }}>
          <div style={{ color: '#fbbf24', fontWeight: 700, marginBottom: 6 }}>
            ⚠️ {guide.troubleshooting.title}
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {guide.troubleshooting.reasons.map((r, i) => (
              <li key={i} dangerouslySetInnerHTML={{
                // 簡易 Markdown bold：把 **xxx** 轉成 <strong>
                __html: r.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e5e7eb">$1</strong>'),
              }} />
            ))}
          </ul>
        </div>
      )}

      {availablePlatforms.length > 0 && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {availablePlatforms.map(p => (
              <button key={p.id} type="button"
                onClick={() => setActivePlatform(p.id)}
                style={{
                  fontSize: 14, fontWeight: 600,
                  padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                  background: activePlatform === p.id ? lane.c + '22' : 'rgba(255,255,255,.03)',
                  color: activePlatform === p.id ? lane.c : T.textMid,
                  border: `1px solid ${activePlatform === p.id ? lane.c + '55' : T.cardBorder}`,
                  fontFamily: T.font, transition: 'all .15s',
                }}>{p.label}</button>
            ))}
          </div>

          {/* scenario 標題（拆情境的 check 才有，例如 H1 missing/too_many） */}
          {scenarioTitle && (
            <div style={{
              fontSize: 14, fontWeight: 700, color: lane.c,
              padding: '8px 12px',
              background: lane.c + '12',
              borderLeft: `3px solid ${lane.c}`,
              borderRadius: 4,
            }}>{scenarioTitle}</div>
          )}

          {platformData?.steps && (
            <ol style={{
              margin: 0, paddingLeft: 22,
              fontSize: 14, color: T.textMid, lineHeight: 1.75,
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {platformData.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}

          {platformData?.code && (
            <pre style={{
              margin: 0, padding: 12, fontSize: 14, lineHeight: 1.6,
              background: 'rgba(0,0,0,.45)', border: `1px solid ${T.cardBorder}`,
              borderRadius: 8, color: '#cbd5e1', fontFamily: T.mono,
              overflow: 'auto', whiteSpace: 'pre',
            }}>{platformData.code}</pre>
          )}
        </>
      )}

      {availablePlatforms.length === 0 && (
        <div style={{ fontSize: 14, color: T.textLow, fontStyle: 'italic' }}>
          目前無平台別操作步驟，可參考上方建議自行調整。
        </div>
      )}
    </div>
  )
}

/* Pro 鎖定改「模糊示例＋浮標」（2026-08-13，Kuroma 實測學來的轉化設計）。守則：
   ①示例明確標示、②不得誤當自己的結果、③真實摘要照樣露出（部分價值 give first）、
   ④完整步驟與程式碼隱藏、⑤CTA 講清楚升級後得到什麼 */
function IssueLockCTA({ check, lane }) {
  const guide = FIX_GUIDES[check?.id]
  // 這個 check 實際支援的平台（真實欄位照 Codex 守則露出；沒 guide 就列常見四平台）
  const platforms = guide
    ? PLATFORMS.filter(p => guide.platforms?.[p.id]).map(p => p.name)
    : ['WordPress', 'Shopify', 'Wix', 'HTML']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 真實建議摘要（不模糊）：give first，讓用戶知道方向、細步驟留 Pro */}
      <div style={{
        fontSize: 14, color: T.textMid, lineHeight: 1.7,
        padding: '10px 12px', background: 'rgba(255,255,255,.03)',
        border: `1px solid ${T.cardBorder}`, borderRadius: 8,
      }}>
        <span style={{ color: lane.c, fontWeight: 700 }}>建議：</span>
        {guide?.summary || check?.recommendation || '此項目有對應的修復步驟與程式碼。'}
      </div>

      {/* 平台 chips（真實支援清單、僅展示不可點） */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {platforms.map(name => (
          <span key={name} style={{
            fontSize: 12, fontWeight: 700, color: T.textLow, padding: '3px 10px',
            border: `1px solid ${T.cardBorder}`, borderRadius: 99, opacity: .75,
          }} translate="no">{name}</span>
        ))}
      </div>

      {/* 模糊示例區＋浮標：blur 的是「示例排版」不是用戶真實內容（右上角明確標示） */}
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px dashed ${lane.c}55` }}>
        <div aria-hidden="true" style={{
          filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none',
          padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8,
          color: T.textLow, background: 'rgba(0,0,0,.3)',
        }}>
          <div>1. 進入後台 → SEO 設定 → 開啟對應欄位</div>
          <div>{'2. 貼上：<script type="application/ld+json">'}</div>
          <div>{'   { "@context": "https://schema.org", "@type": "…" }'}</div>
          <div>3. 儲存後回到 AI 雷達重新檢測驗證 ✓</div>
        </div>
        {/* 示例標籤：防止被誤當自己網站的實際內容 */}
        <span style={{
          position: 'absolute', top: 6, right: 8, fontSize: 10, fontWeight: 700,
          color: T.textLow, background: 'rgba(0,0,0,.55)', padding: '2px 8px', borderRadius: 99,
        }}>示例排版・非你網站的實際內容</span>
        {/* 浮標 CTA：蓋在模糊區中央，講清楚升級後得到什麼 */}
        <Link to="/pricing" style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none',
          background: 'rgba(0,0,0,.35)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>🔒 升級 Pro 解鎖完整修復指南</span>
          <span style={{ fontSize: 12, color: T.textLow, textAlign: 'center', lineHeight: 1.6, maxWidth: '46ch', padding: '0 12px' }}>
            逐步驟操作指引＋可直接複製的程式碼（{platforms.join('／')} 平台別版本）
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 7, marginTop: 2,
            background: `color-mix(in srgb, ${T.orange} 20%, transparent)`, color: '#fdba74',
            border: `1px solid color-mix(in srgb, ${T.orange} 35%, transparent)`,
          }}>升級 Pro →</span>
        </Link>
      </div>
    </div>
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
