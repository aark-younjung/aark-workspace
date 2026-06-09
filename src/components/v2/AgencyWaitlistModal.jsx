/**
 * AgencyWaitlistModal — Agency 方案候補名單登記（2026-06-09）
 *
 * 為什麼要：Agency 方案還沒做完、但 Pricing 頁需要收集潛在客戶名單做需求驗證、
 *   也要避免代理商客戶按「即將推出」按鈕無路可走。
 *
 * 收集欄位：
 *   1. email*（必填、若已登入帶入）
 *   2. company_name（選填、公司名 / 工作室名）
 *   3. num_clients_estimate（選填、預估管多少客戶站、做為定價設計依據）
 *   4. reason（選填、為什麼想要 Agency、最重要的需求）
 *
 * 寫入 supabase aark_agency_waitlist 表（需先跑 SQL 建表）
 * RLS：anon 可 insert、只有 admin 能 select 看清單
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function AgencyWaitlistModal({ open, onClose }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [numClients, setNumClients] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  // mount 時若用戶已登入、預填 email
  useEffect(() => {
    if (!open) return
    setEmail(user?.email || '')
    setCompanyName('')
    setNumClients('')
    setReason('')
    setDone(false)
    setErr('')
  }, [open, user?.email])

  async function handleSubmit() {
    if (submitting) return
    setErr('')
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setErr('請填正確的 Email 格式')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('aark_agency_waitlist').insert([{
        email: trimmedEmail,
        company_name: companyName.trim() || null,
        num_clients_estimate: numClients || null,
        reason: reason.trim() || null,
        user_id: user?.id || null,
      }])
      if (error) throw error
      setDone(true)
    } catch (e) {
      console.error('Agency waitlist submit failed:', e)
      setErr('登記失敗、請稍後再試或直接寄信給 aark.younjung@gmail.com')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl p-7 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, #0a0c10 0%, #050608 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center text-xl"
          aria-label="關閉"
        >×</button>

        {done ? (
          // 提交成功狀態
          <div className="text-center py-6">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-white mb-2">已收到、感謝你的候補登記</h3>
            <p className="text-sm text-white/65 leading-relaxed mb-6">
              Agency 方案籌備中、預計 1-2 個月內推出。<br/>
              方案開放時會用 email 通知你、候補名單有早期優惠。
            </p>
            <p className="text-sm text-white/45 mb-6">
              急用的話、目前 Pro 方案可追蹤 15 個網站、含完整白標 PDF。<br/>
              寄信 aark.younjung@gmail.com 也能直接洽談。
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white border border-white/15 hover:bg-white/5"
            >
              關閉
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5">
              <div className="text-4xl mb-3">🤝</div>
              <h3 className="text-2xl font-bold text-white mb-1">Agency 方案候補登記</h3>
              <p className="text-sm text-white/55 leading-relaxed">
                Agency 方案籌備中（50 站追蹤 + 多客戶工作區 + 完整白標 + 優先客服）、
                預計 1-2 個月內推出。候補名單享早期優惠。
              </p>
            </div>

            {/* 表單 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email <span className="text-emerald-300">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  公司 / 工作室名稱 <span className="text-sm font-normal text-white/40">(選填)</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="例：優勢方舟數位行銷"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  預估管多少客戶站 <span className="text-sm font-normal text-white/40">(選填、影響定價設計)</span>
                </label>
                <select
                  value={numClients}
                  onChange={e => setNumClients(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                >
                  <option value="" style={{ background: '#0a0c10' }}>請選擇</option>
                  <option value="1-5" style={{ background: '#0a0c10' }}>1-5 個客戶</option>
                  <option value="6-15" style={{ background: '#0a0c10' }}>6-15 個客戶</option>
                  <option value="16-30" style={{ background: '#0a0c10' }}>16-30 個客戶</option>
                  <option value="30+" style={{ background: '#0a0c10' }}>30 個以上</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  最想用 Agency 解決什麼 <span className="text-sm font-normal text-white/40">(選填、最重要的需求)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="例：白標 PDF / 一個帳號管多個客戶 / 月報自動化 / 預算考量..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 resize-none"
                />
              </div>
            </div>

            {/* 錯誤訊息 */}
            {err && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-400/30 text-sm text-red-300">
                {err}
              </div>
            )}

            {/* CTA */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:bg-white/5 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !email.trim()}
                className="flex-1 px-5 py-3 rounded-xl font-bold text-base bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    送出中…
                  </>
                ) : (
                  <>🤝 加入候補名單</>
                )}
              </button>
            </div>

            {/* 小提醒 */}
            <p className="mt-5 pt-4 border-t border-white/8 text-sm text-white/40 leading-relaxed">
              💡 不寄行銷信、不分享資料給第三方。方案開放時只發一封通知信、之後你決定要不要訂。
            </p>
          </>
        )}
      </div>
    </div>
  )
}
