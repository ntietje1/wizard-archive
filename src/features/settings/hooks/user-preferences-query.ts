import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { QueryClient } from '@tanstack/react-query'
import type { UserPreferences } from 'shared/user-preferences/types'
import { logger } from '~/shared/utils/logger'

export const userPreferencesQueryOptions = convexQuery(
  api.userPreferences.queries.getUserPreferences,
  {},
)

export async function prefetchUserPreferences(
  queryClient: QueryClient,
): Promise<UserPreferences | undefined> {
  return await queryClient
    .ensureQueryData(userPreferencesQueryOptions)
    .catch((error: unknown) => {
      logger.error('[preferences] Failed to prefetch user preferences', error)
      return undefined
    })
    .then((data) => data ?? undefined)
}
