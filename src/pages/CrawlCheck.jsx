/**
 * /crawl-check 落地頁 — 「你的網站被 AI 看得到嗎？」單一痛點檢測頁
 *
 * 用途：粉專廣告 / Threads 連結 / 社群文 anti-bot 痛點導流落地頁
 * 設計原則：
 *   - 視覺單一焦點：沒有 nav 雜訊、沒有其他功能干擾、不見 TOP 8 / 跑馬燈
 *   - 不需登入即可測試（降低 friction）
 *   - 真實資料：呼叫 /api/fetch-url 4 輪 fallback，動畫顯示結果
 *   - CTA 單一：看完整 7 項報告 → 免費註冊
 *
 * ⚠️ 視覺現為「功能完整、樣式平實」的骨架版，待 Claude Design 接手做視覺強化。
 * 動 API call / state shape / 結論判定邏輯前先看 docs/crawl-check-handoff.md
 *
 * 4 輪 fallback 對應 fetch-url.js：
 *   Round 1: Googlebot UA（多數 SEO-friendly 站歡迎）
 *   Round 2: Chrome + Sec-Ch-Ua 完整指紋（模擬真人瀏覽器）
 *   Round 3: Bingbot UA（Cloudflare 部分白名單只放 Bingbot）
 *   Round 4: AllOrigins proxy（不同 IP 段繞 Cloudflare）
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { T } from '../styles/v2-tokens'
import { normalizeUrl } from '../lib/url'

// 4 輪 fallback 的呈現用元資料 — Claude Design 可在這層改文案 / 加 icon
const ROUNDS = [
  { id: 'r1', ua: 'Googlebot',     label: 'Googlebot UA',              hint: 'Google 搜尋引擎爬蟲身份' },
  { id: 'r2', ua: 'Chrome',        label: 'Chrome + 完整指紋',         hint: '模擬真人瀏覽器（含 Sec-Ch-Ua 指紋頭）' },
  { id: 'r3', ua: 'Bingbot',       label: 'Bingbot UA',                hint: 'Bing 搜尋引擎爬蟲身份' },
  { id: 'r4', ua: 'AllOrigins',    label: 'AllOrigins proxy',          hint: '第三方 IP 出口繞 Cloudflare' },
]

// 結論狀態判定 — 五種：clean / ssl / ua / proxy / blocked / network_error
// Claude Design 可改文案/顏色，但「judgement key 字串」維持不變（給內部 routing 用）
const VERDICTS = {
  clean: {
    level: 'excellent',
    color: T.pass,
    icon: '✅',
    title: '完全開放',
    summary: '你的網站對所有 AI 爬蟲都友善，目前沒有 anti-bot 阻擋',
    aiImpact: 'ChatGPTBot / ClaudeBot / PerplexityBot 等 AI 引擎都能順利抓取',
    riskLevel: 0,
  },
  ssl: {
    level: 'fair',
    color: T.warn,
    icon: '🔒',
    title: 'SSL 憑證鏈不完整',
    summary: '我們在 Round 1 必須放寬 SSL 驗證才能連線 — 嚴格爬蟲可能直接拒絕',
    aiImpact: '部分嚴格驗證 SSL 鏈的 AI 引擎可能跳過你的網站',
    riskLevel: 1,
  },
  ua: {
    level: 'fair',
    color: T.warn,
    icon: '🟡',
    title: '中等嚴格 anti-bot',
    summary: 'Googlebot UA 被擋，但 Chrome 或 Bingbot 身份能進。anti-bot 設定偏嚴',
    aiImpact: 'Google AI 可能 OK，但 ChatGPTBot / PerplexityBot 等驗證 IP 段較嚴的 AI 引擎可能仍抓不到',
    riskLevel: 2,
  },
  proxy: {
    level: 'poor',
    color: T.orange,
    icon: '🟠',
    title: '嚴格 anti-bot',
    summary: '3 種爬蟲身份全被擋，只有透過第三方 proxy 繞過 IP 限制才進得去',
    aiImpact: 'ChatGPTBot / ClaudeBot / PerplexityBot 等 AI 引擎大概率抓不到 — 你在 AI 答案中可能被忽略',
    riskLevel: 3,
  },
  blocked: {
    level: 'bad',
    color: T.fail,
    icon: '🔴',
    title: '對 AI 完全隱形',
    summary: '4 種爬蟲身份全部被擋。Cloudflare / WAF anti-bot 鎖極嚴',
    aiImpact: '所有主流 AI 引擎都抓不到你 — 用戶問 AI「推薦哪一家」時你絕對不會被列出',
    riskLevel: 4,
  },
  network_error: {
    level: 'unknown',
    color: T.textMid,
    icon: '⚠️',
    title: '連線失敗',
    summary: '我們連網站都摸不到 — 可能網址錯、伺服器掛了、或 DNS 問題',
    aiImpact: '無法判斷 AI 引擎能不能抓取（先確認網址正確並重試）',
    riskLevel: -1,
  },
}

/**
 * 從 fetch-url API 回應的 4 個旗標反推 4 輪各自的結果
 * 因為 fetch-url 不回傳 per-round log，只能從旗標組合反推
 * （API 重構成 per-round log 是未來 nice-to-have，這版用 inference）
 *
 * 4 旗標組合 → verdict + 4 輪狀態：
 *   success && all-false                → clean   → R1=✓ pass，R2~4 skip
 *   success && sslFallback              → ssl     → R1=✓ ssl-pass，R2~4 skip
 *   success && uaFallback && !proxy     → ua      → R1=✗ 403，R2=✓ pass，R3~4 skip
 *                                                   （無法區分 R2 還是 R3 過、預設算 R2，是 Chrome 較常見的成功 case）
 *   success && proxyFallback            → proxy   → R1~3=✗ 403，R4=✓ pass
 *   !success && antiBotBlocked          → blocked → R1~4 全 ✗
 *   !success && !antiBotBlocked         → network_error
 */
