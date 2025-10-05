import { convexQuery } from '@convex-dev/react-query'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { type CampaignWithMembership } from 'convex/campaigns/types'
import { createContext, useContext } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'

type CampaignContextType = {
  dmUsername: string
  campaignSlug: string
  campaignWithMembership: UseQueryResult<CampaignWithMembership, Error>
}

const CampaignContext = createContext<CampaignContextType | null>(null)

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { dmUsername, campaignSlug } = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
  })
  const { isLoaded, isSignedIn } = useAuth()

  const campaignWithMembership = useQuery(
    convexQuery(
      api.campaigns.queries.getCampaignBySlug,
      isLoaded && isSignedIn
        ? {
            dmUsername,
            slug: campaignSlug,
          }
        : 'skip',
    ),
  )

  const value: CampaignContextType = {
    dmUsername,
    campaignSlug,
    campaignWithMembership,
  }

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  )
}

export const useCampaign = () => {
  const context = useContext(CampaignContext)
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider')
  }
  return context
}
