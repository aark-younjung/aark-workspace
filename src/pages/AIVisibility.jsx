import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * AI 曝光監測 — 品牌列表頁
 * 使用者可在此新增要監測的品牌，並點擊進入各品牌的監測儀表板。
 * 資料表：aivis_brands（RLS 以 user_id 隔離）。
 */
export default function AIVisibility() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({ name: '', domain: '', industry: '', description: '' })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { state: { from: '/ai-visibility' } })
      return
    }
    fetchBrands()
  }, [user, authLoading])

  const fetchBrands = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('aivis_brands')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setBrands(data || [])
    } catch (err) {
      console.error('fetchBrands error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('aivis_brands')
        .insert([{
          user_id: user.id,
          name: form.name.trim(),
          domain: form.domain.trim() || null,
          industry: form.industry.trim() || null,
          description: form.description.trim() || null,
        }])
        .select()
        .single()
      if (error) throw error
      setForm({ name: '', domain: '', industry: '', description: '' })
      setShowForm(false)
      navigate(`/ai-visibility/${data.id}`)
    } catch (err) {
      console.error('create brand error:', err)
      alert(`新增失敗：${err.message || '請稍後再試'}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`確定要刪除「${name}」嗎？所有相關監測資料將一併移除。`)) return
    try {
      const { error } = await supabase.from('aivis_brands').delete().eq('id', id)
      if (error) throw error
      setBrands(brands.filter(b => b.id !== id))
    } catch (err) {
      console.error('delete brand error:', err)
      alert(`刪除失敗：${err.message || '請稍後再試'}`)
    }
  }

  return (
    <>
      {/* 青綠漸層背景：覆蓋在原 HomeDark 紅色背景之上，僅作用於 aivis 頁面 */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1,
        background: `linear-gradient(155deg, #18c590 0%, #0d7a58 18%, #084773 32%, #011520 52%, #000000 72%)`,
      }} />
    <div className="min-h-screen">
      {/* 頂部導覽列（返回首頁） */}
      <header className="max-w-6xl mx-auto px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首頁
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        {/* 標題區塊 */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-block px-3 py-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 rounded-full text-xs font-medium text-emerald-300">
              NEW · Phase 1
            </span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">AI 曝光監測</h1>
          <p className="text-white/70 text-base max-w-2xl leading-relaxed">
            追蹤你的品牌在 ChatGPT、Claude、Perplexity、Gemini 等生成式 AI 中的曝光表現。
            量化「被 AI 主動推薦」的真實數據，找出流失的商業機會。
          </p>
        </div>

        {/* 操作列：新增按鈕 */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-white/60">
            {loading ? '載入中…' : `共 ${brands.length} 個追蹤品牌`}
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            {showForm ? '取消' : '＋ 新增品牌'}
          </button>
        </div>

        {/* 新增表單（展開/收合） */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="mb-8 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                品牌名稱 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="例：優勢方舟數位行銷"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">官網網域</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={e => setForm({ ...form, domain: e.target.value })}
                  placeholder="例：aark-workspace.vercel.app"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">產業分類</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={e => setForm({ ...form, industry: e.target.value })}
                  placeholder="例：數位行銷 / SaaS / 電商"
                  className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">品牌簡介</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="一句話描述品牌，供後續 AI 提示詞生成使用"
                className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '建立中…' : '建立並進入監測'}
              </button>
            </div>
          </form>
        )}

        {/* 品牌卡片清單 */}
        {loading ? (
          <div className="text-center py-20 text-white/50">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mb-3" />
            <p className="text-sm">載入中…</p>
          </div>
        ) : brands.length === 0 ? (
          /* 空狀態：尚未建立任何品牌 */
          <div className="py-16 text-center bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-white mb-2">尚未追蹤任何品牌</h3>
            <p className="text-white/60 text-sm max-w-md mx-auto mb-6">
              點擊上方「＋ 新增品牌」開始你的第一個監測任務。系統將持續追蹤品牌在主要 AI 平台的曝光狀況。
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-medium text-sm transition-all"
            >
              ＋ 新增第一個品牌
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {brands.map(brand => (
              <div
                key={brand.id}
                className="group p-6 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-emerald-400/40 rounded-2xl transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/ai-visibility/${brand.id}`}
                      className="block text-lg font-semibold text-white hover:text-emerald-300 truncate"
                    >
                      {brand.name}
                    </Link>
                    {brand.domain && (
                      <p className="text-xs text-white/50 mt-1 truncate">{brand.domain}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(brand.id, brand.name)}
                    className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 text-xs transition-opacity"
                    title="刪除品牌"
                  >
                    刪除
                  </button>
                </div>
                {brand.industry && (
                  <span className="inline-block px-2 py-0.5 bg-white/10 rounded-md text-xs text-white/70 mb-3">
                    {brand.industry}
                  </span>
                )}
                {brand.description && (
                  <p className="text-sm text-white/60 line-clamp-2 mb-3">{brand.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-xs text-white/40">
                    {new Date(brand.created_at).toLocaleDateString('zh-TW')} 建立
                  </span>
                  <Link
                    to={`/ai-visibility/${brand.id}`}
                    className="text-xs text-emerald-300 hover:text-emerald-200 font-medium"
                  >
                    進入監測 →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
    </>
  )
}
