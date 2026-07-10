import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { isPersistedWizardEditorItem } from '@wizard-archive/editor/adapter'
import type { WizardEditorItem } from '@wizard-archive/editor/adapter'
import type {
  EditorPermissionLevel,
  ResourceShareProjectionData,
  ResourceShareOperations,
  ResourceShareState,
} from '@wizard-archive/editor/sharing'
import { createResourceShareRuntimeState } from '@wizard-archive/editor/sharing'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { canLoadLiveShareData, canRunLiveShareMutation } from './share-capability'
import { useShareMutationRunner } from './use-share-mutation-runner'
import { useLiveSidebarItemsShareQuery } from './use-live-sidebar-items-share-query'
import { toEditorShareParticipant } from '~/editor-adapters/sharing/share-participants'

type LiveResourceShareProjectionRow = {
  sidebarItemId: ResourceShareProjectionData<string>['sidebarItemId']
  allPermissionLevel: EditorPermissionLevel | null
  inheritShares: boolean | null
  inheritedAllPermissionLevel: EditorPermissionLevel | null
  inheritedFromFolderName: string | null
  shares: Array<{
    campaignMemberId: string
    permissionLevel: EditorPermissionLevel | null
  }>
  memberInheritedPermissions: Partial<Record<string, EditorPermissionLevel>>
  memberInheritedFromFolderNames: Partial<Record<string, string>>
}

export function useLiveSidebarItemsShare(
  items: Array<WizardEditorItem>,
  operations: ResourceShareOperations,
): ResourceShareState {
  const { campaign, isDm } = useCampaign()
  const { isMutating, runShareCommand } = useShareMutationRunner()
  const campaignData = campaign.data
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const participants = playerMembers.map(toEditorShareParticipant)
  const queryItems = items.filter(isPersistedWizardEditorItem)
  const queryItemIds = queryItems.map((item) => item.id)

  const canLoadQueryShares = canLoadLiveShareData({
    hasPersistedTarget: queryItems.length > 0,
    hasShareTargets: true,
    isDm,
    workspaceRecordId: campaignData?.id,
  })
  const query = useLiveSidebarItemsShareQuery(canLoadQueryShares ? queryItemIds : [])

  const hasPersistedItems = items.some(isPersistedWizardEditorItem)
  const canLoadShares = canLoadLiveShareData({
    hasPersistedTarget: hasPersistedItems,
    hasShareTargets: true,
    isDm,
    workspaceRecordId: campaignData?.id,
  })
  return createResourceShareRuntimeState({
    canLoadShares,
    canRunShareMutations: canRunLiveShareMutation({
      hasPersistedTarget: hasPersistedItems,
      hasShareTargets: true,
      isMutating,
      isDm,
      workspaceRecordId: campaignData?.id,
    }),
    isMutating,
    itemShareData: toEditorResourceShareProjectionData(query.data ?? []),
    operations,
    participants,
    participantsLoaded: !campaignMembersQuery.isPending,
    runShareCommand,
    shareDataError: query.isError ? query.error : null,
    shareableItems: items,
    shareDataLoaded: !query.isPending,
  })
}

function toEditorResourceShareProjectionData(
  data: Array<LiveResourceShareProjectionRow>,
): Array<ResourceShareProjectionData<string>> {
  return data.map((item) => ({
    sidebarItemId: item.sidebarItemId,
    allPermissionLevel: item.allPermissionLevel,
    inheritShares: item.inheritShares ?? false,
    inheritedAllPermissionLevel: item.inheritedAllPermissionLevel,
    inheritedFromFolderName: item.inheritedFromFolderName,
    shares: item.shares.map((share) => ({
      participantId: share.campaignMemberId,
      permissionLevel: share.permissionLevel,
    })),
    memberInheritedPermissions: item.memberInheritedPermissions,
    memberInheritedFromFolderNames: item.memberInheritedFromFolderNames,
  }))
}
