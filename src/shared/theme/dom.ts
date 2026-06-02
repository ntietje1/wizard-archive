import type { Theme } from '~/shared/theme/types'

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyThemeClass(resolved: 'dark' | 'light') {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const other = resolved === 'dark' ? 'light' : 'dark'

  root.classList.add('no-transitions', resolved)
  root.classList.remove(other)
  void root.offsetHeight
  root.classList.remove('no-transitions')
}

export function getThemeCookie(): Theme | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|; )theme=([^;]*)/)
  if (!match) return null
  const value = match[1]
  if (value === 'dark' || value === 'light' || value === 'system') return value
  return null
}
