import type { ReactNode } from 'react'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { CollaborationUser } from '@wizard-archive/editor/resources/content-session-contract'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { RESOURCE_INDEX_SCHEMA } from '@wizard-archive/editor/resources/index-contract'
import { useState } from 'react'
import { LoadingSpinner } from '@wizard-archive/ui/components/loading-spinner'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { collaborationColor } from 'shared/resources/collaboration-user'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembersQuery } from '~/features/campaigns/hooks/use-campaign-operations'
import { LiveWorkspaceRouteEffects } from './live-workspace-route-effects'
import { useLiveResourceCore } from './resources/use-live-resource-core'
import { useLiveResourceNavigation } from './resources/use-live-resource-navigation'

export function LiveWorkspaceRuntimeProvider({
  children,
}: {
  children: (runtime: EditorRuntime) => ReactNode
}) {
  const { campaign, campaignId } = useCampaign()
  const membership = campaign.data?.myMembership

  if (!membership || !campaignId) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  return (
    <ScopedLiveWorkspaceRuntimeProvider
      key={`${campaignId}:${membership.id}:${membership.role}`}
      campaignId={campaignId}
      membership={membership}
    >
      {children}
    </ScopedLiveWorkspaceRuntimeProvider>
  )
}

function ScopedLiveWorkspaceRuntimeProvider({
  campaignId,
  children,
  membership,
}: {
  campaignId: CampaignId
  children: (runtime: EditorRuntime) => ReactNode
  membership: CampaignMemberSummary
}) {
  const members = useCampaignMembersQuery(
    membership.role === CAMPAIGN_MEMBER_ROLE.DM ? campaignId : undefined,
  )
  const [viewAsParticipantId, setViewAsParticipantId] = useState<CampaignMemberId | null>(null)
  const participants =
    membership.role === CAMPAIGN_MEMBER_ROLE.DM ? playerParticipants(members.data ?? []) : []
  const selectedParticipantId =
    membership.role === CAMPAIGN_MEMBER_ROLE.DM &&
    viewAsParticipantId !== null &&
    (members.data === undefined ||
      participants.some((participant) => participant.id === viewAsParticipantId))
      ? viewAsParticipantId
      : null
  const projection =
    selectedParticipantId === null
      ? membership.role === CAMPAIGN_MEMBER_ROLE.DM
        ? 'dm'
        : 'player'
      : 'view_as_player'
  const actorId = selectedParticipantId ?? membership.id
  const viewAs: EditorRuntime['viewAs'] =
    membership.role === CAMPAIGN_MEMBER_ROLE.DM
      ? {
          status: 'available',
          value: {
            pending: members.isPending,
            participants,
            selectedParticipantId,
            select: setViewAsParticipantId,
          },
        }
      : { status: 'unavailable', reason: 'unauthorized' }
  const collaborationUser = {
    name: membership.userProfile.name?.trim() || membership.userProfile.username,
    color: collaborationColor(membership.id),
  }
  return (
    <LoadedLiveWorkspaceRuntimeContent
      key={`${campaignId}:${actorId}:${projection}:${collaborationUser.name}`}
      workspaceId={campaignId}
      actorId={actorId}
      collaborationUser={collaborationUser}
      projection={projection}
      viewAs={viewAs}
    >
      {children}
    </LoadedLiveWorkspaceRuntimeContent>
  )
}

function LoadedLiveWorkspaceRuntimeContent({
  workspaceId,
  actorId,
  children,
  collaborationUser,
  projection,
  viewAs,
}: {
  workspaceId: CampaignId
  actorId: CampaignMemberId
  children: (runtime: EditorRuntime) => ReactNode
  collaborationUser: CollaborationUser
  projection: 'dm' | 'player' | 'view_as_player'
  viewAs: EditorRuntime['viewAs']
}) {
  const resourceNavigation = useLiveResourceNavigation()
  const resourceCore = useLiveResourceCore(
    {
      campaignId: workspaceId,
      actorId,
      projection,
      schema: RESOURCE_INDEX_SCHEMA,
    },
    resourceNavigation,
    collaborationUser,
  )
  if (!resourceCore) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  return (
    <>
      <LiveWorkspaceRouteEffects resourceLoader={resourceCore.resources.loader} />
      {children({ ...resourceCore, viewAs })}
    </>
  )
}

function playerParticipants(members: ReadonlyArray<CampaignMemberSummary>) {
  const participants: Array<
    Extract<EditorRuntime['viewAs'], { status: 'available' }>['value']['participants'][number]
  > = []
  for (const member of members) {
    if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) continue
    participants.push({
      id: member.id,
      displayName: member.userProfile.name?.trim() || `@${member.userProfile.username}`,
      username: member.userProfile.username,
      imageUrl: member.userProfile.imageUrl,
    })
  }
  return participants
}
