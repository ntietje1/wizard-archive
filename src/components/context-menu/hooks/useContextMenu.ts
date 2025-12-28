import { useCallback, useEffect, useState } from 'react'
import { SIDEBAR_ROOT_TYPE } from 'convex/sidebarItems/types'
import { createMenuContext } from '../context'
import type { ContextBuilderOptions, ContextEnhancer } from '../context'
import type {
  AnySidebarItem,
  SidebarItemOrRootType,
} from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from '../types'

interface MenuState {
  isOpen: boolean
  position: { x: number; y: number }
  context: MenuContext | null
}

interface UseContextMenuOptions {
  viewContext: ViewContext
  item?: AnySidebarItem
  parentItem?: AnySidebarItem
  /**
   * Context enhancers that add additional context.
   * This allows components to contribute context without
   * modifying the hook signature.
   */
  enhancers?: Array<ContextEnhancer>
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

  // Build context synchronously - can be called without an event
  const buildContext = useCallback(
    (item: AnySidebarItem | undefined): MenuContext | null => {
      const parentType = item ? getParentType(item) : SIDEBAR_ROOT_TYPE

      // Start with base context
      const baseContext: Partial<MenuContext> = {
        item,
        viewContext: options.viewContext,
        parentType,
      }

      // Apply all enhancers sequentially
      const enhancedContext =
        options.enhancers?.reduce(
          (ctx, enhancer) => enhancer.enhance(ctx),
          baseContext,
        ) ?? baseContext

      return createMenuContext(enhancedContext as ContextBuilderOptions)
    },
    [options, getParentType],
  )

  const open = useCallback(
    (event: React.MouseEvent, item: AnySidebarItem | undefined) => {
      // Don't preventDefault here - let the ContextMenuTrigger handle it
      // We just need to build the context
      event.stopPropagation()

      const context = buildContext(item)

      setMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        context,
      })
    },
    [buildContext],
  )

  const close = useCallback(() => {
    setMenu((prev) => ({ ...prev, isOpen: false }))
  }, [])

  // Close on outside click - but let DropdownMenu handle it via onOpenChange
  // We only handle Escape key here
  useEffect(() => {
    if (!menu.isOpen) return

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menu.isOpen, close])

  return {
    isOpen: menu.isOpen,
    position: menu.position,
    context: menu.context,
    buildContext,
    open,
    close,
  }
}
