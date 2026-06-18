import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

// 代理商候補名單檢視（2026-06-18）— 讀 aark_agency_waitlist（RLS：僅 admin 可 select）
// 表單來源：AgencyWaitlistModal。欄位：email / company_name / num_clients_estimate / reason / created_at
export default function AdminWaitlist() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('aark_agency_waitlist')
      .select('email, company_name, num_clients_estimate, reason, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows(data || [])
        setLoading(false)
      })
  }, [])

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">代理商候補名單</h1>
            <p className="text-slate-400 text-sm mt-1">
              來自落地頁「申請代理商方案」的登記。落地頁承諾 24 小時內聯繫——記得主動回覆。
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300 text-sm">⚠️ {error}</div>
          )}

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h2 className="text-white font-semibold">
                共 <span className="text-emerald-400">{rows.length}</span> 筆申請
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-left border-b border-slate-700">
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">公司 / 品牌</th>
                    <th className="px-4 py-3 font-medium">預估客戶數</th>
                    <th className="px-4 py-3 font-medium">申請原因</th>
                    <th className="px-4 py-3 font-medium">申請時間</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">載入中...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">還沒有人申請</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-6 py-3">
                        <a href={`mailto:${r.email}`} className="text-emerald-400 hover:underline">{r.email}</a>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{r.company_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-300">{r.num_clients_estimate || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-xs">{r.reason || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('zh-TW')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
