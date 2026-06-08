/**
 * ClientReportModal — 客戶提案 PDF 產生器 modal（2026-06-07）
 *
 * 設計動機：5 AI 共識最大缺口「漏掉代理商賺錢角度」。
 *   代理商需要把 Dashboard 的檢測結果包裝成可交付客戶的 PDF 報告。
 *
 * UX 流程：
 *   1. 用戶點 Dashboard TopBar「📄 匯出 PDF」按鈕
 *   2. 彈出 Modal 填客戶名 + (選填) 代理商資訊
 *   3. 「立即產生 PDF」→ 跑 exportClientProposalPDF
 *   4. localStorage 記住代理商 info、下次自動帶入（同代理商連續做多客戶提案不用重填）
 *
 * 代理商署名要不要必填？我選「非必填」— 個人用戶也可以匯出沒署名版、保持彈性
 */
import { useState, useEffect } from 'react'
import { exportClientProposalPDF } from '../../services/pdfExport'

const STORAGE_KEY_AGENCY = 'aark_agency_info'

function loadAgencyInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AGENCY)
    return raw ? JSON.parse(raw) : { agencyName: '', agencyContact: '' }
  } catch {
    return { agencyName: '', agencyContact: '' }
  }
}

function saveAgencyInfo(info) {
  try {
    localStorage.setItem(STORAGE_KEY_AGENCY, JSON.stringify({
      agencyName: info.agencyName || '',
      agencyContact: info.agencyContact || '',
    }))
  } catch {}
}

export default function ClientReportModal({ open, onClose, data }) {
  const [clientName, setClientName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyContact, setAgencyContact] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [generating, setGenerating] = useState(false)

  // mount 時載入代理商 info、若 props 帶網站名就預填客戶名
  useEffect(() => {
    if (!open) return
    const saved = loadAgencyInfo()
    setAgencyName(saved.agencyName)
    setAgencyContact(saved.agencyContact)
    setClientName(data?.website?.name || '')
    setReportTitle('')
  }, [open, data?.website?.name])

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    try {
      // 記住代理商 info、下次自動帶入
      saveAgencyInfo({ agencyName, agencyContact })

      await exportClientProposalPDF(data, {
        clientName: clientName.trim() || data?.website?.name || data?.website?.url || '',
        agencyName: agencyName.trim(),
        agencyContact: agencyContact.trim(),
        reportTitle: reportTitle.trim() || 'AI 能見度檢測報告',
      })
      // 產 PDF 成功、關閉 modal
      onClose()
    } catch (err) {
      console.error('Generate PDF failed:', err)
      alert('PDF 產生失敗、請稍後再試')
    } finally {
      setGenerating(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl p-7 max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, #0a0c10 0%, #050608 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/5 flex items-center justify-center text-xl"
          aria-label="關閉"
        >×</button>

        {/* Header */}
        <div className="mb-5">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="text-2xl font-bold text-white mb-1">產生客戶提案 PDF</h3>
          <p className="text-sm text-white/55 leading-relaxed">
            填入客戶 + 代理商資訊、產出可交付客戶的 AI 能見度報告。
            代理商資訊會記住、下次自動帶入。
          </p>
        </div>

        {/* 表單 */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              客戶名稱 <span className="text-emerald-300">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="例：某客戶公司 / 品牌名"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
            <p className="mt-1 text-sm text-white/40">顯示在報告封面「為您製作」欄</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              自訂報告標題 <span className="text-sm font-normal text-white/40">(選填)</span>
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              placeholder="預設「AI 能見度檢測報告」、也可自訂如「2026 Q2 SEO 體檢」"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          </div>

          {/* 代理商資訊（折線分隔） */}
          <div className="pt-4 mt-4 border-t border-white/8">
            <div className="text-sm font-medium text-white/55 mb-3 uppercase tracking-widest">
              代理商署名 <span className="text-sm font-normal text-white/35 normal-case">(白標、選填、會記住下次帶入)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white/65 mb-1.5">代理商名稱</label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={e => setAgencyName(e.target.value)}
                  placeholder="例：優勢方舟數位行銷"
                  className="w-full px-4 py-2 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/65 mb-1.5">聯絡方式</label>
                <input
                  type="text"
                  value={agencyContact}
                  onChange={e => setAgencyContact(e.target.value)}
                  placeholder="email / 電話 / LINE ID"
                  className="w-full px-4 py-2 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-5 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white border border-white/10 hover:bg-white/5 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !clientName.trim()}
            className="flex-1 px-5 py-3 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-400 text-black transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                產生中…
              </>
            ) : (
              <>📄 立即產生 PDF</>
            )}
          </button>
        </div>

        {/* 小提醒 */}
        <p className="mt-5 pt-4 border-t border-white/8 text-sm text-white/40 leading-relaxed">
          💡 PDF 內含 5 訊號層分析 + Top 5 建議行動 + 各層詳細檢測。
          產出大小約 200-500 KB、可直接 email 給客戶或印成紙本。
        </p>
      </div>
    </div>
  )
}
