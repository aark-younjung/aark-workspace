import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'
import * as XLSX from 'xlsx'

export default function AdminUsers() {
  const [searchParams] = useSearchParams()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all')
  const [expandedId, setExpandedId] = useState(null)
  const [toggling, setToggling] = useState(null)
  const [userWebsites, setUserWebsites] = useState({})
  const [userAivis, setUserAivis] = useState({}) // { userId: { monthUsd, totalUsd, monthRuns, totalRuns } }
  const [userTopup, setUserTopup] = useState({}) // { userId: { balance, packs } } — Top-up 加購剩餘次數 + 各包明細
  const [userOrders, setUserOrders] = useState({}) // { userId: [orders] } — NewebPay pro_yearly 訂單（含早鳥 + 退款狀態）
  const [userPeriods, setUserPeriods] = useState({}) // { userId: [periods] } — NPA 月繳訂閱（aivis_newebpay_period）
  const [userErrorLogs, setUserErrorLogs] = useState({}) // { userId: [logs] } — 最近 10 筆掃描失敗紀錄（scan_error_logs）
  const [grantEmail, setGrantEmail] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantResult, setGrantResult] = useState(null) // { type: 'success'|'error'|'info', msg }
  // 客服工具：補發點數包 modal
  const [topupModal, setTopupModal] = useState(null) // { user } | null
  const [topupForm, setTopupForm] = useState({ pack: 'small', reason: '' })
  const [topupSubmitting, setTopupSubmitting] = useState(false)
  const [topupError, setTopupError] = useState(null)
  // 客服工具：延長 Pro modal
  const [extendModal, setExtendModal] = useState(null) // { user } | null
  const [extendForm, setExtendForm] = useState({ days: 30, reason: '' })
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [extendError, setExtendError] = useState(null)
  // 客服工具：寄自訂 email modal
  const [emailModal, setEmailModal] = useState(null) // { user } | null
  const [emailForm, setEmailForm] = useState({ subject: '', body: '', reason: '' })
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [emailSuccess, setEmailSuccess] = useState(null) // message_id 顯示用
  // 分頁狀態（純前端切片，因為 subscriptionType / hasRefund 客戶端算）
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [pageInput, setPageInput] = useState('1')   // 跳頁輸入框暫存值
  // is_test_order 切換中狀態（防 double-click）— key 為 merchant_order_no 或 period_no
  const [togglingTest, setTogglingTest] = useState({})

  // 切換訂單 / 月繳訂閱的 is_test_order 旗標
  // table = 'aivis_newebpay_pending' 或 'aivis_newebpay_period'
  // idColumn = 'merchant_order_no' 或 'period_no'
  const handleToggleTestOrder = async (table, idColumn, idValue, currentValue, userId) => {
    if (togglingTest[idValue]) return
    setTogglingTest(prev => ({ ...prev, [idValue]: true }))
    try {
      const { error } = await supabase
        .from(table)
        .update({ is_test_order: !currentValue })
        .eq(idColumn, idValue)
      if (error) throw error
      // 樂觀更新該用戶的 orders / periods state（不必重 fetch）
      if (table === 'aivis_newebpay_pending') {
        setUserOrders(prev => ({
          ...prev,
          [userId]: (prev[userId] || []).map(o =>
            o.merchant_order_no === idValue ? { ...o, is_test_order: !currentValue } : o
          ),
        }))
      } else if (table === 'aivis_newebpay_period') {
        setUserPeriods(prev => ({
          ...prev,
          [userId]: (prev[userId] || []).map(p =>
            p.period_no === idValue ? { ...p, is_test_order: !currentValue } : p
          ),
        }))
      }
    } catch (e) {
      alert('測試標記切換失敗：' + (e.message || '未知錯誤'))
    } finally {
      setTogglingTest(prev => ({ ...prev, [idValue]: false }))
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [filter])

  // filter / search 變動時跳回第 1 頁（避免「目前在第 3 頁但篩選後只剩 1 頁」的空白狀態）
  useEffect(() => {
    setCurrentPage(1)
    setPageInput('1')
  }, [filter, search])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, email, is_pro, is_admin, created_at, marketing_consent, pro_expires_at, admin_history, payment_gateway')
        .order('created_at', { ascending: false })

      // server-side 預篩：付費類細分（早鳥/年繳/月繳/授予）一律是 is_pro=true，先 server 過濾減少 client load
      // refunded 不預篩（退款後 is_pro 可能已被 cron 改 false，會錯過）
      const proOnlyFilters = ['pro', 'earlybird', 'yearly', 'monthly', 'granted']
      if (proOnlyFilters.includes(filter)) query = query.eq('is_pro', true)
      if (filter === 'free') query = query.eq('is_pro', false)

      // 並行抓 user classifications：bulk 撈所有歷史年繳訂單 + active 月繳訂閱
      // 用於列表「方案類型」標籤細分（早鳥 / 年繳 / 月繳 / 授予 Pro）
      // 列表分類排除 is_test_order=true 的內部測試訂單（aark6465 之流），讓測試用戶顯示「授予」而非污染「早鳥/年繳/月繳」標籤
      const [
        { data: usersData },
        { data: yearlyOrders },
        { data: activePeriods },
      ] = await Promise.all([
        query,
        supabase
          .from('aivis_newebpay_pending')
          .select('user_id, pack, refund_status, paid_at')
          .eq('kind', 'pro_yearly')
          .eq('status', 'paid')
          .eq('is_test_order', false),
        supabase
          .from('aivis_newebpay_period')
          .select('user_id')
          .eq('status', 'active')
          .eq('is_test_order', false),
      ])

      // 月繳 active 用戶（優先級最高，因為定期定額還在扣）
      const monthlyUserIds = new Set((activePeriods || []).map(p => p.user_id))

      // 每位用戶取「最新 paid_at」的年繳訂單做分類（早鳥/年繳 + 是否退款）
      const yearlyByUser = new Map()
      ;(yearlyOrders || []).forEach(o => {
        const existing = yearlyByUser.get(o.user_id)
        if (!existing || (o.paid_at && (!existing.paid_at || new Date(o.paid_at) > new Date(existing.paid_at)))) {
          yearlyByUser.set(o.user_id, o)
        }
      })

      // 為每個 user 計算 subscriptionType + hasRefund
      const enriched = (usersData || []).map(u => {
        let subscriptionType = null
        let hasRefund = false
        if (monthlyUserIds.has(u.id)) {
          subscriptionType = 'monthly'
        } else if (yearlyByUser.has(u.id)) {
          const order = yearlyByUser.get(u.id)
          subscriptionType = order.pack === 'earlybird' ? 'earlybird' : 'yearly'
          hasRefund = order.refund_status === 'completed' || order.refund_status === 'pending'
        }
        return { ...u, subscriptionType, hasRefund }
      })

      setUsers(enriched)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleExpand = async (userId) => {
    if (expandedId === userId) { setExpandedId(null); return }
    setExpandedId(userId)
    if (!userWebsites[userId]) {
      // 內嵌 audit 用 created_at desc 排序，render 端 .audits[0] 拿到的就是最新一筆
      // 不加排序的話 PostgREST 回傳順序不保證，重掃後 admin 可能還顯示舊分數
      const { data } = await supabase
        .from('websites')
        .select('id, url, name, created_at, seo_audits(score, created_at), aeo_audits(score, created_at), geo_audits(score, created_at), eeat_audits(score, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('created_at', { foreignTable: 'seo_audits', ascending: false })
        .order('created_at', { foreignTable: 'aeo_audits', ascending: false })
        .order('created_at', { foreignTable: 'geo_audits', ascending: false })
        .order('created_at', { foreignTable: 'eeat_audits', ascending: false })
      // 依 URL 去重複，保留最新一筆
      const seen = new Set()
      const deduped = (data || []).filter(site => {
        if (seen.has(site.url)) return false
        seen.add(site.url)
        return true
      })
      setUserWebsites(prev => ({ ...prev, [userId]: deduped }))
    }
    // 載入 aivis（AI 曝光監測）API 成本
    if (!userAivis[userId]) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: rows } = await supabase
        .from('aivis_responses')
        .select('cost_usd, created_at')
        .eq('user_id', userId)
      const all = rows || []
      const totalUsd = all.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
      const monthRows = all.filter(r => r.created_at >= monthStart)
      const monthUsd = monthRows.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
      setUserAivis(prev => ({
        ...prev,
        [userId]: {
          monthUsd, totalUsd,
          monthRuns: monthRows.length, totalRuns: all.length,
        },
      }))
    }
    // 載入 Top-up 加購餘額（aivis_topup_credits 表）
    // 直接 select 列出每包明細，順便算 sum，不另打 RPC（admin 端可繞 RLS 看全部）
    if (!userTopup[userId]) {
      const { data: packs } = await supabase
        .from('aivis_topup_credits')
        .select('id, pack_size, quota_total, quota_remaining, purchased_at')
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false })
      const list = packs || []
      const balance = list.reduce((s, p) => s + Number(p.quota_remaining || 0), 0)
      setUserTopup(prev => ({ ...prev, [userId]: { balance, packs: list } }))
    }
    // 載入 NewebPay Pro 年繳訂單（含早鳥 + 退款 metadata + is_test_order）
    // 展開詳情不過濾測試訂單 — 給客服看完整歷史；UI 用 🧪 chip 標示測試訂單
    if (!userOrders[userId]) {
      const { data: orders } = await supabase
        .from('aivis_newebpay_pending')
        .select('merchant_order_no, kind, pack, amount, status, payment_type, paid_at, refund_status, refund_amount, refund_method, refunded_at, refund_note, is_test_order')
        .eq('user_id', userId)
        .eq('kind', 'pro_yearly')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
      setUserOrders(prev => ({ ...prev, [userId]: orders || [] }))
    }
    // 載入 NPA 月繳訂閱（aivis_newebpay_period）— active + cancelled 都拿，cancelled 也要顯示給客服看歷史
    if (!userPeriods[userId]) {
      const { data: periods } = await supabase
        .from('aivis_newebpay_period')
        .select('period_no, status, created_at, last_payment_at, already_times, cancelled_at, cancel_note, is_test_order')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setUserPeriods(prev => ({ ...prev, [userId]: periods || [] }))
    }
    // 載入最近 10 筆掃描失敗紀錄（scan_error_logs）— 客服查「為什麼掃不出來」的依據
    // 與 HomeDark catch block 寫入同步：含 url / step / error_code / error_message / http_status / fallback 旗標
    if (!userErrorLogs[userId]) {
      const { data: logs } = await supabase
        .from('scan_error_logs')
        .select('id, url, step, error_code, error_message, http_status, ssl_fallback, ua_fallback, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      setUserErrorLogs(prev => ({ ...prev, [userId]: logs || [] }))
    }
  }

  const handleTogglePro = async (userId, currentPro) => {
    if (!confirm(`確定要${currentPro ? '取消' : '升級'} Pro 方案嗎？`)) return
    setToggling(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_pro: !currentPro })
        .eq('id', userId)
      if (!error) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_pro: !currentPro } : u))
      }
    } catch (e) {
      alert('操作失敗')
    } finally {
      setToggling(null)
    }
  }

  const handleExportExcel = async () => {
    // 並行抓 3 個來源：全用戶 + 年繳訂單（含退款）+ active 月繳訂閱
    const [
      { data: allUsers },
      { data: yearlyOrders },
      { data: activePeriods },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, is_pro, is_admin, created_at, marketing_consent, pro_expires_at, payment_gateway')
        .order('created_at', { ascending: false }),
      // Excel 匯出同步排除測試訂單，避免「方案類型 / 到期日」欄被測試資料污染
      supabase
        .from('aivis_newebpay_pending')
        .select('user_id, pack, refund_status, paid_at')
        .eq('kind', 'pro_yearly')
        .eq('status', 'paid')
        .eq('is_test_order', false),
      supabase
        .from('aivis_newebpay_period')
        .select('user_id, last_payment_at, already_times')
        .eq('status', 'active')
        .eq('is_test_order', false),
    ])

    // 建立月繳 + 年繳查找 map（跟 fetchUsers 同邏輯）
    const monthlyMap = new Map() // user_id → { last_payment_at, already_times }
    ;(activePeriods || []).forEach(p => {
      monthlyMap.set(p.user_id, p)
    })
    const yearlyByUser = new Map() // user_id → 最新 paid_at 的訂單
    ;(yearlyOrders || []).forEach(o => {
      const existing = yearlyByUser.get(o.user_id)
      if (!existing || (o.paid_at && (!existing.paid_at || new Date(o.paid_at) > new Date(existing.paid_at)))) {
        yearlyByUser.set(o.user_id, o)
      }
    })

    const rows = (allUsers || []).map((u, i) => {
      // 推算方案類型 + 到期日 + 退款狀態 + 金流
      let planType = '—'
      let expireDate = '—'
      let refundStatus = '—'
      let gateway = '—'

      if (!u.is_pro) {
        planType = 'Free'
      } else if (monthlyMap.has(u.id)) {
        const m = monthlyMap.get(u.id)
        planType = `📅 月繳（已扣 ${m.already_times || 0} 期）`
        // 月繳沒有固定到期日，預估「last_payment + 30 天」當下次扣款
        expireDate = m.last_payment_at
          ? `下次扣款 ${new Date(new Date(m.last_payment_at).getTime() + 30 * 86400 * 1000).toLocaleDateString('zh-TW')}`
          : '—'
        refundStatus = '—'   // 月繳不退款
        gateway = 'NewebPay NPA'
      } else if (yearlyByUser.has(u.id)) {
        const o = yearlyByUser.get(u.id)
        planType = o.pack === 'earlybird' ? '🐣 早鳥首年' : '⭐ 一般年繳'
        // 年繳到期日 = paid_at + 365 天
        expireDate = o.paid_at
          ? new Date(new Date(o.paid_at).getTime() + 365 * 86400 * 1000).toLocaleDateString('zh-TW')
          : '—'
        refundStatus = o.refund_status === 'completed' ? '✓ 已退款'
          : o.refund_status === 'pending' ? '⏳ 待手動轉帳'
          : o.refund_status === 'failed' ? '⚠️ 退款失敗'
          : '—'
        gateway = 'NewebPay MPG'
      } else {
        // is_pro=true 但無付費紀錄 = 手動授予
        planType = '⭐ 手動授予'
        expireDate = u.pro_expires_at
          ? new Date(u.pro_expires_at).toLocaleDateString('zh-TW')
          : '無到期日'
        refundStatus = '—'
        gateway = u.payment_gateway === 'stripe' ? 'Stripe（歷史）' : '無'
      }

      return {
        '#': i + 1,
        '姓名': u.name || '',
        'Email': u.email || '',
        '方案類型': planType,
        '到期日': expireDate,
        '退款狀態': refundStatus,
        '金流': gateway,
        '管理員': u.is_admin ? '是' : '否',
        '行銷同意': u.marketing_consent ? '是' : '否',
        '註冊時間': u.created_at ? new Date(u.created_at).toLocaleString('zh-TW') : '',
        '用戶 ID': u.id,
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    // 欄寬（順序：# / 姓名 / Email / 方案類型 / 到期日 / 退款狀態 / 金流 / 管理員 / 行銷同意 / 註冊時間 / 用戶 ID）
    ws['!cols'] = [
      { wch: 4 }, { wch: 16 }, { wch: 30 }, { wch: 20 },
      { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 8 },
      { wch: 10 }, { wch: 20 }, { wch: 38 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '用戶名單')

    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `aark_users_${date}.xlsx`)
  }

  const handleGrantPro = async (grantAsPro) => {
    const email = grantEmail.trim().toLowerCase()
    if (!email) return
    setGranting(true)
    setGrantResult(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, is_pro')
        .ilike('email', email)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setGrantResult({ type: 'error', msg: `找不到帳號：${email}` })
        return
      }
      if (data.is_pro === grantAsPro) {
        setGrantResult({ type: 'info', msg: `${data.email} 目前已是 ${grantAsPro ? 'Pro' : 'Free'} 方案，無需變更` })
        return
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_pro: grantAsPro })
        .eq('id', data.id)
      if (updateError) throw updateError
      // 同步更新列表（如果該用戶在當前列表中）
      setUsers(prev => prev.map(u => u.id === data.id ? { ...u, is_pro: grantAsPro } : u))
      setGrantResult({ type: 'success', msg: `✅ ${data.email}（${data.name || '未填姓名'}）已${grantAsPro ? '升級為 Pro' : '降回 Free'}` })
      setGrantEmail('')
    } catch (e) {
      setGrantResult({ type: 'error', msg: '操作失敗：' + e.message })
    } finally {
      setGranting(false)
    }
  }

  // 客服工具：補發 Top-up 點數包
  // - 採前端直接 INSERT supabase（受 RLS admin_insert_topup_credits policy 守門）
  // - source_payment_id 用 'admin_' prefix + userId 片段 + timestamp 確保 UNIQUE 且可追蹤
  // - notes 寫補發原因供日後稽核
  const openTopupModal = (user) => {
    setTopupModal({ user })
    setTopupForm({ pack: 'small', reason: '' })
    setTopupError(null)
  }

  const handleGrantTopup = async () => {
    if (!topupModal) return
    const reason = topupForm.reason.trim()
    if (!reason) {
      setTopupError('請填寫補發原因（供日後稽核）')
      return
    }
    setTopupSubmitting(true)
    setTopupError(null)
    try {
      const userId = topupModal.user.id
      const pack = topupForm.pack
      const quota = pack === 'large' ? 800 : 300
      const sourceId = `admin_${userId.slice(0, 8)}_${Date.now()}`
      const { error } = await supabase.from('aivis_topup_credits').insert({
        user_id: userId,
        pack_size: pack,
        quota_total: quota,
        quota_remaining: quota,
        source_payment_id: sourceId,
        notes: `[客服補發] ${reason}`,
      })
      if (error) throw error
      // 刷新該用戶的 Top-up 餘額顯示（清快取觸發重新載入）
      setUserTopup(prev => {
        const copy = { ...prev }
        delete copy[userId]
        return copy
      })
      // 重新載入該用戶的 Top-up（直接觸發 handleExpand 的 effect）
      const { data: packs } = await supabase
        .from('aivis_topup_credits')
        .select('id, pack_size, quota_total, quota_remaining, purchased_at')
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false })
      const list = packs || []
      const balance = list.reduce((s, p) => s + Number(p.quota_remaining || 0), 0)
      setUserTopup(prev => ({ ...prev, [userId]: { balance, packs: list } }))
      setTopupModal(null)
    } catch (e) {
      setTopupError('補發失敗：' + (e.message || '未知錯誤'))
    } finally {
      setTopupSubmitting(false)
    }
  }

  // 客服工具：延長 Pro 到期日
  // - 若用戶尚非 Pro，會同步把 is_pro 設成 true 並設定 pro_expires_at = now + days
  // - 若已是 Pro，pro_expires_at = max(now, current_expires) + days（避免「已過期才延長」反而縮短）
  // - 操作軌跡 append 進 profiles.admin_history JSONB 供日後稽核
  const openExtendModal = (user) => {
    setExtendModal({ user })
    setExtendForm({ days: 30, reason: '' })
    setExtendError(null)
  }

  const handleExtendPro = async () => {
    if (!extendModal) return
    const reason = extendForm.reason.trim()
    const days = Number(extendForm.days)
    if (!reason) {
      setExtendError('請填寫延長原因（供日後稽核）')
      return
    }
    if (!Number.isFinite(days) || days <= 0 || days > 3650) {
      setExtendError('天數須為 1-3650 之間的正整數')
      return
    }
    setExtendSubmitting(true)
    setExtendError(null)
    try {
      const user = extendModal.user
      const userId = user.id
      // 抓最新 admin_history 防 stale（其他 admin 同時操作）
      const { data: latest } = await supabase
        .from('profiles')
        .select('pro_expires_at, admin_history')
        .eq('id', userId)
        .maybeSingle()
      const now = new Date()
      const currentExpiresAt = latest?.pro_expires_at ? new Date(latest.pro_expires_at) : null
      // 起算基準 = max(now, current_expires) — 已過期就從 now 重算，未過期就 stack 上去
      const base = (currentExpiresAt && currentExpiresAt > now) ? currentExpiresAt : now
      const newExpiresAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)

      const historyEntry = {
        ts: now.toISOString(),
        action: 'extend_pro',
        days,
        reason,
        prev_expires_at: currentExpiresAt?.toISOString() || null,
        new_expires_at: newExpiresAt.toISOString(),
      }
      const newHistory = [...(latest?.admin_history || []), historyEntry]

      const { error } = await supabase
        .from('profiles')
        .update({
          is_pro: true,
          pro_expires_at: newExpiresAt.toISOString(),
          admin_history: newHistory,
        })
        .eq('id', userId)
      if (error) throw error

      // 同步更新列表 state
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, is_pro: true, pro_expires_at: newExpiresAt.toISOString(), admin_history: newHistory }
        : u
      ))
      setExtendModal(null)
    } catch (e) {
      setExtendError('延長失敗：' + (e.message || '未知錯誤'))
    } finally {
      setExtendSubmitting(false)
    }
  }

  // 客服工具：寄自訂 email
  // - 後端 endpoint /api/send-report-email?action=admin_custom 走 Bearer token + admin 驗證
  // - 寄完後 admin_history 由後端 append（不在前端重複寫，避免併發競爭）
  // - 寄成功後本地把 admin_history 樂觀更新供下次操作顯示
  const openEmailModal = (user) => {
    setEmailModal({ user })
    setEmailForm({ subject: '', body: '', reason: '' })
    setEmailError(null)
    setEmailSuccess(null)
  }

  const handleSendEmail = async () => {
    if (!emailModal) return
    const subject = emailForm.subject.trim()
    const body = emailForm.body.trim()
    const reason = emailForm.reason.trim()
    if (!subject) { setEmailError('請填寫信件主旨'); return }
    if (subject.length > 200) { setEmailError('主旨過長（上限 200 字）'); return }
    if (!body) { setEmailError('請填寫信件內容'); return }
    if (body.length > 10000) { setEmailError('內容過長（上限 10000 字）'); return }
    if (!reason) { setEmailError('請填寫寄送原因（供日後稽核）'); return }
    setEmailSubmitting(true)
    setEmailError(null)
    setEmailSuccess(null)
    try {
      const userId = emailModal.user.id
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('未取得登入 session，請重新登入')
      const res = await fetch('/api/send-report-email?action=admin_custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toUserId: userId, subject, body, reason }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      // 樂觀更新 admin_history（後端已寫入，這裡只是 UI 即時反映）
      const historyEntry = {
        ts: new Date().toISOString(),
        action: 'send_email',
        subject,
        reason,
        message_id: json.message_id || null,
      }
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, admin_history: [...(u.admin_history || []), historyEntry] }
        : u
      ))
      setEmailSuccess({ message_id: json.message_id, to: emailModal.user.email })
      setEmailForm({ subject: '', body: '', reason: '' })
    } catch (e) {
      setEmailError('寄送失敗：' + (e.message || '未知錯誤'))
    } finally {
      setEmailSubmitting(false)
    }
  }

  // 篩選邏輯：先按方案類型篩，再按搜尋關鍵字（email / 姓名）篩
  // filter 值：all / pro / free / earlybird / yearly / monthly / granted / refunded
  const filtered = users.filter(u => {
    // 1. 方案類型篩選
    if (filter === 'pro' && !u.is_pro) return false
    if (filter === 'free' && u.is_pro) return false
    if (filter === 'earlybird' && u.subscriptionType !== 'earlybird') return false
    if (filter === 'yearly' && u.subscriptionType !== 'yearly') return false
    if (filter === 'monthly' && u.subscriptionType !== 'monthly') return false
    // granted = is_pro=true 但 subscriptionType=null（手動授予，無付費紀錄）
    if (filter === 'granted' && !(u.is_pro && !u.subscriptionType)) return false
    // refunded = 有退款紀錄
    if (filter === 'refunded' && !u.hasRefund) return false
    // 2. 搜尋關鍵字
    const q = search.toLowerCase()
    if (!q) return true
    return (u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q))
  })

  // 分頁切片
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">用戶管理</h1>
              <p className="text-slate-400 text-sm mt-1">共 {users.length} 位用戶</p>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              匯出 Excel
            </button>
          </div>

          {/* 指定帳號授權 Pro */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <span className="text-orange-400">⭐</span> 指定帳號授權 Pro
            </h2>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                placeholder="輸入用戶 Email..."
                value={grantEmail}
                onChange={e => { setGrantEmail(e.target.value); setGrantResult(null) }}
                onKeyDown={e => e.key === 'Enter' && handleGrantPro(true)}
                className="flex-1 min-w-48 bg-slate-900 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => handleGrantPro(true)}
                disabled={granting || !grantEmail.trim()}
                className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {granting ? '處理中...' : '授予 Pro'}
              </button>
              <button
                onClick={() => handleGrantPro(false)}
                disabled={granting || !grantEmail.trim()}
                className="px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                取消 Pro
              </button>
            </div>
            {grantResult && (
              <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-medium ${
                grantResult.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                grantResult.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                'bg-slate-700 text-slate-300 border border-slate-600'
              }`}>
                {grantResult.msg}
              </div>
            )}
          </div>

          {/* 搜尋 + 篩選 */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <input
              type="text"
              placeholder="搜尋 Email 或姓名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500"
            />
            {/* 篩選按鈕 — 8 個選項分兩排：付費狀態（全部/Pro/Free）+ 方案細分（早鳥/年繳/月繳/授予/退款） */}
            <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 flex-wrap">
              {[
                ['all', '全部'],
                ['pro', 'Pro'],
                ['free', 'Free'],
                ['earlybird', '🐣 早鳥'],
                ['yearly', '⭐ 年繳'],
                ['monthly', '📅 月繳'],
                ['granted', '⭐ 授予'],
                ['refunded', '↩️ 退款'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 用戶列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-sm text-slate-500 font-semibold uppercase tracking-wider">
              <div className="col-span-4">用戶</div>
              <div className="col-span-2">方案</div>
              <div className="col-span-3">註冊時間</div>
              <div className="col-span-3 text-right">操作</div>
            </div>

            {loading ? (
              <div className="divide-y divide-slate-700">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="px-6 py-4 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-1/4" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-6 py-10 text-slate-500 text-sm text-center">沒有符合條件的用戶</p>
            ) : (
              <div className="divide-y divide-slate-700">
                {paged.map(u => (
                  <div key={u.id}>
                    {/* 用戶列 */}
                    <div
                      className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-750 cursor-pointer transition-colors"
                      onClick={() => handleExpand(u.id)}
                    >
                      <div className="col-span-4">
                        <p className="text-slate-200 text-sm font-medium">{u.name || '（未填）'}</p>
                        <p className="text-slate-500 text-sm mt-0.5">{u.email}</p>
                      </div>
                      <div className="col-span-2">
                        {/* 方案標籤：依 subscriptionType 細分為 早鳥/年繳/月繳/授予 Pro/Free */}
                        {(() => {
                          if (!u.is_pro) {
                            return <span className="text-sm px-2 py-1 rounded-full font-semibold bg-slate-700 text-slate-400">Free</span>
                          }
                          if (u.subscriptionType === 'earlybird') {
                            return <span className="text-sm px-2 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-400">🐣 早鳥</span>
                          }
                          if (u.subscriptionType === 'yearly') {
                            return <span className="text-sm px-2 py-1 rounded-full font-semibold bg-orange-500/20 text-orange-400">⭐ 年繳</span>
                          }
                          if (u.subscriptionType === 'monthly') {
                            return <span className="text-sm px-2 py-1 rounded-full font-semibold bg-teal-500/20 text-teal-400">📅 月繳</span>
                          }
                          // is_pro 但無付費記錄 = 手動授予
                          return <span className="text-sm px-2 py-1 rounded-full font-semibold bg-slate-600/40 text-slate-300">⭐ 授予</span>
                        })()}
                        {u.is_admin && <span className="ml-1 text-sm px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Admin</span>}
                        {/* 退款警示 — 列表上即時看到，不必展開 */}
                        {u.hasRefund && (
                          <span className="ml-1 text-sm px-2 py-1 rounded-full bg-red-500/20 text-red-400" title="此用戶有退款紀錄">↩️</span>
                        )}
                        {/* Pro 到期日（僅在有設定 pro_expires_at 時顯示）— 客服參考用 */}
                        {u.is_pro && u.pro_expires_at && (
                          <p className="text-slate-500 text-sm mt-1">
                            至 {new Date(u.pro_expires_at).toLocaleDateString('zh-TW')}
                          </p>
                        )}
                      </div>
                      <div className="col-span-3 text-slate-400 text-sm">
                        {new Date(u.created_at).toLocaleDateString('zh-TW')}
                      </div>
                      <div className="col-span-3 flex justify-end gap-2 items-center">
                        {/* 延長 Pro — 同步設定 pro_expires_at + 升 is_pro=true，並寫 admin_history */}
                        <button
                          onClick={e => { e.stopPropagation(); openExtendModal(u) }}
                          className="text-sm px-2.5 py-1.5 rounded-lg font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                          title="延長 Pro 期限（含設定到期日）"
                        >
                          📅 延長
                        </button>
                        {/* 寄自訂 email — 走後端 Resend，admin_history 後端 append */}
                        <button
                          onClick={e => { e.stopPropagation(); openEmailModal(u) }}
                          className="text-sm px-2.5 py-1.5 rounded-lg font-medium bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-colors"
                          title="寄送自訂 email 給此用戶"
                        >
                          ✉️ 寄信
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleTogglePro(u.id, u.is_pro) }}
                          disabled={toggling === u.id}
                          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                            u.is_pro
                              ? 'bg-slate-700 text-slate-300 hover:bg-red-900/40 hover:text-red-400'
                              : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                          }`}
                        >
                          {toggling === u.id ? '...' : u.is_pro ? '取消 Pro' : '升級 Pro'}
                        </button>
                        <svg className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === u.id ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* 展開詳情 */}
                    {expandedId === u.id && (
                      <div className="px-6 pb-5 bg-slate-900/50 border-t border-slate-700">
                        {/* AI 曝光監測 API 成本（admin 內部追蹤，前台對用戶隱藏） */}
                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mt-4 mb-3">AI 曝光監測 — API 成本（內部）</p>
                        {!userAivis[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userAivis[u.id].totalRuns === 0 ? (
                          <p className="text-slate-500 text-sm">尚未使用 AI 曝光監測</p>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {/* 本月成本 */}
                            <div className="bg-slate-800 rounded-lg px-4 py-3">
                              <p className="text-slate-500 text-sm mb-1">本月成本</p>
                              <p className="text-emerald-400 text-lg font-bold">${userAivis[u.id].monthUsd.toFixed(4)}</p>
                              <p className="text-slate-500 text-sm">≈ NT$ {(userAivis[u.id].monthUsd * 31).toFixed(2)}</p>
                            </div>
                            {/* 累積成本 */}
                            <div className="bg-slate-800 rounded-lg px-4 py-3">
                              <p className="text-slate-500 text-sm mb-1">累積成本</p>
                              <p className="text-slate-200 text-lg font-bold">${userAivis[u.id].totalUsd.toFixed(4)}</p>
                              <p className="text-slate-500 text-sm">≈ NT$ {(userAivis[u.id].totalUsd * 31).toFixed(2)}</p>
                            </div>
                            {/* 本月呼叫數 */}
                            <div className="bg-slate-800 rounded-lg px-4 py-3">
                              <p className="text-slate-500 text-sm mb-1">本月 API 呼叫</p>
                              <p className="text-slate-200 text-lg font-bold">{userAivis[u.id].monthRuns}</p>
                              <p className="text-slate-500 text-sm">次</p>
                            </div>
                            {/* 累積呼叫數 */}
                            <div className="bg-slate-800 rounded-lg px-4 py-3">
                              <p className="text-slate-500 text-sm mb-1">累積 API 呼叫</p>
                              <p className="text-slate-200 text-lg font-bold">{userAivis[u.id].totalRuns}</p>
                              <p className="text-slate-500 text-sm">次</p>
                            </div>
                          </div>
                        )}

                        {/* Top-up 加購餘額（aivis_topup_credits 累計） */}
                        <div className="flex items-center justify-between mt-5 mb-3">
                          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">AI 曝光監測 — Top-up 加購餘額</p>
                          {/* 客服補發按鈕 — 走前端 RLS 直寫 aivis_topup_credits */}
                          <button
                            onClick={e => { e.stopPropagation(); openTopupModal(u) }}
                            className="text-sm px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium transition-colors"
                          >
                            ✚ 補發點數包
                          </button>
                        </div>
                        {!userTopup[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userTopup[u.id].packs.length === 0 ? (
                          <p className="text-slate-500 text-sm">尚未加購任何 Top-up 點數包</p>
                        ) : (
                          <div className="space-y-2">
                            {/* 餘額總計 */}
                            <div className="bg-slate-800 rounded-lg px-4 py-3 flex items-center justify-between">
                              <div>
                                <p className="text-slate-500 text-sm mb-1">目前可用次數</p>
                                <p className="text-emerald-400 text-2xl font-bold">{userTopup[u.id].balance} <span className="text-slate-500 text-sm font-normal">次</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-slate-500 text-sm">共 {userTopup[u.id].packs.length} 個點數包</p>
                              </div>
                            </div>
                            {/* 各點數包明細 */}
                            <div className="space-y-1">
                              {userTopup[u.id].packs.map(pack => {
                                const used = pack.quota_total - pack.quota_remaining
                                const isExhausted = pack.quota_remaining === 0
                                return (
                                  <div
                                    key={pack.id}
                                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                                      isExhausted ? 'bg-slate-800/40 text-slate-500' : 'bg-slate-800/70 text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-sm font-semibold ${
                                        pack.pack_size === 'large' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'
                                      }`}>
                                        {pack.pack_size === 'large' ? '大包 800' : '小包 300'}
                                      </span>
                                      <span>{new Date(pack.purchased_at).toLocaleDateString('zh-TW')}</span>
                                    </div>
                                    <span>剩 <strong>{pack.quota_remaining}</strong> / {pack.quota_total}（已用 {used}）</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* NewebPay Pro 年繳訂單（含早鳥 + 退款紀錄）— 客服稽核用 */}
                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mt-5 mb-3">Pro 年繳訂單（NewebPay）</p>
                        {!userOrders[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userOrders[u.id].length === 0 ? (
                          <p className="text-slate-500 text-sm">尚無付費訂單（手動授予或 Stripe 用戶）</p>
                        ) : (
                          <div className="space-y-2">
                            {userOrders[u.id].map(order => {
                              const isEarlybird = order.pack === 'earlybird'
                              const paidDate = order.paid_at ? new Date(order.paid_at) : null
                              const expireDate = paidDate ? new Date(paidDate.getTime() + 365 * 24 * 60 * 60 * 1000) : null
                              const refundDeadline = paidDate ? new Date(paidDate.getTime() + 14 * 24 * 60 * 60 * 1000) : null
                              const now = new Date()
                              const refundDaysLeft = refundDeadline ? Math.ceil((refundDeadline - now) / (24 * 60 * 60 * 1000)) : 0
                              // 付款方式中文化（NewebPay 規範 payment_type 代碼）
                              const payTypeLabel = (() => {
                                const t = order.payment_type || ''
                                if (t.startsWith('CREDIT')) return '💳 信用卡'
                                if (t === 'VACC') return '🏦 ATM 轉帳'
                                if (t === 'WEBATM') return '🏦 WebATM'
                                if (t === 'CVS') return '🏪 超商代碼'
                                if (t === 'BARCODE') return '🏪 超商條碼'
                                return t || '—'
                              })()
                              return (
                                <div key={order.merchant_order_no} className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                                  {/* Header row：方案 + 金額 + 退款狀態 */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-1.5 py-0.5 rounded text-sm font-semibold ${
                                        isEarlybird ? 'bg-amber-500/20 text-amber-400' : 'bg-orange-500/20 text-orange-400'
                                      }`}>
                                        {isEarlybird ? '🐣 早鳥首年' : '⭐ 一般年繳'}
                                      </span>
                                      {/* 測試訂單標記 — 可點擊切換 is_test_order；true 表示內部沙盒/偵錯紀錄不計入正式營收 */}
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          handleToggleTestOrder('aivis_newebpay_pending', 'merchant_order_no', order.merchant_order_no, !!order.is_test_order, u.id)
                                        }}
                                        disabled={togglingTest[order.merchant_order_no]}
                                        className={`px-1.5 py-0.5 rounded text-sm font-semibold transition-colors disabled:opacity-40 ${
                                          order.is_test_order
                                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                            : 'bg-slate-700/50 text-slate-500 hover:bg-yellow-500/15 hover:text-yellow-400'
                                        }`}
                                        title={order.is_test_order ? '點擊取消測試標記（將計入正式營收）' : '點擊標為測試訂單（從正式營收排除）'}
                                      >
                                        {togglingTest[order.merchant_order_no] ? '...' : order.is_test_order ? '🧪 測試訂單' : '⭕ 標為測試'}
                                      </button>
                                      <span className="text-slate-200 font-semibold">NT$ {Number(order.amount).toLocaleString()}</span>
                                    </div>
                                    {/* 退款狀態 chip */}
                                    {order.refund_status === 'completed' && (
                                      <span className="px-1.5 py-0.5 rounded text-sm font-semibold bg-red-500/20 text-red-400">
                                        ✓ 已退款 {order.refund_method === 'api_credit' ? '(信用卡 API)' : '(手動轉帳)'}
                                      </span>
                                    )}
                                    {order.refund_status === 'pending' && (
                                      <span className="px-1.5 py-0.5 rounded text-sm font-semibold bg-yellow-500/20 text-yellow-400">
                                        ⏳ 待手動轉帳
                                      </span>
                                    )}
                                    {order.refund_status === 'failed' && (
                                      <span className="px-1.5 py-0.5 rounded text-sm font-semibold bg-red-500/30 text-red-300">
                                        ⚠️ 退款失敗
                                      </span>
                                    )}
                                    {order.refund_status === 'none' && refundDaysLeft > 0 && refundDaysLeft <= 3 && (
                                      <span className="px-1.5 py-0.5 rounded text-sm font-semibold bg-yellow-500/20 text-yellow-400">
                                        🕐 鑑賞期剩 {refundDaysLeft} 天
                                      </span>
                                    )}
                                  </div>
                                  {/* 詳細資訊 grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-400">
                                    <div>
                                      <p className="text-slate-500 text-sm">付款方式</p>
                                      <p className="text-slate-300">{payTypeLabel}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">付款日</p>
                                      <p className="text-slate-300">{paidDate ? paidDate.toLocaleDateString('zh-TW') : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">到期日</p>
                                      <p className={`${expireDate && expireDate < now ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                                        {expireDate ? expireDate.toLocaleDateString('zh-TW') : '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">訂單編號</p>
                                      <p className="text-slate-500 font-mono text-sm truncate" title={order.merchant_order_no}>{order.merchant_order_no}</p>
                                    </div>
                                  </div>
                                  {/* 退款備註（有的話） */}
                                  {order.refund_note && (
                                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                                      <p className="text-slate-500 text-sm mb-0.5">退款備註</p>
                                      <p className="text-slate-400 whitespace-pre-wrap">{order.refund_note}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* NPA 月繳訂閱（aivis_newebpay_period）— 客服稽核 + lifetime value 追蹤 */}
                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mt-5 mb-3">Pro 月繳訂閱（NewebPay NPA）</p>
                        {!userPeriods[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userPeriods[u.id].length === 0 ? (
                          <p className="text-slate-500 text-sm">尚無月繳訂閱紀錄</p>
                        ) : (
                          <div className="space-y-2">
                            {userPeriods[u.id].map(period => {
                              const isActive = period.status === 'active'
                              const isCancelled = period.status === 'cancelled'
                              const createdDate = period.created_at ? new Date(period.created_at) : null
                              const lastPayDate = period.last_payment_at ? new Date(period.last_payment_at) : null
                              const cancelledDate = period.cancelled_at ? new Date(period.cancelled_at) : null
                              // 月繳 lifetime revenue = 已扣款次數 × NT$1,490
                              const lifetimeRevenue = (Number(period.already_times) || 0) * 1490
                              return (
                                <div key={period.period_no} className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                                  {/* Header row：狀態 chip + 已扣款次數 + lifetime revenue */}
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-1.5 py-0.5 rounded text-sm font-semibold ${
                                        isActive ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-700 text-slate-400'
                                      }`}>
                                        {isActive ? '📅 月繳進行中' : isCancelled ? '⏸ 已取消委託' : period.status}
                                      </span>
                                      {/* 測試訂閱標記 — 可點擊切換 is_test_order */}
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          handleToggleTestOrder('aivis_newebpay_period', 'period_no', period.period_no, !!period.is_test_order, u.id)
                                        }}
                                        disabled={togglingTest[period.period_no]}
                                        className={`px-1.5 py-0.5 rounded text-sm font-semibold transition-colors disabled:opacity-40 ${
                                          period.is_test_order
                                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                            : 'bg-slate-700/50 text-slate-500 hover:bg-yellow-500/15 hover:text-yellow-400'
                                        }`}
                                        title={period.is_test_order ? '點擊取消測試標記（將計入正式營收）' : '點擊標為測試訂閱（從正式營收排除）'}
                                      >
                                        {togglingTest[period.period_no] ? '...' : period.is_test_order ? '🧪 測試訂閱' : '⭕ 標為測試'}
                                      </button>
                                      <span className="text-slate-200 font-semibold">
                                        已扣 {period.already_times || 0} 期・NT$ {lifetimeRevenue.toLocaleString()}
                                      </span>
                                    </div>
                                    <span className="text-slate-500">NT$ 1,490／月</span>
                                  </div>
                                  {/* 詳細資訊 grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-400">
                                    <div>
                                      <p className="text-slate-500 text-sm">首次扣款</p>
                                      <p className="text-slate-300">{createdDate ? createdDate.toLocaleDateString('zh-TW') : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">最後扣款</p>
                                      <p className="text-slate-300">{lastPayDate ? lastPayDate.toLocaleDateString('zh-TW') : '—'}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">{isCancelled ? '取消日期' : '下次扣款（預估）'}</p>
                                      <p className={isCancelled ? 'text-red-400' : 'text-slate-300'}>
                                        {isCancelled
                                          ? (cancelledDate ? cancelledDate.toLocaleDateString('zh-TW') : '—')
                                          : (lastPayDate ? new Date(lastPayDate.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('zh-TW') : '—')
                                        }
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-500 text-sm">委託編號</p>
                                      <p className="text-slate-500 font-mono text-sm truncate" title={period.period_no}>{period.period_no}</p>
                                    </div>
                                  </div>
                                  {/* 取消備註（取消的話） */}
                                  {isCancelled && period.cancel_note && (
                                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                                      <p className="text-slate-500 text-sm mb-0.5">取消備註</p>
                                      <p className="text-slate-400 whitespace-pre-wrap">{period.cancel_note}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mt-5 mb-3">已分析的網站</p>
                        {!userWebsites[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userWebsites[u.id].length === 0 ? (
                          <p className="text-slate-500 text-sm">尚無分析紀錄</p>
                        ) : (
                          <div className="space-y-2">
                            {userWebsites[u.id].map(site => {
                              const seo = site.seo_audits?.[0]?.score ?? '—'
                              const aeo = site.aeo_audits?.[0]?.score ?? '—'
                              const geo = site.geo_audits?.[0]?.score ?? '—'
                              const eeat = site.eeat_audits?.[0]?.score ?? '—'
                              return (
                                <Link
                                  key={site.id}
                                  to={`/dashboard/${site.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded-lg px-4 py-3 transition-colors group"
                                  title="於新分頁查看完整分析儀表板"
                                >
                                  <div>
                                    {/* hover 時網站名稱橘色強調，提示可點 */}
                                    <p className="text-slate-200 text-sm group-hover:text-orange-400 transition-colors">{site.name || site.url}</p>
                                    <p className="text-slate-500 text-sm">{site.url}</p>
                                  </div>
                                  <div className="flex gap-3 text-sm text-slate-400">
                                    <span>SEO <strong className="text-blue-400">{seo}</strong></span>
                                    <span>AEO <strong className="text-purple-400">{aeo}</strong></span>
                                    <span>GEO <strong className="text-emerald-400">{geo}</strong></span>
                                    <span>E-E-A-T <strong className="text-amber-400">{eeat}</strong></span>
                                  </div>
                                </Link>
                              )
                            })}
                          </div>
                        )}

                        {/* 掃描失敗紀錄（scan_error_logs）— 客服查「為什麼掃不出來」用，最近 10 筆 */}
                        <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mt-5 mb-3">
                          最近掃描錯誤紀錄
                          <span className="ml-2 text-slate-600 normal-case font-normal">（最多 10 筆）</span>
                        </p>
                        {!userErrorLogs[u.id] ? (
                          <p className="text-slate-500 text-sm">載入中...</p>
                        ) : userErrorLogs[u.id].length === 0 ? (
                          <p className="text-slate-500 text-sm">無錯誤紀錄</p>
                        ) : (
                          <div className="space-y-2">
                            {userErrorLogs[u.id].map(log => {
                              const when = new Date(log.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                              // 從 error_code / http_status 推斷錯誤類型 chip 顏色
                              const isAntiBot = log.http_status === 403 || /anti.?bot|cloudflare/i.test(log.error_message || '')
                              const isSSL = log.ssl_fallback || /ssl|cert/i.test(log.error_code || '')
                              const isTimeout = /timeout|ETIMEDOUT/i.test(log.error_code || '') || /timeout/i.test(log.error_message || '')
                              const isDns = /ENOTFOUND|EAI_AGAIN|DNS/i.test(log.error_code || '')
                              const chipLabel = isAntiBot ? '🛡️ Anti-bot' : isSSL ? '🔒 SSL' : isTimeout ? '⏱ 逾時' : isDns ? '🌐 DNS' : '⚠️ 其他'
                              const chipColor = isAntiBot
                                ? 'bg-red-500/20 text-red-400'
                                : isSSL ? 'bg-amber-500/20 text-amber-400'
                                : isTimeout ? 'bg-yellow-500/20 text-yellow-400'
                                : isDns ? 'bg-purple-500/20 text-purple-400'
                                : 'bg-slate-700 text-slate-400'
                              return (
                                <div key={log.id} className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                                  {/* Header：類型 chip + URL + 時間 */}
                                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-sm font-semibold ${chipColor}`}>{chipLabel}</span>
                                    {log.http_status && (
                                      <span className="px-1.5 py-0.5 rounded text-sm font-mono bg-slate-700 text-slate-400">HTTP {log.http_status}</span>
                                    )}
                                    {log.ua_fallback && (
                                      <span className="px-1.5 py-0.5 rounded text-sm bg-blue-500/20 text-blue-400">UA fallback</span>
                                    )}
                                    {log.ssl_fallback && (
                                      <span className="px-1.5 py-0.5 rounded text-sm bg-amber-500/20 text-amber-400">SSL fallback</span>
                                    )}
                                    <span className="text-slate-500 ml-auto">{when}</span>
                                  </div>
                                  {/* URL（可能很長，截斷顯示） */}
                                  <p className="text-slate-300 break-all mb-1">{log.url}</p>
                                  {/* 錯誤訊息 + step */}
                                  <div className="text-slate-400">
                                    <span className="text-slate-500">[{log.step || 'unknown'}]</span>{' '}
                                    <span className="font-mono text-slate-400">{log.error_code || '—'}</span>
                                    {log.error_message && (
                                      <span className="text-slate-500"> — {log.error_message.slice(0, 200)}{log.error_message.length > 200 ? '…' : ''}</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 分頁 footer — 預設每頁 50 筆，超過時顯示上下頁 + 跳頁 + 每頁筆數選擇 */}
            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-3 px-6 py-3 bg-slate-900 border-t border-slate-700 text-sm">
                <div className="text-slate-400">
                  共 <strong className="text-slate-200">{filtered.length}</strong> 筆
                  <span className="text-slate-600 mx-2">·</span>
                  顯示第 <strong className="text-slate-200">{(safePage - 1) * pageSize + 1}</strong>
                  &ndash;<strong className="text-slate-200">{Math.min(safePage * pageSize, filtered.length)}</strong> 筆
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = Math.max(1, safePage - 1); setCurrentPage(p); setPageInput(String(p)) }}
                    disabled={safePage === 1}
                    className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← 上一頁
                  </button>
                  <div className="flex items-center gap-1 text-slate-400">
                    第
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onBlur={() => {
                        const n = Math.min(Math.max(1, parseInt(pageInput, 10) || 1), totalPages)
                        setCurrentPage(n)
                        setPageInput(String(n))
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const n = Math.min(Math.max(1, parseInt(pageInput, 10) || 1), totalPages)
                          setCurrentPage(n)
                          setPageInput(String(n))
                          e.currentTarget.blur()
                        }
                      }}
                      className="w-16 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-center focus:outline-none focus:border-orange-500"
                    />
                    / {totalPages} 頁
                  </div>
                  <button
                    onClick={() => { const p = Math.min(totalPages, safePage + 1); setCurrentPage(p); setPageInput(String(p)) }}
                    disabled={safePage === totalPages}
                    className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一頁 →
                  </button>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  每頁
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); setPageInput('1') }}
                    className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-orange-500"
                  >
                    <option value={25} style={{ color: '#0f172a', background: '#fff' }}>25</option>
                    <option value={50} style={{ color: '#0f172a', background: '#fff' }}>50</option>
                    <option value={100} style={{ color: '#0f172a', background: '#fff' }}>100</option>
                    <option value={200} style={{ color: '#0f172a', background: '#fff' }}>200</option>
                  </select>
                  筆
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 客服工具 Modal：補發 Top-up 點數包 */}
        {topupModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !topupSubmitting && setTopupModal(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1">補發 Top-up 點數包</h3>
              <p className="text-slate-400 text-sm mb-5">
                給 <strong className="text-emerald-400">{topupModal.user.name || topupModal.user.email}</strong>（{topupModal.user.email}）
              </p>

              {/* 點數包 select */}
              <label className="block text-slate-300 text-sm font-medium mb-2">點數包</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { v: 'small', label: '小包 300 次', sub: 'NT$ 490 等值' },
                  { v: 'large', label: '大包 800 次', sub: 'NT$ 990 等值' },
                ].map(opt => (
                  <button
                    key={opt.v}
                    onClick={() => setTopupForm(f => ({ ...f, pack: opt.v }))}
                    disabled={topupSubmitting}
                    className={`px-3 py-3 rounded-lg border text-left transition-colors ${
                      topupForm.pack === opt.v
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-sm opacity-70 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>

              {/* 補發原因 textarea */}
              <label className="block text-slate-300 text-sm font-medium mb-2">
                補發原因 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={topupForm.reason}
                onChange={e => setTopupForm(f => ({ ...f, reason: e.target.value }))}
                disabled={topupSubmitting}
                placeholder="例：服務中斷補償 / 早期用戶感謝 / 客訴處理 (ticket #123)"
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none mb-4"
              />

              {topupError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                  {topupError}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setTopupModal(null)}
                  disabled={topupSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleGrantTopup}
                  disabled={topupSubmitting || !topupForm.reason.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {topupSubmitting ? '處理中...' : `確認補發 ${topupForm.pack === 'large' ? '800' : '300'} 次`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 客服工具 Modal：延長 Pro 期限 */}
        {extendModal && (() => {
          // 預覽新到期日：在 modal 開啟時即時算
          const user = extendModal.user
          const days = Number(extendForm.days) || 0
          const now = new Date()
          const currentExpiresAt = user.pro_expires_at ? new Date(user.pro_expires_at) : null
          const base = (currentExpiresAt && currentExpiresAt > now) ? currentExpiresAt : now
          const newExpiresAt = days > 0 ? new Date(base.getTime() + days * 24 * 60 * 60 * 1000) : null
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => !extendSubmitting && setExtendModal(null)}
            >
              <div
                className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-white mb-1">延長 / 設定 Pro 到期日</h3>
                <p className="text-slate-400 text-sm mb-4">
                  給 <strong className="text-blue-400">{user.name || user.email}</strong>（{user.email}）
                </p>

                {/* 當前狀態 */}
                <div className="bg-slate-800 rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>當前方案</span>
                    <span className={user.is_pro ? 'text-orange-400 font-semibold' : 'text-slate-500'}>
                      {user.is_pro ? '⭐ Pro' : 'Free'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>當前到期日</span>
                    <span className="text-slate-300">
                      {currentExpiresAt
                        ? `${currentExpiresAt.toLocaleDateString('zh-TW')}${currentExpiresAt < now ? '（已過期）' : ''}`
                        : '（未設定）'}
                    </span>
                  </div>
                </div>

                {/* 延長天數 preset + 自訂 */}
                <label className="block text-slate-300 text-sm font-medium mb-2">延長天數</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[30, 90, 365].map(d => (
                    <button
                      key={d}
                      onClick={() => setExtendForm(f => ({ ...f, days: d }))}
                      disabled={extendSubmitting}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        Number(extendForm.days) === d
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {d === 365 ? '1 年' : `${d} 天`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={extendForm.days}
                  onChange={e => setExtendForm(f => ({ ...f, days: e.target.value }))}
                  disabled={extendSubmitting}
                  placeholder="自訂天數 (1-3650)"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-3"
                />

                {/* 預覽新到期日 */}
                {newExpiresAt && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 text-sm">
                    <p className="text-slate-400 text-sm mb-1">延長後新到期日</p>
                    <p className="text-blue-300 font-semibold">{newExpiresAt.toLocaleDateString('zh-TW')}（{newExpiresAt.toLocaleString('zh-TW', { weekday: 'short' })}）</p>
                  </div>
                )}

                {/* 延長原因 */}
                <label className="block text-slate-300 text-sm font-medium mb-2">
                  延長原因 <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={extendForm.reason}
                  onChange={e => setExtendForm(f => ({ ...f, reason: e.target.value }))}
                  disabled={extendSubmitting}
                  placeholder="例：服務中斷補償 / 早鳥優惠贈與 / 客訴處理 (ticket #123)"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none mb-4"
                />

                {extendError && (
                  <div className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                    {extendError}
                  </div>
                )}

                {/* 警示：若已是付費年繳用戶，會疊加在原 paid_at + 1 year 之後 */}
                {user.is_pro && user.payment_gateway === 'newebpay' && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm rounded-lg px-3 py-2 mb-4">
                    ⚠️ 此用戶為 NewebPay 付費年繳用戶。延長到期日**不會**自動退費或衝突原訂單，僅供客服補償。
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setExtendModal(null)}
                    disabled={extendSubmitting}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleExtendPro}
                    disabled={extendSubmitting || !extendForm.reason.trim() || !(days > 0)}
                    className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extendSubmitting ? '處理中...' : `確認延長 ${days || 0} 天`}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 客服工具 Modal：寄自訂 email */}
        {emailModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !emailSubmitting && setEmailModal(null)}
          >
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-1">寄送自訂 email</h3>
              <p className="text-slate-400 text-sm mb-5">
                寄給 <strong className="text-pink-400">{emailModal.user.name || emailModal.user.email}</strong>
                <span className="text-slate-500">（{emailModal.user.email}）</span>
              </p>

              {/* 主旨 */}
              <label className="block text-slate-300 text-sm font-medium mb-2">
                主旨 <span className="text-red-400">*</span>
                <span className="text-slate-500 text-sm ml-2">{emailForm.subject.length}/200</span>
              </label>
              <input
                type="text"
                value={emailForm.subject}
                onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
                disabled={emailSubmitting}
                maxLength={200}
                placeholder="例：關於您的 Pro 訂閱補償通知"
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 mb-4"
              />

              {/* 內容 */}
              <label className="block text-slate-300 text-sm font-medium mb-2">
                信件內容 <span className="text-red-400">*</span>
                <span className="text-slate-500 text-sm ml-2">{emailForm.body.length}/10000</span>
              </label>
              <textarea
                value={emailForm.body}
                onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                disabled={emailSubmitting}
                maxLength={10000}
                placeholder="支援多行純文字（換行會自動轉成 <br>）。例：&#10;&#10;您好，&#10;&#10;由於日前服務中斷造成不便，已為您延長 Pro 訂閱 30 天。&#10;&#10;優勢方舟客服團隊敬上"
                rows={10}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 resize-y mb-4"
              />

              {/* 寄送原因（稽核用） */}
              <label className="block text-slate-300 text-sm font-medium mb-2">
                寄送原因 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={emailForm.reason}
                onChange={e => setEmailForm(f => ({ ...f, reason: e.target.value }))}
                disabled={emailSubmitting}
                placeholder="例：服務中斷補償通知 / 客訴處理 (ticket #123) / 早鳥用戶感謝信"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-pink-500 resize-none mb-4"
              />

              {emailError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="bg-green-500/20 border border-green-500/30 text-green-300 text-sm rounded-lg px-3 py-2 mb-4">
                  ✅ 已寄送至 {emailSuccess.to}
                  {emailSuccess.message_id && (
                    <p className="text-green-400/70 text-sm mt-1 font-mono">message_id: {emailSuccess.message_id}</p>
                  )}
                </div>
              )}

              {/* 寄件人提示 */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-4 text-sm text-slate-400">
                <p>📤 寄件人：<span className="text-slate-300 font-medium">AI 雷達客服 &lt;support@aark.io&gt;</span></p>
                <p className="mt-1">📝 此次操作會記錄至 <code className="bg-slate-700/50 px-1 rounded">admin_history</code> JSONB 供日後稽核</p>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEmailModal(null)}
                  disabled={emailSubmitting}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {emailSuccess ? '關閉' : '取消'}
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailSubmitting || !emailForm.subject.trim() || !emailForm.body.trim() || !emailForm.reason.trim() || !!emailSuccess}
                  className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {emailSubmitting ? '寄送中...' : emailSuccess ? '已寄送' : '確認寄送'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  )
}
