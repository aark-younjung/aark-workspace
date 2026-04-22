import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
// 暗黑版為現行主視覺；橘白版 Home 已移至 src/pages/_legacy/Home.jsx 保留備查
import HomeDark from './pages/HomeDark'
import Dashboard from './pages/Dashboard'
import SEOAudit from './pages/SEOAudit'
import AEOAudit from './pages/AEOAudit'
import GEOAudit from './pages/GEOAudit'
import EEATAudit from './pages/EEATAudit'
import Showcase from './pages/Showcase'
import Compare from './pages/Compare'
import Login from './pages/Login'
import Register from './pages/Register'
import GoogleAuthCallback from './pages/GoogleAuthCallback'
import AdminSeed from './pages/AdminSeed'
import Pricing from './pages/Pricing'
import Account from './pages/Account'
import FAQ from './pages/FAQ'
import ContentAudit from './pages/ContentAudit'
import GA4Report from './pages/GA4Report'
import GSCReport from './pages/GSCReport'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminWebsites from './pages/admin/AdminWebsites'
import AdminRevenue from './pages/admin/AdminRevenue'

const DARK_CIRCLES = [65, 130, 197, 266, 337, 410, 485, 562, 641, 722, 805, 890, 977, 1066, 1157]

function GlobalDarkBg() {
  return (
    <>
      <div className="fixed inset-0 -z-20" style={{
        background: 'linear-gradient(135deg, #a21540 0%, #6b0e2a 18%, #2a0510 32%, #0a0208 46%, #000000 60%)',
      }} />
      <div className="fixed inset-0 -z-20 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.68' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        opacity: 0.12, mixBlendMode: 'overlay',
      }} />
      <div className="fixed pointer-events-none -z-20 overflow-visible" style={{ left: '72%', top: '8vh', width: 0, height: 0 }}>
        {DARK_CIRCLES.map((r, i) => (
          <div key={i} style={{
            position: 'absolute', left: -r, top: -r,
            width: r * 2, height: r * 2, borderRadius: '50%',
            border: '3px solid #000000',
            opacity: Math.max(0.10, 0.50 - i * 0.025),
          }} />
        ))}
      </div>
    </>
  )
}

function AppInner() {
  const { isDark } = useTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark-theme', isDark)
  }, [isDark])
  return (
    <>
      {isDark && <GlobalDarkBg />}
      <Routes>
        <Route path="/" element={<HomeDark />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/seo-audit/:id" element={<SEOAudit />} />
        <Route path="/aeo-audit/:id" element={<AEOAudit />} />
        <Route path="/geo-audit/:id" element={<GEOAudit />} />
        <Route path="/eeat-audit/:id" element={<EEATAudit />} />
        <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
        <Route path="/admin/seed" element={<AdminSeed />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/account" element={<Account />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/content-audit" element={<ContentAudit />} />
        <Route path="/ga4-report/:id" element={<GA4Report />} />
        <Route path="/gsc-report/:id" element={<GSCReport />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/websites" element={<AdminWebsites />} />
        <Route path="/admin/revenue" element={<AdminRevenue />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppInner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
