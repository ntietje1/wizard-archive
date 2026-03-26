import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useDeleteSidebarItem() {
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()

  const permanentlyDeleteSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
    { errorMessage: 'Failed to delete item' },
  )
  const emptyTrashBinMutation = useAppMutation(
    api.sidebarItems.mutations.emptyTrashBin,
    { errorMessage: 'Failed to empty trash' },
  )

  const trashedOptimisticUpdate = (
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    if (!campaignId) return
    queryClient.setQueryData<Array<AnySidebarItem>>(
      convexQuery(api.sidebarItems.queries.getTrashedSidebarItems, {
        campaignId,
      }).queryKey,
      (prev) => (prev ? updater(prev) : prev),
    )
  }

  const permanentlyDeleteItem = async (item: AnySidebarItem) => {
    if (!campaignId) return

    const trashedItems =
      queryClient.getQueryData<Array<AnySidebarItem>>(
        convexQuery(api.sidebarItems.queries.getTrashedSidebarItems, {
          campaignId,
        }).queryKey,
      ) ?? []

    const removedIds = new Set<SidebarItemId>([item._id])
    if (isFolder(item)) {
      const collectDescendants = (folderId: Id<'folders'>) => {
        for (const child of trashedItems) {
          if (child.parentId === folderId && !removedIds.has(child._id)) {
            removedIds.add(child._id)
            if (isFolder(child)) collectDescendants(child._id)
          }
        }
      }
      collectDescendants(item._id)
    }

    const removedItems = trashedItems.filter((i) => removedIds.has(i._id))
    trashedOptimisticUpdate((prev) =>
      prev.filter((i) => !removedIds.has(i._id)),
    )

    try {
      await permanentlyDeleteSidebarItemMutation.mutateAsync({
        itemId: item._id,
      })
    } catch (err) {
      trashedOptimisticUpdate((prev) => [...prev, ...removedItems])
      throw err
    }
  }

  const emptyTrashBin = async () => {
    if (!campaignId) return

    const previousItems = queryClient.getQueryData<Array<AnySidebarItem>>(
      convexQuery(api.sidebarItems.queries.getTrashedSidebarItems, {
        campaignId,
      }).queryKey,
    )

    trashedOptimisticUpdate(() => [])

    try {
      await emptyTrashBinMutation.mutateAsync({ campaignId })
    } catch (err) {
      if (previousItems) {
        trashedOptimisticUpdate(() => previousItems)
      }
      throw err
    }
  }

  return { permanentlyDeleteItem, emptyTrashBin }
}
