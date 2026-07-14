import { createContext, useContext } from 'react'
import { useMatch } from '@tanstack/react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import { parseCampaignSlug } from 'shared/campaigns/validation'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import type { Campaign } from 'shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { parseUsername } from 'shared/users/validation'
import type { CampaignSlug } from 'shared/campaigns/validation'
import type { Username } from 'shared/users/validation'
import { useCampaignBySlugQuery } from '~/features/campaigns/hooks/use-campaign-operations'

type CampaignRouteIdentity = {
  dmUsername: Username
  campaignSlug: CampaignSlug
}

export type CampaignContextType = CampaignRouteIdentity & {
  campaign: UseQueryResult<Campaign, Error>
  isDm: boolean | undefined
  isCampaignLoaded: boolean
  campaignId: CampaignId | undefined
}

export const CampaignContext = createContext<CampaignContextType | null>(null)

export function buildCampaignContextValue(
  identity: CampaignRouteIdentity,
  campaign: UseQueryResult<Campaign, Error>,
): CampaignContextType {
  return {
    ...identity,
    campaign,
    isCampaignLoaded: campaign.data !== undefined,
    isDm: campaign.data ? campaign.data.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM : undefined,
    campaignId: campaign.data?.id,
  }
}

export function useOptionalCampaignRoute(): CampaignRouteIdentity | null {
  const campaignMatch = useMatch({
    from: '/_app/_authed/campaigns/$dmUsername/$campaignSlug',
    shouldThrow: false,
  })

  if (!campaignMatch) return null

  const dmUsername = parseUsername(campaignMatch.params.dmUsername)
  const campaignSlug = parseCampaignSlug(campaignMatch.params.campaignSlug)

  if (!dmUsername || !campaignSlug) return null

  return { dmUsername, campaignSlug }
}

/**
 * Returns the active campaign context when available without surfacing CampaignNotFound.
 *
 * This hook always calls useAuthQuery, but passes 'skip' when CampaignProvider already
 * supplies context or when no campaign route identity is available. Unlike CampaignProvider,
 * it never throws or renders CampaignNotFound on query errors; if the lookup fails it returns
 * buildCampaignContextValue(identity, campaign), leaving isCampaignLoaded false while callers
 * inspect campaign.isError for not-found or other failure states.
 */
export function useOptionalCampaign(): CampaignContextType | null {
  const context = useContext(CampaignContext)
  const identity = useOptionalCampaignRoute()
  const campaign = useCampaignBySlugQuery(context ? null : identity)

  if (context) return context
  if (!identity) return null

  return buildCampaignContextValue(identity, campaign)
}

export const useCampaign = (): CampaignContextType => {
  const context = useContext(CampaignContext)
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider')
  }
  return context
}
