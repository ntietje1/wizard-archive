import { HeadContent, Scripts, useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { getThemeCookie, resolveTheme } from '~/shared/theme/dom'
import type { Theme } from '~/shared/theme/types'

export function RootDocument({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const appMatch = matches.find((m) => m.routeId === '/_app')

  const themeClass: 'dark' | 'light' = appMatch
    ? (() => {
        const context = appMatch.context
        const initialTheme =
          context && typeof context === 'object' && 'initialTheme' in context
            ? (context as { initialTheme?: Theme | null }).initialTheme
            : null
        return resolveTheme(initialTheme ?? getThemeCookie() ?? 'system')
      })()
    : resolveTheme(getThemeCookie() ?? 'system')

  return (
    <html lang="en" className={themeClass} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
