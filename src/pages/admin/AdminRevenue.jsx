import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// 訂閱定價常數（Top-up 小/大單價直接從訂單 amount 取，不需常數）
const PRICE_YEARLY = 13900        // Pro 一般年繳
const PRICE_EARLYBIRD = 11880     // Pro 早鳥首年（前 100 名）
const PRICE_NPA_MONTHLY = 1490    // Pro 月繳（NewebPay NPA 定期定額）
const PRICE_STRIPE_MONTHLY = 1490 // 舊 Stripe 月繳（Phase 2 備用，目前少量歷史用戶）

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export default function AdminRevenue() {
  const [stats, setStats] = useState(null)
  const [proUsers, setProUsers] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const oneYearAgo = new Date(now.getTime() - ONE_YEAR_MS)

      // 並行抓 7 個資料源：用戶/Pro/Stripe/列表/網站數 + NPA 月繳 active 訂閱 + Top-up 加購訂單
      const [
        { count: totalUsers },
        { count: proCount },
        { count: stripePaidCount },
        { data: proList },
        { count: totalWebsites },
        { data: npaMonthlyRaw },
        { data: topupOrdersRaw },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_pro', true).not('stripe_subscription_id', 'is', null),
        supabase.from('profiles').select('id, name, email, created_at, stripe_subscription_id, subscribed_at, payment_gateway').eq('is_pro', true).order('created_at', { ascending: false }),
        supabase.from('websites').select('*', { count: 'exact', head: true }),
        // NPA 月繳 active 訂閱（每筆 NT$1,490／月 持續扣款）
        supabase.from('aivis_newebpay_period').select('user_id, period_no, status, created_at, last_payment_at, already_times').eq('status', 'active').order('created_at', { ascending: false }),
        // Top-up 加購（小+大），一次性付款
        supabase.from('aivis_newebpay_pending').select('user_id, kind, amount, paid_at, refund_status').in('kind', ['topup_small', 'topup_large']).eq('status', 'paid').order('paid_at', { ascending: false }),
      ])

      // 抓 NewebPay Pro 年繳已付款訂單（含早鳥 + 退款狀態），用於拆早鳥 vs 一般年繳
      const { data: newebpayOrdersRaw } = await supabase
        .from('aivis_newebpay_pending')
        .select('user_id, pack, amount, paid_at, refund_status')
        .eq('kind', 'pro_yearly')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
      const newebpayOrders = newebpayOrdersRaw || []
      const npaMonthlyActive = npaMonthlyRaw || []
      const topupOrders = topupOrdersRaw || []

      // 過濾 active 年繳：未退款 + paid_at 在過去 12 個月內（年繳到期就不算 active）
      // 退款狀態 'completed' 與 'pending' 都不算（pending 已立即停權，等同退款）
      const activeNewebpay = newebpayOrders.filter(o =>
        (o.refund_status === 'none' || !o.refund_status || o.refund_status === 'failed') &&
        o.paid_at && new Date(o.paid_at) >= oneYearAgo
      )
      const earlybirdActive = activeNewebpay.filter(o => o.pack === 'earlybird')
      const yearlyActive = activeNewebpay.filter(o => o.pack === 'yearly')

      // Top-up 過濾未退款（aivis Top-up 政策本就不退款，但保險過濾 refund_status）
      const activeTopups = topupOrders.filter(t =>
        t.refund_status === 'none' || !t.refund_status || t.refund_status === 'failed'
      )
      const topupSmall = activeTopups.filter(t => t.kind === 'topup_small')
      const topupLarge = activeTopups.filter(t => t.kind === 'topup_large')
      const topupRevenue = activeTopups.reduce((s, t) => s + Number(t.amount || 0), 0)

      // 累計營收（年繳一次性 + Top-up 一次性，便於看「過去 12 月絕對營收」）
      const earlybirdRevenue = earlybirdActive.reduce((s, o) => s + Number(o.amount || 0), 0)
      const yearlyRevenue = yearlyActive.reduce((s, o) => s + Number(o.amount || 0), 0)
      const annualRevenue = earlybirdRevenue + yearlyRevenue

      // MRR 公式修正（第 17 輪）— 改用「每筆 active 訂閱 × 月攤分價」加總
      // 舊公式 annualRevenue / 12 在剛上線會嚴重低估（年繳訂單少），且季節跳變嚴重
      const earlybirdMrr = Math.round(earlybirdActive.length * (PRICE_EARLYBIRD / 12))   // ~990／人
      const yearlyMrrFromAnnual = Math.round(yearlyActive.length * (PRICE_YEARLY / 12))  // ~1,158／人
      const npaMonthlyMrr = npaMonthlyActive.length * PRICE_NPA_MONTHLY                  // 1,490／人
      const mrrFromNewebpay = earlybirdMrr + yearlyMrrFromAnnual + npaMonthlyMrr
      const mrrFromStripe = (stripePaidCount || 0) * PRICE_STRIPE_MONTHLY
      const totalMrr = mrrFromNewebpay + mrrFromStripe

      // 退款率（總退款 / 總年繳付款，年繳是唯一可退款方案）
      const refundedCount = newebpayOrders.filter(o =>
        o.refund_status === 'completed' || o.refund_status === 'pending'
      ).length
      const refundRate = newebpayOrders.length > 0
        ? ((refundedCount / newebpayOrders.length) * 100).toFixed(1)
        : '0.0'

      // 付費用戶總數 = NewebPay 年繳 active + NPA 月繳 active + Stripe 訂閱
      // 同一 user_id 可能跨多條金流（少數），用 Set 去重
      const newebpayYearlyUserIds = new Set(activeNewebpay.map(o => o.user_id))
      const npaMonthlyUserIds = new Set(npaMonthlyActive.map(p => p.user_id))
      const stripeUserIds = new Set((proList || []).filter(u => u.stripe_subscription_id).map(u => u.id))
      const paidProCount = new Set([...newebpayYearlyUserIds, ...npaMonthlyUserIds, ...stripeUserIds]).size
      const grantedProCount = (proCount || 0) - paidProCount

      setStats({
        totalUsers: totalUsers || 0,
        proCount: proCount || 0,
        paidProCount,
        grantedProCount,
        earlybirdCount: earlybirdActive.length,
        yearlyCount: yearlyActive.length,
        stripeMonthlyCount: stripePaidCount || 0,
        // 新增：NPA 月繳 + Top-up 統計
        npaMonthlyCount: npaMonthlyActive.length,
        npaMonthlyMrr,
        topupCount: activeTopups.length,
        topupSmallCount: topupSmall.length,
        topupLargeCount: topupLarge.length,
        topupRevenue,
        // 營收/MRR
        earlybirdRevenue,
        yearlyRevenue,
        annualRevenue,
        earlybirdMrr,
        yearlyMrrFromAnnual,
        mrrFromNewebpay,
        mrrFromStripe,
        totalMrr,
        // 退款
        refundedCount,
        refundRate,
        totalNewebpayYearlyOrders: newebpayOrders.length,   // 退款率分母（所有歷史年繳已付款訂單）
        conversionRate: totalUsers ? ((paidProCount / totalUsers) * 100).toFixed(1) : '0.0',
        totalWebsites: totalWebsites || 0,
      })
      setProUsers(proList || [])

      // 近 6 月新增付費用戶圖（按 paid_at / subscribed_at 月份分組）
      // 兩條線：NewebPay 新付費（含早鳥 + 一般年繳）vs Stripe 新訂閱
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        months.push({
          label: `${d.getMonth() + 1}月`,
          year: d.getFullYear(),
          month: d.getMonth(),
        })
      }

      // Stripe 歷史付費資料（subscribed_at 為刷卡時間）
      const { data: stripeHistory } = await supabase
        .from('profiles')
        .select('subscribed_at')
        .eq('is_pro', true)
        .not('stripe_subscription_id', 'is', null)
        .not('subscribed_at', 'is', null)

      const chart = months.map(m => {
        // NewebPay 線：年繳訂單（paid_at 月份）+ NPA 月繳首次簽約（period.created_at 月份）合計
        const yearlyInMonth = newebpayOrders.filter(o => {
          if (!o.paid_at) return false
          const d = new Date(o.paid_at)
          return d.getFullYear() === m.year && d.getMonth() === m.month
        }).length
        const npaMonthlyInMonth = npaMonthlyActive.filter(p => {
          if (!p.created_at) return false
          const d = new Date(p.created_at)
          return d.getFullYear() === m.year && d.getMonth() === m.month
        }).length
        const stripeCount = (stripeHistory || []).filter(u => {
          const d = new Date(u.subscribed_at)
          return d.getFullYear() === m.year && d.getMonth() === m.month
        }).length
        return {
          name: m.label,
          NewebPay: yearlyInMonth + npaMonthlyInMonth,
          Stripe: stripeCount,
        }
      })
      setChartData(chart)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // 上排 4 張卡：MRR / Pro 用戶 / 付費轉換率 / 退款率
  const STAT_CARDS = stats ? [
    {
      label: '估算 MRR',
      value: `NT$ ${stats.totalMrr.toLocaleString()}`,
      sub: `年繳攤 ${(stats.earlybirdMrr + stats.yearlyMrrFromAnnual).toLocaleString()} + 月繳 ${stats.npaMonthlyMrr.toLocaleString()} + Stripe ${stats.mrrFromStripe.toLocaleString()}`,
      color: 'text-orange-400',
      icon: '💰',
    },
    {
      label: 'Pro 用戶數',
      value: stats.proCount.toLocaleString(),
      sub: `付費 ${stats.paidProCount} + 授予 ${stats.grantedProCount}`,
      color: 'text-yellow-400',
      icon: '⭐',
    },
    {
      label: '付費轉換率',
      value: `${stats.conversionRate}%`,
      sub: `${stats.paidProCount} / ${stats.totalUsers} 註冊用戶`,
      color: 'text-emerald-400',
      icon: '📈',
    },
    {
      label: '退款率（限年繳）',
      value: `${stats.refundRate}%`,
      sub: `${stats.refundedCount} / ${stats.totalNewebpayYearlyOrders} 年繳訂單`,
      color: stats.refundRate > 5 ? 'text-red-400' : 'text-blue-400',
      icon: '↩️',
    },
  ] : []

  // 下排方案明細：早鳥 / 一般年繳 / NPA 月繳 / Top-up 加購 / Stripe 月繳（5 張）
  const PLAN_CARDS = stats ? [
    {
      label: '早鳥首年（前 100 名）',
      count: stats.earlybirdCount,
      revenue: stats.earlybirdRevenue,
      unitPriceLabel: `NT$ ${PRICE_EARLYBIRD.toLocaleString()}`,
      bg: 'bg-amber-500/10 border-amber-500/30',
      accent: 'text-amber-400',
      icon: '🐣',
    },
    {
      label: '一般年繳',
      count: stats.yearlyCount,
      revenue: stats.yearlyRevenue,
      unitPriceLabel: `NT$ ${PRICE_YEARLY.toLocaleString()}`,
      bg: 'bg-orange-500/10 border-orange-500/30',
      accent: 'text-orange-400',
      icon: '⭐',
    },
    {
      label: 'Pro 月繳（NPA）',
      count: stats.npaMonthlyCount,
      revenue: stats.npaMonthlyMrr,           // 月繳定期定額，營收即每月 MRR
      revenueLabel: '每月 MRR',
      unitPriceLabel: `NT$ ${PRICE_NPA_MONTHLY.toLocaleString()}／月`,
      bg: 'bg-teal-500/10 border-teal-500/30',
      accent: 'text-teal-400',
      icon: '📅',
    },
    {
      label: 'Top-up 加購（不退款）',
      count: stats.topupCount,
      revenue: stats.topupRevenue,
      revenueLabel: '累計營收',
      unitPriceLabel: `小 ${stats.topupSmallCount} ・ 大 ${stats.topupLargeCount}`,
      bg: 'bg-blue-500/10 border-blue-500/30',
      accent: 'text-blue-400',
      icon: '🛒',
    },
    {
      label: 'Stripe 月繳（歷史/備用）',
      count: stats.stripeMonthlyCount,
      revenue: stats.stripeMonthlyCount * PRICE_STRIPE_MONTHLY,
      revenueLabel: '每月 MRR',
      unitPriceLabel: `NT$ ${PRICE_STRIPE_MONTHLY.toLocaleString()}／月`,
      bg: 'bg-purple-500/10 border-purple-500/30',
      accent: 'text-purple-400',
      icon: '💳',
    },
  ] : []

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">營收儀表板</h1>
            <p className="text-slate-400 text-sm mt-1">
              MRR = NewebPay 年繳（每位 active 用戶 ÷ 12）+ NPA 月繳（每位 × NT$1,490）+ Stripe 月繳。Top-up 為一次性購買，列累計營收不計入 MRR。退款訂單與手動授予不計入。
            </p>
          </div>

          {/* 上排：4 張總覽卡 */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-slate-800 rounded-xl p-5 h-32 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {STAT_CARDS.map(card => (
                <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="text-2xl mb-3">{card.icon}</div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-slate-400 text-sm mt-1">{card.label}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* 下排：5 張方案明細卡（早鳥 / 一般年繳 / NPA 月繳 / Top-up / Stripe 月繳） */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {PLAN_CARDS.map(card => (
                <div key={card.label} className={`border rounded-xl p-5 ${card.bg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{card.icon}</span>
                    <span className="text-xs text-slate-500">{card.unitPriceLabel}</span>
                  </div>
                  <p className={`text-3xl font-bold ${card.accent}`}>{card.count}</p>
                  <p className="text-slate-300 text-sm mt-1">{card.label}</p>
                  <p className="text-slate-500 text-xs mt-2 border-t border-slate-700/50 pt-2">
                    {card.revenueLabel || '累計營收'} <strong className={card.accent}>NT$ {card.revenue.toLocaleString()}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 圖表：近 6 月新增付費用戶（NewebPay vs Stripe） */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-white font-semibold mb-4">近 6 個月新增付費用戶</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="NewebPay" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} />
                  <Line type="monotone" dataKey="Stripe" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-10">尚無資料</p>
            )}
          </div>

          {/* Pro 用戶列表（含金流標籤） */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-semibold">Pro 用戶列表（{proUsers.length} 人）</h2>
            </div>
            <div className="divide-y divide-slate-700">
              {proUsers.length === 0 ? (
                <p className="px-6 py-10 text-slate-500 text-sm text-center">尚無 Pro 用戶</p>
              ) : (
                proUsers.map((u, i) => {
                  // 三類來源徽章：NewebPay 年繳 / Stripe 月繳 / 手動授予
                  const isNewebpay = u.payment_gateway === 'newebpay'
                  const isStripe = !!u.stripe_subscription_id
                  const upgradeDate = u.subscribed_at || u.created_at
                  let badge, priceLabel
                  if (isNewebpay) {
                    badge = <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-medium">⭐ NewebPay 年繳</span>
                    priceLabel = '年繳方案'
                  } else if (isStripe) {
                    badge = <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">💳 Stripe 月繳</span>
                    priceLabel = `NT$ ${PRICE_STRIPE_MONTHLY.toLocaleString()}/月`
                  } else {
                    badge = <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600/40 text-slate-400 font-medium">⭐ 授予</span>
                    priceLabel = '不計入營收'
                  }
                  return (
                    <div key={u.id} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-600 text-xs w-5 text-right">{i + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-slate-200 text-sm font-medium">{u.name || '（未填姓名）'}</p>
                            {badge}
                          </div>
                          <p className="text-slate-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${isNewebpay || isStripe ? 'text-orange-400' : 'text-slate-500'}`}>
                          {priceLabel}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {isStripe || isNewebpay ? '訂閱於' : '授予於'} {new Date(upgradeDate).toLocaleDateString('zh-TW')}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
