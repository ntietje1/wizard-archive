import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { QueryClient } from '@tanstack/react-query'
import type { UserPreferences } from 'convex/userPreferences/types'

export const userPreferencesQueryOptions = convexQuery(
  api.userPreferences.queries.getUserPreferences,
  {},
)

export async function prefetchUserPreferences(
  queryClient: QueryClient,
): Promise<UserPreferences | undefined> {
  return await queryClient
    .ensureQueryData(userPreferencesQueryOptions)
    .catch(() => undefined)
    .then((data) => data ?? undefined)
}
