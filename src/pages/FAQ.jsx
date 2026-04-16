import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'

const FAQ_ITEMS = [
  {
    category: '基本概念',
    icon: '📚',
    questions: [
      {
        q: '什麼是 AI 能見度？',
        a: 'AI 能見度是指你的網站在 ChatGPT、Perplexity、Google AI Overview、Claude 等 AI 搜尋引擎中被「看見」、「理解」並「引用」的能力。傳統 SEO 讓你出現在 Google 搜尋結果，AI 能見度則讓你出現在 AI 的回答中。'
      },
      {
        q: '什麼是 SEO？',
        a: '搜尋引擎最佳化（Search Engine Optimization）是讓網站在 Google、Bing 等搜尋結果中排名更高的技術。包含 Meta 標題、H1 標題結構、圖片 Alt 文字、行動版相容性、載入速度等項目。SEO 分數高代表搜尋引擎容易找到你。'
      },
      {
        q: '什麼是 AEO？',
        a: '問答引擎最佳化（Answer Engine Optimization）是讓你的網站內容被 AI 助理直接引用為「答案」的技術。透過 JSON-LD 結構化資料、FAQ Schema、問句式標題等方式，讓 Siri、Google AI、ChatGPT 在回答用戶問題時優先選擇你的內容。'
      },
      {
        q: '什麼是 GEO？',
        a: '生成式引擎最佳化（Generative Engine Optimization）是針對 ChatGPT、Claude、Perplexity、Gemini 等生成式 AI 的優化策略。重點在於讓 AI 在生成長篇回答時，能夠引用並推薦你的品牌，而不是競爭對手。'
      },
      {
        q: '什麼是 E-E-A-T？',
        a: 'E-E-A-T 代表「經驗（Experience）、專業（Expertise）、權威（Authoritativeness）、信任（Trustworthiness）」，是 Google 評估網站可信度的核心框架。具體體現在是否有作者資訊、關於我們頁面、聯絡方式、隱私權政策、以及 Organization Schema 等。E-E-A-T 分數高的網站更容易被 AI 視為可靠來源。'
      },
      {
        q: 'SEO、AEO、GEO、E-E-A-T 有什麼差別？',
        a: '四者是互補的關係：SEO 是基礎，讓搜尋引擎找到你；AEO 讓 AI 直接引用你的答案；GEO 讓生成式 AI 在回答中推薦你；E-E-A-T 建立品牌的可信度，影響前三者的評分。一個完整的數位行銷策略需要四者並進。'
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
        a: '分數範圍為 0–100，代表該面向的優化完整度。70 分以上為良好，50–70 分有改善空間，50 分以下需要優先處理。儀表板中的 AI 優化工具會根據你的失敗項目，自動列出最重要的 5 條改善行動。'
      },
      {
        q: '可以分析競爭對手的網站嗎？',
        a: '可以。你可以使用「競品比較」功能，同時分析自己和對手的網站，並以雷達圖呈現四個面向的差距。這有助於找出競爭對手的優勢，以及你可以快速超越的機會點。'
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
        a: '免費方案可以進行基本的 SEO、AEO、GEO、E-E-A-T 檢測，查看分數與主要問題。Pro 方案額外提供：完整的修復建議、程式碼修復產生器、歷史趨勢追蹤、競品比較功能，以及 PDF 報告匯出。'
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
  const { user, isPro, userName, signOut } = useAuth()
  const [openItems, setOpenItems] = useState({})

  const toggle = (catIdx, qIdx) => {
    const key = `${catIdx}-${qIdx}`
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-screen relative" >
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* JSON-LD FAQ Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.flatMap(cat => cat.questions.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        })))
      }) }} />

      {/* Header */}
      <header className="relative sticky top-0 z-40 border-b border-white/40 backdrop-blur-md bg-white/8">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-200">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-white">優勢方舟數位行銷</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/" className="hidden sm:block text-white/80 hover:text-white text-sm transition-colors">首頁</Link>
            <Link to="/pricing" className="hidden sm:block text-white/80 hover:text-white text-sm transition-colors">定價</Link>
            {user ? (
              <>
                {!isPro && (
                  <Link to="/pricing" className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors font-medium">升級 Pro</Link>
                )}
                <Link to="/account" className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity flex-shrink-0" title={userName || user.email}>
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {(userName || user?.email || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </Link>
                <button onClick={signOut} className="text-white/60 hover:text-white text-xs sm:text-sm transition-colors">登出</button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm rounded-lg transition-colors font-medium">登入</Link>
            )}
          </nav>
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-400 rounded-full text-sm font-medium mb-6">
            💬 常見問題
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">有任何問題嗎？</h1>
          <p className="text-white/60 text-lg">關於 AI 能見度、工具使用與方案的常見問題解答</p>
        </div>

        {/* FAQ 分類 */}
        <div className="space-y-10">
          {FAQ_ITEMS.map((cat, catIdx) => (
            <div key={catIdx}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{cat.icon}</span>
                <h2 className="text-lg font-bold text-white">{cat.category}</h2>
              </div>
              <div className="space-y-3">
                {cat.questions.map((item, qIdx) => {
                  const key = `${catIdx}-${qIdx}`
                  const isOpen = openItems[key]
                  return (
                    <div key={qIdx} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggle(catIdx, qIdx)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
                      >
                        <span className="font-semibold text-white text-sm leading-relaxed">{item.q}</span>
                        <span className={`text-orange-500 flex-shrink-0 text-lg transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>+</span>
                      </button>
                      {isOpen && (
                        <div className="px-6 pb-5">
                          <div className="h-px bg-orange-100 mb-4" />
                          <p className="text-white/80 text-sm leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-center shadow-sm">
          <div className="text-3xl mb-3">🚀</div>
          <h2 className="text-xl font-bold text-white mb-2">還有其他問題？</h2>
          <p className="text-white/60 text-sm mb-4">直接用你的網址試試看，60 秒內看到完整 AI 能見度報告</p>
          <Link to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-200">
            取得我的免費報告 →
          </Link>
          <p className="mt-4 text-sm text-white/60">
            或直接寫信給我們：
            <a href="mailto:aark.younjung@gmail.com" className="text-orange-500 hover:text-orange-400 font-medium ml-1">
              aark.younjung@gmail.com
            </a>
          </p>
        </div>

        {/* Footer nav */}
        <div className="mt-6 text-center">
          <Link to="/" className="text-white/60 hover:text-white/80 text-sm transition-colors">← 返回首頁</Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
