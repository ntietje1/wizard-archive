import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useEffect, useRef, useState } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { UserPreferences } from 'convex/userPreferences/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

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

export const useUserPreferences = (initial: {
  sidebarWidth: number | null
  isSidebarExpanded: boolean | null
}) => {
  const prefsQuery = useAuthQuery(
    api.userPreferences.queries.getUserPreferences,
    {},
  )

  const setPrefs = useAppMutation(
    api.userPreferences.mutations.setUserPreferences,
    {
      onError: (error) => {
        handleError(error, 'Failed to save preferences')
      },
    },
  )

  const serverWidth = prefsQuery.data?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
  const serverExpanded =
    prefsQuery.data?.isSidebarExpanded ?? DEFAULT_SIDEBAR_EXPANDED

  const [localWidth, setLocalWidth] = useState(
    initial.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
  )
  const [localExpanded, setLocalExpanded] = useState(
    initial.isSidebarExpanded ?? DEFAULT_SIDEBAR_EXPANDED,
  )
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (prefsQuery.isFetched && !hasInitialized.current) {
      setLocalWidth(serverWidth)
      setLocalExpanded(serverExpanded)
      hasInitialized.current = true
    }
  }, [prefsQuery.isFetched, serverWidth, serverExpanded])

  const setSidebarWidth = (width: number) => {
    setLocalWidth(width)
    setPrefs.mutate({ sidebarWidth: width })
  }

  const setIsSidebarExpanded = (expanded: boolean) => {
    setLocalExpanded(expanded)
    setPrefs.mutate({ isSidebarExpanded: expanded })
  }

  const isLoaded = prefsQuery.isSuccess

  return {
    sidebarWidth: localWidth,
    setSidebarWidth,
    isSidebarExpanded: localExpanded,
    setIsSidebarExpanded,
    isLoaded,
  }
}
