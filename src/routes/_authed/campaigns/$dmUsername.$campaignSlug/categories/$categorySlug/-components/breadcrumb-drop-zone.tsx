import { useDroppable } from '@dnd-kit/core'
import type { Id } from 'convex/_generated/dataModel'
import { CATEGORY_ITEM_TYPES } from './dnd-utils'
import React from 'react'

interface BreadcrumbDropZoneProps {
  id: Id<'folders'> | 'category-root'
  categoryId?: Id<'tagCategories'>
  isRoot?: boolean
  children:
    | React.ReactElement
    | ((props: { isOver: boolean }) => React.ReactElement)
}

export function BreadcrumbDropZone({
  id,
  categoryId,
  isRoot = false,
  children,
}: BreadcrumbDropZoneProps) {
  const dropData = {
    id,
    type: isRoot ? 'category-root' : CATEGORY_ITEM_TYPES.folders,
    categoryId,
    isBreadcrumbTarget: true,
  }

  const { setNodeRef, isOver } = useDroppable({
    id,
    data: dropData,
  })

  return (
    <div
      ref={setNodeRef}
      className={`transition-all border p-1 rounded group ${
        isOver
          ? 'bg-amber-400/20 border-amber-400 shadow-md'
          : 'border-transparent'
      }`}
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      {typeof children === 'function' ? children({ isOver }) : children}
    </div>
  )
}
