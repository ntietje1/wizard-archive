import { api } from 'convex/_generated/api'
import { validateLocalSidebarMove } from 'convex/sidebarItems/validation/move'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemLocation } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useMoveSidebarItem() {
  const { itemsMap, parentItemsMap } = useActiveSidebarItems()
  const { campaignId, campaign } = useCampaign()
  const cache = useSidebarItemsCache()

  const moveSidebarItemMutation = useCampaignMutation(api.sidebarItems.mutations.moveSidebarItem)

  const moveItem = async (
    item: AnySidebarItem,
    options: {
      parentId?: Id<'sidebarItems'> | null
      location?: SidebarItemLocation
    },
  ) => {
    if (!campaignId || !campaign.data?.myMembership) return
    const { parentId, location } = options
    const isTrashing =
      location === SIDEBAR_ITEM_LOCATION.trash && item.location !== SIDEBAR_ITEM_LOCATION.trash
    const isRestoring =
      location !== undefined &&
      location !== SIDEBAR_ITEM_LOCATION.trash &&
      item.location === SIDEBAR_ITEM_LOCATION.trash

    const moveValidation = validateLocalSidebarMove(
      {
        itemId: item._id,
        name: item.name,
        parentId,
        isTrashing,
        isRestoring,
      },
      {
        getParent: (id) => itemsMap.get(id),
        getSiblings: (nextParentId) => parentItemsMap.get(nextParentId) ?? [],
      },
    )
    if (!moveValidation.valid) {
      throw new Error(moveValidation.error)
    }

    const previousSidebar = cache.get(SIDEBAR_ITEM_LOCATION.sidebar)
    const previousTrash = cache.get(SIDEBAR_ITEM_LOCATION.trash)

    if (isRestoring) {
      const descendantIds = isFolder(item)
        ? collectDescendantIds(item._id, previousTrash)
        : new Set()

      const trashedDescendants = previousTrash.filter((i) => descendantIds.has(i._id))

      cache.update(SIDEBAR_ITEM_LOCATION.trash, (prev) =>
        prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
      )
      cache.update(SIDEBAR_ITEM_LOCATION.sidebar, (prev) => [
        ...prev,
        {
          ...item,
          parentId: parentId ?? item.parentId ?? null,
          location: location,
          deletionTime: null,
          deletedBy: null,
        },
        ...trashedDescendants.map((i) => ({
          ...i,
          location: location,
          deletionTime: null,
          deletedBy: null,
        })),
      ])
    } else if (isTrashing) {
      const deletedBy = campaign.data.myMembership.userId
      const now = Date.now()

      const descendantIds = isFolder(item)
        ? collectDescendantIds(item._id, previousSidebar)
        : new Set()

      const descendants = previousSidebar.filter((i) => descendantIds.has(i._id))

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
        prev.map((i) => (i._id === item._id ? { ...i, parentId: parentId ?? null } : i)),
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
