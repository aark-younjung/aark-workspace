/**
 * 統一狀態徽章（2026-08-13 第一批 · Codex 規格）：
 * 同一種狀態在 sidebar、tab、卡片、表格內永遠用相同文字與顏色——管理用戶對功能狀態的預期。
 * 八種語彙：new（綠·新功能）/ beta（藍紫·測試中）/ pro（橘·需升級）/ agency（靛·Agency 限定）
 *          / nodata（灰·資料不足）/ waiting（灰虛線·等待掃描）/ error（紅·引擎異常）/ sample（灰底·示例資料）
 * 用法：<Badge kind="beta" />（預設文字）或 <Badge kind="pro">Pro 限定</Badge>（自訂文字、顏色不變）
 */
const KINDS = {
  new: 'NEW',
  beta: 'BETA',
  pro: 'Pro',
  agency: 'Agency',
  nodata: '資料不足',
  waiting: '等待掃描',
  error: '引擎異常',
  sample: '示例資料',
}

export default function Badge({ kind = 'beta', children }) {
  return <span className={`as-badge as-badge-${kind}`}>{children || KINDS[kind] || kind}</span>
}
