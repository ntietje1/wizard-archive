import React, { forwardRef } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { ViewContext } from '../types'
import type { TagCategory } from 'convex/tags/types'
import { useContextMenu } from '../hooks/useContextMenu'
import { ContextMenu } from '../components/ContextMenu'
import { useCampaign } from '~/contexts/CampaignContext'

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
  const { campaignWithMembership } = useCampaign()
  const memberRole = campaignWithMembership.data?.member.role

  const contextMenu = useContextMenu({
    viewContext,
    category,
    parentItem,
    memberRole,
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
