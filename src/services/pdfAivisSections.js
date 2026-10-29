/**
 * 客戶報告的 aivis 頁面（2026-08-28）
 *
 * 為什麼要有這幾頁：
 *   原本的客戶 PDF 只有 31 項靜態檢測 + Top 5 建議，aivis 那一列寫「需 Pro 訂閱」——
 *   我們最強的一層（實際去問三引擎）從來沒進過客戶看得到的交付物。
 *   同業拿人工整理的實測表就能賣年約，我們有資料庫卻只輸出四個分數。
 *
 * 這幾頁刻意要做到同業做不到的三件事：
 *   1. 每一格都有分母——「3 次觀測裡 3 次提到」，不是一個打勾。單次問 AI 會波動，
 *      分母就是我們敢說這不是運氣的理由。
 *   2. 附 AI 的原話節錄與它引用的來源網域，客戶可以自己去核對。
 *   3. 來源歸因分引擎——哪個引擎讀你的官網、哪個只讀論壇，決定資源怎麼分。
 *
 * 誠實邊界（PRODUCT.md）：
 *   - 只用 core 題（品類推薦題）；brand / info 題不進分母
 *   - 沒有第二次掃描就不放前後對照頁，不用單次結果假裝趨勢
 *   - 原話抓不到就留空，不改寫、不補字
 */
import { ENGINE_KEYS, ENGINE_META, hostMatches } from '../components/appshell/aivisData.js'   // 帶副檔名：這支不依賴 jsPDF，可用 node --test 直接跑

const PAGE_OPEN = `<div style="width:794px;background:white;font-family:'Microsoft JhengHei','微軟正黑體','PingFang TC',sans-serif;color:#1e293b;padding:48px 56px;min-height:1080px;">`
const PAGE_CLOSE = `</div>`

// 這幾頁會塞進 AI 回覆原文與客戶自訂題目 —— 一律逃脫，避免內容裡的角括號打壞版面
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function fmtDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function kicker(text) {
  return `<div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">${esc(text)}</div>`
}

function heading(text) {
  return `<h2 style="font-size:28px;font-weight:bold;color:#1e293b;margin:0 0 12px;letter-spacing:-0.02em;">${esc(text)}</h2>`
}

function lead(text) {
  return `<p style="font-size:13px;color:#64748b;line-height:1.75;margin:0 0 22px;">${text}</p>`
}

// 頁尾誠實註腳：檢測範圍與方法一律明示（品牌承諾「誠實是機制不是口號」）
function footnote(text) {
  return `<div style="margin-top:26px;padding:12px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:0 8px 8px 0;font-size:11px;color:#64748b;line-height:1.7;">${text}</div>`
}

const TH = 'text-align:left;padding:9px 12px;background:#f1f5f9;color:#475569;font-weight:600;font-size:11px;letter-spacing:0.05em;'
const TD = 'padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;vertical-align:top;'

/** 一格的呈現：有提到＝綠底分數，沒提到＝灰字分數，沒資料＝破折號 */
function cell(stat) {
  if (!stat) return `<td style="${TD}text-align:center;color:#cbd5e1;">—</td>`
  const hit = stat.mentioned > 0
  const color = hit ? '#16a34a' : '#94a3b8'
  const label = hit ? '有提到' : '未提及'
  return `<td style="${TD}text-align:center;">
    <div style="font-weight:700;color:${color};font-size:12.5px;">${label}</div>
    <div style="font-size:10.5px;color:#94a3b8;font-family:'JetBrains Mono',monospace;margin-top:2px;">${stat.mentioned} / ${stat.runs} 次</div>
  </td>`
}

/**
 * 第一頁：實測矩陣 —— 逐題 × 逐引擎，每格帶分母。
 */
