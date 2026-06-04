import { api } from 'convex/_generated/api'
import { useCampaign } from './useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useCampaignMembers() {
  const { campaignId } = useCampaign()

  return useAuthQuery(
    api.campaigns.queries.getMembersByCampaign,
    campaignId ? { campaignId } : 'skip',
  )
}
