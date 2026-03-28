import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import AEOAudit from './pages/AEOAudit'
import GEOAudit from './pages/GEOAudit'
import EEATAudit from './pages/EEATAudit'
import Showcase from './pages/Showcase'
import Compare from './pages/Compare'
import Login from './pages/Login'
import Register from './pages/Register'

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
          <Route path="/aeo-audit/:id" element={<AEOAudit />} />
          <Route path="/geo-audit/:id" element={<GEOAudit />} />
          <Route path="/eeat-audit/:id" element={<EEATAudit />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
