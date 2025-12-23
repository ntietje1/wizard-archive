import React, { forwardRef, useCallback, useRef } from 'react'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { ContextMenu  } from '../components/ContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from '../types'
import type { TagCategory } from 'convex/tags/types'
import type {ContextMenuRef} from '../components/ContextMenu';

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

  const contextMenuHook = useContextMenu({
    viewContext,
    item,
    parentItem,
    enhancers,
  })

  const contextMenuRef = useRef<ContextMenuRef>(null)

  // Build context function - this will be called by ContextMenu when needed
  const buildContext = useCallback((): MenuContext | null => {
    return contextMenuHook.buildContext(item)
  }, [item, contextMenuHook.buildContext])

  React.useImperativeHandle(ref, () => ({
    open: (position?: { x: number; y: number }) => {
      if (position) {
        contextMenuRef.current?.open(position)
      } else {
        contextMenuRef.current?.open()
      }
    },
    close: () => {
      contextMenuRef.current?.close()
    },
  }))

  return (
    <ContextMenu
      ref={contextMenuRef}
      buildContext={buildContext}
      onClose={contextMenuHook.close}
      className={className}
    >
      {children}
    </ContextMenu>
  )
})
