// v2 設計系統共用 tokens（從 docs/AI_ v2.html 抽出，所有 v2 頁面共用）
// 改這裡會影響所有後續移植過來的頁面，動之前確認

// 2026-07-21：值全部改走 CSS 變數（定義見 styles/themes.js），這樣切換配色時
// 這裡的 1,400+ 處 T.xxx 用法會一起變，元件一行都不用改。
// 後面的 fallback 是「變數還沒套上時」的保底值 = 原本的青綠夜配色。
export const T = {
  // 四大面向 + 內容品質（語意色 — 代表資料的意義，不隨主題改）
  // ⚠️ 刻意保持純色碼：全站有 124 處 `${T.pass}33`、`T.aeo + '26'` 這種「色碼＋透明度」
  // 串接寫法，改成 var() 會變成無效 CSS。反正它們不隨主題變，維持 hex 最單純也最安全。
  seo: '#3b82f6',
  aeo: '#8b5cf6',
  geo: '#10b981',
  eeat: '#f59e0b',
  content: '#ec4899',

  // 品牌色（orange = 主 CTA、aivis = 模組強調色）
  orange: 'var(--t-cta, #f97316)',
  orangeDeep: 'var(--t-cta-deep, #c2031c)',
  aivis: 'var(--t-accent, #18c590)',
  aivisDeep: 'var(--t-accent-deep, #0d7a58)',

  // 文字（高對比 / 中等 / 弱化）
  text: 'var(--t-text, rgba(255,255,255,0.93))',
  textMid: 'var(--t-text-mid, rgba(255,255,255,0.58))',
  textLow: 'var(--t-text-low, rgba(255,255,255,0.32))',

  // 卡片表面（玻璃擬態）
  cardBg: 'var(--t-card-bg, rgba(1,8,14,0.55))',
  cardBorder: 'var(--t-card-border, rgba(13,122,88,0.22))',
  cardBorderHover: 'var(--t-card-border-hover, rgba(24,197,144,0.45))',

  // 全站背景漸層（原本散在 App/Account/各 Audit 頁各寫一份，現在集中到這）
  bg: 'var(--t-bg, linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%))',

  // 狀態色（同上，語意色維持 hex）
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
