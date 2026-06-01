/**
 * 文章分析統一頂部 Tab — /content-audit（單篇）與 /bulk-scan/:id（批次）共用
 *
 * 設計意圖：用戶心智裡「文章分析」是一件事，不該分散在兩個獨立頁面。
 * 透過 tab 切換讓 Free 用戶看到「批次模式」這個選項 → 觸發升級 Pro 念頭。
 *
 * Props:
 *   active: 'single' | 'bulk'   — 由父頁面指定當前哪個 tab 高亮
 *   websiteId?: string          — 有的話兩個 tab 都能點；沒的話批次 tab 變灰
 */
import { Link } from 'react-router-dom'
import { T } from '../../styles/v2-tokens'

export default function ArticleAnalysisTabs({ active, websiteId }) {
  const tabs = [
    {
      id: 'single',
      label: '📄 單篇模式',
      sub: '貼入單一文章網址分析',
      to: websiteId ? `/content-audit/${websiteId}` : '/content-audit',
      enabled: true,
    },
    {
      id: 'bulk',
      label: '🔍 批次模式',
      sub: '一鍵掃描全站文章（Pro）',
      to: websiteId ? `/bulk-scan/${websiteId}` : null,
      enabled: !!websiteId,
      disabledReason: '請從 Dashboard 選擇要分析的網站',
    },
  ]

  return (
    <div style={{
      marginBottom: 24,
      borderBottom: `1px solid ${T.cardBorder}`,
    }}>
      <div style={{ display: 'flex', gap: 4, paddingBottom: 0, alignItems: 'flex-end' }}>
        <div style={{
          fontSize: 11, color: T.textLow, letterSpacing: '0.05em',
          marginRight: 12, paddingBottom: 12, fontWeight: 600,
        }}>
          文章分析
        </div>
        {tabs.map(t => {
          const isActive = t.id === active
          if (!t.enabled) {
            return (
              <div key={t.id} title={t.disabledReason} style={{
                padding: '10px 18px', borderRadius: '6px 6px 0 0',
                background: 'transparent', cursor: 'not-allowed',
                opacity: 0.4,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textMid }}>{t.label}</div>
                <div style={{ fontSize: 10, color: T.textLow, marginTop: 2 }}>{t.sub}</div>
              </div>
            )
          }
          return (
            <Link key={t.id} to={t.to} style={{
              padding: '10px 18px', borderRadius: '6px 6px 0 0', textDecoration: 'none',
              background: isActive ? '#ec489918' : 'transparent',
              borderBottom: isActive ? '2px solid #ec4899' : '2px solid transparent',
              transition: 'all .15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? T.text : T.textMid }}>{t.label}</div>
              <div style={{ fontSize: 10, color: T.textLow, marginTop: 2 }}>{t.sub}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
