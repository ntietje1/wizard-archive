import { ERROR_CODE, isClientError } from 'shared/errors/client'
import type { Campaign } from 'shared/campaigns/types'
import type { QueryStatus } from '@tanstack/react-query'

type CampaignLookupQuery = {
  data: Campaign | undefined
  error: unknown
  status: QueryStatus
  refetch: () => unknown
}

export type CampaignLookupState =
  | { status: 'loading' }
  | { status: 'ready'; campaign: Campaign }
  | { status: 'not_found_or_forbidden' }
  | { status: 'failed'; error: unknown; retry: () => unknown }

export function resolveCampaignLookupState(query: CampaignLookupQuery): CampaignLookupState {
  if (query.data) return { status: 'ready', campaign: query.data }

  if (query.status !== 'error') return { status: 'loading' }

  if (
    isClientError(query.error, ERROR_CODE.NOT_FOUND) ||
    isClientError(query.error, ERROR_CODE.PERMISSION_DENIED)
  ) {
    return { status: 'not_found_or_forbidden' }
  }

  return { status: 'failed', error: query.error, retry: query.refetch }
}
