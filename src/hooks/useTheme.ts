import { createContext, useContext, useSyncExternalStore } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { QueryClient } from '@tanstack/react-query'

export type Theme = 'dark' | 'light' | 'system'

export type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeProviderContext = createContext<
  ThemeProviderState | undefined
>(undefined)

export const profileQueryOptions = convexQuery(
  api.users.queries.getUserProfile,
  {},
)

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
  if (!root.classList.contains(resolved)) {
    root.classList.add(resolved)
  }
  root.classList.remove(other)
}

const VALID_THEMES = new Set(['dark', 'light', 'system'])

function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.has(value)
}

export async function prefetchTheme(
  queryClient: QueryClient,
): Promise<Theme | undefined> {
  try {
    const profile = await queryClient.ensureQueryData(profileQueryOptions)
    return isValidTheme(profile?.theme) ? profile.theme : undefined
  } catch {
    return undefined
  }
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
