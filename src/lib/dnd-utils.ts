import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
} from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { assertNever } from '~/lib/utils'

export const EMPTY_EDITOR_DROP_TYPE = 'empty-editor' as const
export const OPEN_ACTION = 'open' as const
export const MAP_DROP_ZONE_TYPE = 'map-drop-zone' as const
export const TRASH_DROP_ZONE_TYPE = 'trash-drop-zone' as const

export type SidebarDragData = {
  sidebarItemId: SidebarItemId
}

export type SidebarItemDropData = {
  type: AnySidebarItem['type']
  sidebarItemId: SidebarItemId
}

export type ResolvedSidebarItemDropData = AnySidebarItem & {
  ancestorIds?: Array<Id<'folders'>>
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
  | ResolvedSidebarItemDropData
  | SidebarRootDropZoneData
  | EmptyEditorDropZoneData
  | MapDropZoneData
  | TrashDropZoneData

export type DragDropAction =
  | 'move'
  | 'trash'
  | 'restore'
  | 'pin'
  | 'open'
  | null

/**
 * Computes the semantic action for a drag-drop operation.
 * Single source of truth used for overlay text, highlighting, and drop handling.
 */
export function getDragDropAction(
  draggedItem: AnySidebarItem | null,
  targetData: SidebarDropData | null,
): DragDropAction {
  if (!draggedItem || !targetData) return null

  const isTrashedItem = !!draggedItem.deletionTime

  switch (targetData.type) {
    case TRASH_DROP_ZONE_TYPE:
      return 'trash'
    case MAP_DROP_ZONE_TYPE:
      return 'pin'
    case EMPTY_EDITOR_DROP_TYPE:
      return 'open'
    case SIDEBAR_ROOT_TYPE:
      return isTrashedItem ? 'restore' : 'move'
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files: {
      const isTargetTrashed = !!targetData.deletionTime
      if (isTrashedItem && !isTargetTrashed) return 'restore'
      return 'move'
    }
    default:
      return assertNever(targetData)
  }
}

export type DropRejectionReason =
  | 'self_pin'
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'cannot_move_trash'

export function rejectionReasonMessage(reason: DropRejectionReason): string {
  switch (reason) {
    case 'no_permission':
      return 'No permission to move here'
    case 'circular':
      return 'Cannot move folder into itself'
    case 'self_pin':
      return 'Cannot pin map to itself'
    case 'not_folder':
      return 'Cannot drop here'
    case 'missing_data':
      return 'Missing data'
    case 'trashed_folder':
      return 'Trashed folders are uneditable'
    case 'cannot_move_trash':
      return 'Cannot move items within trash'
    default:
      return assertNever(reason)
  }
}

export type DropValidationResult =
  | { valid: true }
  | { valid: false; reason: DropRejectionReason }

/**
 * Validates if a drag item can be dropped on a target.
 * Returns a result with a specific rejection reason when invalid.
 */
export function validateDrop(
  draggedItem: AnySidebarItem | null,
  targetData: SidebarDropData | null,
): DropValidationResult {
  if (!draggedItem || !targetData) {
    return { valid: false, reason: 'missing_data' }
  }

  switch (targetData.type) {
    case TRASH_DROP_ZONE_TYPE:
      if (draggedItem.deletionTime) {
        return { valid: false, reason: 'cannot_move_trash' }
      }
      return { valid: true }

    case MAP_DROP_ZONE_TYPE:
      if (
        draggedItem.type === SIDEBAR_ITEM_TYPES.gameMaps &&
        draggedItem._id === targetData.mapId
      ) {
        return { valid: false, reason: 'self_pin' }
      }
      return { valid: true }

    case SIDEBAR_ROOT_TYPE:
    case EMPTY_EDITOR_DROP_TYPE:
      return { valid: true }

    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files:
      return { valid: false, reason: 'not_folder' }

    case SIDEBAR_ITEM_TYPES.folders: {
      // Trashed folders cannot receive any drops
      if (targetData.deletionTime) {
        return { valid: false, reason: 'trashed_folder' }
      }

      // Item dropped on itself is allowed (no-op, won't change position)
      if (targetData._id === draggedItem._id) {
        return { valid: true }
      }

      // Folders cannot be dropped on their own children
      if (
        draggedItem.type === SIDEBAR_ITEM_TYPES.folders &&
        targetData.ancestorIds?.includes(draggedItem._id)
      ) {
        return { valid: false, reason: 'circular' }
      }

      // Only allow drop if user explicitly has full_access on the target folder
      if (targetData.myPermissionLevel !== PERMISSION_LEVEL.FULL_ACCESS) {
        return { valid: false, reason: 'no_permission' }
      }

      return { valid: true }
    }

    default:
      return assertNever(targetData)
  }
}

/**
 * Checks if dropping an item would have any effect (move, open, pin, etc.).
 * Returns false for no-op drops where the item is already in the target location.
 */
export function wouldDropHaveEffect(
  draggedItem: AnySidebarItem | null,
  targetData: SidebarDropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  switch (targetData.type) {
    // Map drop zones always result in a change (pinning)
    case MAP_DROP_ZONE_TYPE:
      return true
    // Empty editor drops open the item in the editor — always an effect
    case EMPTY_EDITOR_DROP_TYPE:
      return true
    // Moving to root - check if already at root
    case SIDEBAR_ROOT_TYPE:
      if (draggedItem.deletionTime) return true
      return draggedItem.parentId != null
    // Moving to trash root: always an effect for non-trashed items; for
    // already-trashed items, only an effect if nested (moves to trash root)
    case TRASH_DROP_ZONE_TYPE:
      return !draggedItem.deletionTime || draggedItem.parentId != null
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files: {
      // Dropping on itself is a no-op
      if (draggedItem._id === targetData._id) return false
      // Cross-trash boundary always changes state (restore or trash)
      if (!!draggedItem.deletionTime !== !!targetData.deletionTime) return true
      // Moving to a folder - check if already parented to this target (only relevant for dragged folders)
      return draggedItem.parentId !== targetData._id
    }
    default:
      return assertNever(targetData)
  }
}

/**
 * Returns a human-readable label for the drag overlay.
 * Combines the action and target name into a single string.
 */
export function getDropLabel(
  action: DragDropAction,
  targetData: SidebarDropData,
  campaignName?: string,
): string | null {
  switch (targetData.type) {
    case EMPTY_EDITOR_DROP_TYPE:
      return 'Open in editor'
    case TRASH_DROP_ZONE_TYPE:
      return 'Move to "Trash"'
    case MAP_DROP_ZONE_TYPE:
      return `Pin to "${targetData.mapName}"`
    case SIDEBAR_ROOT_TYPE: {
      const name = campaignName || 'Root'
      return `${getActionVerb(action)} "${name}"`
    }
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.folders:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files:
      return `${getActionVerb(action)} "${targetData.name}"`
    default:
      return assertNever(targetData)
  }
}

function getActionVerb(action: DragDropAction): string {
  switch (action) {
    case 'restore':
      return 'Restore to'
    case 'pin':
      return 'Pin to'
    case 'open':
      return 'Open in'
    case 'move':
    case 'trash':
    case null:
      return 'Move to'
    default:
      return assertNever(action)
  }
}

/**
 * Validates if external files can be dropped on a target item.
 */
export function canDropFilesOnTarget(
  targetData: SidebarDropData | null,
): boolean {
  if (!targetData) return false

  switch (targetData.type) {
    case SIDEBAR_ROOT_TYPE:
    case EMPTY_EDITOR_DROP_TYPE:
      return true
    case MAP_DROP_ZONE_TYPE:
    case TRASH_DROP_ZONE_TYPE:
      return false
    case SIDEBAR_ITEM_TYPES.folders:
      return !targetData.deletionTime
    case SIDEBAR_ITEM_TYPES.notes:
    case SIDEBAR_ITEM_TYPES.gameMaps:
    case SIDEBAR_ITEM_TYPES.files:
      return false
    default:
      return assertNever(targetData)
  }
}
