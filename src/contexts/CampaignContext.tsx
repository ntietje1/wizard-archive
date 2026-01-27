import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { CampaignContextType } from '~/hooks/useCampaign'
import { CampaignContext } from '~/hooks/useCampaign'

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { dmUsername, campaignSlug } = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
  })

  const campaignWithMembership = useQuery({
    ...convexQuery(api.campaigns.queries.getCampaignBySlug, {
      dmUsername,
      slug: campaignSlug,
    }),
    staleTime: Infinity,
  })

  const value: CampaignContextType = {
    dmUsername,
    campaignSlug,
    campaignWithMembership,
    isDm: campaignWithMembership.data
      ? campaignWithMembership.data.member.role === CAMPAIGN_MEMBER_ROLE.DM
      : undefined,
  }

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  )
}
