import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import ErrorPage from '~/shared/components/error-page'
import NotFoundPage from '~/shared/components/not-found'

export function getRouter() {
  const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
  if (!CONVEX_URL) {
    throw new Error('missing VITE_CONVEX_URL env var')
  }

  const convex = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  })
  const convexQueryClient = new ConvexQueryClient(convex)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5000,
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadDelay: 50,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: (err) => <ErrorPage error={err.error.message} />,
    defaultNotFoundComponent: () => <NotFoundPage />,
    context: { queryClient, convexClient: convex, convexQueryClient },
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
