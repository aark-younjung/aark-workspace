/**
 * Rank Math 速查頁（B phase）
 *
 * 用戶痛點：agency / 客戶常常知道「要去 Rank Math 改 XX」但不知道
 *           「Rank Math 每個欄位該填什麼」、UI 在哪、Robots Meta 該勾哪些…
 *           AI 雷達自己的工具標出「該去 Rank Math 改」、卻沒教怎麼改 → 體驗斷裂。
 *
 * 這頁覆蓋 3 大區塊：
 *   1. 找到 Rank Math meta box（在 post/product/page edit 頁滑到哪裡）
 *   2. 個別頁面常用欄位（Title / Description / Focus Keyword / Schema / Robots / OG）
 *   3. 全域設定（Titles & Meta → Products/Posts/Pages 各分頁的 8 個常見開關）
 *
 * 路由：/help/rank-math（從 BulkScan wp_admin_hint 連過來）
 */
import SiteHeader from '../components/v2/SiteHeader'
import Footer from '../components/Footer'
import { T } from '../styles/v2-tokens'

const BG = '#000'

// Section 1 — 找到 Rank Math meta box
const SECTION_FINDING_BOX = {
  title: '🗺️ Section 1：怎麼找到「Rank Math meta box」？',
  intro: '每個 post / 商品 / 頁面的編輯畫面下方都有一個 Rank Math 區塊、所有「per-page SEO 設定」都在這裡填。',
  steps: [
    {
      label: '步驟 1：登入 WP、進到你要改的 post/商品/頁面 edit 頁',
      detail: '可以用 admin bar（前台網址打開後看上方黑色長條）的「編輯」連結最快、或從後台「文章/商品/頁面」列表進去。',
    },
    {
      label: '步驟 2：滑到 edit 頁「最下方」找 Rank Math 區塊',
      detail: '通常在內容編輯器（Gutenberg / WPBakery）的「正下方」。如果沒看到、按右上「螢幕選項 / Screen Options」→ 勾「Rank Math」。',
    },
    {
      label: '步驟 3：認識 Rank Math meta box 的 3 個分頁',
      detail: '一進去會看到頂部 3 個 tab：「General」（一般、最常用）/「Advanced」（進階）/「Schema」（結構化資料）。預設停在 General。',
    },
  ],
}

// Section 2 — General 分頁 4 個欄位
const SECTION_GENERAL = {
  title: '📝 Section 2：General 分頁（最常用、每個頁面都要填）',
  fields: [
    {
      name: 'SEO Title',
      what: '出現在 Google 搜尋結果第一行（藍色大字）+ 瀏覽器分頁標題',
      fill_what: '30-60 字（Chinese chars 也算 1 字）、含主關鍵字 + 品牌名',
      example_good: '「Audi A4 CarPlay 升級｜原廠介面無損改裝｜金鉑先生」(31 字)',
      example_bad: '❌「Audi」(4 字、太短) ・❌「Audi A4 CarPlay 升級｜原廠介面無損改裝｜金鉑先生車用品｜台南汽車影音改裝｜台南汽車音響店推薦」(過長被 Google 截斷)',
      tip: 'Rank Math 預設用 `%title% %sep% %sitename%` 模板自動拼。如果你 hardcode 一堆「| 台南汽車影音 | 台南汽車音響」會超過 60 字、被 Google 截掉',
    },
    {
      name: 'Description',
      what: '出現在 Google 搜尋結果標題下方的灰色摘要',
      fill_what: '70-155 字、用主動句、含主關鍵字 + 賣點 / 服務承諾',
      example_good: '「金鉑先生提供 Audi A4 CarPlay 原廠介面升級、專業安裝 + 一年保固。可預約免費音響健檢、台南實體店面服務。」(56 字)',
      example_bad: '❌ 留空（Google 會自動抓內文、品質不可控）・❌ 寫一句話「我們很厲害」(太空、沒 keyword)',
      tip: 'Description 不影響搜尋排名、但影響「點擊率」— 用戶看到才願意點進來。寫得像 sales copy 比技術描述好',
    },
    {
      name: 'Focus Keyword',
      what: 'Rank Math 拿這個關鍵字「跑分」、給你 SEO 評分（綠/橘/紅燈）',
      fill_what: '一個主關鍵字（如「Audi A4 CarPlay 升級」）。不是用來給 Google、只是 Rank Math 內部用',
      example_good: '車型 + 服務動作（「Toyota Sienna 音響升級」）',
      example_bad: '❌ 太長（「在台南台中高雄都能做的 Audi 全車系 CarPlay 完整升級服務」）・❌ 沒填（Rank Math 無法評分）',
      tip: 'Pro 版可以填多個（用逗號分開）、免費版只能 1 個',
    },
    {
      name: 'Permalink / Slug',
      what: 'URL 最後一段、像 https://你的站/【這段】',
      fill_what: '英文小寫 + 連字號、短而清楚（如 `audi-a4-carplay-upgrade`）。中文 slug 也可以但會被 URL encode 成亂碼',
      example_good: '`audi-a4-carplay-upgrade` / `tpms-sensor-replacement`',
      example_bad: '❌ `產品-12345` (中文 URL encode 後變 `%E7%94%A2%E5%93%81...`)・❌ `untitled-3` (預設未改)',
      tip: 'Slug 是「文章發布後最好不要改」的東西、改了會 broken link。剛建文章時就改好',
    },
  ],
}

