import type { Active, Over } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import {
  SIDEBAR_ROOT_TYPE,
  type SidebarItemOrRootType,
  type SidebarItemType,
} from 'convex/notes/types'
import { validateDrop } from '~/utils/dnd-utils'

export interface SidebarDragData {
  _id: Id<SidebarItemType>
  name: string
  type: SidebarItemType
  parentFolderId?: Id<'folders'>
  categoryId?: Id<'tagCategories'> | null
  ancestorIds?: Id<'folders'>[]
}

export interface SidebarDropData {
  _id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  type: SidebarItemOrRootType
  categoryId?: Id<'tagCategories'> | null
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
      categoryId: draggedItem.categoryId || undefined,
      ancestorIds: draggedItem.ancestorIds || [],
    },
    {
      id: targetData._id,
      type: targetData.type,
      categoryId: targetData.categoryId || undefined,
      ancestorIds: targetData.ancestorIds || [],
    },
    SIDEBAR_ROOT_TYPE,
  )
}
