import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { PermissionLevel } from 'convex/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  AggregateShareStatus,
  ShareItem,
} from '~/features/sharing/hooks/useBlocksShare'
import { handleError } from '~/shared/utils/logger'
import { AGGREGATE_SHARE_STATUS } from '~/features/sharing/hooks/useBlocksShare'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { useCampaignMembers } from '~/features/players/hooks/useCampaignMembers'

export interface ShareItemWithPermission extends ShareItem {
  permissionLevel: PermissionLevel
  hasExplicitShare: boolean
  inheritedPermissionLevel: PermissionLevel
  inheritedFromFolderName?: string
}

interface SidebarItemShareInfo {
  itemId: Id<'notes'> | Id<'folders'> | Id<'gameMaps'> | Id<'files'>
  allPermissionLevel: PermissionLevel | null
  sharedMemberIds: Set<Id<'campaignMembers'>>
  memberPermissions: Map<Id<'campaignMembers'>, PermissionLevel>
  inheritedAllPermissionLevel: PermissionLevel | null
  inheritedFromFolderName: string | null
  memberInheritedPermissions: Map<Id<'campaignMembers'>, PermissionLevel>
  memberInheritedFromFolderNames: Map<Id<'campaignMembers'>, string>
}

/**
 * Hook for managing share state of sidebar items.
 * Designed to work with multiple items for future multi-select support.
 * Currently queries each item individually but aggregates the results.
 */
