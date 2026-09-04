import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { runAivisScan, PROMPT_CAP, SCAN_RUNS, ROTATING_SAMPLE_PER_SCAN } from '../../services/aivisScanService'
import { logError } from '../../lib/errorLog'
import Badge from './Badge'
import { buildIntentCoverage } from './aivisData'

/**
 * 監測題目管理（2026-08-13 硬切前置 #3 · 題庫搬進新版）：
 * 四層題庫用「人話」呈現（Codex IA：內部術語不當導覽），啟停／編輯／新增／執行掃描全搬。
 * 額度攔截交後端執法、錯誤誠實透傳（含額度不足訊息）；掃描完成整頁重載吃 DB 最新。
 */
const TIER_META = [
  { tier: 'core', title: '客戶找服務時的問題', sub: `固定基準題——頭條曝光率與趨勢線只看這層（啟用上限 ${PROMPT_CAP} 條、每條掃 ${SCAN_RUNS} 次取平均）`, addable: true },
  { tier: 'rotating', title: '長尾輪替題', sub: `輪替池——每次掃描隨機抽 ${ROTATING_SAMPLE_PER_SCAN} 條、抓核心題測不到的盲點`, addable: false },
  { tier: 'brand', title: 'AI 認不認得你', sub: '含品牌名的題——另計「品牌認知率」、刻意不灌入曝光率', addable: false },
  { tier: 'info', title: '知識題（內容引用）', sub: '不含品牌名的知識問句——看 AI 引用來源有沒有你的網域，餵「內容機會」', addable: true },
  // 2026-09-04：客戶在比價時問「A 跟 B 哪個好」，AI 的答案直接影響成交——過去完全沒測。
  // 只有設了競品觀察名單才會被自動產生器建立（沒名單就硬掰對手，量到的東西沒有意義）。
  { tier: 'competitor', title: '比價時 AI 站在誰那邊', sub: '同時含你與競品名的題——需要先設好「競品比較」的觀察名單；每條掃 1 次、不灌入曝光率', addable: false },
]

/**
 * 題庫意圖覆蓋率面板（2026-09-04）
 * tier 管的是掃描行為，回答不了「客戶購買旅程的哪一段沒被測到」——這一塊補的就是那個問題。
 * 舊題庫沒有 intent 欄位、分類是從文字推測的，所以推測比例一定照實寫出來。
 */
function IntentCoverage({ brand, prompts }) {
  const coverage = buildIntentCoverage({
    prompts,
    brandName: brand?.name || '',
    competitors: brand?.competitors || [],
  })
  if (coverage.total === 0) return null

  return (
    <div className="as-pm-coverage">
      <div className="ch">
        <b>題庫意圖覆蓋率</b>
        <span className={`score ${coverage.blindSpots.length ? 'warn' : 'ok'}`}>
          {coverage.coveredCount}/{coverage.intentCount} 類
        </span>
        <span className="sub">量得到客戶購買旅程的哪幾段——缺的那一類就是量不到的盲區</span>
      </div>
      <ul className="chips">
        {coverage.byIntent.map(item => (
          <li key={item.key} className={item.covered ? '' : 'blind'} title={item.why}>
            <span className="n">{item.label}</span>
            <span className="c">{item.covered ? `${item.count} 條` : '盲區'}</span>
          </li>
        ))}
      </ul>
      {coverage.blindSpots.length > 0 && (
        <ul className="hints">
          {coverage.blindSpots.map(item => (
            <li key={item.key}><b>{item.label}</b>：{item.blindSpotHint}</li>
          ))}
        </ul>
      )}
      {coverage.inferredCount > 0 && (
        <p className="note">
          ※ 其中 {coverage.inferredCount} 條（{coverage.inferredRatio}%）的分類是依題目文字推測的，不是產生題庫時標記的。
          按「重新產生題庫」可以拿到精準標籤。
        </p>
      )}
    </div>
  )
}

