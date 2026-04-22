import { createContext, useContext, useState, useEffect } from 'react'

// 主題預設為暗黑版（主視覺）。橘白版已下線，保留於 _legacy 資料夾供未來復原對照
const ThemeContext = createContext({ isDark: true, setDark: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    // 若 sessionStorage 無值，預設使用暗黑版
    const stored = sessionStorage.getItem('theme')
    return stored === null ? true : stored === 'dark'
  })

  const setDark = (val) => {
    setIsDark(val)
    sessionStorage.setItem('theme', val ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
