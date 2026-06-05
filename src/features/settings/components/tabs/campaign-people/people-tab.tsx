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
import { Button } from '~/features/shadcn/components/button'
import { SettingsSection } from '~/features/settings/components/tabs/account-profile/components/settings-section'

export function PeopleTab() {
  const campaignContext = useOptionalCampaign()
  const { campaignData, isDm, members, requests } = usePeopleTabData(campaignContext)

  if (!campaignContext) return <NoCampaignPeopleTab />

  const joinUrl = isDm
    ? `${getOrigin()}/join/${campaignContext.dmUsername}/${campaignContext.campaignSlug}`
    : null

  const memberState = getPeopleSectionState(members)
  const requestState = getPeopleSectionState(requests)
  const peopleLists = getPeopleLists(
    memberState.status === 'ready' ? memberState.data : undefined,
    requestState.status === 'ready' ? requestState.data : undefined,
  )

  return (
    <div className="flex flex-col gap-6">
      <PeopleTabHeader />

      {(campaignContext.campaign.isLoading ||
        (!campaignData && !campaignContext.campaign.isError)) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {campaignContext.campaign.isError && (
        <PeopleSectionFailed
          title="Campaign"
          message="Failed to load campaign."
          onRetry={campaignContext.campaign.refetch}
        />
      )}

      {campaignData && (
        <PeopleReadySections
          campaignId={campaignData._id}
          isDm={isDm === true}
          joinUrl={joinUrl}
          memberState={memberState}
          requestState={requestState}
          peopleLists={peopleLists}
        />
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

type PeopleSectionState<T> =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => unknown }
  | { status: 'ready'; data: T }

type PeopleLists = ReturnType<typeof getPeopleLists>

function getPeopleSectionState<T>(query: {
  data: T | undefined
  status: 'pending' | 'error' | 'success'
  refetch: () => unknown
}): PeopleSectionState<T> {
  if (query.status === 'success' && query.data !== undefined) {
    return { status: 'ready', data: query.data }
  }

  if (query.status === 'error') {
    return { status: 'failed', retry: query.refetch }
  }

  return { status: 'loading' }
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

function PeopleReadySections({
  campaignId,
  isDm,
  joinUrl,
  memberState,
  requestState,
  peopleLists,
}: {
  campaignId: NonNullable<ReturnType<typeof usePeopleTabData>['campaignData']>['_id']
  isDm: boolean
  joinUrl: string | null
  memberState: PeopleSectionState<NonNullable<PeopleMembersQuery['data']>>
  requestState: PeopleSectionState<NonNullable<PeopleRequestsQuery['data']>>
  peopleLists: PeopleLists
}) {
  return (
    <>
      {isDm && joinUrl && <InviteLinkSection joinUrl={joinUrl} />}
      <MembersStateSection
        campaignId={campaignId}
        isDm={isDm}
        memberState={memberState}
        peopleLists={peopleLists}
      />
      {isDm && (
        <RequestsStateSections
          campaignId={campaignId}
          requestState={requestState}
          peopleLists={peopleLists}
        />
      )}
    </>
  )
}

function MembersStateSection({
  campaignId,
  isDm,
  memberState,
  peopleLists,
}: {
  campaignId: NonNullable<ReturnType<typeof usePeopleTabData>['campaignData']>['_id']
  isDm: boolean
  memberState: PeopleSectionState<NonNullable<PeopleMembersQuery['data']>>
  peopleLists: PeopleLists
}) {
  switch (memberState.status) {
    case 'loading':
      return <PeopleSectionLoading title="Members" />
    case 'failed':
      return (
        <PeopleSectionFailed
          title="Members"
          message="Failed to load members."
          onRetry={memberState.retry}
        />
      )
    case 'ready':
      return (
        <MembersSection
          dmMember={peopleLists.dmMember}
          acceptedPlayers={peopleLists.acceptedPlayers}
          isDm={isDm}
          campaignId={campaignId}
        />
      )
  }
}

function RequestsStateSections({
  campaignId,
  requestState,
  peopleLists,
}: {
  campaignId: NonNullable<ReturnType<typeof usePeopleTabData>['campaignData']>['_id']
  requestState: PeopleSectionState<NonNullable<PeopleRequestsQuery['data']>>
  peopleLists: PeopleLists
}) {
  switch (requestState.status) {
    case 'loading':
      return <PeopleSectionLoading title="Join requests" />
    case 'failed':
      return (
        <PeopleSectionFailed
          title="Join requests"
          message="Failed to load join requests."
          onRetry={requestState.retry}
        />
      )
    case 'ready':
      return (
        <>
          <PendingRequestsSection
            pendingPlayers={peopleLists.pendingPlayers}
            campaignId={campaignId}
          />
          <RejectedRemovedSection players={peopleLists.rejectedOrRemoved} campaignId={campaignId} />
        </>
      )
  }
}

function PeopleSectionLoading({ title }: { title: string }) {
  return (
    <SettingsSection title={title}>
      <div className="flex items-center justify-center py-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    </SettingsSection>
  )
}

function PeopleSectionFailed({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => unknown
}) {
  return (
    <SettingsSection title={title}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{message}</p>
        <Button size="sm" variant="outline" onClick={() => void onRetry()}>
          Try Again
        </Button>
      </div>
    </SettingsSection>
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
