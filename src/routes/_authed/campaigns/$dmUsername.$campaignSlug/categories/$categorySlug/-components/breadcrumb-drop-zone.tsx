import { useDroppable, useDndContext } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import {
  validateCategoryItemDrop,
  type CategoryDragData,
  type CategoryDropData,
} from './dnd-utils'
import React from 'react'
import {
  SIDEBAR_ITEM_TYPES,
  SIDEBAR_ROOT_TYPE,
  type SidebarItemType,
} from 'convex/notes/types'

interface BreadcrumbDropZoneProps {
  id: Id<SidebarItemType> | typeof SIDEBAR_ROOT_TYPE
  categoryId?: Id<'tagCategories'>
  children: React.ReactElement
}

export function BreadcrumbDropZone({
  id,
  categoryId,
  children,
}: BreadcrumbDropZoneProps) {
  const { active } = useDndContext()

  const dropData: CategoryDropData = {
    _id: id,
    type:
      id === SIDEBAR_ROOT_TYPE ? SIDEBAR_ROOT_TYPE : SIDEBAR_ITEM_TYPES.folders,
    categoryId,
  }

  const { setNodeRef, isOver } = useDroppable({
    id,
    data: dropData,
  })

  const isValidDropTarget =
    isOver &&
    validateCategoryItemDrop(
      active?.data?.current as CategoryDragData | null,
      dropData,
    )

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-100 hover:duration-200 border p-1 rounded-md group ${
        isValidDropTarget
          ? 'bg-amber-400/20 border-amber-400 shadow-md'
          : 'border-transparent'
      }`}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {children}
    </div>
  )
}
