import React, { forwardRef } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { ViewContext } from '../types'
import type { TagCategory } from 'convex/tags/types'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { ContextMenu } from '../components/ContextMenu'

interface SidebarItemContextMenuProps {
  item?: AnySidebarItem
  viewContext: ViewContext
  category?: TagCategory
  parentItem?: AnySidebarItem
  children: React.ReactNode
  className?: string
}

export interface SidebarItemContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

export const SidebarItemContextMenu = forwardRef<
  SidebarItemContextMenuRef,
  SidebarItemContextMenuProps
>(({ item, viewContext, category, parentItem, children, className }, ref) => {
  // Use the enhancer hook to get common enhancers
  const enhancers = useContextEnhancers({ category })

  const contextMenu = useContextMenu({
    viewContext,
    item,
    parentItem,
    enhancers,
  })

  React.useImperativeHandle(ref, () => ({
    open: (position?: { x: number; y: number }) => {
      if (!item) return
      const syntheticEvent = {
        clientX: position?.x ?? 0,
        clientY: position?.y ?? 0,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as React.MouseEvent
      contextMenu.open(syntheticEvent, item)
    },
    close: contextMenu.close,
  }))

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!item) return
    contextMenu.open(e, item)
  }
  return (
    <>
      <div onContextMenu={handleContextMenu} className={className}>
        {children}
      </div>

      {contextMenu.isOpen && contextMenu.context && (
        <ContextMenu
          x={contextMenu.position.x}
          y={contextMenu.position.y}
          context={contextMenu.context}
          onClose={contextMenu.close}
        />
      )}
    </>
  )
})
