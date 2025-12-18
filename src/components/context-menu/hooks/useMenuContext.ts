import { useMemo } from 'react'
import {
  SIDEBAR_ROOT_TYPE,
  type AnySidebarItem,
  type SidebarItemOrRootType,
} from 'convex/sidebarItems/types'
import type { MenuContext, ViewContext } from '../types'
import { createMenuContext, type ContextEnhancer } from '../context'

interface UseMenuContextOptions {
  item?: AnySidebarItem
  viewContext: ViewContext
  parentItem?: AnySidebarItem
  enhancers?: ContextEnhancer[]
}

/**
 * Hook that builds menu context from enhancers.
 * Useful for components that need context but not the full context menu hook.
 *
 * @param options - Options for building context
 * @returns MenuContext object or null if item is not available
 */
export function useMenuContext(
  options: UseMenuContextOptions,
): MenuContext | null {
  const { item, viewContext, parentItem, enhancers } = options

  return useMemo(() => {
    if (!item) return null

    const getParentType = (item: AnySidebarItem): SidebarItemOrRootType => {
      if (!item.parentId) {
        return SIDEBAR_ROOT_TYPE
      }
      if (parentItem && parentItem._id === item.parentId) {
        return parentItem.type
      }
      return SIDEBAR_ROOT_TYPE
    }

    const parentType = getParentType(item)

    // Start with base context
    const baseContext: Partial<MenuContext> = {
      item,
      viewContext,
      parentType,
    }

    // Apply all enhancers sequentially
    const enhancedContext =
      enhancers?.reduce(
        (ctx, enhancer) => enhancer.enhance(ctx),
        baseContext,
      ) ?? baseContext

    // Create final context (with defaults)
    return createMenuContext(enhancedContext as any)
  }, [item, viewContext, parentItem, enhancers])
}
