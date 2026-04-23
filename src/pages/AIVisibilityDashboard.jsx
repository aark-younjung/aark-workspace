import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * AI 曝光監測 — 單一品牌儀表板
 * Phase 1：僅顯示品牌基本資訊 + 尚未開始抓取的空狀態。
 * Phase 2 將接上 aivis_prompts、aivis_responses、aivis_mentions 三表，顯示實際監測數據。
 */
export default function AIVisibilityDashboard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [brand, setBrand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { state: { from: `/ai-visibility/${id}` } })
      return
    }
    fetchBrand()
  }, [id, user, authLoading])

  const fetchBrand = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('aivis_brands')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setNotFound(true)
      } else {
        setBrand(data)
      }
    } catch (err) {
      console.error('fetchBrand error:', err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white/60">
          <div className="inline-block animate-spin w-10 h-10 border-2 border-white/20 border-t-white rounded-full mb-4" />
          <p className="text-sm">載入中…</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-white mb-2">找不到這個品牌</h2>
          <p className="text-white/60 text-sm mb-6">可能已被刪除，或你沒有權限檢視。</p>
          <Link
            to="/ai-visibility"
            className="inline-block px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            返回品牌列表
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6">
        <Link to="/ai-visibility" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回品牌列表
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-16">
        {/* 品牌資訊 Header */}
        <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold text-white truncate">{brand.name}</h1>
                {brand.industry && (
                  <span className="px-2.5 py-1 bg-white/10 rounded-md text-xs text-white/70">
                    {brand.industry}
                  </span>
                )}
              </div>
              {brand.domain && (
                <p className="text-sm text-white/50 mb-2">{brand.domain}</p>
              )}
              {brand.description && (
                <p className="text-sm text-white/70 leading-relaxed">{brand.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* 四大指標卡（空狀態預覽） */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCardPlaceholder
            icon="📣"
            label="品牌提及率"
            hint="Brand Mention Rate"
            description="在 AI 回答中被提到的比例"
          />
          <MetricCardPlaceholder
            icon="🔗"
            label="引用率"
            hint="Citation Rate"
            description="AI 引用你網站作為來源的比例"
          />
          <MetricCardPlaceholder
            icon="⚖️"
            label="模型占有率"
            hint="Share of Model"
            description="相對於競品，你在 AI 中的聲量佔比"
          />
          <MetricCardPlaceholder
            icon="💰"
            label="營收曝光落差"
            hint="Revenue Visibility Gap"
            description="因曝光不足估算的潛在損失"
          />
        </div>

        {/* 空狀態：尚未開始抓取 */}
        <div className="py-16 px-6 text-center bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-400/20 rounded-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/30 rounded-full text-xs font-medium text-amber-200 mb-4">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            Phase 1 · 資料收集中
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3">監測引擎尚未啟動</h3>
          <p className="text-white/70 text-sm max-w-xl mx-auto mb-6 leading-relaxed">
            Phase 1 已完成品牌建檔。下一階段將接入 Claude API 執行實際抓取，
            預計 48 小時內產生第一份報告。當前為基礎架構驗證階段。
          </p>
          <div className="inline-block text-left text-sm text-white/60 space-y-2 p-5 bg-white/5 border border-white/10 rounded-xl">
            <p className="font-semibold text-white/80 mb-2">後續啟用順序：</p>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-200 text-xs flex items-center justify-center">✓</span>
              <span>Phase 1：品牌建檔 + 儀表板骨架</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center">2</span>
              <span>Phase 2：Prompt 管理 + Claude 手動抓取</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center">3</span>
              <span>Phase 3：排程 Cron + 自動週期抓取</span>
            </div>
            <div className="flex items-center gap-2 opacity-60">
              <span className="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center">4</span>
              <span>Phase 4：競品比較 + 趨勢圖 + 營收估算</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/** 指標卡占位：Phase 2 起會接真實數據 */
function MetricCardPlaceholder({ icon, label, hint, description }) {
  return (
    <div className="p-5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">{hint}</p>
        </div>
      </div>
      <div className="text-3xl font-bold text-white/20 mb-1">--</div>
      <p className="text-xs text-white/50 leading-relaxed">{description}</p>
    </div>
  )
}
