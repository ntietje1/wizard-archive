import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useDeleteSidebarItem() {
  const { campaignId } = useCampaign()
  const cache = useSidebarItemsCache()

  const permanentlyDeleteSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
    { errorMessage: 'Failed to delete item' },
  )
  const emptyTrashBinMutation = useAppMutation(
    api.sidebarItems.mutations.emptyTrashBin,
    { errorMessage: 'Failed to empty trash' },
  )

  const permanentlyDeleteItem = async (item: AnySidebarItem) => {
    if (!campaignId) return

    const previousTrash = cache.get(SIDEBAR_ITEM_LOCATION.trash)
    const removedIds = isFolder(item)
      ? collectDescendantIds(item._id, previousTrash)
      : new Set()
    removedIds.add(item._id)

    cache.update(SIDEBAR_ITEM_LOCATION.trash, (prev) =>
      prev.filter((i) => !removedIds.has(i._id)),
    )

    try {
      await permanentlyDeleteSidebarItemMutation.mutateAsync({
        itemId: item._id,
      })
    } catch (err) {
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => previousTrash)
      throw err
    }
  }

  const emptyTrashBin = async () => {
    if (!campaignId) return

    const previousItems = cache.get(SIDEBAR_ITEM_LOCATION.trash)
    cache.update(SIDEBAR_ITEM_LOCATION.trash, () => [])

    try {
      await emptyTrashBinMutation.mutateAsync({ campaignId })
    } catch (err) {
      cache.update(SIDEBAR_ITEM_LOCATION.trash, () => previousItems)
      throw err
    }
  }

  return { permanentlyDeleteItem, emptyTrashBin }
}
