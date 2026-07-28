import { useParams, Link } from 'react-router-dom'

// 尚未實作的區塊占位（誠實 placeholder，不假造內容）。
// visibility / health / gap / 我的網站 先用這個，之後逐一換成真元件。
export default function AppSection({ title, note }) {
  const { websiteId } = useParams()
  return (
    <>
      <div className="as-phead"><h2>{title}</h2><span className="sub">建置中</span></div>
      <div className="as-stub"><b>{title}</b>——這個區塊正在接資料 / 實作中。{note}</div>
      {websiteId && (
        <Link className="as-cta" to={`/app/${websiteId}/overview`} style={{ marginTop: 16 }}>← 回總覽</Link>
      )}
    </>
  )
}
