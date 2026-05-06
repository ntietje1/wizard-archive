import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useMatches,
} from '@tanstack/react-router'
import * as React from 'react'
import type { ConvexReactClient } from 'convex/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { getThemeCookie, resolveTheme } from '~/features/settings/hooks/useTheme'
import type { Theme } from '~/features/settings/hooks/useTheme'
import appCss from '~/styles/app.css?url'

const appTitle = "Wizard's Archive"
const appDescription = 'The collaborative campaign manager for TTRPGs.'
const appImage = '/og-image.png'
const appThemeColor = '#7B6FD4'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: appTitle,
      },
      { name: 'description', content: appDescription },
      { name: 'theme-color', content: appThemeColor },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: appTitle },
      { property: 'og:description', content: appDescription },
      { property: 'og:image', content: appImage },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: appTitle },
      { name: 'twitter:description', content: appDescription },
      { name: 'twitter:image', content: appImage },
    ],
    links: [
      {
        rel: 'preload',
        href: '/fonts/inter-variable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: appThemeColor },
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
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
