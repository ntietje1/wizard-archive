import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useAuth } from '@clerk/tanstack-react-start'
import { CampaignContext } from './campaign-context'
import type { CampaignContextType } from './campaign-context'

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
