/**
 * OrgSchemaGenerator — 個人化 Organization Schema 產生器（Pro 限定）
 *
 * 對應 YouTube 影片那段「用 ChatGPT 生 code」的痛點解法 — 我們直接整合進產品：
 *   用戶填一次品牌資料 → 永久存到 profiles.org_schema_data JSONB → 自動產出客製化
 *   Organization JSON-LD code → 一鍵複製貼到網站 head。
 *
 * 為什麼 Pro 限定：
 *   通用 Organization schema 範本（自己填空）是 freeForAll；自動化 + 持久儲存是 Pro 主賣點
 *   （CLAUDE.md「修復碼產生器」原本就是 Pro 核心功能定位）。
 *
 * 表單欄位（依 schema.org Organization 必要 / 推薦欄位精選）：
 *   - 公司名稱（必填，中文）
 *   - 英文名稱（alternateName，選填）
 *   - 網站 URL（必填）
 *   - Logo URL（選填）
 *   - 公司簡介（必填，1-2 句）
 *   - Email（必填）
 *   - 電話（選填）
 *   - 地址（選填，單一欄位）
 *   - 社群連結 5 個（sameAs，選填）
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { T } from '../../styles/v2-tokens'
import { GlassCard } from './index'

// 表單初始值 — 一次定義避免每次 render 重建（reference 穩定）
const EMPTY_FORM = {
  name: '',
  alternateName: '',
  url: '',
  logo: '',
  description: '',
  email: '',
  telephone: '',
  address: '',
  sameAs: ['', '', '', '', ''],
}

// 從表單資料生成 JSON-LD 字串（含 <script> 標籤、可直接複製貼網站 head）
function generateSchemaCode(data) {
  if (!data?.name) return '// 請至少填寫公司名稱'

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
  }
  if (data.alternateName?.trim()) schema.alternateName = data.alternateName.trim()
  if (data.url?.trim()) schema.url = data.url.trim()
  if (data.logo?.trim()) schema.logo = data.logo.trim()
  if (data.description?.trim()) schema.description = data.description.trim()
  if (data.email?.trim()) schema.email = data.email.trim()
  if (data.telephone?.trim()) schema.telephone = data.telephone.trim()
  if (data.address?.trim()) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: data.address.trim(),
    }
  }
  // sameAs 過濾空字串、去重、保留順序
  const social = (data.sameAs || []).map(s => (s || '').trim()).filter(Boolean)
  if (social.length > 0) schema.sameAs = social

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
}

export default function OrgSchemaGenerator() {
  const { user, isPro, loading: authLoading } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [editMode, setEditMode] = useState(false)   // true 顯示表單、false 顯示產生 code

  // mount 拉用戶既有資料 — 有資料切預覽模式，沒資料留編輯模式
  useEffect(() => {
    if (authLoading) return
    if (!user?.id) { setLoading(false); return }
    let cancelled = false
    supabase
      .from('profiles')
      .select('org_schema_data')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const saved = data?.org_schema_data
        if (saved?.name) {
          // 合併存的資料 + 預設值（避免缺欄位破 form）
          setForm({
            ...EMPTY_FORM,
            ...saved,
            sameAs: (saved.sameAs && saved.sameAs.length === 5) ? saved.sameAs : [...EMPTY_FORM.sameAs],
          })
          setEditMode(false)   // 有資料 → 預覽模式
        } else {
          setEditMode(true)    // 沒資料 → 編輯模式
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id, authLoading])

  const updateField = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])
  const updateSocial = useCallback((idx, value) => {
    setForm(prev => {
      const sameAs = [...prev.sameAs]
      sameAs[idx] = value
      return { ...prev, sameAs }
    })
  }, [])

  async function handleSave() {
    if (!form.name?.trim()) { setSaveMessage('⚠️ 請至少填寫公司名稱'); return }
    if (!user?.id) return
    setSaving(true)
    setSaveMessage('')
    const { error } = await supabase
      .from('profiles')
      .update({ org_schema_data: form })
      .eq('id', user.id)
    setSaving(false)
    if (error) {
      setSaveMessage('❌ 儲存失敗：' + error.message)
    } else {
      setSaveMessage('✅ 已儲存')
      setEditMode(false)   // 切到預覽
      setTimeout(() => setSaveMessage(''), 2500)
    }
  }

  function handleCopy() {
    const code = generateSchemaCode(form)
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Auth 還沒載入 → 不渲染（避免閃爍）
  if (authLoading) return null

  // 未登入：完全不顯示（這個區塊只給已登入用戶看到）
  if (!user) return null

  // 免費版：顯示 Pro upsell（給「給看到 → 想要 → 升 Pro」的轉化機會）
  if (!isPro) {
    return (
      <GlassCard color={T.aeo} style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🪪</span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
            個人化 Organization Schema 產生器
          </h3>
          <span style={{
            fontSize: 14, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
            background: `color-mix(in srgb, ${T.orange} 15%, transparent)`, color: T.orange, border: `1px solid color-mix(in srgb, ${T.orange} 33%, transparent)`,
          }}>Pro 限定</span>
        </div>
        <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginBottom: 14 }}>
          填一次品牌資料（公司名 / 網址 / 聯絡方式 / 社群連結等）→ 永久存著 →
          自動產出**客製化** Organization JSON-LD code →一鍵複製貼網站 head。
        </p>
        <p style={{ fontSize: 14, color: T.textLow, lineHeight: 1.65, marginBottom: 16 }}>
          免費版可看通用範本（要自己填空），Pro 版自動帶入你的資料、未來都用同一份、不必每次重填。
        </p>
        <Link to="/pricing" style={{
          display: 'inline-block', padding: '10px 20px',
          background: `linear-gradient(135deg, ${T.orange}, #f59e0b)`,
          color: 'white', fontSize: 14, fontWeight: 700,
          borderRadius: T.rM, textDecoration: 'none',
        }}>升級 Pro 解鎖 →</Link>
      </GlassCard>
    )
  }

  // Pro 版完整功能
  return (
    <GlassCard color={T.aeo} style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22 }}>🪪</span>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
          個人化 Organization Schema 產生器
        </h3>
        <span style={{
          fontSize: 14, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
          background: T.aeo + '26', color: T.aeo, border: `1px solid ${T.aeo}55`,
        }}>Pro</span>
      </div>
      <p style={{ fontSize: 14, color: T.textMid, lineHeight: 1.65, marginBottom: 16 }}>
        填一次品牌資料、永久儲存。產生的 JSON-LD 貼到網站 <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 5px', borderRadius: 3 }}>&lt;head&gt;</code> 裡，AI 引擎就能正確辨識你的品牌。
      </p>

      {loading ? (
        <p style={{ fontSize: 14, color: T.textLow }}>載入中...</p>
      ) : editMode ? (
        /* ─── 編輯模式：表單 ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label="公司名稱（中文，必填）" required>
            <Input value={form.name} onChange={v => updateField('name', v)} placeholder="例：優勢方舟數位行銷" />
          </FieldRow>
          <FieldRow label="英文 / 替代名稱（選填）">
            <Input value={form.alternateName} onChange={v => updateField('alternateName', v)} placeholder="例：AARK Digital Marketing" />
          </FieldRow>
          <FieldRow label="網站 URL（必填）" required>
            <Input value={form.url} onChange={v => updateField('url', v)} placeholder="https://aark.com.tw" />
          </FieldRow>
          <FieldRow label="Logo URL（選填，建議 200x200 以上）">
            <Input value={form.logo} onChange={v => updateField('logo', v)} placeholder="https://aark.com.tw/logo.png" />
          </FieldRow>
          <FieldRow label="公司簡介（必填，1-2 句）" required>
            <Textarea value={form.description} onChange={v => updateField('description', v)} placeholder="例：台灣首款 AI 能見度檢測工具，幫助品牌掌握在 ChatGPT、Perplexity、Google AI 中的曝光度。" />
          </FieldRow>
          <FieldRow label="客服 Email（必填）" required>
            <Input value={form.email} onChange={v => updateField('email', v)} placeholder="contact@yourcompany.com" type="email" />
          </FieldRow>
          <FieldRow label="電話（選填）">
            <Input value={form.telephone} onChange={v => updateField('telephone', v)} placeholder="+886-2-XXXX-XXXX" />
          </FieldRow>
          <FieldRow label="地址（選填）">
            <Input value={form.address} onChange={v => updateField('address', v)} placeholder="台南市東區怡東路 86 巷 10 號" />
          </FieldRow>
          <FieldRow label="社群連結（選填，最多 5 個 — sameAs）">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.sameAs.map((v, i) => (
                <Input
                  key={i}
                  value={v}
                  onChange={val => updateSocial(i, val)}
                  placeholder={i === 0 ? 'https://facebook.com/yourbrand' : i === 1 ? 'https://instagram.com/yourbrand' : i === 2 ? 'https://www.youtube.com/@yourbrand' : `第 ${i + 1} 個社群連結`}
                />
              ))}
            </div>
          </FieldRow>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                fontSize: 14, fontWeight: 700, padding: '10px 20px', borderRadius: T.rM,
                background: `linear-gradient(135deg, ${T.aeo}, #a855f7)`,
                color: 'white', border: 'none', cursor: saving ? 'wait' : 'pointer', fontFamily: T.font,
              }}
            >{saving ? '儲存中...' : '💾 儲存並產生 code'}</button>
            {form.name && (
              <button
                type="button"
                onClick={() => setEditMode(false)}
                style={{
                  fontSize: 14, padding: '10px 20px', borderRadius: T.rM,
                  background: 'rgba(255,255,255,0.05)',
                  color: T.text,
                  border: `1px solid ${T.cardBorder}`,
                  cursor: 'pointer', fontFamily: T.font,
                }}
              >取消</button>
            )}
            {saveMessage && (
              <span style={{ fontSize: 14, color: saveMessage.startsWith('✅') ? T.pass : T.warn }}>{saveMessage}</span>
            )}
          </div>
        </div>
      ) : (
        /* ─── 預覽模式：顯示產生的 code + 複製按鈕 ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <pre style={{
            margin: 0, padding: 14, fontSize: 14, lineHeight: 1.65,
            background: 'rgba(0,0,0,0.55)', border: `1px solid ${T.cardBorder}`,
            borderRadius: 8, color: '#cbd5e1', fontFamily: T.mono,
            overflow: 'auto', maxHeight: 360,
          }}>{generateSchemaCode(form)}</pre>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontSize: 14, fontWeight: 700, padding: '10px 20px', borderRadius: T.rM,
                background: copied ? T.pass + '33' : `linear-gradient(135deg, ${T.aeo}, #a855f7)`,
                color: copied ? T.pass : 'white',
                border: copied ? `1px solid ${T.pass}` : 'none',
                cursor: 'pointer', fontFamily: T.font,
              }}
            >{copied ? '✓ 已複製到剪貼簿' : '📋 一鍵複製 code'}</button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              style={{
                fontSize: 14, padding: '10px 20px', borderRadius: T.rM,
                background: 'rgba(255,255,255,0.05)',
                color: T.text,
                border: `1px solid ${T.cardBorder}`,
                cursor: 'pointer', fontFamily: T.font,
              }}
            >✏️ 編輯品牌資料</button>
          </div>

          <details style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', color: T.text, fontWeight: 600 }}>
              ▶ 怎麼把這段 code 加到我的網站？
            </summary>
            <div style={{ paddingLeft: 16, paddingTop: 8 }}>
              <p><strong style={{ color: T.text }}>WordPress：</strong> 安裝「Head, Footer and Post Injections」外掛，在「&lt;head&gt; 區段」貼上 → 儲存。</p>
              <p><strong style={{ color: T.text }}>Shopify：</strong> 後台 → Online Store → Themes → Actions → Edit code → theme.liquid，在 &lt;head&gt; 結尾貼上。</p>
              <p><strong style={{ color: T.text }}>Wix：</strong> Settings → Custom Code → Add Custom Code → 選「Head」位置貼上。</p>
              <p><strong style={{ color: T.text }}>自架 HTML：</strong> 把整段 code 貼到每頁 HTML 的 &lt;/head&gt; 之前。</p>
              <p style={{ marginTop: 8, color: T.textLow, fontSize: 14 }}>
                💡 貼完用 <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" style={{ color: T.aeo }}>Google Rich Results Test</a> 驗證有抓到 Organization。
              </p>
            </div>
          </details>
        </div>
      )}
    </GlassCard>
  )
}

// ─────────── 輔助小元件（避免 JSX 巨石）───────────

function FieldRow({ label, required, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: T.textMid, marginBottom: 4 }}>
        {label}
        {required && <span style={{ color: T.fail, marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      defaultValue={value}
      onBlur={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '8px 12px', fontSize: 14,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 6, color: T.text, outline: 'none',
        fontFamily: T.font,
      }}
    />
  )
}

function Textarea({ value, onChange, placeholder }) {
  return (
    <textarea
      defaultValue={value}
      onBlur={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: '100%', padding: '8px 12px', fontSize: 14,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.cardBorder}`,
        borderRadius: 6, color: T.text, outline: 'none',
        fontFamily: T.font, resize: 'vertical',
      }}
    />
  )
}
