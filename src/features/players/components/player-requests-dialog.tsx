import { useState } from 'react'
import { api } from 'convex/_generated/api'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { toast } from 'sonner'
import type { CampaignMember } from 'convex/campaigns/types'
import type { Id } from 'convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { Button } from '~/features/shadcn/components/button'
import { Check, RefreshCw, X } from '~/features/shared/utils/icons'
import { useAppMutation } from '~/features/shared/hooks/useAppMutation'
import { cn } from '~/features/shadcn/lib/utils'
import { Badge } from '~/features/shadcn/components/badge'

type PlayerRequestCardProps = {
  player: CampaignMember
  updatingId: Id<'campaignMembers'> | null
  handleUpdate: (
    memberId: Id<'campaignMembers'>,
    status: (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS],
  ) => Promise<void>
}

function PlayerRequestCard({
  player,
  updatingId,
  handleUpdate,
}: PlayerRequestCardProps) {
  return (
    <li
      key={player._id}
      className="flex items-center justify-between gap-3 p-3"
    >
      <div className="flex items-center gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-foreground">
              @{player.userProfile.name ?? 'Unknown'}
            </div>
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
          </div>
          <div className="text-xs text-muted-foreground">
            @{player.userProfile.username}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={updatingId === player._id}
          onClick={() =>
            handleUpdate(
              player._id,
              player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                ? CAMPAIGN_MEMBER_STATUS.Pending
                : CAMPAIGN_MEMBER_STATUS.Accepted,
            )
          }
        >
          <RefreshCw className="w-4 h-4" />{' '}
          {player.status === CAMPAIGN_MEMBER_STATUS.Rejected
            ? 'Undo Reject'
            : 'Undo Removal'}
        </Button>
      </div>
    </li>
  )
}

type PlayerRequestsDialogProps = {
  isOpen: boolean
  onClose: () => void
  players: Array<CampaignMember>
}

export function PlayerRequestsDialog({
  isOpen,
  onClose,
  players,
}: PlayerRequestsDialogProps) {
  const updateStatus = useAppMutation(
    api.campaigns.mutations.updateCampaignMemberStatus,
    { errorMessage: 'Failed to update status' },
  )
  const [updatingId, setUpdatingId] = useState<Id<'campaignMembers'> | null>(
    null,
  )

  const pending = players.filter(
    (p) =>
      p.role === CAMPAIGN_MEMBER_ROLE.Player &&
      p.status === CAMPAIGN_MEMBER_STATUS.Pending,
  )
  const rejectedOrRemoved = players.filter(
    (p) =>
      p.role === CAMPAIGN_MEMBER_ROLE.Player &&
      (p.status === CAMPAIGN_MEMBER_STATUS.Rejected ||
        p.status === CAMPAIGN_MEMBER_STATUS.Removed),
  )
  const [showRejected, setShowRejected] = useState(false)

  const handleUpdate = async (
    memberId: CampaignMember['_id'],
    status: (typeof CAMPAIGN_MEMBER_STATUS)[keyof typeof CAMPAIGN_MEMBER_STATUS],
  ) => {
    try {
      setUpdatingId(memberId)
      await updateStatus.mutateAsync({ memberId, status })
      toast.success('Player status updated')
    } catch (e) {
      console.error(e)
    }
    setUpdatingId(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Player Requests</DialogTitle>
          <DialogDescription>
            Review pending requests and manage rejected players.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-medium text-foreground mb-2">{`Pending Requests (${pending.length})`}</h3>
            <ul className="divide-y rounded-md border">
              {pending.length === 0 ? (
                <li className="p-3">
                  <div className="flex items-center justify-center text-sm text-muted-foreground h-10">
                    No pending requests
                  </div>
                </li>
              ) : (
                pending.map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        @{p.userProfile.username}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === p._id}
                        onClick={() =>
                          handleUpdate(p._id, CAMPAIGN_MEMBER_STATUS.Rejected)
                        }
                      >
                        <X className="w-4 h-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={updatingId === p._id}
                        onClick={() =>
                          handleUpdate(p._id, CAMPAIGN_MEMBER_STATUS.Accepted)
                        }
                      >
                        <Check className="w-4 h-4" /> Accept
                      </Button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="min-h-12">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-foreground">{`Rejected and Removed (${rejectedOrRemoved.length})`}</h3>
              <button
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={() => setShowRejected((s) => !s)}
              >
                {showRejected ? 'Show less' : 'Show more'}
              </button>
            </div>
            <ul className="divide-y rounded-md border">
              {rejectedOrRemoved.length === 0 ? (
                <li className="p-3">
                  <div className="flex items-center justify-center text-sm text-muted-foreground h-10">
                    No rejected or removed players
                  </div>
                </li>
              ) : !showRejected ? (
                <PlayerRequestCard
                  player={rejectedOrRemoved[0]}
                  updatingId={updatingId}
                  handleUpdate={handleUpdate}
                />
              ) : (
                rejectedOrRemoved.map((p) => (
                  <PlayerRequestCard
                    key={p._id}
                    player={p}
                    updatingId={updatingId}
                    handleUpdate={handleUpdate}
                  />
                ))
              )}
            </ul>
          </section>
        </div>

        <div className="flex justify-end">
          {/* <span className="text-sm text-slate-600">Manage player access to your campaign</span> */}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
