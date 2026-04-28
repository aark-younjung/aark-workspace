import { useState, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isInAppBrowser, getInAppBrowserName, getDeviceOS, getCurrentUrl, tryOpenInSystemBrowser } from '../lib/inAppBrowser'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [showInAppWarning, setShowInAppWarning] = useState(false)
  const [copied, setCopied] = useState(false)
  const { signIn, signInWithGoogle, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  // mount 時偵測 in-app browser（FB / LINE / IG 等內建瀏覽器會擋 Google OAuth），避免每次 render 重算
  const inApp = useMemo(() => isInAppBrowser(), [])
  const inAppName = useMemo(() => getInAppBrowserName(), [])
  const deviceOS = useMemo(() => getDeviceOS(), [])

  if (user) { navigate(from, { replace: true }); return null }

  const handleGoogleSignIn = async () => {
    // 偵測 in-app browser → Google 會擋 OAuth (403 disallowed_useragent)，先彈窗引導改用系統瀏覽器
    if (inApp) {
      setShowInAppWarning(true)
      return
    }
    setGoogleLoading(true)
    await signInWithGoogle(from)
    setTimeout(() => setGoogleLoading(false), 3000)
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getCurrentUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 部分 in-app browser 不允許 clipboard API，fallback 用 textarea select
      const ta = document.createElement('textarea')
      ta.value = getCurrentUrl()
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? '帳號或密碼錯誤' : error.message)
      setLoading(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  // Login / Register 是純 dark 頁面，沒有 light 備份分支
  // 採用雙端大面積漸層（與 HomeDark / Dashboard 等其他頁面一致）
  return (
    <div
      className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden"
      style={{ background: '#000' }}
    >
      {/* 上方青綠 → 深藍漸層（lighten 混合） */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '3000px',
        background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 右下青綠漸層光暈（335deg = 155deg 雙軸鏡像） */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-0" style={{
        height: '4500px',
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {/* 雜訊疊層 — 與 HomeDark 一致 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 shadow-md shadow-orange-900/50 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold" style={{ color: T.text }}>優勢方舟數位行銷</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2" style={{ color: T.text, letterSpacing: '-0.02em' }}>歡迎回來</h1>
          <p style={{ color: T.textMid }}>登入以查看您的 AI 能見度報告</p>
        </div>

        {/* In-App Browser 警告 banner（FB / LINE / IG 等社群 App 內建瀏覽器會擋 Google OAuth）*/}
        {inApp && (
          <div
            className="mb-5 p-4 rounded-xl text-sm"
            style={{
              background: T.warn + '26',
              border: `1px solid ${T.warn}66`,
              color: '#fde68a',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold mb-1">偵測到您正在 {inAppName} 瀏覽</p>
                <p className="text-xs leading-relaxed" style={{ color: '#fde68acc' }}>
                  Google 不允許在 App 內建瀏覽器登入。請點下方按鈕複製網址，再用 {deviceOS === 'ios' ? 'Safari' : 'Chrome'} 開啟，或改用 Email 登入。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 表單 */}
        <GlassCard color={T.orange} style={{ padding: 32 }}>
          {/* Google 登入 */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white text-[#334155] font-semibold rounded-xl hover:bg-slate-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all shadow-md mb-5 disabled:opacity-60"
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
                使用 Google 帳號登入
              </>
            )}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: T.cardBorder }} />
            <span className="text-xs" style={{ color: T.textLow }}>或使用 Email 登入</span>
            <div className="flex-1 h-px" style={{ background: T.cardBorder }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm mb-2" style={{ color: T.textMid }}>電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.text,
                }}
              />
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: T.textMid }}>密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.text,
                }}
              />
            </div>

            {error && (
              <div
                className="p-3 rounded-xl text-sm"
                style={{
                  background: T.fail + '1a',
                  border: `1px solid ${T.fail}33`,
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-900/50">
              {loading ? '登入中...' : '登入'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm" style={{ color: T.textMid }}>還沒有帳號？</span>
            <Link to="/register" className="text-sm ml-1 font-medium hover:opacity-80" style={{ color: T.orange }}>
              立即註冊
            </Link>
          </div>
        </GlassCard>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm transition-colors hover:opacity-80" style={{ color: T.textLow }}>
            ← 返回首頁
          </Link>
        </div>
      </div>

      {/* In-App Browser 阻擋 Modal — 點 Google 登入時觸發，引導用戶複製網址改用系統瀏覽器 */}
      {showInAppWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <GlassCard color={T.warn} style={{ width: '100%', maxWidth: 28 * 16, padding: 24 }}>
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-2xl shrink-0"
                style={{ background: T.warn + '33' }}
              >⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1" style={{ color: T.text }}>無法使用 Google 登入</h3>
                <p className="text-sm leading-relaxed" style={{ color: T.textMid }}>
                  Google 不允許在 {inAppName || 'App 內建'} 瀏覽器中進行登入（403 disallowed_useragent）。請改用 {deviceOS === 'ios' ? 'Safari' : 'Chrome'} 開啟此網址。
                </p>
              </div>
            </div>

            {/* 網址顯示框 + 複製按鈕 */}
            <div
              className="rounded-lg p-3 mb-4"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${T.cardBorder}`,
              }}
            >
              <p className="text-xs mb-1" style={{ color: T.textLow }}>網址</p>
              <p className="text-sm break-all font-mono" style={{ color: T.text }}>{getCurrentUrl()}</p>
            </div>

            <button
              type="button"
              onClick={handleCopyUrl}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all mb-3 shadow-lg shadow-orange-900/50"
            >
              {copied ? '✓ 已複製，請開啟瀏覽器貼上' : '📋 複製網址'}
            </button>

            {/* Android 直接嘗試開啟 Chrome */}
            {deviceOS === 'android' && (
              <button
                type="button"
                onClick={tryOpenInSystemBrowser}
                className="w-full py-3 font-medium rounded-xl transition-all mb-3"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${T.cardBorder}`,
                  color: T.text,
                }}
              >
                🌐 嘗試直接開啟 Chrome
              </button>
            )}

            {/* iOS 步驟說明 */}
            {deviceOS === 'ios' && (
              <div className="text-xs leading-relaxed mb-3 px-1" style={{ color: T.textMid }}>
                <p className="mb-1">📱 iPhone 操作步驟：</p>
                <p>1. 點上方「複製網址」</p>
                <p>2. 開啟 Safari</p>
                <p>3. 在網址列長按 → 貼上 → 前往</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowInAppWarning(false)}
              className="w-full py-2 text-sm transition-colors hover:opacity-80"
              style={{ color: T.textLow }}
            >
              關閉，改用 Email 登入
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
