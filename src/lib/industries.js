/**
 * 行業分類 taxonomy（2026-06-07 加）
 *
 * 用途：
 *   - aivis_brands.industries TEXT[] 存使用者標記的行業 slugs
 *   - WeeklyAITrendsCard 用來顯示行業 filter chips
 *   - 未來 Phase B 會用 ai_prompt_template 跑行業專屬 aivis prompts
 *
 * 規範：
 *   - slug = ASCII 小寫 + dash（DB 存它、不變、之後行業重命名用 name 改但 slug 不動）
 *   - name = 中文顯示名（首頁/Dashboard chip 顯示）
 *   - emoji = 一個 emoji 給 chip 視覺辨識
 *   - keywords = 之後 Phase B 用來判斷品牌自動歸類的關鍵字（先記著）
 *
 * 不要在這個檔加邏輯、純資料。
 */

export const INDUSTRIES = [
  { slug: 'beauty-spa',       name: '美業',     emoji: '💆', keywords: ['美容', 'SPA', '護膚', '美甲', '美髮'] },
  { slug: 'restaurant',       name: '餐飲',     emoji: '🍴', keywords: ['餐廳', '咖啡', '飲料', '小吃', '烘焙'] },
  { slug: 'ecommerce',        name: '電商',     emoji: '🛒', keywords: ['電商', '網購', '購物', '平台', 'B2C', 'B2B'] },
  { slug: 'education',        name: '教育',     emoji: '🎓', keywords: ['補習', '線上課程', '教育', '學校', '訓練'] },
  { slug: 'medical',          name: '醫療',     emoji: '🏥', keywords: ['診所', '醫院', '藥局', '健康', '保健'] },
  { slug: 'finance',          name: '金融',     emoji: '💰', keywords: ['金融', '保險', '理財', '投資', '銀行'] },
  { slug: 'real-estate',      name: '房地產',   emoji: '🏠', keywords: ['房地產', '仲介', '建商', '租屋', '裝潢'] },
  { slug: 'travel',           name: '旅遊',     emoji: '✈️', keywords: ['旅遊', '飯店', '民宿', '旅行社', '機票'] },
  { slug: 'fashion',          name: '時尚',     emoji: '👗', keywords: ['時尚', '服飾', '鞋包', '配件', '珠寶'] },
  { slug: 'fitness',          name: '健身',     emoji: '🏋️', keywords: ['健身', '瑜伽', '運動', '健身房', '私教'] },
  { slug: 'tech',             name: '科技',     emoji: '💻', keywords: ['軟體', '硬體', 'SaaS', 'IT', '顧問'] },
  { slug: 'manufacturing',    name: '製造業',   emoji: '🏭', keywords: ['製造', '工業', '五金', '工廠', '機械'] },
  { slug: 'pet',              name: '寵物',     emoji: '🐶', keywords: ['寵物', '動物', '飼料', '美容', '醫療'] },
  { slug: 'media',            name: '媒體娛樂', emoji: '🎬', keywords: ['媒體', '娛樂', '影視', '音樂', '內容'] },
  { slug: 'consumer-goods',   name: '民生消費', emoji: '🛍️', keywords: ['日用品', '家用品', '個人護理', '清潔'] },
  { slug: 'other',            name: '其他',     emoji: '📦', keywords: [] },
]

// slug → INDUSTRY 字典（快速查詢用）
export const INDUSTRIES_BY_SLUG = Object.fromEntries(INDUSTRIES.map(i => [i.slug, i]))

// 拿 slug list 回傳對應的 name list（給 UI 顯示用）
export function namesOf(slugs) {
  if (!Array.isArray(slugs)) return []
  return slugs.map(s => INDUSTRIES_BY_SLUG[s]?.name).filter(Boolean)
}
