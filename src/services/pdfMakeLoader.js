/**
 * pdfMakeLoader — pdfmake + 中文字體 lazy loader（2026-06-08）
 *
 * 為什麼要 lazy load：
 *   - pdfmake 本身約 800 KB
 *   - Noto Sans TC 字體約 11 MB（變數字型、涵蓋 wght 100-900）
 *   - 兩者合計約 12 MB、不可能 eager load
 *   - 用 dynamic import + fetch 在「使用者按下匯出 PDF」時才載入
 *   - 載入後 module-level cache、之後同一個 session 用就是 instant
 *
 * 字體選擇：
 *   - Noto Sans TC（SIL Open Font License、可商用）
 *   - 變數字型、normal / bold 都用同一檔（pdfmake 不真支援 VF axis、但會 embed 並用預設權重渲染）
 *   - 真要視覺上有 bold 區隔、改用 color / size / spacing 表現、不依賴 fontWeight
 *
 * 為什麼不直接 import 'pdfmake/build/pdfmake'：
 *   - 那個 entry 自帶 Roboto vfs、bundle 多 200 KB 又用不到
 *   - 改用 'pdfmake/build/pdfmake.min' + 自定 vfs / fonts
 */

let _pdfMakeInstance = null
let _fontLoadPromise = null

async function loadFontAsBase64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${url}`)
  const buf = await res.arrayBuffer()
  // 把 ArrayBuffer 轉 base64（chunk 處理、避免 stack overflow）
  const bytes = new Uint8Array(buf)
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * 取得 pdfMake instance、字體已註冊好可直接用
 * 第一次呼叫會 dynamic import + 下載字體（約 3-5 秒）、之後 instant
 */
export async function getPdfMake() {
  if (_pdfMakeInstance) return _pdfMakeInstance
  if (_fontLoadPromise) return _fontLoadPromise

  _fontLoadPromise = (async () => {
    // dynamic import — 只有按下匯出時才載入這 800 KB
    const pdfMakeModule = await import('pdfmake/build/pdfmake')
    const pdfMake = pdfMakeModule.default || pdfMakeModule

    // 從 /public/fonts/ 抓字體（Vercel edge 會 cache）
    const fontBase64 = await loadFontAsBase64('/fonts/NotoSansTC-Regular.ttf')

    // 註冊到 pdfmake 的虛擬檔案系統
    pdfMake.vfs = {
      'NotoSansTC-Regular.ttf': fontBase64,
    }

    // 定義字型族 — normal / bold 都用同一檔（VF 字體、暫不支援真 bold）
    pdfMake.fonts = {
      NotoSansTC: {
        normal: 'NotoSansTC-Regular.ttf',
        bold: 'NotoSansTC-Regular.ttf',
        italics: 'NotoSansTC-Regular.ttf',
        bolditalics: 'NotoSansTC-Regular.ttf',
      },
    }

    _pdfMakeInstance = pdfMake
    return pdfMake
  })()

  return _fontLoadPromise
}
