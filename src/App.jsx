import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dark" element={<HomeDark />} />
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
          {/* 後臺管理 */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/websites" element={<AdminWebsites />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
