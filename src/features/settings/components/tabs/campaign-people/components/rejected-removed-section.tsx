import { useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { MemberRow } from './member-row'
import { useCampaignMemberStatusUpdate } from './use-campaign-member-status-update'
import type { CampaignMember } from 'shared/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { Badge } from '@wizard-archive/ui/shadcn/components/badge'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

export function RejectedRemovedSection({
  players,
  campaignId,
}: {
  players: Array<CampaignMember>
  campaignId: Id<'campaigns'>
}) {
  const [showRejected, setShowRejected] = useState(false)
  const { isMemberStatusPending, updateMemberStatus } = useCampaignMemberStatusUpdate(campaignId)

  if (players.length === 0) return null

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-3"
        onClick={() => setShowRejected((s) => !s)}
      >
        <ChevronDown className={cn('size-4 transition-transform', !showRejected && '-rotate-90')} />
        {`Rejected & removed (${players.length})`}
      </button>
      {showRejected && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          {players.map((player, index) => (
            <div key={player.id}>
              {index > 0 && <Separator />}
              <MemberRow
                member={player}
                badge={
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs border-transparent',
                      player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-accent text-accent-foreground',
                    )}
                  >
                    {player.status}
                  </Badge>
                }
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={isMemberStatusPending(player.id)}
                    onClick={() => updateMemberStatus(player.id, CAMPAIGN_MEMBER_STATUS.Accepted)}
                  >
                    <RefreshCw className="size-4" />
                    {player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                      ? 'Accept request'
                      : 'Restore player'}
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
