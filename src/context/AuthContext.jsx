import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 取得初始 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // 監聽 auth 狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Lazy expiry — profile 載入時若 is_trial=true 但 trial_ends_at 已過，
  // 立刻把 is_pro/is_trial 設回 false 並寫回 DB。cron 萬一沒跑時的安全網。
  const expireIfNeeded = async (row) => {
    if (!row?.is_trial || !row?.trial_ends_at) return row
    const endsAt = new Date(row.trial_ends_at).getTime()
    if (endsAt > Date.now()) return row
    // 已過期，寫回 DB（不阻塞 UI；失敗就下次 load 再試）
    const { data: updated } = await supabase
      .from('profiles')
      .update({ is_trial: false, is_pro: false })
      .eq('id', row.id)
      .select()
      .single()
    return updated || { ...row, is_trial: false, is_pro: false }
  }

  const fetchProfile = async (userId) => {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (existing) {
        const checked = await expireIfNeeded(existing)
        setProfile(checked)
      } else {
        // Google OAuth 首次登入時自動建立 profile
        const { data: { user } } = await supabase.auth.getUser()
        const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''
        const { data: created } = await supabase
          .from('profiles')
          .insert([{ id: userId, email: user?.email || '', name, is_pro: false }])
          .select()
          .single()
        setProfile(created)
      }
    } catch (e) {
      console.error('fetchProfile error:', e)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password, captchaToken) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })
    return { data, error }
  }

  const signUp = async (email, password, name, marketingConsent = false, captchaToken) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, ...(captchaToken ? { captchaToken } : {}) }
    })
    if (data.user && !error) {
      await supabase.from('profiles').insert([{
        id: data.user.id,
        email,
        name,
        is_pro: false,
        marketing_consent: marketingConsent,
      }])
    }
    return { data, error }
  }

  const signInWithGoogle = async (from = '/') => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + from },
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  // 啟動 7 天免費試用 — 呼叫 Supabase RPC start_pro_trial（SECURITY DEFINER，
  // 從 auth.uid() 拿用戶 id 不接受前端傳值）。成功後重新拉 profile 讓 UI 即時反應。
  // 回傳 { ok: true, trial_ends_at } 或 { ok: false, error: 'not_authenticated' | 'already_trialed' | 'already_pro' | 'rpc_failed' }
  const startTrial = async () => {
    if (!user) return { ok: false, error: 'not_authenticated' }
    const { data, error } = await supabase.rpc('start_pro_trial')
    if (error) {
      console.error('start_pro_trial RPC error:', error)
      return { ok: false, error: 'rpc_failed' }
    }
    if (data?.ok) {
      await fetchProfile(user.id)
    }
    return data || { ok: false, error: 'rpc_failed' }
  }

  const isPro = profile?.is_pro || false
  const isAdmin = profile?.is_admin || false
  const isTrial = profile?.is_trial || false
  const trialEndsAt = profile?.trial_ends_at || null
  const hasTrialedBefore = !!profile?.trial_started_at
  // 試用剩餘天數（向上取整 — 剩 6.2 天顯示「剩 7 天」更友善）；未在試用回 null
  const trialDaysRemaining = isTrial && trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null
  const userName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      isPro, isAdmin, userName,
      isTrial, trialEndsAt, trialDaysRemaining, hasTrialedBefore,
      signIn, signUp, signOut, signInWithGoogle, refreshProfile, startTrial,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
