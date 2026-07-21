/**
 * 配色主題（2026-07-21）
 *
 * 做法：所有主題色都走 CSS 變數。v2-tokens 的 T.xxx 值改成 var(--xxx)，
 * 所以切換主題只要換 :root 上的變數 —— 1,414 處 T.xxx 用法一行都不用改。
 *
 * ⚠️ 目前只放「深色」主題。原因：全站有約 994 處寫死 text-white / bg-white/xx /
 * text-slate-3xx，全都假設背景是深的。在把那些掃乾淨之前開放亮色主題，畫面會
 * 大面積白字配白底、不能看。亮色主題等 Tailwind 掃描那階段做完再開。
 *
 * 新增主題只要在 THEMES 加一組，選色器會自動長出來。
 */

// 語意色（四大面向 / 狀態）不隨主題變 —— 它們是「資料的意義」，換了會讓使用者誤讀
export const SEMANTIC = {
  '--t-seo': '#3b82f6',
  '--t-aeo': '#8b5cf6',
  '--t-geo': '#10b981',
  '--t-eeat': '#f59e0b',
  '--t-content': '#ec4899',
  '--t-pass': '#10b981',
  '--t-fail': '#ef4444',
  '--t-warn': '#f59e0b',
}

export const THEMES = {
  // 現行主視覺 —— 預設，不動既有使用者的觀感
  teal: {
    label: '青綠 · 夜',
    swatch: ['#18c590', '#084773', '#011520'],
    vars: {
      '--t-accent': '#18c590',
      '--t-accent-deep': '#0d7a58',
      '--t-cta': '#f97316',
      '--t-cta-deep': '#c2031c',
      '--t-text': 'rgba(255,255,255,0.93)',
      '--t-text-mid': 'rgba(255,255,255,0.58)',
      '--t-text-low': 'rgba(255,255,255,0.32)',
      '--t-card-bg': 'rgba(1,8,14,0.55)',
      '--t-card-border': 'rgba(13,122,88,0.22)',
      '--t-card-border-hover': 'rgba(24,197,144,0.45)',
      '--t-bg': 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
    },
  },

  // 深藍 + 橘（2026-07-21 探索方向：Mailchimp 式深字亮accent，先做深色版）
  navy: {
    label: '深藍 · 夜',
    swatch: ['#ff6e34', '#1b1b5c', '#00003e'],
    vars: {
      '--t-accent': '#ff6e34',
      '--t-accent-deep': '#e85114',
      '--t-cta': '#ff6e34',
      '--t-cta-deep': '#e85114',
      '--t-text': 'rgba(255,255,255,0.94)',
      '--t-text-mid': 'rgba(255,255,255,0.62)',
      '--t-text-low': 'rgba(255,255,255,0.38)',
      '--t-card-bg': 'rgba(0,0,40,0.55)',
      '--t-card-border': 'rgba(130,152,255,0.22)',
      '--t-card-border-hover': 'rgba(255,110,52,0.45)',
      '--t-bg': 'linear-gradient(155deg, #ff6e34 0%, #8298ff 8%, #1b1b5c 26%, #00003e 46%, #000018 70%)',
    },
  },

  // 石墨 —— 最中性、最不「科技感」的深色，給覺得青綠/深藍太搶的人
  graphite: {
    label: '石墨 · 夜',
    swatch: ['#e0a33c', '#3a3a42', '#141417'],
    vars: {
      '--t-accent': '#e0a33c',
      '--t-accent-deep': '#b47a1c',
      '--t-cta': '#e0a33c',
      '--t-cta-deep': '#b47a1c',
      '--t-text': 'rgba(255,255,255,0.92)',
      '--t-text-mid': 'rgba(255,255,255,0.6)',
      '--t-text-low': 'rgba(255,255,255,0.36)',
      '--t-card-bg': 'rgba(20,20,23,0.6)',
      '--t-card-border': 'rgba(255,255,255,0.1)',
      '--t-card-border-hover': 'rgba(224,163,60,0.42)',
      '--t-bg': 'linear-gradient(155deg, #4a4a54 0%, #3a3a42 12%, #232329 30%, #141417 52%, #0a0a0c 74%)',
    },
  },

  // 亮白 + 橘（Mailchimp 式亮底）—— ⚠️ 測試中
  // 全站約 994 處寫死 text-white / bg-white\/xx / text-slate-3xx 都假設深底，
  // 靠 index.css 的 [data-theme="light"] 覆蓋層把它們重新對應成亮底該有的顏色。
  // 覆蓋層是「全域重寫」性質，一定有角落沒對到 → UI 標「測試中」，靠回報逐個修。
  light: {
    label: '亮白 · 橘',
    beta: true,
    // 2026-07-21：先從公開切換器隱藏。覆蓋層還有沒對到的角落，訪客點到會看到破版。
    // 走「元件草稿 → 頁面草稿 → 定稿再實作」的流程，做完再把這行拿掉。
    // 自己要測：主控台跑 localStorage.setItem('aark_theme','light') 後重整。
    hidden: true,
    swatch: ['#ff6e34', '#f5f6f7', '#00003e'],
    vars: {
      '--t-accent': '#e85114',          // 亮底上要壓深一點才看得清楚
      '--t-accent-deep': '#c23f0c',
      '--t-cta': '#ff6e34',
      '--t-cta-deep': '#e85114',
      '--t-text': '#00003e',            // 深藍當「黑」
      '--t-text-mid': '#4f4f68',
      '--t-text-low': '#9a9aa8',
      '--t-card-bg': 'rgba(255,255,255,0.92)',
      '--t-card-border': 'rgba(0,0,62,0.12)',
      '--t-card-border-hover': 'rgba(255,110,52,0.45)',
      '--t-bg': 'linear-gradient(155deg, #ffffff 0%, #f7f8fa 22%, #f5f6f7 48%, #eef0f4 100%)',
      // 給覆蓋層用（只有亮色主題需要）
      '--t-ink': '#00003e',
      '--t-ink-mid': '#4f4f68',
      '--t-surface': 'rgba(0,0,62,0.04)',
      '--t-surface-border': 'rgba(0,0,62,0.1)',
    },
  },
}

export const DEFAULT_THEME = 'teal'
export const THEME_STORAGE_KEY = 'aark_theme'

/** 把某個主題的變數套到 <html>；找不到就用預設，永遠不會讓畫面沒有顏色 */
export function applyTheme(name) {
  const theme = THEMES[name] || THEMES[DEFAULT_THEME]
  const root = document.documentElement
  for (const [k, v] of Object.entries({ ...SEMANTIC, ...theme.vars })) {
    root.style.setProperty(k, v)
  }
  root.dataset.theme = THEMES[name] ? name : DEFAULT_THEME
  return theme
}
