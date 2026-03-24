import { useState } from 'react'
import { api } from 'convex/_generated/api'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
} from 'convex/campaigns/types'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { InviteLinkSection } from './components/invite-link-section'
import { MembersSection } from './components/members-section'
import { PendingRequestsSection } from './components/pending-requests-section'
import { RejectedRemovedSection } from './components/rejected-removed-section'
import { RemovePlayerDialog } from './components/remove-player-dialog'
import type { Id } from 'convex/_generated/dataModel'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { getOrigin } from '~/shared/utils/origin'

export function PeopleTab() {
  const { dmUsername, campaignSlug } = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug',
  })

  const campaign = useAuthQuery(api.campaigns.queries.getCampaignBySlug, {
    dmUsername,
    slug: campaignSlug,
  })
  const campaignData = campaign.data
  const isDm = campaignData
    ? campaignData.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM
    : undefined

  const players = useAuthQuery(
    api.campaigns.queries.getPlayersByCampaign,
    campaignData?._id ? { campaignId: campaignData._id } : 'skip',
  )

  const updateStatus = useAppMutation(
    api.campaigns.mutations.updateCampaignMemberStatus,
    { errorMessage: 'Failed to update status' },
  )

  const [updatingId, setUpdatingId] = useState<Id<'campaignMembers'> | null>(
    null,
  )
  const [deletingMemberId, setDeletingMemberId] =
    useState<Id<'campaignMembers'> | null>(null)

  const deletingPlayer = players.data?.find((p) => p._id === deletingMemberId)

  const handleStatusUpdate = async (
    memberId: Id<'campaignMembers'>,
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

  const dmMember = players.data?.find(
    (p) =>
      p.role === CAMPAIGN_MEMBER_ROLE.DM &&
      p.status === CAMPAIGN_MEMBER_STATUS.Accepted,
  )

  const acceptedPlayers =
    players.data?.filter(
      (p) =>
        p.role === CAMPAIGN_MEMBER_ROLE.Player &&
        p.status === CAMPAIGN_MEMBER_STATUS.Accepted,
    ) ?? []

  const pendingPlayers =
    players.data?.filter(
      (p) =>
        p.role === CAMPAIGN_MEMBER_ROLE.Player &&
        p.status === CAMPAIGN_MEMBER_STATUS.Pending,
    ) ?? []

  const rejectedOrRemoved =
    players.data?.filter(
      (p) =>
        p.role === CAMPAIGN_MEMBER_ROLE.Player &&
        (p.status === CAMPAIGN_MEMBER_STATUS.Rejected ||
          p.status === CAMPAIGN_MEMBER_STATUS.Removed),
    ) ?? []

  const joinUrl = `${getOrigin()}/join/${dmUsername}/${campaignSlug}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
          Campaign
        </p>
        <h2 className="text-lg font-semibold">People</h2>
        <p className="text-sm text-muted-foreground">
          Manage players, invitations, and role assignments
        </p>
      </div>

      {(campaign.isLoading || players.isLoading) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {(campaign.isError || players.isError) && (
        <p className="text-sm text-destructive">Failed to load players</p>
      )}

      {players.data && (
        <>
          {isDm && <InviteLinkSection joinUrl={joinUrl} />}

          <MembersSection
            dmMember={dmMember}
            acceptedPlayers={acceptedPlayers}
            isDm={isDm === true}
            onRemovePlayer={(id) => setDeletingMemberId(id)}
          />

          {isDm && (
            <PendingRequestsSection
              pendingPlayers={pendingPlayers}
              updatingId={updatingId}
              onStatusUpdate={handleStatusUpdate}
            />
          )}

          {isDm && (
            <RejectedRemovedSection
              players={rejectedOrRemoved}
              updatingId={updatingId}
              onStatusUpdate={handleStatusUpdate}
            />
          )}
        </>
      )}

      <RemovePlayerDialog
        player={deletingPlayer}
        isOpen={!!deletingMemberId}
        onClose={() => setDeletingMemberId(null)}
      />
    </div>
  )
}
