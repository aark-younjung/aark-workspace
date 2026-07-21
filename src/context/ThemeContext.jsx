import { createContext, useContext, useState, useEffect } from 'react'
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme } from '../styles/themes'

// 2026-07-21：從單純的 isDark 開關，擴充成「多組配色」。
// isDark 保留是為了向下相容 —— 全站仍有 !isDark 的淺色分支（橘白版遺留）。
// 目前所有主題都是深色，所以 isDark 維持 true；等亮色主題做好再讓它跟著變。
const ThemeContext = createContext({
  isDark: true,
  setDark: () => {},
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
})

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = sessionStorage.getItem('theme')
    return stored === null ? true : stored === 'dark'
  })

  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      return THEMES[saved] ? saved : DEFAULT_THEME
    } catch {
      return DEFAULT_THEME
    }
  })

  // 掛載時 + 每次切換都把 CSS 變數寫到 <html>，全站 1,400+ 處 T.xxx 會一起變色
  useEffect(() => { applyTheme(theme) }, [theme])

  const setTheme = (name) => {
    if (!THEMES[name]) return
    setThemeState(name)
    try { localStorage.setItem(THEME_STORAGE_KEY, name) } catch { /* 無痕模式：這次有效、不記住 */ }
  }

  const setDark = (val) => {
    setIsDark(val)
    sessionStorage.setItem('theme', val ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, setDark, theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