function deriveRoundStates(apiResponse) {
  const { success, sslFallback, uaFallback, proxyFallback, antiBotBlocked, status } = apiResponse

  // network_error：fetch-url 整個 throw 或回非 4xx/5xx 標準錯
  if (!success && !antiBotBlocked) {
    return {
      verdict: 'network_error',
      rounds: ROUNDS.map(r => ({ ...r, status: 'error', detail: '連線失敗' })),
    }
  }

  // blocked：4 輪全擋
  if (antiBotBlocked) {
    return {
      verdict: 'blocked',
      rounds: ROUNDS.map(r => ({ ...r, status: 'fail', detail: 'HTTP 403 被擋' })),
    }
  }

  // clean / ssl：Round 1 直接過
  if (success && !uaFallback && !proxyFallback) {
    const verdict = sslFallback ? 'ssl' : 'clean'
    const r1Detail = sslFallback ? '需放寬 SSL 驗證才通過' : 'HTTP 200 通過'
    return {
      verdict,
      rounds: ROUNDS.map((r, i) =>
        i === 0
          ? { ...r, status: sslFallback ? 'warn' : 'pass', detail: r1Detail }
          : { ...r, status: 'skip', detail: '前輪已通過、不需嘗試' }
      ),
    }
  }

  // proxy：Round 4 才過
  if (success && proxyFallback) {
    return {
      verdict: 'proxy',
      rounds: ROUNDS.map((r, i) => {
        if (i < 3) return { ...r, status: 'fail', detail: 'HTTP 403 被擋' }
        return { ...r, status: 'pass', detail: '透過第三方 proxy 出口成功' }
      }),
    }
  }

  // ua：Round 2 或 3 過 — 無法區分，預設算 R2（Chrome 較常見的 case）
  if (success && uaFallback) {
    return {
      verdict: 'ua',
      rounds: ROUNDS.map((r, i) => {
        if (i === 0) return { ...r, status: 'fail', detail: 'HTTP 403 被擋' }
        if (i === 1) return { ...r, status: 'pass', detail: '瀏覽器指紋身份通過' }
        return { ...r, status: 'skip', detail: '前輪已通過、不需嘗試' }
      }),
    }
  }

  // fallback fallback（理論上不會走到，但保險）
  return {
    verdict: 'network_error',
    rounds: ROUNDS.map(r => ({ ...r, status: 'error', detail: '無法判斷' })),
  }
}

