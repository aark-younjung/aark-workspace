/**
 * 未登入「完整診斷」結果卡（value-first / B 方案，2026-07-09）
 *
 * 免註冊就看得到：四大訊號層 + 每一項逐條通過/待改善（完整診斷）。
 * 鎖起來要註冊才拿：一鍵修復建議 / 儲存追蹤 / AI 曝光監測（藥方）。
 *
 * 資料全部來自記憶體的掃描結果（HomeDark handleSubmit 傳入的 anonResult.data），
 * 不寫資料庫——所以廣告流量不會灌爆 DB，也不需要登入就能看完整診斷。
 *
 * props:
 *   result    — { url, name, seo, aeo, geo, eeat, data:{seo,aeo,geo,eeat} }
 *   onRegister— 點「免費註冊解鎖」的 callback（帶著 url 去 /register）
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { hasSeenRepeatModal, markRepeatModalSeen } from '../lib/anonSession'

// 逐項檢測定義：label = 中文標籤，read = 從結果物件判斷該項有沒有過
// SEO 每項是 { passed } 物件；AEO/GEO/EEAT 每項是布林值 → 用各自 read()
const readObj = (r, f) => !!r?.[f]?.passed   // SEO：讀 .passed
const readBool = (r, f) => !!r?.[f]          // 其他：直接布林

const DIMS = [
  {
    key: 'seo', label: 'SEO', desc: '搜尋引擎地基', color: '#3b82f6', read: readObj,
    items: [
      ['meta_tags', 'Meta 標題與描述'], ['h1_structure', 'H1 標題結構'], ['alt_tags', '圖片 Alt 文字'],
      ['mobile_compatible', '手機相容性'], ['page_speed', '載入速度'], ['ssl_chain', 'SSL 憑證鏈'],
      ['bot_accessibility', 'AI 爬蟲可達性'],
    ],
  },
  {
    key: 'aeo', label: 'AEO', desc: '答案引擎引用', color: '#8b5cf6', read: readBool,
    items: [
      ['json_ld', 'JSON-LD 結構化資料'], ['faq_schema', 'FAQ Schema'], ['canonical', 'Canonical 標籤'],
      ['breadcrumbs', '麵包屑導航'], ['open_graph', 'Open Graph'], ['question_headings', '問句式標題'],
      ['meta_desc_length', '描述長度適中'], ['structured_answer', '結構化答案'],
    ],
  },
  {
    key: 'geo', label: 'GEO', desc: '生成式 AI 推薦', color: '#10b981', read: readBool,
    items: [
      ['llms_txt', 'llms.txt 指引檔'], ['robots_ai', 'robots 允許 AI 爬取'], ['sitemap', 'Sitemap'],
      ['open_graph', 'Open Graph'], ['twitter_card', 'Twitter Card'], ['json_ld_citation', 'JSON-LD 引用訊號'],
      ['canonical', 'Canonical'], ['https', 'HTTPS 加密'],
    ],
  },
  {
    key: 'eeat', label: 'E-E-A-T', desc: '可信度訊號', color: '#f59e0b', read: readBool,
    items: [
      ['author_info', '作者資訊'], ['about_page', '關於頁面'], ['contact_page', '聯絡頁面'],
      ['privacy_policy', '隱私權政策'], ['organization_schema', 'Organization Schema'],
      ['date_published', '發布日期'], ['social_links', '社群連結'], ['outbound_links', '外部引用連結'],
    ],
  },
]

const scoreColor = (s) => s == null ? 'rgba(255,255,255,0.35)' : s >= 70 ? '#34d399' : s >= 40 ? '#fbbf24' : '#f87171'

// 鎖住的「藥方」卡片內容
const LOCKED = [
  { icon: '🔧', title: '一鍵修復建議', desc: '每個沒過的項目，給你可直接照做的修法（含 WordPress / Shopify 平台別步驟）。' },
  { icon: '📈', title: '儲存並追蹤變化', desc: '把這份報告存起來，看你優化後分數怎麼動、歷史趨勢一目了然。' },
  { icon: '📡', title: 'AI 曝光監測', desc: '定期問 ChatGPT・Claude・Gemini「推薦哪家」，追蹤你有沒有被 AI 主動提到。' },
]

// 回訪第幾次開始顯示「保存紀錄」軟提示。
// 為什麼是 3：掃 1～2 次多半是好奇試用，掃到第 3 次幾乎都是「改了再驗」的迴圈 —
// 那種人才真的需要歷史對照。太早跳會像逼註冊、失去 value-first 的意義。
const REPEAT_HINT_AT = 3

export default function AnonDiagnosis({ result, repeatCount = 0, onRegister }) {
  const ref = useRef(null)
  // 掃完自動捲到報告（讓它像個「結果頁」，不再像退回首頁）
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [])

  // 回訪 pop-up：橫幅容易被略過（使用者一掃完眼睛就衝去看分數），所以再補一次中央提醒。
  // 三道紀律避免煩到高意向使用者：① 只彈一次（關掉就記住）② 延遲 2.5 秒讓他先看到分數
  // ③ 關掉後仍保留上方橫幅當常駐入口。
  const [showModal, setShowModal] = useState(false)
  useEffect(() => {
    if (repeatCount < REPEAT_HINT_AT || hasSeenRepeatModal()) return
    const t = setTimeout(() => setShowModal(true), 2500)
    return () => clearTimeout(t)
  }, [repeatCount])

  const closeModal = useCallback(() => { markRepeatModalSeen(); setShowModal(false) }, [])

  // Esc 關閉
  useEffect(() => {
    if (!showModal) return
    const onKey = e => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showModal, closeModal])

  const scores = { seo: result.seo, aeo: result.aeo, geo: result.geo, eeat: result.eeat }

  return (
    <div ref={ref} className="mt-6 rounded-2xl border p-5 sm:p-6"
      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.14)', scrollMarginTop: '16px' }}>

      {/* 標題 */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div className="text-white font-bold text-lg truncate">📊 {result.name} 的 AI 能見度完整診斷</div>
        <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(24,197,144,0.12)', border: '1px solid rgba(24,197,144,0.4)', color: '#18c590' }}>
          免費・免註冊
        </span>
      </div>

      {/* 回訪軟提示（不是牆）：他正在「改了再驗」，而未登入看不到歷史 —
          用「幫你保存、直接看改前改後」當誘因，比擋住功能有效、也不破壞 value-first */}
      {repeatCount >= REPEAT_HINT_AT && (
        <div className="mb-5 rounded-xl px-4 py-3 flex items-start gap-3 flex-wrap"
          style={{ background: 'rgba(24,197,144,0.09)', border: '1px solid rgba(24,197,144,0.32)' }}>
          <span className="text-lg leading-none mt-0.5">📈</span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-white text-sm font-semibold mb-0.5">
              這是你第 {repeatCount} 次檢測 — 看起來你正在調整網站 👍
            </div>
            <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
              目前每次結果都不會被保存。免費註冊後我們會自動記錄每一次，讓你直接看到
              <span className="text-white font-semibold">「改之前 vs 改之後」</span>的分數變化。
            </div>
          </div>
          <button onClick={onRegister}
            className="text-xs font-bold px-3.5 py-2 rounded-lg whitespace-nowrap transition-opacity hover:opacity-90"
            style={{ background: '#18c590', color: '#04140f' }}>
            免費保存這次紀錄
          </button>
        </div>
      )}

      {/* 四大分數 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {DIMS.map(d => (
          <div key={d.key} className="text-center rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.28)' }}>
            <div className="text-2xl font-extrabold" style={{ color: scoreColor(scores[d.key]) }}>{scores[d.key] ?? '—'}</div>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{d.label}</div>
          </div>
        ))}
      </div>

      {/* 逐項完整診斷（全部看得到）*/}
      <div className="space-y-5 mb-6">
        {DIMS.map(d => {
          const r = result.data?.[d.key]
          const passCount = d.items.filter(([f]) => d.read(r, f)).length
          return (
            <div key={d.key}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-white font-semibold text-sm">{d.label}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>· {d.desc}</span>
                <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  通過 <span style={{ color: '#34d399', fontWeight: 700 }}>{passCount}</span> / {d.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {d.items.map(([f, label]) => {
                  const ok = d.read(r, f)
                  return (
                    <div key={f} className="flex items-center gap-2 text-sm py-0.5">
                      <span className="shrink-0 w-4 text-center" style={{ color: ok ? '#34d399' : '#f87171' }}>
                        {ok ? '✓' : '✗'}
                      </span>
                      <span style={{ color: ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)' }}>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 藥方（鎖住）+ 註冊 CTA */}
      <div className="rounded-xl border p-4 sm:p-5" style={{ background: 'rgba(0,0,0,0.25)', borderColor: 'rgba(249,115,22,0.35)' }}>
        <div className="text-white font-bold text-sm mb-1">看得到問題了，怎麼修？</div>
        <div className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
          診斷免費看，<span className="text-white font-semibold">行動方案</span>免費註冊解鎖：
        </div>
        <div className="space-y-2.5 mb-5">
          {LOCKED.map(l => (
            <div key={l.title} className="flex items-start gap-3 rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-lg leading-none mt-0.5 grayscale opacity-70">{l.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span style={{ opacity: 0.6 }}>🔒</span>{l.title}
                </div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{l.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={onRegister}
          className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-900/50">
          免費註冊 → 解鎖修復建議 + 啟用 AI 曝光監測
        </button>
        <div className="text-center text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.4)' }}>免費・不用綁卡・30 秒完成</div>
      </div>

      {/* 回訪 pop-up（只彈一次、可關、關了還有上方橫幅當常駐入口）*/}
      {showModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}
          onClick={closeModal}
          role="dialog" aria-modal="true" aria-labelledby="anon-repeat-title"
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-6 sm:p-7 text-center"
            style={{
              background: 'linear-gradient(160deg, rgba(13,45,36,0.98) 0%, rgba(6,18,16,1) 70%)',
              border: '1px solid rgba(24,197,144,0.4)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
              animation: 'anonPopIn .22s ease-out',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={closeModal} aria-label="關閉"
              className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-lg leading-none"
              style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.06)' }}>×</button>

            <div className="text-4xl mb-3">📈</div>
            <div id="anon-repeat-title" className="text-white font-extrabold text-xl mb-2 leading-snug">
              你已經檢測 {repeatCount} 次了
            </div>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.68)' }}>
              看起來你正在調整網站 👍 但<span className="text-white font-semibold">目前每次結果都不會被保存</span>，
              關掉頁面就沒了。<br />免費註冊後我們會自動記錄每一次，讓你直接看到
              <span className="font-semibold" style={{ color: '#18c590' }}>「改之前 vs 改之後」</span>的分數變化。
            </p>

            <button type="button" onClick={onRegister}
              className="w-full py-3.5 font-bold rounded-xl transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#18c590,#0d7a58)', color: '#04140f' }}>
              免費註冊 → 保存我的檢測紀錄
            </button>
            <button type="button" onClick={closeModal}
              className="w-full mt-2 py-2.5 text-sm rounded-xl"
              style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
              先繼續看報告
            </button>
            <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.34)' }}>
              免費・不用綁卡・這個提醒只會出現一次
            </div>
          </div>
          <style>{`
            @keyframes anonPopIn { from { opacity:0; transform:translateY(10px) scale(.97) } to { opacity:1; transform:none } }
            @media (prefers-reduced-motion: reduce) { @keyframes anonPopIn { from{opacity:1} to{opacity:1} } }
          `}</style>
        </div>
      )}
    </div>
  )
}
