/**
 * 落地頁文案設定 — 三組 FB 廣告各對應一個 variant（2026-06-13）
 *
 * 設計原則：message match — 落地頁第一屏延續廣告大標的話術，
 * 文案源頭見 行銷/廣告/FB廣告文案-ABC三組.md（repo 外的行銷資料夾）。
 *
 * headline 結構：每行是一個陣列、行內分段標色
 *   color: null = 白色 / 'green' = 品牌青綠 #18c590 / 'red' = 警示紅 #ef4444
 * mode: 'scan' = 掃描框漏斗（留 URL → 註冊 → 回首頁自動帶入）
 *       'waitlist' = 代理商候補 modal
 */

export const LP_VARIANTS = {
  // A 組 — 一般品牌主（已做 SEO、AI 看不見）
  'google-vs-ai': {
    mode: 'scan',
    badge: 'AI 能見度 30 秒檢測',
    headline: [
      [{ t: '你的 ', c: null }, { t: 'Google 排第一', c: 'green' }, { t: '，', c: null }],
      [{ t: 'ChatGPT 卻', c: null }, { t: '從沒推薦過你', c: 'red' }, { t: '。', c: null }],
    ],
    sub: '排名是 Google 的邏輯，推薦是 AI 的邏輯——兩套系統、兩場仗。30 秒掃出你在 AI 眼中的真實樣子。',
    bullets: [
      'ChatGPT、Claude、Gemini 三大引擎實測提及率',
      'AI 推薦了誰、為什麼不是你',
      '每一個紅燈，附對應的修復指南',
    ],
    cta: '免費掃描我的網站',
    inputPlaceholder: '貼上你的網站網址',
  },

  // C 組 — AI 建站族群（vibe coding / v0 / Lovable）
  'ai-site-check': {
    mode: 'scan',
    badge: 'AI 爬蟲可讀性檢測',
    headline: [
      [{ t: 'AI 做的網站，', c: null }],
      [{ t: 'AI 自己', c: null }, { t: '看不見', c: 'red' }, { t: '。', c: null }],
    ],
    sub: '多數 AI 建站工具產出的內容靠 JavaScript 渲染——你看到的很漂亮，GPTBot 抓到的可能是空白頁。30 秒驗證。',
    bullets: [
      '檢查 AI 爬蟲讀不讀得到你的內容',
      'llms.txt、Schema、sitemap 一次掃完',
      '每一個紅燈，附對應的修復指南',
    ],
    cta: '免費檢測我的網站',
    inputPlaceholder: '貼上你的 AI 建站作品網址',
  },

  // B 組 — 網站代理商（候補名單漏斗）
  agency: {
    mode: 'waitlist',
    badge: '代理商方案・首批招募',
    headline: [
      [{ t: '客戶開始問你 AI SEO，', c: null }],
      [{ t: '你的答案是什麼？', c: 'green' }],
    ],
    sub: '白標 AI 能見度報告、多客戶集中管理、月費分潤——把「我們能處理」變成你最賺錢的一句話。',
    bullets: [
      '一鍵產出可直接交付客戶的報告',
      '多客戶站台集中管理、權限分明',
      '首批申請的代理商，免費開通試用一個月',
    ],
    cta: '搶先申請代理商方案',
  },
}
