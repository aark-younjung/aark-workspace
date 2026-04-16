import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ isDark: false, setDark: () => {} })

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  const setDark = (val) => {
    setIsDark(val)
    localStorage.setItem('theme', val ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, setDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
