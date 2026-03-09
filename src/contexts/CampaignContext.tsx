import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { CampaignContextType } from '~/hooks/useCampaign'
import { CampaignContext } from '~/hooks/useCampaign'
import { useAuthQuery } from '~/hooks/useAuthQuery'

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { dmUsername, campaignSlug } = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
  })

  const campaign = useAuthQuery(api.campaigns.queries.getCampaignBySlug, {
    dmUsername,
    slug: campaignSlug,
  })

  const isCampaignLoaded = campaign.data !== undefined
  const value: CampaignContextType = {
    dmUsername,
    campaignSlug,
    campaign,
    isCampaignLoaded,
    isDm: isCampaignLoaded
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
