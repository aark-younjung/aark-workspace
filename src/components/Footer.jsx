import { Link } from 'react-router-dom'

export default function Footer({ dark = false }) {
  const t = {
    border:  dark ? 'border-white/15' : 'border-white/30',
    bg:      dark ? 'bg-black/30'     : 'bg-white/20',
    brand:   dark ? 'text-white'      : 'text-slate-800',
    heading: dark ? 'text-white'      : 'text-slate-700',
    body:    dark ? 'text-white/70'   : 'text-slate-500',
    sub:     dark ? 'text-white/50'   : 'text-slate-400',
    divider: dark ? 'border-white/15' : 'border-white/40',
  }
  return (
    <footer className={`relative z-10 border-t ${t.border} ${t.bg} backdrop-blur-md mt-16`}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

          {/* 品牌 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className={`font-bold ${t.brand}`}>優勢方舟數位行銷</span>
            </div>
            <p className={`text-sm ${t.body} leading-relaxed`}>
              幫助品牌掌握 AI 搜尋時代的能見度，<br />讓 ChatGPT、Claude、Gemini、Perplexity 看見你。
            </p>
          </div>

          {/* 快速連結 */}
          <div>
            <h4 className={`text-sm font-semibold ${t.heading} mb-3`}>快速連結</h4>
            <ul className={`space-y-2 text-sm ${t.body}`}>
              <li><Link to="/" className="hover:text-orange-400 transition-colors">首頁分析</Link></li>
              <li><Link to="/pricing" className="hover:text-orange-400 transition-colors">定價方案</Link></li>
              <li><Link to="/faq" className="hover:text-orange-400 transition-colors">常見問題</Link></li>
              <li><Link to="/showcase" className="hover:text-orange-400 transition-colors">排行榜</Link></li>
              <li><Link to="/content-audit" className="hover:text-orange-400 transition-colors">文章分析</Link></li>
            </ul>
          </div>

          {/* 聯絡我們 */}
          <div>
            <h4 className={`text-sm font-semibold ${t.heading} mb-3`}>聯絡我們</h4>
            <p className={`text-sm ${t.body} mb-3`}>有任何問題、建議或合作邀請，歡迎來信：</p>
            <a
              href="mailto:aark.younjung@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              aark.younjung@gmail.com
            </a>
            <p className={`text-xs ${t.sub} mt-2`}>我們通常在 1–2 個工作天內回覆</p>
          </div>

        </div>

        {/* 底部版權 */}
        <div className={`border-t ${t.divider} pt-6 flex flex-col sm:flex-row items-center justify-between gap-2`}>
          <p className={`text-xs ${t.sub}`}>© {new Date().getFullYear()} 優勢方舟數位行銷. All rights reserved.</p>
          <p className={`text-xs ${t.sub}`}>Powered by AI 能見度檢測平台</p>
        </div>
      </div>
    </footer>
  )
}
