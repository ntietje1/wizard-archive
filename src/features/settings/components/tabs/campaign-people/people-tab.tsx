import { Loader2 } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from 'shared/campaigns/types'
import { InviteLinkSection } from './components/invite-link-section'
import { MembersSection } from './components/members-section'
import { PendingRequestsSection } from './components/pending-requests-section'
import { RejectedRemovedSection } from './components/rejected-removed-section'
import { useOptionalCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { getOrigin } from '~/shared/utils/origin'

export function PeopleTab() {
  const campaignContext = useOptionalCampaign()
  const { campaignData, isDm, members, requests } = usePeopleTabData(campaignContext)

  if (!campaignContext) return <NoCampaignPeopleTab />

  const joinUrl = isDm
    ? `${getOrigin()}/join/${campaignContext.dmUsername}/${campaignContext.campaignSlug}`
    : null

  const peopleState = getPeopleTabState({
    campaignIsLoading: campaignContext.campaign.isLoading,
    campaignIsError: campaignContext.campaign.isError,
    campaignData,
    isDm,
    members,
    requests,
  })
  const peopleLists = getPeopleLists(members.data, requests.data)

  return (
    <div className="flex flex-col gap-6">
      <PeopleTabHeader />

      {peopleState.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {peopleState.isError && (
        <p className="text-sm text-destructive">Failed to load campaign data</p>
      )}

      {peopleState.isReady && campaignData && (
        <>
          {isDm && joinUrl && <InviteLinkSection joinUrl={joinUrl} />}

          <MembersSection
            dmMember={peopleLists.dmMember}
            acceptedPlayers={peopleLists.acceptedPlayers}
            isDm={isDm === true}
            campaignId={campaignData._id}
          />

          {isDm && (
            <PendingRequestsSection
              pendingPlayers={peopleLists.pendingPlayers}
              campaignId={campaignData._id}
            />
          )}

          {isDm && (
            <RejectedRemovedSection
              players={peopleLists.rejectedOrRemoved}
              campaignId={campaignData._id}
            />
          )}
        </>
      )}
    </div>
  )
}

function usePeopleTabData(campaignContext: ReturnType<typeof useOptionalCampaign>) {
  const campaignData = campaignContext?.campaign.data
  const isDm = campaignContext?.isDm
  const members = useAuthQuery(
    api.campaigns.queries.getMembersByCampaign,
    campaignData?._id ? { campaignId: campaignData._id } : 'skip',
  )

  const requests = useAuthQuery(
    api.campaigns.queries.getCampaignRequests,
    campaignData?._id && isDm ? { campaignId: campaignData._id } : 'skip',
  )

  return { campaignData, isDm, members, requests }
}

type PeopleMembersQuery = ReturnType<
  typeof useAuthQuery<typeof api.campaigns.queries.getMembersByCampaign>
>
type PeopleRequestsQuery = ReturnType<
  typeof useAuthQuery<typeof api.campaigns.queries.getCampaignRequests>
>

function getPeopleTabState({
  campaignIsLoading,
  campaignIsError,
  campaignData,
  isDm,
  members,
  requests,
}: {
  campaignIsLoading: boolean
  campaignIsError: boolean
  campaignData: ReturnType<typeof usePeopleTabData>['campaignData']
  isDm: ReturnType<typeof usePeopleTabData>['isDm']
  members: PeopleMembersQuery
  requests: PeopleRequestsQuery
}) {
  return {
    isLoading: campaignIsLoading || members.isLoading || (isDm && requests.isLoading),
    isError: campaignIsError || members.isError || (isDm && requests.isError),
    isReady: campaignData && members.data && (!isDm || requests.data),
  }
}

function getPeopleLists(
  members: PeopleMembersQuery['data'],
  requests: PeopleRequestsQuery['data'],
) {
  return {
    dmMember: members?.find((p) => p.role === CAMPAIGN_MEMBER_ROLE.DM),
    acceptedPlayers: members?.filter((p) => p.role === CAMPAIGN_MEMBER_ROLE.Player) ?? [],
    pendingPlayers: requests?.filter(isPendingPlayer) ?? [],
    rejectedOrRemoved: requests?.filter(isRejectedOrRemovedPlayer) ?? [],
  }
}

function isPendingPlayer(player: NonNullable<PeopleRequestsQuery['data']>[number]) {
  return (
    player.role === CAMPAIGN_MEMBER_ROLE.Player && player.status === CAMPAIGN_MEMBER_STATUS.Pending
  )
}

function isRejectedOrRemovedPlayer(player: NonNullable<PeopleRequestsQuery['data']>[number]) {
  return (
    player.role === CAMPAIGN_MEMBER_ROLE.Player &&
    (player.status === CAMPAIGN_MEMBER_STATUS.Rejected ||
      player.status === CAMPAIGN_MEMBER_STATUS.Removed)
  )
}

function PeopleTabHeader() {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">
        Campaign
      </p>
      <h2 className="text-lg font-semibold">People</h2>
      <p className="text-sm text-muted-foreground">
        Manage players, invitations, and role assignments
      </p>
    </div>
  )
}

function NoCampaignPeopleTab() {
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
