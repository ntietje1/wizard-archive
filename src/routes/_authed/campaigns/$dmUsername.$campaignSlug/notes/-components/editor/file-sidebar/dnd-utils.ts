import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES, SIDEBAR_ROOT_TYPE } from 'convex/notes/types'

export interface DragData {
  _id: string
  type: string
  categoryId?: Id<'tagCategories'> | null
  ancestorIds?: string[]
  [key: string]: any
}

export interface DropData {
  id: string
  type: string
  categoryId?: Id<'tagCategories'> | null
  ancestorIds?: string[]
  accepts?: string[]
  [key: string]: any
}

export function categoriesMatch(
  draggedCategoryId: Id<'tagCategories'> | null | undefined,
  targetCategoryId: Id<'tagCategories'> | null | undefined,
): boolean {
  return (
    draggedCategoryId === targetCategoryId ||
    (draggedCategoryId === undefined && targetCategoryId === undefined) ||
    (draggedCategoryId === null && targetCategoryId === null)
  )
}

export function isDescendant(
  draggedFolderId: string,
  targetAncestorIds: string[],
): boolean {
  return targetAncestorIds.includes(draggedFolderId)
}

export function validateFolderDrop(
  draggedItem: DragData | null,
  targetData: DropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  if (draggedItem.type !== SIDEBAR_ITEM_TYPES.folders) return false

  const targetAncestorIds = targetData?.ancestorIds || []
  if (isDescendant(draggedItem._id, targetAncestorIds)) return false

  return (
    targetData?.type === SIDEBAR_ROOT_TYPE ||
    targetData?.type === SIDEBAR_ITEM_TYPES.folders
  )
}

export function validateNoteDrop(
  draggedItem: DragData | null,
  targetData: DropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  if (draggedItem.type !== SIDEBAR_ITEM_TYPES.notes) return false

  return (
    targetData.type === SIDEBAR_ROOT_TYPE ||
    targetData.type === SIDEBAR_ITEM_TYPES.folders
  )
}

export function validateItemDrop(
  draggedItem: DragData | null,
  targetData: DropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  if (targetData.id === draggedItem._id) return false

  if (
    (targetData.type === SIDEBAR_ROOT_TYPE && !draggedItem.parentFolderId) ||
    (targetData.type === SIDEBAR_ITEM_TYPES.folders &&
      draggedItem.parentFolderId === targetData.id)
  ) {
    return false
  }

  if (!categoriesMatch(draggedItem.categoryId, targetData?.categoryId)) {
    return false
  }

  if (draggedItem.type === SIDEBAR_ITEM_TYPES.folders) {
    const targetAncestorIds = targetData?.ancestorIds || []
    if (isDescendant(draggedItem._id, targetAncestorIds)) return false
    return true
  }

  if (draggedItem.type === SIDEBAR_ITEM_TYPES.notes) {
    return true
  }

  return false
}

export function canDropItem(active: Active | null, over: Over | null): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as DragData | undefined
  const targetData = over.data.current as DropData | undefined

  if (!draggedItem || !targetData) return false

  return validateItemDrop(draggedItem, targetData)
}
