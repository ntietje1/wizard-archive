import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE
  
  
  
} from 'convex/sidebarItems/types'
import { validSidebarChildren } from 'convex/sidebarItems/sidebarItems'
import type {SidebarItemId, SidebarItemOrRootType, SidebarItemType} from 'convex/sidebarItems/types';
import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'

// Sidebar-specific drag and drop data types
export interface SidebarDragData {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentId?: SidebarItemId
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Array<SidebarItemId>
  name: string
  icon: LucideIcon
}

export interface SidebarDropData {
  _id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Array<SidebarItemId>
  accepts?: Array<SidebarItemType>
}

// Internal interfaces for validation
interface DragItem {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentId?: SidebarItemId
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Array<SidebarItemId>
}

interface DropTarget {
  id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Array<SidebarItemId>
}

/**
 * Validates if a drag item can be dropped on a target.
 * Uses the validChildren map to match backend validation logic.
 */
export function validateDrop(
  draggedItem: DragItem | null,
  targetData: DropTarget | null,
  rootType: typeof SIDEBAR_ROOT_TYPE,
): boolean {
  if (!draggedItem || !targetData) return false
  if (targetData.id === draggedItem._id) return false

  // items cannot be dragged outside their category
  if (targetData.categoryId && !draggedItem.categoryId) {
    return false
  }
  if (draggedItem.categoryId && !targetData.categoryId) {
    return false
  }
  if (draggedItem.categoryId && targetData.categoryId) {
    if (draggedItem.categoryId !== targetData.categoryId) {
      return false
    }
  }

  // prevent dropping on same parent
  if (targetData.type === rootType && !draggedItem.parentId) return false
  if (targetData.type !== rootType && draggedItem.parentId === targetData.id) {
    return false
  }

  // items cannot be dropped on their own children
  if (targetData.ancestorIds?.includes(draggedItem._id as SidebarItemId)) {
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

  return validateDrop(
    {
      _id: draggedItem._id,
      type: draggedItem.type,
      parentId: draggedItem.parentId,
      categoryId: draggedItem.categoryId,
      ancestorIds: draggedItem.ancestorIds || [],
    },
    {
      id: targetData._id,
      type: targetData.type,
      categoryId: targetData.categoryId,
      ancestorIds: targetData.ancestorIds || [],
    },
    SIDEBAR_ROOT_TYPE,
  )
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
  moveFolder?: (params: {
    folderId: Id<'folders'>
    parentId?: SidebarItemId
  }) => Promise<any>
  moveTag?: (params: {
    tagId: Id<'tags'>
    parentId?: SidebarItemId
  }) => Promise<any>
}

export async function executeMove(
  itemType: SidebarItemType,
  itemId: Id<SidebarItemType>,
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
      if (!mutations.moveFolder) {
        throw new Error('moveFolder mutation not provided')
      }
      await mutations.moveFolder({
        folderId: itemId as Id<'folders'>,
        parentId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.tags:
      if (!mutations.moveTag) {
        throw new Error('moveTag mutation not provided')
      }
      await mutations.moveTag({
        tagId: itemId as Id<'tags'>,
        parentId: targetId,
      })
      break
    case SIDEBAR_ITEM_TYPES.tagCategories:
      console.error('Moving tag categories is not supported')
      break
    default:
      throw new Error(`Invalid item type: ${itemType}`)
  }
  if (targetId && callbacks?.openFolder) {
    callbacks.openFolder(targetId)
  }
}
