import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
  type SidebarItemOrRootType,
  type SidebarItemType,
} from 'convex/sidebarItems/types'

interface DragItem {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentId?: Id<'notes'>
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'notes'>[]
}

interface DropTarget {
  id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'notes'>[]
}

//TODO: visually show that you can drop onto the existing parent, but don't actually do anything in this case
export function validateDrop(
  draggedItem: DragItem | null,
  targetData: DropTarget | null,
  rootType: typeof SIDEBAR_ROOT_TYPE,
): boolean {
  if (!draggedItem || !targetData) return false
  if (targetData.id === draggedItem._id) return false

  // Category validation: items cannot be dragged outside their category
  // If target has a categoryId, dragged item must have the same categoryId
  if (targetData.categoryId) {
    if (
      !draggedItem.categoryId ||
      draggedItem.categoryId !== targetData.categoryId
    ) {
      return false
    }
  }

  // If dragged item has a categoryId but target doesn't, prevent the drag
  // (category items should stay within their category context)
  if (draggedItem.categoryId && !targetData.categoryId) {
    return false
  }

  // Prevent dropping on same parent
  if (targetData.type === rootType && !draggedItem.parentId) return false
  if (targetData.type !== rootType && draggedItem.parentId === targetData.id) {
    return false
  }

  // Notes cannot be dropped on their own children (when acting as folders)
  if (
    draggedItem.type === SIDEBAR_ITEM_TYPES.notes &&
    targetData.ancestorIds?.includes(draggedItem._id as Id<'notes'>)
  ) {
    return false
  }

  // Can only drop on root or notes (which act as folders)
  return (
    targetData.type === rootType || targetData.type === SIDEBAR_ITEM_TYPES.notes
  )
}

interface MoveMutations {
  moveNote: (params: {
    noteId: Id<'notes'>
    parentId?: Id<'notes'>
  }) => Promise<any>
  moveMap: (params: {
    mapId: Id<'gameMaps'>
    parentId?: Id<'notes'>
  }) => Promise<any>
}

export async function executeMove(
  itemType: SidebarItemType,
  itemId: Id<SidebarItemType>,
  targetId: Id<'notes'> | undefined,
  mutations: MoveMutations,
  callbacks?: {
    openFolder?: (folderId: Id<'notes'>) => void
  },
): Promise<void> {
  switch (itemType) {
    case SIDEBAR_ITEM_TYPES.notes:
      await mutations.moveNote({
        noteId: itemId as Id<'notes'>,
        parentId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      await mutations.moveMap({
        mapId: itemId as Id<'gameMaps'>,
        parentId: targetId,
      })
      break
    default:
      throw new Error(`Invalid item type: ${itemType}`)
  }
  if (targetId && callbacks?.openFolder) {
    callbacks.openFolder(targetId)
  }
}
