import { useMemo } from 'react'
import type { MenuContext } from '../types'
import type { ContextMenuItem } from '../components/ContextMenu'
import { useMenuItems } from '../components/ContextMenuProvider'
import { buildMenu } from '../menu-builder'

/**
 * Hook that builds menu items from a context object.
 * Useful for components that need menu items but not the full context menu component.
 *
 * @param context - The menu context to build items from
 * @returns Array of ContextMenuItem objects ready to use
 */
export function useMenuItemsFromContext(
  context: MenuContext | null,
): ContextMenuItem[] {
  const { menuItems } = useMenuItems()

  return useMemo(() => {
    if (!context) return []

    const builtMenu = buildMenu(menuItems, context)

    if (builtMenu.isEmpty) return []

    return builtMenu.flatItems.map((menuItem) => {
      const label =
        typeof menuItem.label === 'function'
          ? menuItem.label(context)
          : menuItem.label
      const IconComponent = menuItem.icon

      return {
        type: 'action' as const,
        label,
        icon: IconComponent ? <IconComponent className="h-4 w-4" /> : undefined,
        onClick: () => menuItem.action(context),
        className:
          menuItem.variant === 'danger'
            ? 'text-red-600 focus:text-red-600'
            : undefined,
      }
    })
  }, [menuItems, context])
}
