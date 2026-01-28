import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/baseTypes'
import type {
  SidebarItem,
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/baseTypes'
import {} from 'convex/sidebarItems/sidebarItems'
import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'

export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const

export interface SidebarDragData extends SidebarItem<SidebarItemType> {
  ancestorIds?: Array<Id<'folders'>>
}

export interface MapDropZoneData {
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: Id<'gameMaps'>
  mapName: string
}

export interface SidebarRootDropZoneData {
  type: typeof SIDEBAR_ROOT_TYPE
}

export interface EmptyEditorDropZoneData {
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export type SidebarDropData =
  | SidebarDragData
  | SidebarRootDropZoneData
  | EmptyEditorDropZoneData
  | MapDropZoneData

// Type predicates for narrowing drop data types
export function isSidebarItem(data: SidebarDropData): data is SidebarDragData {
  return (
    !isSidebarRootDropZone(data) &&
    !isEmptyEditorDropZone(data) &&
    !isMapDropZone(data)
  )
}

export function isMapDropZone(data: SidebarDropData): data is MapDropZoneData {
  return data.type === MAP_DROP_ZONE_TYPE
}

export function isEmptyEditorDropZone(
  data: SidebarDropData,
): data is EmptyEditorDropZoneData {
  return data.type === EMPTY_EDITOR_DROP_TYPE
}

export function isSidebarRootDropZone(
  data: SidebarDropData,
): data is SidebarRootDropZoneData {
  return data.type === SIDEBAR_ROOT_TYPE
}

/**
 * Validates if a drag item can be dropped on a target.
 */
export function validateDrop(
  draggedItem: SidebarDragData | null,
  targetData: SidebarDropData | null,
): boolean {
  if (!draggedItem || !targetData) {
    return false
  }

  // Handle map drop zone - allow pinning items to map
  else if (isMapDropZone(targetData)) {
    // A map cannot be dropped onto itself (pinned to itself)
    if (
      draggedItem.type === SIDEBAR_ITEM_TYPES.gameMaps &&
      draggedItem._id === targetData.mapId
    ) {
      return false
    }
    return true
  }

  // Handle root or empty editor drops
  else if (
    isSidebarRootDropZone(targetData) ||
    isEmptyEditorDropZone(targetData)
  ) {
    return true
  } else if (isSidebarItem(targetData)) {
    // Only folders accept item drops
    if (targetData.type !== SIDEBAR_ITEM_TYPES.folders) {
      return false
    }

    // Item cannot be dropped on itself
    if (targetData._id === draggedItem._id) return false

    // Folders cannot be dropped on their own children
    if (
      draggedItem.type === SIDEBAR_ITEM_TYPES.folders &&
      targetData.ancestorIds?.includes(draggedItem._id as Id<'folders'>)
    ) {
      return false
    }

    return true
  } else {
    console.error('Invalid target data type:', targetData)
    return false
  }
}

export function canDropItem(active: Active | null, over: Over | null): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as SidebarDragData | undefined
  const targetData = over.data.current as SidebarDropData | undefined

  if (!draggedItem || !targetData) return false

  return validateDrop(draggedItem, targetData)
}

/**
 * Checks if dropping an item would actually change its position.
 * Returns false if the item is already in the target location.
 */
export function wouldMoveChangePosition(
  draggedItem: SidebarDragData | null,
  targetData: SidebarDropData | null,
): boolean {
  if (!draggedItem || !targetData) {
    return false
  }

  // Map drop zones always result in a change (pinning)
  else if (isMapDropZone(targetData)) {
    return true
  }

  // Empty editor drops don't move, they open
  else if (isEmptyEditorDropZone(targetData)) {
    return false
  }

  // Moving to root - check if already at root
  else if (isSidebarRootDropZone(targetData)) {
    return draggedItem.parentId !== undefined
  } else if (isSidebarItem(targetData)) {
    // Moving to a folder - check if already in that folder
    return draggedItem.parentId !== targetData._id
  } else {
    console.error('Invalid target data type:', targetData)
    return false
  }
}

/**
 * Validates if external files can be dropped on a target item.
 */
export function canDropFilesOnTarget(
  targetData: SidebarDropData | null,
): boolean {
  if (!targetData) return false
  else if (
    isSidebarRootDropZone(targetData) ||
    isEmptyEditorDropZone(targetData)
  ) {
    return true
  } else if (isMapDropZone(targetData)) {
    return false
  } else if (isSidebarItem(targetData)) {
    return targetData.type === SIDEBAR_ITEM_TYPES.folders
  } else {
    console.error('Invalid target data type:', targetData)
    return false
  }
}

interface MoveMutations {
  moveNote: (params: {
    noteId: Id<'notes'>
    parentId?: Id<'folders'>
  }) => Promise<any>
  moveMap: (params: {
    mapId: Id<'gameMaps'>
    parentId?: Id<'folders'>
  }) => Promise<any>
  moveFolder: (params: {
    folderId: Id<'folders'>
    parentId?: Id<'folders'>
  }) => Promise<any>
  moveFile: (params: {
    fileId: Id<'files'>
    parentId?: Id<'folders'>
  }) => Promise<any>
}

export async function executeMove(
  itemType: SidebarItemType,
  itemId: SidebarItemId,
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