export function buildAivisMatrixHTML(report) {
  if (!report?.hasData) return null
  const { latest, totals, brandName } = report
  const engines = ENGINE_KEYS.filter(key => latest.rows.some(row => row.engines[key]))

  const rows = latest.rows.map(row => `
    <tr>
      <td style="${TD}color:#1e293b;font-weight:600;">${esc(row.text)}</td>
      ${engines.map(key => cell(row.engines[key])).join('')}
    </tr>`).join('')

  return `${PAGE_OPEN}
    ${kicker('03 · AI Visibility Test')}
    ${heading('我們實際去問了 AI')}
    ${lead(`把 <strong style="color:#1e293b;">${esc(brandName || '你的品牌')}</strong> 相關的 ${totals.prompts} 個問題，
      分別問 ${engines.map(key => ENGINE_META[key].label).join('、')}，全部開啟網路搜尋。
      判定的是「AI 的回答正文裡有沒有講出你的名字」。`)}

    <div style="display:flex;gap:12px;margin-bottom:22px;">
      <div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="font-size:30px;font-weight:bold;color:${totals.rate >= 50 ? '#16a34a' : totals.rate >= 20 ? '#d97706' : '#dc2626'};">${totals.rate ?? '—'}%</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">整體提及率</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="font-size:30px;font-weight:bold;color:#1e293b;">${totals.hit} / ${totals.observed}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">實際觀測（次）</div>
      </div>
      <div style="flex:1;text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <div style="font-size:30px;font-weight:bold;color:#1e293b;">${totals.prompts} × ${engines.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">題目 × 引擎</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${TH}border-radius:6px 0 0 0;">問題</th>
        ${engines.map((key, i) => `<th style="${TH}text-align:center;color:${ENGINE_META[key].color};${i === engines.length - 1 ? 'border-radius:0 6px 0 0;' : ''}">${ENGINE_META[key].label}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${footnote(`每一格都附分母：<strong style="color:#334155;">「2 / 3 次」代表這一輪實際問了 3 次、其中 2 次提到你</strong>。
      AI 的單次回答本身會波動，所以核心題每次掃描重複多次取實際命中比例——這是我們敢說結果不是運氣的唯一理由。
      本表只計品類推薦題；品牌名稱題與知識題另外統計，不併入分母。檢測時間 ${fmtDate(latest.at)}。`)}
  ${PAGE_CLOSE}`
}

/**
 * 第二頁：AI 的原話與它引用的來源 —— 客戶可以自己核對的證據。
 * 沒有任何一題被提到就回 null（不放空頁）。
 */
export function buildAivisEvidenceHTML(report) {
  if (!report?.hasData) return null
  const blocks = []
  for (const row of report.latest.rows) {
    for (const key of ENGINE_KEYS) {
      const stat = row.engines[key]
      if (!stat || stat.mentioned === 0) continue
      blocks.push({ key, row, stat })
    }
  }
  if (!blocks.length) return null

  // 一頁放得下約 5 則；超過就截斷並誠實說明還有幾則
  const shown = blocks.slice(0, 5)
  const rest = blocks.length - shown.length

  const cards = shown.map(({ key, row, stat }) => {
    const meta = ENGINE_META[key]
    const hosts = (stat.hosts || []).slice(0, 5)
    return `
    <div style="padding:16px 18px;background:#f8fafc;border-radius:12px;border-left:4px solid ${meta.color};margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:11px;padding:2px 9px;border-radius:99px;background:${meta.color}22;color:${meta.color};font-weight:700;">${meta.label}</span>
        <span style="font-size:13px;font-weight:600;color:#1e293b;">${esc(row.text)}</span>
        ${stat.position != null ? `<span style="font-size:11px;color:#64748b;">名單第 ${stat.position} 位</span>` : ''}
        <span style="font-size:11px;color:#94a3b8;margin-left:auto;font-family:'JetBrains Mono',monospace;">${stat.mentioned} / ${stat.runs} 次</span>
      </div>
      ${stat.snippet
        ? `<div style="font-size:12px;color:#334155;line-height:1.8;padding:10px 12px;background:white;border-radius:8px;border:1px solid #e2e8f0;">「${esc(stat.snippet)}」</div>`
        : `<div style="font-size:11.5px;color:#94a3b8;">這一次沒有取到可引用的原文片段。</div>`}
      ${hosts.length ? `<div style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.7;">
        這則回答引用的來源：${hosts.map(h => `<span style="font-family:'JetBrains Mono',monospace;color:${report.ownHost && hostMatches(h, report.ownHost) ? '#16a34a' : '#475569'};">${esc(h)}</span>`).join('、')}
      </div>` : ''}
    </div>`
  }).join('')

  return `${PAGE_OPEN}
    ${kicker('04 · Evidence')}
    ${heading('AI 原話與它引用的來源')}
    ${lead('上一頁的每一個「有提到」，這裡附上 AI 當時實際講的話，以及它是從哪些網站讀來的。所有來源都是公開網址，你可以自己點進去核對。')}
    ${cards}
    ${rest > 0 ? `<div style="font-size:12px;color:#64748b;padding:10px 0;">另有 ${rest} 則被提及的紀錄未列於本頁，完整原文保存在監測後台。</div>` : ''}
    ${footnote(`原文節錄取自 AI 回答中含品牌名稱的段落，未經改寫。抓不到片段的欄位一律留白，不補字。
      綠色標示的來源網域代表<strong style="color:#334155;">那則回答讀到了你自己的網站</strong>。`)}
  ${PAGE_CLOSE}`
}

/**
 * 第三頁：與上一次的前後對照。只有真的有第二場掃描才產生。
 */
export function buildAivisTrendHTML(report) {
  if (!report?.hasData || !report.previous) return null
  const prevByPrompt = Object.fromEntries(report.previous.rows.map(row => [row.promptId, row]))

  const rows = report.latest.rows.map(row => {
    const prev = prevByPrompt[row.promptId]
    const nowText = `${row.enginesMentioned} / ${row.enginesWithData} 個引擎`
    const prevText = prev ? `${prev.enginesMentioned} / ${prev.enginesWithData} 個引擎` : '上次未測'
    let change = '<span style="color:#94a3b8;">—</span>'
    if (prev) {
      const diff = row.enginesMentioned - prev.enginesMentioned
      if (diff > 0) change = `<span style="color:#16a34a;font-weight:700;">+${diff}</span>`
      else if (diff < 0) change = `<span style="color:#dc2626;font-weight:700;">${diff}</span>`
      else change = `<span style="color:#64748b;">持平</span>`
    }
    return `<tr>
      <td style="${TD}color:#1e293b;font-weight:600;">${esc(row.text)}</td>
      <td style="${TD}text-align:center;">${prevText}</td>
      <td style="${TD}text-align:center;font-weight:600;color:#1e293b;">${nowText}</td>
      <td style="${TD}text-align:center;">${change}</td>
    </tr>`
  }).join('')

  // 連續兩次都掛零的題 —— 這才是真正可以下結論的部分（重複的零不是波動）
  const persistentZero = report.latest.rows.filter(row => {
    const prev = prevByPrompt[row.promptId]
    return prev && row.enginesMentioned === 0 && prev.enginesMentioned === 0
  })

  return `${PAGE_OPEN}
    ${kicker('05 · Comparison')}
    ${heading('與上一次的前後對照')}
    ${lead(`同一批題目、同樣開啟網路搜尋。附上兩次結果，是因為 AI 的單次回答本身會波動——<strong style="color:#1e293b;">看趨勢比看單次可靠</strong>。`)}

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr>
        <th style="${TH}border-radius:6px 0 0 0;">問題</th>
        <th style="${TH}text-align:center;">${fmtDate(report.previous.at)}</th>
        <th style="${TH}text-align:center;">${fmtDate(report.latest.at)}</th>
        <th style="${TH}text-align:center;border-radius:0 6px 0 0;">變化</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${persistentZero.length ? `
    <div style="padding:16px 18px;background:#fef2f2;border-radius:12px;border-left:4px solid #dc2626;">
      <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:6px;">兩次都掛零的題目（${persistentZero.length} 題）</div>
      <div style="font-size:12px;color:#7f1d1d;line-height:1.8;">
        ${persistentZero.map(row => esc(row.text)).join('、')}
      </div>
      <div style="font-size:11.5px;color:#991b1b;line-height:1.75;margin-top:8px;">
        單次沒被提到可能是波動，<strong>連續兩次、跨多個引擎都是零，就不是波動了</strong>。這幾題要處理的通常不在網站本身，
        而是 AI 回答這類問題時取材的地方（論壇、社群、名錄）沒有你的內容——見下一頁的來源歸因。
      </div>
    </div>` : ''}

    ${footnote(`本頁比較的是「幾個引擎提到你」，不是排名。兩次之間相差 ${Math.max(1, Math.round((new Date(report.latest.at) - new Date(report.previous.at)) / 86400000))} 天。
      單一題目一次的變化不足以下結論——<strong style="color:#334155;">連續多次同方向才是訊號</strong>，這也是我們建議持續監測而不是單次體檢的原因。`)}
  ${PAGE_CLOSE}`
}

/**
 * 第四頁：來源歸因（分引擎）—— 決定資源要放哪裡的那一頁。
 */
export function buildAivisSourceHTML(report) {
  if (!report?.hasData) return null
  const byEngine = (report.influence?.byEngine || []).filter(engine => engine.answers > 0)
  if (!byEngine.length) return null

  const cards = byEngine.map(engine => {
    const meta = ENGINE_META[engine.engine]
    const max = Math.max(...engine.hosts.map(h => h.answers), 1)
    return `
    <div style="padding:16px 18px;background:#f8fafc;border-radius:12px;border-left:4px solid ${meta.color};margin-bottom:12px;">
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px;">
        <span style="font-size:15px;font-weight:700;color:${meta.color};">${meta.label}</span>
        <span style="font-size:11px;color:#64748b;">${engine.answers} 則帶來源的回答 · 共 ${engine.totalHosts} 個網域</span>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:${engine.ownAnswers > 0 ? '#16a34a' : '#dc2626'};">
          讀到你的官網 ${engine.ownAnswers} 次
        </span>
      </div>
      ${engine.hosts.map(host => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px;">
          <span style="width:190px;font-size:11.5px;font-family:'JetBrains Mono',monospace;color:${host.isOwn ? '#16a34a' : '#475569'};font-weight:${host.isOwn ? 700 : 400};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(host.host)}</span>
          <span style="flex:1;height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden;">
            <span style="display:block;height:8px;width:${Math.round(host.answers / max * 100)}%;background:${host.isOwn ? '#16a34a' : meta.color};border-radius:99px;"></span>
          </span>
          <span style="width:34px;text-align:right;font-size:11px;color:#64748b;font-family:'JetBrains Mono',monospace;">${host.answers}</span>
        </div>`).join('')}
    </div>`
  }).join('')

  return `${PAGE_OPEN}
    ${kicker('06 · Source Attribution')}
    ${heading('每個 AI 讀的東西不一樣')}
    ${lead('把每個引擎回答時實際引用的來源網域拆開統計。<strong style="color:#1e293b;">這一頁決定資源要放在哪裡</strong>——會讀你官網的引擎，把官網做好就有用；只讀論壇與社群的引擎，網站做到滿分也進不去名單。')}
    ${cards}
    ${footnote(`統計只看品類推薦題（知識題的來源性質不同，併入會誤導）。同一則回答內的同一網域只計一次，避免單則洗版。
      來源全部取自引擎回傳的結構化引用資料，<strong style="color:#334155;">沒有推測成分</strong>；Gemini 的接地轉址網域已排除。
      近 ${report.rangeDays} 天、共 ${report.sessionCount} 場掃描。`)}
  ${PAGE_CLOSE}`
}

