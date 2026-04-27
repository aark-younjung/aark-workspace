// v2 設計系統共用 tokens（從 docs/AI_ v2.html 抽出，所有 v2 頁面共用）
// 改這裡會影響所有後續移植過來的頁面，動之前確認

export const T = {
  // 四大面向 + 內容品質（語意色，不可改）
  seo: '#3b82f6',
  aeo: '#8b5cf6',
  geo: '#10b981',
  eeat: '#f59e0b',
  content: '#ec4899',

  // 品牌色（橘紅漸層為主 CTA、青綠為 aivis 模組強調色）
  orange: '#f97316',
  orangeDeep: '#c2031c',
  aivis: '#18c590',
  aivisDeep: '#0d7a58',

  // 文字（白色透明分層 — 高對比 / 中等 / 弱化）
  text: 'rgba(255,255,255,0.93)',
  textMid: 'rgba(255,255,255,0.58)',
  textLow: 'rgba(255,255,255,0.32)',

  // 卡片表面（玻璃擬態：深底 + 青綠邊）
  cardBg: 'rgba(1,8,14,0.55)',
  cardBorder: 'rgba(13,122,88,0.22)',
  cardBorderHover: 'rgba(24,197,144,0.45)',

  // 狀態色
  pass: '#10b981',
  fail: '#ef4444',
  warn: '#f59e0b',

  // 字型
  font: "'Plus Jakarta Sans','Noto Sans TC',sans-serif",
  mono: "'JetBrains Mono',monospace",

  // 圓角
  r: 8,
  rM: 12,
  rL: 16,
  rXL: 24,
}

// 四大分數對應的元資料（label / abbr / 主色）
export const SCORE_META = {
  seo: { label: 'SEO 搜尋引擎', abbr: 'SEO', color: T.seo },
  aeo: { label: 'AEO 問答引擎', abbr: 'AEO', color: T.aeo },
  geo: { label: 'GEO 生成引擎', abbr: 'GEO', color: T.geo },
  eeat: { label: 'E-E-A-T 權威度', abbr: 'E-E-A-T', color: T.eeat },
  content: { label: '內容品質', abbr: '內容品質', color: T.content },
}

// 分數判定（給 ScoreCard 顯示「AI 高度引用你」這類白話文）
export function getVerdict(score) {
  if (score >= 85) return { text: 'AI 高度引用你', level: 'excellent' }
  if (score >= 70) return { text: 'AI 偶爾引用你', level: 'good' }
  if (score >= 55) return { text: 'AI 少量引用你', level: 'fair' }
  if (score >= 40) return { text: 'AI 幾乎不引用你', level: 'poor' }
  return { text: 'AI 完全忽略你', level: 'bad' }
}

export function verdictColor(level) {
  return {
    excellent: '#10b981',
    good: '#3b82f6',
    fair: '#f59e0b',
    poor: '#f97316',
    bad: '#ef4444',
  }[level] || T.textMid
}