export default function PromptManager({ brand, prompts, userId, onPromptsChange }) {
  const [editing, setEditing] = useState(null)   // { id, text }
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)     // { kind: 'ok'|'warn', msg }
  const [scan, setScan] = useState({ running: false, done: 0, total: 0 })

  const [autoScan, setAutoScan] = useState(Boolean(brand?.auto_scan))
  const coreActiveCount = prompts.filter(prompt => (prompt.tier || 'core') === 'core' && prompt.is_active).length
  const atCap = coreActiveCount >= PROMPT_CAP

  function flash(kind, msg, ms = 3500) {
    setNotice({ kind, msg })
    setTimeout(() => setNotice(null), ms)
  }

  // 每週自動掃描開關（2026-08-14 分級自動掃 V1）：opt-in、消耗自己的月額度（每次 ≈ 一次手動掃描）
  async function toggleAutoScan() {
    const next = !autoScan
    setAutoScan(next)
    const { error } = await supabase.from('aivis_brands').update({ auto_scan: next }).eq('id', brand.id)
    if (error) {
      setAutoScan(!next)
      const hint = /column|auto_scan/i.test(error.message) ? '（資料表尚未新增 auto_scan 欄位，請先跑 SQL）' : ''
      flash('warn', `切換失敗：${error.message}${hint}`, 6000)
    } else {
      flash('ok', next ? '✅ 已開啟每週自動掃描——每週日排程、分批執行，週一起陸續看到新資料' : '已關閉自動掃描')
    }
  }

  // 啟停：core 受啟用上限保護（固定樣本才有可比趨勢）；失敗回滾
  async function toggle(prompt) {
    const isCore = (prompt.tier || 'core') === 'core'
    if (!prompt.is_active && isCore && atCap) {
      flash('warn', `核心題已達啟用上限（${PROMPT_CAP} 條）——固定樣本才能比較趨勢，請先停用一條再啟用`)
      return
    }
    const next = !prompt.is_active
    onPromptsChange(list => list.map(item => item.id === prompt.id ? { ...item, is_active: next } : item))
    const { error } = await supabase.from('aivis_prompts')
      .update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', prompt.id)
    if (error) {
      onPromptsChange(list => list.map(item => item.id === prompt.id ? { ...item, is_active: !next } : item))
      flash('warn', `切換失敗：${error.message}`)
    }
  }

  // 編輯題目文字：存檔標 generated_by='user'（人工題不會被自動重生蓋掉）
  async function saveEdit() {
    if (!editing) return
    const text = editing.text.trim()
    if (!text) { setEditing(null); return }
    setBusyId(editing.id)
    const { error } = await supabase.from('aivis_prompts')
      .update({ text, generated_by: 'user', updated_at: new Date().toISOString() }).eq('id', editing.id)
    setBusyId(null)
    if (error) { flash('warn', `儲存失敗：${error.message}`); return }
    onPromptsChange(list => list.map(item => item.id === editing.id ? { ...item, text, generated_by: 'user' } : item))
    setEditing(null)
  }

  // 新增自訂題：core 佔啟用上限、info 進池子（is_active=false、不佔上限）——與經典版同規則
  async function addPrompt(tier) {
    const isInfo = tier === 'info'
    if (!isInfo && atCap) { flash('warn', `核心題已達啟用上限（${PROMPT_CAP} 條）`); return }
    const { data, error } = await supabase.from('aivis_prompts').insert({
      user_id: userId, brand_id: brand.id,
      text: isInfo ? '（請輸入知識問句，例：術後要注意什麼？切記不要放品牌名）' : '（請輸入客戶會問的品類問題）',
      tier, generated_by: 'user', is_active: !isInfo,
    }).select().single()
    if (error) { flash('warn', `新增失敗：${error.message}`); return }
    onPromptsChange(list => [...list, data])
    setEditing({ id: data.id, text: '' })
  }

  // 執行掃描：分流編排在共用 service；額度不足等錯誤由後端回覆、這裡誠實透傳
  async function handleScan() {
    if (scan.running) return
    setScan({ running: true, done: 0, total: 0 })
    try {
      const result = await runAivisScan({
        prompts,
        onProgress: (done, total) => setScan({ running: true, done, total }),
      })
      flash('ok', `✅ 掃描完成：${result.runs} 個回答、${result.mentioned} 次提及（${result.rate}%）——3 秒後重新載入`)
      setTimeout(() => window.location.reload(), 3000)
    } catch (error) {
      logError({ source: 'aivis_scan', message: error.message, userId, brandId: brand.id })
      setScan({ running: false, done: 0, total: 0 })
      flash('warn', `掃描中止：${error.message}`, 8000)
    }
  }

  return (
    <section className="as-card as-pm">
      <div className="as-vis-section-head">
        <div><h3>監測題目</h3><span className="sub">共 {prompts.length} 條 · 核心啟用 {coreActiveCount}/{PROMPT_CAP}</span></div>
        <button type="button" className="as-cta" onClick={handleScan} disabled={scan.running} aria-live="polite">
          {scan.running ? `掃描中… ${scan.done}/${scan.total} 題` : '▶ 執行掃描'}
        </button>
      </div>

      {/* 每週自動掃描：opt-in（花的是用戶自己的額度、必須明示同意）；文字明示狀態不只靠顏色 */}
      <div className="as-pm-auto">
        <button type="button" className={`op sw${autoScan ? ' on' : ''}`} onClick={toggleAutoScan} aria-pressed={autoScan}>
          {autoScan ? '🗓 每週自動掃描：開啟中' : '🗓 每週自動掃描：關閉'}
        </button>
        <Badge kind="pro" />
        <span>Pro／試用期間限定。每週日自動排程、分批執行；每次約花一次手動掃描的額度，額度不足該週自動跳過（不超扣）。試用或訂閱到期後自動停止，續訂即恢復。</span>
      </div>

      {notice && <div className={`as-pm-notice ${notice.kind}`} role="alert">{notice.msg}</div>}

      <IntentCoverage brand={brand} prompts={prompts} />

      {TIER_META.map(meta => {
        const list = prompts.filter(prompt => (prompt.tier || 'core') === meta.tier)
        return (
          <div className="as-pm-tier" key={meta.tier}>
            <div className="th">
              <b>{meta.title}</b><span>{meta.sub}</span>
              {meta.addable && (
                <button type="button" className="as-vis-line-button" onClick={() => addPrompt(meta.tier)}>＋ 新增</button>
              )}
            </div>
            {list.length === 0 ? (
              <div className="as-vis-inline-state">這一層還沒有題目{meta.addable ? '——按「＋ 新增」加一條' : '（由自動產生器建立）'}。</div>
            ) : (
              <ul>
                {list.map(prompt => (
                  <li key={prompt.id} className={prompt.is_active ? '' : 'off'}>
                    {editing?.id === prompt.id ? (
                      <div className="edit">
                        <input
                          type="text" value={editing.text} autoFocus
                          onChange={event => setEditing(current => ({ ...current, text: event.target.value }))}
                          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveEdit() } }}
                          placeholder="輸入題目文字…"
                        />
                        <button type="button" className="as-cta" onClick={saveEdit} disabled={busyId === prompt.id}>{busyId === prompt.id ? '存…' : '儲存'}</button>
                        <button type="button" className="as-vis-line-button" onClick={() => setEditing(null)}>取消</button>
                      </div>
                    ) : (
                      <>
                        <span className="q">{prompt.text}</span>
                        {prompt.generated_by === 'user' && <span className="ug">自訂</span>}
                        <span className="ops">
                          <button type="button" className="op" onClick={() => setEditing({ id: prompt.id, text: prompt.text })}>編輯</button>
                          {/* 啟停開關：文字明示狀態（不只靠顏色） */}
                          <button type="button" className={`op sw${prompt.is_active ? ' on' : ''}`} onClick={() => toggle(prompt)} aria-pressed={prompt.is_active}>
                            {prompt.is_active ? '啟用中' : '已停用'}
                          </button>
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <p className="foot">
        每次掃描 ≈ 核心題 ×{SCAN_RUNS} ＋ 輪替抽 {ROTATING_SAMPLE_PER_SCAN} 題 ×{SCAN_RUNS} ＋ 品牌題/知識題各 ×1 次額度。
        額度不足時掃描會中止並顯示原因；自動重生題庫請至 <a href={`/ai-visibility/${brand.id}`}>經典版品牌管理</a>。
      </p>
    </section>
  )
}
