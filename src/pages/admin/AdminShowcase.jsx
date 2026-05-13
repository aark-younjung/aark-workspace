import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

// 三種審核狀態 → tab 配色 / 圖示
// 待審 = 用戶提交但尚未審核（橘）/ 已核准（綠）/ 已拒絕（紅）
const TAB_META = {
  pending:  { label: '待審核', emoji: '⏳', chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  approved: { label: '已核准', emoji: '✅', chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  rejected: { label: '已拒絕', emoji: '🚫', chip: 'bg-red-500/20 text-red-300 border-red-500/30' },
}

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminShowcase() {
  const [tab, setTab] = useState('pending')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 })

  // 拒絕 modal — 必填理由 textarea
  const [rejectModal, setRejectModal] = useState(null)  // { id, name } | null
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSubmitting, setRejectSubmitting] = useState(false)
  const [rejectError, setRejectError] = useState(null)

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    // 一次抓回全部 websites 然後 in-memory 分類 — 待審/核准/拒絕通常合計 < 500 row，
    // 比起對每個 tab 各做一條 query 簡單；順便算 3 個 tab 的計數放到上方 chip。
    const { data, error } = await supabase
      .from('websites')
      .select('id, name, url, user_id, created_at, is_approved, submitted_at, rejection_reason')
      .order('submitted_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('load websites failed', error)
      setRows([])
      setLoading(false)
      return
    }

    const all = data || []
    // 計數：待審 = 已提交但未核准也未拒絕 / 核准 = is_approved=true / 拒絕 = 有 rejection_reason
    const pending = all.filter(r => !r.is_approved && r.submitted_at && !r.rejection_reason)
    const approved = all.filter(r => r.is_approved)
    const rejected = all.filter(r => !!r.rejection_reason)
    setCounts({ pending: pending.length, approved: approved.length, rejected: rejected.length })

    const filtered = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected
    setRows(filtered)

    // 取得 user email 用於顯示（in-memory join，避免 supabase-js v2 nested select 對 RLS 的限制）
    const userIds = [...new Set(filtered.map(r => r.user_id).filter(Boolean))]
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, email, name').in('id', userIds)
      const userMap = new Map((profs || []).map(p => [p.id, p]))
      setRows(filtered.map(r => ({ ...r, _user: userMap.get(r.user_id) })))
    }

    setLoading(false)
  }

  // 核准 — 樂觀更新 + rollback
  async function handleApprove(row) {
    const prev = { ...row }
    setRows(list => list.filter(x => x.id !== row.id))
    setCounts(c => ({ ...c, pending: c.pending - 1, approved: c.approved + 1 }))

    const { error } = await supabase
      .from('websites')
      .update({ is_approved: true, rejection_reason: null })
      .eq('id', row.id)

    if (error) {
      // rollback
      setRows(list => [prev, ...list])
      setCounts(c => ({ ...c, pending: c.pending + 1, approved: c.approved - 1 }))
      alert('核准失敗：' + error.message)
    }
  }

  // 拒絕 — 開 modal 收必填 reason
  function openReject(row) {
    setRejectModal({ id: row.id, name: row.name, url: row.url })
    setRejectReason('')
    setRejectError(null)
  }

  async function submitReject() {
    if (!rejectReason.trim()) {
      setRejectError('拒絕原因為必填，用戶看不到此原因，但 admin 端要留軌跡')
      return
    }
    setRejectSubmitting(true)
    setRejectError(null)

    const { error } = await supabase
      .from('websites')
      .update({ is_approved: false, rejection_reason: rejectReason.trim() })
      .eq('id', rejectModal.id)

    if (error) {
      setRejectError('拒絕失敗：' + error.message)
      setRejectSubmitting(false)
      return
    }

    setRejectSubmitting(false)
    setRejectModal(null)
    await load()
  }

  // 重新審核 — 已拒絕/已核准的可重置回待審佇列（清掉 rejection_reason、is_approved=false、保留 submitted_at）
  async function handleReopen(row) {
    if (!confirm(`要把「${row.name}」放回待審佇列嗎？\n\n之前的拒絕原因會被清除，需要重新審核一次。`)) return
    const { error } = await supabase
      .from('websites')
      .update({ is_approved: false, rejection_reason: null })
      .eq('id', row.id)
    if (error) {
      alert('重新審核失敗：' + error.message)
      return
    }
    await load()
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">排行榜審核</h1>
              <p className="text-slate-400 text-sm mt-1">
                用戶提交至 <a href="/showcase" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">/showcase</a> 公開排行榜的網站須經 admin 審核後才會顯示
              </p>
            </div>
          </div>

          {/* Tab 切換 */}
          <div className="mb-5 flex gap-2 flex-wrap">
            {Object.entries(TAB_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  tab === key
                    ? meta.chip + ' border-2'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                {meta.emoji} {meta.label} <span className="opacity-70 ml-1">({counts[key]})</span>
              </button>
            ))}
          </div>

          {/* 列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <div className="col-span-4">網站</div>
              <div className="col-span-3">提交用戶</div>
              <div className="col-span-2">提交時間</div>
              <div className="col-span-3 text-right">操作</div>
            </div>

            {loading ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm">載入中...</div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-400 text-sm mb-2">
                  {tab === 'pending' && '目前沒有待審核的網站 🎉'}
                  {tab === 'approved' && '還沒有任何已核准的網站'}
                  {tab === 'rejected' && '還沒有拒絕過任何網站'}
                </p>
                {tab === 'pending' && (
                  <p className="text-slate-500 text-xs">用戶在 Dashboard 點「提交至排行榜」後會出現在這裡</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {rows.map(r => (
                  <div key={r.id} className="grid grid-cols-12 px-6 py-4 items-start hover:bg-slate-800/50 transition-colors">
                    <div className="col-span-4 pr-4">
                      <p className="text-slate-200 text-sm font-medium truncate">{r.name || '(未命名)'}</p>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 text-xs truncate block hover:text-orange-400">
                        {r.url}
                      </a>
                      {tab === 'rejected' && r.rejection_reason && (
                        <p className="text-red-300/80 text-xs mt-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded">
                          拒絕原因：{r.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="col-span-3 text-slate-300 text-xs">
                      {r._user ? (
                        <>
                          <p className="truncate">{r._user.name || '(無姓名)'}</p>
                          <p className="text-slate-500 truncate">{r._user.email}</p>
                        </>
                      ) : (
                        <p className="text-slate-500">(載入中...)</p>
                      )}
                    </div>
                    <div className="col-span-2 text-slate-400 text-xs">
                      <p>提交：{fmtDate(r.submitted_at)}</p>
                      <p className="text-slate-500">建立：{fmtDate(r.created_at)}</p>
                    </div>
                    <div className="col-span-3 flex justify-end gap-2 flex-wrap">
                      <a
                        href={`/dashboard/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                      >
                        查看儀表板
                      </a>
                      {tab === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(r)}
                            className="text-xs px-2.5 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg font-medium transition-colors"
                          >
                            ✓ 核准
                          </button>
                          <button
                            onClick={() => openReject(r)}
                            className="text-xs px-2.5 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-lg font-medium transition-colors"
                          >
                            ✕ 拒絕
                          </button>
                        </>
                      )}
                      {tab === 'approved' && (
                        <button
                          onClick={() => openReject(r)}
                          className="text-xs px-2.5 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-lg font-medium transition-colors"
                        >
                          下架（拒絕）
                        </button>
                      )}
                      {tab === 'rejected' && (
                        <button
                          onClick={() => handleReopen(r)}
                          className="text-xs px-2.5 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg font-medium transition-colors"
                        >
                          ↻ 重新審核
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 拒絕原因 modal */}
        {rejectModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold">拒絕網站</h2>
                <button onClick={() => setRejectModal(null)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="text-slate-300 text-sm">
                  <p className="font-medium">{rejectModal.name}</p>
                  <p className="text-slate-500 text-xs truncate">{rejectModal.url}</p>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">
                    拒絕原因 <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="例如：競品惡意刷榜 / 內容不符品牌調性 / 測試 URL 非真實品牌"
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-y"
                  />
                  <p className="text-slate-500 text-xs mt-1">用戶看不到此原因，僅作為 admin 端稽核軌跡用</p>
                </div>

                {rejectError && (
                  <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg">
                    {rejectError}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-2">
                <button
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitReject}
                  disabled={rejectSubmitting}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {rejectSubmitting ? '處理中...' : '確認拒絕'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  )
}
