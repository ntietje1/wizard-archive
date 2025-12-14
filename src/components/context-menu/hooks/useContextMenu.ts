import { useState, useCallback, useEffect } from 'react'
import {
  SIDEBAR_ROOT_TYPE,
  type AnySidebarItem,
  type SidebarItemOrRootType,
} from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from '../types'
import { createMenuContext } from '../context-builder'
import type { TagCategory } from 'convex/tags/types'
import type { CampaignMemberRole } from 'convex/campaigns/types'

interface MenuState {
  isOpen: boolean
  position: { x: number; y: number }
  context: MenuContext | null
}

interface UseContextMenuOptions {
  viewContext: ViewContext
  category?: TagCategory
  memberRole?: CampaignMemberRole
  activeMapId?: string
  activeCanvasId?: string
  parentItem?: AnySidebarItem
}

export function useContextMenu(options: UseContextMenuOptions) {
  const [menu, setMenu] = useState<MenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    context: null,
  })

  const getParentType = useCallback(
    (item: AnySidebarItem): SidebarItemOrRootType => {
      if (!item.parentId) {
        return SIDEBAR_ROOT_TYPE
      }
      if (options.parentItem && options.parentItem._id === item.parentId) {
        return options.parentItem.type
      }
      return SIDEBAR_ROOT_TYPE
    },
    [options.parentItem],
  )

  const open = useCallback(
    (event: React.MouseEvent, item: AnySidebarItem | undefined) => {
      event.preventDefault()
      event.stopPropagation()

      const parentType = item ? getParentType(item) : SIDEBAR_ROOT_TYPE

      const context = createMenuContext({
        item,
        viewContext: options.viewContext,
        parentType,
        category: options.category,
        memberRole: options.memberRole,
        activeMapId: options.activeMapId,
        activeCanvasId: options.activeCanvasId,
      })

      setMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        context,
      })
    },
    [options, getParentType],
  )

  const close = useCallback(() => {
    setMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!menu.isOpen) return

    const handleClick = () => close()
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menu.isOpen, close])

  return {
    isOpen: menu.isOpen,
    position: menu.position,
    context: menu.context,
    open,
    close,
  }
}
