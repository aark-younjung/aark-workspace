/**
 * 客戶端渲染（CSR / SPA）偵測 —— 回答「AI 爬蟲讀到的是不是一份空殼」
 *
 * 為什麼要有這個：
 *   GPTBot、ClaudeBot、PerplexityBot 這些 AI 爬蟲多數不執行 JavaScript。
 *   用 React / Vue / Next CSR 產生內容的網站，人在瀏覽器看得到、爬蟲拿到的原始碼卻是空的。
 *   這種站補再多 meta 標籤都沒用 —— 要處理的是伺服器端渲染（SSR / SSG / 預渲染）。
 *   沒有這條警示，掃出來的低分會被誤讀成「我網站內容不夠」，把力氣花在錯的地方。
 *
 * 誠實邊界（品牌承諾：寧可少講不誇大）：
 *   確定性分兩級，不混為一談 ——
 *     csr   ：抓到已知框架的空掛載點 / SPA 專用 noscript → 可以直說「這是 JS 渲染」
 *     empty ：讀到的內容極少但看不出框架 → 只能說「我們讀到的幾乎是空白」，不能斷定是 SPA
 *     thin  ：內容偏少，一行小字提醒就好，不跳警示框（頁面本來就短是很正常的事）
 *   「字少就喊 SPA」會對真的很短的頁面誤判，那是我們不做的事。
 *
 * 分工：classifyRender() 是純函式（可單測，見 renderMode.test.js）；
 *       detectRenderMode() 只負責從 DOM 把數字挖出來再交給它。
 */

// 讀到多少可見字以下，算「幾乎沒東西」（與 headings===0 併用）
const EMPTY_CHARS = 600
// 讀到多少可見字以下，算「內容偏少」
const THIN_CHARS = 1200
// 掛載點內部可見字少於這個數，視為空殼（React 掛載前通常完全是空的，留點寬容給 loading 字樣）
const MOUNT_EMPTY_CHARS = 60

/**
 * 已知的 SPA 掛載點：選擇器 → 框架名。
 * 順序＝優先序：專屬 id（#__next）比通用 id（#root）更有辨識度，先比對專屬的。
 */
const MOUNT_POINTS = [
  ['[data-reactroot]', 'React'],
  ['#__next', 'Next.js'],
  ['#__nuxt', 'Nuxt'],
  ['#___gatsby', 'Gatsby'],
  ['[ng-version]', 'Angular'],
  ['[ng-app]', 'AngularJS'],
  ['#root', 'React / Vite'],
  ['#app', 'Vue / Vite'],
]

// SPA 樣板預設的 noscript 字樣（CRA / Vite / Angular 都會放）——出現＝這頁本來就靠 JS 撐
const NOSCRIPT_HINT = /you need to enable javascript|enable javascript to run this app|請啟用\s*JavaScript|需要啟用\s*JavaScript/i

// 不算「可見內容」的節點：腳本、樣式、樣板、SVG 內文（<svg> 裡的 <title> 會污染字數）
const INVISIBLE_SELECTOR = 'script,style,noscript,template,svg'

/**
 * 算一個節點的可見字數（去掉腳本/樣式/樣板，再去掉所有空白）。
 * 用去空白後的長度，中英文都適用 —— 這裡只要量級對，不需要精算詞數。
 */
function visibleChars(node) {
  if (!node?.cloneNode) return 0
  const clone = node.cloneNode(true)
  clone.querySelectorAll?.(INVISIBLE_SELECTOR).forEach(n => n.remove())
  return (clone.textContent || '').replace(/\s+/g, '').length
}

/**
 * 純判定：把挖好的訊號換成等級。
 * @param {{chars:number, headings:number, mountEmpty:boolean, noscriptHint:boolean}} signals
 * @returns {'csr'|'empty'|'thin'|'ok'}
 */
