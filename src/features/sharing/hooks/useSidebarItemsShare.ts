import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { PermissionLevel } from 'shared/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { AggregateShareStatus, ShareItem } from '~/features/sharing/utils/block-share-state'
import type { CampaignMemberSummary } from 'shared/campaigns/types'
import { handleError } from '~/shared/utils/logger'
import { AGGREGATE_SHARE_STATUS } from '~/features/sharing/utils/block-share-state'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

type MixedPermissionLevel = 'mixed'
type AggregatePermissionLevel = PermissionLevel | MixedPermissionLevel
export type NullableAggregatePermissionLevel = PermissionLevel | MixedPermissionLevel | null
type CampaignMemberId = CampaignMemberSummary['_id']

export interface ShareItemWithPermission extends ShareItem {
  permissionLevel: AggregatePermissionLevel
  hasExplicitShare: boolean
  inheritedPermissionLevel: AggregatePermissionLevel
  inheritedFromFolderName?: string
}

interface SidebarItemShareInfo {
  itemId: Id<'sidebarItems'>
  allPermissionLevel: PermissionLevel | null
  sharedMemberIds: Set<CampaignMemberId>
  memberPermissions: Map<CampaignMemberId, PermissionLevel>
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  memberInheritedPermissions: Map<CampaignMemberId, PermissionLevel>
  memberInheritedFromFolderNames: Map<CampaignMemberId, string>
}

function hasPermissionAccess(level: PermissionLevel | null | undefined): boolean {
  return level !== null && level !== undefined && level !== PERMISSION_LEVEL.NONE
}

function aggregatePermissionValues(
  values: Array<PermissionLevel>,
  fallback: PermissionLevel = PERMISSION_LEVEL.NONE,
): AggregatePermissionLevel {
  if (values.length === 0) return fallback
  const first = values[0]
  return values.every((value) => value === first) ? first : 'mixed'
}

function aggregateNullablePermissionValues(
  values: Array<PermissionLevel | null>,
): NullableAggregatePermissionLevel {
  if (values.length === 0) return null
  const first = values[0]
  return values.every((value) => value === first) ? first : 'mixed'
}

function aggregateOptionalStrings(values: Array<string | null | undefined>): string | null {
  const strings = values.filter((value): value is string => Boolean(value))
  if (strings.length === 0) return null
  const first = strings[0]
  return strings.every((value) => value === first) ? first : null
}

function getExplicitMemberPermission(
  info: SidebarItemShareInfo,
  memberId: CampaignMemberId,
): PermissionLevel | null {
  if (!info.sharedMemberIds.has(memberId)) return null
  return info.memberPermissions.get(memberId) ?? PERMISSION_LEVEL.VIEW
}

function getDefaultMemberPermission(
  info: SidebarItemShareInfo,
  memberId: CampaignMemberId,
): PermissionLevel {
  if (info.allPermissionLevel !== null) return info.allPermissionLevel
  return info.memberInheritedPermissions.get(memberId) ?? PERMISSION_LEVEL.NONE
}

function canLoadShareData({
  campaignId,
  isDm,
  hasPersistedItems,
}: {
  campaignId: Id<'campaigns'> | undefined
  isDm: boolean | undefined
  hasPersistedItems: boolean
}): boolean {
  return Boolean(campaignId) && Boolean(isDm) && hasPersistedItems
}

function canRunShareMutation({
  campaignId,
  isDm,
  isMutating,
  hasPersistedItems,
}: {
  campaignId: Id<'campaigns'> | undefined
  isDm: boolean | undefined
  isMutating: boolean
  hasPersistedItems: boolean
}): boolean {
  return Boolean(campaignId) && Boolean(isDm) && hasPersistedItems && !isMutating
}

