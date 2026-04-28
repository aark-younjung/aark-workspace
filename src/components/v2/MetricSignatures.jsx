// 各面向別的「右側特徵卡」— 從 v3 prototype 抽出，與 ScoreHero 並排作為頂部 hero 兩欄
//   - AEOSignature：AI 引用模擬 + 各 AI 引擎引用率
//   - GEOSignature：引用矩陣（引擎 × 關鍵字類型熱度圖）
//   - EEATSignature：四大支柱拆解（E/E/A/T 各自子分數）
//   - ContentSignature：內容品質拆解（5 個品質維度）
// 註：目前資料為示意（mock），等後端 analyzer 補對應欄位後再改為真實資料來源
import { T } from '../../styles/v2-tokens'

// =====================================================
// AEOSignature — Perplexity 引用範例 + 三家 AI 引用率
// =====================================================
export function AEOSignature() {
  const engines = [
    { name: 'Perplexity', c: '#5b4aff', rate: 62 },
    { name: 'ChatGPT', c: '#10a37f', rate: 45 },
    { name: 'Google AI', c: '#4285f4', rate: 70 },
  ]
  return (
    <div>
      <SectionLabel>AI 引用模擬</SectionLabel>
      <div style={{
        background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.22)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4, background: '#5b4aff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L9 4.5V11H3V4.5L6 1Z" fill="#fff" />
            </svg>
          </div>
          <span style={{ fontSize: 10, color: T.textMid }}>Perplexity 對「台南網頁設計推薦」的回答</span>
        </div>
        <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, marginBottom: 10 }}>
          台南優質的網頁設計公司包含
          <span style={{
            background: '#8b5cf625', borderBottom: '1px dashed #8b5cf6',
            padding: '0 2px', borderRadius: 2,
          }}>優勢方舟</span>
          ，提供結合 AI 能見度分析的服務
          <sup style={{ color: '#8b5cf6', fontSize: 9, fontWeight: 700, marginLeft: 2 }}>[1]</sup>
          ，以及…
        </div>
        <div style={{
          paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.05)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <span style={{ fontSize: 9, color: T.textLow, fontFamily: T.mono }}>SOURCE [1]</span>
          <span style={{ fontSize: 10, color: '#93c5fd', fontFamily: T.mono }}>a-ark.com.tw</span>
        </div>
      </div>
      <SectionLabel>各 AI 引擎引用率</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {engines.map((e) => (
          <div key={e.name}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 4,
            }}>
              <span style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>{e.name}</span>
              <span style={{
                fontSize: 11, color: T.text, fontFamily: T.mono, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {e.rate}
                <span style={{ color: T.textLow, fontWeight: 400, fontSize: 9 }}>%</span>
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 3 }}>
              <div style={{
                height: '100%', width: `${e.rate}%`,
                background: `linear-gradient(90deg, ${e.c}, ${e.c}cc)`,
                borderRadius: 3, boxShadow: `0 0 8px ${e.c}66`,
                transition: 'width .8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================
// GEOSignature — 引用矩陣（引擎 × 關鍵字類型 熱度圖）
// =====================================================
export function GEOSignature() {
  const topics = ['品牌詞', '服務詞', '在地詞', '長尾詞', '比較詞']
  const engines = [
    { name: 'Google AI', vals: [88, 72, 58, 32, 24] },
    { name: 'Bing Copilot', vals: [72, 65, 48, 28, 18] },
    { name: 'Claude', vals: [58, 50, 38, 22, 12] },
  ]
  const colorAt = (v) => {
    if (v >= 70) return '#10b981'
    if (v >= 50) return '#22d3ee'
    if (v >= 30) return '#f59e0b'
    return '#ef4444'
  }
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <SectionLabel inline>引用矩陣 — 引擎 × 關鍵字類型</SectionLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 9, color: T.textLow,
        }}>
          <span>低</span>
          <div style={{
            width: 80, height: 6, borderRadius: 3,
            background: 'linear-gradient(90deg,#ef4444,#f59e0b,#22d3ee,#10b981)',
          }} />
          <span>高</span>
        </div>
      </div>
      <div style={{
        background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 10, padding: '16px 18px',
      }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px repeat(5, 1fr)',
          gap: 6, marginBottom: 8,
        }}>
          <div />
          {topics.map((t) => (
            <div key={t} style={{
              fontSize: 9.5, color: T.textMid, textAlign: 'center', fontWeight: 600,
            }}>{t}</div>
          ))}
        </div>
        {engines.map((e) => (
          <div key={e.name} style={{
            display: 'grid', gridTemplateColumns: '90px repeat(5, 1fr)',
            gap: 6, marginBottom: 6, alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: T.text, fontWeight: 600 }}>{e.name}</div>
            {e.vals.map((v, i) => {
              const col = colorAt(v)
              return (
                <div key={i} style={{
                  position: 'relative', height: 32, borderRadius: 6,
                  background: col + '14', border: `1px solid ${col}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: 11, color: col, fontWeight: 700,
                    fontFamily: T.mono, fontVariantNumeric: 'tabular-nums',
                  }}>{v}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, display: 'flex', gap: 14,
        fontSize: 10.5, color: T.textMid, flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ color: T.textLow }}>強項類型</span>{' '}
          <span style={{ color: '#10b981', fontWeight: 700 }}>品牌詞 · 服務詞</span>
        </div>
        <div>
          <span style={{ color: T.textLow }}>機會點</span>{' '}
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>長尾詞 · 比較詞</span>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// EEATSignature — 四大支柱拆解（E/E/A/T 各兩個子分數）
// =====================================================
export function EEATSignature() {
  const pillars = [
    { letter: 'E', name: 'Experience', zh: '實際經驗', score: 78,
      subs: [{ n: '第一手案例', v: 82 }, { n: '真實照片影片', v: 74 }] },
    { letter: 'E', name: 'Expertise', zh: '專業知識', score: 85,
      subs: [{ n: '作者專業認證', v: 88 }, { n: '內容深度', v: 82 }] },
    { letter: 'A', name: 'Authoritativeness', zh: '業界權威', score: 79,
      subs: [{ n: '外部媒體引用', v: 75 }, { n: '業界獎項', v: 83 }] },
    { letter: 'T', name: 'Trustworthiness', zh: '可信度', score: 82,
      subs: [{ n: '透明聯絡資訊', v: 70 }, { n: 'HTTPS / 隱私', v: 94 }] },
  ]
  return (
    <div>
      <SectionLabel>四大支柱拆解</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {pillars.map((p, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(245,158,11,.18)',
            borderRadius: 10, padding: '14px 15px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -12, right: -8,
              fontSize: 64, fontWeight: 900,
              color: 'rgba(245,158,11,.06)', fontFamily: T.font, lineHeight: 1,
              letterSpacing: '-.05em',
            }}>{p.letter}</div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: '#fcd34d', fontWeight: 700, letterSpacing: '.04em' }}>
                {p.name}
              </div>
              <div style={{ fontSize: 10, color: T.textLow, marginBottom: 8 }}>{p.zh}</div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 9,
              }}>
                <span style={{
                  fontSize: 24, fontWeight: 800, color: T.text,
                  fontFamily: T.font, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                }}>{p.score}</span>
                <span style={{ fontSize: 10, color: T.textLow }}>/100</span>
              </div>
              {p.subs.map((s, j) => (
                <div key={j} style={{ marginBottom: j === p.subs.length - 1 ? 0 : 6 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 9.5, marginBottom: 2,
                  }}>
                    <span style={{ color: T.textMid }}>{s.n}</span>
                    <span style={{ color: T.textMid, fontFamily: T.mono }}>{s.v}</span>
                  </div>
                  <div style={{ height: 2, background: 'rgba(255,255,255,.05)', borderRadius: 1 }}>
                    <div style={{
                      height: '100%', width: `${s.v}%`, background: '#f59e0b',
                      borderRadius: 1, boxShadow: '0 0 4px #f59e0b88',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================
// ContentSignature — 內容品質 5 個維度（含目標值對照）
// =====================================================
export function ContentSignature() {
  const dims = [
    { name: '平均文章長度', val: '420 字', target: '800–1500', score: 32 },
    { name: '直接答案段落覆蓋', val: '12%', target: '≥ 80%', score: 18 },
    { name: '多媒體輔助比例', val: '68%', target: '≥ 60%', score: 78 },
    { name: '外部引用平均', val: '0.8 個/篇', target: '≥ 3', score: 25 },
    { name: '閱讀時間（深度）', val: '4.2 min', target: '≥ 3 min', score: 88 },
  ]
  return (
    <div>
      <SectionLabel>內容品質拆解</SectionLabel>
      <div style={{
        background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
        borderRadius: 10, padding: '14px 18px',
      }}>
        {dims.map((d, i) => {
          const col = d.score >= 70 ? '#10b981' : d.score >= 40 ? '#f59e0b' : '#ef4444'
          return (
            <div key={i} style={{
              padding: '10px 0',
              borderBottom: i === dims.length - 1 ? 'none' : '1px solid rgba(255,255,255,.04)',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 5,
              }}>
                <span style={{ fontSize: 11.5, color: T.text }}>{d.name}</span>
                <span style={{
                  fontSize: 11, color: T.text, fontFamily: T.mono, fontWeight: 700,
                }}>{d.val}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{
                  flex: 1, height: 3,
                  background: 'rgba(255,255,255,.05)', borderRadius: 2,
                }}>
                  <div style={{
                    height: '100%', width: `${d.score}%`, background: col,
                    borderRadius: 2, boxShadow: `0 0 6px ${col}88`,
                  }} />
                </div>
                <span style={{
                  fontSize: 9.5, color: T.textLow, minWidth: 80, textAlign: 'right',
                }}>目標 {d.target}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =====================================================
// SectionLabel — 共用小區塊標籤（uppercase、字距加大）
// =====================================================
function SectionLabel({ children, inline }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.textMid, letterSpacing: '.12em',
      marginBottom: inline ? 0 : 10, textTransform: 'uppercase',
    }}>{children}</div>
  )
}
