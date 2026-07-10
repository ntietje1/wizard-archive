import { useCampaign } from './useCampaign'
import { useCampaignMembersQuery } from '~/features/campaigns/hooks/use-campaign-operations'

export function useCampaignMembers() {
  const { campaignId } = useCampaign()

  return useCampaignMembersQuery(campaignId)
}
