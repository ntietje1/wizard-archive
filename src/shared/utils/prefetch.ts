import { convexQuery } from '@convex-dev/react-query'
import { ERROR_CODE, isAppError } from 'convex/errors'
import type { QueryClient } from '@tanstack/react-query'
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from 'convex/server'

export async function prefetchQuery<
  TQuery extends FunctionReference<'query', 'public'>,
>(
  queryClient: QueryClient,
  query: TQuery,
  args: FunctionArgs<TQuery>,
): Promise<FunctionReturnType<TQuery> | undefined> {
  try {
    return await queryClient.ensureQueryData(convexQuery(query, args))
  } catch (e) {
    if (!isAppError(e, ERROR_CODE.NOT_AUTHENTICATED)) throw e
    return undefined
  }
}
