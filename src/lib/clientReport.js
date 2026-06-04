/**
 * clientReport — 把 BulkScan 結果整理成「給客戶看的 markdown 報告」
 *
 * 設計動機（2026-06-04）：
 *   AI 雷達主要用戶是行銷 agency、他們替客戶修網站、但常常沒有客戶 WP 後台權限。
 *   原本工具的內部 finding 對 agency 自己看 OK、但要傳給客戶時太技術。
 *   這個 helper 把 findings 整理成「客戶能讀、能照做」的 markdown / 純文字。
 *
 * 輸出結構：
 *   1. Header — 網站名 + URL + 掃描日期
 *   2. 總覽 — 通過 / 待修 篇數
 *   3. 「需要您 WP 後台處理」段落（fix_owner = wp_admin）— 客戶要看的
 *   4. 「需要寫內容」段落（fix_owner = content_writer）— 客戶 / 文案要看的
 *   5. （內部說明：fix_owner = seo_plugin 那些已由 agency 處理、不列出）
 *   6. Footer — agency 簽名
 */

// 把 finding 按 fix_owner 分組
function groupByOwner(results) {
  const groups = { wp_admin: [], content_writer: [], seo_plugin: [] }
  for (const r of results) {
    const problems = r.findings?.problems || []
    for (const p of problems) {
      const owner = p.fix_owner || 'wp_admin'
      if (groups[owner]) {
        groups[owner].push({ url: r.url, ...p, wp_admin_hint: r.findings?.wp_admin_hint })
      }
    }
  }
  return groups
}

// 把單一 finding 渲染成 markdown 條目
function renderFindingMarkdown(f) {
  const lines = []
  lines.push(`**${f.label || f.id}**`)
  lines.push(`URL：${f.url}`)
  if (f.wp_admin_hint?.where) {
    lines.push(`位置：${f.wp_admin_hint.where}`)
    if (f.wp_admin_hint.steps && f.wp_admin_hint.steps.length > 0) {
      lines.push('操作步驟：')
      f.wp_admin_hint.steps.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`))
    }
    if (f.wp_admin_hint.note) {
      lines.push(`💡 ${f.wp_admin_hint.note}`)
    }
  }
  // 如果 finding 有 suggestion + suggested 文字、附上「建議改成」
  if (f.suggestion?.suggested) {
    lines.push(`建議改成：「${f.suggestion.suggested}」`)
  }
  return lines.join('\n')
}

/**
 * 產 markdown 報告
 * @param {object} params
 * @param {string} params.websiteUrl
 * @param {string} params.websiteName
 * @param {Array} params.results - bulk_scan_results array
 * @param {string} [params.agencyName] - agency 名稱（footer 簽名用）
 * @param {string} [params.scanDate] - 掃描日期 ISO string
 */
export function buildClientReport({ websiteUrl, websiteName, results, agencyName, scanDate }) {
  const date = scanDate ? new Date(scanDate).toLocaleDateString('zh-TW') : new Date().toLocaleDateString('zh-TW')
  const totalScanned = results.length
  const totalWithProblems = results.filter(r => (r.findings?.problems || []).length > 0).length
  const totalPassed = totalScanned - totalWithProblems

  const groups = groupByOwner(results)
  const wpAdminCount = groups.wp_admin.length
  const writerCount = groups.content_writer.length
  const pluginCount = groups.seo_plugin.length

  const lines = []

  // Header
  lines.push(`# 您網站的 AI 能見度體檢報告`)
  lines.push('')
  lines.push(`**網站名稱**：${websiteName || websiteUrl}`)
  lines.push(`**網站網址**：${websiteUrl}`)
  lines.push(`**掃描日期**：${date}`)
  lines.push(`**檢測篇數**：${totalScanned} 篇`)
  lines.push('')

  // 總覽
  lines.push('## 📊 整體狀況')
  lines.push('')
  lines.push(`- ✅ 通過：${totalPassed} 篇`)
  lines.push(`- ⚠️ 待修：${totalWithProblems} 篇`)
  lines.push('')

  // Section 1 — 需要客戶處理的（wp_admin）
  if (wpAdminCount > 0) {
    lines.push(`## 🔑 需要您的 WordPress 後台處理（${wpAdminCount} 項）`)
    lines.push('')
    lines.push('以下項目我們無法用 SEO 外掛直接修改、需要進到您的網站後台調整文章 / 商品 / 頁面內容。建議您：')
    lines.push('1. 安排內部人員或開放編輯權限給我們')
    lines.push('2. 或按照下方步驟自行處理')
    lines.push('')

    // 按 URL 分組、避免同一 URL 重複出現 5 次
    const byUrl = {}
    for (const f of groups.wp_admin) {
      if (!byUrl[f.url]) byUrl[f.url] = []
      byUrl[f.url].push(f)
    }
    let idx = 1
    for (const [url, findings] of Object.entries(byUrl)) {
      lines.push(`### ${idx++}. ${url}`)
      lines.push('')
      const firstHint = findings[0]?.wp_admin_hint
      if (firstHint?.where) {
        lines.push(`**位置**：${firstHint.where}`)
        if (firstHint.steps && firstHint.steps.length > 0) {
          lines.push('**操作步驟**：')
          firstHint.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
        }
      }
      lines.push('')
      lines.push('**需要處理的問題**：')
      for (const f of findings) {
        lines.push(`- ${f.label || f.id}`)
        if (f.suggestion?.suggested) {
          lines.push(`  → 建議：${f.suggestion.suggested}`)
        }
      }
      lines.push('')
    }
  }

  // Section 2 — 需要寫內容（content_writer）
  if (writerCount > 0) {
    lines.push(`## ✍️ 需要新增 / 補強內容（${writerCount} 項）`)
    lines.push('')
    lines.push('以下頁面文字內容不夠豐富、不利於 SEO 與 AI 引用、建議補強：')
    lines.push('')
    for (const f of groups.content_writer) {
      lines.push(`- **${f.url}**`)
      lines.push(`  ${f.label || f.id}`)
    }
    lines.push('')
  }

  // Section 3 — agency 自處理（給客戶交代用、不展開細節）
  if (pluginCount > 0) {
    lines.push('## 🛠️ 已由我們處理（SEO 外掛端、無需您操作）')
    lines.push('')
    lines.push(`我們已透過您網站的 SEO 外掛（Rank Math / Yoast）優化以下 ${pluginCount} 項：`)
    lines.push('- Meta 標題與描述')
    lines.push('- Open Graph 社群分享預覽')
    lines.push('- 結構化資料（Schema）')
    lines.push('- Canonical 標籤')
    lines.push('')
  }

  // Footer
  lines.push('---')
  if (agencyName) {
    lines.push(`本報告由 **${agencyName}** 產出`)
  }
  lines.push(`產出時間：${new Date().toLocaleString('zh-TW')}`)
  lines.push('資料來源：AI 雷達 · AI 能見度分析工具（aark-workspace.vercel.app）')

  return lines.join('\n')
}

/**
 * 把 markdown 複製到剪貼簿
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    document.body.removeChild(ta)
    return true
  }
}

/**
 * 下載 markdown 檔
 */
export function downloadMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
