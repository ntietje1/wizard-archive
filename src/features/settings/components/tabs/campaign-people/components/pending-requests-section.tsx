import { Check, X } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { SettingsSection } from '~/features/settings/components/settings-section'
import { MemberRow } from './member-row'
import { useCampaignMemberStatusUpdate } from './use-campaign-member-status-update'
import type { CampaignMember } from 'shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'

export function PendingRequestsSection({
  pendingPlayers,
  campaignId,
}: {
  pendingPlayers: Array<CampaignMember>
  campaignId: CampaignId
}) {
  const { isMemberStatusPending, updateMemberStatus } = useCampaignMemberStatusUpdate(campaignId)

  return (
    <SettingsSection title={`Pending requests (${pendingPlayers.length})`}>
      {pendingPlayers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No pending requests</p>
      ) : (
        pendingPlayers.map((player, index) => (
          <div key={player.id}>
            {index > 0 && <Separator />}
            <MemberRow
              member={player}
              actions={
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMemberStatusPending(player.id)}
                    onClick={() => updateMemberStatus(player.id, CAMPAIGN_MEMBER_STATUS.Rejected)}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={isMemberStatusPending(player.id)}
                    onClick={() => updateMemberStatus(player.id, CAMPAIGN_MEMBER_STATUS.Accepted)}
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