// Section 3 — Schema 分頁
const SECTION_SCHEMA = {
  title: '🏷️ Section 3：Schema 分頁（給 AI / Google 結構化資料）',
  intro: 'Schema 讓搜尋引擎和 AI 引擎「理解」這頁是什麼類型 — 商品？文章？服務？預設 Rank Math 會自動帶、但有時要手動指定。',
  rules: [
    { type: '商品頁', use: 'Product（WooCommerce 自動帶價格、庫存）', avoid: '不要選 Article 給商品頁' },
    { type: '部落格文章', use: 'Article（普通文章）/ BlogPosting（部落格）', avoid: '不是新聞才不要選 NewsArticle' },
    { type: '一般頁面（如關於我們）', use: 'WebPage / None', avoid: '不要強塞 Article' },
    { type: '聯絡頁', use: 'ContactPage', avoid: '不需要動' },
    { type: 'FAQ 頁', use: 'FAQPage + 把 Q&A 填進去', avoid: '不能空填、要真的有 Q&A' },
    { type: '隱私 / 條款', use: 'None / WebPage', avoid: 'Rank Math 偶爾預設 Article、要改 None' },
  ],
}

// Section 4 — Advanced 分頁的 Robots Meta
const SECTION_ROBOTS = {
  title: '🤖 Section 4：Advanced 分頁的 Robots Meta（預設別動）',
  intro: 'Robots Meta 控制「Google 該不該收錄這頁」、「該不該在搜尋結果顯示縮圖」等。99% 的情況預設就好、新手亂打勾會出大事。',
  options: [
    { name: 'Index', meaning: 'Google 可以收錄這頁', default: '✅ 預設勾（保持）', when_to_change: '只有想隱藏某頁（如測試頁、後台預覽）才改 NoIndex' },
    { name: 'NoIndex', meaning: 'Google 不要收錄這頁', default: '❌ 預設不勾', when_to_change: '只在「下架商品、不想出現在搜尋結果」時打勾' },
    { name: 'NoFollow', meaning: '這頁的所有連結 Google 不要爬', default: '❌ 預設不勾', when_to_change: '幾乎不用、除非有大量 affiliate / 廣告外連結' },
    { name: 'NoArchive', meaning: 'Google 不要顯示快取版本', default: '❌ 預設不勾', when_to_change: '不用動' },
    { name: 'NoImageIndex', meaning: '不要把這頁的圖收進 Google 圖片搜尋', default: '❌ 預設不勾', when_to_change: '不用動' },
    { name: 'NoSnippet', meaning: 'Google 不要在搜尋結果顯示摘要', default: '❌ 預設不勾', when_to_change: '完全別動' },
  ],
}

