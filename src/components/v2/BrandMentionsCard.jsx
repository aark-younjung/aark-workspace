/**
 * BrandMentionsCard — 品牌外部提及搜尋（2026-06-10）
 *
 * MVP 範圍：
 *   1. 輸入品牌名 → 打 /api/brand-mentions → 顯示提及次數
 *   2. 列 Top 10 來源、依分類（news / forum / social / blog / wiki / other）顯示
 *   3. 根據結果顯示操作建議（投新聞 / 鋪論壇 / 找 KOL 等）
 *
 * 設計：
 *   - 預設摺疊（避免太佔版面）、點「查詢品牌提及」展開
 *   - 結果用 localStorage 暫存 24 小時、避免反覆打 API
 *   - 顯示 query 字串給用戶看（透明、教育性）
 */
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'aark_brand_mentions_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000  // 24 小時

const CATEGORY_META = {
  news:   { label: '新聞媒體', emoji: '📰', color: '#3b82f6' },
  forum:  { label: '論壇社群', emoji: '💬', color: '#8b5cf6' },
  social: { label: '社群平台', emoji: '🌐', color: '#10b981' },
  blog:   { label: '部落格',   emoji: '✍️', color: '#f59e0b' },
  wiki:   { label: '知識庫',   emoji: '📚', color: '#ec4899' },
  other:  { label: '其他',     emoji: '🔗', color: '#64748b' },
}

const LEVEL_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5', emoji: '🚨' },
  warning:  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.4)', text: '#fcd34d', emoji: '⚠️' },
  fair:     { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', text: '#fde68a', emoji: '📊' },
  good:     { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.35)', text: '#86efac', emoji: '✅' },
}

function loadCache(key) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const entry = all[key]
    if (!entry) return null
    if (Date.now() - entry.savedAt > CACHE_TTL) return null
    return entry.data
  } catch { return null }
}

function saveCache(key, data) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[key] = { savedAt: Date.now(), data }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

export default function BrandMentionsCard({ defaultBrand = '', defaultExcludeDomain = '' }) {
  const [brand, setBrand] = useState(defaultBrand)
  const [excludeDomain, setExcludeDomain] = useState(defaultExcludeDomain)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  // mount 時若有 cached 結果、自動顯示
  useEffect(() => {
    if (!defaultBrand) return
    const cacheKey = `${defaultBrand}__${defaultExcludeDomain}`
    const cached = loadCache(cacheKey)
    if (cached) setResult(cached)
  }, [defaultBrand, defaultExcludeDomain])

  async function handleSearch() {
    if (!brand.trim() || loading) return
    setErr('')
    setLoading(true)
    const cacheKey = `${brand}__${excludeDomain}`

    try {
      // 2026-06-10：合併進 /api/public?action=brand-mentions（Vercel Hobby 12 function 上限）
      const params = new URLSearchParams({ action: 'brand-mentions', brand: brand.trim(), num: '10' })
      if (excludeDomain.trim()) params.set('excludeDomain', excludeDomain.trim())
      const resp = await fetch(`/api/public?${params}`)
      const data = await resp.json()

      if (!resp.ok) {
        if (data?.error === 'not_configured') {
          setErr('品牌提及搜尋尚未啟用（管理員需在後台設定 Google API 金鑰）')
        } else {
          setErr(data?.message || '搜尋失敗、請稍後再試')
        }
        setLoading(false)
        return
      }

      setResult(data)
      // 只快取「有撈到來源」的結果；接地偶發回 0 不快取，避免把 false 0 鎖 24h、下次查還會再試
      if (data.totalResults > 0) saveCache(cacheKey, data)
    } catch (e) {
      setErr('連線失敗、請稍後再試')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      className="mb-6 rounded-2xl border overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.10)' }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl">📡</span>
          <h2 className="text-lg sm:text-xl font-bold text-white">品牌外部提及</h2>
          <span className="px-2 py-0.5 text-sm rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.4)' }}>
            BETA
          </span>
        </div>
        <p className="text-sm text-white/55 mt-2 leading-relaxed">
          搜尋網路上有多少地方提到你的品牌（排除你自己網站）。
          <strong className="text-white/85">外部提及次數是 AI 推薦你的關鍵訊號之一</strong>。
        </p>
      </div>

      {/* 搜尋表單 */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-white/65 mb-1.5">品牌名稱 *</label>
            <input
              type="text"
              value={brand}
              onChange={e => setBrand(e.target.value)}
              placeholder="例：金鉑先生 / Aark"
              className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/65 mb-1.5">排除自家網域 (選填)</label>
            <input
              type="text"
              value={excludeDomain}
              onChange={e => setExcludeDomain(e.target.value)}
              placeholder="例：kimbo3899.com.tw"
              className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none text-sm font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={!brand.trim() || loading}
              className="w-full md:w-auto px-5 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  搜尋中…
                </>
              ) : (
                '🔍 查詢'
              )}
            </button>
          </div>
        </div>

        {/* 錯誤 */}
        {err && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-400/30 text-sm text-red-300 mb-4">
            {err}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="space-y-4">
            {/* 總數 + 建議 */}
            <ResultSummary result={result} />

            {/* 來源分類聚合 */}
            <CategoryBreakdown counts={result.categoryCounts} />

            {/* Top 10 結果列表 */}
            <ResultsList items={result.items} />

            {/* 查詢字串透明顯示 */}
            <div className="text-sm text-white/35 leading-relaxed">
              💡 查詢字串：<code className="font-mono text-white/55 bg-white/5 px-2 py-0.5 rounded">{result.query}</code>
              · 結果已暫存 24 小時、避免重複查詢
            </div>
          </div>
        )}

        {/* 空狀態說明 */}
        {!result && !err && (
          <p className="text-sm text-white/45 leading-relaxed">
            💡 第一次查詢免費、之後 24 小時內同樣搜尋會從本地快取讀取、不重複打 API。
          </p>
        )}
      </div>
    </section>
  )
}

