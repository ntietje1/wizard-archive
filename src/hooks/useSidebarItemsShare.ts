import { useCallback, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { toast } from 'sonner'
import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { SHARE_STATUS } from 'convex/shares/types'
import type { ShareStatus } from 'convex/shares/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItemWithContent } from 'convex/sidebarItems/types'
import type { AggregateShareStatus, ShareItem } from '~/hooks/useBlocksShare'
import { useCampaign } from '~/hooks/useCampaign'
import { isFolder } from '~/lib/sidebar-item-utils'

interface SidebarItemShareInfo {
  itemId: Id<'notes'> | Id<'folders'> | Id<'gameMaps'> | Id<'files'>
  shareStatus: ShareStatus
  sharedMemberIds: Set<Id<'campaignMembers'>>
}

/**
 * Hook for managing share state of sidebar items.
 * Designed to work with multiple items for future multi-select support.
 * Currently queries each item individually but aggregates the results.
 */
export function useSidebarItemsShare(items: Array<AnySidebarItemWithContent>) {
  const { campaignWithMembership, isDm } = useCampaign()
  const campaign = campaignWithMembership.data?.campaign

  // Filter out folders since they can't be shared
  const shareableItems = useMemo(
    () => items.filter((item) => !isFolder(item)),
    [items],
  )

  // For now, we only support single item selection
  // When multi-select is implemented, this will need to batch queries or use a different approach
  const singleItem = shareableItems.length === 1 ? shareableItems[0] : undefined

  const query = useQuery(
    convexQuery(
      api.shares.queries.getSidebarItemWithShares,
      campaign?._id && singleItem && isDm
        ? {
            campaignId: campaign._id,
            sidebarItemId: singleItem._id,
          }
        : 'skip',
    ),
  )

  const setSidebarItemShareStatus = useMutation({
    mutationFn: useConvexMutation(
      api.shares.mutations.setSidebarItemShareStatus,
    ),
  })
  const shareSidebarItem = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.shareSidebarItem),
  })
  const unshareSidebarItem = useMutation({
    mutationFn: useConvexMutation(api.shares.mutations.unshareSidebarItem),
  })

  const isMutating =
    setSidebarItemShareStatus.isPending ||
    shareSidebarItem.isPending ||
    unshareSidebarItem.isPending

  // Build share info map for each item
  // Currently only single item, but structured for multi-select
  const itemShareInfoMap = useMemo(() => {
    const map = new Map<string, SidebarItemShareInfo>()

    if (singleItem && query.data) {
      const sharedMemberIds = new Set<Id<'campaignMembers'>>()
      if (query.data.shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
        for (const share of query.data.shares) {
          sharedMemberIds.add(share.campaignMemberId)
        }
      }

      map.set(singleItem._id, {
        itemId: singleItem._id,
        shareStatus: query.data.shareStatus,
        sharedMemberIds,
      })
    }

    return map
  }, [singleItem, query.data])

  const hasCompleteData = useMemo(
    () =>
      shareableItems.length > 0 &&
      shareableItems.every((item) => itemShareInfoMap.has(item._id)),
    [shareableItems, itemShareInfoMap],
  )

  const aggregateShareStatus: AggregateShareStatus = useMemo(() => {
    if (!hasCompleteData || shareableItems.length === 0) return 'not_shared'

    const statuses = shareableItems.map(
      (item) =>
        itemShareInfoMap.get(item._id)?.shareStatus ?? SHARE_STATUS.NOT_SHARED,
    )

    // If any item is not shared, overall status is not_shared
    if (statuses.some((s) => s === SHARE_STATUS.NOT_SHARED)) return 'not_shared'
    // If all items are all_shared, overall status is all_shared
    if (statuses.every((s) => s === SHARE_STATUS.ALL_SHARED))
      return 'all_shared'
    // If all items are individually_shared, overall status is individually_shared
    if (statuses.every((s) => s === SHARE_STATUS.INDIVIDUALLY_SHARED))
      return 'individually_shared'
    // Mixed statuses
    return 'mixed_shared'
  }, [shareableItems, itemShareInfoMap, hasCompleteData])

  const unsharedItems = useMemo(
    () =>
      shareableItems.filter(
        (item) =>
          (itemShareInfoMap.get(item._id)?.shareStatus ??
            SHARE_STATUS.NOT_SHARED) === SHARE_STATUS.NOT_SHARED,
      ),
    [shareableItems, itemShareInfoMap],
  )

  const playerMembers = useMemo(
    () => query.data?.playerMembers ?? [],
    [query.data?.playerMembers],
  )

  // Get share state for a specific member across all items
  const getShareState = useCallback(
    (memberId: Id<'campaignMembers'>): 'all' | 'some' | 'none' => {
      if (shareableItems.length === 0) return 'none'

      let sharedCount = 0
      for (const item of shareableItems) {
        const info = itemShareInfoMap.get(item._id)
        const status = info?.shareStatus ?? SHARE_STATUS.NOT_SHARED
        if (
          status === SHARE_STATUS.ALL_SHARED ||
          (status === SHARE_STATUS.INDIVIDUALLY_SHARED &&
            info?.sharedMemberIds.has(memberId))
        ) {
          sharedCount++
        }
      }

      if (sharedCount === 0) return 'none'
      if (sharedCount === shareableItems.length) return 'all'
      return 'some'
    },
    [shareableItems, itemShareInfoMap],
  )

  // Toggle share status for all items
  const toggleShareStatus = useCallback(async () => {
    if (
      !campaign?._id ||
      isMutating ||
      shareableItems.length === 0 ||
      !hasCompleteData
    )
      return

    try {
      // Determine items to update and new status
      const itemsToUpdate =
        unsharedItems.length > 0 ? unsharedItems : shareableItems
      const newStatus =
        unsharedItems.length > 0
          ? SHARE_STATUS.ALL_SHARED
          : SHARE_STATUS.NOT_SHARED

      // For now, update each item individually
      // When multi-select is implemented, consider a batch mutation
      await Promise.all(
        itemsToUpdate.map((item) =>
          setSidebarItemShareStatus.mutateAsync({
            campaignId: campaign._id,
            sidebarItemId: item._id,
            status: newStatus,
          }),
        ),
      )

      if (newStatus === SHARE_STATUS.ALL_SHARED) {
        if (playerMembers.length === 0) {
          toast.success('Shared with all players')
        } else {
          toast.success(`Shared with ${playerMembers.length} player(s)`)
        }
      } else {
        toast.success('Unshared from all players')
      }
    } catch (error) {
      console.error(error)
      toast.error('Failed to toggle share')
    }
  }, [
    campaign?._id,
    isMutating,
    shareableItems,
    hasCompleteData,
    unsharedItems,
    setSidebarItemShareStatus,
    playerMembers.length,
  ])

  // Toggle share with a specific member for all items
  const toggleShareWithMember = useCallback(
    async (memberId: Id<'campaignMembers'>) => {
      if (
        !campaign?._id ||
        isMutating ||
        shareableItems.length === 0 ||
        !hasCompleteData
      )
        return

      try {
        const currentState = getShareState(memberId)

        if (currentState === 'all') {
          // Unshare from all items
          await Promise.all(
            shareableItems.map((item) =>
              unshareSidebarItem.mutateAsync({
                campaignId: campaign._id,
                sidebarItemId: item._id,
                campaignMemberId: memberId,
              }),
            ),
          )
          toast.success('Unshared from player')
        } else {
          // Share items that aren't already shared with this member
          const itemsToShare = shareableItems.filter((item) => {
            const info = itemShareInfoMap.get(item._id)
            const status = info?.shareStatus ?? SHARE_STATUS.NOT_SHARED
            return (
              status === SHARE_STATUS.NOT_SHARED ||
              (status === SHARE_STATUS.INDIVIDUALLY_SHARED &&
                !info?.sharedMemberIds.has(memberId))
            )
          })

          if (itemsToShare.length === 0) return

          await Promise.all(
            itemsToShare.map((item) =>
              shareSidebarItem.mutateAsync({
                campaignId: campaign._id,
                sidebarItemId: item._id,
                sidebarItemType: item.type,
                campaignMemberId: memberId,
              }),
            ),
          )
          toast.success('Shared with player')
        }
      } catch (error) {
        console.error(error)
        toast.error('Failed to toggle share')
      }
    },
    [
      campaign?._id,
      isMutating,
      shareableItems,
      hasCompleteData,
      getShareState,
      itemShareInfoMap,
      unshareSidebarItem,
      shareSidebarItem,
    ],
  )

  const shareItems: Array<ShareItem> = useMemo(
    () =>
      playerMembers.map((member) => ({
        key: `share-${member._id}`,
        member,
        shareState: getShareState(member._id),
      })),
    [playerMembers, getShareState],
  )

  // Check if sharing is available (not a folder, is DM)
  const canShare = isDm && shareableItems.length > 0

  // Check if all selected items are folders (can't share)
  const allFolders = items.length > 0 && items.every((item) => isFolder(item))

  return {
    query,
    isPending: query.isPending,
    isMutating,
    aggregateShareStatus,
    shareableItems,
    hasUnsharableItems: items.length > shareableItems.length,
    playerMembers,
    shareItems,
    toggleShareStatus,
    toggleShareWithMember,
    canShare,
    allFolders,
  }
}
