import { getCampaignActorViewAsMemberId } from 'shared/campaigns/actor'
import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import type { Id } from 'convex/_generated/dataModel'
import type {
  WizardEditorItemWithContent,
  WizardEditorResourceAvailabilityLookup,
  WizardEditorResourceAvailabilityMetadataSource,
  WizardEditorResourceAvailabilityState,
  WizardEditorResourceAvailabilitySubject,
} from '@wizard-archive/editor/adapter'
import { resolveWizardEditorResourceAvailabilityState } from '@wizard-archive/editor/adapter'
import { getCampaignMemberDisplayName } from '@wizard-archive/ui/utils/user-display-name'
import { toEditorWorkspaceActor } from './workspace-actor'

interface UseLiveSidebarItemAvailabilityStateArgs {
  accessStatus?: 'available' | 'not_found' | 'not_shared' | 'trashed' | null
  lookup: WizardEditorResourceAvailabilityLookup
  metadataSource: WizardEditorResourceAvailabilityMetadataSource
  readableItem: WizardEditorItemWithContent | null | undefined
  subject: WizardEditorResourceAvailabilitySubject
  fallbackLabel: string
  readableItemLoading?: boolean
  readableItemError?: unknown
}

export function useLiveSidebarItemAvailabilityState({
  accessStatus,
  lookup,
  metadataSource,
  readableItem,
  readableItemLoading = false,
  readableItemError,
  subject,
  fallbackLabel,
}: UseLiveSidebarItemAvailabilityStateArgs): WizardEditorResourceAvailabilityState {
  const campaignActor = useCampaignActor()
  const actor = toEditorWorkspaceActor(campaignActor)
  const viewAsPlayerId = getCampaignActorViewAsMemberId(campaignActor)
  const campaignMembersQuery = useCampaignMembers()
  const accessTargetLabel = resolveAccessTarget({
    viewAsPlayerId,
    members: campaignMembersQuery.data,
  })
  if (accessStatus === 'not_shared') {
    return {
      status: 'not_shared',
      label: fallbackLabel,
      message: `This ${subject} isn't shared with ${accessTargetLabel}.`,
    }
  }
  if (accessStatus === 'trashed') {
    return {
      status: 'trashed',
      label: fallbackLabel,
      message: `This ${subject} is in the trash.`,
    }
  }
  return resolveWizardEditorResourceAvailabilityState({
    lookup,
    metadataSource,
    readableItem,
    readableItemLoading,
    readableItemError,
    actor,
    accessTargetLabel,
    isDirectMessageActor: actor?.kind === 'owner',
    subject,
    fallbackLabel,
  })
}

function resolveAccessTarget({
  viewAsPlayerId,
  members,
}: {
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  members:
    | Array<{
        id: Id<'campaignMembers'>
        userProfile: { name?: string | null; username?: string | null }
      }>
    | undefined
}) {
  if (!viewAsPlayerId) {
    return 'you'
  }

  const member = members?.find((candidate) => candidate.id === viewAsPlayerId)
  if (!member) {
    return 'the selected player'
  }

  return getCampaignMemberDisplayName(member, 'you')
}
