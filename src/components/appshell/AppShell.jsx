import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './appshell.css'

// 左選單線性 icon（對齊設計稿 redesign-app.html）
const I = {
  overview: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  radar: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M8.5 12a3.5 3.5 0 0 1 3.5-3.5M15.5 12a3.5 3.5 0 0 0-3.5-3.5M5 12a7 7 0 0 1 7-7M19 12a7 7 0 0 0-7-7"/></svg>,
  pulse: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h4l2 6 4-14 2 8h6"/></svg>,
  target: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>,
  globe: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>,
  user: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>,
  add: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>,
}

const navCls = ({ isActive }) => 'as-nav' + (isActive ? ' on' : '')

export default function AppShell() {
  const { websiteId } = useParams()
  const { userName, tierName, isTrial, trialDaysRemaining } = useAuth()

  // 網站範圍的選單項：有 websiteId 才是連結；未選網站時降透明並附提示（點了帶去選網站，不留死 UI）
  const wsItem = (path, icon, label, tag) =>
    websiteId
      ? <NavLink to={`/app/${websiteId}/${path}`} className={navCls}>{icon}{label}{tag && <span className="tag">{tag}</span>}</NavLink>
      : <NavLink to="/app/websites" className="as-nav" style={{ opacity: .45 }} title={`先從「我的網站」選一個網站，就能看它的${label}`}>{icon}{label}{tag && <span className="tag">{tag}</span>}</NavLink>

  return (
    <div className="appshell">
      <aside className="as-side">
        <div className="as-brand">
          <svg width="30" height="30" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15.5" fill="none" stroke="rgba(0,0,62,.14)"/><circle cx="17" cy="17" r="10" fill="none" stroke="rgba(0,0,62,.14)"/><g className="sweep"><path d="M17 17 L17 1.5 A15.5 15.5 0 0 1 30 9 Z" fill="#ff6e34" opacity=".9"/></g><circle cx="17" cy="17" r="2.4" fill="#00003e"/></svg>
          <div className="nm">AI 雷達</div>
        </div>

        {wsItem('overview', I.overview, '總覽')}
        {wsItem('visibility', I.radar, 'AI 曝光監測', '主力')}
        {wsItem('health', I.pulse, '網站體檢')}
        {/* 2026-08-13 改名：內容缺口 → 內容機會（正向框架、日後承接文章工具與任務單；URL 維持 /gap 不破壞深連結） */}
        {wsItem('gap', I.target, '內容機會')}
        <NavLink to="/app/websites" className={navCls}>{I.globe}我的網站</NavLink>
        {/* 用戶回報：進到任一網站頁面後側欄找不到回首頁的路（「回經典版」在有 websiteId 時
            改連 /dashboard-v2、不連 /；logo 也只是 div、不可點）——加明講的入口，不靠猜。
            文案同 AppSites.jsx 既有 CTA「＋ 新增網站」（同狀態同字）。 */}
        {/* end：NavLink 對 to="/" 預設會被任何路徑前綴匹配成「啟用中」，加 end 避免整組選單常駐高亮 */}
        <NavLink to="/" end className={navCls}>{I.add}＋ 新增網站</NavLink>
        {/* 競品格（AI 提及比較）：功能上線後加在此處＝選單最後一項，現在不佔位（2026-08-13 定案） */}

        <div className="as-sp" />
        {/* Beta 並行期：一鍵切回經典版（有網站脈絡回該站儀表板、否則回首頁）——降低嘗鮮門檻 */}
        <NavLink to={websiteId ? `/dashboard-v2/${websiteId}` : '/'} className="as-nav as-classic">← 回經典版</NavLink>{/* 轉址後 /dashboard 已導新版，逃生口走 /dashboard-v2 */}
        {/* 帳號移到左下個人區（Codex IA 建議）：整塊可點、直達 /account，不佔主導覽格 */}
        <NavLink to="/account" className="as-acct" aria-label="帳號與方案設定">
          <span className="av">{(userName || 'U').slice(0, 1).toUpperCase()}</span>
          <div>
            <div className="an">{userName || '使用者'}</div>
            <div className="as">{isTrial ? `試用中 · 剩 ${trialDaysRemaining ?? '?'} 天` : (tierName || '')}</div>
          </div>
          <span className="go" aria-hidden="true">⚙</span>
        </NavLink>
      </aside>

      <main className="as-main">
        <Outlet />
      </main>
    </div>
  )
}
