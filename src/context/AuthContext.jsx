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

  const fetchProfile = async (userId) => {
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (existing) {
        setProfile(existing)
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

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, name, marketingConsent = false) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
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

  const isPro = profile?.is_pro || false
  const isAdmin = profile?.is_admin || false
  const userName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || ''

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPro, isAdmin, userName, signIn, signUp, signOut, signInWithGoogle, refreshProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
