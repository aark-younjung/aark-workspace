import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initPixel } from './lib/pixel'

// Meta Pixel（FB 廣告轉換追蹤）— 沒設 VITE_META_PIXEL_ID 時為 no-op
initPixel()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
