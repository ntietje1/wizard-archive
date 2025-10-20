import { useDroppable, useDndContext } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import {
  CATEGORY_ITEM_TYPES,
  validateCategoryItemDrop,
  type CategoryDragData,
  type CategoryDropData,
} from './dnd-utils'
import React from 'react'

interface BreadcrumbDropZoneProps {
  id: Id<'folders'> | 'category-root'
  categoryId?: Id<'tagCategories'>
  isRoot?: boolean
  children: React.ReactElement
}

export function BreadcrumbDropZone({
  id,
  categoryId,
  isRoot = false,
  children,
}: BreadcrumbDropZoneProps) {
  const { active } = useDndContext()

  const dropData: CategoryDropData = {
    _id: id,
    type: isRoot ? 'category-root' : CATEGORY_ITEM_TYPES.folders,
    categoryId,
    isBreadcrumbTarget: true,
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
