import { createContext, useContext } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { CampaignSlug } from 'convex/campaigns/validation'
import type { Campaign } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Username } from 'convex/users/validation'

export type CampaignContextType = {
  dmUsername: Username
  campaignSlug: CampaignSlug
  campaign: UseQueryResult<Campaign, Error>
  isDm: boolean | undefined
  isCampaignLoaded: boolean
  campaignId: Id<'campaigns'> | undefined
}

export const CampaignContext = createContext<CampaignContextType | null>(null)

export const useCampaign = (): CampaignContextType => {
  const context = useContext(CampaignContext)
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider')
  }
  return context
}
