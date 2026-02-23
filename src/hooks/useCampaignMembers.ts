import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from './useCampaign'

export function useCampaignMembers() {
  const { campaignId } = useCampaign()

  const campaignMembersQuery = useQuery(
    convexQuery(
      api.campaigns.queries.getPlayersByCampaign,
      campaignId ? { campaignId } : 'skip',
    ),
  )

  return campaignMembersQuery
}
