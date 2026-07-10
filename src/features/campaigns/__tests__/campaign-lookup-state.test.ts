import { describe, expect, it, vi } from 'vite-plus/test'
import { ERROR_CODE } from 'shared/errors/client'
import { createCampaign } from '~/test/factories/campaign-factory'
import { clientError } from '~/test/factories/error-factory'
import { resolveCampaignLookupState } from '~/features/campaigns/campaign-lookup-state'
import type { Campaign } from 'shared/campaigns/types'
import type { QueryStatus } from '@tanstack/react-query'

function campaignQuery({
  data,
  error = null,
  status,
  refetch = vi.fn(),
}: {
  data?: Campaign
  error?: unknown
  status: QueryStatus
  refetch?: () => unknown
}) {
  return { data, error, status, refetch }
}

describe('resolveCampaignLookupState', () => {
  it('returns loading while the lookup is pending', () => {
    expect(resolveCampaignLookupState(campaignQuery({ status: 'pending' }))).toEqual({
      status: 'loading',
    })
  })

  it('returns ready when the campaign is loaded', () => {
    const campaign = createCampaign()

    expect(
      resolveCampaignLookupState(campaignQuery({ data: campaign, status: 'success' })),
    ).toEqual({
      status: 'ready',
      campaign,
    })
  })

  it('keeps missing campaigns out of generic failed state', () => {
    expect(
      resolveCampaignLookupState(
        campaignQuery({
          status: 'error',
          error: clientError(ERROR_CODE.NOT_FOUND),
        }),
      ),
    ).toEqual({ status: 'not_found_or_forbidden' })
  })

  it('keeps forbidden campaigns out of generic failed state', () => {
    expect(
      resolveCampaignLookupState(
        campaignQuery({
          status: 'error',
          error: clientError(ERROR_CODE.PERMISSION_DENIED),
        }),
      ),
    ).toEqual({ status: 'not_found_or_forbidden' })
  })

  it('returns failed with retry for unexpected lookup errors', () => {
    const error = new Error('Network failed')
    const refetch = vi.fn()

    expect(resolveCampaignLookupState(campaignQuery({ status: 'error', error, refetch }))).toEqual({
      status: 'failed',
      error,
      retry: refetch,
    })
  })
})
