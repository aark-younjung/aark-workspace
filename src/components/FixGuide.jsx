import { useState } from 'react'
import { FIX_GUIDES, PLATFORMS } from '../data/fixGuides'

export default function FixGuide({ checkId, defaultPlatform = 'wordpress' }) {
  const [platform, setPlatform] = useState(defaultPlatform)
  const [copied, setCopied] = useState(false)

  const guide = FIX_GUIDES[checkId]
  if (!guide) return null

  const platformGuide = guide.platforms[platform]

  const handleCopy = () => {
    navigator.clipboard.writeText(platformGuide.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      {/* 標題列 */}
      <div className="px-4 py-3 bg-blue-100 border-b border-blue-200">
        <p className="text-xs font-semibold text-blue-700 mb-1">🛠 修復指南</p>
        <p className="text-xs text-blue-600">{guide.summary}</p>
      </div>

      {/* 平台切換 */}
      <div className="flex border-b border-blue-200 bg-white">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => setPlatform(p.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              platform === p.id
                ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 步驟 */}
      <div className="p-4">
        <ol className="space-y-2">
          {platformGuide.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        {/* 程式碼區塊 */}
        {platformGuide.code && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-medium">程式碼範例</span>
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {copied ? '✓ 已複製' : '複製'}
              </button>
            </div>
            <pre className="text-xs bg-slate-800 text-green-300 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
              {platformGuide.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
