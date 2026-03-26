import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemLocation } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useMoveSidebarItem() {
  const validation = useSidebarValidation()
  const { campaignId, campaign } = useCampaign()
  const cache = useSidebarItemsCache()

  const moveSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.moveSidebarItem,
    { errorMessage: 'Failed to move item' },
  )

  const moveItem = async (
    item: AnySidebarItem,
    options: {
      parentId?: Id<'folders'> | null
      location?: SidebarItemLocation
    },
  ) => {
    if (!campaignId || !campaign.data?.myMembership) return
    const { parentId, location } = options
    const isTrashing =
      location === SIDEBAR_ITEM_LOCATION.trash &&
      item.location !== SIDEBAR_ITEM_LOCATION.trash
    const isRestoring =
      location !== undefined &&
      location !== SIDEBAR_ITEM_LOCATION.trash &&
      item.location === SIDEBAR_ITEM_LOCATION.trash

    if (parentId !== undefined && !isTrashing) {
      if (!validation.canMoveToParent(item._id, parentId)) {
        throw new Error('Cannot move item: circular reference detected')
      }
      if (!isRestoring) {
        const nameResult = validation.validateName(
          item.name,
          parentId,
          item._id,
        )
        if (!nameResult.valid) throw new Error(nameResult.error)
      }
    }

    const previousSidebar = cache.get(SIDEBAR_ITEM_LOCATION.sidebar)
    const previousTrash = cache.get(SIDEBAR_ITEM_LOCATION.trash)

    if (isRestoring) {
      const descendantIds = isFolder(item)
        ? collectDescendantIds(item._id, previousTrash)
        : new Set()

      const trashedDescendants = previousTrash.filter((i) =>
        descendantIds.has(i._id),
      )

      cache.update(SIDEBAR_ITEM_LOCATION.trash, (prev) =>
        prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
      )
      cache.update(SIDEBAR_ITEM_LOCATION.sidebar, (prev) => [
        ...prev,
        {
          ...item,
          parentId: parentId ?? item.parentId ?? null,
          location: location,
          deletionTime: undefined,
          deletedBy: undefined,
        },
        ...trashedDescendants.map((i) => ({
          ...i,
          location: location,
          deletionTime: undefined,
          deletedBy: undefined,
        })),
      ])
    } else if (isTrashing) {
      const deletedBy = campaign.data.myMembership.userId
      const now = Date.now()

      const descendantIds = isFolder(item)
        ? collectDescendantIds(item._id, previousSidebar)
        : new Set()

      const descendants = previousSidebar.filter((i) =>
        descendantIds.has(i._id),
      )

      cache.update(SIDEBAR_ITEM_LOCATION.sidebar, (prev) =>
        prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
      )
      cache.update(SIDEBAR_ITEM_LOCATION.trash, (prev) => [
        {
          ...item,
          parentId: null,
          location: SIDEBAR_ITEM_LOCATION.trash,
          deletionTime: now,
          deletedBy,
        },
        ...descendants.map((d) => ({
          ...d,
          location: SIDEBAR_ITEM_LOCATION.trash,
          deletionTime: now,
          deletedBy,
        })),
        ...prev,
      ])
    } else {
      const cacheLocation =
        item.location === SIDEBAR_ITEM_LOCATION.trash
          ? SIDEBAR_ITEM_LOCATION.trash
          : SIDEBAR_ITEM_LOCATION.sidebar
      cache.update(cacheLocation, (prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, parentId: parentId ?? null } : i,
        ),
      )
    }

    try {
      await moveSidebarItemMutation.mutateAsync({
        itemId: item._id,
        parentId,
        location,
      })
    } catch (err) {
      cache.update(SIDEBAR_ITEM_LOCATION.sidebar, () => previousSidebar)
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => previousTrash)
      throw err
    }
  }

  return { moveItem }
}
