import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { Users, Link, User, Trash2 } from '~/lib/icons'
import { toast } from 'sonner'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  type CampaignMember,
} from 'convex/campaigns/types'
import { useCampaign } from '~/contexts/CampaignContext'
import { PlayerRequestsDialog } from './player-requests-dialog'
import PlayersDmControls from './players-dm-controls'
import type { Id } from 'convex/_generated/dataModel'
import { ContentGrid } from '~/components/content-grid-page/content-grid'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { EmptyState } from '~/components/content-grid-page/empty-state'
import { PlayerDeleteConfirmDialog } from '~/components/dialogs/delete/player-delete-confirm-dialog'
import { CardGridSkeleton } from '~/components/content-grid-page/card-grid-skeleton'

export default function PlayersContent() {
  const { dmUsername, campaignSlug, campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const isDm =
    campaignWithMembership.data?.member.role === CAMPAIGN_MEMBER_ROLE.DM

  const players = useQuery(
    convexQuery(
      api.campaigns.queries.getPlayersByCampaign,
      campaign?._id ? { campaignId: campaign?._id } : 'skip',
    ),
  )

  const [isRequestsOpen, setIsRequestsOpen] = useState(false)
  const [deletingMemberId, setDeletingMemberId] =
    useState<Id<'campaignMembers'> | null>(null)

  const deletingPlayer = players.data?.find((p) => p._id === deletingMemberId)

  const handleCopyJoinUrl = async () => {
    if (
      campaignWithMembership.status === 'pending' ||
      players.status === 'pending'
    ) {
      return toast.info('Please try again in a moment')
    }
    if (!dmUsername || !campaignSlug) {
      return toast.error('Failed to copy join link')
    }
    const joinUrl = `${window.location.origin}/join/${dmUsername}/${campaignSlug}`
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success('Join link copied to clipboard')
    } catch {
      toast.error('Failed to copy join link')
    }
  }

  if (players.status === 'error') {
    return <div>Error loading players</div>
  }

  if (
    campaignWithMembership.status === 'pending' ||
    players.status === 'pending' ||
    !players.data
  ) {
    return (
      <div className="h-full w-full">
        <PlayersDmControls
          onOpenRequests={() => setIsRequestsOpen(true)}
          onCopyJoinUrl={handleCopyJoinUrl}
        />
        <CardGridSkeleton
          count={6}
          showCreateCard={true}
          cardHeight="h-[180px]"
          className="mt-4"
        />
      </div>
    )
  }

  const acceptedPlayers = players.data?.filter(
    (p) => p.status === CAMPAIGN_MEMBER_STATUS.Accepted,
  )

  return (
    <div className="flex-1">
      <PlayersDmControls
        onOpenRequests={() => setIsRequestsOpen(true)}
        onCopyJoinUrl={handleCopyJoinUrl}
      />

      <ContentGrid className="mt-4">
        {acceptedPlayers &&
          acceptedPlayers.length > 0 &&
          acceptedPlayers.map((player: CampaignMember) => (
            <ContentCard
              key={player._id}
              title={player.userProfile?.name ?? 'Unknown'}
              description={`@${player.userProfile?.username}`}
              onClick={() => {
                toast.info(`Player: ${player.userProfile?.username}`)
              }}
              badges={[
                {
                  text: player.role,
                  icon: User,
                  variant: 'secondary',
                },
              ]}
              actionButtons={
                isDm && player.role !== CAMPAIGN_MEMBER_ROLE.DM
                  ? [
                      {
                        icon: Trash2,
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation()
                          setDeletingMemberId(player._id)
                        },
                        'aria-label': 'Remove player',
                        variant: 'destructive-subtle',
                      },
                    ]
                  : undefined
              }
            />
          ))}

        {isDm &&
          acceptedPlayers.length === 0 && ( // if the player isn't a dm, then there must be accepted players
            <EmptyState
              icon={Users}
              title="No players yet"
              description="Copy and share your campaign's join link to invite players."
              action={{
                label: 'Copy Join Link',
                onClick: handleCopyJoinUrl,
                icon: Link,
              }}
              className="col-span-full md:col-span-2 lg:col-span-3 max-w-2xl mx-auto"
            />
          )}
      </ContentGrid>

      <PlayerRequestsDialog
        isOpen={isRequestsOpen}
        onClose={() => {
          setIsRequestsOpen(false)
        }}
        players={players.data ?? []}
      />

      {deletingPlayer && (
        <PlayerDeleteConfirmDialog
          player={deletingPlayer}
          isDeleting={!!deletingMemberId}
          onClose={() => setDeletingMemberId(null)}
        />
      )}
    </div>
  )
}
