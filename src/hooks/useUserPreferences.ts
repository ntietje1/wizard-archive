import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { UserPreferences } from 'convex/userPreferences/types'
import { useAuthQuery } from '~/hooks/useAuthQuery'

const DEFAULT_SIDEBAR_WIDTH = 280
const DEFAULT_SIDEBAR_EXPANDED = true

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

export const useUserPreferences = () => {
  const prefsQuery = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
  )

  const setPrefs = useMutation({
    mutationFn: useConvexMutation(
      api.userPreferences.mutations.setUserPreferences,
    ),
  })

  // Local state for immediate UI updates
  const serverWidth = prefsQuery.data?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
  const serverExpanded =
    prefsQuery.data?.isSidebarExpanded ?? DEFAULT_SIDEBAR_EXPANDED

  const [localWidth, setLocalWidth] = useState(serverWidth)
  const [localExpanded, setLocalExpanded] = useState(serverExpanded)
  const hasInitialized = useRef(false)

  // Sync server values to local state on initial load only
  useEffect(() => {
    if (prefsQuery.isFetched && !hasInitialized.current) {
      setLocalWidth(serverWidth)
      setLocalExpanded(serverExpanded)
      hasInitialized.current = true
    }
  }, [prefsQuery.isFetched, serverWidth, serverExpanded])

  const setSidebarWidth = useCallback(
    (width: number) => {
      setLocalWidth(width)
      setPrefs.mutate({ sidebarWidth: width })
    },
    [setPrefs],
  )

  const setIsSidebarExpanded = useCallback(
    (expanded: boolean) => {
      setLocalExpanded(expanded)
      setPrefs.mutate({ isSidebarExpanded: expanded })
    },
    [setPrefs],
  )

  const isLoaded = prefsQuery.isSuccess

  return {
    sidebarWidth: localWidth,
    setSidebarWidth,
    isSidebarExpanded: localExpanded,
    setIsSidebarExpanded,
    isLoaded,
  }
}
