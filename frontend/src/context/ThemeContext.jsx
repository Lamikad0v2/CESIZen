import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'

const ThemeContext = createContext({ dark: false, toggle: () => {} })

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('cesizen_theme') === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('cesizen_theme', dark ? 'dark' : 'light')
    } catch { /* ignore */ }
  }, [dark])

  const value = useMemo(() => ({ dark, toggle: () => setDark(d => !d) }), [dark])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
ThemeProvider.propTypes = { children: PropTypes.node.isRequired }

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext)
