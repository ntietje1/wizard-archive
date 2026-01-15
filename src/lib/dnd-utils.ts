import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types'
import { validSidebarChildren } from 'convex/sidebarItems/sidebarItems'
import type {
  SidebarItem,
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types'
import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'

export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const

export interface SidebarDragData extends SidebarItem<SidebarItemType> {
  ancestorIds?: Array<SidebarItemId>
}

export type SidebarDropData =
  | SidebarDragData
  | { type: typeof SIDEBAR_ROOT_TYPE }
  | { type: typeof EMPTY_EDITOR_DROP_TYPE }

// This type predicate will properly narrow the type to SidebarDragData when used
export function isSidebarItem(data: SidebarDropData): data is SidebarDragData {
  return data.type !== SIDEBAR_ROOT_TYPE && data.type !== EMPTY_EDITOR_DROP_TYPE
}

/**
 * Validates if a drag item can be dropped on a target.
 * Uses the validChildren map to match backend validation logic.
 */
export function validateDrop(
  draggedItem: SidebarDragData | null,
  targetData: SidebarDropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  // items cannot be dropped onto their current parent
  // if (
  //   targetData.type === SIDEBAR_ROOT_TYPE &&
  //   draggedItem.parentId === undefined
  // ) {
  //   return false
  // }
  if (!isSidebarItem(targetData)) return true
  if (targetData._id === draggedItem._id) return false

  // if (draggedItem.parentId === targetData._id) {
  //   return false
  // }

  // items cannot be dropped on their own children
  if (targetData.ancestorIds?.includes(draggedItem._id)) {
    return false
  }

  // check if the dragged item type is valid for the target type
  const validChildTypes = validSidebarChildren[targetData.type]
  if (!validChildTypes.includes(draggedItem.type)) {
    return false
  }

  return true
}

export function canDropItem(active: Active | null, over: Over | null): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as SidebarDragData | undefined
  const targetData = over.data.current as SidebarDropData | undefined

  if (!draggedItem || !targetData) return false

  return validateDrop(draggedItem, targetData)
}

/**
 * Validates if external files can be dropped on a target item.
 */
export function canDropFilesOnTarget(
  targetData: SidebarDropData | null,
): boolean {
  if (!targetData) return false
  if (!isSidebarItem(targetData)) return true

  // Check if target accepts files as children
  const validChildTypes = validSidebarChildren[targetData.type]
  if (!validChildTypes.includes(SIDEBAR_ITEM_TYPES.files)) {
    return false
  }

  return true
}

interface MoveMutations {
  moveNote: (params: {
    noteId: Id<'notes'>
    parentId?: SidebarItemId
  }) => Promise<any>
  moveMap: (params: {
    mapId: Id<'gameMaps'>
    parentId?: SidebarItemId
  }) => Promise<any>
  moveFolder: (params: {
    folderId: Id<'folders'>
    parentId?: SidebarItemId
  }) => Promise<any>
  moveFile: (params: {
    fileId: Id<'files'>
    parentId?: SidebarItemId
  }) => Promise<any>
}

export async function executeMove(
  itemType: SidebarItemType,
  itemId: SidebarItemId,
  targetId: SidebarItemId | undefined,
  mutations: MoveMutations,
  callbacks?: {
    openFolder?: (folderId: SidebarItemId) => void
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
    case SIDEBAR_ITEM_TYPES.folders:
      await mutations.moveFolder({
        folderId: itemId as Id<'folders'>,
        parentId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.files:
      await mutations.moveFile({
        fileId: itemId as Id<'files'>,
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
