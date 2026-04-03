/**
 * 修復指南資料
 * 每個問題 ID 對應四個平台的逐步操作說明
 * platforms: wordpress | shopify | wix | html
 */

export const FIX_GUIDES = {

  // ─── SEO ────────────────────────────────────────────────────
  meta_title: {
    summary: '在網頁 <head> 加入 30–60 字的 <title> 標籤，前半段放關鍵字',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Yoast SEO」或「Rank Math」外掛（免費版即可）',
          '進入後台 → 頁面/文章編輯畫面',
          '滾動到頁面最下方，找到 Yoast SEO 或 Rank Math 區塊',
          '點「SEO 標題」欄位，填入：主題關鍵字 | 品牌名稱',
          '長度控制在 30–60 字，點擊「更新」儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '進入 Shopify 後台 → 線上商店 → 頁面（或商品）',
          '打開要修改的頁面',
          '滾動到最下方「搜尋引擎列表預覽」',
          '點「編輯網站 SEO」',
          '在「頁面標題」欄位輸入 30–60 字的標題，儲存',
        ],
        code: null,
      },
      wix: {
        steps: [
          '進入 Wix 編輯器，點選左側「SEO」',
          '選擇「基本 SEO」→「標題標籤」',
          '填入：主題關鍵字 | 品牌名稱（30–60 字）',
          '點「發布」儲存變更',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開網站的 HTML 檔案（通常是 index.html）',
          '找到 <head> 標籤',
          '加入或修改 <title> 標籤（見下方程式碼）',
          '上傳修改後的檔案到主機',
        ],
        code: `<head>\n  <title>你的頁面主題 | 品牌名稱</title>\n</head>`,
      },
    },
  },

  meta_desc: {
    summary: '在 <head> 加入 70–155 字的 Meta 描述，自然帶入關鍵字並加行動呼籲',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Yoast SEO」或「Rank Math」外掛',
          '進入頁面/文章編輯畫面，找到 SEO 外掛區塊',
          '點「Meta 描述」欄位',
          '寫入 70–155 字的描述，例如：「[品牌] 提供… 立即免費試用」',
          '儲存頁面',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 頁面 → 打開頁面',
          '點下方「編輯網站 SEO」',
          '在「描述」欄位填入 70–155 字',
          '儲存',
        ],
        code: null,
      },
      wix: {
        steps: [
          'Wix 編輯器 → SEO → 基本 SEO',
          '找「描述標籤」欄位',
          '填入 70–155 字的描述',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開 HTML 檔案，找到 <head>',
          '加入 meta description 標籤（見下方）',
          '上傳到主機',
        ],
        code: `<meta name="description" content="你的服務描述，自然帶入關鍵字，結尾加上行動呼籲，長度 70–155 字。">`,
      },
    },
  },

  h1_structure: {
    summary: '每個頁面只保留一個 H1 標籤，清楚說明頁面核心主題',
    platforms: {
      wordpress: {
        steps: [
          '進入頁面編輯，切換到「程式碼編輯器」（區塊編輯器右上角「⋮」→「程式碼編輯器」）',
          '搜尋 <h1>，確認全頁只有一個',
          '多餘的 <h1> 改成 <h2> 或 <h3>',
          '頁面標題欄位（最上方的 Title）通常就是主要 H1，不要再加',
          '儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 主題 → 編輯程式碼',
          '找到對應頁面的 Liquid 模板',
          '搜尋 <h1>，確認只有一個，其餘改為 <h2>',
          '儲存',
        ],
        code: null,
      },
      wix: {
        steps: [
          '進入 Wix 編輯器，點選頁面上的文字元素',
          '右側面板查看「文字樣式」，確認只有一個元素設為「標題 1（H1）」',
          '其餘大標題改為「標題 2（H2）」',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開 HTML 檔案，搜尋 <h1',
          '確認全頁只有一個 <h1> 標籤',
          '多餘的改為 <h2> 或 <h3>',
          '上傳到主機',
        ],
        code: `<!-- 正確：只有一個 H1 -->\n<h1>你的頁面核心主題（含關鍵字）</h1>\n\n<!-- 次級標題改用 H2 -->\n<h2>次標題</h2>`,
      },
    },
  },

  alt_tags: {
    summary: '為每張圖片加入描述性 alt 屬性，讓 Google 和 AI 理解圖片內容',
    platforms: {
      wordpress: {
        steps: [
          '後台 → 媒體庫，點選要修改的圖片',
          '右側「替代文字」欄位填入描述（例如：「台北辦公室外觀 2024」）',
          '或在頁面編輯時點選圖片 → 右側面板 → 「Alt 文字」',
          '避免空白或「圖片」這類無意義描述',
          '儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 內容 → 檔案，或到商品編輯頁',
          '點選圖片 → 「編輯替代文字」',
          '填入描述性文字',
          '儲存',
        ],
        code: null,
      },
      wix: {
        steps: [
          '在編輯器中點選圖片',
          '點右上角「設定」圖示',
          '找到「替代文字」欄位填入描述',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '找到 HTML 中所有 <img> 標籤',
          '確認每個都有 alt="" 屬性',
          '填入描述性文字（非空白）',
          '上傳到主機',
        ],
        code: `<!-- 錯誤 -->\n<img src="photo.jpg">\n<img src="photo.jpg" alt="">\n\n<!-- 正確 -->\n<img src="photo.jpg" alt="台北信義區辦公室外觀">`,
      },
    },
  },

  mobile_compatible: {
    summary: '在 <head> 加入 viewport meta 標籤，確保手機版正常顯示',
    platforms: {
      wordpress: {
        steps: [
          '大多數現代主題已內建 viewport 設定，先確認主題是否有效',
          '若沒有，後台 → 外觀 → 主題編輯器 → header.php',
          '在 <head> 標籤後加入 viewport meta（見下方程式碼）',
          '儲存',
        ],
        code: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 主題 → 編輯程式碼',
          '打開 layout/theme.liquid',
          '在 <head> 後加入 viewport meta',
          '儲存',
        ],
        code: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
      },
      wix: {
        steps: [
          'Wix 平台已自動處理行動版相容，通常不需手動設定',
          '確認「行動版預覽」開啟並正常顯示即可',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開 HTML 檔案，找到 <head>',
          '加入 viewport meta 標籤（見下方）',
          '上傳到主機',
        ],
        code: `<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>`,
      },
    },
  },

  page_speed: {
    summary: '壓縮圖片、減少不必要的 JS/CSS、使用 CDN 可大幅提升載入速度',
    platforms: {
      wordpress: {
        steps: [
          '安裝「WP Rocket」（付費）或「W3 Total Cache」（免費）快取外掛',
          '安裝「Smush」或「ShortPixel」自動壓縮圖片',
          '後台 → 設定 → 啟用 Gzip 壓縮',
          '考慮使用 Cloudflare（免費 CDN）加速全球存取',
          '用 Google PageSpeed Insights 驗證改善效果',
        ],
        code: null,
      },
      shopify: {
        steps: [
          'Shopify 已內建 CDN，圖片會自動最佳化',
          '確認上傳的圖片不超過 1MB（建議使用 WebP 格式）',
          '減少安裝的 App 數量（每個 App 都會增加載入時間）',
          '主題程式碼中避免過多第三方腳本',
        ],
        code: null,
      },
      wix: {
        steps: [
          'Wix 已內建自動圖片最佳化，確認已開啟',
          '網站設定 → 效能 → 開啟「迷你化資源」',
          '避免在頁面放置過多動畫效果',
        ],
        code: null,
      },
      html: {
        steps: [
          '將圖片轉換為 WebP 格式（可用 Squoosh 線上工具）',
          '加入 loading="lazy" 讓圖片延遲載入',
          '將 CSS/JS 檔案壓縮（Minify）',
          '使用 Cloudflare 作為免費 CDN',
        ],
        code: `<!-- 延遲載入圖片 -->\n<img src="photo.webp" alt="描述" loading="lazy">`,
      },
    },
  },

  // ─── AEO ────────────────────────────────────────────────────
  json_ld: {
    summary: '在 <head> 加入 JSON-LD 結構化資料，讓 AI 和搜尋引擎精確理解你的網站',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Schema Pro」或「Rank Math」外掛',
          '後台 → Schema → 新增 Schema → 選擇「Organization」或「LocalBusiness」',
          '填入公司名稱、網址、描述、Logo',
          '儲存，外掛會自動注入到頁面',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 主題 → 編輯程式碼',
          '打開 layout/theme.liquid',
          '在 </head> 前加入 JSON-LD 腳本（見下方）',
          '儲存',
        ],
        code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "你的品牌名稱",\n  "url": "https://你的網址.com",\n  "description": "一句話描述你的服務",\n  "logo": "https://你的網址.com/logo.png"\n}\n</script>`,
      },
      wix: {
        steps: [
          'Wix 編輯器 → 設定 → SEO → 結構化資料',
          '選擇「Organization」類型',
          '填入品牌名稱、網址、描述',
          '或透過「Wix SEO Wiz」引導設定',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開 HTML 檔案，找到 </head>',
          '在 </head> 前加入 JSON-LD 腳本（見下方）',
          '修改為你自己的資訊',
          '上傳到主機',
        ],
        code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "你的品牌名稱",\n  "url": "https://你的網址.com",\n  "description": "一句話描述你的服務",\n  "logo": "https://你的網址.com/logo.png",\n  "contactPoint": {\n    "@type": "ContactPoint",\n    "email": "contact@你的網址.com"\n  }\n}\n</script>`,
      },
    },
  },

  faq_schema: {
    summary: '為常見問題頁面加入 FAQ Schema，讓 AI 問答引擎直接引用你的答案',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Rank Math」外掛',
          '編輯含有 FAQ 的頁面',
          '在 Rank Math Schema 區塊選「FAQ Page」',
          '逐一填入問題和答案',
          '儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 頁面 → 打開 FAQ 頁面',
          '點選「顯示 HTML」',
          '在頁面最後加入 FAQ JSON-LD（見下方範例）',
          '儲存',
        ],
        code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "你的常見問題一？",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "問題一的詳細答案。"\n      }\n    },\n    {\n      "@type": "Question",\n      "name": "你的常見問題二？",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "問題二的詳細答案。"\n      }\n    }\n  ]\n}\n</script>`,
      },
      wix: {
        steps: [
          '在 FAQ 頁面加入 Wix 的「手風琴」或「FAQ」元件',
          '到 SEO → 結構化資料 → 手動加入 JSON-LD',
          '填入問題與答案',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '在 FAQ 頁面的 HTML 中，於 </head> 前加入 FAQ Schema（見下方）',
          '替換為你的實際問題和答案',
          '上傳到主機',
        ],
        code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "你的常見問題？",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "詳細答案內容。"\n      }\n    }\n  ]\n}\n</script>`,
      },
    },
  },

  canonical: {
    summary: '加入 canonical 標籤，告訴搜尋引擎這個頁面的標準網址',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Yoast SEO」後預設會自動加入 canonical',
          '若需手動設定，在 Yoast SEO 區塊 → 「進階」→ 指定 canonical URL',
          '儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          'Shopify 主題通常已自動加入 canonical',
          '如需確認或手動設定，後台 → 主題 → 編輯程式碼 → layout/theme.liquid',
          '確認有 {{ canonical_url | canonical_tag }}',
        ],
        code: `{{ canonical_url | canonical_tag }}`,
      },
      wix: {
        steps: [
          'Wix 會自動生成 canonical 標籤',
          '若需自訂，進入 SEO 設定 → 進階 → canonical URL',
          '填入正確的標準網址',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '打開 HTML，在 <head> 內加入 canonical 標籤（見下方）',
          '將 href 改為此頁面的完整 URL',
          '上傳到主機',
        ],
        code: `<link rel="canonical" href="https://你的網址.com/此頁面路徑">`,
      },
    },
  },

  open_graph: {
    summary: '加入 Open Graph 標籤，讓分享到社群媒體時顯示正確的標題和縮圖',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Yoast SEO」，它會自動生成 OG 標籤',
          '進入頁面編輯 → Yoast SEO → 「社群」標籤',
          '設定 Facebook/Twitter 分享用的標題、描述、圖片',
          '建議圖片尺寸：1200×630px',
          '儲存',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 主題 → 編輯程式碼 → layout/theme.liquid',
          '在 <head> 內加入 OG 標籤（見下方）',
          '儲存',
        ],
        code: `<meta property="og:title" content="{{ page_title }}">\n<meta property="og:description" content="{{ page_description }}">\n<meta property="og:url" content="{{ canonical_url }}">\n<meta property="og:type" content="website">`,
      },
      wix: {
        steps: [
          'Wix 編輯器 → SEO → 社群分享',
          '設定分享標題、描述、圖片',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '在 HTML 的 <head> 內加入 OG 標籤（見下方）',
          '替換為你的實際資訊',
          '上傳到主機',
        ],
        code: `<meta property="og:title" content="你的頁面標題">\n<meta property="og:description" content="你的頁面描述（150字以內）">\n<meta property="og:url" content="https://你的網址.com">\n<meta property="og:type" content="website">\n<meta property="og:image" content="https://你的網址.com/og-image.jpg">`,
      },
    },
  },

  // ─── GEO ────────────────────────────────────────────────────
  llms_txt: {
    summary: '在網站根目錄建立 llms.txt，讓 AI 爬蟲快速了解你的網站內容',
    platforms: {
      wordpress: {
        steps: [
          '後台 → 外掛 → 安裝外掛，搜尋「llms.txt」',
          '或透過 FTP 在網站根目錄（public_html/）建立 llms.txt 檔案',
          '填入你的品牌名稱、服務描述、重要頁面連結',
          '儲存並確認可透過 https://你的網址.com/llms.txt 存取',
        ],
        code: `# 品牌名稱\n\n## 關於我們\n一句話描述你的服務\n\n## 主要頁面\n- [首頁](https://你的網址.com/)\n- [服務](https://你的網址.com/services)\n- [關於我們](https://你的網址.com/about)\n- [聯絡](https://你的網址.com/contact)`,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 主題 → 編輯程式碼',
          '在「Assets」資料夾新增 llms.txt.liquid 檔案',
          '或透過 Shopify 的「靜態頁面」功能建立',
          '填入品牌資訊和主要頁面連結',
        ],
        code: `# 品牌名稱\n\n## 關於\n你的服務描述\n\n## 主要頁面\n- 首頁: https://你的網址.myshopify.com\n- 商品: https://你的網址.myshopify.com/collections/all`,
      },
      wix: {
        steps: [
          'Wix 目前不支援直接建立 llms.txt',
          '可使用 Wix Velo（開發者模式）建立路由返回 llms.txt 內容',
          '或考慮遷移到支援靜態檔案的平台',
        ],
        code: null,
      },
      html: {
        steps: [
          '在網站根目錄（與 index.html 同一層）建立 llms.txt 檔案',
          '填入品牌資訊（見下方範本）',
          '上傳到主機',
          '確認可透過 https://你的網址.com/llms.txt 存取',
        ],
        code: `# 你的品牌名稱\n\n> 一句話描述你的服務和目標族群\n\n## 關於\n詳細的服務介紹，2-3 句話\n\n## 重要頁面\n- [首頁](https://你的網址.com/)\n- [服務介紹](https://你的網址.com/services)\n- [關於我們](https://你的網址.com/about)\n- [聯絡我們](https://你的網址.com/contact)\n\n## 聯絡\nemail: contact@你的網址.com`,
      },
    },
  },

  // ─── E-E-A-T ────────────────────────────────────────────────
  author_info: {
    summary: '在文章和頁面加入作者資訊，提升 AI 對你網站內容可信度的評估',
    platforms: {
      wordpress: {
        steps: [
          '後台 → 使用者 → 你的帳號',
          '填寫「簡介」欄位（100-200 字，說明你的專業背景）',
          '上傳大頭照',
          '文章使用「作者」區塊顯示（大多數主題支援）',
          '或安裝「Simple Author Box」外掛顯示作者卡片',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 網誌文章',
          '在文章底部加入作者介紹段落',
          '或在主題中加入作者資訊區塊',
          '確保 JSON-LD 中包含 author 欄位',
        ],
        code: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "author": {\n    "@type": "Person",\n    "name": "作者姓名",\n    "description": "作者專業背景簡介"\n  }\n}\n</script>`,
      },
      wix: {
        steps: [
          '在 Wix Blog 的文章設定中填入作者資訊',
          '後台 → 部落格 → 作者設定',
          '填入姓名、大頭照、簡介',
          '發布',
        ],
        code: null,
      },
      html: {
        steps: [
          '在每篇文章頁面加入作者介紹區塊（見下方範例）',
          '並在 <head> 加入 author meta 標籤',
          '上傳到主機',
        ],
        code: `<!-- Meta 標籤 -->\n<meta name="author" content="作者姓名">\n\n<!-- 頁面內作者介紹 -->\n<div class="author-bio">\n  <img src="/author.jpg" alt="作者姓名">\n  <h3>作者姓名</h3>\n  <p>100-200 字的專業背景介紹</p>\n</div>`,
      },
    },
  },

  contact_page: {
    summary: '建立聯絡頁面，讓 Google 和 AI 確認這是真實存在的機構',
    platforms: {
      wordpress: {
        steps: [
          '後台 → 頁面 → 新增頁面，標題設為「聯絡我們」',
          '安裝「WPForms」或「Contact Form 7」外掛建立表單',
          '加入：公司地址、Email、電話、聯絡表單',
          '在頁尾選單加入聯絡頁連結',
          '發布',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 線上商店 → 頁面 → 新增頁面',
          '標題：聯絡我們，範本選「contact」',
          'Shopify 會自動產生聯絡表單',
          '加入地址、Email 等資訊',
          '儲存並加到導覽選單',
        ],
        code: null,
      },
      wix: {
        steps: [
          '新增頁面，選擇「聯絡我們」範本',
          '加入 Wix Forms 聯絡表單元件',
          '填入公司資訊',
          '發布並加入選單',
        ],
        code: null,
      },
      html: {
        steps: [
          '建立 contact.html 頁面',
          '加入公司名稱、地址、Email、電話',
          '加入聯絡表單（可用 Formspree 等免費服務）',
          '在所有頁面的頁尾或選單加入連結',
          '上傳到主機',
        ],
        code: `<!-- 聯絡資訊 -->\n<address>\n  <p>公司名稱：你的公司</p>\n  <p>Email：<a href="mailto:contact@你的網址.com">contact@你的網址.com</a></p>\n  <p>電話：+886-2-XXXX-XXXX</p>\n  <p>地址：台灣 XXX 市 XXX 路 XXX 號</p>\n</address>`,
      },
    },
  },

  privacy_policy: {
    summary: '建立隱私權政策頁面，這是 Google 評估網站可信度的必要條件',
    platforms: {
      wordpress: {
        steps: [
          '後台 → 設定 → 隱私權，WordPress 有內建隱私權頁面產生器',
          '點「建立頁面」，WordPress 會產生基本範本',
          '修改為符合你實際情況的內容（收集哪些資料、如何使用）',
          '發布並加入頁尾連結',
        ],
        code: null,
      },
      shopify: {
        steps: [
          '後台 → 設定 → 法律',
          '點「從範本建立」→「隱私權政策」',
          'Shopify 會產生基本範本，修改為你的實際情況',
          '儲存，頁面會自動出現在頁尾',
        ],
        code: null,
      },
      wix: {
        steps: [
          'Wix 新增頁面，選擇「隱私權政策」範本',
          '修改內容符合你的實際情況',
          '發布並加入頁尾',
        ],
        code: null,
      },
      html: {
        steps: [
          '建立 privacy.html 頁面',
          '可使用 Privacy Policy Generator 等免費工具產生基本內容',
          '至少包含：收集哪些資料、Cookie 政策、聯絡方式',
          '在頁尾所有頁面加入連結',
          '上傳到主機',
        ],
        code: `<!-- 頁尾加入連結 -->\n<footer>\n  <a href="/privacy">隱私權政策</a>\n  <a href="/terms">服務條款</a>\n</footer>`,
      },
    },
  },
}

export const PLATFORMS = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'wix', label: 'Wix' },
  { id: 'html', label: '自架 / HTML' },
]
