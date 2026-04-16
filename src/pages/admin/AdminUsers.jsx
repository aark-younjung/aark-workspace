import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  const [grantEmail, setGrantEmail] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantResult, setGrantResult] = useState(null) // { type: 'success'|'error'|'info', msg }

  useEffect(() => {
    fetchUsers()
  }, [filter])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, email, is_pro, is_admin, created_at, marketing_consent')
        .order('created_at', { ascending: false })

      if (filter === 'pro') query = query.eq('is_pro', true)
      if (filter === 'free') query = query.eq('is_pro', false)

      const { data } = await query
      setUsers(data || [])
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
      const { data } = await supabase
        .from('websites')
        .select('id, url, name, created_at, seo_audits(score), aeo_audits(score), geo_audits(score), eeat_audits(score)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      // 依 URL 去重複，保留最新一筆
      const seen = new Set()
      const deduped = (data || []).filter(site => {
        if (seen.has(site.url)) return false
        seen.add(site.url)
        return true
      })
      setUserWebsites(prev => ({ ...prev, [userId]: deduped }))
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
    // 取全部用戶（不受目前 filter 限制）
    const { data: allUsers } = await supabase
      .from('profiles')
      .select('id, name, email, is_pro, is_admin, created_at, marketing_consent')
      .order('created_at', { ascending: false })

    const rows = (allUsers || []).map((u, i) => ({
      '#': i + 1,
      '姓名': u.name || '',
      'Email': u.email || '',
      '方案': u.is_pro ? 'Pro' : 'Free',
      '管理員': u.is_admin ? '是' : '否',
      '行銷同意': u.marketing_consent ? '是' : '否',
      '註冊時間': u.created_at ? new Date(u.created_at).toLocaleString('zh-TW') : '',
      '用戶 ID': u.id,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    // 欄寬
    ws['!cols'] = [
      { wch: 4 }, { wch: 16 }, { wch: 30 }, { wch: 8 },
      { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 38 },
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

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  )

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
            <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
              {[['all', '全部'], ['pro', 'Pro'], ['free', 'Free']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === val ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 用戶列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-xs text-slate-500 font-semibold uppercase tracking-wider">
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
                {filtered.map(u => (
                  <div key={u.id}>
                    {/* 用戶列 */}
                    <div
                      className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-750 cursor-pointer transition-colors"
                      onClick={() => handleExpand(u.id)}
                    >
                      <div className="col-span-4">
                        <p className="text-slate-200 text-sm font-medium">{u.name || '（未填）'}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{u.email}</p>
                      </div>
                      <div className="col-span-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${u.is_pro ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'}`}>
                          {u.is_pro ? '⭐ Pro' : 'Free'}
                        </span>
                        {u.is_admin && <span className="ml-1 text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">Admin</span>}
                      </div>
                      <div className="col-span-3 text-slate-400 text-sm">
                        {new Date(u.created_at).toLocaleDateString('zh-TW')}
                      </div>
                      <div className="col-span-3 flex justify-end gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); handleTogglePro(u.id, u.is_pro) }}
                          disabled={toggling === u.id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
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
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-4 mb-3">已分析的網站</p>
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
                                <div key={site.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3">
                                  <div>
                                    <p className="text-slate-200 text-sm">{site.name || site.url}</p>
                                    <p className="text-slate-500 text-xs">{site.url}</p>
                                  </div>
                                  <div className="flex gap-3 text-xs text-slate-400">
                                    <span>SEO <strong className="text-blue-400">{seo}</strong></span>
                                    <span>AEO <strong className="text-purple-400">{aeo}</strong></span>
                                    <span>GEO <strong className="text-emerald-400">{geo}</strong></span>
                                    <span>E-E-A-T <strong className="text-amber-400">{eeat}</strong></span>
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
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
