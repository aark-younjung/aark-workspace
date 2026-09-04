// 執行：node --test src/lib/renderMode.test.js
// 只測純函式 classifyRender / renderModeNotice —— detectRenderMode 需要 DOM，交給實掃驗證。
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyRender, renderModeNotice } from './renderMode.js'

test('空掛載點 + 內容極少 → csr（確定是 JS 渲染）', () => {
  assert.equal(classifyRender({ chars: 40, headings: 0, mountEmpty: true }), 'csr')
})

test('SPA noscript 字樣也算證據', () => {
  assert.equal(classifyRender({ chars: 300, headings: 1, noscriptHint: true }), 'csr')
})

test('SSR 過的 Next.js 不該被誤報 —— 有 #__next 但內容是滿的', () => {
  // mountEmpty=false：掛載點裡有字，代表伺服器已經把內容吐出來了
  assert.equal(classifyRender({ chars: 5200, headings: 14, mountEmpty: false }), 'ok')
})

test('內容很多但仍留著 SPA noscript → 不報（誤報比漏報傷用戶）', () => {
  assert.equal(classifyRender({ chars: 4000, headings: 12, noscriptHint: true }), 'ok')
})

test('沒有框架證據、字極少且無標題 → empty（只說讀到空白，不斷定是 SPA）', () => {
  assert.equal(classifyRender({ chars: 120, headings: 0 }), 'empty')
})

test('字少但有標題結構 → thin，不是 empty', () => {
  assert.equal(classifyRender({ chars: 400, headings: 1 }), 'thin')
})

test('內容量正常 → ok', () => {
  assert.equal(classifyRender({ chars: 3000, headings: 8 }), 'ok')
})

test('剛好踩在門檻上：600 字 0 標題不算 empty，599 才算', () => {
  assert.equal(classifyRender({ chars: 600, headings: 0 }), 'thin')
  assert.equal(classifyRender({ chars: 599, headings: 0 }), 'empty')
})

test('沒傳參數不炸，回 ok 以外的最保守值', () => {
  // 全 0 = chars 0、headings 0 → empty（讀不到任何東西本來就該講）
  assert.equal(classifyRender(), 'empty')
})

test('ok 等級不產生提示', () => {
  assert.equal(renderModeNotice({ level: 'ok' }), null)
  assert.equal(renderModeNotice(null), null)
})

test('csr 文案帶框架名，thin 是 note 不是 warn', () => {
  const csr = renderModeNotice({ level: 'csr', chars: 30, headings: 0, framework: 'React / Vite' })
  assert.equal(csr.tone, 'warn')
  assert.match(csr.title, /React \/ Vite/)
  assert.equal(csr.lines.length, 3)

  const thin = renderModeNotice({ level: 'thin', chars: 400, headings: 1, framework: null })
  assert.equal(thin.tone, 'note')
  assert.equal(thin.lines.length, 1)
})

test('csr 沒抓到框架名時不硬掰', () => {
  const csr = renderModeNotice({ level: 'csr', chars: 30, headings: 0, framework: null })
  assert.equal(csr.title, '這一頁的內容是 JavaScript 產生的')
})
