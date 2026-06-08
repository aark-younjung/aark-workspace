/**
 * LLMOChecklistModal — LLMO 6 週執行清單 PDF 產生器 modal（2026-06-08）
 *
 * 與 ClientReportModal 的差異：
 *   - ClientReportModal：客戶當下檢測結果報告（snapshot、回看用）
 *   - 本檔案：客戶接下來 6 週執行清單（forward-looking、操作用）
 *
 * 共用：agency info 用同一個 localStorage key（aark_agency_info）、跨匯出共用
 *
 * 收進來的資料：
 *   1. clientName*：必填、顯示在封面「為您製作」
 *   2. agencyName / agencyContact：選填、白標署名
 *   3. startDate：起跑日（預設今天）、顯示在封面 & Week 6 驗收
 *   4. baselineScores（由父層帶入）：當下的 SEO/AEO/GEO/EEAT 分數、顯示為 Week 0 起跑點
 */
import { useState, useEffect } from 'react'
import { exportLLMO6WeekChecklistPDF } from '../../services/llmo6WeekChecklistPDF'

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

export default function LLMOChecklistModal({ open, onClose, data, baselineScores }) {
  const [clientName, setClientName] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [agencyContact, setAgencyContact] = useState('')
  const [startDate, setStartDate] = useState('')
  const [generating, setGenerating] = useState(false)

  // mount 時：載入 agency info、起跑日預設今天、客戶名預填網站名
  useEffect(() => {
    if (!open) return
    const saved = loadAgencyInfo()
    setAgencyName(saved.agencyName)
    setAgencyContact(saved.agencyContact)
    setClientName(data?.website?.name || '')
    setStartDate(new Date().toISOString().slice(0, 10))
  }, [open, data?.website?.name])

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    try {
      // 記住 agency info、下次自動帶入
      saveAgencyInfo({ agencyName, agencyContact })

      await exportLLMO6WeekChecklistPDF(
        {
          clientName: clientName.trim() || data?.website?.name || data?.website?.url || '',
          agencyName: agencyName.trim(),
          agencyContact: agencyContact.trim(),
          startDate,
        },
        baselineScores  // 父層帶進來的當下分數、顯示為 Week 0 起跑點
      )
      onClose()
    } catch (err) {
      console.error('Generate LLMO checklist PDF failed:', err)
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
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-2xl font-bold text-white mb-1">產生 LLMO 6 週執行清單</h3>
          <p className="text-sm text-white/55 leading-relaxed">
            把抽象的 LLMO 概念轉成可交付客戶的「6 週逐週執行清單」、
            含 robots.txt / llms.txt / Schema 模板 + 驗收標準。代理商交付物。
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
              起跑日 <span className="text-sm font-normal text-white/40">(顯示在封面 Week 0)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-white focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            />
          </div>

          {/* 起跑分數預覽（如果有資料就顯示） */}
          {baselineScores && (baselineScores.seo || baselineScores.aeo || baselineScores.geo || baselineScores.eeat) && (
            <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-400/25 rounded-xl">
              <div className="text-sm font-medium text-emerald-300 mb-2 tracking-wide uppercase">
                Week 0 起跑分數（自動帶入封面）
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-base font-bold text-white">{baselineScores.seo || 0}</div>
                  <div className="text-sm text-white/50 tracking-wider">SEO</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{baselineScores.aeo || 0}</div>
                  <div className="text-sm text-white/50 tracking-wider">AEO</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{baselineScores.geo || 0}</div>
                  <div className="text-sm text-white/50 tracking-wider">GEO</div>
                </div>
                <div>
                  <div className="text-base font-bold text-white">{baselineScores.eeat || 0}</div>
                  <div className="text-sm text-white/50 tracking-wider">EEAT</div>
                </div>
              </div>
            </div>
          )}

          {/* 代理商署名（折線分隔） */}
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
              <>📋 立即產生 6 週清單</>
            )}
          </button>
        </div>

        {/* 小提醒 */}
        <p className="mt-5 pt-4 border-t border-white/8 text-sm text-white/40 leading-relaxed">
          💡 PDF 含 10 頁：封面 + 序章 + Week 1-6 逐週清單 + 附錄 A 工具 + 附錄 B 常見錯覺。
          含 robots.txt / llms.txt / Schema 完整可複製模板。產出大小約 500-800 KB。
        </p>
      </div>
    </div>
  )
}
