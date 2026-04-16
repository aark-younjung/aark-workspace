import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Account() {
  const { user, profile, isPro, userName, signOut } = useAuth()
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)

  // Email 週報
  const [emailSubs, setEmailSubs] = useState([])
  const [unsubLoading, setUnsubLoading] = useState(null)

  useEffect(() => {
    if (user && isPro) fetchEmailSubs()
  }, [user, isPro])

  const fetchEmailSubs = async () => {
    const { data: subs } = await supabase
      .from('email_subscriptions')
      .select('id, website_id, email, is_active')
      .eq('email', user.email)

    if (!subs || subs.length === 0) { setEmailSubs([]); return }

    const websiteIds = [...new Set(subs.map(s => s.website_id))]
    const { data: sites } = await supabase
      .from('websites')
      .select('id, name, url')
      .in('id', websiteIds)

    const siteMap = Object.fromEntries((sites || []).map(s => [s.id, s]))
    setEmailSubs(subs.map(s => {
      const site = siteMap[s.website_id]
      let siteName = site?.name
      if (!siteName && site?.url) {
        try { siteName = new URL(site.url).hostname } catch { siteName = site.url }
      }
      return { ...s, siteName: siteName || s.website_id }
    }))
  }

  const handleUnsubscribeAll = async () => {
    const confirmed = window.confirm(`確定取消所有網站的 Email 週報訂閱？\n\n收件信箱：${user.email}`)
    if (!confirmed) return
    setUnsubLoading(true)
    await supabase.from('email_subscriptions').delete().eq('email', user.email)
    setEmailSubs([])
    setUnsubLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleCancel = async () => {
    const confirmed = window.confirm(
      '確定要取消訂閱嗎？\n\n取消後可繼續使用到當前計費週期結束，之後將自動降回免費版。'
    )
    if (!confirmed) return
    setCancelling(true)
    try {
      const res = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (data.success) setCancelDone(true)
      else alert(data.error || '取消失敗，請稍後再試')
    } catch {
      alert('連線失敗，請稍後再試')
    } finally {
      setCancelling(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen relative flex items-center justify-center" >
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="text-center relative">
          <p className="text-slate-500 mb-4">請先登入</p>
          <Link to="/login" className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors">
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  const initials = (userName || user?.email || '??').slice(0, 2).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <div className="min-h-screen relative" >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/60 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-slate-900">帳號設定</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* 用戶資訊 */}
        <section className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white text-xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{userName}</h2>
              <p className="text-slate-500 text-sm">{user.email}</p>
              <div className="mt-1.5">
                {isPro ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                    Pro 方案
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
                    免費版
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 方案管理 */}
        <section className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">方案管理</h3>

          {isPro ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-orange-50">
                <div>
                  <p className="text-slate-900 font-medium">目前方案</p>
                  <p className="text-slate-400 text-sm">
                    Pro 方案・自動續約
                    {profile?.subscribed_at && (
                      <span className="ml-2">・訂閱於 {new Date(profile.subscribed_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    )}
                  </p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">Pro</span>
              </div>
              {cancelDone ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-800 font-medium text-sm">已設定取消</p>
                  <p className="text-amber-600 text-xs mt-1">訂閱將在當前計費週期結束後自動終止，在此之前可繼續使用所有 Pro 功能。</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-700 text-sm font-medium">取消訂閱</p>
                    <p className="text-slate-400 text-xs mt-0.5">取消後可用到當前週期結束，之後降回免費版</p>
                  </div>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="px-4 py-2 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 text-sm transition-colors disabled:opacity-50">
                    {cancelling ? '處理中...' : '取消訂閱'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-900 font-medium">免費版</p>
                <p className="text-slate-400 text-sm">升級 Pro 解鎖完整功能</p>
              </div>
              <Link
                to="/pricing"
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-all">
                查看方案
              </Link>
            </div>
          )}
        </section>

        {/* Email 週報 - 暫時停用 */}

        {/* 登出 */}
        <section className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">帳號操作</h3>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-red-500 hover:text-red-600 font-medium text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            登出
          </button>
        </section>

      </main>
      </div>
    </div>
  )
}
