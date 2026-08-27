import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { trackPixel } from '../../lib/pixel'
import '../../styles/lp-sage.css'

/**
 * A 組廣告落地頁「清新日系」版（2026-08-19）— 取代原本共用模板裡的 google-vs-ai 內容。
 *
 * 來源：行銷/落地頁設計/清新日系-A組-LP(-PC).html 兩份 mockup（用戶提供，PC 版檔頭
 * 註明「RWD 示意，正式做進 React 會更細」）。這裡是 PC 版邏輯搬進來、RWD 斷點依 PC 版
 * 既有 @media(max-width:820px) 為底，手機版 mockup 的 hero 處理拿來對照微調。
 *
 * 落地頁鐵律同 LandingPage.jsx：無導覽逃生門、message match、掃描漏斗留 URL 回首頁自動掃。
 * 素材已由用戶預先放進 public/lp-assets/（圖片/插圖/兩支 iframe 動畫）。
 */
const TESTIMONIALS = [
  { quote: '以前客人都是滑到廣告才進來。現在他們會先問 ChatGPT「哪間醫美風評好」——方舟讓我看見 AI 到底有沒有把我推出去。', name: '林院長', industry: '醫美診所', initial: '林', avatarClass: 'av-med' },
  { quote: '植牙客單價高，客人一定做足功課。看到診所被 AI 主動點名，比單純投關鍵字廣告安心多了。', name: '陳醫師', industry: '牙科・植牙矯正', initial: '陳', avatarClass: 'av-den' },
  { quote: '我以為 Google 做到第一就贏了，直到問 AI，它推薦的全是別人。補上缺口後，這週終於被提到。', name: 'Lily', industry: 'SPA・美容', initial: 'L', avatarClass: 'av-spa' },
  { quote: '很冷門的產業，但玩家都會問 AI「改裝去哪家」。以前完全看不到自己，現在每週追得到能見度。', name: '薛老闆', industry: '汽車影音・改裝', initial: '薛', avatarClass: 'av-car' },
  { quote: '客人裝潢前一定先問 AI。方舟讓我知道 AI 參考了哪些網站，我就知道該去哪裡露出、補內容。', name: '王設計師', industry: '室內設計', initial: '王', avatarClass: 'av-int' },
  { quote: '毛孩爸媽最愛問「哪間動物醫院比較好」。每週追蹤，看著自己慢慢被 AI 記住，很有成就感。', name: '張院長', industry: '寵物醫院', initial: '張', avatarClass: 'av-pet' },
]
// 卡片複製一份供跑馬燈無縫循環；第二份 aria-hidden，螢幕閱讀器不會重複唸兩次
const MARQUEE_CARDS = [...TESTIMONIALS, ...TESTIMONIALS]

const FEATURES = [
  { n: '01', cls: 'c1', img: '/lp-assets/01.svg', alt: '機器人一次展示 ChatGPT、Gemini 等多個 AI', title: '一次看遍多個主流 AI', desc: 'ChatGPT・Claude・Gemini，誰推薦你、誰跳過你，一次看清。' },
  { n: '02', cls: 'c2', img: '/lp-assets/02.svg', alt: '人物檢視一路往上的能見度趨勢圖', title: '記錄每次掃描、畫出能見度趨勢', desc: '你做的優化有沒有效，數字會說話。' },
  { n: '03', cls: 'c3', img: '/lp-assets/03.svg', alt: '人物研究 AI 參考了哪些網站的清單', title: '揪出 AI 參考哪些網站在推薦你', desc: '知道該去哪裡爭取曝光。' },
]

