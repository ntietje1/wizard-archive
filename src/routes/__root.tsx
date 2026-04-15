import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { LazyMotion, domAnimation } from 'motion/react'
import * as React from 'react'
import { Toaster } from 'sonner'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { ConvexReactClient } from 'convex/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { Theme } from '~/features/settings/hooks/useTheme'
import type { PanelPreference } from 'convex/userPreferences/types'
import { NavigationProgress } from '~/shared/components/navigation-progress'
import { PreviewBanner } from '~/shared/components/preview-banner'
import { isPreview } from '~/shared/utils/preview'
import { ThemeProvider } from '~/shared/components/theme-provider'
import { resolveTheme } from '~/features/settings/hooks/useTheme'
import { prefetchUserPreferences } from '~/features/settings/hooks/useUserPreferences'
import { authClient } from '~/features/auth/utils/auth-client'
import { getToken } from '~/features/auth/utils/auth-server'
import appCss from '~/styles/app.css?url'
import { logger } from '~/shared/utils/logger'

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async (ctx) => {
    if (typeof window !== 'undefined') {
      return {
        token: null,
        initialTheme: null,
        initialPanelPreferences: null as Record<string, PanelPreference> | null,
      }
    }

    let token: string | undefined = undefined
    try {
      token = await fetchAuthToken()
    } catch (error) {
      logger.debug('[auth] fetchAuthToken failed, falling back to client-side auth:', error)
    }
    let initialTheme: Theme | null = null
    let initialPanelPreferences: Record<string, PanelPreference> | null = null
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
      try {
        const prefs = await prefetchUserPreferences(ctx.context.queryClient)
        initialTheme = prefs?.theme ?? null
        initialPanelPreferences = prefs?.panelPreferences ?? null
      } catch (error) {
        logger.debug(
          '[preferences] prefetchUserPreferences failed, falling back to defaults:',
          error,
        )
      }
    }
    return {
      token,
      initialTheme,
      initialPanelPreferences,
    }
  },
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
        title: "Wizard's Archive",
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
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
      { rel: 'manifest', href: '/site.webmanifest', color: '#ffffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const context = useRouteContext({ from: Route.id })

  return (
    <ConvexBetterAuthProvider
      client={context.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <ThemeProvider initialTheme={context.initialTheme}>
        <RootDocument initialTheme={context.initialTheme}>
          <Outlet />
        </RootDocument>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  )
}

function RootDocument({
  children,
  initialTheme,
}: {
  children: React.ReactNode
  initialTheme: Theme | null
}) {
  return (
    <html lang="en" className={resolveTheme(initialTheme ?? 'system')}>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col h-dvh overflow-hidden">
        <LazyMotion features={domAnimation}>
          <NavigationProgress />
          {isPreview && <PreviewBanner />}
          {children}
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          <TanStackRouterDevtools position="bottom-right" />
        </LazyMotion>
        <Scripts />
      </body>
    </html>
  )
}
