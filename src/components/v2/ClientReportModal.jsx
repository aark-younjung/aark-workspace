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
 *
 * 2026-08-28：aivis 資料改由本元件在開啟時自己抓。
 *   為什麼放這裡而不是叫兩個呼叫端（AppOverview / DashboardV2）各自傳進來——
 *   那樣要改兩個頁面、兩邊的 select 欄位還得同步（scanService 就是這樣出過漏欄位的 bug）。
 *   放在 modal 裡只有一份、只在使用者真的要產報告時才查，平常頁面載入零成本。
 */
import { useState, useEffect } from 'react'
import { exportClientProposalPDF } from '../../services/pdfExport'
import { supabase } from '../../lib/supabase'
import { buildAivisReport } from '../appshell/aivisData'

const STORAGE_KEY_AGENCY = 'aark_agency_info'

function loadAgencyInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AGENCY)
    return raw ? JSON.parse(raw) : { agencyName: '', agencyContact: '', agencyCommitment: '' }
  } catch {
    return { agencyName: '', agencyContact: '', agencyCommitment: '' }
  }
}

function saveAgencyInfo(info) {
  try {
    localStorage.setItem(STORAGE_KEY_AGENCY, JSON.stringify({
      agencyName: info.agencyName || '',
      agencyContact: info.agencyContact || '',
      agencyCommitment: info.agencyCommitment || '',
    }))
  } catch {}
}

export default function ClientReportModal({ open, onClose, data }) {
  const [clientName, setClientName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyContact, setAgencyContact] = useState('')
  // 代理商自填的服務承諾 —— 刻意不預填任何內容：
  // 替別人生成他沒答應過的商業承諾，比報告裡放錯數字更嚴重（見 pdfAivisSections 承諾頁註解）
  const [agencyCommitment, setAgencyCommitment] = useState('')
  const [reportTitle, setReportTitle] = useState('')
  const [generating, setGenerating] = useState(false)
  // aivis 實測資料：null = 還沒查 / false = 這個網站沒接監測（報告就少那四頁）
  const [aivisReport, setAivisReport] = useState(null)
  const [aivisLoading, setAivisLoading] = useState(false)

  // mount 時載入代理商 info、若 props 帶網站名就預填客戶名
  useEffect(() => {
    if (!open) return
    const saved = loadAgencyInfo()
    setAgencyName(saved.agencyName)
    setAgencyContact(saved.agencyContact)
    setAgencyCommitment(saved.agencyCommitment || '')
    setClientName(data?.website?.name || '')
    setReportTitle('')
  }, [open, data?.website?.name])

  // 開啟時抓 aivis 實測資料（近 90 天）——查得到才會多出實測 / 原話 / 對照 / 來源歸因四頁。
  // 任何一步失敗都只是「這次報告沒有那四頁」，不擋住 PDF 產生（報告本身仍可交付）。
  useEffect(() => {
    const websiteId = data?.website?.id
    if (!open || !websiteId) return
    let cancelled = false
    setAivisReport(null)
    setAivisLoading(true)
    ;(async () => {
      try {
        const { data: brand } = await supabase
          .from('aivis_brands').select('*').eq('website_id', websiteId).maybeSingle()
        if (cancelled) return
        if (!brand) { setAivisReport(false); return }
        const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
        const [promptResult, responseResult, mentionResult] = await Promise.all([
          supabase.from('aivis_prompts').select('*').eq('brand_id', brand.id),
          supabase.from('aivis_responses')
            .select('id, prompt_id, run_index, raw_response, brand_mentioned, created_at, engine_results')
            .eq('brand_id', brand.id).gte('created_at', since),
          supabase.from('aivis_mentions').select('response_id, position, context')
            .eq('brand_id', brand.id).gte('created_at', since),
        ])
        if (cancelled) return
        const report = buildAivisReport({
          brand,
          prompts: promptResult.data || [],
          responses: responseResult.data || [],
          mentions: mentionResult.data || [],
        })
        setAivisReport(report.hasData ? report : false)
      } catch (err) {
        console.warn('[ClientReportModal] aivis 資料讀取失敗、報告改出基本版：', err?.message || err)
        if (!cancelled) setAivisReport(false)
      } finally {
        if (!cancelled) setAivisLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, data?.website?.id])

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    try {
      // 記住代理商 info、下次自動帶入
      saveAgencyInfo({ agencyName, agencyContact, agencyCommitment })

      await exportClientProposalPDF({ ...data, aivisReport: aivisReport || null }, {
        clientName: clientName.trim() || data?.website?.name || data?.website?.url || '',
        agencyName: agencyName.trim(),
        agencyContact: agencyContact.trim(),
        agencyCommitment: agencyCommitment.trim(),
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
              <div>
                <label className="block text-sm font-medium text-white/65 mb-1.5">
                  你的服務承諾 <span className="text-sm font-normal text-white/35">(選填，會印在報告最後一頁)</span>
                </label>
                <textarea
                  value={agencyCommitment}
                  onChange={e => setAgencyCommitment(e.target.value)}
                  rows={3}
                  placeholder="例：合作滿 12 個月，若三個主要服務在三個引擎仍為零提及，無償展延 6 個月。"
                  className="w-full px-4 py-2 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/35 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 text-sm leading-relaxed resize-y"
                />
                <p className="mt-1 text-sm text-white/40">
                  報告最後一頁固定有「方法邊界」（我們量什麼、不承諾什麼）。這一欄是你自己的服務承諾，留空就不會出現。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 這次報告會不會有 aivis 那四頁 —— 代理商送出前要知道自己拿到的是幾頁版本（2026-08-28） */}
        <div className="mt-5 px-4 py-3 rounded-xl text-sm leading-relaxed"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {aivisLoading ? (
            <span className="text-white/55">正在讀取 AI 實測資料…</span>
          ) : aivisReport ? (
            <span className="text-white/70">
              <b className="text-emerald-300">含 AI 實測 4 頁</b>：實測矩陣（{aivisReport.totals.prompts} 題 × {aivisReport.totals.enginesUsed} 引擎、
              {aivisReport.totals.observed} 次觀測）、AI 原話與來源、
              {aivisReport.previous ? '前後對照、' : ''}分引擎來源歸因。
              {!aivisReport.previous && (
                <span className="block mt-1 text-white/45">
                  只有一場掃描紀錄、這次沒有前後對照頁——再掃一次就會有。
                </span>
              )}
            </span>
          ) : (
            <span className="text-white/55">
              這個網站還沒有 AI 曝光監測資料，報告只會有技術檢測的部分。
              到「AI 曝光監測」設定品牌與題庫、跑一次掃描，報告就會多出實測與來源歸因。
            </span>
          )}
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
