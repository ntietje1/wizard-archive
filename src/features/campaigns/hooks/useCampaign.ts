import { createContext, useContext } from 'react'
import { useMatch } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import type { UseQueryResult } from '@tanstack/react-query'
import { parseCampaignSlug } from 'convex/campaigns/validation'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { Campaign } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { parseUsername } from 'convex/users/validation'
import type { CampaignSlug } from 'convex/campaigns/validation'
import type { Username } from 'convex/users/validation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export type CampaignRouteIdentity = {
  dmUsername: Username
  campaignSlug: CampaignSlug
}

export type CampaignContextType = CampaignRouteIdentity & {
  campaign: UseQueryResult<Campaign, Error>
  isDm: boolean | undefined
  isCampaignLoaded: boolean
  campaignId: Id<'campaigns'> | undefined
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
    campaignId: campaign.data?._id,
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

export function useOptionalCampaign(): CampaignContextType | null {
  const context = useContext(CampaignContext)
  const identity = useOptionalCampaignRoute()
  const campaign = useAuthQuery(
    api.campaigns.queries.getCampaignBySlug,
    context || !identity
      ? 'skip'
      : {
          dmUsername: identity.dmUsername,
          slug: identity.campaignSlug,
        },
  )

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
