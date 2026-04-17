import { Loader2 } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'convex/campaigns/types'
import { InviteLinkSection } from './components/invite-link-section'
import { MembersSection } from './components/members-section'
import { PendingRequestsSection } from './components/pending-requests-section'
import { RejectedRemovedSection } from './components/rejected-removed-section'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getOrigin } from '~/shared/utils/origin'

export function PeopleTab() {
  const { dmUsername, campaignSlug } = useCampaign()

  const campaign = useAuthQuery(api.campaigns.queries.getCampaignBySlug, {
    dmUsername,
    slug: campaignSlug,
  })
  const campaignData = campaign.data
  const isDm = campaignData
    ? campaignData.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM
    : undefined

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

  const joinUrl = `${getOrigin()}/join/${dmUsername}/${campaignSlug}`

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
          {isDm && <InviteLinkSection joinUrl={joinUrl} />}

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
