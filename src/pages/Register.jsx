import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp, signInWithGoogle } = useAuth()
  const { isDark } = useTheme()

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    await signInWithGoogle()
    setTimeout(() => setGoogleLoading(false), 3000)
  }


  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password || !confirm) return setError('請填寫所有欄位')
    if (password.length < 6) return setError('密碼至少需要 6 個字元')
    if (password !== confirm) return setError('兩次密碼輸入不一致')

    setLoading(true)
    setError('')
    const { error } = await signUp(email, password, name, marketingConsent)
    if (error) {
      setError(error.message === 'User already registered' ? '此信箱已註冊，請直接登入' : error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, opacity: 0.20, mixBlendMode: 'multiply' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="w-full max-w-md text-center relative">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">註冊成功！</h2>
          <p className="text-gray-500 mb-2">請查看您的信箱並點擊確認連結</p>
          <p className="text-gray-400 text-sm mb-8">（確認後即可登入使用）</p>
          <Link to="/login"
            className="inline-block px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all">
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4" style={isDark ? {} : { background: 'radial-gradient(ellipse at 65% 35%, #fb923c 0%, #fed7aa 22%, #fff7ed 50%, #e1ddd2 78%)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`, opacity: 0.20, mixBlendMode: 'multiply' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to={isDark ? "/dark" : "/"} className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-200 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-slate-800">優勢方舟數位行銷</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">建立帳號</h1>
          <p className="text-gray-500">加入即獲得 3 個網站免費分析額度，不需信用卡</p>
        </div>

        {/* 表單 */}
        <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-500 text-sm mb-2">姓名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="您的姓名"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-sm mb-2">電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-sm mb-2">密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-gray-500 text-sm mb-2">確認密碼</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="再輸入一次密碼"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/60 border border-orange-100 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {error}
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={e => setMarketingConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-orange-500 cursor-pointer"
              />
              <span className="text-gray-400 text-xs leading-relaxed">
                我同意接收 AARK 的產品更新、優化建議與行銷資訊（可隨時取消）
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-200">
              {loading ? '建立中...' : '立即取得免費分析額度'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-400 text-sm">已有帳號？</span>
            <Link to="/login" className="text-orange-500 hover:text-orange-600 text-sm ml-1 font-medium">
              直接登入
            </Link>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-orange-100"></div>
            <span className="text-gray-400 text-xs">或</span>
            <div className="flex-1 h-px bg-orange-100"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white text-slate-700 font-semibold rounded-xl hover:bg-slate-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all shadow-md mt-4 disabled:opacity-60"
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                跳轉至 Google...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                使用 Google 帳號註冊
              </>
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link to={isDark ? "/dark" : "/"} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}
