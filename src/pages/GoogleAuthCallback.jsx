import { useEffect, useState } from 'react'
import { storeToken } from '../services/googleAuth'

/**
 * Google OAuth Implicit Flow 回調頁面
 * Google 會帶著 access_token 重導向到此頁面（hash fragment）
 */
export default function GoogleAuthCallback() {
  const [status, setStatus] = useState('processing')

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const expiresIn = parseInt(params.get('expires_in') || '3600')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error }, window.location.origin)
        setTimeout(() => window.close(), 1500)
      }
      return
    }

    if (accessToken) {
      storeToken(accessToken, expiresIn)
      setStatus('success')
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, window.location.origin)
        setTimeout(() => window.close(), 1000)
      } else {
        // 若不是彈窗（直接跳轉），導回首頁
        setTimeout(() => { window.location.href = '/' }, 1500)
      }
    } else {
      setStatus('error')
    }
  }, [])

  return (
    <div className="min-h-screen  flex items-center justify-center">
      <div className="text-center bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-sm w-full mx-4">
        {status === 'processing' && (
          <>
            <div className="text-4xl mb-4 animate-spin">⏳</div>
            <p className="text-slate-600">正在完成 Google 授權...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <p className="text-slate-700 font-semibold">授權成功！</p>
            <p className="text-slate-400 text-sm mt-2">視窗即將關閉...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <p className="text-slate-700 font-semibold">授權失敗</p>
            <p className="text-slate-400 text-sm mt-2">請關閉此視窗後重試</p>
          </>
        )}
      </div>
    </div>
  )
}
