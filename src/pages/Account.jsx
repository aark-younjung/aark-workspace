import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { T } from '../styles/v2-tokens'
import { GlassCard } from '../components/v2'

export default function Account() {
  const { user, profile, isPro, isTrial, trialEndsAt, trialDaysRemaining, userName, signOut, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [cancelling, setCancelling] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)

  // NewebPay 退款相關 state
  // latestProOrder: 最近一筆 paid 的 pro_yearly NewebPay 訂單（用來判 14 天視窗、傳 merchantOrderNo 給後端）
  // refundModalOpen: 14 天內合法退款 → 開 modal 二次確認
  // refundResult: 退款 API 回的 { refund_method, message } — 信用卡 / 手動轉帳差異提示
  const [latestProOrder, setLatestProOrder] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundResult, setRefundResult] = useState(null)

  // NewebPay 付款後跳回 /account?pro_success={yearly|earlybird} — 顯示升級成功 toast
  // 跟 Pricing.jsx 同模式：抓 query string → 顯示 → 立刻清 URL 防重整再彈 → 6 秒自動消失
  const [proSuccessPlan, setProSuccessPlan] = useState(null)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const plan = params.get('pro_success')
    if (plan === 'yearly' || plan === 'earlybird') {
      setProSuccessPlan(plan)
      navigate(location.pathname, { replace: true })
      const t = setTimeout(() => setProSuccessPlan(null), 6000)
      return () => clearTimeout(t)
    }
  }, [location.search, location.pathname, navigate])

  // Email 週報訂閱狀態（Pro 限定）
  const [emailSubs, setEmailSubs] = useState([])
  const [unsubLoading, setUnsubLoading] = useState(null)

  useEffect(() => {
    if (user && isPro) fetchEmailSubs()
  }, [user, isPro])

  // 載入用戶最近一筆 NewebPay Pro 訂單（用於取消按鈕分流）
  // 條件：is_pro=true 且 payment_gateway='newebpay'（手動授予的 Pro 沒有 order，不需要載入）
  useEffect(() => {
    if (!user || !isPro || profile?.payment_gateway !== 'newebpay') {
      setLatestProOrder(null)
      return
    }
    let cancelled = false
    supabase
      .from('aivis_newebpay_pending')
      .select('merchant_order_no, kind, pack, amount, status, payment_type, paid_at, refund_status')
      .eq('user_id', user.id)
      .eq('kind', 'pro_yearly')
      .eq('status', 'paid')
      .eq('refund_status', 'none')
      .order('paid_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setLatestProOrder(data) })
    return () => { cancelled = true }
  }, [user, isPro, profile?.payment_gateway])

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

  // 取消訂閱 — 依用戶付款方式三分支：
  // (a) Stripe 訂閱（profile.stripe_subscription_id 存在）：cancel-subscription endpoint 已 archived，顯示客服聯繫提示
  // (b) NewebPay 14 天內 → 開退款 modal 二次確認（走 /api/newebpay-notify?action=refund）
  // (c) NewebPay 超過 14 天 → 顯示「年期到期日後自動降回 Free」（年繳已過鑑賞期不退款）
  // (d) 找不到 order（手動授予 Pro）→ 客服聯繫提示
  const handleCancel = () => {
    // (a) Stripe sub
    if (profile?.stripe_subscription_id) {
      alert('您的訂閱由 Stripe 處理。請寄信至客服 mark6465@gmail.com 協助取消。')
      return
    }
    // (d) 找不到 NewebPay order — 手動授予 Pro 用戶
    if (!latestProOrder) {
      alert('找不到對應的付款訂單。如您的 Pro 方案為客服手動授予，請寄信至 mark6465@gmail.com 協助處理。')
      return
    }
    // 計算 14 天視窗
    const paidAt = latestProOrder.paid_at ? new Date(latestProOrder.paid_at) : null
    const daysSincePaid = paidAt ? (Date.now() - paidAt.getTime()) / (24 * 3600 * 1000) : 999
    // (c) 超過 14 天
    if (daysSincePaid > 14) {
      const yearlyExpiry = paidAt ? new Date(paidAt.getTime() + 365 * 24 * 3600 * 1000) : null
      const expiryStr = yearlyExpiry?.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }) || ''
      alert(
        `您的訂閱已超過 14 天無條件退款期（已使用 ${Math.floor(daysSincePaid)} 天）。\n\n` +
        `年繳方案可繼續使用至 ${expiryStr}，到期後自動降為免費版、不再續扣款。\n\n` +
        `如有特殊情形需協助，請寄信至 mark6465@gmail.com。`
      )
      return
    }
    // (b) NewebPay 14 天內 → 開 modal
    setRefundModalOpen(true)
  }

  // 退款 modal 確認按鈕 — 真正呼叫退款 API
  const handleRefundConfirm = async () => {
    setCancelling(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token
      if (!accessToken) {
        alert('登入狀態已過期，請重新登入後再試')
        setCancelling(false)
        return
      }
      const res = await fetch('/api/newebpay-notify?action=refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: user.id,
          merchantOrderNo: latestProOrder.merchant_order_no,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || data.detail || '退款失敗，請聯繫客服 mark6465@gmail.com')
        setCancelling(false)
        return
      }
      // 成功：記下退款方式與訊息，關 modal 顯示成功狀態卡
      setRefundResult({ method: data.refund_method, message: data.message })
      setCancelDone(true)
      setRefundModalOpen(false)
      // 退款成功後刷 profile，避免本地 isPro 殘留 true 造成 UI 顯示 Pro
      await fetchProfile(user.id)
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
      {/* NewebPay 付款完成跳回 — 綠色升級成功 toast（右上 fixed，6 秒後自動消失） */}
      {/* 入帳走非同步 notify，profile 可能 1-30 秒後才刷到 is_pro=true；toast 給即時心理確認 */}
      {proSuccessPlan && (
        <div
          className="fixed top-16 right-4 z-50 max-w-sm rounded-xl shadow-2xl backdrop-blur-md"
          style={{
            background: `linear-gradient(135deg, ${T.pass}f0 0%, #0d9488f0 100%)`,
            border: `1px solid ${T.pass}66`,
            padding: '14px 18px',
            color: '#ffffff',
            animation: 'slideInRight 0.4s ease-out',
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none flex-shrink-0" aria-hidden>✓</div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">
                {proSuccessPlan === 'earlybird' ? '🐣 早鳥首年購買成功！' : '✨ Pro 年繳升級成功！'}
              </div>
              <div className="text-sm mt-1 opacity-90 leading-relaxed">
                付款已送出，系統入帳處理中。Pro 功能將於數十秒內全部解鎖，可重整頁面確認方案徽章。
              </div>
            </div>
            <button
              onClick={() => setProSuccessPlan(null)}
              className="text-white/80 hover:text-white text-lg leading-none flex-shrink-0"
              aria-label="關閉"
            >
              ×
            </button>
          </div>
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(40px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

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
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {isTrial ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full"
                      style={{ background: T.pass + '33', color: '#86efac' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.pass }}></span>
                      ✨ 試用中・剩 {trialDaysRemaining} 天
                    </span>
                  ) : isPro ? (
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

          {/* 試用中狀態卡 — 僅試用期間顯示，方案管理卡片之前 */}
          {isTrial && trialEndsAt && (
            <GlassCard color={T.pass} style={{ padding: 24 }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="text-base font-bold" style={{ color: T.text }}>免費試用中</h3>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold" style={{ color: T.pass }}>剩 {trialDaysRemaining} 天</span>
                  </div>
                  <p className="text-sm" style={{ color: T.textMid }}>
                    試用結束：{new Date(trialEndsAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: T.textLow }}>
                    試用結束前升級 Pro 可無縫銜接所有功能；若不升級則自動降回免費版，已建立的資料保留。
                  </p>
                </div>
                <Link
                  to="/pricing"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-orange-900/50 whitespace-nowrap"
                >
                  立即升級 Pro →
                </Link>
              </div>
            </GlassCard>
          )}

          {/* 方案管理 — Pro 顯示取消、Free 顯示升級 CTA */}
          <GlassCard style={{ padding: 24 }}>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: T.textMid }}>方案管理</h3>

            {isTrial ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: T.text }}>7 天免費試用</p>
                  <p className="text-sm" style={{ color: T.textLow }}>試用期間享 Pro 全功能・剩 {trialDaysRemaining} 天</p>
                </div>
                <Link
                  to="/pricing"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-orange-900/50"
                >
                  升級 Pro 訂閱
                </Link>
              </div>
            ) : isPro ? (
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
                      background: T.pass + '1a',
                      border: `1px solid ${T.pass}4d`,
                    }}
                  >
                    <p className="font-medium text-sm" style={{ color: '#86efac' }}>
                      {refundResult?.method === 'manual_transfer' ? '退款已申請（待手動轉帳）' : '退款已完成'}
                    </p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: '#86efacd0' }}>
                      {refundResult?.message || '訂閱已取消，將於下次重整後生效。'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: T.text }}>取消訂閱</p>
                      <p className="text-xs mt-0.5" style={{ color: T.textLow }}>14 天內無條件退款；超過則用至年期到期</p>
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

      {/* 退款確認 modal — 取消按鈕點下後彈出，14 天內無條件退款二次確認 */}
      {/* 顯示：訂單方案/金額/剩餘退款天數/付款方式分流提示（信用卡 7-14 天 vs 手動轉帳 7 天聯繫） */}
      {refundModalOpen && latestProOrder && (
        <RefundModal
          order={latestProOrder}
          cancelling={cancelling}
          onClose={() => setRefundModalOpen(false)}
          onConfirm={handleRefundConfirm}
        />
      )}
    </PageBg>
  )
}