// Section 5 — 全域設定（Titles & Meta 內各 post type）
const SECTION_GLOBAL = {
  title: '⚙️ Section 5：全域設定（Titles & Meta → Posts/Products/Pages）',
  intro: '這是「整個 post type 的預設模板」、每個個別頁面如果沒覆寫就吃這裡的設定。WP 後台 → Rank Math SEO → 標題與中繼資料（Titles & Meta）→ 選 Posts / Products / Pages 各別調整。',
  fields: [
    { name: 'Title 模板', explain: '用 `%title% %sep% %sitename%` 變數讓每個頁面自動帶。別 hardcode 多餘字串', recommended: '簡潔三段：`%title% %sep% %sitename%`' },
    { name: 'Description 模板', explain: '通常留空、讓每個頁面自己填', recommended: '不填、由個別頁的 Description 欄位決定' },
    { name: 'Robots Meta（全域）', explain: '所有 post 預設都套這個 → 99% 留 Index 就好', recommended: '✅ Index、其他別動' },
    { name: 'Advanced Robots Meta', explain: 'Snippet / Video Preview / Image Preview — 給 Google 預覽你內容的權限', recommended: '✅ Snippet -1、✅ Video Preview -1、✅ Image Preview Large（越多預覽越有利點擊）' },
    { name: 'Add SEO Controls', explain: '開了之後個別 post edit 頁才會出現 Rank Math meta box', recommended: '⚠️ 一定要開！否則前面 Section 1-4 都跑不到' },
    { name: 'Bulk Editing', explain: '文章/商品列表可以批次改 SEO 標題等', recommended: '✅ Enabled — 批次處理用得到' },
    { name: 'Link Suggestions', explain: '寫新文章時 Rank Math 自動建議內部連結', recommended: '✅ 開、加內部連結有助 SEO' },
    { name: 'Primary Taxonomy', explain: '麵包屑顯示的主分類', recommended: '商品 → 商品分類 / 文章 → 分類（Categories）' },
    { name: 'Thumbnail for Facebook', explain: '上傳通用 OG image（個別頁沒設時 fallback 用這個）', recommended: '上傳一張 1200x630 品牌 logo / 形象圖' },
  ],
}

