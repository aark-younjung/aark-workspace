# Agency Mode 藍圖（規劃文件、未實作）

> 2026-06-04 創建。用戶（mark6465）是行銷 agency、替客戶維護網站、需要 multi-client 工作流。
> 商業層級對應 CLAUDE.md 提到的「Agency 版 NT$4,990/月起、即將推出、50 站 / 白標 PDF / 多客戶工作區 / 優先客服」。

---

## 為什麼要做 Agency Mode

**現在的 AI 雷達假設：** 用戶 = 網站擁有者、有 WP 後台權、自己看 finding 自己改。

**Agency 真實情境：**
- 一個 agency 同時維護 5-50 個客戶網站
- 多數客戶把 WP 帳密交給 agency、但敏感操作要客戶授權
- agency 收費的 deliverable 是「報告 + 我們已修 + 客戶要做的」清單
- 客戶看不懂 AI 雷達後台、要 agency 把資料整理過再交付

**痛點對應的功能缺口（這個 session 已部分補上）：**
- ✅ fix_owner 權限標籤 — agency 一眼分辨自己能搞定 vs 要找客戶（#1、本 session 完成）
- ✅ 客戶報告匯出 markdown — 一鍵產可寄給客戶的整理過版本（#2、本 session 完成）
- ❌ 多客戶工作區切換 — 還沒做（#3 主軸）
- ❌ 白標 PDF（agency logo / 顏色）— 還沒做
- ❌ 客戶訪客模式 — 還沒做（給客戶看 dashboard 但只能看不能改）

---

## Phase 拆解（5 個 phase、累計 8-12 小時）

### Phase A — 多客戶工作區切換（最核心、最先做）
**目標：** 一個 agency 帳號管理 N 個客戶網站、Dashboard 頂部有切換器。

**改動：**
- DB schema：新增 `agency_workspaces` 表（id, name, owner_user_id, created_at）
- `websites` 加 `workspace_id` 欄位（nullable、向下相容）
- AuthContext 加 `currentWorkspaceId` state
- SiteHeader 加 workspace switcher（dropdown 或側邊欄）
- 所有 query（websites / audits）加 workspace_id filter
- 新增工作區、加客戶網站、刪工作區流程

**估時：** 4-5 小時
**風險：** 中（涉及多表 schema 改、要 migrate 現有 websites）

---

### Phase B — 客戶訪客模式（讓 agency 給客戶 read-only link）
**目標：** agency 發一個分享連結給客戶、客戶不用登入就能看自家 dashboard、但不能改。

**改動：**
- `public_share_tokens` 表（token UUID、website_id、created_by_user_id、expires_at）
- 公開路由 `/share/:token` — 顯示 read-only dashboard
- Share button 在 Dashboard 右上、產 token + 複製連結
- Token 可設過期、可撤銷

**估時：** 2-3 小時
**風險：** 低（純 read-only、安全考量主要是 token RLS policy）

---

### Phase C — 白標 PDF（agency logo / 自訂顏色）
**目標：** 「給客戶報告」匯出可選 PDF + 套用 agency 自己的 logo / 顏色 / 簽名。

**改動：**
- `agency_branding` 表（agency_user_id、logo_url、primary_color、footer_text）
- Account 頁加「品牌設定」分頁
- buildClientReport 改成支援 branding override
- 加 PDF 匯出（用 jsPDF + html2canvas、跟現有 PDF export 同 stack）

**估時：** 2-3 小時
**風險：** 低（純呈現層）

---

### Phase D — 客戶端「修復清單」應用程式風格 UI
**目標：** 客戶收到 markdown 報告後、有個專屬 web app（agency 帳號下、客戶 read-only）可以打勾「我修好了」。

**改動：**
- 把 fix_events 開放給客戶（read-only role）— 但客戶要能 INSERT 自己的標記
- 客戶端 UI：可勾「已修復」、加註解（如「2026-06-10 由阿明處理」）
- agency 端 dashboard 顯示客戶處理進度

**估時：** 3-4 小時
**風險：** 中（需要新的 RLS role / 客戶不註冊也能用）

---

### Phase E — 多客戶 dashboard 聚合（agency 視角的 KPI）
**目標：** agency 自己的「公司視角」dashboard — 看所有客戶網站總分均值、最 urgent 的客戶、本月已處理 finding 總數。

**改動：**
- 新路由 `/agency-dashboard`
- 跨 workspace 聚合查詢
- 排行表 + 提醒 widget

**估時：** 2-3 小時
**風險：** 低

---

## 建議執行順序

```
Phase A（多客戶切換）   ← 最先做、其他功能都依賴 workspace_id
   ↓
Phase C（白標 PDF）     ← agency 商業必需、提升 deliverable 質感
   ↓
Phase B（客戶訪客）     ← 提升客戶滿意度、減少 agency 重複解釋
   ↓
Phase E（agency KPI）   ← 經營層 dashboard、讓 agency 看到自己的成長
   ↓
Phase D（客戶端打勾）   ← 進階、雙向協作、可以晚做
```

---

## 商業模式呼應

CLAUDE.md 商業模式提到 **「Agency 版 NT$4,990/月起、即將推出」**、這幾個 phase 完成後可以正式上線：

| Phase | 對應 Agency 版功能 |
|-------|-------------------|
| A     | 50 站、多客戶工作區 |
| B     | 客戶協作 |
| C     | 白標 PDF |
| D     | 客戶協作（進階） |
| E     | 多客戶聚合 |

定價合理性檢驗：
- agency 拿 NT$4,990/月 × 12 個月 = NT$59,880/年
- 替代方案：自己僱一個工讀生整理報告 → 每月人工成本 NT$8,000-12,000
- ROI 點：**每月省 4 小時整理時間** + **客戶覺得 agency 更專業**

---

## 不做的決策（trade-offs）

| 想法 | 為什麼不做 |
|------|----------|
| 直接連客戶 WP 改 DB | 越界、agency-client 關係模糊化、責任不清 |
| 全自動修復（無人值守） | AI 自動下指令到 client WP = 災難放大器、不做 |
| 多 SEO 外掛適配（Yoast / SEOPress / AIOSEO 全支援） | 先 Rank Math 一個搞好、佔台灣 70% 中小企業 |
| 客戶不註冊就能用全部功能 | 安全 + 商業（agency 才付錢）兩個原因 |

---

## 下一步（執行決定）

當你（mark6465）準備好開始 Phase A、跟我說：
- **「開 A」** → 我先設計 SQL schema、寫 migration 步驟、再實作 React 部分
- **「先聊 trade-off」** → 我可以針對 Phase A 的設計細節深入討論（例如「workspace 是否要支援 nested」「個人帳號要不要強制變預設 workspace」等）

預估從 0 → Agency 版上線：**3-4 個 session、~12 小時 dev time**。
