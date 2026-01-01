import { createContext, useContext } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { CampaignWithMembership } from 'convex/campaigns/types'

export type CampaignContextType = {
  dmUsername: string
  campaignSlug: string
  campaignWithMembership: UseQueryResult<CampaignWithMembership, Error>
}

export const CampaignContext = createContext<CampaignContextType | null>(null)

export const useCampaign = (): CampaignContextType => {
  const context = useContext(CampaignContext)
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider')
  }
  return context
}