export function useSidebarItemsShare(items: Array<AnySidebarItem>) {
  const { campaign, isDm } = useCampaign()
  const campaignData = campaign.data
  const campaignMembersQuery = useCampaignMembers()
  const playerMembers =
    campaignMembersQuery.data?.filter(
      (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
    ) ?? []

  // For now, we only support single item selection
  const singleItem = items.length === 1 ? items[0] : undefined

  const query = useAuthQuery(
    api.sidebarShares.queries.getSidebarItemWithShares,
    campaignData?._id && singleItem && isDm
      ? { sidebarItemId: singleItem._id }
      : 'skip',
  )

  const shareSidebarItem = useAppMutation(
    api.sidebarShares.mutations.shareSidebarItem,
  )
  const unshareSidebarItem = useAppMutation(
    api.sidebarShares.mutations.unshareSidebarItem,
  )
  const updateSharePermission = useAppMutation(
    api.sidebarShares.mutations.updateSidebarItemSharePermission,
  )
  const setAllPlayersPermissionMutation = useAppMutation(
    api.sidebarShares.mutations.setAllPlayersPermission,
  )
  const setFolderInheritSharesMutation = useAppMutation(
    api.sidebarShares.mutations.setFolderInheritShares,
  )
  const isMutating =
    shareSidebarItem.isPending ||
    unshareSidebarItem.isPending ||
    updateSharePermission.isPending ||
    setAllPlayersPermissionMutation.isPending ||
    setFolderInheritSharesMutation.isPending

  // Build share info map for each item
  const itemShareInfoMap = (() => {
    const map = new Map<string, SidebarItemShareInfo>()

    if (singleItem && query.data) {
      const sharedMemberIds = new Set<Id<'campaignMembers'>>()
      const memberPermissions = new Map<
        Id<'campaignMembers'>,
        PermissionLevel
      >()
      for (const share of query.data.shares) {
        sharedMemberIds.add(share.campaignMemberId)
        memberPermissions.set(
          share.campaignMemberId,
          share.permissionLevel ?? PERMISSION_LEVEL.VIEW,
        )
      }

      const memberInheritedPermissions = new Map(
        Object.entries(query.data.memberInheritedPermissions),
      ) as Map<Id<'campaignMembers'>, PermissionLevel>

      const memberInheritedFromFolderNames = new Map(
        Object.entries(query.data.memberInheritedFromFolderNames),
      ) as Map<Id<'campaignMembers'>, string>

      map.set(singleItem._id, {
        itemId: singleItem._id,
        allPermissionLevel: query.data.allPermissionLevel,
        sharedMemberIds,
        memberPermissions,
        inheritedAllPermissionLevel: query.data.inheritedAllPermissionLevel,
        inheritedFromFolderName: query.data.inheritedFromFolderName,
        memberInheritedPermissions,
        memberInheritedFromFolderNames,
      })
    }

    return map
  })()

  const hasCompleteData =
    items.length > 0 &&
    campaignMembersQuery.isSuccess &&
    items.every((item) => itemShareInfoMap.has(item._id))

  // Derive aggregate share status from allPermissionLevel, inherited values, and individual shares
  const aggregateShareStatus: AggregateShareStatus = (() => {
    if (!hasCompleteData || items.length === 0)
      return AGGREGATE_SHARE_STATUS.NOT_SHARED

    const infos = items.map((item) => itemShareInfoMap.get(item._id))

    const resolvedAllPerm = (info: SidebarItemShareInfo | undefined) =>
      info?.allPermissionLevel ?? info?.inheritedAllPermissionLevel

    const allSharedWithAll = infos.every((info) => {
      const perm = resolvedAllPerm(info)
      return perm && perm !== PERMISSION_LEVEL.NONE
    })
    if (allSharedWithAll) return AGGREGATE_SHARE_STATUS.ALL_SHARED

    const hasAnyShares = infos.some((info) => {
      const perm = resolvedAllPerm(info)
      const hasInheritedMemberShares = Array.from(
        info?.memberInheritedPermissions?.values() ?? [],
      ).some((level) => level !== PERMISSION_LEVEL.NONE)
      return (
        (info?.sharedMemberIds?.size ?? 0) > 0 ||
        hasInheritedMemberShares ||
        (perm && perm !== PERMISSION_LEVEL.NONE)
      )
    })
    if (hasAnyShares) return AGGREGATE_SHARE_STATUS.INDIVIDUALLY_SHARED

    return AGGREGATE_SHARE_STATUS.NOT_SHARED
  })()

  // Get share state for a specific member across all items
  const getShareState = (
    memberId: Id<'campaignMembers'>,
  ): 'all' | 'some' | 'none' => {
    if (items.length === 0) return 'none'

    let sharedCount = 0
    for (const item of items) {
      const info = itemShareInfoMap.get(item._id)
      // Member has access if they have an individual share, inherited share, or allPermissionLevel >= view
      const hasIndividualShare = info?.sharedMemberIds.has(memberId) ?? false
      const resolvedPerm =
        info?.allPermissionLevel ?? info?.inheritedAllPermissionLevel
      const hasAllPermission =
        resolvedPerm !== undefined && resolvedPerm !== PERMISSION_LEVEL.NONE
      const inheritedMemberPerm = info?.memberInheritedPermissions.get(memberId)
      const hasInheritedMemberPerm =
        inheritedMemberPerm !== undefined &&
        inheritedMemberPerm !== PERMISSION_LEVEL.NONE
      if (hasIndividualShare || hasAllPermission || hasInheritedMemberPerm) {
        sharedCount++
      }
    }

    if (sharedCount === 0) return 'none'
    if (sharedCount === items.length) return 'all'
    return 'some'
  }

  // Toggle allPermissionLevel between 'none' and 'view'
  const toggleShareStatus = async () => {
    if (
      !campaignData?._id ||
      isMutating ||
      items.length === 0 ||
      !hasCompleteData
    )
      return

    try {
      const isCurrentlyShared =
        aggregateShareStatus !== AGGREGATE_SHARE_STATUS.NOT_SHARED
      const newLevel: PermissionLevel = isCurrentlyShared
        ? PERMISSION_LEVEL.NONE
        : PERMISSION_LEVEL.VIEW

      await Promise.all(
        items.map((item) =>
          setAllPlayersPermissionMutation.mutateAsync({
            sidebarItemId: item._id,
            permissionLevel: newLevel,
          }),
        ),
      )

      if (newLevel !== PERMISSION_LEVEL.NONE) {
        if (playerMembers.length === 0) {
          toast.success('Shared with all players')
        } else {
          toast.success(`Shared with ${playerMembers.length} player(s)`)
        }
      } else {
        toast.success('Unshared from all players')
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Toggle share with a specific member for all items
  const toggleShareWithMember = async (memberId: Id<'campaignMembers'>) => {
    if (
      !campaignData?._id ||
      isMutating ||
      items.length === 0 ||
      !hasCompleteData
    )
      return

    try {
      const currentState = getShareState(memberId)

      if (currentState === 'all') {
        // Unshare from all items
        await Promise.all(
          items.map((item) =>
            unshareSidebarItem.mutateAsync({
              sidebarItemId: item._id,
              campaignMemberId: memberId,
            }),
          ),
        )
        toast.success('Unshared from player')
      } else {
        // Share items that aren't already individually shared with this member
        const itemsToShare = items.filter((item) => {
          const info = itemShareInfoMap.get(item._id)
          return !info?.sharedMemberIds.has(memberId)
        })

        if (itemsToShare.length === 0) return

        await Promise.all(
          itemsToShare.map((item) =>
            shareSidebarItem.mutateAsync({
              sidebarItemId: item._id,
              sidebarItemType: item.type,
              campaignMemberId: memberId,
            }),
          ),
        )
        toast.success('Shared with player')
      }
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Get the permission level for a specific member
  // Check individual share first, fall back to allPermissionLevel, then inherited
  const getMemberPermissionLevel = (
    memberId: Id<'campaignMembers'>,
  ): PermissionLevel => {
    if (items.length === 0) return PERMISSION_LEVEL.NONE
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return PERMISSION_LEVEL.NONE

    // Individual share takes precedence
    if (info.sharedMemberIds.has(memberId)) {
      return info.memberPermissions.get(memberId) ?? PERMISSION_LEVEL.VIEW
    }
    // Fall back to allPermissionLevel
    if (info.allPermissionLevel !== null) {
      return info.allPermissionLevel
    }
    // Fall back to pre-computed inherited permission for this member
    return (
      info.memberInheritedPermissions.get(memberId) ?? PERMISSION_LEVEL.NONE
    )
  }

  // Get the explicit "all players" permission level (null = inheriting)
  const allPlayersPermissionLevel: PermissionLevel | null = (() => {
    if (items.length === 0) return null
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return null
    return info.allPermissionLevel
  })()

  // Get the inherited permission level from ancestor folder (if any)
  const inheritedAllPermissionLevel: PermissionLevel | null = (() => {
    if (items.length === 0) return null
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return null
    return info.inheritedAllPermissionLevel
  })()

  // Get the name of the folder providing inherited all-players permission
  const inheritedFromFolderName: string | null = (() => {
    if (items.length === 0) return null
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return null
    return info.inheritedFromFolderName
  })()

  // Folder-specific: whether shares are inherited by new child items
  const isFolder = singleItem?.type === SIDEBAR_ITEM_TYPES.folders
  const inheritShares = !isFolder ? false : (query.data?.inheritShares ?? false)

  // Toggle inheritShares on a folder
  const setInheritShares = async (enabled: boolean) => {
    if (!campaignData?._id || isMutating || !singleItem || !isFolder) return

    try {
      await setFolderInheritSharesMutation.mutateAsync({
        folderId: singleItem._id,
        inheritShares: enabled,
      })
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Set a specific member's permission level
  const setMemberPermission = async (
    memberId: Id<'campaignMembers'>,
    level: PermissionLevel,
  ) => {
    if (!campaignData?._id || isMutating || items.length === 0) return

    try {
      await Promise.all(
        items.map((item) =>
          updateSharePermission.mutateAsync({
            sidebarItemId: item._id,
            sidebarItemType: item.type,
            campaignMemberId: memberId,
            permissionLevel: level,
          }),
        ),
      )
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Set all players' permission level
  const setAllPlayersPermission = async (level: PermissionLevel | null) => {
    if (!campaignData?._id || isMutating || items.length === 0) return

    try {
      await Promise.all(
        items.map((item) =>
          setAllPlayersPermissionMutation.mutateAsync({
            sidebarItemId: item._id,
            permissionLevel: level,
          }),
        ),
      )
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Check if a specific member has an explicit share override
  const getMemberHasExplicitShare = (
    memberId: Id<'campaignMembers'>,
  ): boolean => {
    if (items.length === 0) return false
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return false
    return info.sharedMemberIds.has(memberId)
  }

  // Clear a specific member's explicit share override (revert to default)
  const clearMemberPermission = async (memberId: Id<'campaignMembers'>) => {
    if (!campaignData?._id || isMutating || items.length === 0) return

    try {
      await Promise.all(
        items.map((item) =>
          unshareSidebarItem.mutateAsync({
            sidebarItemId: item._id,
            campaignMemberId: memberId,
          }),
        ),
      )
    } catch (error) {
      handleError(error, 'Failed to update share')
    }
  }

  // Get what a player would resolve to if their explicit share is removed.
  // This determines the "Default (X)" label in the dropdown.
  const getMemberDefaultPermissionLevel = (
    memberId: Id<'campaignMembers'>,
  ): PermissionLevel => {
    if (items.length === 0) return PERMISSION_LEVEL.NONE
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return PERMISSION_LEVEL.NONE
    // If item has explicit allPermissionLevel, that takes effect
    if (info.allPermissionLevel !== null) return info.allPermissionLevel
    // Otherwise, fall back to the per-member inherited level from ancestors
    return (
      info.memberInheritedPermissions.get(memberId) ?? PERMISSION_LEVEL.NONE
    )
  }

  // Get the folder name a player's permission is inherited from (if any)
  const getMemberInheritedFromFolderName = (
    memberId: Id<'campaignMembers'>,
  ): string | undefined => {
    if (items.length === 0) return undefined
    const info = itemShareInfoMap.get(items[0]._id)
    if (!info) return undefined
    return info.memberInheritedFromFolderNames.get(memberId)
  }

  const shareItems: Array<ShareItemWithPermission> = playerMembers.map(
    (member) => ({
      key: `share-${member._id}`,
      member,
      shareState: getShareState(member._id),
      permissionLevel: getMemberPermissionLevel(member._id),
      hasExplicitShare: getMemberHasExplicitShare(member._id),
      inheritedPermissionLevel: getMemberDefaultPermissionLevel(member._id),
      inheritedFromFolderName: getMemberInheritedFromFolderName(member._id),
    }),
  )

  // Check if sharing is available (is DM and has items)
  const canShare = isDm && items.length > 0

  return {
    query,
    isPending: query.isPending,
    isMutating,
    aggregateShareStatus,
    allPlayersPermissionLevel,
    inheritedAllPermissionLevel,
    inheritedFromFolderName,
    isFolder,
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
    canShare,
  }
}
