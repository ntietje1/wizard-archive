import { useEffect, useRef } from 'react'
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'

const EMPTY_ANCESTORS: Array<Id<'folders'>> = []

interface DraggableSidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<Id<'folders'>>
  children: React.ReactNode
}

export function DraggableSidebarItem({
  item,
  ancestorIds = [],
  children,
}: DraggableSidebarItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const safeAncestorIds = ancestorIds ?? EMPTY_ANCESTORS

  const canDrag = hasAtLeastPermissionLevel(
    item.myPermissionLevel,
    PERMISSION_LEVEL.FULL_ACCESS,
  )

  // Store mutable data in ref so useEffect doesn't re-run on data changes
  const dragDataRef = useRef({ ...item, ancestorIds: safeAncestorIds })
  dragDataRef.current = { ...item, ancestorIds: safeAncestorIds }

  // Only re-register when the item ID or permissions change
  useEffect(() => {
    const el = ref.current
    if (!el || !canDrag) return

    return draggable({
      element: el,
      getInitialData: () =>
        dragDataRef.current,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage })
      },
      onDragStart: () => {
        el.style.opacity = '0.5'
        el.setAttribute('data-item-dragging', '')
      },
      onDrop: () => {
        el.style.opacity = ''
        el.removeAttribute('data-item-dragging')
      },
    })
  }, [item._id, canDrag])

  return (
    <div className="w-full min-w-0" ref={ref}>
      {children}
    </div>
  )
}
