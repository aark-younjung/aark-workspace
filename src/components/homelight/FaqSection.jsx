import { Link } from 'react-router-dom'

/**
 * 首頁常見問題（亮色版）— 內容跟暗色版 HomeDark 同一份，只換外殼。
 * 用原生 <details>（不自己刻開合 state）：鍵盤/無障礙免費拿到，比暗色版的
 * useState 版本更少 code。
 */
const FAQ_ITEMS = [
  { q: '什麼是 AI 能見度？', a: 'AI 能見度是指你的網站在 ChatGPT、Claude、Gemini 等平台中被「看見」並「引用」的能力。傳統 SEO 讓你出現在 Google，AI 能見度讓你出現在 AI 的回答中。' },
  { q: 'SEO、AEO、GEO、E-E-A-T 有什麼不同？', a: 'SEO 讓搜尋引擎找到你；AEO 讓 AI 直接引用你的答案；GEO 讓生成式 AI 在回答中推薦你；E-E-A-T 建立品牌可信度，影響前三者的評分。四者互補，缺一不可。' },
  { q: '分析需要多久？需要安裝什麼嗎？', a: '不需要安裝任何東西。輸入網址後約 15–30 秒即可看到完整報告，系統會自動爬取並分析你的網站。' },
  { q: '分數低要怎麼辦？', a: '登入後的「網站體檢」會依你的失敗項目，列出對應的改善行動，並提供可直接複製的修復程式碼（llms.txt、JSON-LD、FAQ Schema）。' },
]

export default function HomeLightFaq() {
  return (
    <section className="hl-faq">
      <div className="hd">
        <h2>常見問題</h2>
        <p>關於 SEO、AEO、GEO 與 E-E-A-T 的快速解答</p>
      </div>
      <div className="list">
        {FAQ_ITEMS.map((item, i) => (
          <details className="item" key={i}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <div className="more"><Link to="/faq">查看所有常見問題 →</Link></div>
    </section>
  )
}
