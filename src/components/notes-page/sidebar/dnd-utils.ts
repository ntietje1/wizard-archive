import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from '~/lib/icons'
import {
  SIDEBAR_ROOT_TYPE,
  type SidebarItemOrRootType,
  type SidebarItemType,
} from 'convex/sidebarItems/types'
import { validateDrop } from '~/utils/dnd-utils'

export interface SidebarDragData {
  _id: Id<SidebarItemType>
  type: SidebarItemType
  parentFolderId?: Id<'folders'>
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'folders'>[]
  name: string
  icon: LucideIcon
}

export interface SidebarDropData {
  _id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'>
  ancestorIds?: Id<'folders'>[]
  accepts?: SidebarItemType[]
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
      parentFolderId: draggedItem.parentFolderId,
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
