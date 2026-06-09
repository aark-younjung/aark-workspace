import { useState } from 'react'
import { FIX_GUIDES, PLATFORMS } from '../data/fixGuides'

export default function FixGuide({ checkId, defaultPlatform = 'wordpress' }) {
  const [platform, setPlatform] = useState(defaultPlatform)
  // 2026-06-09：支援多 method（同平台不同做法、例如 WPCode 外掛 vs 主機面板）
  // 切換平台時 reset 為 method 0、避免顯示舊平台的 method 索引
  const [methodIdx, setMethodIdx] = useState(0)
  const [copied, setCopied] = useState(false)

  const guide = FIX_GUIDES[checkId]
  if (!guide) return null

  const platformGuide = guide.platforms[platform]

  // 取出當前要顯示的內容 — 多 method 時取陣列中當前 method、否則用平台層級的 steps/code
  const hasMethods = Array.isArray(platformGuide?.methods) && platformGuide.methods.length > 0
  const current = hasMethods ? platformGuide.methods[Math.min(methodIdx, platformGuide.methods.length - 1)] : platformGuide

  const handlePlatformChange = (p) => {
    setPlatform(p)
    setMethodIdx(0)  // 切平台時 reset method 索引
  }

  const handleCopy = () => {
    if (!current?.code) return
    navigator.clipboard.writeText(current.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
        <p className="text-sm font-semibold text-black mb-1">🛠 修復指南</p>
        <p className="text-sm text-black">{guide.summary}</p>
      </div>

      {/* 平台切換 */}
      <div className="flex border-b border-blue-200 bg-white">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => handlePlatformChange(p.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              platform === p.id
                ? 'text-black border-b-2 border-blue-600 bg-blue-50'
                : 'text-black hover:text-black'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* method 切換（只有多做法時才顯示） */}
      {hasMethods && (
        <div className="flex flex-wrap gap-1 px-3 py-2 bg-white border-b border-blue-100">
          {platformGuide.methods.map((m, i) => (
            <button
              key={i}
              onClick={() => setMethodIdx(i)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors font-medium ${
                methodIdx === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* method 提示（適用情境） */}
      {hasMethods && current?.hint && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm text-black/70 italic">💡 {current.hint}</p>
        </div>
      )}

      {/* 步驟 */}
      <div className="p-4">
        {Array.isArray(current?.steps) && (
          <ol className="space-y-2">
            {current.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-black">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}

        {/* 程式碼區塊 */}
        {current?.code && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-black font-medium">{current?.codeLabel || '程式碼範例'}</span>
              <button
                onClick={handleCopy}
                className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {copied ? '✓ 已複製' : '複製'}
              </button>
            </div>
            <pre className="text-sm bg-slate-800 text-green-300 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
              {current.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
