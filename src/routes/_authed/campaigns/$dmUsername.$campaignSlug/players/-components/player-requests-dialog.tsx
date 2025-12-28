import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { toast } from 'sonner'
import { useConvexMutation } from '@convex-dev/react-query'
import type { CampaignMember } from 'convex/campaigns/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { Button } from '~/components/shadcn/ui/button'
import { Check, RefreshCw, X } from '~/lib/icons'
import { cn } from '~/lib/shadcn/utils'
import { Badge } from '~/components/shadcn/ui/badge'

type PlayerRequestCardProps = {
  player: CampaignMember
  updatingId: string | null
  handleUpdate: (
    memberId: CampaignMember['_id'],
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
            <div className="font-medium text-slate-800">
              @{player.userProfile.name ?? 'Unknown'}
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'text-xs border-transparent',
                player.status === CAMPAIGN_MEMBER_STATUS.Rejected
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700',
              )}
            >
              {player.status}
            </Badge>
          </div>
          <div className="text-xs text-slate-500">
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
        {player.status === CAMPAIGN_MEMBER_STATUS.Pending && (
          <Button
            size="sm"
            disabled={updatingId === player._id}
            onClick={() =>
              handleUpdate(player._id, CAMPAIGN_MEMBER_STATUS.Accepted)
            }
          >
            <Check className="w-4 h-4" /> Accept
          </Button>
        )}
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
  const updateStatus = useMutation({
    mutationFn: useConvexMutation(
      api.campaigns.mutations.updateCampaignMemberStatus,
    ),
  })
  const [updatingId, setUpdatingId] = useState<string | null>(null)

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
      setUpdatingId(memberId as unknown as string)
      await updateStatus.mutateAsync({ memberId, status })
      toast.success('Player status updated')
    } catch (e) {
      console.error(e)
      toast.error('Failed to update status')
    } finally {
      setUpdatingId(null)
    }
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
            <h3 className="text-sm font-medium text-slate-800 mb-2">{`Pending Requests (${pending.length})`}</h3>
            <ul className="divide-y rounded-md border">
              {pending.length === 0 ? (
                <li className="p-3">
                  <div className="flex items-center justify-center text-sm text-slate-500 h-10">
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
                      <div className="text-medium text-slate-800">
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
              <h3 className="text-sm font-medium text-slate-800">{`Rejected and Removed (${rejectedOrRemoved.length})`}</h3>
              <button
                className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-800"
                onClick={() => setShowRejected((s) => !s)}
              >
                {showRejected ? 'Show less' : 'Show more'}
              </button>
            </div>
            <ul className="divide-y rounded-md border">
              {rejectedOrRemoved.length === 0 ? (
                <li className="p-3">
                  <div className="flex items-center justify-center text-sm text-slate-500 h-10">
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
