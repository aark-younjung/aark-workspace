import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'
import AdminGuard from './AdminGuard'

// 公告類型 → 配色 / 圖示（前端 banner 也吃這套）
const KIND_META = {
  info:    { label: '資訊',  emoji: 'ℹ️', dot: 'bg-blue-400',   chip: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  warn:    { label: '警示',  emoji: '⚠️', dot: 'bg-amber-400',  chip: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  promo:   { label: '促銷',  emoji: '🎉', dot: 'bg-orange-400', chip: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  success: { label: '成功',  emoji: '✅', dot: 'bg-emerald-400',chip: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
}

const TARGET_LABEL = { all: '全部用戶', free: '僅免費版', pro: '僅 Pro' }

// 把 timestamptz 轉成 datetime-local input 接受的字串（YYYY-MM-DDTHH:mm，本地時區）
function tsToLocalInput(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const tzOffsetMs = d.getTimezoneOffset() * 60000
  return new Date(d - tzOffsetMs).toISOString().slice(0, 16)
}
// datetime-local input 字串 → ISO（讓 Supabase 用 timestamptz 存）
function localInputToIso(local) {
  if (!local) return null
  return new Date(local).toISOString()
}

// 判定公告當前實際狀態（is_active + 期間綜合）
function getStatus(a) {
  if (!a.is_active) return { label: '已停用', color: 'bg-slate-700 text-slate-400' }
  const now = Date.now()
  if (a.starts_at && new Date(a.starts_at).getTime() > now) {
    return { label: '排程中', color: 'bg-purple-500/20 text-purple-300' }
  }
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) {
    return { label: '已過期', color: 'bg-slate-700 text-slate-500' }
  }
  return { label: '顯示中', color: 'bg-emerald-500/20 text-emerald-300' }
}

const EMPTY_FORM = {
  title: '',
  content: '',
  kind: 'info',
  target: 'all',
  link_url: '',
  link_text: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
}

export default function AdminAnnouncements() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // null = 不顯示 form / 'new' = 新增 / { id, ... } = 編輯既有
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setList(data || [])
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setEditing('new')
    setErrMsg(null)
  }

  function openEdit(a) {
    setForm({
      title: a.title,
      content: a.content,
      kind: a.kind,
      target: a.target,
      link_url: a.link_url || '',
      link_text: a.link_text || '',
      starts_at: tsToLocalInput(a.starts_at),
      ends_at: tsToLocalInput(a.ends_at),
      is_active: a.is_active,
    })
    setEditing(a)
    setErrMsg(null)
  }

  function closeForm() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrMsg(null)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      setErrMsg('標題與內容為必填')
      return
    }
    setSaving(true)
    setErrMsg(null)
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        kind: form.kind,
        target: form.target,
        link_url: form.link_url.trim() || null,
        link_text: form.link_text.trim() || null,
        starts_at: localInputToIso(form.starts_at),
        ends_at: localInputToIso(form.ends_at),
        is_active: form.is_active,
      }
      if (editing === 'new') {
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
      } else {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editing.id)
        if (error) throw error
      }
      await load()
      closeForm()
    } catch (e) {
      setErrMsg('儲存失敗：' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(a) {
    // 樂觀更新：UI 立刻變、失敗 rollback
    const next = !a.is_active
    setList(prev => prev.map(x => x.id === a.id ? { ...x, is_active: next } : x))
    const { error } = await supabase.from('announcements').update({ is_active: next }).eq('id', a.id)
    if (error) {
      setList(prev => prev.map(x => x.id === a.id ? { ...x, is_active: a.is_active } : x))
      alert('切換失敗：' + error.message)
    }
  }

  async function handleDelete(a) {
    if (!confirm(`確定刪除「${a.title}」？此操作無法還原。`)) return
    const { error } = await supabase.from('announcements').delete().eq('id', a.id)
    if (error) {
      alert('刪除失敗：' + error.message)
      return
    }
    setList(prev => prev.filter(x => x.id !== a.id))
  }

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">站內公告</h1>
              <p className="text-slate-400 text-sm mt-1">
                共 {list.length} 則公告 · 用於發送早鳥倒數、系統維護、新功能等訊息
              </p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-base leading-none">+</span> 新增公告
            </button>
          </div>

          {/* 公告列表 */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-900 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <div className="col-span-5">標題與內容</div>
              <div className="col-span-2">類型 / 對象</div>
              <div className="col-span-2">期間</div>
              <div className="col-span-1">狀態</div>
              <div className="col-span-2 text-right">操作</div>
            </div>

            {loading ? (
              <div className="px-6 py-10 text-center text-slate-500 text-sm">載入中...</div>
            ) : list.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-400 text-sm mb-2">還沒有任何公告</p>
                <p className="text-slate-500 text-xs">點右上「新增公告」開始第一則訊息</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {list.map(a => {
                  const meta = KIND_META[a.kind]
                  const status = getStatus(a)
                  return (
                    <div key={a.id} className="grid grid-cols-12 px-6 py-4 items-start hover:bg-slate-800/50 transition-colors">
                      <div className="col-span-5 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          <p className="text-slate-200 text-sm font-medium truncate">{a.title}</p>
                        </div>
                        <p className="text-slate-500 text-xs line-clamp-2 whitespace-pre-wrap">{a.content}</p>
                        {a.link_url && (
                          <p className="text-orange-400/70 text-xs mt-1 truncate">→ {a.link_text || '了解更多'}：{a.link_url}</p>
                        )}
                      </div>
                      <div className="col-span-2 space-y-1">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium border ${meta.chip}`}>
                          {meta.emoji} {meta.label}
                        </span>
                        <p className="text-slate-500 text-xs">{TARGET_LABEL[a.target]}</p>
                      </div>
                      <div className="col-span-2 text-slate-400 text-xs">
                        <p>從：{a.starts_at ? new Date(a.starts_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '立即'}</p>
                        <p>到：{a.ends_at ? new Date(a.ends_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '無期限'}</p>
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => toggleActive(a)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                            a.is_active
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          }`}
                        >
                          {a.is_active ? '停用' : '啟用'}
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          className="text-xs px-2.5 py-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-lg font-medium transition-colors"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          className="text-xs px-2.5 py-1.5 bg-slate-700 text-slate-400 hover:bg-red-900/40 hover:text-red-400 rounded-lg font-medium transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 新增 / 編輯 modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                <h2 className="text-white text-lg font-semibold">
                  {editing === 'new' ? '新增公告' : '編輯公告'}
                </h2>
                <button onClick={closeForm} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* 標題 */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">標題 *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="例如：早鳥倒數 7 天"
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* 內容 */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">內容 *</label>
                  <textarea
                    rows={4}
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="支援換行。例如：&#10;早鳥首年 NT$990／月優惠剩最後 7 天，前 100 名額度已用 X 名。"
                    className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-y"
                  />
                </div>

                {/* 類型 */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">類型</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(KIND_META).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, kind: key }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.kind === key
                            ? meta.chip + ' border-2'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {meta.emoji} {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 對象 */}
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1.5">顯示對象</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(TARGET_LABEL).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, target: key }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.target === key
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA 連結（選填） */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">CTA 連結（選填）</label>
                    <input
                      type="text"
                      value={form.link_url}
                      onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                      placeholder="/pricing 或 https://..."
                      className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">CTA 文字（選填）</label>
                    <input
                      type="text"
                      value={form.link_text}
                      onChange={e => setForm(f => ({ ...f, link_text: e.target.value }))}
                      placeholder="預設「了解更多」"
                      className="w-full bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* 期間（選填） */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">開始時間（選填）</label>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-slate-500 text-xs mt-1">空白 = 立刻顯示</p>
                  </div>
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">結束時間（選填）</label>
                    <input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                    />
                    <p className="text-slate-500 text-xs mt-1">空白 = 永不過期</p>
                  </div>
                </div>

                {/* 啟用 */}
                <div>
                  <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    儲存後立即啟用（取消勾選 = 草稿，不顯示）
                  </label>
                </div>

                {errMsg && (
                  <div className="px-3 py-2 bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg">
                    {errMsg}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-slate-900">
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-medium rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? '儲存中...' : (editing === 'new' ? '建立公告' : '儲存變更')}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </AdminGuard>
  )
}
