import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from 'convex/react'
import { ERROR_CODE, isClientError } from 'convex/errors'
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

/**
 * Like `useQuery(convexQuery(...))` but gates execution behind auth.
 *
 * Auth errors (NOT_AUTHENTICATED) are swallowed — the query appears as
 * "pending" instead of "error"
 */
export function useAuthQuery<
  TQuery extends FunctionReference<'query', 'public'>,
>(
  query: TQuery,
  args: FunctionArgs<TQuery> | 'skip',
  options?: AuthQueryOptions<TQuery>,
): UseQueryResult<TData<TQuery>> {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const skip = args === 'skip'
  const authReady = !isLoading && isAuthenticated
  const shouldSkip = skip || !authReady

  const result = useQuery({
    ...convexQuery(query, args),
    ...options,
    enabled: !shouldSkip && (options?.enabled ?? true),
  } as UseQueryOptions<TData<TQuery>>)

  const isAuthError =
    result.error && isClientError(result.error, ERROR_CODE.NOT_AUTHENTICATED)

  if (!isAuthError) return result
  return {
    ...result,
    status: 'pending' as const,
    error: null,
    isError: false,
    isPending: true,
    isSuccess: false,
    isLoading: true,
    isLoadingError: false,
    isRefetchError: false,
    data: undefined,
    failureReason: null,
  }
}
