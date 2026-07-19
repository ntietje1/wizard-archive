import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

const PLACEHOLDER_CAMPAIGN_ID = assertDomainId(
  DOMAIN_ID_KIND.campaign,
  '00000000-0000-7000-8000-000000000000',
)

export function useJoinCampaignQuery(campaignId: CampaignId | null) {
  return useQuery({
    ...convexQuery(api.campaigns.queries.getCampaignInvitation, {
      campaignId: campaignId ?? PLACEHOLDER_CAMPAIGN_ID,
    }),
    enabled: campaignId !== null,
  })
}
