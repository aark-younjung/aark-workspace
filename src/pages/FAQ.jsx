import { Link } from 'react-router-dom'
import SiteHeader from '../components/lightsite/SiteHeader'
import SiteFooter from '../components/lightsite/SiteFooter'
import '../styles/lightsite.css'
import '../styles/faq-light.css'

/**
 * 常見問題（亮色版）— 2026-08-26 全面重做，不再吃 isDark 分支。
 *
 * 原本這頁有 dark/light（橘白舊版）雙分支，light 分支是已退役的橘白配色
 * （CLAUDE.md：橘白版已下線，只留分支供未來切換復原）——不是這次要接軌的
 * 目標視覺。改成跟 HomeLight/AppShell 同一套 token 的亮色版，不看 isDark，
 * 一律亮色（同 .homelight 手法：opaque 背景蓋過全域暗色底）。
 *
 * 內容保留原有 4 分類全部題目，只修正「Perplexity」三引擎政策違規措辭
 * （2026-07-17 已定案只講 ChatGPT／Claude／Gemini）。
 */
const FAQ_ITEMS = [
  {
    category: '基本概念',
    icon: '📚',
    questions: [
      {
        q: '什麼是 AI 能見度？',
        a: 'AI 能見度是指你的網站在 ChatGPT、Claude、Gemini 等 AI 搜尋引擎中被「看見」、「理解」並「引用」的能力。傳統 SEO 讓你出現在 Google 搜尋結果，AI 能見度則讓你出現在 AI 的回答中。'
      },
      {
        q: '什麼是 SEO？',
        a: '搜尋引擎最佳化（Search Engine Optimization）是讓網站在 Google、Bing 等搜尋結果中排名更高的技術。包含 Meta 標題、H1 標題結構、圖片 Alt 文字、行動版相容性、載入速度等項目。SEO 分數高代表搜尋引擎容易找到你。'
      },
      {
        q: '什麼是 AEO？',
        a: '問答引擎最佳化（Answer Engine Optimization）是讓你的網站內容被 AI 助理直接引用為「答案」的技術。透過 JSON-LD 結構化資料、FAQ Schema、問句式標題等方式，讓 AI 在回答用戶問題時優先選擇你的內容。'
      },
      {
        q: '什麼是 GEO？',
        a: '生成式引擎最佳化（Generative Engine Optimization）是針對 ChatGPT、Claude、Gemini 等生成式 AI 的優化策略。重點在於讓 AI 在生成長篇回答時，能夠引用並推薦你的品牌，而不是競爭對手。'
      },
      {
        q: '什麼是 LLMO？跟 GEO、AEO 差在哪？',
        a: 'LLMO（Large Language Model Optimization，大型語言模型優化）是 2024-2025 興起的新概念，業界也叫「AI 搜尋優化」或「生成式 AI 曝光」— 它是大傘、不是子集。傘下包含：①SEO（讓 Google 找到你 — 基礎底盤）、②AEO（讓 AI 把你當答案、引用你的內容）、③GEO（讓生成式 AI 在長篇回答推薦你）、④E-E-A-T（讓 AI 判斷你可信、值得引用）、⑤跨 LLM 引用率追蹤（實際量化你在 ChatGPT、Claude、Gemini 被提幾次）。方舟 AI 雷達把 LLMO 拆成這 5 個可測量子訊號、各自打分、合成總分。市面上多數工具只做 SEO 一層、方舟 AI 雷達是台灣第一個完整覆蓋 LLMO 的監測平台。'
      },
      {
        q: '什麼是 E-E-A-T？',
        a: 'E-E-A-T 代表「經驗（Experience）、專業（Expertise）、權威（Authoritativeness）、信任（Trustworthiness）」，是 Google 評估網站可信度的核心框架。具體體現在是否有作者資訊、關於我們頁面、聯絡方式、隱私權政策、以及 Organization Schema 等。E-E-A-T 分數高的網站更容易被 AI 視為可靠來源。',
      },
      {
        q: 'SEO、AEO、GEO、LLMO、E-E-A-T 到底差在哪？我需要哪個？',
        a: 'LLMO 是大傘、其他 4 個是傘下的子訊號層：①SEO 解 Google 排名（地基，沒這個 AI 也找不到你）；②AEO 解答案引擎引用（Google Featured Snippets、語音助理）；③GEO 解生成式 AI 推薦（ChatGPT、Claude、Gemini 長篇答案）；④E-E-A-T 解可信度（AI 判斷你值不值得引用的訊號）；⑤aivis 解結果驗證（實際追蹤你被跨 LLM 引用的次數）。5 個訊號不是替代關係、是疊加關係。方舟 AI 雷達一次幫你看完全部 — 從 Meta tag 到 llms.txt、從作者 bio 到 ChatGPT 引用率。'
      },
    ]
  },
  {
    category: '工具使用',
    icon: '🛠️',
    questions: [
      {
        q: '這個工具怎麼運作？',
        a: '你只需要輸入網站網址，我們的系統會自動爬取你的網頁，從四個面向進行分析：SEO 技術項目、AEO 結構化資料、GEO AI 可讀性、E-E-A-T 品牌信任度。分析完成後會產生 0–100 的分數與具體改善建議，整個過程約需 15–30 秒。'
      },
      {
        q: '分析需要多久？',
        a: '通常 15 到 30 秒完成。速度取決於你的網站回應時間。我們會在分析過程中顯示即時進度動畫，你不需要等待也不需要重新整理頁面。'
      },
      {
        q: '分數代表什麼意思？',
        a: '分數範圍為 0–100，代表該面向的優化完整度。70 分以上為良好，50–70 分有改善空間，50 分以下需要優先處理。登入後的「網站體檢」會依你的失敗項目，列出對應的改善行動與可直接複製的修復程式碼。'
      },
      {
        q: '可以分析競爭對手的網站嗎？',
        a: '可以。你可以在「AI 曝光監測」的「競品比較」分頁設定觀察名單，在同一批問句下比較自己和對手被 AI 提及的比例，找出落後與領先的地方。'
      },
      {
        q: '分析結果會儲存嗎？',
        a: '登入帳號後，每次分析結果都會自動儲存到你的儀表板。你可以隨時查看歷史趨勢圖，了解每次優化後分數的變化，確認改善行動是否有效。'
      },
      {
        q: '多久分析一次比較好？',
        a: '建議每次進行網站改動後重新分析一次，確認修改是否有效。若沒有特別改動，每個月掃描一次即可追蹤趨勢。網站分數下滑有時是外部因素（如競爭對手提升）造成，定期追蹤有助於及早發現問題。'
      },
    ]
  },
  {
    category: '方案與費用',
    icon: '💳',
    questions: [
      {
        q: '免費方案有什麼限制？',
        a: '免費方案可以進行基本的 SEO、AEO、GEO、E-E-A-T 檢測，查看分數與主要問題。Pro 方案額外提供：完整的修復建議、程式碼修復產生器、歷史趨勢追蹤、競品比較功能、AI 曝光監測，以及 PDF 報告匯出。'
      },
      {
        q: 'Pro 方案值得嗎？',
        a: 'Pro 方案特別適合品牌主和行銷人員。除了更詳細的分析報告，「修復碼產生器」直接提供可複製貼上的 llms.txt、JSON-LD、FAQ Schema 程式碼，即使沒有工程師也能自行修復。通常一個項目的改善就能帶來可觀的搜尋流量提升。'
      },
      {
        q: '可以隨時取消方案嗎？',
        a: '可以。訂閱方案沒有合約綁定，你可以隨時在帳號設定中取消，下期不再收費。取消後仍可使用到當期結束。'
      },
      {
        q: '有提供企業方案嗎？',
        a: '有。Agency 方案適合行銷顧問公司或需要管理多個客戶網站的用戶，支援白標報告與批次分析。請透過聯絡表單與我們洽談。'
      },
      {
        q: '下一次的訂閱時間到了，費用會自動扣款嗎？',
        a: '是的，訂閱方案採自動續費機制，每期到期前會自動從你綁定的付款方式扣款，並寄送收據到你的信箱。如果不想繼續，請在到期前於帳號設定中取消訂閱，取消後當期仍可正常使用至結束日為止，不會再自動扣款。'
      },
    ]
  },
  {
    category: '技術問題',
    icon: '⚙️',
    questions: [
      {
        q: '為什麼有些項目分析失敗？',
        a: '部分網站設有防爬蟲保護（如 Cloudflare）可能導致某些項目無法讀取。這種情況下，我們會標記為「無法取得」而非給出錯誤分數。如果你的網站完全無法分析，請確認網站是否公開可存取。'
      },
      {
        q: 'llms.txt 是什麼？放在哪裡？',
        a: 'llms.txt 是一個新興標準，類似 robots.txt，專門告訴 AI 爬蟲你的網站內容、品牌特色與服務說明。放在網站根目錄（如 yoursite.com/llms.txt）即可。我們的「修復碼產生器」可以根據你的網站資訊自動產生 llms.txt 內容，直接複製貼上即可。'
      },
      {
        q: 'JSON-LD 結構化資料要怎麼加？',
        a: '將 JSON-LD 程式碼貼入網站的 <head> 區塊內即可。如果你使用 WordPress，可以透過「Insert Headers and Footers」外掛貼入。如果使用 Webflow、Wix 等平台，通常在「自訂程式碼」設定中加入。我們的儀表板提供可直接複製的程式碼範本。'
      },
      {
        q: '優化後多久會反映在分數上？',
        a: '網站修改後，重新執行分析即可立即看到技術項目的分數變化（如 JSON-LD、Meta 標籤等）。至於 AI 引擎實際引用你的頻率，通常需要 2–4 週讓 AI 爬蟲重新索引你的網站。'
      },
    ]
  },
]

