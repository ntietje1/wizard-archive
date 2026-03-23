import { api } from 'convex/_generated/api'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/features/shared/hooks/useAuthQuery'

export function useCampaignMembers() {
  const { campaignId } = useCampaign()

  return useAuthQuery(
    api.campaigns.queries.getPlayersByCampaign,
    campaignId ? { campaignId } : 'skip',
  )
}
