// 各面向別的「右側特徵卡」— 從 v3 prototype 抽出，與 ScoreHero 並排作為頂部 hero 兩欄
//   - AEOSignature：AI 引用模擬 + 各 AI 引擎引用率（吃 audit 推導）
//   - GEOSignature：引用矩陣（引擎 × 關鍵字類型熱度圖，吃 audit 推導 + Pro CTA）
//   - EEATSignature：四大支柱拆解（E/E/A/T 各兩個子分數，由 8 個 boolean 映射）
//   - ContentSignature：內容品質拆解（5 個品質維度，由 contentAnalyzer 推導）
// 註：5 維度矩陣 / AI 引擎引用率為「技術估算」（非實測）— 真實量測需另外打 AI API 才有
import { Link } from 'react-router-dom'
import { T } from '../../styles/v2-tokens'

// =====================================================
// AEOSignature — Perplexity 引用範例 + 三家 AI 引用率
//   audit: { json_ld, faq_schema, canonical, breadcrumbs, open_graph,
//            question_headings, meta_desc_length, structured_answer }
//   8 個 boolean 加權算出三家引擎的「技術估算引用率」
// =====================================================
export function AEOSignature({ audit, brandName }) {
  // 各家引擎對技術項目的權重不同（基於業界觀察）
  // - Perplexity 重 FAQ schema、結構化答案、canonical
  // - ChatGPT 重 JSON-LD、語意化標題、答案結構
  // - Google AI（SGE/AIO）重 schema、Open Graph、麵包屑
  const ENGINE_WEIGHTS = [
    { name: 'Perplexity', c: '#5b4aff', w: { json_ld: 12, faq_schema: 22, canonical: 12, breadcrumbs: 4, open_graph: 6, question_headings: 14, meta_desc_length: 8, structured_answer: 22 } },
    { name: 'ChatGPT',    c: '#10a37f', w: { json_ld: 18, faq_schema: 14, canonical: 8,  breadcrumbs: 4, open_graph: 8, question_headings: 18, meta_desc_length: 12, structured_answer: 18 } },
    { name: 'Google AI',  c: '#4285f4', w: { json_ld: 16, faq_schema: 16, canonical: 14, breadcrumbs: 12, open_graph: 14, question_headings: 8, meta_desc_length: 10, structured_answer: 10 } },
  ]
  const engines = ENGINE_WEIGHTS.map(e => {
    if (!audit) {
      // mock：保留 v3 原樣示意值
      const mockRates = { Perplexity: 62, ChatGPT: 45, 'Google AI': 70 }
      return { name: e.name, c: e.c, rate: mockRates[e.name] }
    }
    const rate = Object.entries(e.w).reduce((sum, [key, weight]) => sum + (audit[key] ? weight : 0), 0)
    return { name: e.name, c: e.c, rate: Math.min(100, rate) }
  })
  const brand = brandName || '優勢方舟'

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <SectionLabel inline>AI 引用模擬</SectionLabel>
        <span style={{ fontSize: 9, color: T.textLow, fontStyle: 'italic' }}>示意</span>
      </div>
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
          }}>{brand}</span>
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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <SectionLabel inline>各 AI 引擎引用率</SectionLabel>
        <span style={{ fontSize: 9, color: T.textLow, fontStyle: 'italic' }}>技術估算</span>
      </div>
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
//   audit: 8 個 boolean → base 分數（每家引擎略有不同基準）
//   topics: 5 個關鍵字類型（品牌詞 → 比較詞）難度遞增 → 倍率遞減
//   無 audit 時用 mock 值
// =====================================================
export function GEOSignature({ audit, isPro }) {
  const topics = ['品牌詞', '服務詞', '在地詞', '長尾詞', '比較詞']
  // 不同關鍵字類型的難度倍率（品牌詞最容易被引用、比較詞最難）
  const TOPIC_MULT = [1.0, 0.85, 0.7, 0.45, 0.32]

  // 每家引擎對技術項目的敏感度不同
  const ENGINE_BASES = [
    { name: 'Google AI',    keys: ['llms_txt', 'robots_ai', 'sitemap', 'open_graph', 'json_ld_citation', 'canonical', 'https'], multiplier: 1.0 },
    { name: 'Bing Copilot', keys: ['llms_txt', 'robots_ai', 'sitemap', 'open_graph', 'twitter_card', 'json_ld_citation', 'https'], multiplier: 0.85 },
    { name: 'Claude',       keys: ['llms_txt', 'robots_ai', 'json_ld_citation', 'canonical', 'https'], multiplier: 0.72 },
  ]
  const buildVals = (eng) => {
    if (!audit) {
      const mock = {
        'Google AI':    [88, 72, 58, 32, 24],
        'Bing Copilot': [72, 65, 48, 28, 18],
        'Claude':       [58, 50, 38, 22, 12],
      }
      return mock[eng.name]
    }
    // 該家引擎敏感的 8 個 keys 中過了幾項 → 換算 base 分數（0~95）
    const passed = eng.keys.filter(k => audit[k]).length
    const base = Math.round((passed / eng.keys.length) * 95 * eng.multiplier)
    return TOPIC_MULT.map(m => Math.round(base * m))
  }
  const engines = ENGINE_BASES.map(e => ({ name: e.name, vals: buildVals(e) }))

  const colorAt = (v) => {
    if (v >= 70) return '#10b981'
    if (v >= 50) return '#22d3ee'
    if (v >= 30) return '#f59e0b'
    return '#ef4444'
  }
  // 找出強項（前 2 高的 topic）與機會點（後 2 低的 topic）
  const topicAvg = topics.map((_, i) => Math.round(engines.reduce((s, e) => s + e.vals[i], 0) / engines.length))
  const idxSorted = topicAvg.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v)
  const strong = idxSorted.slice(0, 2).map(o => topics[o.i]).join(' · ')
  const weak = idxSorted.slice(-2).map(o => topics[o.i]).join(' · ')

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
          <span style={{ color: '#10b981', fontWeight: 700 }}>{strong}</span>
        </div>
        <div>
          <span style={{ color: T.textLow }}>機會點</span>{' '}
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{weak}</span>
        </div>
      </div>
      {/* Pro 升級 CTA — 即時實測 AI 引用矩陣（aivis 模組） */}
      {!isPro && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'rgba(24,197,144,.06)', border: '1px solid rgba(24,197,144,.18)',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, fontSize: 11,
        }}>
          <span style={{ color: T.textMid }}>
            <span style={{ color: T.textLow, fontSize: 9.5, marginRight: 6 }}>技術估算</span>
            升級 Pro 啟用 AI 曝光監測，得到實測引用矩陣
          </span>
          <Link to="/pricing" style={{
            color: '#18c590', fontWeight: 700, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>升級 Pro →</Link>
        </div>
      )}
    </div>
  )
}