// 退款確認 modal — 黑色半透明遮罩 + 中央 GlassCard
// 設計目標：(1) 二次確認防誤點 (2) 明確區分信用卡 / 非信用卡退款流程 (3) 顯示具體金額與剩餘天數
function RefundModal({ order, cancelling, onClose, onConfirm }) {
  const paidAt = order.paid_at ? new Date(order.paid_at) : null
  const daysSincePaid = paidAt ? (Date.now() - paidAt.getTime()) / (24 * 3600 * 1000) : 0
  const daysLeft = Math.max(0, 14 - Math.floor(daysSincePaid))
  const isCreditCard = (order.payment_type || '').toUpperCase().startsWith('CREDIT')
  const planLabel = order.pack === 'earlybird' ? 'Pro 早鳥首年' : 'Pro 年繳'
  const amountStr = `NT$${(order.amount || 0).toLocaleString()}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="max-w-md w-full rounded-2xl shadow-2xl"
        style={{
          background: T.cardBg,
          border: `1px solid ${T.fail}40`,
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題 + 訂單資訊 */}
        <div className="mb-5">
          <h3 className="text-xl font-bold mb-2" style={{ color: T.text }}>
            14 天無條件退款
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: T.textMid }}>
            您即將取消訂閱並申請退款，請確認以下資訊：
          </p>
        </div>

        {/* 訂單摘要表格 */}
        <div
          className="mb-5 rounded-xl p-4 space-y-2 text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}` }}
        >
          <div className="flex justify-between">
            <span style={{ color: T.textLow }}>方案</span>
            <span className="font-medium" style={{ color: T.text }}>{planLabel}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.textLow }}>退款金額</span>
            <span className="font-bold" style={{ color: T.pass }}>{amountStr}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.textLow }}>付款方式</span>
            <span className="font-medium" style={{ color: T.text }}>{order.payment_type || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: T.textLow }}>退款期剩餘</span>
            <span className="font-medium" style={{ color: daysLeft <= 3 ? T.warn : T.text }}>
              {daysLeft} 天（共 14 天）
            </span>
          </div>
        </div>

        {/* 付款方式分流提示 */}
        {isCreditCard ? (
          <div
            className="mb-5 p-3 rounded-lg text-xs leading-relaxed"
            style={{ background: T.pass + '15', border: `1px solid ${T.pass}40`, color: '#86efac' }}
          >
            <strong>💳 信用卡退款</strong>：確認後系統會自動透過 NewebPay API 退款至原卡，
            預計 <strong>7-14 個工作天</strong>內入帳（依各銀行作業時間）。
          </div>
        ) : (
          <div
            className="mb-5 p-3 rounded-lg text-xs leading-relaxed"
            style={{ background: T.warn + '15', border: `1px solid ${T.warn}40`, color: '#fde68a' }}
          >
            <strong>🏦 手動轉帳退款</strong>：因 {order.payment_type} 方式無法線上自動退款，
            客服將於 <strong>7 個工作天內</strong>以 email 聯繫您索取銀行帳號，並完成轉帳。
          </div>
        )}

        {/* 警語 */}
        <p className="mb-5 text-xs leading-relaxed" style={{ color: T.textLow }}>
          ⚠️ 確認退款後 Pro 功能會立即停用，已分析的網站資料保留，但無法再使用 PDF 匯出、aivis 監測、修復碼產生器等 Pro 功能。
        </p>

        {/* 雙 CTA */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={cancelling}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 hover:opacity-80"
            style={{
              color: T.text,
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${T.cardBorder}`,
            }}
          >
            繼續使用 Pro
          </button>
          <button
            onClick={onConfirm}
            disabled={cancelling}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 hover:opacity-80"
            style={{
              color: '#ffffff',
              background: T.fail,
              border: `1px solid ${T.fail}`,
            }}
          >
            {cancelling ? '處理中...' : `確認退款 ${amountStr}`}
          </button>
        </div>
      </div>
    </div>
  )
}
