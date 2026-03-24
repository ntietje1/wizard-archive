import { Check, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { SettingsSection } from '../../account-profile/components/settings-section'
import { MemberRow } from './member-row'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'

export function PendingRequestsSection({
  pendingPlayers,
  updatingId,
  onStatusUpdate,
}: {
  pendingPlayers: Array<CampaignMember>
  updatingId: Id<'campaignMembers'> | null
  onStatusUpdate: (
    memberId: Id<'campaignMembers'>,
    status: (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS],
  ) => void
}) {
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
                      onStatusUpdate(
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
                      onStatusUpdate(
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
