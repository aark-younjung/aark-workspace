# 優勢方舟 AI 能見度儀表板

> 全面檢測網站 SEO、AEO 與 Google 商家表現的 SaaS 儀表板

## 🚀 功能特色

- **首頁** - 輸入網址即可進行 AI 能見度檢測
- **儀表板** - 顯示 SEO、AEO、GEO 分數與趨勢圖表
- **AEO 技術檢測** - 8項 AI 搜尋優化技術指標檢測

## 🛠️ 技術堆疊

- **前端框架**: React (Vite)
- **圖表庫**: Recharts
- **樣式**: Tailwind CSS
- **資料庫**: Supabase
- **後端**: n8n

## 📋 AEO 技術檢測項目

1. JSON-LD 結構化資料
2. LLMs.txt 檔案
3. Open Graph 標籤
4. Twitter Card 標籤
5. Canonical 標籤
6. 麵包屑導航
7. FAQ 結構化資料
8. HowTo 結構化資料

## 🏁 快速開始

### 安裝依賴

```bash
cd aark-dashboard
npm install
```

### 啟動開發伺服器

```bash
npm run dev
```

### 建置生產版本

```bash
npm run build
```

## 🔧 環境變數

確保在 `.env` 中設定 Supabase 連線資訊：

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📁 專案結構

```
aark-dashboard/
├── src/
│   ├── lib/
│   │   └── supabase.js      # Supabase 用戶端
│   ├── pages/
│   │   ├── Home.jsx        # 首頁（網址輸入）
│   │   ├── Dashboard.jsx  # 儀表板結果頁面
│   │   └── AEOAudit.jsx    # AEO 技術檢測頁面
│   ├── App.jsx             # 路由配置
│   ├── main.jsx            # 入口點
│   └── index.css           # 全域樣式
├── index.html
├── vite.config.js
└── package.json
```

## 🔐 GitHub 推送說明

如果您需要將程式碼推送到 GitHub，請確保已配置 Git 憑證：

```bash
# 方法 1: 使用 GitHub CLI
gh auth login

# 方法 2: 使用 Personal Access Token
git remote add origin https://github.com/aark-younjung/aark-workspace.git
git push -u origin master
```

## 📄 授權

MIT License
