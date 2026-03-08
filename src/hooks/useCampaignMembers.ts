import { api } from 'convex/_generated/api'
import { useCampaign } from './useCampaign'
import { useAuthQuery } from './useAuthQuery'

export function useCampaignMembers() {
  const { campaignId } = useCampaign()

  return useAuthQuery(
    api.campaigns.queries.getPlayersByCampaign,
    campaignId ? { campaignId } : 'skip',
  )
}
