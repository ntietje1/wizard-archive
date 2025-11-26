import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'
import {
  SIDEBAR_ROOT_TYPE,
  type SidebarItemOrRootType,
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import { validateDrop } from '~/utils/dnd-utils'

export interface CategoryDragData {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentId?: Id<'notes'>
  noteId?: Id<'notes'>
  categoryId?: Id<'tagCategories'>
  name: string
  icon: LucideIcon
}

export interface CategoryDropData {
  _id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
}

export function canDropCategoryItem(
  active: Active | null,
  over: Over | null,
): boolean {
  if (!active || !over) return false

  const draggedItem = active.data.current as CategoryDragData | undefined
  const targetData = over.data.current as CategoryDropData | undefined

  if (!draggedItem || !targetData) return false

  return validateDrop(
    {
      _id: draggedItem._id,
      type: draggedItem.type,
      parentId: draggedItem.parentId,
      categoryId: draggedItem.categoryId,
      ancestorIds: [], // don't need to check ancestorIds because we can only see 1 level in the category page
    },
    {
      id: targetData._id,
      type: targetData.type,
      categoryId: targetData.categoryId,
      ancestorIds: [], // same here
    },
    SIDEBAR_ROOT_TYPE,
  )
}

export function validateCategoryItemDrop(
  draggedItem: CategoryDragData | null,
  targetData: CategoryDropData | null,
): boolean {
  if (!draggedItem || !targetData) return false

  return validateDrop(
    {
      _id: draggedItem._id,
      type: draggedItem.type,
      parentId: draggedItem.parentId,
      categoryId: draggedItem.categoryId,
      ancestorIds: [],
    },
    {
      id: targetData._id,
      type: targetData.type,
      categoryId: targetData.categoryId,
      ancestorIds: [],
    },
    SIDEBAR_ROOT_TYPE,
  )
}
