# _legacy：橘白版保留區

此資料夾存放已下線但保留以供日後復原的頁面。

## Home.jsx（橘白版）

- **下線日期**：2026-04-22
- **下線原因**：暗黑版（HomeDark.jsx）已改為網站主視覺
- **復原方式**：
  1. 將 `Home.jsx` 搬回 `src/pages/`
  2. `App.jsx` 重新 import 並把 `/` 路由指向 `Home`
  3. `ThemeContext.jsx` 預設 `isDark` 改回 `false`
  4. 全專案 `to="/"` 連結改回 `to={isDark ? "/dark" : "/"}`

## 其他橘白版配色資料

注意：其他頁面（Dashboard、SEOAudit 等）的 `!isDark` 分支仍保留於原檔案中，
是完整的橘白版配色/CSS 備份。日後若要復原，這些分支會透過 `isDark=false`
自動生效。