/**
 * 摘要判語頁（報告第 2 頁，2026-08-28）
 *
 * 為什麼放在分數之前：
 *   企業主翻開報告不是想看四個數字，是想知道「所以我現在到底怎樣」。
 *   同業那份 10 頁報告最有殺傷力的就是這一頁——先給一句話結論，
 *   再用好消息／最強一項／真正缺口三張卡把話講完，後面所有數字都只是佐證。
 *   我們原本第 2 頁直接上分數，等於把最重要的一句話留給客戶自己去想。
 *
 * 判語全部由 [reportVerdict.js](./reportVerdict.js) 從實際數據推導，這裡只負責排版。
 */
export function buildExecutiveVerdictHTML(verdict, clientInfo) {
  if (!verdict) return null
  const { clientName = '' } = clientInfo || {}
  // 卡片配色：好消息綠、最強一項綠、缺口紅、資源配置琥珀（與判語語意對應，不是隨機上色）
  const TONE = {
    '目前最好的一塊': ['#16a34a', '#f0fdf4'],
    '最強的一題': ['#16a34a', '#f0fdf4'],
    '真正的缺口': ['#dc2626', '#fef2f2'],
    '這次沒進榜的題': ['#d97706', '#fffbeb'],
    '資源該放哪裡': ['#d97706', '#fffbeb'],
  }

  const cards = verdict.cards.map(card => {
    const [line, bg] = TONE[card.title] || ['#64748b', '#f8fafc']
    return `
    <div style="padding:16px 20px;background:${bg};border-radius:12px;border-left:4px solid ${line};margin-bottom:12px;">
      <div style="font-size:11px;font-weight:700;color:${line};letter-spacing:0.05em;margin-bottom:6px;">${esc(card.title)}</div>
      <div style="font-size:13px;color:#334155;line-height:1.85;">${esc(card.body)}</div>
    </div>`
  }).join('')

  return `${PAGE_OPEN}
    ${kicker('01 · Executive Summary')}
    ${heading('一句話結論')}
    <div style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:14px;margin-bottom:24px;">
      <div style="font-size:21px;font-weight:bold;color:white;line-height:1.6;letter-spacing:-0.01em;">${esc(verdict.headline)}</div>
      ${verdict.techAvg != null ? `<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:10px;">
        技術體質四層平均 ${verdict.techAvg} / 100${verdict.rate != null ? `&nbsp;·&nbsp;AI 實測提及率 ${verdict.rate}%` : ''}
      </div>` : ''}
    </div>

    ${lead(`這份報告分兩層。第一層是機器掃描，回答「<strong style="color:#1e293b;">AI 讀不讀得到你</strong>」；
      第二層是我們實際去問 AI，回答「<strong style="color:#1e293b;">AI 現在怎麼講你</strong>」。
      兩層的落差往往才是真正的答案。`)}

    ${cards}

    ${footnote(verdict.hasAivis
      ? `本報告的實測結果是快照，不是排名。AI 的回答本身會波動，所以核心題每次重複多輪、並附上每一格的分母；
         被提到的每一則都附 AI 原話與它引用的來源網址，${clientName ? esc(clientName) : '你'}可以自己點進去核對。`
      : `這一份只做到第一層。「AI 現在怎麼講你」需要實際拿品牌去問 ChatGPT、Claude、Gemini 才知道——
         那是掃描看不到的，也是這份報告目前還沒有的部分。`)}
  ${PAGE_CLOSE}`
}

