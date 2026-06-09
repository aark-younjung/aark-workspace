/**
 * AddClientModal — Agency 新增代管客戶站（2026-06-10）
 *
 * 收兩個必填欄位：
 *   1. client_alias — 客戶別名（內部識別用、不用是真實品牌名）
 *      e.g.「金鉑先生」「青山空間設計」「客戶 A」
 *   2. url — 客戶網站
 *
 * insert 進 websites 表時設定：
 *   - user_id = agency 自己（代管模式 B、客戶不需自己帳號）
 *   - agency_managed_by = agency 自己（用來區分「自己網站」vs「代管客戶站」）
 *   - client_alias = 客戶別名
 *
 * 不在這裡跑首次檢測 — 用戶從列表進 Dashboard 後再觸發、避免 modal 等太久
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { normalizeUrl } from '../../lib/url'

export default function AddClientModal({ open, onClose, onAdded }) {
  const { user, siteLimit } = useAuth()
  const [clientAlias, setClientAlias] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    setClientAlias('')
    setUrl('')
    setErr('')
  }, [open])

  async function handleSubmit() {
    if (submitting) return
    setErr('')
    const alias = clientAlias.trim()
    const rawUrl = url.trim()
    if (!alias) { setErr('請填客戶別名'); return }
    if (!rawUrl) { setErr('請填客戶網站 URL'); return }

    // URL 格式驗證 — normalizeUrl 會補 https://、把多種變體統一
    let cleanUrl
    try {
      cleanUrl = normalizeUrl(rawUrl)
      new URL(cleanUrl)  // 確認可被 URL constructor parse
    } catch {
      setErr('URL 格式不正確、請輸入完整網址（例：https://example.com）')
      return
    }

    setSubmitting(true)
    try {
      // 先檢查站數上限
      const { count } = await supabase
        .from('websites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      if (count >= siteLimit) {
        setErr(`已達方案站數上限 ${siteLimit} 個、請升級或移除舊站`)
        setSubmitting(false)
        return
      }

      // 插入 websites — 代管模式（user_id + agency_managed_by 都是 agency 自己）
      const { data, error } = await supabase
        .from('websites')
        .insert([{
          url: cleanUrl,
          name: new URL(cleanUrl).hostname,
          user_id: user.id,
          agency_managed_by: user.id,
          client_alias: alias,
        }])
        .select()
        .single()

      if (error) throw error

      onAdded?.(data)
      onClose()
    } catch (e) {
      console.error('AddClient failed:', e)
      if (e?.code === '23505') {
        setErr('這個網址已經在你的客戶清單裡了')
      } else {
        setErr('新增失敗、請稍後再試')
      }
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
        className="relative max-w-md w-full rounded-2xl p-7"
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

        {/* Header */}
        <div className="mb-5">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-2xl font-bold text-white mb-1">新增代管客戶站</h3>
          <p className="text-sm text-white/55 leading-relaxed">
            把客戶網站加進你的工作區、可獨立追蹤分數、產出白標 PDF 報告。
            客戶不需要自己的 Aark 帳號。
          </p>
        </div>

        {/* 表單 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              客戶別名 <span className="text-emerald-300">*</span>
            </label>
            <input
              type="text"
              value={clientAlias}
              onChange={e => setClientAlias(e.target.value)}
              placeholder="例：金鉑先生 / 青山空間設計 / 客戶 A"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              autoFocus
            />
            <p className="mt-1 text-sm text-white/40">內部識別用、列表顯示這個名字、不會傳給客戶</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              客戶網站 URL <span className="text-emerald-300">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://kimbo3899.com.tw"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 font-mono"
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
            disabled={submitting || !clientAlias.trim() || !url.trim()}
            className="flex-1 px-5 py-3 rounded-xl font-bold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                新增中…
              </>
            ) : (
              <>+ 新增客戶站</>
            )}
          </button>
        </div>

        {/* 小提醒 */}
        <p className="mt-5 pt-4 border-t border-white/8 text-sm text-white/40 leading-relaxed">
          💡 新增後到列表點該客戶站、進 Dashboard 觸發首次檢測（5 訊號層、約 30 秒）。
        </p>
      </div>
    </div>
  )
}
