import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
  type SidebarItemOrRootType,
  type SidebarItemType,
} from 'convex/notes/types'

interface DragItem {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentFolderId?: Id<'folders'>
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'folders'>[]
}

interface DropTarget {
  id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'folders'>[]
}

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
  if (targetData.type === rootType && !draggedItem.parentFolderId) return false
  if (
    targetData.type !== rootType &&
    draggedItem.parentFolderId === targetData.id
  ) {
    return false
  }

  // Folders cannot be dropped on their own children
  if (
    draggedItem.type === SIDEBAR_ITEM_TYPES.folders &&
    targetData.ancestorIds?.includes(draggedItem._id as Id<'folders'>)
  ) {
    return false
  }

  // Can only drop on root or folders
  return (
    targetData.type === rootType ||
    targetData.type === SIDEBAR_ITEM_TYPES.folders
  )
}

interface MoveMutations {
  moveNote: (params: {
    noteId: Id<'notes'>
    parentFolderId?: Id<'folders'>
  }) => Promise<any>
  moveFolder: (params: {
    folderId: Id<'folders'>
    parentId?: Id<'folders'>
  }) => Promise<any>
  moveMap: (params: {
    mapId: Id<'maps'>
    parentFolderId?: Id<'folders'>
  }) => Promise<any>
}

export async function executeMove(
  itemType: SidebarItemType,
  itemId: Id<SidebarItemType>,
  targetId: Id<'folders'> | undefined,
  mutations: MoveMutations,
  callbacks?: {
    openFolder?: (folderId: Id<'folders'>) => void
  },
): Promise<void> {
  switch (itemType) {
    case SIDEBAR_ITEM_TYPES.notes:
      await mutations.moveNote({
        noteId: itemId as Id<'notes'>,
        parentFolderId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.folders:
      await mutations.moveFolder({
        folderId: itemId as Id<'folders'>,
        parentId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.maps:
      await mutations.moveMap({
        mapId: itemId as Id<'maps'>,
        parentFolderId: targetId,
      })
      break
    default:
      throw new Error(`Invalid item type: ${itemType}`)
  }
  if (targetId && callbacks?.openFolder) {
    callbacks.openFolder(targetId)
  }
}
