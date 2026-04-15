import { Outlet, createFileRoute, useRouteContext } from '@tanstack/react-router'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { LazyMotion, domAnimation } from 'motion/react'
import { Toaster } from 'sonner'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { PanelPreference } from 'convex/userPreferences/types'
import type { Theme } from '~/features/settings/hooks/useTheme'
import { NavigationProgress } from '~/shared/components/navigation-progress'
import { PreviewBanner } from '~/shared/components/preview-banner'
import { isPreview } from '~/shared/utils/preview'
import { ThemeProvider } from '~/shared/components/theme-provider'
import { prefetchUserPreferences } from '~/features/settings/hooks/useUserPreferences'
import { authClient } from '~/features/auth/utils/auth-client'
import { getToken } from '~/features/auth/utils/auth-server'
import { logger } from '~/shared/utils/logger'

const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const Route = createFileRoute('/_app')({
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
  component: AppLayout,
})

function AppLayout() {
  const context = useRouteContext({ from: Route.id })

  return (
    <ConvexBetterAuthProvider
      client={context.convexClient}
      authClient={authClient}
      initialToken={context.token}
    >
      <ThemeProvider initialTheme={context.initialTheme}>
        <LazyMotion features={domAnimation}>
          <NavigationProgress />
          {isPreview && <PreviewBanner />}
          <Outlet />
          <Toaster />
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
          <TanStackRouterDevtools position="bottom-right" />
        </LazyMotion>
      </ThemeProvider>
    </ConvexBetterAuthProvider>
  )
}
