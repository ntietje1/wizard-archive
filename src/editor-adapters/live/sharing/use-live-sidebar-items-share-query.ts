import { useQueries } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useConvexAuth } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { UseQueryOptions } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import { ERROR_CODE, isClientError } from 'shared/errors/client'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { createSidebarShareQueryItemIdBatches } from './sidebar-share-query-batches'

type SidebarShareQueryData = FunctionReturnType<
  typeof api.sidebarShares.queries.getSidebarItemsWithShares
>

interface SidebarItemsShareQueryResult {
  data: SidebarShareQueryData | undefined
  error: Error | null
  isError: boolean
  isPending: boolean
  isSuccess: boolean
}

export function useLiveSidebarItemsShareQuery(
  sidebarItemIds: Array<ResourceId>,
): SidebarItemsShareQueryResult {
  const { campaignId: workspaceRecordId } = useCampaign()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const batches = createSidebarShareQueryItemIdBatches(sidebarItemIds)
  const authReady = !isLoading && isAuthenticated
  const canQuery = Boolean(workspaceRecordId) && authReady

  const results = useQueries({
    queries: canQuery
      ? (batches.map((batch) => ({
          ...convexQuery(api.sidebarShares.queries.getSidebarItemsWithShares, {
            campaignId: workspaceRecordId!,
            sidebarItemIds: batch,
          }),
        })) as Array<UseQueryOptions<SidebarShareQueryData>>)
      : [],
  })

  if (batches.length === 0) {
    return { data: [], error: null, isError: false, isPending: false, isSuccess: true }
  }

  if (!canQuery || results.some(isAuthErrorResult)) {
    return { data: undefined, error: null, isError: false, isPending: true, isSuccess: false }
  }

  const error = results.find(hasQueryError)?.error ?? null
  if (error) {
    return { data: undefined, error, isError: true, isPending: false, isSuccess: false }
  }

  return {
    data: results.every((result) => result.data)
      ? results.flatMap((result) => result.data!)
      : undefined,
    error: null,
    isError: false,
    isPending: results.some((result) => result.isPending),
    isSuccess: results.every((result) => result.isSuccess),
  }
}

function isAuthErrorResult(result: { error: Error | null }): boolean {
  return Boolean(result.error && isClientError(result.error, ERROR_CODE.NOT_AUTHENTICATED))
}

function hasQueryError(result: { error: Error | null }): boolean {
  return Boolean(result.error)
}