/**
 * 動畫式跑 4 輪 — 每輪固定停留時間，看起來像「即時掃描」
 * Claude Design 可改 STEP_DELAY 調節奏，或加 sound effect、glitch transition
 */
const STEP_DELAY = 600  // 每行 log 出現的間隔（ms）

export default function CrawlCheck() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [animatedRounds, setAnimatedRounds] = useState([])  // 動畫中累積的 round result
  const [result, setResult] = useState(null)                // { verdict, rounds, apiResponse }
  const [errorMsg, setErrorMsg] = useState(null)
  const timersRef = useRef([])

  // 清掉 pending timers（重新掃描或卸載時）
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  async function handleScan(e) {
    e?.preventDefault()
    if (!url || scanning) return

    // Reset
    setScanning(true)
    setResult(null)
    setErrorMsg(null)
    setAnimatedRounds([])
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const cleanUrl = normalizeUrl(url)
    if (!cleanUrl) {
      setErrorMsg('網址格式錯誤 — 請複製瀏覽器網址列的完整網址再貼上')
      setScanning(false)
      return
    }

    try {
      // 呼叫 fetch-url 拿 4 旗標
      const apiResp = await fetch(`/api/fetch-url?url=${encodeURIComponent(cleanUrl)}`)
      const data = await apiResp.json()
      // 統一加上 success 旗標讓 deriveRoundStates 好判
      const normalized = { success: apiResp.ok, ...data }
      const derived = deriveRoundStates(normalized)

      // 動畫式逐輪顯示 — 每輪 STEP_DELAY ms 後 append
      derived.rounds.forEach((round, i) => {
        const t = setTimeout(() => {
          setAnimatedRounds(prev => [...prev, round])
          // 跑完最後一輪，揭曉結論
          if (i === derived.rounds.length - 1) {
            const t2 = setTimeout(() => {
              setResult({ ...derived, apiResponse: normalized })
              setScanning(false)
            }, STEP_DELAY)
            timersRef.current.push(t2)
          }
        }, (i + 1) * STEP_DELAY)
        timersRef.current.push(t)
      })
    } catch (err) {
      console.error('Crawl-check scan failed:', err)
      setErrorMsg('掃描失敗，請稍後重試')
      setScanning(false)
    }
  }

  const verdict = result ? VERDICTS[result.verdict] : null

  return (
    <div style={{ minHeight: '100vh', color: T.text, fontFamily: T.font }}>
      {/* DESIGN: minimal header — 只放品牌跟登入連結，不放完整 nav */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 10,
      }}>
        <Link to="/" style={{ color: T.text, textDecoration: 'none', fontWeight: 700 }}>
          AI 雷達
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" style={{ color: T.textMid, textDecoration: 'none', fontSize: 14 }}>登入</Link>
          <Link to="/register" style={{ color: T.text, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>免費註冊</Link>
        </div>
      </header>

      {/* 主要區塊 — Claude Design 接手後可加 hero 背景、雷達動畫、漸層等 */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 96px' }}>
        {/* DESIGN: Hero — 痛點問句 + 副標 */}
        <section style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.3, marginBottom: 12 }}>
            你的網站，被 ChatGPT 看得到嗎？
          </h1>
          <p style={{ color: T.textMid, fontSize: 15, lineHeight: 1.6 }}>
            想查 AI 機器人來過你的網站幾次？先確認它<strong style={{ color: T.text }}>進不進得來</strong>——被擋在門外的網站，log 永遠是 0。
            <br />30 秒模擬 4 種爬蟲身份，看 anti-bot 設定有沒有把 AI 爬蟲一起擋掉。
          </p>
        </section>

        {/* URL 輸入框 */}
        <form onSubmit={handleScan} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="輸入網址，例如 example.com"
              disabled={scanning}
              style={{
                flex: 1, minWidth: 240,
                padding: '14px 18px', fontSize: 15,
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${T.cardBorder}`,
                borderRadius: T.rM, color: T.text,
                outline: 'none', fontFamily: T.font,
              }}
            />
            <button
              type="submit"
              disabled={!url || scanning}
              style={{
                padding: '14px 28px', fontSize: 15, fontWeight: 700,
                background: scanning ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${T.orange}, #f59e0b)`,
                color: 'white', border: 'none', borderRadius: T.rM,
                cursor: scanning ? 'wait' : 'pointer',
                opacity: !url ? 0.5 : 1,
              }}
            >
              {scanning ? '掃描中...' : '開始檢測'}
            </button>
          </div>
          {errorMsg && (
            <p style={{ color: T.fail, fontSize: 14, marginTop: 10 }}>⚠️ {errorMsg}</p>
          )}
        </form>

        {/* DESIGN: 終端機 log — 這塊是視覺主角，建議：
            - monospace 字型、深底框
            - 每行出現用 slide-in / fade-in 動畫
            - status icon 用 emoji 或自訂 SVG
            - 可考慮加 typing effect、glitch、scanline overlay
            - 高度建議固定避免 scan 過程中跳版面 */}
        {(animatedRounds.length > 0 || scanning) && (
          <section style={{
            background: 'rgba(0,0,0,0.55)',
            border: `1px solid ${T.cardBorder}`,
            borderRadius: T.rL,
            padding: 20, marginBottom: 24,
            fontFamily: T.mono, fontSize: 14,
          }}>
            <div style={{ color: T.textMid, marginBottom: 12, fontSize: 14, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              ── 4 輪爬蟲身份模擬 ──
            </div>
            {animatedRounds.map((r, i) => (
              <div key={r.id} style={{ marginBottom: 10, lineHeight: 1.6 }}>
                <div>
                  <span style={{ color: T.textLow }}>[Round {i + 1}]</span>{' '}
                  <span style={{ color: T.text }}>嘗試 {r.label}</span>{' '}
                  <span style={{ color: statusColor(r.status) }}>{statusBadge(r.status)}</span>
                </div>
                <div style={{ color: T.textMid, paddingLeft: 16, fontSize: 14 }}>
                  {r.detail}
                </div>
                <div style={{ color: T.textLow, paddingLeft: 16, fontSize: 14 }}>
                  {r.hint}
                </div>
              </div>
            ))}
            {scanning && animatedRounds.length < ROUNDS.length && (
              <div style={{ color: T.textLow, paddingLeft: 0 }}>
                <span style={{ animation: 'blink 1s infinite' }}>▊</span>{' '}
                嘗試下一輪...
              </div>
            )}
          </section>
        )}

        {/* DESIGN: 結論卡 — 視覺重點，建議大標題 + 色塊強烈、icon 加大、加進度條/儀表板感
            5 種狀態（clean / ssl / ua / proxy / blocked / network_error）各自配色見 VERDICTS */}
        {result && verdict && (
          <section style={{
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${verdict.color}55`,
            borderRadius: T.rL,
            padding: 24, marginBottom: 24,
            boxShadow: `inset 0 1px 0 ${verdict.color}22`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 36 }}>{verdict.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: T.textLow, letterSpacing: '.1em', textTransform: 'uppercase' }}>
                  檢測結論
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: verdict.color }}>
                  {verdict.title}
                </div>
              </div>
            </div>
            <p style={{ color: T.text, lineHeight: 1.7, marginBottom: 10 }}>
              {verdict.summary}
            </p>
            <div style={{
              padding: 12, borderRadius: T.rM,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${T.cardBorder}`,
              fontSize: 14, color: T.textMid, lineHeight: 1.6,
            }}>
              <strong style={{ color: T.text }}>對 AI 引用率的影響：</strong><br />
              {verdict.aiImpact}
            </div>
          </section>
        )}

        {/* DESIGN: CTA 區 — 結論顯示後浮現，視覺強調「免費註冊看完整報告」
            風險越高、CTA 文案越緊急（已從 verdict.riskLevel 拿到風險等級 0-4）*/}
        {result && verdict && verdict.riskLevel >= 0 && (
          <section style={{
            background: `linear-gradient(135deg, ${T.orange}22, ${T.aivis}22)`,
            border: `1px solid ${T.orange}55`,
            borderRadius: T.rL,
            padding: 24, marginBottom: 24, textAlign: 'center',
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {verdict.riskLevel >= 3 ? '想知道完整修法？' : '想看完整 7 大檢測項？'}
            </h2>
            <p style={{ color: T.textMid, fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>
              這只是 anti-bot 一項。免費註冊看完整報告，含 Meta、H1、Alt、行動相容、頁面速度、SSL、爬蟲可達性 7 大檢測項。
              {verdict.riskLevel >= 2 && (
                <><br />Pro 還會直接給你 Cloudflare WAF 修復碼，貼進後台就生效。</>
              )}
            </p>
            <Link to="/register" style={{
              display: 'inline-block',
              padding: '14px 36px', fontSize: 15, fontWeight: 700,
              background: `linear-gradient(135deg, ${T.orange}, #f59e0b)`,
              color: 'white', borderRadius: T.rM, textDecoration: 'none',
            }}>
              免費註冊 → 看完整報告
            </Link>
            <div style={{ marginTop: 12, fontSize: 14, color: T.textLow }}>
              30 秒註冊・不需信用卡・3 個免費網站額度
            </div>
          </section>
        )}

        {/* DESIGN: 為什麼這個檢測重要？— 教育型內容，待 Design 接視覺
            可考慮：折疊 accordion、左右並排 illustration、AI bot icon row */}
        <section style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${T.cardBorder}`,
          borderRadius: T.rL,
          padding: 20, marginTop: 32,
          color: T.textMid, fontSize: 14, lineHeight: 1.7,
        }}>
          <h3 style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            為什麼 Ahrefs / SEMrush 都不檢這個？
          </h3>
          <p style={{ marginBottom: 10 }}>
            傳統 SEO 工具只測「Google 排名」。但 ChatGPT、Claude、Perplexity 用的是它們自己的爬蟲（ChatGPTBot / ClaudeBot / PerplexityBot），
            這些爬蟲常常被 Cloudflare、WAF、anti-bot 服務跟「假冒 Googlebot」一起擋掉。
          </p>
          <p style={{ marginBottom: 10 }}>
            結果：<strong style={{ color: T.text }}>你的網站 Google 排第一，但 ChatGPT 從沒推薦過你</strong>。
            這個工具就是設計來抓這個盲點。
          </p>
          <p>
            <strong style={{ color: T.text }}>這是 GEO 的第 0 步</strong>：進得來 → 才會被爬 → 才有機會被引用。我們先幫你確認第一關「門開著」。
            （門開了之後，「ChatGPT 到底有沒有推薦你」用我們的 <strong style={{ color: T.text }}>AI 曝光監測</strong> 直接問 5 大 AI 量出來。）
          </p>
        </section>
      </main>

      {/* DESIGN: minimal footer — 不放完整連結，只放版權跟主要法律頁 */}
      <footer style={{
        padding: '24px', textAlign: 'center',
        color: T.textLow, fontSize: 14,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        AI 雷達 · 由優勢方舟數位行銷營運 ·{' '}
        <Link to="/" style={{ color: T.textMid }}>回首頁</Link>
      </footer>

      <style>{`
        @keyframes blink { 50% { opacity: 0 } }
      `}</style>
    </div>
  )
}

// 4 輪結果的視覺輔助 — Claude Design 可改 icon / 顏色，但 status key 字串不變
function statusBadge(status) {
  return {
    pass: '✓ 通過',
    warn: '⚠ 警告通過',
    fail: '✗ 被擋',
    skip: '— 略過',
    error: '⚠ 錯誤',
  }[status] || status
}

function statusColor(status) {
  return {
    pass: T.pass,
    warn: T.warn,
    fail: T.fail,
    skip: T.textLow,
    error: T.fail,
  }[status] || T.textMid
}
