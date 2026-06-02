import { createContext, useContext, useSyncExternalStore } from 'react'
import type { Theme } from '~/shared/theme/types'

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

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
  return useSyncExternalStore(subscribeToThemeClass, getResolvedThemeFromDOM, () => 'dark' as const)
}
