import { useQuery } from '@tanstack/react-query'
import { useConvexAuth } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

type TData<TQuery extends FunctionReference<'query', 'public'>> =
  FunctionReturnType<TQuery>

type AuthQueryOptions<TQuery extends FunctionReference<'query', 'public'>> =
  Omit<UseQueryOptions<TData<TQuery>>, 'queryKey' | 'queryFn'>

/**
 * Like `useQuery(convexQuery(...))` but gates execution behind auth.
 *
 * - When auth is not ready: query stays `pending` (no null flash, no errors)
 * - When SSR prefetched data exists: returns it immediately via TanStack Query cache
 * - When auth resolves: enables the Convex subscription
 */
export function useAuthQuery<
  TQuery extends FunctionReference<'query', 'public'>,
>(
  query: TQuery,
  args: FunctionArgs<TQuery> | 'skip',
  options?: AuthQueryOptions<TQuery>,
): UseQueryResult<TData<TQuery>> {
  const { isAuthenticated } = useConvexAuth()
  const skip = args === 'skip'

  return useQuery({
    queryKey: ['convexQuery', getFunctionName(query), skip ? 'skip' : args],
    staleTime: Infinity,
    ...options,
    enabled: !skip && isAuthenticated && (options?.enabled ?? true),
  })
}
