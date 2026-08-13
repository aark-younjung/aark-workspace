import { useEffect, useState } from 'react'
import { detectSchemaAcrossSite } from '../lib/siteWideSchema'

/**
 * 站台層複查面板 —— 首頁掃描報「缺 FAQ / 麵包屑」時，去其他頁實際找一遍，
 * 找到就告訴用戶「你的 /faq/ 有，這一頁沒有是正常的」，解「單頁掃首頁→誤會全站」的信任落差。
 *
 * 現行產品（深色 T tokens）與改版（.appshell 亮色）共用；用 dark prop 切主題（inline 樣式、不依賴外部 CSS）。
 * 只在「首頁 + 有缺這些 schema」時由父層 render。誠實：只講「我們檢查的這幾頁」，不宣稱全站。
 */
export default function SiteWideSchemaProbe({ pageUrl, schemaIds = [], dark = false }) {
  const [state, setState] = useState({ loading: true, results: [] })

  // 用 join 當依賴鍵，避免每次 render 都重跑；pageUrl 變或 schema 清單變才重查
  const key = `${pageUrl}|${schemaIds.join(',')}`
  useEffect(() => {
    let cancelled = false
    if (!pageUrl || schemaIds.length === 0) { setState({ loading: false, results: [] }); return }
    setState({ loading: true, results: [] })
    Promise.all(schemaIds.map(id => detectSchemaAcrossSite(pageUrl, id).then(r => ({ id, ...r }))))
      .then(results => { if (!cancelled) setState({ loading: false, results }) })
      .catch(() => { if (!cancelled) setState({ loading: false, results: [] }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // 只呈現「找到了 / 檢查過沒找到」；unknown（找不到 sitemap）不下結論、不佔版面
  const shown = state.results.filter(r => r.status === 'found' || r.status === 'absent')
  if (!state.loading && shown.length === 0) return null

  // 主題色板（深色沿用頁面深底、亮色沿用 .appshell 卡片）
  const c = dark
    ? { bg: 'rgba(1,8,14,.5)', border: 'rgba(130,152,255,.28)', head: '#e6e9f2', text: '#9aa3b8', ok: '#34d399', miss: '#f0b866', link: '#8298ff' }
    : { bg: '#fff', border: '#e3e6ee', head: '#00003e', text: '#5b6172', ok: '#059669', miss: '#b45309', link: '#2563eb' }

  return (
    <section
      aria-live="polite"
      style={{
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
        padding: '14px 18px', marginBottom: 24,
      }}
    >
      {/* 面板標題：說明這是「跨頁複查」，跟「這一頁」的檢測區隔開 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: shown.length || state.loading ? 10 : 0 }}>
        <span aria-hidden="true">🔎</span>
        <b style={{ color: c.head, fontSize: 14 }}>站台層複查（你網站的其他頁面）</b>
      </div>

      {state.loading ? (
        // 載入態：用單一刪節號字元，不是三個句點
        <div style={{ color: c.text, fontSize: 13.5 }}>正在檢查你網站的其他頁面，看這些項目是不是其實做在別頁…</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(r => (
            <li key={r.id} style={{ color: c.text, fontSize: 13.5, lineHeight: 1.6 }}>
              {r.status === 'found' ? (
                <>
                  <span style={{ color: c.ok, fontWeight: 700 }}>✅ {r.schemaLabel}：</span>
                  已在{' '}
                  <a href={r.url} target="_blank" rel="noopener noreferrer" translate="no" style={{ color: c.link, textDecoration: 'underline' }}>
                    {r.label}
                  </a>{' '}
                  這一頁找到了。首頁沒有是正常的，你沒有白做。
                </>
              ) : (
                <>
                  <span style={{ color: c.miss, fontWeight: 700 }}>🔍 {r.schemaLabel}：</span>
                  另外檢查了 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.checked}</span> 個頁面也沒找到。
                  如果你把它做在某個特定頁，把那一頁的網址貼進來重新掃描確認。
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
