import React, { forwardRef, useCallback, useRef } from 'react'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { ContextMenu } from '../components/ContextMenu'
import type { ContextMenuRef } from '../components/ContextMenu'
import type { MenuContext } from '../types'
import type { AnySidebarItem } from 'convex/sidebarItems/types'

interface MapViewContextMenuProps {
  item?: AnySidebarItem
  children: React.ReactNode
  className?: string
}

export interface MapViewContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

export const MapViewContextMenu = forwardRef<
  MapViewContextMenuRef,
  MapViewContextMenuProps
>(({ item, children, className }, ref) => {
  const enhancers = useContextEnhancers({ includeMapView: true })

  const contextMenuHook = useContextMenu({
    viewContext: 'map-view',
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
