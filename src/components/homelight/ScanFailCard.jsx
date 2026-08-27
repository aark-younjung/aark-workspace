import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { homepageOf } from '../../lib/scanError'
import { logError } from '../../lib/errorLog'
import { getAnonSessionId } from '../../lib/anonSession'

/**
 * 掃描失敗卡（2026-08-27）
 *
 * 取代原本那一行「分析中斷：All fetch rounds timed out——…」。
 * 動機是廣告漏斗：廣告帶進來的陌生人第一次掃描如果撞上暫時性封鎖，舊版給的是一句看不懂的
 * 英文錯誤，那是死路——他跳走，那次點擊的錢就沒了，而且他只會覺得「這工具是壞的」。
 *
 * 這張卡把失敗改成三個出口，由上而下就是成功率排序：
 *   1. 改掃首頁 —— 掃內頁失敗時最可能直接成功的一步（企業站常見：內頁防護嚴、首頁開放）
 *   2. 留 email —— 掃得通的時候通知他（把失敗轉成名單，而不是把人推走）
 *   3. 稍後重試 —— 帶 60 秒倒數，刻意不讓人立刻連打（連打正是觸發對方限流的原因）
 *
 * 網址打錯／404 這種「他自己改一下就好」的情況不收 email（info.userFixable），
 * 收了也沒有意義——那不是我們掃不到，是他貼錯字。
 */
const RETRY_COOLDOWN_S = 60

export default function ScanFailCard({ info, url, onRescan, user }) {
  const [email, setEmail] = useState(user?.email || '')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(RETRY_COOLDOWN_S)

  // 重試倒數：卡片一出現就開始跑，歸零前重試鈕是停用的
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const homeUrl = homepageOf(url)

  const handleNotify = async e => {
    e.preventDefault()
    const addr = email.trim()
    if (!addr || sending) return
    setSending(true)
    const row = {
      email: addr,
      url,
      error_kind: info.kind,
      error_message: info.technical?.slice(0, 500) || null,
      user_id: user?.id || null,
      session_id: getAnonSessionId(),
    }
    const { error } = await supabase.from('scan_leads').insert(row)
    // 表還沒建／RLS 擋住時不能把名單吞掉——退而求其次寫進 error_logs（後台系統監控看得到），
    // 使用者這邊照樣顯示成功：對他來說「我們收到了」是真的，只是落點不同。
    if (error) {
      logError({
        source: 'scan_lead_fallback',
        message: `scan_leads insert failed: ${error.message}`,
        userId: user?.id,
        detail: row,
      })
    }
    setSending(false)
    setSent(true)
  }

  return (
    <section className="hl-fail" role="alert">
      <div className="card">
        <div className="hd">
          <span className="ic" aria-hidden="true">!</span>
          <div>
            <b>{info.title}</b>
            <span className="u">{url}</span>
          </div>
        </div>

        <p className="hint">{info.hint}</p>
        <p className="act">{info.action}</p>

        <div className="ops">
          {/* 改掃首頁：放第一順位，因為它是這幾個出口裡成功率最高的一個 */}
          {homeUrl && (
            <button type="button" className="hl-btn hl-cta" onClick={() => onRescan(homeUrl)}>
              改掃首頁 →
            </button>
          )}
          <button
            type="button"
            className="hl-btn hl-ghost"
            disabled={cooldown > 0}
            onClick={() => onRescan(url)}
            title={cooldown > 0 ? '剛剛才試過，等一下再重試比較容易通' : '再掃一次同一個網址'}
          >
            {cooldown > 0 ? `重試（${cooldown} 秒後可用）` : '重試這個網址'}
          </button>
        </div>

        {/* 使用者自己改網址就能解的情況（打錯字／404）不收 email */}
        {!info.userFixable && (
          sent ? (
            <p className="ok">✓ 收到了。等這個網站掃得通，我們用 {email} 通知你。</p>
          ) : (
            <form className="notify" onSubmit={handleNotify}>
              <label htmlFor="hl-fail-email">留個 email，掃得通的時候通知你</label>
              <div className="row">
                <input
                  id="hl-fail-email" type="email" value={email} required
                  onChange={e => setEmail(e.target.value)}
                  inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="you@company.com" disabled={sending}
                />
                <button type="submit" className="hl-btn hl-cta" disabled={sending}>
                  {sending ? '送出中…' : '通知我'}
                </button>
              </div>
            </form>
          )
        )}
      </div>
    </section>
  )
}
