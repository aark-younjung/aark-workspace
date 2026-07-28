/**
 * 修復指南資料
 * 每個問題 ID 對應四個平台的逐步操作說明
 * platforms: wordpress | shopify | wix | html
 */

export const FIX_GUIDES = {

  // ─── SEO ────────────────────────────────────────────────────
  meta_title: {
    summary: 'WordPress 用 Rank Math／Yoast 的「SEO 標題」欄位（Shopify／Wix 在 SEO 設定）填 30–60 字、前半段放關鍵字；自架站在 <head> 放 <title>。',
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
    summary: 'WordPress 用 Rank Math／Yoast 的「Meta 描述」欄位（Shopify／Wix 在 SEO 設定）填 70–155 字、帶關鍵字並加行動呼籲；自架站在 <head> 加 <meta name="description">。',
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
    // 兩個情境完全不同的修法：missing = 補一個 / too_many = 刪多餘
    // IssueBoard FixPanel 會根據 check.scenario 自動選用對應 scenarios.xxx，沒指定就用 platforms[id]
    // 同時保留 platforms 給沒 scenario 標記的 fallback case
    platforms: {
      wordpress: {
        scenarios: {
          missing: {
            title: '頁面 0 個 H1 — 通常是 page builder 用 div 代替 H1',
            steps: [
              '判斷你的頁面是用什麼工具編輯：WPBakery / Elementor / Divi / Bricks / Astra Builder / Beaver Builder / 區塊編輯器（Gutenberg）— 第一行最關鍵，不確定可在後台「頁面 → 編輯」看上方工具列',
              '【WPBakery（Visual Composer）】編輯該頁 → 切「Backend Editor」→ 滑鼠移到主標元素點 ✏️ → 若是「Custom Heading」元素，找「Element tag」下拉改 h1；若是「Text Block」，把標題那行的「段落 P」改「標題 1」→ 儲存 → 更新',
              '【Elementor】編輯該頁 → 找最大標題 widget（Heading 或 Hero 主標）→ 左側面板「內容」→ 「HTML 標籤（HTML Tag）」下拉改 H1 → 更新',
              '【Divi】編輯該頁 → 點 Hero 主標模組 → 設定 → 內容 → Title 欄位下方「H 級別」改 H1 → 儲存',
              '【Bricks】編輯該頁 → 點主標 element → 右側設定 → 「Tag」改 h1 → 儲存',
              '【區塊編輯器（Gutenberg）】少見；一般文章/頁面標題欄位通常會自動輸出 H1。0 個代表主題 single.php / page.php 沒寫 the_title() → 需檢查主題或聯絡主題作者',
              '改完務必清快取（LiteSpeed Cache / WP Rocket / 主機商快取）再重新檢測',
            ],
            code: `<!-- 正確：頁面唯一一個 H1（建議是頁面主標題、含目標關鍵字） -->\n<h1>福斯急速熄火關閉記憶線組 | 金鉑汽車影音科技</h1>`,
          },
          too_many: {
            title: '頁面有多個 H1 — 刪掉多餘的、只留 1 個',
            steps: [
              '進入頁面編輯，切換到「程式碼編輯器」（區塊編輯器右上角「⋮」→「程式碼編輯器」）',
              '搜尋 <h1，確認全頁只有一個',
              '多餘的 <h1> 改成 <h2> 或 <h3>',
              '頁面標題欄位（最上方的 Title）通常就是主要 H1，不要再加',
              '儲存',
            ],
            code: null,
          },
        },
      },
      shopify: {
        scenarios: {
          missing: {
            title: '頁面 0 個 H1 — Shopify 通常 product.liquid / page.liquid 預設有 H1，被改掉的話需補回',
            steps: [
              '後台 → 線上商店 → 主題 → 編輯程式碼',
              '打開該頁類型對應的 Liquid 模板：商品頁 → sections/main-product.liquid；一般頁 → sections/main-page.liquid；首頁 → sections/main-hero.liquid 或自訂',
              '找到顯示頁面主標題的地方（通常用 {{ product.title }} 或 {{ page.title }}）',
              '確認該標題包在 <h1> 標籤裡（如果被改成 <div class="h1"> 或 <h2>，改回 <h1>）',
              '儲存',
            ],
            code: `<h1 class="product__title">{{ product.title }}</h1>`,
          },
          too_many: {
            title: '頁面有多個 H1 — 通常是 section 模板有自己的 H1 又跟主標 H1 重複',
            steps: [
              '後台 → 線上商店 → 主題 → 編輯程式碼',
              '找到對應頁面的 Liquid 模板',
              '搜尋 <h1，確認只有一個，其餘改為 <h2>',
              '儲存',
            ],
            code: null,
          },
        },
      },
      wix: {
        scenarios: {
          missing: {
            title: '頁面 0 個 H1 — Wix 編輯器需手動標記主標題為 H1',
            steps: [
              '進入 Wix 編輯器，點選頁面上「最重要的那個標題」文字元素',
              '右側面板「文字樣式」下拉 → 選「標題 1（Heading 1 / H1）」',
              '確認其他大標題不是 H1（避免重複）',
              '發布',
            ],
            code: null,
          },
          too_many: {
            title: '頁面有多個 H1 — Wix 編輯器需逐一改成 H2',
            steps: [
              '進入 Wix 編輯器，點選頁面上的文字元素',
              '右側面板查看「文字樣式」，確認只有一個元素設為「標題 1（H1）」',
              '其餘大標題改為「標題 2（H2）」',
              '發布',
            ],
            code: null,
          },
        },
      },
      html: {
        scenarios: {
          missing: {
            title: '頁面 0 個 H1 — 在主標題位置加上 <h1>',
            steps: [
              '打開該頁 HTML 檔案',
              '找到頁面主標題（通常在 <header>、Hero 區、或 <main> 開頭）',
              '把該標題包在 <h1> 裡（取代原本的 <div>、<span>、<p>）',
              '存檔上傳',
            ],
            code: `<!-- 把主標題包在 H1 -->\n<h1>你的頁面核心主題（含關鍵字）</h1>`,
          },
          too_many: {
            title: '頁面有多個 H1 — 留 1 個、其餘改 H2/H3',
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
    // 排查線索：用戶若回報「我明明有 viewport 卻被判失敗」，可能是這 3 種情況之一。
    // 渲染位置：IssueBoard FixPanel — summary 下方獨立黃色區塊
    troubleshooting: {
      title: '已經有 viewport 卻被判失敗？',
      reasons: [
        '**快取插件吐出舊版 HTML** — LiteSpeed Cache / WP Rocket / W3 Total Cache 可能還在送沒 viewport 那版的快取。進外掛清快取（Purge All）後再重掃。',
        '**子主題 / Builder 覆寫 header** — 你看到的 header.php 是父主題，但實際渲染走子主題、Elementor、Divi、Astra Builder 自己的 header template。檢查「外觀 → 自訂 → header」或子主題目錄有沒有 header.php。',
        '**條件式輸出** — 主題寫了 `<?php if (wp_is_mobile()) { ?> <meta name="viewport"...> <?php } ?>`，伺服器判 Googlebot UA 為桌面 → 跳過 viewport。把這段條件拿掉、無條件輸出。',
      ],
    },
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
    // 2026-05-25：標 freeForAll — 基本款 schema（Organization / WebSite）對所有用戶開放
    // 進階 schema（FAQPage / BreadcrumbList / Product / Article 等）仍 Pro 限定
    freeForAll: true,
    summary: '在 <head> 加入 Organization JSON-LD — 等於交「品牌報名表」給 Google / AI，告訴它你是誰、做什麼、聯絡方式。沒交的話 AI 可能把你跟同名競爭對手搞混。',
    // 推薦自家工具區塊（綠色亮眼底色，IssueBoard 渲染在 summary 下方、troubleshooting 上方）
    // 這頁本身（/aeo-audit）下方就掛著 OrgSchemaGenerator，所以指引用戶往下滑就能用
    featured: {
      title: '✨ 不想自己寫 code？用本頁下方產生器',
      body: '滾到本頁最下方有「個人化 Organization Schema 產生器」(Pro 限定) — 填一次品牌資料永久存著、自動生 JSON-LD code、一鍵複製貼網站 head。免費版可看通用範本要自己填空。比裝 Schema Pro / Rank Math 簡單，所有平台都適用（WP / Shopify / Wix / 自架 HTML）。',
    },
    platforms: {
      wordpress: {
        methods: [
          {
            label: 'Rank Math 外掛（推薦）',
            hint: '若你已裝 Rank Math（台灣 WP 最主流的 SEO 外掛）、走這條最快。不用碰程式碼。',
            steps: [
              'WordPress 後台 → Rank Math → Titles & Meta（標題和元）→ Local SEO（本地 SEO）',
              '把「Person or Company（個人或公司）」設為 Company',
              '填「Name（名稱）」「Logo」「Email」「Phone」「Address」「Type of Business」等欄位',
              '滾到下方填「Social Profiles（社群連結）」— Facebook、Instagram、LINE 官方等',
              '儲存後 Rank Math 會自動把 Organization Schema 注入每頁的 <head>',
              '用 Google Rich Results Test（search.google.com/test/rich-results）貼網址驗證 Schema 抓得到',
            ],
            code: null,
          },
          {
            label: 'WPCode PHP Snippet',
            hint: '沒裝 Rank Math 也不想裝、或想要客製 Schema 內容。需 WP admin 權限、不需主機後台。',
            steps: [
              '裝 WPCode 外掛（搜尋「WPCode」、Syed Balkhi 開發、藍 logo）→ 啟用',
              'WPCode → Code Snippets → + Add Snippet → Add Your Custom Code',
              'Title 填「Organization Schema 注入」',
              'Code Type 選「PHP Snippet」',
              '把右方 PHP 整段貼入、替換成你的品牌資訊',
              'Insertion 選「Auto Insert」、Location 選「Frontend Only」',
              '右上角開「Active」、按「Save Snippet」',
              '用 Google Rich Results Test 貼網址驗證 Schema 抓得到',
            ],
            codeLabel: 'WPCode PHP Snippet（自動把 Organization Schema 注入 <head>）',
            code: `<?php
// 把 Organization JSON-LD Schema 注入網站每頁的 <head>
add_action('wp_head', function () {
    $schema = [
        '@context' => 'https://schema.org',
        '@type' => 'Organization',
        'name' => '你的品牌名稱',
        'url' => 'https://你的網址.com',
        'logo' => 'https://你的網址.com/logo.png',
        'description' => '一句話描述你做什麼、賣什麼、給誰',
        'sameAs' => [
            'https://www.facebook.com/你的粉專',
            'https://www.instagram.com/你的IG',
        ],
        'contactPoint' => [
            '@type' => 'ContactPoint',
            'telephone' => '+886-2-xxxx-xxxx',
            'contactType' => 'customer service',
            'areaServed' => 'TW',
            'email' => 'contact@你的網址.com',
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
}, 50);`,
          },
        ],
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
    summary: '為常見問題頁面加入 FAQ Schema、讓 AI 問答引擎直接引用你的答案（AI 引用率最高的 Schema 類型）',
    platforms: {
      wordpress: {
        methods: [
          {
            label: 'Rank Math 外掛（推薦）',
            hint: '若你已裝 Rank Math、視覺化編輯 FAQ、不用碰程式碼。每頁可設不同的 FAQ Schema。',
            steps: [
              '編輯你想加 FAQ 的頁面 / 文章（例如服務介紹頁、商品頁）',
              '右上角點 Rank Math 圖示開側欄、切「Schema」分頁',
              '點「Schema Generator」→ 在 FAQ 區塊點「Use」加入',
              '點「Edit」開始填、每個 Question / Answer 一組、按「+ Add」可加多組',
              '建議 3-8 組常見問題、答案 50-150 字',
              '點「Save for this Post」→ 更新頁面',
              '用 Google Rich Results Test 貼這頁網址驗證 FAQ Schema 抓得到',
            ],
            code: null,
          },
          {
            label: 'WPCode PHP Snippet（特定頁注入）',
            hint: '沒裝 Rank Math 也不想裝、或想自訂注入位置。下方範例只把 FAQ 注入特定一頁、不全站套用（避免錯頁顯示）。',
            steps: [
              '裝 WPCode 外掛（搜尋「WPCode」、Syed Balkhi 開發、藍 logo）→ 啟用',
              '先找出目標頁面的 page ID — WP 後台 → 頁面 → 編輯該頁、看網址列的 post=xxx 那個數字',
              'WPCode → + Add Snippet → Add Your Custom Code',
              'Title 填「FAQ Schema for page-xxx」（xxx 是 page ID）',
              'Code Type 選「PHP Snippet」、把右方 PHP 整段貼入',
              '把 $TARGET_PAGE_ID 改成你的 page ID、Q/A 改成實際問答（3-8 組）',
              'Insertion 選「Auto Insert」、Location 選「Frontend Only」',
              '右上 Active → 儲存',
              '開該頁前台、View Source 搜 "FAQPage"、看得到 = 成功；再用 Google Rich Results Test 驗證',
            ],
            codeLabel: 'WPCode PHP Snippet（指定頁注入 FAQPage Schema）',
            code: `<?php
// 只在特定頁（page ID = $TARGET_PAGE_ID）的 <head> 注入 FAQ Schema
// 多個頁面要分別建 snippet、或把 ID 改成陣列 + in_array 判斷
add_action('wp_head', function () {
    $TARGET_PAGE_ID = 123;  // ← 改成你的 page ID
    if (!is_page($TARGET_PAGE_ID)) return;

    $faqs = [
        ['你的問題 1？', '對應的詳細答案 1。可寫 50-150 字、AI 會把這段當答案塞給用戶。'],
        ['你的問題 2？', '對應的詳細答案 2。'],
        ['你的問題 3？', '對應的詳細答案 3。'],
    ];

    $schema = [
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(function ($qa) {
            return [
                '@type' => 'Question',
                'name' => $qa[0],
                'acceptedAnswer' => [
                    '@type' => 'Answer',
                    'text' => $qa[1],
                ],
            ];
        }, $faqs),
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
}, 50);`,
          },
        ],
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
    freeForAll: true,   // 基本 SEO hygiene，所有用戶開放
    summary: '加入 canonical 標籤，告訴搜尋引擎這個頁面的標準網址',
    platforms: {
      wordpress: {
        methods: [
          {
            label: 'Rank Math / Yoast 外掛（推薦）',
            hint: '兩個 SEO 外掛都會自動加 canonical、99% 情境裝完就好、不用手動設。要手動指定通常只發生在多語系互指 / 分頁要指回主頁等少數情境。',
            steps: [
              'WordPress 後台 → 外掛 → 安裝外掛、搜尋「Rank Math」或「Yoast SEO」、二選一安裝啟用（免費版即可、台灣站 Rank Math 較主流）',
              '啟用後預設會自動為每個頁面 / 文章加 canonical 標籤、不用任何設定',
              '【需手動指定特定頁時】編輯該頁 / 文章：',
              '・Rank Math：右上 Rank Math 圖示開側欄 → 「Advanced」分頁 → 「Canonical URL」填入 → 更新',
              '・Yoast：滾到下方 Yoast 區塊 → 「進階」分頁 → 「標準 URL」填入 → 更新',
              '驗證：用瀏覽器開該頁、檢視原始碼搜「canonical」、應看到 <link rel="canonical" href="..."> 標籤',
            ],
            code: null,
          },
          {
            label: 'WPCode PHP Snippet',
            hint: '沒裝 SEO 外掛、也不想裝。讓 WP 全站自動依當前頁面 URL 注入 canonical。',
            steps: [
              '裝 WPCode 外掛（搜尋「WPCode」、藍 logo）→ 啟用',
              'WPCode → + Add Snippet → Add Your Custom Code',
              'Title 填「Canonical Tag」',
              'Code Type 選「PHP Snippet」、把右方整段貼入',
              'Insertion 選「Auto Insert」、Location 選「Frontend Only」',
              '右上 Active → Save Snippet',
              '驗證：開任一頁、檢視原始碼搜「canonical」、看到 <link rel="canonical"> = 成功',
            ],
            codeLabel: 'WPCode PHP Snippet（自動加 canonical 到每頁 <head>）',
            code: `<?php
// 自動為每個頁面在 <head> 注入 canonical 標籤
// 邏輯：用 WP 內建的 wp_get_canonical_url() 取當前頁面正規網址、避免分頁 / 查詢字串等變體被重複收錄
add_action('wp_head', function () {
    $canonical = wp_get_canonical_url();
    if (!$canonical) return;
    echo '<link rel="canonical" href="' . esc_url($canonical) . '" />' . PHP_EOL;
}, 1);`,
          },
        ],
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
    freeForAll: true,   // 基本社群分享 meta，所有用戶開放
    summary: '加入 Open Graph 標籤，讓分享到社群媒體時顯示正確的標題和縮圖',
    platforms: {
      wordpress: {
        steps: [
          '安裝「Yoast SEO」或「Rank Math」其中一個（兩個都會自動產生 OG 標籤，二選一即可，台灣站近年 Rank Math 更主流）',
          '【Yoast SEO】編輯頁面/文章 → 滾到下方 Yoast 區塊 → 「社群」分頁 → 分別設定 Facebook / X (Twitter) 標題、描述、圖片 → 更新',
          '【Rank Math SEO】編輯頁面/文章 → 右上角點 Rank Math 圖示開側欄（或滾到下方 Rank Math 區塊）→ 切「Social」分頁 → Facebook 區塊填標題/描述/圖片，X (Twitter) 預設沿用 Facebook 可不填 → 更新',
          '建議分享圖尺寸 1200×630px、檔案 <300KB（小於 1MB 才不會被 Facebook 縮圖快取截掉）',
          '設好後用 Facebook 偵錯工具（developers.facebook.com/tools/debug/）貼上你的網址 → 「重新擷取」清快取，看到正確標題/圖才算成功',
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
    freeForAll: true,   // 我們本來就有 /api/llms-txt 代管功能對外免費，gate 沒意義
    summary: '在網站根目錄建立 llms.txt，讓 AI 爬蟲快速了解你的網站內容',
    platforms: {
      wordpress: {
        // 2026-06-09：拆成兩種做法、tab 切換
        //   方法 A：WPCode 外掛 — 給「只有 WP admin 權限、沒主機後台」的代理商客戶
        //   方法 B：主機面板新增檔案 — 給「有 Hostinger / cPanel 等主機後台權限」的自管站
        methods: [
          {
            label: 'WPCode 外掛（推薦）',
            hint: '只要有 WordPress admin 權限就能做、不用碰伺服器或 FTP。約 5 分鐘。',
            steps: [
              'WordPress 後台 → 外掛 → 安裝外掛',
              '搜尋「WPCode」（藍色 logo、開發者 Syed Balkhi、Lite 版免費）→ 安裝 → 啟用',
              '左側選單會新增「Code Snippets」→ 點「+ Add Snippet」→ 選「Add Your Custom Code (New Snippet)」',
              'Title 填「llms.txt 路由」（任意命名）',
              'Code Type 選「PHP Snippet」',
              '把右方程式碼整段（含 <?php）貼入 Code 編輯框、並把品牌資訊改成你的（heredoc 內容）',
              'Insertion 選「Auto Insert」、Location 選「Frontend Only」',
              '右上角開關切到「Active」',
              '按「Save Snippet」儲存',
              '用瀏覽器無痕視窗開 https://你的網址.com/llms.txt — 看到純文字內容 = 成功',
            ],
            codeLabel: 'WPCode PHP Snippet（含 llms.txt 內容、直接複製貼上）',
            code: `<?php
// llms.txt 路由 — 把網址列改成 /llms.txt 時、回傳 LLMO 標準格式
add_action('init', function () {
    $request_uri = $_SERVER['REQUEST_URI'] ?? '';
    if (rtrim(strtok($request_uri, '?'), '/') !== '/llms.txt') return;

    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: public, max-age=3600');
    echo <<<LLMS
# 你的品牌名稱

> 一句話描述你做什麼、賣什麼、給誰

## 核心產品 / 服務

- [產品 A](https://你的網址.com/product-a) — 一句話描述
- [產品 B](https://你的網址.com/product-b) — 一句話描述

## 重要內容

- [首頁](https://你的網址.com/)
- [常見問題](https://你的網址.com/faq)
- [關於我們](https://你的網址.com/about)

## 聯絡方式

- 電話：02-xxxx-xxxx
- Email：contact@你的網址.com
- LINE：@你的官方帳號
LLMS;
    exit;
});`,
          },
          {
            label: '主機面板新增檔案',
            hint: '有 Hostinger hPanel / cPanel / Plesk 等主機後台權限才能做、最直接、不用裝外掛。',
            steps: [
              '登入你的主機後台（Hostinger hPanel / cPanel / Plesk 等）',
              '進入「檔案管理員」→ public_html/ 資料夾（與 wp-config.php 同一層）',
              '上方點「新增檔案」、檔名輸入 llms.txt（注意：是 .txt、整個小寫）',
              '雙擊剛建好的 llms.txt 開啟編輯器',
              '把右方範本貼入、替換成你的品牌資訊',
              '右上角「儲存」',
              '用瀏覽器無痕視窗開 https://你的網址.com/llms.txt — 看到內容 = 成功',
            ],
            codeLabel: 'llms.txt 純文字檔內容（貼進剛建好的檔案）',
            code: `# 你的品牌名稱

> 一句話描述你做什麼、賣什麼、給誰

## 核心產品 / 服務

- [產品 A](https://你的網址.com/product-a) — 一句話描述
- [產品 B](https://你的網址.com/product-b) — 一句話描述

## 重要內容

- [首頁](https://你的網址.com/)
- [常見問題](https://你的網址.com/faq)
- [關於我們](https://你的網址.com/about)

## 聯絡方式

- 電話：02-xxxx-xxxx
- Email：contact@你的網址.com
- LINE：@你的官方帳號`,
          },
        ],
      },
      shopify: {
        steps: [
          'Shopify 不支援直接放靜態檔案、要透過「重新導向」實現',
          '後台 → 線上商店 → 頁面 → 新增頁面、標題填「llms-txt」、內容暫時隨意',
          '把這個頁面的網址記下（會像 yourshop.com/pages/llms-txt）',
          '後台 → 線上商店 → 導覽 → URL 重新導向 → 建立新導向',
          '從 /llms.txt 重新導向到 /pages/llms-txt',
          '【替代方案】用 Aark 的 llms.txt 託管功能（聯絡客服取得專屬連結）',
        ],
        code: `# 你的品牌名稱\n\n> 一句話描述你做什麼、賣什麼、給誰\n\n## 核心產品 / 服務\n\n- [商品 A](https://你的網址.myshopify.com/products/a) — 一句話\n- [商品 B](https://你的網址.myshopify.com/products/b) — 一句話\n\n## 重要內容\n\n- [全部商品](https://你的網址.myshopify.com/collections/all)\n- [關於我們](https://你的網址.myshopify.com/pages/about)\n\n## 聯絡\n\n- Email：contact@你的網址.com`,
      },
      wix: {
        steps: [
          'Wix 不支援上傳靜態檔案到根目錄、無法直接建 llms.txt',
          '【方法 1】啟用 Wix Velo（開發者模式）、用程式碼建立 /llms.txt 路由',
          '【方法 2】開一個「靜態頁面」叫 llms-txt、然後用 URL 301 導向把 /llms.txt 指過去（要付費 plan 才能設轉址）',
          '【最務實】這項無法做、就先把分數留著、不要為了一個檔案搬家。其他 LLMO 訊號（Schema / FAQ / 內容權威化）做好、整體分數也能升',
        ],
        code: null,
      },
      html: {
        steps: [
          '透過 FTP / SFTP 工具（FileZilla / Cyberduck）連線到你的網站主機',
          '進入網站根目錄（通常叫 public_html/ 或 www/、與 index.html 同層）',
          '用記事本 / VS Code 新增檔案、檔名 llms.txt（注意：整個小寫、是 .txt）',
          '貼入右方範本內容、改成你的品牌資訊',
          '上傳到剛剛那個資料夾',
          '打開瀏覽器、輸入 https://你的網址.com/llms.txt — 看到內容 = 成功',
        ],
        code: `# 你的品牌名稱\n\n> 一句話描述你做什麼、賣什麼、給誰\n\n## 核心產品 / 服務\n\n- [產品 / 服務 A](https://你的網址.com/a) — 一句話描述\n- [產品 / 服務 B](https://你的網址.com/b) — 一句話描述\n\n## 重要內容\n\n- [關於我們](https://你的網址.com/about)\n- [常見問題](https://你的網址.com/faq)\n- [聯絡我們](https://你的網址.com/contact)\n\n## 聯絡\n\n- Email：contact@你的網址.com`,
      },
    },
  },

  // ─── E-E-A-T ────────────────────────────────────────────────
  author_info: {
    summary: '在文章和頁面加入作者資訊（bio、大頭照、Person Schema）、提升 AI 對你網站內容可信度（E-E-A-T 訊號）的評估',
    platforms: {
      wordpress: {
        methods: [
          {
            label: '內建 bio + Simple Author Box（推薦）',
            hint: '不用碰程式碼、零成本。先填內建作者資料、再裝 Simple Author Box 自動在文章底顯示作者卡。',
            steps: [
              '【Step 1：填內建作者資料】',
              'WordPress 後台 → 使用者 → 個人檔案（自己的帳號）',
              '填「網路上的名稱」「網站」「Biographical Info（簡介）」— 簡介寫 100-200 字、強調專業背景 / 經歷 / 資格',
              '若主題支援、上傳「Profile Picture（大頭照）」；不支援的話用 Gravatar（gravatar.com 註冊一次、全 WP 站通用）',
              '儲存',
              '【Step 2：裝外掛顯示作者卡】',
              '外掛 → 安裝外掛、搜尋「Simple Author Box」（Mehdi Lahlou 開發、5 星）→ 安裝啟用',
              '左側選單 → Simple Author Box → 設定外觀（位置：在文章底部 / 顏色 / Logo / 社群圖示）',
              '儲存後每篇文章底部自動顯示作者卡 — 含大頭照 + 名稱 + 簡介 + 社群連結',
              '驗證：開任一篇文章前台、滾到底、看到作者卡 = 成功',
            ],
            code: null,
          },
          {
            label: 'WPCode Person Schema（進階）',
            hint: '額外注入 Person JSON-LD Schema、明確告訴 AI「這篇文章的作者是這個人」、E-E-A-T 訊號更強。可與 Method A 並用。',
            steps: [
              '裝 WPCode 外掛（搜尋「WPCode」、藍 logo）→ 啟用',
              'WPCode → + Add Snippet → Add Your Custom Code',
              'Title 填「Person Schema for Author」',
              'Code Type 選「PHP Snippet」、把右方 PHP 整段貼入',
              '把 PHP 內的作者資訊改成你的（name / jobTitle / description / image / sameAs）',
              'Insertion 選「Auto Insert」、Location 選「Frontend Only」',
              '右上 Active → 儲存',
              '驗證：用 Google Rich Results Test 貼任一篇文章網址、看 Schema 含 Person',
            ],
            codeLabel: 'WPCode PHP Snippet（在文章頁注入 Person JSON-LD）',
            code: `<?php
// 在單篇文章頁（is_single）的 <head> 注入作者 Person Schema
// 與 Method A 的 Simple Author Box 互補：Author Box 給「人類訪客看」、Person Schema 給「AI 看」
add_action('wp_head', function () {
    if (!is_single()) return;

    $person = [
        '@context' => 'https://schema.org',
        '@type' => 'Person',
        'name' => '你的姓名',
        'jobTitle' => '你的職稱（例：資深 SEO 顧問）',
        'description' => '100-200 字的專業背景介紹、強調經歷 / 資格 / 服務客戶數',
        'image' => 'https://你的網址.com/author-photo.jpg',
        'url' => 'https://你的網址.com/about',
        'sameAs' => [
            'https://www.linkedin.com/in/你的LinkedIn',
            'https://www.facebook.com/你的粉專',
        ],
        'worksFor' => [
            '@type' => 'Organization',
            'name' => '你的公司名稱',
            'url' => 'https://你的網址.com',
        ],
    ];
    echo '<script type="application/ld+json">' . wp_json_encode($person, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
}, 50);`,
          },
        ],
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

  // ─── 爬蟲可達性（非平台特定，依 anti-bot/WAF 服務分） ─────────
  bot_accessibility: {
    summary: '你的網站擋下 AI 爬蟲 — 需在 Cloudflare 或 WAF 後台放行 GPTBot / ChatGPT-User / PerplexityBot / ClaudeBot / anthropic-ai 等 AI 引擎 User-Agent，否則 ChatGPT / Perplexity / Claude 回答客戶時不會引用你的網站。',
    platforms: {
      cloudflare: {
        steps: [
          '登入 Cloudflare → 選你的網域',
          '左側選單：Security → Bots → Configure Super Bot Fight Mode',
          '把「Definitely automated」從 Block 改為 Allow（或關閉 Super Bot Fight Mode 整體）',
          '再去 Security → WAF → Custom rules → Create rule',
          '規則名稱：Allow AI Engine Crawlers',
          '把下方 code 區整段貼進 Expression Editor',
          'Action 選 Skip，並勾選「Bot Fight Mode」+「Managed Rules」+「WAF Custom Rules」全部 skip',
          '儲存 → Deploy',
          '回 AI 雷達重新檢測，「爬蟲可達性」應變綠色 100 分',
        ],
        code: `(http.user_agent contains "GPTBot")
or (http.user_agent contains "ChatGPT-User")
or (http.user_agent contains "OAI-SearchBot")
or (http.user_agent contains "PerplexityBot")
or (http.user_agent contains "Perplexity-User")
or (http.user_agent contains "ClaudeBot")
or (http.user_agent contains "anthropic-ai")
or (http.user_agent contains "Claude-Web")
or (http.user_agent contains "Google-Extended")
or (http.user_agent contains "Applebot-Extended")
or (http.user_agent contains "Bytespider")
or (http.user_agent contains "Amazonbot")
or (http.user_agent contains "Googlebot")
or (http.user_agent contains "Bingbot")`,
      },
      robots: {
        steps: [
          '網站根目錄找到 robots.txt（沒有的話新建一個）',
          '把下方 code 區整段貼進去',
          '儲存後上傳覆蓋既有 robots.txt',
          '驗證：訪問 https://你的網域/robots.txt 應該能直接看到內容',
          '注意：robots.txt 只是「禮貌性」協議，惡意爬蟲不會理；真正擋的是 Cloudflare / WAF 那層',
          '回 AI 雷達重新檢測',
        ],
        code: `# AI 雷達建議：允許主流 AI 引擎與搜尋引擎爬蟲存取

# ───── AI 引擎 ─────
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

# ───── 標準搜尋引擎 ─────
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# ───── 其他（預設允許）─────
User-agent: *
Disallow:`,
      },
      otherwaf: {
        steps: [
          '若使用 Imperva / DataDome / Sucuri / Akamai 等付費 WAF：',
          '1. 登入該 WAF 管理後台',
          '2. 找「Custom Rules」/「Allow List」/「Bot Management」設定區',
          '3. 加白名單規則 — 條件：User-Agent contains 任一下方列出的 AI bot UA',
          '4. Action 設為「Allow」/「Bypass」/「Skip Bot Detection」',
          '5. 若該 WAF 提供「Bot 評分閾值」設定，可降低嚴格度',
          '6. 儲存規則並 deploy',
          '7. 回 AI 雷達重新檢測',
          '若不確定使用哪個 WAF：問你的網站維護工程師「我網站前面是哪家 anti-bot 服務」',
        ],
        code: `# 各家 WAF 共用的白名單 User-Agent 清單
# 通常用 OR 邏輯串接，匹配任一即 bypass

GPTBot
ChatGPT-User
OAI-SearchBot
PerplexityBot
Perplexity-User
ClaudeBot
anthropic-ai
Claude-Web
Google-Extended
Applebot-Extended
Googlebot
Bingbot

# 各家 WAF 後台路徑：
# - Imperva：Site → Settings → Application Delivery → Custom Rules
# - DataDome：Workspace → Protection → IP/UA Allowlist
# - Sucuri：Settings → Whitelist → Whitelist a User-Agent
# - Akamai：Bot Manager → Categories → Add Custom Bot`,
      },
    },
  },
}

export const PLATFORMS = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'wix', label: 'Wix' },
  { id: 'html', label: '自架 / HTML' },
  // 以下為「爬蟲可達性 / SSL」類非平台特定修法所用 tab，只在對應 guide 有設定才顯示
  { id: 'cloudflare', label: 'Cloudflare WAF' },
  { id: 'robots', label: 'robots.txt' },
  { id: 'otherwaf', label: '其他 WAF' },
]
