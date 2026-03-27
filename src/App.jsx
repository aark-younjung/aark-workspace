import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import AEOAudit from './pages/AEOAudit'
import GEOAudit from './pages/GEOAudit'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/aeo-audit/:id" element={<AEOAudit />} />
        <Route path="/geo-audit/:id" element={<GEOAudit />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
