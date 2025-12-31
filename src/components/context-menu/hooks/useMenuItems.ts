import { createContext, useContext } from 'react'
import type { ActionHandlers } from '../menu-registry'
import type { MenuItemDef } from '../types'

interface ContextMenuContextValue {
  menuItems: Array<MenuItemDef>
  actions: ActionHandlers
  Dialogs: React.ComponentType
}

export const ContextMenuContext = createContext<ContextMenuContextValue | null>(
  null,
)

export function useMenuItems() {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error('useMenuItems must be within ContextMenuProvider')
  return ctx
}
