import { useParams } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { parseCampaignSlug } from 'convex/campaigns/validation'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { parseUsername } from 'convex/users/validation'
import type { CampaignContextType } from '~/features/campaigns/hooks/useCampaign'
import { CampaignContext } from '~/features/campaigns/hooks/useCampaign'
import { CampaignNotFound } from '~/features/campaigns/components/campaign-not-found'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const { dmUsername: rawDmUsername, campaignSlug: rawCampaignSlug } = useParams({
    from: '/_app/_authed/campaigns/$dmUsername/$campaignSlug',
  })
  const dmUsername = parseUsername(rawDmUsername)
  const campaignSlug = parseCampaignSlug(rawCampaignSlug)
  const campaign = useAuthQuery(
    api.campaigns.queries.getCampaignBySlug,
    dmUsername && campaignSlug
      ? {
          dmUsername,
          slug: campaignSlug,
        }
      : 'skip',
  )

  if (!dmUsername || !campaignSlug) {
    return <CampaignNotFound />
  }

  if (!campaign.data && campaign.status === 'error') {
    return <CampaignNotFound />
  }

  const value: CampaignContextType = {
    dmUsername,
    campaignSlug,
    campaign,
    isCampaignLoaded: campaign.data !== undefined,
    isDm: campaign.data ? campaign.data.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM : undefined,
    campaignId: campaign.data?._id,
  }

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
}
