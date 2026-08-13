/**
 * 指標詞彙表／「我們如何衡量」卡 —— 多分數產品的信任地基（Kuroma 實測學來）。
 * 明白告訴用戶：每個數字量什麼、在哪看、為什麼彼此不一致（技術分高 ≠ AI 會推薦你）。
 * 原生 <details>：免 JS 狀態、鍵盤可操作；預設收合不佔版面。
 */
const METRICS = [
  {
    name: '技術體質（SEO / AEO / GEO / E-E-A-T）',
    what: '你的網站「讓 AI 讀得懂、找得到」的技術地基——meta、schema、爬蟲可達性、可信度訊號等靜態檢查。',
    where: '網站體檢',
    why: '這是入場券、不是結果。技術分 100 也不保證 AI 會推薦你——所以我們把「AI 實際推不推薦」另外量（下面的曝光率）。',
  },
  {
    name: '品類推薦曝光率',
    what: '真的拿「不含你品牌名」的品類問題去問 ChatGPT／Claude／Gemini，AI 的回答有沒有提到你。固定題組、每次掃描重跑，趨勢可比較。',
    where: 'AI 曝光監測',
    why: '客戶問 AI 時不會連你的名字一起問——這個數字才是「AI 推不推薦你」的真相。跟技術分不同步是正常的。',
  },
  {
    name: '品牌認知率',
    what: '拿「含你品牌名」的問題去問 AI，看 AI 認不認得你。',
    where: 'AI 曝光監測',
    why: '刻意跟曝光率分開算：用品牌詞問幾乎一定會被提到，混在一起會灌水。分開才誠實。',
  },
  {
    name: '內容引用率',
    what: 'AI 回答你領域的知識題時，引用來源裡有沒有你的網站。',
    where: '內容缺口',
    why: '量的是「你的內容有沒有被 AI 當知識來源」——內容行銷／SEO 成效最直接的鏡子，也另計、不灌入曝光率。',
  },
]

export default function MetricGlossary() {
  return (
    <details className="as-glossary">
      <summary>📖 我們如何衡量——為什麼這些分數不會一樣？</summary>
      <div className="as-glossary-body">
        <p className="intro">
          每個分數量的是<b>不同的問題</b>，彼此不一致是正常的（技術分高、曝光率低＝AI 讀得懂你、但還沒推薦你）。
        </p>
        <ul>
          {METRICS.map(metric => (
            <li key={metric.name}>
              <b>{metric.name}</b>
              <span className="loc">在「{metric.where}」</span>
              <p>{metric.what}</p>
              <p className="why">{metric.why}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
