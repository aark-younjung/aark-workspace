/**
 * IsolatedTurnstile — React.memo 包裝的 Cloudflare Turnstile widget
 *
 * 為什麼需要這個獨立元件：
 *   無痕模式 / 互動式 challenge 情境下，父元件每次 input onChange 觸發 re-render，
 *   即使所有 props 都用穩定 reference（useCallback + 模組常數），Turnstile widget
 *   還是會跟著 re-render，導致 Cloudflare 重新跑 challenge → 打字過程被打斷。
 *
 * 修法：用 React.memo 把整個 Turnstile 隔離在子元件，所有 props 都從外部傳入。
 *   只要傳入的 callbacks（useCallback）跟 siteKey 不變，整個子元件根本不會 re-render。
 *
 * 使用方式（父元件必須用 useCallback 傳 callbacks，否則 memo 失效）：
 *   ```jsx
 *   const onSuccess = useCallback((t) => setToken(t), [])
 *   const onExpire = useCallback(() => setToken(''), [])
 *   const onError = useCallback(() => setError(true), [])
 *   <IsolatedTurnstile
 *     siteKey={SITE_KEY}
 *     onSuccess={onSuccess}
 *     onExpire={onExpire}
 *     onError={onError}
 *   />
 *   ```
 */
import { memo, forwardRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'

// options 物件用模組常數定義 — 進一步杜絕 reference 不穩
//
// 2026-05-25 update：execute 選項實測仍會跑背景指紋分析中斷用戶打字。
// 改用「conditional mount」策略：父元件用 {flag && <IsolatedTurnstile />} 控制
// 真正掛載時機 — Turnstile script 在打字前根本沒載入，徹底零中斷。
// Widget mount 後直接執行 challenge（render 模式），靠 onSuccess 拿 token。
const DEFAULT_OPTIONS = {
  theme: 'dark',
  size: 'normal',
}

// forwardRef 把 ref 直透到底層 Turnstile widget — 父元件可呼叫 .reset() / .execute()
// 這對 Login 失敗後 reset widget 取新 token 必要
const TurnstileBase = forwardRef(function TurnstileBase(
  { siteKey, onSuccess, onExpire, onError, options }, ref
) {
  return (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      onSuccess={onSuccess}
      onExpire={onExpire}
      onError={onError}
      options={options || DEFAULT_OPTIONS}
    />
  )
})

// memo 包裝 — 所有 props 都用穩定 reference 時這個 component 完全不會 re-render
// 父元件就算 100 次 re-render，這裡也只 render 一次（mount 時）
export default memo(TurnstileBase)