export default function FAQ() {
  return (
    <div className="ls-page faq-light">
      {/* JSON-LD FAQ Schema — SEO 必要 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.flatMap(cat => cat.questions.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        })))
      }) }} />

      <SiteHeader />

      <main className="ls-wrap fq-main">
        <div className="fq-hero">
          <span className="fq-badge">💬 常見問題</span>
          <h1>有任何問題嗎？</h1>
          <p>關於 AI 能見度、工具使用與方案的常見問題解答</p>
        </div>

        {FAQ_ITEMS.map((cat, catIdx) => (
          <section className="fq-cat" key={catIdx}>
            <div className="fq-cat-hd"><span className="ic" aria-hidden="true">{cat.icon}</span><h2>{cat.category}</h2></div>
            <div className="fq-list">
              {cat.questions.map((item, qIdx) => (
                <details className="fq-item" key={qIdx}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="fq-cta">
          <div className="ic" aria-hidden="true">🚀</div>
          <h2>還有其他問題？</h2>
          <p>直接用你的網址試試看，30 秒內看到 AI 能見度分數</p>
          <Link to="/" className="ls-btn ls-cta">取得我的免費報告 →</Link>
          <p className="mail">或直接寫信給我們：<a href="mailto:aark.younjung@gmail.com">aark.younjung@gmail.com</a></p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
