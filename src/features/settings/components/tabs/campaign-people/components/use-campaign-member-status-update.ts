import { useState } from 'react'
import { toast } from 'sonner'
import { api } from 'convex/_generated/api'
import type { CampaignMemberStatus } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'

export function useCampaignMemberStatusUpdate(campaignId: Id<'campaigns'>) {
  const [pendingMemberIds, setPendingMemberIds] = useState<ReadonlySet<Id<'campaignMembers'>>>(
    new Set(),
  )
  const updateStatus = useAppMutation(api.campaigns.mutations.updateCampaignMemberStatus)

  const updateMemberStatus = async (
    memberId: Id<'campaignMembers'>,
    status: CampaignMemberStatus,
  ) => {
    try {
      setPendingMemberIds((current) => new Set(current).add(memberId))
      await updateStatus.mutateAsync({ campaignId, memberId, status })
      toast.success('Player status updated')
    } catch (error) {
      handleError(error, 'Failed to update status')
    } finally {
      setPendingMemberIds((current) => {
        const next = new Set(current)
        next.delete(memberId)
        return next
      })
    }
  }

  return {
    isMemberStatusPending: (memberId: Id<'campaignMembers'>) => pendingMemberIds.has(memberId),
    updateMemberStatus,
  }
}
