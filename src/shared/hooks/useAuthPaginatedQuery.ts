import { useConvexAuth, usePaginatedQuery } from 'convex/react'
import type {
  PaginatedQueryArgs,
  PaginatedQueryReference,
  UsePaginatedQueryReturnType,
} from 'convex/react'

export function useAuthPaginatedQuery<TQuery extends PaginatedQueryReference>(
  query: TQuery,
  args: PaginatedQueryArgs<TQuery> | 'skip',
  options: { initialNumItems: number },
): UsePaginatedQueryReturnType<TQuery> {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const skip = args === 'skip'
  const authReady = !authLoading && isAuthenticated
  const shouldSkip = skip || !authReady

  return usePaginatedQuery(query, shouldSkip ? 'skip' : args, options)
}