export function classifyRender({ chars = 0, headings = 0, mountEmpty = false, noscriptHint = false } = {}) {
  // 有框架證據，但仍要求「內容真的少」才報 —— SSR 過的 Next.js 也有 #__next，
  // 那種站內容是滿的，不該被貼上「AI 讀不到」的標籤（誤報比漏報傷用戶）。
  if ((mountEmpty || noscriptHint) && chars < THIN_CHARS) return 'csr'
  // 沒有框架證據：只有在「字極少 + 完全沒有標題結構」時才說讀到空白
  if (chars < EMPTY_CHARS && headings === 0) return 'empty'
  // 內容偏少 —— 提醒等級，不是警示等級
  if (chars < THIN_CHARS && headings < 2) return 'thin'
  return 'ok'
}

/**
 * 從已解析的 DOM 判斷這一頁是不是「AI 爬蟲讀不到內容」。
 * @param {Document} doc - parseHTML() 的產物
 * @returns {{level:'csr'|'empty'|'thin'|'ok', chars:number, headings:number, framework:string|null}}
 */
export function detectRenderMode(doc) {
  const body = doc?.body
  if (!body) return { level: 'ok', chars: 0, headings: 0, framework: null }

  const chars = visibleChars(body)
  const headings = doc.querySelectorAll('h1,h2,h3').length

  // 找空掛載點：掛載點存在、但裡面幾乎沒字 → 內容是掛載後才長出來的
  let framework = null
  let mountEmpty = false
  for (const [selector, name] of MOUNT_POINTS) {
    const mount = doc.querySelector(selector)
    if (!mount) continue
    framework = name
    if (visibleChars(mount) < MOUNT_EMPTY_CHARS) { mountEmpty = true; break }
    // 掛載點有內容 → 這個框架有做 SSR，不再往下找通用 id（避免 #app 誤判）
    break
  }

  const noscript = doc.querySelector('noscript')
  const noscriptHint = NOSCRIPT_HINT.test(noscript?.textContent || '')

  const level = classifyRender({ chars, headings, mountEmpty, noscriptHint })
  // 沒抓到框架但確定是 CSR（只有 noscript 證據）→ framework 留 null，文案不硬掰框架名
  return { level, chars, headings, framework: level === 'csr' ? framework : null }
}

/**
 * 顯示層文案 —— 暗色版（HomeDark / AnonDiagnosis）與亮色版（HomeLight）共用同一份，
 * 措辭只在這裡改，避免兩邊講不一樣的話。
 * @returns {{tone:'warn'|'note', title:string, lines:string[]}|null} ok 等級回 null（不顯示）
 */
export function renderModeNotice(render) {
  if (!render || render.level === 'ok') return null
  const { level, chars, headings, framework } = render

  if (level === 'csr') {
    return {
      tone: 'warn',
      title: framework
        ? `這一頁的內容是 JavaScript 產生的（偵測到 ${framework}）`
        : '這一頁的內容是 JavaScript 產生的',
      lines: [
        `我們用 AI 爬蟲的方式抓這一頁，原始碼裡只讀到 ${chars} 個字${headings === 0 ? '、而且沒有任何標題結構' : ''}——內容要等瀏覽器執行完 JavaScript 才會出現。`,
        '人用瀏覽器看得到，但 GPTBot、ClaudeBot 這些多數不執行 JavaScript 的 AI 爬蟲，拿到的就是這份空殼。',
        '所以下面的分數是「AI 爬蟲實際讀到的東西」，不代表你的網站沒有內容。這種情況補 meta 標籤沒有用，要處理的是伺服器端渲染（SSR / SSG / 預渲染）。',
      ],
    }
  }

  if (level === 'empty') {
    return {
      tone: 'warn',
      title: '我們讀到的原始碼幾乎是空白',
      lines: [
        `這一頁只讀到 ${chars} 個字，也沒有任何標題結構。`,
        '可能是內容要靠 JavaScript 才長出來（AI 爬蟲多半讀不到），也可能這一頁本來就沒放什麼內容——從原始碼看不出是哪一種，我們不猜。',
        '但可以確定的是：AI 爬蟲讀到的就是這麼多，下面的分數是照這份原始碼算的。',
      ],
    }
  }

  // thin：低調提醒，不用警示框
  return {
    tone: 'note',
    title: '這一頁的內容偏少',
    lines: [
      `原始碼裡讀到 ${chars} 個字、${headings} 個標題。內容少不一定是問題，但 AI 比較難從這一頁抓到可以引用的段落。`,
    ],
  }
}
