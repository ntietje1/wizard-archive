import React, { forwardRef, useCallback, useMemo, useRef } from 'react'
import { useContextMenu } from '../hooks/useContextMenu'
import { useContextEnhancers } from '../hooks/useContextEnhancers'
import { createShareEnhancer } from '../context'
import { ContextMenu } from '../components/ContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { MenuContext } from '../types'
import type { ContextMenuRef } from '../components/ContextMenu'
import { useSidebarItemShares } from '~/hooks/useSidebarItemShares'

interface TopbarContextMenuProps {
  item?: AnySidebarItem
  children: React.ReactNode
  className?: string
}

export interface TopbarContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

export const TopbarContextMenu = forwardRef<
  TopbarContextMenuRef,
  TopbarContextMenuProps
>(({ item, children, className }, ref) => {
  const baseEnhancers = useContextEnhancers()

  // Get share state for this item
  const shareState = useSidebarItemShares(item?._id)

  // Combine base enhancers with share enhancer
  const enhancers = useMemo(
    () => [...baseEnhancers, createShareEnhancer(shareState)],
    [baseEnhancers, shareState],
  )

  const contextMenuHook = useContextMenu({
    viewContext: 'topbar',
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