/**
 * 承諾邊界頁（報告最後一頁，2026-08-28）
 *
 * 為什麼要這一頁：
 *   同業那份 10 頁報告的最後一頁是「我們承諾什麼、不承諾什麼」三欄表，
 *   把「我不能保證結果」從弱點翻成專業標誌。這正好是我們品牌承諾
 *   （誠實是機制不是口號）最該有、卻一直沒有的一頁。
 *
 * ⚠️ 刻意的設計界線：
 *   這頁分兩塊。**方法邊界**由程式從實際檢測產生——那是我們的工具負責的事，
 *   講得出來也驗得了。**服務承諾**（SLA、展延、退費那類）留給代理商自己填，
 *   空著就整塊不出現。理由很簡單：替別人生成他沒答應過的商業承諾，
 *   比報告裡放錯數字更嚴重。
 */
export function buildCommitmentHTML({ verdict, aivis, clientInfo, scanDate }) {
  const { agencyName = '', agencyCommitment = '' } = clientInfo || {}
  const who = agencyName ? esc(agencyName) : '我們'
  const hasAivis = !!aivis?.hasData

  const rows = [
    {
      label: `${who}承諾`,
      body: [
        `每次檢測固定 <b>${verdict?.techCount || 31} 個技術項目</b>，逐項列出通過與否，不挑好看的講。`,
        hasAivis
          ? `每次實測固定題庫 <b>${aivis.totals.prompts} 題 × ${aivis.totals.enginesUsed} 個 AI</b>，核心題重複多輪，<b>每一格都附分母</b>。`
          : null,
        hasAivis
          ? 'AI 的原始回答與它引用的<b>來源網址全部保存</b>，隨時可調閱核對。'
          : null,
        '檢測範圍、統計方法與資料期間，全部寫在報告裡，不藏。',
      ].filter(Boolean),
      tone: '#16a34a',
    },
    {
      label: `${who}追蹤呈現`,
      body: [
        hasAivis
          ? '主要指標是<b>同一批題目的多期趨勢</b>，不看單次結果。'
          : '主要指標是同一組檢測項目的多期變化，不看單次結果。',
        '單次的上升或下降<b>不下結論</b>——連續多次同方向才視為訊號。',
      ],
      tone: '#2563eb',
    },
    {
      label: `${who}不承諾`,
      body: [
        '<b>不承諾</b>具體的提及次數或提及率。',
        '<b>不承諾</b>見效時間。',
        '<b>不承諾</b>搜尋排名。',
        '理由：各平台的模型版本、索引週期與取材來源都由平台自己決定，<b>任何人都無法保證</b>。說得出保證的，不是不懂就是在唬你。',
      ],
      tone: '#b45309',
    },
  ]

  const table = rows.map(row => `
    <tr>
      <td style="${TD}width:150px;font-weight:700;color:${row.tone};">${row.label}</td>
      <td style="${TD}color:#334155;line-height:1.9;">${row.body.map(line => `<div style="margin-bottom:4px;">${line}</div>`).join('')}</td>
    </tr>`).join('')

  return `${PAGE_OPEN}
    ${kicker('09 · Scope & Commitments')}
    ${heading('我們承諾什麼、不承諾什麼')}
    ${lead('這一頁請務必看完。做這件事的人很多，願意把界線寫清楚的不多。')}

    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
      <tbody>${table}</tbody>
    </table>

    <div style="padding:16px 20px;background:#f8fafc;border-radius:12px;border-left:4px solid #cbd5e1;margin-bottom:12px;">
      <div style="font-size:12.5px;font-weight:700;color:#334155;margin-bottom:8px;">兩個誠實的提醒</div>
      <p style="font-size:12px;color:#475569;line-height:1.85;margin:0 0 8px;">
        <b>一、這份報告的檢測範圍是單一頁面加上站台層檔案</b>（robots.txt、sitemap、llms.txt），
        不是全站爬蟲。像 FAQ、H1、Meta 這類是逐頁檢查的——某一項顯示未通過，可能只是這一頁沒有，
        你其他頁面可能已經有了。
      </p>
      <p style="font-size:12px;color:#475569;line-height:1.85;margin:0;">
        <b>二、AI 的回答會隨時間與索引更新而變動。</b>
        ${hasAivis
          ? `本報告的實測是 ${fmtDate(aivis.latest.at)} 的快照，不是排名。這也是我們附上分母${aivis.previous ? '與前後對照' : ''}的原因——單看一次沒有意義。`
          : '這份報告只做到「AI 讀不讀得到你」，「AI 現在怎麼講你」需要實際去問才知道。'}
      </p>
    </div>

    ${agencyCommitment ? `
    <div style="padding:16px 20px;background:#f0fdf4;border-radius:12px;border-left:4px solid #16a34a;">
      <div style="font-size:12.5px;font-weight:700;color:#15803d;margin-bottom:8px;">${who}的服務承諾</div>
      <div style="font-size:12px;color:#334155;line-height:1.9;white-space:pre-wrap;">${esc(agencyCommitment)}</div>
    </div>` : ''}

    <div style="margin-top:26px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.8;">
      ${agencyName ? `本報告由 <b style="color:#475569;">${esc(agencyName)}</b> 提供&nbsp;·&nbsp;` : ''}技術監測：方舟 AI 雷達（AARK）<br>
      本報告數據為 ${esc(scanDate || fmtDate(new Date().toISOString()))} 之檢測結果。AI 回答會隨時間與索引更新而變動。
    </div>
  ${PAGE_CLOSE}`
}
