import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { createFileSystemReadModel } from 'convex/sidebarItems/filesystem/readModel'
import { useMemo } from 'react'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'

export function useFileSystemReadModel() {
  const active = useActiveSidebarItems()
  const trash = useTrashSidebarItems()
  const allItems = useMemo(() => [...active.data, ...trash.data], [active.data, trash.data])
  const allItemsById = useMemo(() => {
    const itemsById = new Map<Id<'sidebarItems'>, AnySidebarItem>(active.itemsMap)
    for (const [itemId, item] of trash.itemsMap) {
      if (itemsById.has(itemId)) {
        throw new Error(`Sidebar item ${itemId} is present in both active and trash queries`)
      }
      itemsById.set(itemId, item)
    }
    return itemsById
  }, [active.itemsMap, trash.itemsMap])
  const readModel = useMemo(() => createFileSystemReadModel(allItems), [allItems])

  return {
    activeItems: active.data,
    trashItems: trash.data,
    activeItemsById: active.itemsMap,
    trashedItemsById: trash.itemsMap,
    allItems,
    allItemsById,
    readModel,
    getActiveAncestorIds: (itemId: Id<'sidebarItems'>) =>
      active.getAncestorSidebarItems(itemId).map((item) => item._id),
  }
}
