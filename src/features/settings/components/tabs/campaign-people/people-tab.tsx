import { Loader2 } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { InviteLinkSection } from './components/invite-link-section'
import { MembersSection } from './components/members-section'
import { PendingRequestsSection } from './components/pending-requests-section'
import { RejectedRemovedSection } from './components/rejected-removed-section'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getOrigin } from '~/shared/utils/origin'

export function PeopleTab() {
  const campaignContext = useOptionalCampaign()
  const dmUsername = campaignContext?.dmUsername
  const campaignSlug = campaignContext?.campaignSlug
  const campaign = campaignContext?.campaign
  const campaignData = campaign?.data
  const isDm = campaignContext?.isDm

  const members = useAuthQuery(
    api.campaigns.queries.getMembersByCampaign,
    campaignData?._id ? { campaignId: campaignData._id } : 'skip',
  )

  const requests = useAuthQuery(
    api.campaigns.queries.getCampaignRequests,
    campaignData?._id && isDm ? { campaignId: campaignData._id } : 'skip',
  )

  const dmMember = members.data?.find((p) => p.role === CAMPAIGN_MEMBER_ROLE.DM)

  const acceptedPlayers = members.data?.filter((p) => p.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []

  const pendingPlayers =
    requests.data?.filter(
      (p) => p.role === CAMPAIGN_MEMBER_ROLE.Player && p.status === CAMPAIGN_MEMBER_STATUS.Pending,
    ) ?? []

  const rejectedOrRemoved =
    requests.data?.filter(
      (p) =>
        p.role === CAMPAIGN_MEMBER_ROLE.Player &&
        (p.status === CAMPAIGN_MEMBER_STATUS.Rejected ||
          p.status === CAMPAIGN_MEMBER_STATUS.Removed),
    ) ?? []

  if (!campaignContext || !dmUsername || !campaignSlug || !campaign) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Campaign
          </p>
          <h2 className="text-lg font-semibold">People</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Open a campaign to manage players, invitations, and role assignments.
        </p>
      </div>
    )
  }

  const joinUrl = isDm ? `${getOrigin()}/join/${dmUsername}/${campaignSlug}` : null

  const isLoading = campaign.isLoading || members.isLoading || (isDm && requests.isLoading)
  const isError = campaign.isError || members.isError || (isDm && requests.isError)
  const isReady = campaignData && members.data && (!isDm || requests.data)

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

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && <p className="text-sm text-destructive">Failed to load campaign data</p>}

      {isReady && (
        <>
          {isDm && joinUrl && <InviteLinkSection joinUrl={joinUrl} />}

          <MembersSection
            dmMember={dmMember}
            acceptedPlayers={acceptedPlayers}
            isDm={isDm === true}
            campaignId={campaignData._id}
          />

          {isDm && (
            <PendingRequestsSection pendingPlayers={pendingPlayers} campaignId={campaignData._id} />
          )}

          {isDm && (
            <RejectedRemovedSection players={rejectedOrRemoved} campaignId={campaignData._id} />
          )}
        </>
      )}
    </div>
  )
}
