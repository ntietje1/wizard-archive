import { createContext, useContext } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Campaign } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'

export type CampaignContextType = {
  dmUsername: string
  campaignSlug: string
  campaign: UseQueryResult<Campaign, Error>
  isDm: boolean | undefined
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
