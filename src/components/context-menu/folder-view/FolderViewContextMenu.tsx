import React, { forwardRef, useCallback, useRef } from 'react'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { ContextMenu } from '../components/ContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { MenuContext } from '../types'
import type { TagCategory } from 'convex/tags/types'
import type { ContextMenuRef } from '../components/ContextMenu'

interface FolderViewContextMenuProps {
  item?: AnySidebarItem
  category?: TagCategory
  children: React.ReactNode
  className?: string
}

export interface FolderViewContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

export const FolderViewContextMenu = forwardRef<
  FolderViewContextMenuRef,
  FolderViewContextMenuProps
>(({ item, category, children, className }, ref) => {
  const enhancers = useContextEnhancers({ category })

  const contextMenuHook = useContextMenu({
    viewContext: 'folder-view',
    item,
    enhancers,
  })

  const contextMenuRef = useRef<ContextMenuRef>(null)

  const buildContext = useCallback((): MenuContext | null => {
    return contextMenuHook.buildContext(item)
  }, [item, contextMenuHook])

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
