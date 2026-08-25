import { Link } from 'react-router-dom'

/** 亮色站台共用頁尾 — 文案照抄 HomeLight.jsx 的 hl-bottom。 */
export default function SiteFooter() {
  return (
    <footer className="ls-bottom">
      <div className="in">
        <Link to="/pricing">定價</Link>
        <Link to="/faq">常見問題</Link>
        <Link to="/showcase">排行榜</Link>
        <Link to="/content-audit">文章分析</Link>
        <span className="co">方舟 AI 雷達｜由優勢方舟數位行銷營運</span>
      </div>
    </footer>
  )
}
