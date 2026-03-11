import { useQuery, useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from 'convex/react'
import { ERROR_CODE, isAppError } from 'convex/errors'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

type TData<TQuery extends FunctionReference<'query', 'public'>> =
  FunctionReturnType<TQuery>

type AuthQueryOptions<TQuery extends FunctionReference<'query', 'public'>> =
  Omit<UseQueryOptions<TData<TQuery>>, 'queryKey' | 'queryFn' | 'retry'>

const AUTH_RETRY_COUNT = 3
const DEFAULT_RETRY_COUNT = 2

/**
 * Like `useQuery(convexQuery(...))` but gates execution behind auth.
 *
 * - When auth is not ready: uses 'skip' to prevent premature Convex
 *   subscriptions, but bridges SSR-prefetched data via initialData
 *   so hydration matches the server render.
 */
export function useAuthQuery<
  TQuery extends FunctionReference<'query', 'public'>,
>(
  query: TQuery,
  args: FunctionArgs<TQuery> | 'skip',
  options?: AuthQueryOptions<TQuery>,
): UseQueryResult<TData<TQuery>> {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const queryClient = useQueryClient()
  const skip = args === 'skip'
  const authReady = !isLoading && isAuthenticated
  const shouldSkip = skip || !authReady

  // When auth isn't ready, read SSR-prefetched data from the real-args
  // cache entry to pass as initialData. This keeps the 'skip' query key
  // (preventing Convex subscriptions) while preserving hydration parity.
  let initialData: TData<TQuery> | undefined
  if (!skip && !authReady) {
    const { queryKey } = convexQuery(query, args)
    initialData = queryClient.getQueryData<TData<TQuery>>(queryKey)
  }

  const convexArgs = (shouldSkip ? 'skip' : args) as FunctionArgs<TQuery>

  return useQuery({
    ...convexQuery(query, convexArgs),
    ...options,
    enabled: !shouldSkip && (options?.enabled ?? true),
    ...(initialData !== undefined ? { initialData } : {}),
    retry: (failureCount, error) => {
      if (isAppError(error, ERROR_CODE.NOT_AUTHENTICATED))
        return failureCount < AUTH_RETRY_COUNT
      return failureCount < DEFAULT_RETRY_COUNT
    },
  } as UseQueryOptions<TData<TQuery>>)
}
