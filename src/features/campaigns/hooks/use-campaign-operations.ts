import { api } from 'convex/_generated/api'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useCampaignByIdQuery(campaignId: CampaignId | null) {
  return useAuthQuery(api.campaigns.queries.getCampaignById, campaignId ? { campaignId } : 'skip')
}

export function useUserCampaignsQuery() {
  return useAuthQuery(api.campaigns.queries.getUserCampaigns, {})
}

export function useCampaignMembersQuery(campaignId: CampaignId | undefined) {
  return useAuthQuery(
    api.campaigns.queries.getMembersByCampaign,
    campaignId ? { campaignId } : 'skip',
  )
}

export function useCampaignRequestsQuery(campaignId: CampaignId | undefined, enabled: boolean) {
  return useAuthQuery(
    api.campaigns.queries.getCampaignRequests,
    campaignId && enabled ? { campaignId } : 'skip',
  )
}

export function useCreateCampaignMutation() {
  return useAppMutation(api.campaigns.mutations.createCampaign)
}

type UpdateCampaignMutationOptions = Parameters<
  typeof useAppMutation<typeof api.campaigns.mutations.updateCampaign>
>[1]

export function useUpdateCampaignMutation(options?: UpdateCampaignMutationOptions) {
  return useAppMutation(api.campaigns.mutations.updateCampaign, options)
}

export function useDeleteCampaignMutation() {
  return useAppMutation(api.campaigns.mutations.deleteCampaign)
}

export function useJoinCampaignMutation() {
  return useAppMutation(api.campaigns.mutations.joinCampaign)
}

export function useUpdateCampaignMemberStatusMutation() {
  return useAppMutation(api.campaigns.mutations.updateCampaignMemberStatus)
}
