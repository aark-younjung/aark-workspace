import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
