import { useEffect } from 'react'
import type { Theme } from '@wizard-archive/ui/theme/types'
import { applyThemeClass, getThemeCookie, resolveTheme } from '~/shared/theme/dom'
import { ThemeProviderContext } from '@wizard-archive/ui/theme/context'
import { useThemePreference } from '~/features/settings/hooks/use-theme-preference'

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: Theme | null
}) {
  const { preferences, setThemeMutation } = useThemePreference()
  const prefs = preferences.data

  const theme: Theme = prefs?.theme ?? initialTheme ?? getThemeCookie() ?? 'system'
  const resolved = resolveTheme(theme)

  const setTheme = (newTheme: Theme) => {
    setThemeMutation.mutate({ theme: newTheme })
  }
  const themeContextValue = { theme, setTheme }

  useEffect(() => {
    applyThemeClass(resolved)
  }, [resolved])

  useEffect(() => {
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax; Secure`
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      applyThemeClass(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeProviderContext.Provider value={themeContextValue}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
