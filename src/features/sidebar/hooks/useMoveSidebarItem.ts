import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useMoveSidebarItem() {
  const validation = useSidebarValidation()
  const { parentItemsMap } = useAllSidebarItems()
  const { campaignId, campaign } = useCampaign()
  const queryClient = useQueryClient()

  const moveSidebarItemMutation = useAppMutation(
    api.sidebarItems.mutations.moveSidebarItem,
    { errorMessage: 'Failed to move item' },
  )
  const optimisticUpdate = (
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    if (!campaignId) return
    queryClient.setQueryData<Array<AnySidebarItem>>(
      convexQuery(api.sidebarItems.queries.getAllSidebarItems, {
        campaignId,
      }).queryKey,
      (prev) => (prev ? updater(prev) : prev),
    )
  }

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

  const moveItem = async (
    item: AnySidebarItem,
    options: { parentId?: Id<'folders'> | null; deleted?: boolean },
  ) => {
    if (!campaignId || !campaign.data?.myMembership) return
    const { parentId, deleted } = options
    const isTrashing = deleted === true && !item.deletionTime
    const isRestoring = deleted === false && !!item.deletionTime

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

    let undo: () => void = () => {}

    if (isRestoring) {
      const descendantIds = new Set<SidebarItemId>()
      const trashedItems =
        queryClient.getQueryData<Array<AnySidebarItem>>(
          convexQuery(api.sidebarItems.queries.getTrashedSidebarItems, {
            campaignId,
          }).queryKey,
        ) ?? []
      if (isFolder(item)) {
        const collectDescendants = (folderId: Id<'folders'>) => {
          for (const child of trashedItems) {
            if (child.parentId === folderId && !descendantIds.has(child._id)) {
              descendantIds.add(child._id)
              if (isFolder(child)) collectDescendants(child._id)
            }
          }
        }
        collectDescendants(item._id)
      }

      const trashedDescendants = trashedItems.filter((i) =>
        descendantIds.has(i._id),
      )

      trashedOptimisticUpdate((prev) =>
        prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
      )
      optimisticUpdate((prev) => [
        ...prev,
        {
          ...item,
          parentId: parentId ?? item.parentId ?? null,
          deletionTime: undefined,
          deletedBy: undefined,
        },
        ...trashedDescendants.map((i) => ({
          ...i,
          deletionTime: undefined,
          deletedBy: undefined,
        })),
      ])
      undo = () => {
        optimisticUpdate((prev) =>
          prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
        )
        trashedOptimisticUpdate((prev) => [
          ...prev,
          item,
          ...trashedDescendants,
        ])
      }
    } else if (isTrashing) {
      const deletedBy = campaign.data.myMembership.userId
      const now = Date.now()

      const descendants: Array<AnySidebarItem> = []
      const visited = new Set<SidebarItemId>()
      if (isFolder(item)) {
        const collectDescendants = (folderId: Id<'folders'>) => {
          const folderChildren = parentItemsMap.get(folderId) ?? []
          for (const child of folderChildren) {
            if (!visited.has(child._id)) {
              visited.add(child._id)
              descendants.push(child)
              if (isFolder(child)) collectDescendants(child._id)
            }
          }
        }
        collectDescendants(item._id)
      }

      const descendantIds = new Set(descendants.map((d) => d._id))

      optimisticUpdate((prev) =>
        prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
      )
      trashedOptimisticUpdate((prev) => [
        {
          ...item,
          parentId: parentId ?? item.parentId ?? null,
          deletionTime: now,
          deletedBy,
        },
        ...descendants.map((d) => ({
          ...d,
          deletionTime: now,
          deletedBy,
        })),
        ...prev,
      ])
      undo = () => {
        trashedOptimisticUpdate((prev) =>
          prev.filter((i) => i._id !== item._id && !descendantIds.has(i._id)),
        )
        optimisticUpdate((prev) => [...prev, item, ...descendants])
      }
    } else {
      const previousParentId = item.parentId
      const targetUpdate = item.deletionTime
        ? trashedOptimisticUpdate
        : optimisticUpdate
      targetUpdate((prev) =>
        prev.map((i) =>
          i._id === item._id ? { ...i, parentId: parentId ?? null } : i,
        ),
      )
      undo = () => {
        targetUpdate((prev) =>
          prev.map((i) =>
            i._id === item._id ? { ...i, parentId: previousParentId } : i,
          ),
        )
      }
    }

    try {
      await moveSidebarItemMutation.mutateAsync({
        itemId: item._id,
        parentId,
        deleted,
      })
    } catch (err) {
      undo()
      throw err
    }
  }

  return { moveItem }
}