export default function LpSageA() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')

  // 掃描漏斗：跟 LandingPage.jsx 其他 variant 同一套規則——留網址、Lead 事件、
  // 導回首頁自動帶入並開始掃（HomeLight.jsx 讀 sessionStorage.lp_pending_url）
  function handleSubmit(e) {
    e.preventDefault()
    if (!url.trim()) return
    trackPixel('Lead', { content_name: 'lp_google-vs-ai' })
    sessionStorage.setItem('lp_pending_url', url.trim())
    navigate('/')
  }

  const scanBox = (
    <form className="scan" onSubmit={handleSubmit}>
      <div className="scan-row">
        <input
          type="text" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="輸入你的網站網址" aria-label="輸入你的網站網址"
          inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        />
        <button type="submit">免費檢測 →</button>
      </div>
    </form>
  )

  return (
    <div className="lp-sage">
      <div className="wrap">
        <nav className="nav">
          <Link to="/" className="logo"><span className="radar" aria-hidden="true" /><span className="brand">方舟 AI 雷達</span></Link>
          <a href="#lp-scan" className="nav-cta">免費檢測我的品牌 →</a>
        </nav>
      </div>

      {/* ① 第一屏 hero */}
      <section className="hero-full">
        <img className="hero-photo" src="/lp-assets/2.avif" alt="品牌主在明亮餐廳用手機查看自己的 AI 能見度" />
        <div className="hero-copy" id="lp-scan">
          <span className="badge">給用心經營的品牌主</span>
          <h1 className="serif">你把品牌做得這麼用心，<br /><span className="hl">但 AI 看得見你嗎？</span></h1>
          <p className="sub">越來越多人問 ChatGPT「推薦哪家」。如果 AI 不認識你的品牌，你正在默默流失客人——而你甚至不知道。</p>
          {scanBox}
          <div className="trust"><span className="dot" aria-hidden="true">✓</span> 免費・免註冊・30 秒看到結果</div>
        </div>
        {/* 2026-08-27：原本是 2.7MB 的 PNG——廣告落地頁對載入速度極度敏感（首屏大圖直接吃掉
            前幾秒），改成 1200px 寬的 WebP、97KB（降 96%）。1200px 是 CSS 顯示寬度 430px 的
            2.8 倍，retina 上仍然清晰。width/height 給瀏覽器先算好長寬比，避免載入時版面跳動。
            舊的 .png 暫時留在 public/ 沒刪（沒有任何地方引用了，實機確認新圖沒問題就可以移除）。 */}
        <img className="hero-mockup" src="/lp-assets/mockup-left.webp" width="1200" height="1275"
             alt="方舟 AI 雷達 產品畫面（電腦＋手機）" />
      </section>

      {/* ② 痛點轉折 */}
      <div className="wrap">
        <section className="pain">
          <div className="kline">你有沒有發現……</div>
          <div className="pain-cols">
            <div className="pain-col">
              <div className="anim-embed">
                <iframe src="/lp-assets/seo-laptop-anim.html" title="SEO 數據上升動畫" scrolling="no" />
                <div className="row"><span className="ic ok" aria-hidden="true">✓</span><span className="t">你的品牌，<b>Google 搜尋找得到</b></span></div>
              </div>
            </div>
            <div className="pain-col">
              <div className="anim-embed">
                <iframe src="/lp-assets/seo-worried-anim.html" title="AI 看不懂動畫" scrolling="no" />
                <div className="row"><span className="ic no" aria-hidden="true">✕</span><span className="t">但問 ChatGPT，它推薦的<b>是別人</b></span></div>
              </div>
            </div>
          </div>
          <p className="pain-note">AI 不看 Google 排名。它有自己的一套規則——<br /><b>你做好的 SEO，AI 看不懂。</b></p>
        </section>
      </div>

      {/* ③ 範例報告 */}
      <section className="report-band">
        <div className="report-wm" aria-hidden="true">AI VISIBILITY</div>
        <div className="wrap">
          <div className="report">
            <h2 className="serif">30 秒，看你在 AI 眼中的樣子</h2>
            <p className="report-sub">5 大訊號層・一目了然</p>
            <div className="scorecard">
              <div className="scname">example.com 的 AI 能見度<span className="sample-tag">・示例</span></div>
              <div className="scgrid">
                <div className="sc"><div className="v good">89</div><div className="l">SEO</div></div>
                <div className="sc"><div className="v bad">12</div><div className="l">AEO</div></div>
                <div className="sc"><div className="v warn">43</div><div className="l">GEO</div></div>
                <div className="sc"><div className="v warn">57</div><div className="l">E-E-A-T</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ③.5 持續監測 */}
      <div className="wrap">
        <section className="monitor">
          <h2 className="serif">問 AI 一次？誰都會。難的是盯住每一週。</h2>
          <p className="msub">AI 的答案每週都在變，每個 AI 各說各話，你的對手也在優化——一次快照，看不出輸贏。</p>
          <div className="mlist">
            {FEATURES.map(f => (
              <div className={`mcard ${f.cls}`} key={f.n}>
                <div className="mcard-fig"><img src={f.img} alt={f.alt} /></div>
                <div className="mcard-body">
                  <span className="mnum">{f.n}</span>
                  <h3 className="mtitle">{f.title}</h3>
                  <p className="mdesc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mclose">自己問一次誰都會，但<b>持續盯著每一個 AI、看懂趨勢、補對破口</b>——這才是讓 AI 開始推薦你的方法。</p>
        </section>
      </div>

      {/* ④ 客戶見證跑馬燈 */}
      <section className="tms">
        <div className="wrap">
          <h2 className="serif">各行各業，都在被 AI 重新推薦</h2>
          <p className="tms-sub">從醫美到汽車影音——只要客人會問 AI「推薦哪家」，你就需要被看見。</p>
        </div>
        <div className="marquee">
          <div className="track">
            {MARQUEE_CARDS.map((t, i) => (
              <div className="tcard" key={i} aria-hidden={i >= TESTIMONIALS.length || undefined}>
                <div className="qm" aria-hidden="true">“</div>
                <p className="tquote">{t.quote}</p>
                <div className="tperson">
                  <div className={`tavatar ${t.avatarClass}`} aria-hidden="true">{t.initial}</div>
                  <div><div className="tname">{t.name}</div><div className="tindustry">{t.industry}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ 社會證明 */}
      <div className="wrap">
        <section>
          <div className="proof">
            <div className="proof-lead">你問一個 AI，我們替你同時問一整排</div>
            <div className="proof-engines">ChatGPT・Claude・Gemini｜即時上網、逐一比對</div>
            <div className="proof-scarcity"><span className="live" aria-hidden="true" />首批品牌正在搶先卡位 AI 能見度</div>
          </div>
        </section>
      </div>

      {/* ⑥ 結尾 CTA */}
      <div className="wrap">
        <section className="closing">
          <h2 className="serif">先看看，再決定</h2>
          {scanBox}
          <div className="trust"><span className="dot" aria-hidden="true">✓</span> 免費・免註冊・30 秒看到結果</div>
        </section>
      </div>

      <div className="footer">方舟 AI 雷達 ｜ AI 搜尋能見度監測 ｜ 由優勢方舟數位行銷研發</div>
    </div>
  )
}
