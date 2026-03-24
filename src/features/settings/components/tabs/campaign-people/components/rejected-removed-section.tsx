import { useState } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import { CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { MemberRow } from './member-row'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import { Badge } from '~/features/shadcn/components/badge'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'
import { cn } from '~/features/shadcn/lib/utils'

export function RejectedRemovedSection({
  players,
  updatingId,
  onStatusUpdate,
}: {
  players: Array<CampaignMember>
  updatingId: Id<'campaignMembers'> | null
  onStatusUpdate: (
    memberId: Id<'campaignMembers'>,
    status: (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS],
  ) => void
}) {
  const [showRejected, setShowRejected] = useState(false)

  if (players.length === 0) return null

  return (
    <div className="flex flex-col gap-0">
      <button
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-3"
        onClick={() => setShowRejected((s) => !s)}
      >
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            !showRejected && '-rotate-90',
          )}
        />
        {`Rejected & removed (${players.length})`}
      </button>
      {showRejected && (
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          {players.map((player, index) => (
            <div key={player._id}>
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
                    disabled={updatingId === player._id}
                    onClick={() =>
                      onStatusUpdate(
                        player._id,
                        player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                          ? CAMPAIGN_MEMBER_STATUS.Pending
                          : CAMPAIGN_MEMBER_STATUS.Accepted,
                      )
                    }
                  >
                    <RefreshCw className="size-4" />
                    {player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                      ? 'Undo Reject'
                      : 'Undo Removal'}
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
