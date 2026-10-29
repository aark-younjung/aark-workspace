import { defineConfig } from 'vite'

/**
 * 嵌入版掃描核心的獨立打包設定（`npm run build:embed`）。
 *
 * 產物：public/embed/aark-radar-embed.js —— 一支 IIFE，掛出全域 `AarkRadar`。
 * 放在 public/ 是為了讓它跟著主站一起部署，網址固定在
 * https://aark-workspace.vercel.app/embed/aark-radar-embed.js
 *
 * 沒有 React、沒有 Tailwind、沒有 Supabase：只有四個分析器與它們的相依工具。
 * 畫面由嵌入端自己畫（目前是 www.a-ark.com.tw 的官網頁面）。
 */
export default defineConfig({
  // outDir 就在 public/ 底下，如果再把 public/ 當靜態來源，vite 會一邊清空一邊複製
  // ——第二次以後的建置會直接讓 rollup 崩掉（Windows 上是 0xC0000409）。
  // 這個 build 不需要任何靜態資產，關掉最乾淨。
  publicDir: false,
  build: {
    outDir: 'public/embed',
    // ⚠ 不要改成 true。Windows 上 emptyOutDir 清掉一個「已存在」的 outDir 之後，
    // rollup 會在 rendering chunks 階段直接崩掉（exit -1073740791 / 0xC0000409），
    // 而且第一次建置會成功、之後每次都失敗 —— 症狀是產物悄悄停在舊版本。
    // 這個 build 只產一支檔案，覆蓋就夠了。
    emptyOutDir: false,
    target: 'es2018',
    lib: {
      entry: 'src/embed/radar-embed.js',
      name: 'AarkRadar',
      formats: ['iife'],
      fileName: () => 'aark-radar-embed.js',
    },
    rollupOptions: {
      output: { extend: true, exports: 'named' },
    },
  },
})
