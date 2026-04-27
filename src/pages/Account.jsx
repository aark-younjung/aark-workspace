import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

export default function Account() {
  const { user, profile, isPro, userName, signOut } = useAuth()
  const navigate = useNavigate()
  const [cancelling, setCancelling] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)

  // Email 週報訂閱狀態（Pro 限定）
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

  // 共用的暗色背景 wrapper（含青綠頂部漸層 + 雜訊疊層，整頁短不需要底部漸層）
  const PageBg = ({ children }) => (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: 'linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)' }}
    >
      {/* 雜訊疊層 — 與 HomeDark / Login 一致 */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12,
        mixBlendMode: 'overlay',
      }} />
      {children}
    </div>
  )

  // 未登入時顯示提示頁
  if (!user) {
    return (
      <PageBg>
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <div className="text-center">
            <p className="mb-4" style={{ color: T.textMid }}>請先登入</p>
            <Link
              to="/login"
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg transition-colors shadow-lg shadow-orange-900/50"
            >
              前往登入
            </Link>
          </div>
        </div>
      </PageBg>
    )
  }

  const initials = (userName || user?.email || '??').slice(0, 2).toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url

  return (
    <PageBg>
      <div className="relative z-10">
        {/* Header — 暗色玻璃條 */}
        <header className="border-b backdrop-blur-xl" style={{ borderColor: T.cardBorder, background: 'rgba(0,0,0,0.5)' }}>
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="transition-colors hover:opacity-80"
              style={{ color: T.textMid }}
              aria-label="返回上一頁"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold" style={{ color: T.text }}>帳號設定</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

          {/* 用戶資訊 — 頭像 + 姓名 + 方案徽章 */}
          <GlassCard style={{ padding: 24 }}>
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
                <h2 className="text-lg font-bold" style={{ color: T.text }}>{userName}</h2>
                <p className="text-sm" style={{ color: T.textMid }}>{user.email}</p>
                <div className="mt-1.5">
                  {isPro ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full"
                      style={{ background: T.aeo + '33', color: '#c4b5fd' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.aeo }}></span>
                      Pro 方案
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full"
                      style={{ background: T.orange + '26', color: '#fdba74' }}
                    >
                      免費版
                    </span>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* 方案管理 — Pro 顯示取消、Free 顯示升級 CTA */}
          <GlassCard style={{ padding: 24 }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: T.textMid }}>方案管理</h3>

            {isPro ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: T.cardBorder }}>
                  <div>
                    <p className="font-medium" style={{ color: T.text }}>目前方案</p>
                    <p className="text-sm" style={{ color: T.textLow }}>
                      Pro 方案・自動續約
                      {profile?.subscribed_at && (
                        <span className="ml-2">・訂閱於 {new Date(profile.subscribed_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      )}
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 text-sm font-semibold rounded-full"
                    style={{ background: T.aeo + '33', color: '#c4b5fd' }}
                  >Pro</span>
                </div>
                {cancelDone ? (
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: T.warn + '1a',
                      border: `1px solid ${T.warn}4d`,
                    }}
                  >
                    <p className="font-medium text-sm" style={{ color: '#fde68a' }}>已設定取消</p>
                    <p className="text-xs mt-1" style={{ color: '#fde68acc' }}>訂閱將在當前計費週期結束後自動終止，在此之前可繼續使用所有 Pro 功能。</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: T.text }}>取消訂閱</p>
                      <p className="text-xs mt-0.5" style={{ color: T.textLow }}>取消後可用到當前週期結束，之後降回免費版</p>
                    </div>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 hover:opacity-80"
                      style={{
                        color: '#fca5a5',
                        background: T.fail + '1a',
                        border: `1px solid ${T.fail}4d`,
                      }}
                    >
                      {cancelling ? '處理中...' : '取消訂閱'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: T.text }}>免費版</p>
                  <p className="text-sm" style={{ color: T.textLow }}>升級 Pro 解鎖完整功能</p>
                </div>
                <Link
                  to="/pricing"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-orange-900/50"
                >
                  查看方案
                </Link>
              </div>
            )}
          </GlassCard>

          {/* Email 週報 — 暫時停用，等 Pro 訂閱完整接通再開 */}

          {/* 帳號操作 — 登出 */}
          <GlassCard style={{ padding: 24 }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: T.textMid }}>帳號操作</h3>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 font-medium text-sm transition-colors hover:opacity-80"
              style={{ color: '#fca5a5' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              登出
            </button>
          </GlassCard>

        </main>
      </div>
    </PageBg>
  )
}
