import { createContext, useContext, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export function applyThemeClass(resolved: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const other = resolved === 'dark' ? 'light' : 'dark'

  root.classList.add('no-transitions', resolved)
  root.classList.remove(other)
  // Force a reflow so the class change paints without transitions, then re-enable
  root.offsetHeight
  root.classList.remove('no-transitions')
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

/**
 * Reads the resolved theme ('dark' | 'light') directly from the <html> classList.
 */
function getResolvedThemeFromDOM(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function subscribeToThemeClass(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

export function useResolvedTheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribeToThemeClass,
    getResolvedThemeFromDOM,
    () => 'dark' as const,
  )
}
