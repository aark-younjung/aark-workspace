import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AdminGuard({ children }) {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    // 未登入：導去登入頁，登入後自動回到原本要去的後台路徑
    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
      return
    }
    // 已登入但非管理員：彈回首頁
    if (!isAdmin) {
      navigate('/', { replace: true })
    }
  }, [user, isAdmin, loading, navigate, location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!user || !isAdmin) return null

  return children
}
