import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password || !confirm) return setError('請填寫所有欄位')
    if (password.length < 6) return setError('密碼至少需要 6 個字元')
    if (password !== confirm) return setError('兩次密碼輸入不一致')

    setLoading(true)
    setError('')
    const { error } = await signUp(email, password, name)
    if (error) {
      setError(error.message === 'User already registered' ? '此信箱已註冊，請直接登入' : error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-3">註冊成功！</h2>
          <p className="text-white/60 mb-2">請查看您的信箱並點擊確認連結</p>
          <p className="text-white/40 text-sm mb-8">（確認後即可登入使用）</p>
          <Link to="/login"
            className="inline-block px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all">
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">優勢方舟</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">建立帳號</h1>
          <p className="text-white/50">免費開始使用 AI 能見度檢測</p>
        </div>

        {/* 表單 */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-white/70 text-sm mb-2">姓名</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="您的姓名"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">電子郵件</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-2">確認密碼</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="再輸入一次密碼"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/25">
              {loading ? '註冊中...' : '免費註冊'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-white/40 text-sm">已有帳號？</span>
            <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm ml-1 font-medium">
              直接登入
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← 返回首頁
          </Link>
        </div>
      </div>
    </div>
  )
}