export default function HelpRankMath() {
  return (
    <PageBg>
      <SiteHeader />
      <main style={{
        position: 'relative', zIndex: 10,
        maxWidth: 920, margin: '0 auto',
        padding: '24px 24px 64px',
        fontFamily: T.font, color: T.text,
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <a href="javascript:history.back()" style={{ color: T.textMid, fontSize: 14, textDecoration: 'none' }}>← 返回</a>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 16, marginBottom: 8 }}>
            📖 Rank Math 速查表
          </h1>
          <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7 }}>
            這頁覆蓋 <strong style={{ color: 'white' }}>5 大區塊</strong>：怎麼找到 Rank Math 設定、個別頁面該填什麼、
            Schema 該選哪種、Robots Meta 該不該勾、全域設定該怎麼調。直接複製貼上就能用。
          </p>
        </div>

        {/* TOC */}
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: T.text }}>📋 目錄</h3>
          <ol style={{ paddingLeft: 20, color: T.textMid, fontSize: 14, lineHeight: 1.9 }}>
            <li><a href="#s0" style={{ color: '#93c5fd' }}><strong style={{ color: '#fcd34d' }}>⚡ Finding → 修哪裡 對照表（一眼看出該去哪）</strong></a></li>
            <li><a href="#s1" style={{ color: '#93c5fd' }}>怎麼找到 Rank Math meta box</a></li>
            <li><a href="#s2" style={{ color: '#93c5fd' }}>General 分頁的 4 個必填欄位</a></li>
            <li><a href="#s3" style={{ color: '#93c5fd' }}>Schema 分頁該選哪種類型</a></li>
            <li><a href="#s4" style={{ color: '#93c5fd' }}>Advanced 分頁 Robots Meta 預設別動</a></li>
            <li><a href="#s5" style={{ color: '#93c5fd' }}>全域設定（Titles & Meta）9 個常見開關</a></li>
          </ol>
        </Card>

        {/* Section 0 — Finding 對照表（用戶最常困惑的「該去哪改」） */}
        <SectionAnchor id="s0" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>
          ⚡ Finding → 修哪裡 對照表
        </h2>
        <p style={{ fontSize: 14, color: T.textMid, marginBottom: 14, lineHeight: 1.7 }}>
          看到 BulkScan 報的 finding、不確定該去 WP 哪裡改？這張表一眼對應。
          <strong style={{ color: 'white' }}>記法：finding 名含「meta_」「og」「schema」「canonical」→ 改 Rank Math meta box；含「h1」「content」→ 改文章內容本體</strong>
        </p>

        {/* 兩欄並列：Rank Math meta box vs 內容編輯器 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          {/* 左：Rank Math meta box */}
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#86efac', display: 'flex', alignItems: 'center', gap: 6 }}>
              🏷️ Rank Math meta box（下方紫色區）
            </h3>
            <div style={{ fontSize: 14, color: T.textLow, marginBottom: 10 }}>
              訪客看不到、只有 Google / AI 看到。對應 chip <strong style={{ color: '#86efac' }}>🛠️ SEO 外掛可解</strong>
            </div>
            <MappingRow finding="missing_meta_title / short_meta_title / long_meta_title" go="General → SEO Title" />
            <MappingRow finding="missing_meta_desc / short_meta_desc / long_meta_desc" go="General → Description" />
            <MappingRow finding="missing_og / incomplete_og" go="Social tab → Facebook / Twitter（圖片自動帶 OR 上傳 Thumbnail）" />
            <MappingRow finding="no_json_ld / no_article_schema / no_product_schema" go="Schema tab → 選 Article / Product 類型" />
            <MappingRow finding="missing_canonical" go="Rank Math 預設自動處理。如果缺、可能是外掛被關閉或主題覆寫" />
          </Card>

          {/* 右：內容編輯器 */}
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 6 }}>
              📝 文章/商品內容本體（上方編輯器）
            </h3>
            <div style={{ fontSize: 14, color: T.textLow, marginBottom: 10 }}>
              訪客直接看到的文字。對應 chip <strong style={{ color: '#fcd34d' }}>🔑 需 WP 後台</strong> 或 <strong style={{ color: '#f9a8d4' }}>✍️ 需要寫內容</strong>
            </div>
            <MappingRow finding="missing_h1" go="進內容編輯器 → 加 H1 標題 block（缺通常是主題問題）" />
            <MappingRow finding="multiple_h1" go="進內容編輯器 → 程式碼模式 → 多餘 <h1> 改成 <h2>" />
            <MappingRow finding="thin_content / short_content" go="進內容編輯器 → 加長文字、補完整段（要實際寫內容）" />
          </Card>
        </div>

        {/* 特殊例外 */}
        <h3 style={{ fontSize: 15, fontWeight: 800, marginTop: 12, marginBottom: 8, color: '#fca5a5' }}>
          ⚠️ 兩個特殊例外（不在 WP 後台、要找其他地方）
        </h3>
        <Card>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: '#fca5a5', marginBottom: 4 }}>
              multiple_h1 + 🔴 主題級重複 chip
            </div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7 }}>
              這個重複 H1 來自主題在多個位置渲染同份內容（不是用戶寫的）→ 需要修主題 PHP code、不在 WP 後台。
              展開該 H1 看「🔧 如何處理」會給你具體步驟跟「給工程師的訊息」（可直接複製）。
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#fdba74', marginBottom: 4 }}>
              multiple_h1 在 /product/ 商品頁 + 內容相同
            </div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7 }}>
              通常是 WooCommerce「商品簡述」+「商品說明」兩個欄位都貼了同份內容 →
              清空「商品簡述」(Short Description) 即可。在商品編輯頁下方、可能要從右上「螢幕選項」打開。
            </div>
          </div>
        </Card>

        {/* Section 1 */}
        <SectionAnchor id="s1" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{SECTION_FINDING_BOX.title}</h2>
        <p style={{ fontSize: 14, color: T.textMid, marginBottom: 14, lineHeight: 1.7 }}>{SECTION_FINDING_BOX.intro}</p>
        {SECTION_FINDING_BOX.steps.map((s, i) => (
          <Card key={i}>
            <div style={{ fontWeight: 700, color: T.text, marginBottom: 4, fontSize: 14 }}>{s.label}</div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7 }}>{s.detail}</div>
          </Card>
        ))}

        {/* Section 2 */}
        <SectionAnchor id="s2" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{SECTION_GENERAL.title}</h2>
        {SECTION_GENERAL.fields.map((f, i) => (
          <Card key={i}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{f.name}</span>
              <span style={{ fontSize: 14, color: T.textLow }}>·</span>
              <span style={{ fontSize: 14, color: T.textMid }}>{f.what}</span>
            </div>
            <FieldRow label="該填什麼" value={f.fill_what} color="#86efac" />
            <FieldRow label="✅ 好範例" value={f.example_good} color="#86efac" />
            <FieldRow label="❌ 不好範例" value={f.example_bad} color="#fca5a5" />
            {f.tip && <FieldRow label="💡 重點" value={f.tip} color="#fcd34d" />}
          </Card>
        ))}

        {/* Section 3 */}
        <SectionAnchor id="s3" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{SECTION_SCHEMA.title}</h2>
        <p style={{ fontSize: 14, color: T.textMid, marginBottom: 14, lineHeight: 1.7 }}>{SECTION_SCHEMA.intro}</p>
        <Card>
          <table style={{ width: '100%', fontSize: 14, color: T.text, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: T.textLow }}>頁面類型</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: T.textLow }}>用什麼 Schema</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: T.textLow }}>避免</th>
              </tr>
            </thead>
            <tbody>
              {SECTION_SCHEMA.rules.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.type}</td>
                  <td style={{ padding: '8px 10px', color: '#86efac' }}>{r.use}</td>
                  <td style={{ padding: '8px 10px', color: '#fca5a5' }}>{r.avoid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Section 4 */}
        <SectionAnchor id="s4" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{SECTION_ROBOTS.title}</h2>
        <p style={{ fontSize: 14, color: T.textMid, marginBottom: 14, lineHeight: 1.7 }}>{SECTION_ROBOTS.intro}</p>
        <Card>
          {SECTION_ROBOTS.options.map((o, i) => (
            <div key={i} style={{
              padding: '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: T.text }}>{o.name}</span>
                <span style={{ fontSize: 14, color: o.default.includes('✅') ? '#86efac' : '#fca5a5' }}>{o.default}</span>
              </div>
              <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.65 }}>
                <strong>意思：</strong>{o.meaning} · <strong>什麼情況才該改：</strong>{o.when_to_change}
              </div>
            </div>
          ))}
        </Card>

        {/* Section 5 */}
        <SectionAnchor id="s5" />
        <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>{SECTION_GLOBAL.title}</h2>
        <p style={{ fontSize: 14, color: T.textMid, marginBottom: 14, lineHeight: 1.7 }}>{SECTION_GLOBAL.intro}</p>
        {SECTION_GLOBAL.fields.map((f, i) => (
          <Card key={i}>
            <div style={{ fontWeight: 800, color: T.text, marginBottom: 4, fontSize: 14 }}>{f.name}</div>
            <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginBottom: 4 }}>{f.explain}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>
              <strong style={{ color: '#86efac' }}>推薦設定：</strong>
              <span style={{ color: T.text }}>{f.recommended}</span>
            </div>
          </Card>
        ))}

        {/* Footer */}
        <div style={{ marginTop: 48, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`, borderRadius: 10, fontSize: 14, color: T.textLow }}>
          📌 看完還是不懂某個欄位？回到 BulkScan 結果頁、展開對應的 finding、按「📤 給客戶報告」、把整段複製給你的客戶 / 工程師
          看就好、不用自己一個個解釋。
        </div>
      </main>
      <Footer dark />
    </PageBg>
  )
}

// ─── 元件 ─────────────────────────────────────────
function PageBg({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3000, pointerEvents: 'none', zIndex: 0,
        background: 'var(--t-bg, linear-gradient(155deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%))',
        mixBlendMode: 'lighten',
      }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 3600, pointerEvents: 'none', zIndex: 0,
        background: 'linear-gradient(335deg, #18c590 0%, #0d7a58 10%, #084773 15%, #011520 30%, #000000 50%)',
        mixBlendMode: 'lighten',
      }} />
      {children}
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 12,
    }}>{children}</div>
  )
}

function SectionAnchor({ id }) {
  return <div id={id} style={{ scrollMarginTop: 100 }} />
}

function FieldRow({ label, value, color }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 4 }}>
      <strong style={{ color }}>{label}：</strong>
      <span style={{ color: T.text }}>{value}</span>
    </div>
  )
}

// Finding → 修哪裡對照表的單列
function MappingRow({ finding, go }) {
  return (
    <div style={{
      padding: '6px 0',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      fontSize: 14,
    }}>
      <code style={{
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        color: '#a7f3d0',
        fontSize: 14,
        wordBreak: 'break-word',
      }}>{finding}</code>
      <div style={{ color: T.textMid, marginTop: 3, lineHeight: 1.55 }}>→ {go}</div>
    </div>
  )
}
