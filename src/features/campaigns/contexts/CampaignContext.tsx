import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import { CampaignContext } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/features/shared/hooks/useAuthQuery'

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { dmUsername, campaignSlug } = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
  })

  const campaign = useAuthQuery(api.campaigns.queries.getCampaignBySlug, {
    dmUsername,
    slug: campaignSlug,
  })

  const value: CampaignContextType = {
    dmUsername,
    campaignSlug,
    campaign,
    isCampaignLoaded: campaign.data !== undefined,
    isDm: campaign.data
      ? campaign.data.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM
      : undefined,
    campaignId: campaign.data?._id,
  }

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  )
}
