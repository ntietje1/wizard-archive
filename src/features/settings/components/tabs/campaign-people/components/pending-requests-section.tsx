import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { api } from 'convex/_generated/api'
import { SettingsSection } from '../../account-profile/components/settings-section'
import { MemberRow } from './member-row'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { handleError } from '~/shared/utils/logger'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'

export function PendingRequestsSection({
  pendingPlayers,
}: {
  pendingPlayers: Array<CampaignMember>
}) {
  const [updatingId, setUpdatingId] = useState<Id<'campaignMembers'> | null>(
    null,
  )

  const updateStatus = useAppMutation(
    api.campaigns.mutations.updateCampaignMemberStatus,
  )

  const handleStatusUpdate = async (
    memberId: Id<'campaignMembers'>,
    status: (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS],
  ) => {
    try {
      setUpdatingId(memberId)
      await updateStatus.mutateAsync({ memberId, status })
      toast.success('Player status updated')
    } catch (error) {
      handleError(error, 'Failed to update status')
    }
    setUpdatingId(null)
  }

  return (
    <SettingsSection title={`Pending requests (${pendingPlayers.length})`}>
      {pendingPlayers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No pending requests
        </p>
      ) : (
        pendingPlayers.map((player, index) => (
          <div key={player._id}>
            {index > 0 && <Separator />}
            <MemberRow
              member={player}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingId === player._id}
                    onClick={() =>
                      handleStatusUpdate(
                        player._id,
                        CAMPAIGN_MEMBER_STATUS.Rejected,
                      )
                    }
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={updatingId === player._id}
                    onClick={() =>
                      handleStatusUpdate(
                        player._id,
                        CAMPAIGN_MEMBER_STATUS.Accepted,
                      )
                    }
                  >
                    <Check className="size-4" />
                    Accept
                  </Button>
                </>
              }
            />
          </div>
        ))
      )}
    </SettingsSection>
  )
}