// 總數摘要 + 建議
function ResultSummary({ result }) {
  const { totalResults, recommendation: rec } = result
  const style = LEVEL_STYLE[rec.level] || LEVEL_STYLE.fair
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-2xl">{style.emoji}</span>
        <div>
          <div className="text-sm font-mono" style={{ color: style.text }}>網路提及次數</div>
          <div className="text-3xl font-bold text-white font-mono">{totalResults.toLocaleString()}</div>
        </div>
      </div>
      <p className="text-sm text-white/75 leading-relaxed mb-3">{rec.message}</p>
      <div className="space-y-1">
        <div className="text-sm font-bold text-white/85">建議行動：</div>
        <ul className="space-y-1 text-sm text-white/65">
          {rec.actions.map((a, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: style.text }}>→</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// 來源分類聚合
function CategoryBreakdown({ counts }) {
  const items = Object.entries(counts).filter(([_, n]) => n > 0)
  if (items.length === 0) return null
  return (
    <div>
      <div className="text-sm font-bold text-white/65 uppercase tracking-wider mb-2">來源分類（前 10 筆）</div>
      <div className="flex flex-wrap gap-2">
        {items.map(([cat, n]) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.other
          return (
            <div
              key={cat}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border inline-flex items-center gap-1.5"
              style={{ background: meta.color + '15', borderColor: meta.color + '40', color: meta.color }}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
              <span className="font-mono font-bold">{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Top 10 結果列表
function ResultsList({ items }) {
  if (!items.length) return null
  return (
    <div>
      <div className="text-sm font-bold text-white/65 uppercase tracking-wider mb-2">Top {items.length} 結果</div>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {items.map((it, i) => {
          const meta = CATEGORY_META[it.category] || CATEGORY_META.other
          return (
            <a
              key={i}
              href={it.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg border transition hover:bg-white/5"
              style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-base flex-shrink-0">{meta.emoji}</span>
                <span className="text-sm font-medium text-white truncate flex-1" dangerouslySetInnerHTML={{ __html: it.title }} />
              </div>
              <div className="text-sm text-white/40 truncate font-mono mb-1 ml-7">{it.displayLink}</div>
              {it.snippet && (
                <p className="text-sm text-white/50 leading-relaxed line-clamp-2 ml-7" dangerouslySetInnerHTML={{ __html: it.snippet }} />
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}
