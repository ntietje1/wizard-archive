import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'

export const CATEGORY_ITEM_TYPES = {
  folders: 'category-folder',
  tags: 'category-tag',
} as const

export const CATEGORY_ROOT_TYPE = 'category-root'

export interface CategoryDragData {
  _id: string
  type:
    | (typeof CATEGORY_ITEM_TYPES)[keyof typeof CATEGORY_ITEM_TYPES]
    | typeof CATEGORY_ROOT_TYPE
  parentFolderId?: Id<'folders'>
  noteId?: Id<'notes'>
  name: string
  icon: LucideIcon
  [key: string]: any
}

export interface CategoryDropData {
  id: string
  type:
    | (typeof CATEGORY_ITEM_TYPES)[keyof typeof CATEGORY_ITEM_TYPES]
    | typeof CATEGORY_ROOT_TYPE
  [key: string]: any
}

export function canDropFolder(
  active: Active | null,
  over: Over | null,
): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as CategoryDragData
  const targetData = over.data.current as CategoryDropData

  if (draggedItem.type !== CATEGORY_ITEM_TYPES.folders) return false

  const validTarget =
    targetData.type === CATEGORY_ITEM_TYPES.folders ||
    targetData.type === CATEGORY_ROOT_TYPE

  return validTarget
}

export function canDropTag(active: Active | null, over: Over | null): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as CategoryDragData
  const targetData = over.data.current as CategoryDropData

  if (draggedItem.type !== CATEGORY_ITEM_TYPES.tags) return false

  const validTarget =
    targetData.type === CATEGORY_ITEM_TYPES.folders ||
    targetData.type === CATEGORY_ROOT_TYPE

  return validTarget
}

export function canDropCategoryItem(
  active: Active | null,
  over: Over | null,
): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as CategoryDragData
  const targetData = over.data.current as CategoryDropData

  if (
    targetData.id === draggedItem._id ||
    draggedItem.parentFolderId === targetData.id ||
    (targetData.type === CATEGORY_ROOT_TYPE && !draggedItem.parentFolderId)
  ) {
    return false
  }

  if (draggedItem.type === CATEGORY_ITEM_TYPES.folders) {
    return canDropFolder(active, over)
  }

  if (draggedItem.type === CATEGORY_ITEM_TYPES.tags) {
    return canDropTag(active, over)
  }

  return false
}