export function useSidebarItemsShare(items: Array<AnySidebarItem>) {
  const { campaign, isDm } = useCampaign()
  const campaignData = campaign.data
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player) ?? []
  const itemIds = items.map((item) => item._id)
  const hasPersistedItems =
    items.length > 0 && items.every((item) => !isOptimisticSidebarItem(item))
  const singleItem = items.length === 1 ? items[0] : undefined

  const query = useCampaignQuery(
    api.sidebarShares.queries.getSidebarItemsWithShares,
    canLoadShareData({ campaignId: campaignData?._id, isDm, hasPersistedItems })
      ? { sidebarItemIds: itemIds }
      : 'skip',
  )

  const setMemberPermissionMutation = useCampaignMutation(
    api.sidebarShares.mutations.setSidebarItemsMemberPermission,
  )
  const clearMemberPermissionMutation = useCampaignMutation(
    api.sidebarShares.mutations.clearSidebarItemsMemberPermission,
  )
  const setAllPlayersPermissionMutation = useCampaignMutation(
    api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems,
  )
  const setFolderInheritSharesMutation = useCampaignMutation(
    api.sidebarShares.mutations.setFolderInheritShares,
  )
  const isMutating =
    setMemberPermissionMutation.isPending ||
    clearMemberPermissionMutation.isPending ||
    setAllPlayersPermissionMutation.isPending ||
    setFolderInheritSharesMutation.isPending
  const canMutateShares = canRunShareMutation({
    campaignId: campaignData?._id,
    isDm,
    isMutating,
    hasPersistedItems,
  })

  const itemShareInfoMap = (() => {
    const map = new Map<Id<'sidebarItems'>, SidebarItemShareInfo>()
    for (const itemShareData of query.data ?? []) {
      const sharedMemberIds = new Set<CampaignMemberId>()
      const memberPermissions = new Map<CampaignMemberId, PermissionLevel>()
      for (const share of itemShareData.shares) {
        sharedMemberIds.add(share.campaignMemberId)
        memberPermissions.set(
          share.campaignMemberId,
          share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
        )
      }

      const memberInheritedPermissions = new Map(
        Object.entries(itemShareData.memberInheritedPermissions),
      ) as Map<CampaignMemberId, PermissionLevel>

      const memberInheritedFromFolderNames = new Map(
        Object.entries(itemShareData.memberInheritedFromFolderNames),
      ) as Map<CampaignMemberId, string>

      map.set(itemShareData.sidebarItemId, {
        itemId: itemShareData.sidebarItemId,
        allPermissionLevel: itemShareData.allPermissionLevel,
        sharedMemberIds,
        memberPermissions,
        inheritedAllPermissionLevel: itemShareData.inheritedAllPermissionLevel,
        inheritedFromFolderName: itemShareData.inheritedFromFolderName,
        memberInheritedPermissions,
        memberInheritedFromFolderNames,
      })
    }
    return map
  })()

  const itemShareInfos = items
    .map((item) => itemShareInfoMap.get(item._id))
    .filter((info): info is SidebarItemShareInfo => Boolean(info))

  const hasCompleteData =
    items.length > 0 &&
    campaignMembersQuery.isSuccess &&
    query.isSuccess &&
    itemShareInfos.length === items.length

  const aggregateShareStatus: AggregateShareStatus = (() => {
    if (!hasCompleteData) return AGGREGATE_SHARE_STATUS.NOT_SHARED

    const allSharedWithAll = itemShareInfos.every((info) =>
      hasPermissionAccess(info.allPermissionLevel ?? info.inheritedAllPermissionLevel),
    )
    if (allSharedWithAll) return AGGREGATE_SHARE_STATUS.ALL_SHARED

    const hasAnyShares = itemShareInfos.some((info) => {
      const hasInheritedMemberShares = Array.from(info.memberInheritedPermissions.values()).some(
        hasPermissionAccess,
      )
      return (
        info.sharedMemberIds.size > 0 ||
        hasInheritedMemberShares ||
        hasPermissionAccess(info.allPermissionLevel ?? info.inheritedAllPermissionLevel)
      )
    })
    return hasAnyShares
      ? AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED
      : AGGREGATE_SHARE_STATUS.NOT_SHARED
  })()

  const getShareState = (memberId: CampaignMemberId): 'all' | 'some' | 'none' => {
    if (!hasCompleteData) return 'none'

    const sharedCount = itemShareInfos.filter((info) => {
      const explicitPermission = getExplicitMemberPermission(info, memberId)
      return (
        hasPermissionAccess(explicitPermission) ||
        hasPermissionAccess(info.allPermissionLevel ?? info.inheritedAllPermissionLevel) ||
        hasPermissionAccess(info.memberInheritedPermissions.get(memberId))
      )
    }).length

    if (sharedCount === 0) return 'none'
    if (sharedCount === itemShareInfos.length) return 'all'
    return 'some'
  }

  const toggleShareStatus = async () => {
    if (!canMutateShares || !hasCompleteData) return

    try {
      const isCurrentlyShared = aggregateShareStatus !== AGGREGATE_SHARE_STATUS.NOT_SHARED
      const newLevel: PermissionLevel = isCurrentlyShared
        ? PERMISSION_LEVEL.NONE
        : PERMISSION_LEVEL.VIEW

      await setAllPlayersPermissionMutation.mutateAsync({
        sidebarItemIds: itemIds,
        permissionLevel: newLevel,
      })

      if (newLevel !== PERMISSION_LEVEL.NONE) {
        toast.success(
          playerMembers.length === 0
            ? 'Shared with all players'
            : `Shared with ${playerMembers.length} player(s)`,
        )
      } else {
        toast.success('Unshared from all players')
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const toggleShareWithMember = async (memberId: CampaignMemberId) => {
    if (!canMutateShares || !hasCompleteData) return

    try {
      if (getShareState(memberId) === 'all') {
        await clearMemberPermissionMutation.mutateAsync({
          sidebarItemIds: itemIds,
          campaignMemberId: memberId,
        })
        toast.success('Unshared from player')
      } else {
        await setMemberPermissionMutation.mutateAsync({
          sidebarItemIds: itemIds,
          campaignMemberId: memberId,
          permissionLevel: PERMISSION_LEVEL.VIEW,
        })
        toast.success('Shared with player')
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const allPlayersPermissionLevel = aggregateNullablePermissionValues(
    itemShareInfos.map((info) => info.allPermissionLevel),
  )

  const inheritedAllPermissionLevel = aggregateNullablePermissionValues(
    itemShareInfos.map((info) => info.inheritedAllPermissionLevel),
  )

  const inheritedFromFolderName = aggregateOptionalStrings(
    itemShareInfos.map((info) => info.inheritedFromFolderName),
  )

  const isFolder = singleItem?.type === SIDEBAR_ITEM_TYPES.folders
  const inheritShares =
    isFolder && items.length === 1
      ? (query.data?.find((itemShareData) => itemShareData.sidebarItemId === singleItem._id)
          ?.inheritShares ?? false)
      : false

  const setInheritShares = async (enabled: boolean) => {
    if (!canMutateShares || !singleItem || !isFolder) return

    try {
      await setFolderInheritSharesMutation.mutateAsync({
        folderId: singleItem._id,
        inheritShares: enabled,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const setMemberPermission = async (memberId: CampaignMemberId, level: PermissionLevel) => {
    if (!canMutateShares) return

    try {
      await setMemberPermissionMutation.mutateAsync({
        sidebarItemIds: itemIds,
        campaignMemberId: memberId,
        permissionLevel: level,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const setAllPlayersPermission = async (level: PermissionLevel | null) => {
    if (!canMutateShares) return

    try {
      await setAllPlayersPermissionMutation.mutateAsync({
        sidebarItemIds: itemIds,
        permissionLevel: level,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const clearMemberPermission = async (memberId: CampaignMemberId) => {
    if (!canMutateShares) return

    try {
      await clearMemberPermissionMutation.mutateAsync({
        sidebarItemIds: itemIds,
        campaignMemberId: memberId,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  const shareItems: Array<ShareItemWithPermission> = playerMembers.map((member) => {
    const explicitPermissions = itemShareInfos.map((info) =>
      getExplicitMemberPermission(info, member._id),
    )
    const hasExplicitShare = explicitPermissions.some((level) => level !== null)
    const permissionLevel = hasExplicitShare
      ? aggregateNullablePermissionValues(explicitPermissions)
      : aggregatePermissionValues(
          itemShareInfos.map((info) => getDefaultMemberPermission(info, member._id)),
        )
    const inheritedPermissionLevel = aggregatePermissionValues(
      itemShareInfos.map((info) => getDefaultMemberPermission(info, member._id)),
    )
    const memberInheritedFromFolderName = aggregateOptionalStrings(
      itemShareInfos.map((info) => info.memberInheritedFromFolderNames.get(member._id)),
    )

    return {
      key: `share-${member._id}`,
      member,
      shareState: getShareState(member._id),
      permissionLevel: permissionLevel ?? PERMISSION_LEVEL.NONE,
      hasExplicitShare,
      inheritedPermissionLevel,
      inheritedFromFolderName: memberInheritedFromFolderName ?? undefined,
    }
  })

  return {
    query,
    isPending: query.isPending,
    isMutating,
    aggregateShareStatus,
    allPlayersPermissionLevel,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    isFolder: isFolder && items.length === 1,
    inheritShares,
    shareableItems: items,
    playerMembers,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
    setMemberPermission,
    clearMemberPermission,
    setAllPlayersPermission,
    setInheritShares,
    canShare: Boolean(isDm) && hasPersistedItems,
  }
}
