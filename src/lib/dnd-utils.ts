import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type {
  SidebarItem,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'

export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const

export interface SidebarDragData extends SidebarItem<SidebarItemType> {
  [key: string | symbol]: unknown
  ancestorIds?: Array<Id<'folders'>>
  deletionTime?: number
}

export interface MapDropZoneData {
  [key: string | symbol]: unknown
  type: typeof MAP_DROP_ZONE_TYPE
  mapId: Id<'gameMaps'>
  mapName: string
}

export interface SidebarRootDropZoneData {
  [key: string | symbol]: unknown
  type: typeof SIDEBAR_ROOT_TYPE
}

export interface EmptyEditorDropZoneData {
  [key: string | symbol]: unknown
  type: typeof EMPTY_EDITOR_DROP_TYPE
}

export interface TrashDropZoneData {
  [key: string | symbol]: unknown
  type: typeof TRASH_DROP_ZONE_TYPE
}

export type SidebarDropData =
  | SidebarDragData
  | SidebarRootDropZoneData
  | EmptyEditorDropZoneData
  | MapDropZoneData
  | TrashDropZoneData

// Type predicates for narrowing drop data types
export function isSidebarItem(data: SidebarDropData): data is SidebarDragData {
  return (
    !isSidebarRootDropZone(data) &&
    !isEmptyEditorDropZone(data) &&
    !isMapDropZone(data) &&
    !isTrashDropZone(data) &&
    data.type in SIDEBAR_ITEM_TYPES
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

export function isTrashDropZone(
  data: SidebarDropData,
): data is TrashDropZoneData {
  return data.type === TRASH_DROP_ZONE_TYPE
}

export function isSidebarRootDropZone(
  data: SidebarDropData,
): data is SidebarRootDropZoneData {
  return data.type === SIDEBAR_ROOT_TYPE
}

export type DragDropAction =
  | 'move'
  | 'trash'
  | 'move-and-trash'
  | 'restore'
  | 'pin'
  | null

/**
 * Computes the semantic action for a drag-drop operation.
 * Single source of truth used for overlay text, highlighting, and drop handling.
 */
export function getDragDropAction(
  draggedItem: SidebarDragData | null,
  targetData: SidebarDropData | null,
): DragDropAction {
  if (!draggedItem || !targetData) return null

  const isTrashedItem = !!draggedItem.deletionTime

  if (isTrashDropZone(targetData)) {
    return isTrashedItem ? 'move' : 'trash'
  }

  if (isMapDropZone(targetData)) {
    return 'pin'
  }

  if (isEmptyEditorDropZone(targetData)) {
    return null
  }

  if (isSidebarRootDropZone(targetData)) {
    return isTrashedItem ? 'restore' : 'move'
  }

  if (isSidebarItem(targetData)) {
    const isTargetTrashed = !!targetData.deletionTime
    if (isTrashedItem && !isTargetTrashed) return 'restore'
    if (!isTrashedItem && isTargetTrashed) return 'move-and-trash'
    return 'move'
  }

  return null
}

export type DropRejectionReason =
  | 'self_pin'
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'

export type DropValidationResult =
  | { valid: true }
  | { valid: false; reason: DropRejectionReason }

/**
 * Validates if a drag item can be dropped on a target.
 * Returns a result with a specific rejection reason when invalid.
 */
export function validateDrop(
  draggedItem: SidebarDragData | null,
  targetData: SidebarDropData | null,
): DropValidationResult {
  if (!draggedItem || !targetData) {
    return { valid: false, reason: 'missing_data' }
  }

  // Handle trash drop zone
  else if (isTrashDropZone(targetData)) {
    return { valid: true }
  }

  // Handle map drop zone - allow pinning items to map
  else if (isMapDropZone(targetData)) {
    if (
      draggedItem.type === SIDEBAR_ITEM_TYPES.gameMaps &&
      draggedItem._id === targetData.mapId
    ) {
      return { valid: false, reason: 'self_pin' }
    }
    return { valid: true }
  }

  // Handle root or empty editor drops
  else if (
    isSidebarRootDropZone(targetData) ||
    isEmptyEditorDropZone(targetData)
  ) {
    return { valid: true }
  } else if (isSidebarItem(targetData)) {
    // Only folders accept item drops
    if (targetData.type !== SIDEBAR_ITEM_TYPES.folders) {
      return { valid: false, reason: 'not_folder' }
    }

    // Item dropped on itself is allowed (no-op, won't change position)
    if (targetData._id === draggedItem._id) {
      return { valid: true }
    }

    // Folders cannot be dropped on their own children
    if (
      draggedItem.type === SIDEBAR_ITEM_TYPES.folders &&
      targetData.ancestorIds?.includes(draggedItem._id as Id<'folders'>)
    ) {
      return { valid: false, reason: 'circular' }
    }

    // Check permission on target folder (for moving items into it)
    // Only allow drop if user explicitly has full_access on the target folder
    if (targetData.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS) {
      return { valid: false, reason: 'no_permission' }
    }

    return { valid: true }
  } else {
    console.error('Invalid target data type:', targetData)
    return { valid: false, reason: 'not_folder' }
  }
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

  // Trash drop zones: trashing a non-trashed item always changes, moving
  // an already-trashed item to trash root only changes if it has a parent
  else if (isTrashDropZone(targetData)) {
    return draggedItem.deletionTime ? draggedItem.parentId != null : true
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
    // Restoring a trashed item always changes state
    if (draggedItem.deletionTime) return true
    return draggedItem.parentId != null
  } else if (isSidebarItem(targetData)) {
    // Dropping on itself is a no-op
    if (draggedItem._id === targetData._id) return false
    // Cross-trash boundary always changes state (restore or trash)
    if (!!draggedItem.deletionTime !== !!targetData.deletionTime) return true
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
  } else if (isTrashDropZone(targetData)) {
    return false
  } else if (isSidebarItem(targetData)) {
    return (
      targetData.type === SIDEBAR_ITEM_TYPES.folders && !targetData.deletionTime
    )
  } else {
    console.error('Invalid target data type:', targetData)
    return false
  }
}
