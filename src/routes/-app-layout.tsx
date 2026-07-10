import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Outlet, useRouteContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@wizard-archive/ui/shadcn/components/sonner'
import { LazyMotion, domAnimation } from 'motion/react'
import { authClient } from '~/features/auth/utils/auth-client'
import { NavigationProgress } from '~/shared/components/navigation-progress'
import { PreviewBanner } from '~/shared/components/preview-banner'
import { ThemeProvider } from '~/shared/components/theme-provider'
import { isPreview } from '~/shared/utils/preview'

export function AppLayout() {
  const context = useRouteContext({ from: '/_app' })

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