// =====================================================
// EEATSignature — 四大支柱拆解（E/E/A/T 各兩個子分數）
//   audit: { author_info, about_page, contact_page, privacy_policy,
//            organization_schema, date_published, social_links, outbound_links }
//   8 個 boolean → 對應到 4 個 pillar × 2 sub_score
// =====================================================
export function EEATSignature({ audit }) {
  // 把 boolean 轉換成 0~100 的分數（true=85+small jitter, false=20~30）
  const b2score = (v, hi = 88, lo = 28) => v ? hi : lo
  const avg = (...vs) => Math.round(vs.reduce((s, v) => s + v, 0) / vs.length)

  let pillars
  if (!audit) {
    // mock 保留 v3 原樣示意值
    pillars = [
      { letter: 'E', name: 'Experience', zh: '實際經驗', score: 78,
        subs: [{ n: '第一手案例', v: 82 }, { n: '真實照片影片', v: 74 }] },
      { letter: 'E', name: 'Expertise', zh: '專業知識', score: 85,
        subs: [{ n: '作者專業認證', v: 88 }, { n: '內容深度', v: 82 }] },
      { letter: 'A', name: 'Authoritativeness', zh: '業界權威', score: 79,
        subs: [{ n: '外部媒體引用', v: 75 }, { n: '業界獎項', v: 83 }] },
      { letter: 'T', name: 'Trustworthiness', zh: '可信度', score: 82,
        subs: [{ n: '透明聯絡資訊', v: 70 }, { n: 'HTTPS / 隱私', v: 94 }] },
    ]
  } else {
    // Experience：date_published（內容更新）+ outbound_links（引用第一手資料）
    const exp1 = b2score(audit.date_published, 84, 30)
    const exp2 = b2score(audit.outbound_links, 80, 26)
    // Expertise：author_info（作者）+ organization_schema（機構標記）
    const exa1 = b2score(audit.author_info, 90, 28)
    const exa2 = b2score(audit.organization_schema, 86, 32)
    // Authoritativeness：about_page + social_links
    const aut1 = b2score(audit.about_page, 88, 30)
    const aut2 = b2score(audit.social_links, 80, 28)
    // Trustworthiness：contact_page + privacy_policy
    const tru1 = b2score(audit.contact_page, 86, 24)
    const tru2 = b2score(audit.privacy_policy, 92, 30)

    pillars = [
      { letter: 'E', name: 'Experience', zh: '實際經驗', score: avg(exp1, exp2),
        subs: [{ n: '近期更新內容', v: exp1 }, { n: '引用一手資料', v: exp2 }] },
      { letter: 'E', name: 'Expertise', zh: '專業知識', score: avg(exa1, exa2),
        subs: [{ n: '作者署名揭露', v: exa1 }, { n: '機構結構化資料', v: exa2 }] },
      { letter: 'A', name: 'Authoritativeness', zh: '業界權威', score: avg(aut1, aut2),
        subs: [{ n: '關於我們頁面', v: aut1 }, { n: '社群媒體曝光', v: aut2 }] },
      { letter: 'T', name: 'Trustworthiness', zh: '可信度', score: avg(tru1, tru2),
        subs: [{ n: '透明聯絡資訊', v: tru1 }, { n: '隱私權政策', v: tru2 }] },
    ]
  }

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
//   result: contentAnalyzer 回傳物件
//   - 平均文章長度    ← wordCount.totalWords（目標 800–1500）
//   - 直接答案段落覆蓋  ← aeo.hasDirectAnswer（目標 ≥ 80%）— 單篇沒有「覆蓋率」概念，True=100% / False=0%
//   - 多媒體輔助比例   ← multimedia.count + images.coverage（目標 ≥ 60%）
//   - 外部引用平均   ← outbound.count（目標 ≥ 3）
//   - 閱讀時間（深度）  ← readingMinutes（目標 ≥ 3 分）
// =====================================================
export function ContentSignature({ result }) {
  let dims
  if (!result) {
    // mock 保留 v3 原樣示意值
    dims = [
      { name: '平均文章長度', val: '420 字', target: '800–1500', score: 32 },
      { name: '直接答案段落覆蓋', val: '12%', target: '≥ 80%', score: 18 },
      { name: '多媒體輔助比例', val: '68%', target: '≥ 60%', score: 78 },
      { name: '外部引用平均', val: '0.8 個/篇', target: '≥ 3', score: 25 },
      { name: '閱讀時間（深度）', val: '4.2 min', target: '≥ 3 min', score: 88 },
    ]
  } else {
    // 1) 文章長度 → 800/1500 兩階分數
    const w = result.wordCount?.totalWords || 0
    const wScore = w >= 1500 ? 100 : w >= 800 ? 75 : w >= 300 ? 40 : Math.round(w / 300 * 30)
    // 2) 直接答案：單篇 boolean → 0 或 100
    const daPass = !!result.aeo?.hasDirectAnswer
    // 3) 多媒體：以 alt 覆蓋率 + 是否有圖／影片混合
    const mmCount = result.multimedia?.count || 0
    const altCov = result.images?.coverage ?? 0
    // 沒圖 → 給中分（不扣分），有圖 → 看 alt 覆蓋；有影片 → 加分
    const mmScore = result.images?.total === 0
      ? 50
      : Math.min(100, altCov + (result.multimedia?.videos > 0 ? 10 : 0))
    // 4) 外部引用 → 0/1/2/3+
    const ob = result.outbound?.count || 0
    const obScore = ob >= 3 ? 100 : ob === 2 ? 65 : ob === 1 ? 35 : 0
    // 5) 閱讀時間 → ≥3 分滿分
    const rm = result.readingMinutes ?? 0
    const rmScore = rm >= 3 ? 100 : rm >= 1.5 ? 60 : Math.round(rm / 1.5 * 50)

    dims = [
      { name: '文章長度', val: `${w.toLocaleString()} 字`, target: '800–1500', score: wScore },
      { name: '直接答案段落', val: daPass ? '已覆蓋' : '未覆蓋', target: '首段 30–200 字', score: daPass ? 100 : 0 },
      { name: '多媒體輔助', val: result.images?.total === 0 ? '無圖片' : `${mmCount} 個·Alt ${altCov}%`, target: 'Alt ≥ 80%', score: mmScore },
      { name: '外部引用', val: `${ob} 個`, target: '≥ 3', score: obScore },
      { name: '閱讀時間', val: `${rm} 分`, target: '≥ 3 分', score: rmScore },
    ]
  }

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
