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
import * as React from 'react'
import { Toaster } from 'sonner'
import type { ConvexReactClient } from 'convex/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { Theme } from '~/hooks/useTheme'
import { NavigationProgress } from '~/components/navigation-progress'
import { ThemeProvider, ThemeScript } from '~/components/theme-provider'
import { prefetchTheme } from '~/hooks/useTheme'
import { authClient } from '~/lib/auth-client'
import { getToken } from '~/lib/auth-server'
import appCss from '~/styles/app.css?url'

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

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
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  beforeLoad: async (ctx) => {
    if (typeof window !== 'undefined') {
      return {
        token: null,
        initialTheme: undefined,
      }
    }

    const token = await fetchAuthToken()
    let initialTheme: Theme | undefined
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
      initialTheme = await prefetchTheme(ctx.context.queryClient)
    }
    return {
      token,
      initialTheme,
    }
  },
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
  initialTheme?: string
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript initialTheme={initialTheme} />
      </head>
      <body className="flex flex-col min-h-screen">
        <NavigationProgress />
        {children}
        <Toaster />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
